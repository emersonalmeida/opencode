import type { RequestHandler } from "express";
// Camada RAW/provenance (aditivo): helper failure-safe, nunca muda a resposta.
import { startRun, finishRun, progressRun, saveRawArtifact, type CollectionRun } from "../lib/rawStore.js";
import { withObservation } from "../lib/auditObservation.js";
// Cache de respostas (padrão _uni.py) — o trending muda rápido, TTL curto.
import { getCached, setCached } from "../lib/routeCache.js";
import {
  enrichWithRss,
  mergeTrending,
  parseBatchexecuteTrends,
  parseTrendingRss,
  trendKey,
  TRENDING_HOURS,
  type RssEnrichment,
  type TrendingItem,
  type TrendingObservation,
} from "../lib/trendingCore.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Conector Google Trends "Em alta" (trending now) — extrai os dados da
 * página https://trends.google.com/trending?geo=BR pelas mesmas fontes que
 * ela usa (ver trendingCore.ts para a investigação completa):
 *   1. RPC interno batchexecute (primário): lista completa de trends da
 *      janela (4h≈25 · 24h≈230 · 48h≈630 · 168h≈1800) com volume,
 *      crescimento %, início/fim, consultas relacionadas e tópicos.
 *   2. RSS público (enrichment): notícias + imagens do top-10.
 *
 * Ações:
 *  - trending: { geo, hours? } → 1 janela (rápida, 2 requests).
 *  - gather:   { geo, hoursList? } → união das janelas com dedup e
 *    proveniência por janela (trend aparece em 4h? 24h? 7d?).
 */

const RPC_URL = "https://trends.google.com/_/TrendsUi/data/batchexecute";
const RSS_URL = "https://trends.google.com/trending/rss";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36";
const HEADERS = {
  "User-Agent": UA,
  // Evita o redirect de consentimento GDPR do Google em IPs europeus.
  Cookie: "CONSENT=YES+cb",
};

const VALID_HOURS = new Set(TRENDING_HOURS.map((h) => h.id));

function normGeo(v: unknown): string {
  const s = String(v ?? "").toLowerCase();
  return /^[a-z]{2}$/.test(s) ? s : "br";
}

function normHours(v: unknown, fallback = 24): number {
  const n = Number(v);
  return VALID_HOURS.has(n) ? n : fallback;
}

function normHoursList(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [24];
  const list = [...new Set(raw.map(Number).filter((n) => VALID_HOURS.has(n)))];
  return (list.length ? list : [24]).slice(0, TRENDING_HOURS.length);
}

/** RPC batchexecute — lista completa de trends da janela. */
async function fetchRpc(geo: string, hours: number): Promise<TrendingItem[]> {
  const payload = JSON.stringify([null, null, geo.toUpperCase(), 0, null, hours]);
  const freq = JSON.stringify([[["i0OFE", payload, null, "generic"]]]);
  const params = new URLSearchParams({ rpcids: "i0OFE", hl: "pt-BR", geo: geo.toUpperCase() });
  const resp = await fetch(`${RPC_URL}?${params.toString()}`, {
    method: "POST",
    headers: { ...HEADERS, "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: `f.req=${encodeURIComponent(freq)}`,
    signal: AbortSignal.timeout(20000),
  });
  if (!resp.ok) throw new Error(`trending rpc http ${resp.status}`);
  return parseBatchexecuteTrends(await resp.text(), { hours });
}

/** RSS top-10 — enrichment de notícias/imagens (falha é tolerada). */
async function fetchRssEnrichment(geo: string): Promise<Map<string, RssEnrichment>> {
  try {
    const resp = await fetch(`${RSS_URL}?geo=${geo.toUpperCase()}`, {
      headers: { ...HEADERS, Accept: "application/rss+xml, text/xml;q=0.9, */*;q=0.8" },
      signal: AbortSignal.timeout(12000),
    });
    if (!resp.ok) return new Map();
    return parseTrendingRss(await resp.text());
  } catch {
    return new Map();
  }
}

export const uniTrending: RequestHandler = async (req, res) => {
  res.set(corsHeaders);
  let run: CollectionRun | null = null;
  try {
    const { action } = req.body ?? {};
    const geo = normGeo(req.body?.geo);

    if (action === "trending") {
      const hours = normHours(req.body?.hours);
      const cacheParams = { action, geo, hours };
      const cached = getCached("uni-trending", cacheParams) as Record<string, unknown> | undefined;
      if (cached) return res.json({ ...cached, cached: true });

      run = startRun({
        sourceId: "trends",
        subjectKey: `trending:${geo}:${hours}h`,
        collector: "uni-trending",
        collectorVersion: "2",
        params: { action, geo, hours },
      });
      const items = await withObservation(
        (run as CollectionRun).id, "trends", "google-trending-batchexecute", RPC_URL,
        { geo, hours },
        () => fetchRpc(geo, hours),
      );
      const rss = await fetchRssEnrichment(geo);
      enrichWithRss(items, rss);
      saveRawArtifact({
        runId: run.id,
        sourceId: "trends",
        subjectKey: run.subjectKey,
        endpoint: "google-trending-batchexecute",
        url: RPC_URL,
        params: { geo, hours },
        payload: items,
        collector: "uni-trending",
        collectorVersion: "2",
      });
      finishRun(run, { status: items.length ? "completed" : "partial", yielded: items.length });
      const body = { action, geo, hours, items, count: items.length, newsEnriched: rss.size };
      if (items.length) setCached("uni-trending", cacheParams, body, 10 * 60 * 1000);
      return res.json(body);
    }

    if (action === "gather") {
      const hoursList = normHoursList(req.body?.hoursList);
      const cacheParams = { action, geo, hoursList };
      const cached = getCached("uni-trending", cacheParams) as Record<string, unknown> | undefined;
      if (cached) return res.json({ ...cached, cached: true });

      run = startRun({
        sourceId: "trends",
        subjectKey: `trending:${geo}:gather:${hoursList.join("-")}`,
        collector: "uni-trending-gather",
        collectorVersion: "2",
        params: { action, geo, hoursList },
      });

      const observations: TrendingObservation[] = [];
      const allLists: TrendingItem[][] = [];
      const errors: string[] = [];
      const seenKeys = new Set<string>();
      // Janelas em paralelo (máx. 4) + RSS uma única vez no final.
      const results = await Promise.all(
        hoursList.map(async (hours) => {
          try {
            const items = await withObservation(
              (run as CollectionRun).id, "trends", "google-trending-batchexecute", RPC_URL,
              { geo, hours },
              () => fetchRpc(geo, hours),
            );
            return { hours, items, error: "" };
          } catch (e) {
            return { hours, items: [] as TrendingItem[], error: e instanceof Error ? e.message : "falha" };
          }
        }),
      );
      for (const r of results) {
        const added = r.items.filter((it) => !seenKeys.has(trendKey(it.title))).length;
        for (const it of r.items) seenKeys.add(trendKey(it.title));
        if (r.items.length) allLists.push(r.items);
        observations.push({ hours: r.hours, count: r.items.length, added, error: r.error || undefined });
        if (r.error) errors.push(`${r.hours}h: ${r.error}`);
        progressRun(run, `janela ${r.hours}h · ${seenKeys.size} trends únicos`);
      }

      const items = mergeTrending(allLists);
      const rss = await fetchRssEnrichment(geo);
      enrichWithRss(items, rss);
      saveRawArtifact({
        runId: run.id,
        sourceId: "trends",
        subjectKey: run.subjectKey,
        endpoint: "google-trending-batchexecute-gather",
        url: RPC_URL,
        params: { geo, hoursList },
        payload: items,
        collector: "uni-trending-gather",
        collectorVersion: "2",
      });
      finishRun(run, {
        status: items.length ? "completed" : errors.length === hoursList.length ? "failed" : "partial",
        yielded: items.length,
      });
      const body = {
        action,
        geo,
        hoursList,
        items,
        observations,
        count: items.length,
        newsEnriched: rss.size,
        errors: errors.length ? errors : undefined,
      };
      if (items.length) setCached("uni-trending", cacheParams, body, 10 * 60 * 1000);
      return res.json(body);
    }

    return res.status(400).json({ error: "unknown action (use trending|gather)" });
  } catch (err) {
    if (run) finishRun(run, { status: "failed", errors: [{ endpoint: "uni-trending", message: String((err as Error)?.message || err) }] });
    const message = err instanceof Error ? err.message : "Falha ao consultar o Google Trends";
    return res.status(502).json({ error: message });
  }
};
