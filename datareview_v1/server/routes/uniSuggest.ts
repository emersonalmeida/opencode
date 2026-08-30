import type { RequestHandler } from "express";
// Camada RAW/provenance (aditivo): helper failure-safe, nunca muda a resposta.
import { startRun, finishRun, progressRun, saveRawArtifact, type CollectionRun } from "../lib/rawStore.js";
import { withObservation } from "../lib/auditObservation.js";
import { getCached, setCached } from "../lib/routeCache.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Conector Google Suggest (autocomplete) — referência: docs/_uni.py
 * (get_suggestions + expansão alfabética).
 *
 * Endpoint público sem auth:
 *   https://suggestqueries.google.com/complete/search?client=chrome&q=...&gl=..&hl=..&ds=..
 * Resposta: [query, [sugestões], [], [], {"google:suggestrelevance": [...]}]
 *
 * Verticais via `ds`: "" (web) | "yt" (YouTube) | "n" (News) | "sh" (Shopping).
 *
 * Ações:
 *  - suggest: { query, region?, lang?, vertical?, limit? } → 1 consulta.
 *  - expand:  idem + expansão alfabética (a-z, 0-9) com dedup por melhor
 *    relevância — mineração de demanda/keywords (ASO, SEO, pesquisa).
 *  - gather:  { query, seeds: string[], ... } → coleta multi-sonda com sondas
 *    arbitrárias (construídas pelo cliente a partir dos grupos de expansão
 *    do briefing Suggest), dedup por melhor relevância com proveniência.
 */
export type SuggestVertical = "web" | "youtube" | "news" | "shopping";

export interface SuggestItem {
  text: string;
  relevance: number;
  /** consulta expandida que originou o item (expand/gather). */
  seed?: string;
}

const VERTICAL_DS: Record<SuggestVertical, string> = {
  web: "",
  youtube: "yt",
  news: "n",
  shopping: "sh",
};

const SUGGEST_URL = "https://suggestqueries.google.com/complete/search";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36";
const EXPAND_SEEDS = "abcdefghijklmnopqrstuvwxyz0123456789".split("");

function normalizeVertical(v: unknown): SuggestVertical {
  return v === "youtube" || v === "news" || v === "shopping" ? v : "web";
}

/** Contexto do cliente (chrome/firefox) — dimensão experimental do briefing. */
export type SuggestClient = "chrome" | "firefox";

async function fetchSuggest(
  query: string,
  region: string,
  lang: string,
  vertical: SuggestVertical,
  limit: number,
  client: SuggestClient = "chrome",
  cursorPos?: number,
): Promise<SuggestItem[]> {
  const params = new URLSearchParams({ client, q: query, gl: region });
  if (lang) params.set("hl", lang);
  const ds = VERTICAL_DS[vertical];
  if (ds) params.set("ds", ds);
  // cp (cursor position) é opcional e sinaliza onde o cursor está quando a
  // consulta está sendo editada (briefing: evita reduções de variabilidade).
  if (typeof cursorPos === "number" && cursorPos >= 0) params.set("cp", String(cursorPos));

  const url = `${SUGGEST_URL}?${params.toString()}`;
  const resp = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!resp.ok) return [];
  const data = (await resp.json()) as unknown[];
  const suggestions = Array.isArray(data?.[1]) ? (data[1] as string[]) : [];
  const meta = data?.[4] as { "google:suggestrelevance"?: number[] } | undefined;
  const relevance = Array.isArray(meta?.["google:suggestrelevance"])
    ? meta!["google:suggestrelevance"]!
    : suggestions.map(() => 0);
  return suggestions
    .slice(0, limit)
    .map((text, i) => ({ text, relevance: Number(relevance[i]) || 0 }));
}

export const uniSuggest: RequestHandler = async (req, res) => {
  res.set(corsHeaders);
  let run: CollectionRun | null = null;
  try {
    const { action, query, region = "br", lang = "pt", limit, cp } = req.body ?? {};
    const vertical = normalizeVertical(req.body?.vertical);
    const client: SuggestClient = req.body?.client === "firefox" ? "firefox" : "chrome";
    const max = Math.max(1, Math.min(Number(limit) || 10, 50));
    const cursorPos = typeof cp === "number" ? Math.max(0, Math.min(cp, query?.length ?? 0)) : undefined;
    const regionCode = /^[a-z]{2}$/i.test(String(region)) ? String(region).toLowerCase() : "br";
    const langCode = /^[a-z]{2}(-[a-z]{2})?$/i.test(String(lang)) ? String(lang).toLowerCase() : "";

    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "query required" });
    }

    // Cache de respostas (padrão _uni.py) — suggest/expand/gather com os
    // mesmos parâmetros dentro do TTL retorna sem re-bater no Google.
    const cacheParams = { action, query, region: regionCode, lang: langCode, vertical, limit: max, client, cp: cursorPos };
    const cached = getCached("uni-suggest", cacheParams) as Record<string, unknown> | undefined;
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    if (action === "suggest") {
      run = startRun({
        sourceId: "suggest",
        subjectKey: `suggest:${vertical}:${regionCode}:${query}`,
        collector: "uni-suggest",
        collectorVersion: "1",
        params: { action, query, region: regionCode, lang: langCode, vertical, limit: max },
      });
      const items = await withObservation(
        run.id, "suggest", "suggest-query", undefined,
        { action, query, region: regionCode, lang: langCode, vertical, limit: max, client },
        () => fetchSuggest(query, regionCode, langCode, vertical, max, client, cursorPos),
      );
      saveRawArtifact({
        runId: run.id,
        sourceId: "suggest",
        subjectKey: run.subjectKey,
        endpoint: "google-suggest",
        url: SUGGEST_URL,
        params: { action, query, region: regionCode, lang: langCode, vertical, limit: max },
        payload: items,
        collector: "uni-suggest",
        collectorVersion: "1",
      });
      finishRun(run, { status: items.length ? "completed" : "partial", yielded: items.length });
      if (items.length) setCached("uni-suggest", cacheParams, { action, vertical, query, items, count: items.length }, 15 * 60 * 1000);
      return res.json({ action, vertical, query, items, count: items.length });
    }

    if (action === "expand") {
      run = startRun({
        sourceId: "suggest",
        subjectKey: `suggest:${vertical}:${regionCode}:${query}:expand`,
        collector: "uni-suggest",
        collectorVersion: "1",
        params: { action, query, region: regionCode, lang: langCode, vertical, limit: max },
      });
      // Consulta base + expansão alfabética em lotes concorrentes (4 por vez —
      // endpoint é público e leve, mas respeitamos um teto modesto).
      const seeds = [query, ...EXPAND_SEEDS.map((ch) => `${query} ${ch}`)];
      const best = new Map<string, SuggestItem>();
      const batchSize = 4;
      for (let i = 0; i < seeds.length; i += batchSize) {
        const batch = seeds.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map((seed) => fetchSuggest(seed, regionCode, langCode, vertical, max)),
        );
        // Progresso intermediário para a aba Output (terminal em tempo real).
        progressRun(
          run,
          `expansão ${Math.min(i + batchSize, seeds.length)}/${seeds.length} · +${results.reduce((n, r) => n + r.length, 0)} sugestões`,
        );
        results.forEach((items, j) => {
          for (const item of items) {
            const prev = best.get(item.text);
            if (!prev || item.relevance > prev.relevance) {
              best.set(item.text, { ...item, seed: batch[j] });
            }
          }
        });
      }
      const items = [...best.values()]
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, 200);
      saveRawArtifact({
        runId: run.id,
        sourceId: "suggest",
        subjectKey: run.subjectKey,
        endpoint: "google-suggest-expand",
        url: SUGGEST_URL,
        params: { action, query, region: regionCode, lang: langCode, vertical, seeds: seeds.length },
        payload: items,
        collector: "uni-suggest",
        collectorVersion: "1",
      });
      finishRun(run, { status: items.length ? "completed" : "partial", yielded: items.length });
      if (items.length) setCached("uni-suggest", cacheParams, { action, vertical, query, seeds: seeds.length, items, count: items.length }, 15 * 60 * 1000);
      return res.json({ action, vertical, query, seeds: seeds.length, items, count: items.length });
    }

    if (action === "gather") {
      // Coleta multi-sonda: o cliente constrói as sondas (grupos de
      // expansão do briefing Suggest) e envia strings arbitrárias; o
      // servidor executa com teto honesto e devolve proveniência por sonda.
      const rawSeeds: unknown[] = Array.isArray(req.body?.seeds) ? req.body.seeds : [];
      const seeds: string[] = [
        ...new Set<string>(
          rawSeeds
            .filter((s): s is string => typeof s === "string" && !!s.trim())
            .map((s) => s.trim()),
        ),
      ].slice(0, 500);
      if (!seeds.length) {
        return res.status(400).json({ error: "seeds required (non-empty string array)" });
      }
      run = startRun({
        sourceId: "suggest",
        subjectKey: `suggest:${vertical}:${regionCode}:${query}:gather`,
        collector: "uni-suggest-gather",
        collectorVersion: "1",
        params: { action, query, region: regionCode, lang: langCode, vertical, client, limit: max, seeds: seeds.length },
      });
      const best = new Map<string, SuggestItem>();
      const batchSize = 6;
      for (let i = 0; i < seeds.length; i += batchSize) {
        const batch = seeds.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map((seed) => fetchSuggest(seed, regionCode, langCode, vertical, max, client)),
        );
        progressRun(
          run,
          `sonda ${Math.min(i + batchSize, seeds.length)}/${seeds.length} · +${results.reduce((n, r) => n + r.length, 0)} sugestões`,
        );
        results.forEach((items, j) => {
          for (const item of items) {
            const prev = best.get(item.text);
            if (!prev || item.relevance > prev.relevance) {
              best.set(item.text, { ...item, seed: batch[j] });
            }
          }
        });
      }
      const items = [...best.values()]
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, 1000);
      saveRawArtifact({
        runId: run.id,
        sourceId: "suggest",
        subjectKey: run.subjectKey,
        endpoint: "google-suggest-gather",
        url: SUGGEST_URL,
        params: { action, query, region: regionCode, lang: langCode, vertical, client, seeds: seeds.length },
        payload: items,
        collector: "uni-suggest-gather",
        collectorVersion: "1",
      });
      finishRun(run, { status: items.length ? "completed" : "partial", yielded: items.length });
      if (items.length) setCached("uni-suggest", cacheParams, { action, vertical, query, client, seeds: seeds.length, items, count: items.length }, 15 * 60 * 1000);
      return res.json({ action, vertical, query, client, seeds: seeds.length, items, count: items.length });
    }

    return res.status(400).json({ error: `unknown action: ${action} (use suggest|expand|gather)` });
  } catch (err) {
    console.error("uni-suggest connector error:", err);
    if (run) {
      finishRun(run, { status: "failed", errors: [{ endpoint: "uni-suggest", message: String((err as Error)?.message || err) }] });
    }
    return res.status(500).json({ error: String((err as Error)?.message || err) });
  }
};
