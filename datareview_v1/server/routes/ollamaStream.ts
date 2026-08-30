import type { Response } from "express";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gemma3:4b";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
};

/**
 * Streams a chat completion from the local Ollama server and re-emits it as
 * OpenAI-compatible Server-Sent Events. The frontend already parses this exact
 * `data: {"choices":[{"delta":{"content":"..."}}]}` / `data: [DONE]` shape, so
 * the conversion is a direct translation of Ollama's `{"message":{"content"}}`
 * chunk format.
 */
export async function streamOllamaAsOpenAI(
  messages: { role: string; content: string }[],
  res: Response,
  options: { temperature?: number; numCtx?: number } = {}
) {
  res.set(corsHeaders);
  res.set("Content-Type", "text/event-stream");

  const ollamaOptions: Record<string, number> = {};
  if (options.temperature != null) ollamaOptions.temperature = options.temperature;
  // Larger context window so the full dataset fits. gemma3 supports up to 128k.
  if (options.numCtx != null) ollamaOptions.num_ctx = options.numCtx;

  let upstream: globalThis.Response;
  try {
    upstream = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages,
        stream: true,
        options: Object.keys(ollamaOptions).length ? ollamaOptions : undefined,
      }),
    });
  } catch (connErr) {
    // Ollama not running / unreachable.
    const msg = `Não foi possível conectar ao Ollama em ${OLLAMA_URL}. ` +
      `Inicie o Ollama (ollama serve) e verifique se o modelo "${OLLAMA_MODEL}" está disponível (ollama pull ${OLLAMA_MODEL}).`;
    console.error("Ollama connection error:", connErr);
    if (!res.headersSent) {
      return res.status(502).json({ error: msg });
    }
    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: `\n\n**[Erro]** ${msg}` } }] })}\n\n`);
    res.write("data: [DONE]\n\n");
    return res.end();
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    console.error(`Ollama error ${upstream.status}:`, detail);
    const msg = `Ollama respondeu ${upstream.status}: ${detail.slice(0, 300)}`;
    if (!res.headersSent) {
      return res.status(502).json({ error: msg });
    }
    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: `\n\n**[Erro]** ${msg}` } }] })}\n\n`);
    res.write("data: [DONE]\n\n");
    return res.end();
  }

  const reader = upstream.body.getReader();
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
        if (!line) continue;
        try {
          const json = JSON.parse(line);
          const content: string | undefined = json?.message?.content;
          if (content) {
            const sse = `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;
            res.write(sse);
          }
          if (json.done && !doneSent) {
            doneSent = true;
            res.write("data: [DONE]\n\n");
          }
        } catch {
          /* ignore malformed partial */
        }
      }
    }
  } catch (err) {
    console.error("stream error:", err);
  } finally {
    if (!doneSent && !res.writableEnded) {
      res.write("data: [DONE]\n\n");
    }
    if (!res.writableEnded) res.end();
  }
}

export { OLLAMA_URL, OLLAMA_MODEL };
