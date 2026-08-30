/**
 * Readiness da IA (ativação): responde "a IA configurada está PRONTA?" com
 * UMA chamada por configuração (cache 30s + dedup de chamadas em voo) —
 * usada pelo painel de configuração (veredito automático ao trocar de modo)
 * e pelo badge do header (ponto de status: verde pronta / âmbar indisponível).
 *
 * Nunca é chamada em modo "none" (IA desligada = pronta por definição).
 */
import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiBase";
import type { AISettings } from "@/lib/aiSettings";

export interface AIReadinessResult {
  ok: boolean;
  message: string;
  checkedAt: number;
}

/** Fingerprint da configuração relevante p/ readiness (mode/modelo/provider). */
export function aiFingerprint(ai: AISettings): string {
  if (ai.mode === "none") return "none";
  if (ai.mode === "cloud") {
    return `cloud:${ai.cloud.provider}:${ai.cloud.model}:${ai.cloud.apiKey ? "key" : "nokey"}`;
  }
  return `${ai.mode}:${ai.local.model}:${ai.local.useGpu}:${ai.local.ollamaUrl ?? ""}`;
}

/** Mapeamento do resultado para o ponto de status do badge. */
export function readinessDot(
  ai: AISettings,
  result: AIReadinessResult | null,
): "none" | "ok" | "warn" {
  if (ai.mode === "none") return "none";
  if (!result) return "warn"; // ainda não verificado nesta sessão
  return result.ok ? "ok" : "warn";
}

const TTL_MS = 30_000;
let lastResult: AIReadinessResult | null = null;
let lastFingerprint = "";
let inflight: Promise<AIReadinessResult> | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

/** Verifica se a IA configurada responde (1 chamada por fingerprint, TTL 30s). */
export function checkAIReadiness(ai: AISettings): Promise<AIReadinessResult> {
  const fp = aiFingerprint(ai);
  if (fp === "none") {
    return Promise.resolve({ ok: true, message: "IA desativada", checkedAt: Date.now() });
  }
  if (inflight && lastFingerprint === fp) return inflight;
  if (lastResult && lastFingerprint === fp && Date.now() - lastResult.checkedAt < TTL_MS) {
    return Promise.resolve(lastResult);
  }
  lastFingerprint = fp;
  inflight = (async (): Promise<AIReadinessResult> => {
    try {
      const r = await fetch(apiUrl("/functions/v1/ai-test"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ai }),
      });
      const ct = r.headers.get("content-type") ?? "";
      if (!ct.includes("json")) {
        return { ok: false, message: `servidor local inacessível (resposta não-JSON: ${ct || r.status || "?"})`, checkedAt: Date.now() };
      }
      const data = await r.json().catch(() => ({ ok: false, message: "Sem resposta do servidor" }));
      return { ok: !!data.ok, message: data.message ?? (data.ok ? "IA pronta" : "Falhou"), checkedAt: Date.now() };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Falha de conexão", checkedAt: Date.now() };
    }
  })();
  inflight.then((res) => {
    lastResult = res;
    inflight = null;
    notify();
  });
  return inflight;
}

/** Resultado atual em cache (null = nunca verificado nesta sessão). */
export function getAIReadiness(): AIReadinessResult | null {
  return lastResult;
}

/** Zera o cache (testes; o app nunca precisa — o TTL resolve). */
export function resetAIReadiness(): void {
  lastResult = null;
  lastFingerprint = "";
  inflight = null;
}

export function subscribeAIReadiness(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Hook: verifica (com cache) e re-renderiza quando o resultado chega. */
export function useAIReadiness(ai: AISettings): AIReadinessResult | null {
  const [result, setResult] = useState<AIReadinessResult | null>(getAIReadiness());
  useEffect(() => {
    const unsub = subscribeAIReadiness(() => setResult(getAIReadiness()));
    if (ai.mode !== "none") void checkAIReadiness(ai);
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fingerprint resume a config relevante
  }, [aiFingerprint(ai)]);
  return result;
}
