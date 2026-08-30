import type { DatasetEntry } from "@/lib/datasetStore";
import { apiUrl } from "@/lib/apiBase";
import { getAISettings, type AISettings } from "@/lib/aiSettings";
import { buildKnowledgeDigest } from "@/lib/aiKnowledge";
import { missionIAContext } from "@/lib/flow/flowModel";
import { composePromptOverride } from "@/lib/promptOverrides";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatHandlers {
  onToken: (full: string) => void;
  onDone: (full: string) => void;
  onError: (err: string) => void;
}

const SUPA_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export async function streamExperimentChat(
  apps: DatasetEntry[],
  messages: ChatMessage[],
  handlers: ChatHandlers,
  signal?: AbortSignal,
  ai: AISettings = getAISettings(),
  section: string = "custom",
  /** Contexto adicional (ex.: arquivos do usuário) anexado ao extraContext. */
  extraContext?: string,
  /** Substitui o system prompt (só section "os" no servidor — usado pela Uni). */
  systemPromptOverride?: string,
): Promise<void> {
  const payload = apps.map((e) => ({ app: e.app, reviews: e.reviews }));
  const baseCtx = [ai.feedbackEnabled ? buildKnowledgeDigest() : "", extraContext ?? ""].filter(Boolean).join("\n\n");
  let resp: Response;
  try {
    resp = await fetch(apiUrl("/functions/v1/experiment-analyze"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPA_KEY}` },
      body: JSON.stringify({ section, apps: payload, messages, ai, extraContext: missionIAContext(baseCtx || undefined), promptOverride: composePromptOverride(section === "custom" ? "chat" : `section:${section}`), ...(systemPromptOverride ? { systemPromptOverride } : {}) }),
      signal,
    });
  } catch (e) {
    handlers.onError(e instanceof Error ? e.message : "Falha de conexao");
    return;
  }
  if (!resp.ok) {
    const ct = resp.headers.get("content-type") ?? "";
    if (!ct.includes("json")) {
      handlers.onError(`servidor local inacessível (resposta não-JSON: ${ct || resp.status || "?"}) — suba com npm run dev:server`);
      return;
    }
    const errData = await resp.json().catch((): Record<string, unknown> => ({}));
    handlers.onError((errData.error as string) || `Erro ${resp.status}`);
    return;
  }
  const reader = resp.body?.getReader();
  if (!reader) {
    handlers.onError("Sem stream de resposta");
    return;
  }
  const decoder = new TextDecoder();
  let buffer = "";
  let result = "";
  while (true) {
    const { done, value: chunk } = await reader.read();
    if (done) break;
    buffer += decoder.decode(chunk, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") break;
      try {
        const parsed = JSON.parse(json);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) {
          result += content;
          handlers.onToken(result);
        }
      } catch { /* ignore */ }
    }
  }
  handlers.onDone(result);
}
