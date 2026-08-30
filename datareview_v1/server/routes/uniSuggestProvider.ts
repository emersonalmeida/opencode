import type { RequestHandler } from "express";
import { startRun, finishRun, progressRun, saveRawArtifact, type CollectionRun } from "../lib/rawStore.js";
import { withObservation } from "../lib/auditObservation.js";
import { getCached, setCached } from "../lib/routeCache.js";
import {
  getSuggestProvider,
  listSuggestProviderIds,
  type SuggestProviderItem,
} from "../lib/suggestProviders.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Conector multi-provedor de autocomplete.
 *
 * Rota: POST /functions/v1/uni-suggest-provider
 *   body: { provider: "bing" | "duckduckgo" | ..., query, limit?, lang? }
 *
 * A lib pura suggestProviders.ts descreve cada provedor (URL e parser).
 * Este rota executa o fetch com teto honesto de limite, grava a origem na
 * camada RAW (best-effort) e cacheia 10 min por provedor+query.

 * Provedores sao publicos e sem auth; o servidor usa UA de browser e
 * timeout curto (8s). Falha de rede/parse vira items vazio honesto
 * (o conector nunca quebra a UI).
 */
export const uniSuggestProvider: RequestHandler = async (req, res) => {
  res.set(corsHeaders);
  let run: CollectionRun | null = null;
  try {
    const { provider, query, limit, lang } = req.body ?? {};
    if (!provider || typeof provider !== "string") {
      return res.status(400).json({ error: "provider required" });
    }
    if (!query || typeof query !== "string" || !query.trim()) {
      return res.status(400).json({ error: "query required" });
    }
    const prov = getSuggestProvider(provider);
    if (!prov) {
      return res.status(400).json({ error: `unknown provider: ${provider}`, available: listSuggestProviderIds() });
    }
    const max = Math.max(1, Math.min(Number(limit) || 10, 50));
    const q = query.trim();
    const langCode = typeof lang === "string" && lang.trim() ? lang.trim() : undefined;

    const params = { provider: prov.id, query: q, lang: langCode ?? "", limit: max };
    const cached = getCached("uni-suggest-provider", params) as { items?: SuggestProviderItem[] } | undefined;
    if (cached) {
      res.json({ ...cached, cached: true });
      return;
    }

    const url = prov.buildUrl(q, { lang: langCode ?? "" });
    run = startRun({
      sourceId: "suggest-provider",
      subjectKey: "suggest-provider:" + prov.id + ":" + q.slice(0, 60),
      collector: "uni-suggest-provider",
      collectorVersion: "1",
      params: { provider: prov.id, query: q, lang: langCode, limit: max, url },
    });

    const items = await withObservation(
      run.id,
      "suggest-provider",
      "suggest-provider:" + prov.id,
      url,
      params,
      async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        try {
          const resp = await fetch(url, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36",
              Accept: "application/json, text/plain, */*",
            },
            signal: controller.signal,
          });
          if (!resp.ok) {
            progressRun(run!, "provedor " + prov.id + " respondeu HTTP " + resp.status + " — vazio honesto");
            return [];
          }
          const text = await resp.text();
          const parsed = prov.parse(text, max);
          progressRun(run!, "provedor " + prov.id + " devolveu " + parsed.length + " sugestoes");
          return parsed;
        } finally {
          clearTimeout(timer);
        }
      },
    );

    saveRawArtifact({
      runId: run.id,
      sourceId: "suggest-provider",
      subjectKey: run.subjectKey,
      endpoint: "suggest-provider:" + prov.id,
      url,
      params,
      payload: items,
      collector: "uni-suggest-provider",
      collectorVersion: "1",
    });

    const status = items.length ? "completed" : "partial";
    finishRun(run, { status, yielded: items.length });
    if (items.length) {
      setCached(
        "uni-suggest-provider",
        params,
        { provider: prov.id, query: q, items, count: items.length },
        10 * 60 * 1000,
      );
    }
    res.json({ provider: prov.id, query: q, items, count: items.length });
  } catch (err) {
    console.error("uni-suggest-provider connector error:", err);
    if (run) {
      finishRun(run, { status: "failed", errors: [{ endpoint: "uni-suggest-provider", message: String((err as Error)?.message || err) }] });
    }
    return res.status(500).json({ error: String((err as Error)?.message || err) });
  }
};