import type { DatasetEntry } from "@/lib/datasetStore";
import { apiUrl } from "@/lib/apiBase";
import { getAISettings, type AISettings } from "@/lib/aiSettings";
import { buildKnowledgeDigest } from "@/lib/aiKnowledge";
import { missionIAContext } from "@/lib/flow/flowModel";
import { composePromptOverride } from "@/lib/promptOverrides";
import { recordInsight } from "@/lib/insightStore";
import { saveAIOutput } from "@/lib/aiOutputStore";

const SUPA_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export interface StreamHandlers {
  onToken: (full: string) => void;
  onDone: (full: string) => void;
  onError: (err: string) => void;
}

export async function streamExperiment(
  section: string,
  dataset: Pick<DatasetEntry, "app" | "reviews">[],
  handlers: StreamHandlers,
  signal?: AbortSignal,
  ai: AISettings = getAISettings(),
): Promise<void> {
  const apps = dataset.map((e) => ({ app: e.app, reviews: e.reviews }));
  let resp: Response;
  try {
    resp = await fetch(apiUrl("/functions/v1/experiment-analyze"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPA_KEY}`,
      },
      body: JSON.stringify({ section, apps, ai, extraContext: missionIAContext(ai.feedbackEnabled ? buildKnowledgeDigest() : undefined), promptOverride: composePromptOverride(`section:${section}`) }),
      signal,
    });
  } catch (e) {
    handlers.onError(e instanceof Error ? e.message : "Falha de conexão");
    return;
  }

  if (!resp.ok) {
    const ct = resp.headers.get("content-type") ?? "";
    if (!ct.includes("json")) {
      handlers.onError(`servidor local inacessível (resposta não-JSON: ${ct || resp.status || "?"}) — suba com npm run dev:server`);
      return;
    }
    const errData = await resp.json().catch(() => ({}));
    handlers.onError((errData as { error?: string }).error || `Erro ${resp.status}`);
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
      } catch {
        /* ignore malformed chunk */
      }
    }
  }
  handlers.onDone(result);

  // Feedback loop: indexa o insight gerado para o dataset "Derivado" (consultável).
  if (result.trim()) {
    const provenance = `${ai.mode}${ai.mode === "local" ? ` ${ai.local?.model ?? ""}` : ""}`;
    const appKeys = dataset.map((x) => `${x.app.store}:${x.app.id}`);
    recordInsight(appKeys, section, result, provenance);
    // Persistência: o output fica salvo e as superfícies reidratam ao montar —
    // reload/restart não apaga mais o que a IA gerou.
    saveAIOutput(section, appKeys, result, provenance);
  }
}
