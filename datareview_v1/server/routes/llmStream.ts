import type { Response } from "express";
import { detectSystemProfile } from "../lib/systemProfileDetect.js";

/**
 * Unified LLM dispatcher.
 *
 * Given a user-selected AI configuration (ai), streams a chat completion from
 * the appropriate backend and re-emits it as OpenAI-compatible Server-Sent
 * Events - the data: {choices:[{delta:{content:"..."}}]} shape
 * every AI surface in the frontend already parses. So adding new providers
 * never requires touching the client.
 *
 * Backends:
 *  - auto   -> detects this machine's hardware (CPU/RAM/GPU) + installed
 *              Ollama models and picks the best local setup automatically
 *              (model that fits memory, GPU offload, context window size).
 *  - none   -> friendly explanatory message, no model call.
 *  - local  -> Ollama (/api/chat), with a GPU offload toggle. Model/numCtx
 *              set to "auto" are resolved from the detected system profile.
 *  - cloud  -> OpenAI / OpenAI-compatible (/chat/completions), Anthropic
 *              (/v1/messages) or Gemini (:streamGenerateContent). Each is
 *              converted to the OpenAI delta shape.
 *
 * Cloud API keys are received from the client (stored only in the user's
 * browser) and forwarded solely to the chosen provider. They are never logged.
 */

export interface LLMMessage {
  role: string;
  content: string;
}

export interface AIConfig {
  mode: "auto" | "none" | "local" | "cloud";
  local?: {
    ollamaUrl: string;
    /** "auto" = melhor modelo instalado para o hardware detectado. */
    model: string;
    useGpu: boolean;
    /** "auto" = num_ctx recomendado pelo perfil de hardware. */
    numCtx?: number | "auto";
  };
  cloud?: {
    provider: "openai" | "anthropic" | "gemini" | "openai-compatible";
    apiKey: string;
    baseUrl: string;
    model: string;
  };
}

export interface StreamOptions {
  temperature?: number;
  numCtx?: number;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
};

function writeDelta(res: Response, content: string): void {
  res.write(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`);
}

function writeDone(res: Response): void {
  res.write("data: [DONE]\n\n");
}

export interface ResolvedAI {
  config: AIConfig;
  /** num_ctx efetivo para Ollama (do perfil detectado ou override do usuário). */
  numCtx?: number;
}

const DEFAULT_NUM_CTX = 32768;

/**
 * Merge the incoming ai config with the detected system profile and env-based
 * defaults (backward compat). "auto" (mode, model or numCtx) is resolved here:
 * the machine's hardware + installed Ollama models decide the best local setup.
 */
export async function resolveAI(ai: AIConfig | undefined): Promise<ResolvedAI> {
  const envLocal = {
    ollamaUrl: process.env.OLLAMA_URL || "http://localhost:11434",
    model: process.env.OLLAMA_MODEL || "gemma3:4b",
    useGpu: true,
  };

  if (!ai || !ai.mode || ai.mode === "auto") {
    try {
      const profile = await detectSystemProfile();
      const rec = profile.recommended;
      if (rec.mode === "local" && rec.model) {
        return {
          config: {
            mode: "local",
            local: {
              ollamaUrl: ai?.local?.ollamaUrl || envLocal.ollamaUrl,
              model: rec.model,
              useGpu: rec.useGpu,
              numCtx: rec.numCtx,
            },
          },
          numCtx: rec.numCtx,
        };
      }
    } catch { /* detecção falhou — cai no fallback env */ }
    return { config: { mode: "local", local: envLocal }, numCtx: DEFAULT_NUM_CTX };
  }

  if (ai.mode === "local" && ai.local) {
    const needsModel = !ai.local.model || ai.local.model === "auto";
    const needsCtx = ai.local.numCtx == null || ai.local.numCtx === "auto";
    if (needsModel || needsCtx) {
      try {
        const profile = await detectSystemProfile();
        const rec = profile.recommended;
        return {
          config: {
            ...ai,
            local: {
              ...ai.local,
              model: needsModel ? rec.model || envLocal.model : ai.local.model,
            },
          },
          numCtx: needsCtx ? rec.numCtx : (ai.local.numCtx as number),
        };
      } catch {
        return {
          config: {
            ...ai,
            local: { ...ai.local, model: needsModel ? envLocal.model : ai.local.model },
          },
          numCtx: needsCtx ? DEFAULT_NUM_CTX : (ai.local.numCtx as number),
        };
      }
    }
    return { config: ai, numCtx: ai.local.numCtx as number | undefined };
  }

  return { config: ai, numCtx: undefined };
}

export async function streamLLM(
  messages: LLMMessage[],
  res: Response,
  ai: AIConfig | undefined,
  options: StreamOptions = {},
): Promise<void> {
  res.set(corsHeaders);
  res.set("Content-Type", "text/event-stream");

  const { config: cfg, numCtx: detectedNumCtx } = await resolveAI(ai);
  const effectiveOptions: StreamOptions = {
    ...options,
    numCtx: options.numCtx ?? detectedNumCtx,
  };

  if (cfg.mode === "none") {
    writeDelta(
      res,
      "A geracao com IA esta desativada. Abra **Configuracoes - Inteligencia Artificial** no painel esquerdo e escolha um modo (local via Ollama ou na nuvem com sua propria chave de API) para habilitar as analises.",
    );
    writeDone(res);
    res.end();
    return;
  }

  if (cfg.mode === "local") {
    return streamOllama(messages, res, cfg, effectiveOptions);
  }

  if (cfg.mode === "cloud" && cfg.cloud) {
    const { provider } = cfg.cloud;
    if (provider === "anthropic") return streamAnthropic(messages, res, cfg.cloud, effectiveOptions);
    if (provider === "gemini") return streamGemini(messages, res, cfg.cloud, effectiveOptions);
    return streamOpenAI(messages, res, cfg.cloud, effectiveOptions);
  }

  writeDelta(res, "Configuracao de IA invalida. Revise suas configuracoes de IA.");
  writeDone(res);
  res.end();
  return;
}

// ---------------------------------------------------------------------------
// Ollama (local)
// ---------------------------------------------------------------------------

async function streamOllama(
  messages: LLMMessage[],
  res: Response,
  cfg: AIConfig,
  options: StreamOptions,
): Promise<void> {
  const local = cfg.local!;
  const ollamaUrl = local.ollamaUrl || "http://localhost:11434";
  const model = local.model || "gemma3:4b";

  const ollamaOptions: Record<string, number | boolean> = {};
  if (options.temperature != null) ollamaOptions.temperature = options.temperature;
  if (options.numCtx != null) ollamaOptions.num_ctx = options.numCtx;
  // GPU toggle: 0 layers offload = CPU only; -1 = all layers on GPU.
  ollamaOptions.num_gpu = local.useGpu === false ? 0 : -1;

  let upstream: globalThis.Response;
  try {
    upstream = await fetch(`${ollamaUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        options: Object.keys(ollamaOptions).length ? ollamaOptions : undefined,
      }),
    });
  } catch (connErr) {
    console.error("Ollama connection error:", connErr);
    const msg =
      `Nao foi possivel conectar ao Ollama em ${ollamaUrl}. ` +
      `Inicie o Ollama (ollama serve) e verifique se o modelo "${model}" esta disponivel (ollama pull ${model}).`;
    writeDelta(res, `\n\n**[Erro]** ${msg}`);
    writeDone(res);
    res.end();
    return;
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    console.error(`Ollama error ${upstream.status}:`, detail);
    writeDelta(res, `\n\n**[Erro]** Ollama respondeu ${upstream.status}: ${detail.slice(0, 300)}`);
    writeDone(res);
    res.end();
    return;
  }

  await pipeLineNDJSON(upstream.body, res, (jsonStr) => {
    try {
      const json = JSON.parse(jsonStr);
      const content: string | undefined = json?.message?.content;
      if (content) writeDelta(res, content);
      if (json.done) writeDone(res);
    } catch { /* ignore malformed partial */ }
  });
}


// ---------------------------------------------------------------------------
// OpenAI / OpenAI-compatible
// ---------------------------------------------------------------------------

async function streamOpenAI(
  messages: LLMMessage[],
  res: Response,
  cloud: NonNullable<AIConfig["cloud"]>,
  options: StreamOptions,
): Promise<void> {
  const baseUrl = (cloud.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = cloud.model;

  let upstream: globalThis.Response;
  try {
    upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cloud.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature: options.temperature,
      }),
    });
  } catch (connErr) {
    console.error("OpenAI connection error:", connErr);
    writeDelta(res, `\n\n**[Erro]** Falha de conexao com ${baseUrl}. Verifique a URL e sua conexao.`);
    writeDone(res);
    res.end();
    return;
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    console.error(`OpenAI error ${upstream.status}:`, detail);
    writeDelta(res, `\n\n**[Erro]** Provedor respondeu ${upstream.status}: ${detail.slice(0, 300)}`);
    writeDone(res);
    res.end();
    return;
  }

  await pipeSSE(upstream.body, res, (data) => {
    if (data === "[DONE]") { writeDone(res); return; }
    try {
      const json = JSON.parse(data);
      const content: string | undefined = json?.choices?.[0]?.delta?.content;
      if (content) writeDelta(res, content);
      if (json?.choices?.[0]?.finish_reason) writeDone(res);
    } catch { /* ignore */ }
  });
}

// ---------------------------------------------------------------------------
// Anthropic (Claude)
// ---------------------------------------------------------------------------

async function streamAnthropic(
  messages: LLMMessage[],
  res: Response,
  cloud: NonNullable<AIConfig["cloud"]>,
  options: StreamOptions,
): Promise<void> {
  const baseUrl = (cloud.baseUrl || "https://api.anthropic.com").replace(/\/$/, "");
  const model = cloud.model;
  const systemMsg = messages.find((m) => m.role === "system");
  const convo = messages.filter((m) => m.role !== "system");

  let upstream: globalThis.Response;
  try {
    upstream = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": cloud.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 8192,
        stream: true,
        temperature: options.temperature,
        system: systemMsg?.content,
        messages: convo.map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        })),
      }),
    });
  } catch (connErr) {
    console.error("Anthropic connection error:", connErr);
    writeDelta(res, `\n\n**[Erro]** Falha de conexao com ${baseUrl}.`);
    writeDone(res);
    res.end();
    return;
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    console.error(`Anthropic error ${upstream.status}:`, detail);
    writeDelta(res, `\n\n**[Erro]** Anthropic respondeu ${upstream.status}: ${detail.slice(0, 300)}`);
    writeDone(res);
    res.end();
    return;
  }

  await pipeSSE(upstream.body, res, (data) => {
    try {
      const json = JSON.parse(data);
      if (json?.type === "content_block_delta" && json?.delta?.text) {
        writeDelta(res, json.delta.text as string);
      }
      if (json?.type === "message_stop") writeDone(res);
    } catch { /* ignore */ }
  });
}

// ---------------------------------------------------------------------------
// Google Gemini
// ---------------------------------------------------------------------------

async function streamGemini(
  messages: LLMMessage[],
  res: Response,
  cloud: NonNullable<AIConfig["cloud"]>,
  options: StreamOptions,
): Promise<void> {
  const baseUrl = (cloud.baseUrl || "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/, "");
  const model = cloud.model || "gemini-1.5-flash";

  const systemMsg = messages.find((m) => m.role === "system");
  const convo = messages.filter((m) => m.role !== "system");
  const contents = convo.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const body: Record<string, unknown> = {
    contents,
    generationConfig: { temperature: options.temperature ?? 0.7 },
  };
  if (systemMsg?.content) {
    body.systemInstruction = { parts: [{ text: systemMsg.content }] };
  }

  let upstream: globalThis.Response;
  try {
    upstream = await fetch(
      `${baseUrl}/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(cloud.apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
  } catch (connErr) {
    console.error("Gemini connection error:", connErr);
    writeDelta(res, `\n\n**[Erro]** Falha de conexao com ${baseUrl}.`);
    writeDone(res);
    res.end();
    return;
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    console.error(`Gemini error ${upstream.status}:`, detail);
    writeDelta(res, `\n\n**[Erro]** Gemini respondeu ${upstream.status}: ${detail.slice(0, 300)}`);
    writeDone(res);
    res.end();
    return;
  }

  await pipeSSE(upstream.body, res, (data) => {
    try {
      const json = JSON.parse(data);
      const parts = json?.candidates?.[0]?.content?.parts;
      if (Array.isArray(parts)) {
        for (const p of parts) if (typeof p?.text === "string") writeDelta(res, p.text);
      }
      if (json?.candidates?.[0]?.finishReason) writeDone(res);
    } catch { /* ignore */ }
  });
}


// ---------------------------------------------------------------------------
// Shared readers
// pipeSSE: upstream sends `data: <json>\n\n` lines (OpenAI / Anthropic / Gemini)
// pipeLineNDJSON: upstream sends one JSON object per line (Ollama)
// ---------------------------------------------------------------------------

async function pipeSSE(
  body: ReadableStream<Uint8Array>,
  res: Response,
  handleData: (data: string) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let doneSent = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newlineIdx: number;
      while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIdx).trim();
        buffer = buffer.slice(newlineIdx + 1);
        if (!line || !line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") { if (!doneSent) { doneSent = true; writeDone(res); } continue; }
        handleData(data);
      }
    }
  } catch (err) {
    console.error("cloud stream error:", err);
  } finally {
    if (!doneSent && !res.writableEnded) writeDone(res);
    if (!res.writableEnded) res.end();
  }
}

async function pipeLineNDJSON(
  body: ReadableStream<Uint8Array>,
  res: Response,
  handleLine: (line: string) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const doneSent = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newlineIdx: number;
      while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIdx).trim();
        buffer = buffer.slice(newlineIdx + 1);
        if (!line) continue;
        handleLine(line);
      }
    }
  } catch (err) {
    console.error("ollama stream error:", err);
  } finally {
    if (!doneSent && !res.writableEnded) writeDone(res);
    if (!res.writableEnded) res.end();
  }
}

// ---------------------------------------------------------------------------
// Health: probe the configured backend (used by the Settings "test" button)
// ---------------------------------------------------------------------------

export async function testAIConnection(ai: AIConfig): Promise<{ ok: boolean; message: string }> {
  const { config: cfg } = await resolveAI(ai);
  if (cfg.mode === "none") return { ok: false, message: "IA desativada." };

  if (cfg.mode === "local" && cfg.local) {
    try {
      const r = await fetch(`${cfg.local.ollamaUrl}/api/tags`, { method: "GET" });
      if (!r.ok) return { ok: false, message: `Ollama respondeu ${r.status}` };
      const autoNote = ai.mode === "auto" || ai.local?.model === "auto" ? ` (auto: ${cfg.local.model})` : "";
      return { ok: true, message: `Ollama acessivel em ${cfg.local.ollamaUrl}${autoNote}` };
    } catch {
      return { ok: false, message: `Sem conexao com Ollama em ${cfg.local.ollamaUrl}` };
    }
  }

  if (cfg.mode === "cloud" && cfg.cloud) {
    const { provider, apiKey, model } = cfg.cloud;
    if (!apiKey) return { ok: false, message: "Informe uma chave de API." };
    if (!model) return { ok: false, message: "Informe um modelo." };
    try {
      if (provider === "anthropic") {
        const baseUrl = (cfg.cloud.baseUrl || "https://api.anthropic.com").replace(/\/$/, "");
        const r = await fetch(`${baseUrl}/v1/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({ model, max_tokens: 1, messages: [{ role: "user", content: "ping" }] }),
        });
        if (!r.ok) return { ok: false, message: `Anthropic respondeu ${r.status}: ${(await r.text().catch(() => "")).slice(0, 120)}` };
        return { ok: true, message: `Anthropic OK (${model}).` };
      }
      if (provider === "gemini") {
        const baseUrl = (cfg.cloud.baseUrl || "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/, "");
        const r = await fetch(`${baseUrl}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: "ping" }] }], generationConfig: { maxOutputTokens: 1 } }),
        });
        if (!r.ok) return { ok: false, message: `Gemini respondeu ${r.status}: ${(await r.text().catch(() => "")).slice(0, 120)}` };
        return { ok: true, message: `Gemini OK (${model}).` };
      }
      const baseUrl = (cfg.cloud.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
      const r = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages: [{ role: "user", content: "ping" }], max_tokens: 1 }),
      });
      if (!r.ok) return { ok: false, message: `Provedor respondeu ${r.status}: ${(await r.text().catch(() => "")).slice(0, 120)}` };
      return { ok: true, message: `Provedor OK (${model}).` };
    } catch (e) {
      return { ok: false, message: `Erro de conexao: ${e instanceof Error ? e.message : "desconhecido"}` };
    }
  }

  return { ok: false, message: "Configuracao invalida." };
}

