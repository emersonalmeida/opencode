/**
 * Cliente do Source Registry — busca o catálogo de fontes (capabilities,
 * método, regiões, limitações declaradas) do servidor local.
 * Segue o padrão de fetchSystemProfile: cache de 20s + dedupe de inflight.
 */
import { useEffect, useState } from "react";
import type { SourceMeta } from "../../server/lib/sourceRegistry";

// Tipo re-exportado para consumidores do cliente (evita import relativo
// de 3 níveis em componentes de diferentes profundidades).
export type { SourceMeta };

import { apiUrl } from "@/lib/apiBase";

// apiUrl: mesma origem do app (proxy do Vite / Express) — ver apiBase.ts.
const CLIENT_CACHE_MS = 20_000;

let cache: { sources: SourceMeta[] | null; error: string | null; at: number } | null = null;
let inflight: Promise<SourceMeta[] | null> | null = null;

/** Reseta cache/inflight — exclusivo para testes (module-scope é singleton). */
export function __resetSourcesCacheForTests() {
  cache = null;
  inflight = null;
}

export async function fetchSources(force = false): Promise<SourceMeta[] | null> {
  if (!force && cache && Date.now() - cache.at < CLIENT_CACHE_MS) return cache.sources;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      // AbortSignal.timeout nem sempre existe (jsdom/testes): detecção de feature.
      const withTimeout = (AbortSignal as { timeout?: (ms: number) => AbortSignal }).timeout;
      const r = await fetch(apiUrl("/functions/v1/sources"), withTimeout ? { signal: withTimeout(5000) } : undefined);
      const ct = r.headers.get("content-type") ?? "";
      if (!ct.includes("json")) {
        throw new Error(`servidor local inacessível (resposta não-JSON: ${ct || r.status || "?"})`);
      }
      if (!r.ok) throw new Error(`servidor respondeu ${r.status}`);
      const data = (await r.json()) as { sources: SourceMeta[] };
      cache = { sources: data.sources, error: null, at: Date.now() };
      return data.sources;
    } catch (e) {
      cache = { sources: null, error: e instanceof Error ? e.message : "falha ao consultar", at: Date.now() };
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function useSources(force = false) {
  const [sources, setSources] = useState<SourceMeta[] | null>(cache?.sources ?? null);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState<string | null>(cache?.error ?? null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    void fetchSources(force).then((s) => {
      if (!live) return;
      setSources(s);
      setError(s ? null : cache?.error ?? null);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [force]);

  return { sources, loading, error };
}
