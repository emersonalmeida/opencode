import type { RequestHandler } from "express";
// Camada RAW/provenance (aditivo): helper failure-safe, nunca muda a resposta.
import { startRun, finishRun, saveRawArtifact, type CollectionRun } from "../lib/rawStore.js";
import { withObservation } from "../lib/auditObservation.js";
// Cache de respostas (docs/_uni.py: load_cache/save_cache) — Trends rate-limita
// por IP; o mesmo (terms, geo, lang, timeframe, gprop) dentro do TTL não re-bate.
import { getCached, setCached } from "../lib/routeCache.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Conector Google Trends — referência: docs/_uni.py (run_trends com pytrends).
 *
 * Reimplementa o fluxo do pytrends em Node puro (endpoints não-oficiais,
 * públicos, sem auth):
 *   1. POST /trends/api/explore        → widgets (TIMESERIES/GEO_MAP/RELATED_QUERIES)
 *   2. GET  /trends/api/widgetdata/multiline       → interesse ao longo do tempo
 *      GET  /trends/api/widgetdata/comparedgeo     → interesse por região
 *      GET  /trends/api/widgetdata/relatedsearches → queries top + rising
 * Respostas vêm com prefixo de segurança ")]}'" (5 chars) antes do JSON.
 *
 * Ação única "explore": { terms: string[], region?, lang?, timeframe?, gprop? }
 * Retorna as 3 visões quando disponíveis (falha de uma não derruba as outras).
 */

const BASE = "https://trends.google.com/trends/api";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36";
const HEADERS = {
  "User-Agent": UA,
  Accept: "application/json",
  // Evita o redirect de consentimento GDPR do Google em IPs europeus.
  Cookie: "CONSENT=YES+cb",
};

export interface TrendPoint {
  date: string;
  /** valores 0-100 por termo (índice paralelo a `terms`). */
  values: number[];
}
export interface TrendRegion {
  region: string;
  values: number[];
}
export interface TrendQuery {
  text: string;
  value: number;
  /** rising = crescimento recente ("Breakout" vira null no raw). */
  kind: "top" | "rising";
}

interface TrendsWidget {
  id: string;
  title?: string;
  token: string;
  request: unknown;
}

/** Trends responde com ")]}'\n" antes do JSON — remove o prefixo. */
async function parseTrendsJson(resp: Response): Promise<unknown> {
  const text = await resp.text();
  return JSON.parse(text.replace(/^\)\]\}',?\n/, ""));
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  // Trends rate-limita por IP (429/500 em janelas curtas) — 1 retry com
  // backoff segue o comportamento do pytrends sem martelar o endpoint.
  let lastStatus = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 2000));
    const resp = await fetch(url, { ...init, headers: { ...HEADERS, ...(init?.headers ?? {}) }, signal: AbortSignal.timeout(20000) });
    lastStatus = resp.status;
    if (resp.ok) return parseTrendsJson(resp);
    if (resp.status !== 429 && resp.status < 500) break;
  }
  throw new Error(`trends http ${lastStatus}`);
}

async function fetchWidgets(
  terms: string[],
  hl: string,
  geo: string,
  timeframe: string,
  gprop: string,
): Promise<TrendsWidget[]> {
  const comparisonItem = terms.map((keyword) => ({ keyword, geo, time: timeframe }));
  const reqPayload = { comparisonItem, category: 0, property: gprop };
  const body = new URLSearchParams({ hl, tz: "0", req: JSON.stringify(reqPayload) });
  const data = (await fetchJson(`${BASE}/explore`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: body.toString(),
  })) as { widgets?: TrendsWidget[] };
  return data?.widgets ?? [];
}

async function widgetData(widget: TrendsWidget, path: string, hl: string): Promise<unknown> {
  const params = new URLSearchParams({
    hl,
    tz: "0",
    req: JSON.stringify(widget.request),
    token: widget.token,
  });
  return fetchJson(`${BASE}/widgetdata/${path}?${params.toString()}`);
}

function parseTimeline(raw: unknown): { points: TrendPoint[]; isPartial: boolean } {
  const timeline = (raw as { default?: { timelineData?: { time?: string; formattedTime?: string; value?: number[]; valueHint?: string[] }[] } })
    ?.default?.timelineData ?? [];
  const points = timeline.map((p) => ({
    date: p.formattedTime ?? new Date(Number(p.time) * 1000).toISOString().slice(0, 10),
    values: (p.value ?? []).map((v) => Number(v) || 0),
  }));
  // O Google marca o ponto final como parcial (dados de hoje incompletos) — o
  // briefing A13: informa ao frontend para que não tome por barras completas.
  const isPartial = timeline.some((p, i) => i === timeline.length - 1 && (p.valueHint ?? []).length === 0);
  return { points, isPartial };
}

function parseRegions(raw: unknown, limit: number): TrendRegion[] {
  const geo = (raw as { default?: { geoMapData?: { geoName?: string; value?: number[] }[] } })
    ?.default?.geoMapData ?? [];
  return geo
    .map((g) => ({ region: g.geoName ?? "?", values: (g.value ?? []).map((v) => Number(v) || 0) }))
    .sort((a, b) => Math.max(...b.values) - Math.max(...a.values))
    .slice(0, limit);
}

function parseRelated(raw: unknown, limit: number): TrendQuery[] {
  const ranked = (raw as { default?: { rankedList?: { rankedKeyword?: { query?: string; value?: number }[] }[] } })
    ?.default?.rankedList ?? [];
  const out: TrendQuery[] = [];
  const kinds: ("top" | "rising")[] = ["top", "rising"];
  ranked.forEach((list, i) => {
    const kind = kinds[i] ?? "top";
    for (const k of (list.rankedKeyword ?? []).slice(0, limit)) {
      out.push({ text: k.query ?? "", value: Number(k.value) || 0, kind });
    }
  });
  return out.filter((q) => q.text);
}

export const uniTrends: RequestHandler = async (req, res) => {
  res.set(corsHeaders);
  let run: CollectionRun | null = null;
  try {
    const { action, region = "BR", lang = "pt-BR", timeframe = "today 3-m", gprop = "", topn } = req.body ?? {};
    const terms: string[] = Array.isArray(req.body?.terms)
      ? req.body.terms.filter((t: unknown) => typeof t === "string" && t.trim()).slice(0, 5)
      : [];
    const max = Math.max(1, Math.min(Number(topn) || 10, 25));
    const geo = /^[A-Za-z]{2}$/.test(String(region)) ? String(region).toUpperCase() : "BR";
    const prop = ["", "images", "news", "youtube", "froogle"].includes(String(gprop)) ? String(gprop) : "";

    if (action !== "explore") {
      return res.status(400).json({ error: `unknown action: ${action} (use explore)` });
    }
    if (!terms.length) {
      return res.status(400).json({ error: "terms required (1-5 strings)" });
    }

    // Cache hit: mesma consulta dentro do TTL → resposta imediata, sem run nova
    // (nada foi coletado de novo) e sem bater no Google (evita o 429).
    const cacheParams = { terms, region: geo, lang, timeframe: String(timeframe), gprop: prop, topn: max };
    const cached = getCached("uni-trends", cacheParams) as Record<string, unknown> | undefined;
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    run = startRun({
      sourceId: "trends",
      subjectKey: `trends:${geo}:${terms.join("|")}`,
      collector: "uni-trends",
      collectorVersion: "1",
      params: { action, terms, region: geo, lang, timeframe, gprop: prop, topn: max },
    });

    const widgets = await withObservation(
      run.id, "trends", "trends-widgets", undefined,
      { action, terms, region: geo, lang, timeframe, gprop: prop, topn: max },
      () => fetchWidgets(terms, String(lang), geo, String(timeframe), prop),
    );

    // Cada visão é independente — falha parcial não derruba a resposta.
    const result: {
      timeline?: TrendPoint[];
      regions?: TrendRegion[];
      related?: TrendQuery[];
      errors: string[];
      isPartial?: boolean;
    } = { errors: [] };

    const timeseries = widgets.find((w) => w.id === "TIMESERIES");
    if (timeseries) {
      try {
        const parsed = parseTimeline(await widgetData(timeseries, "multiline", String(lang)));
        result.timeline = parsed.points;
        result.isPartial = parsed.isPartial;
      } catch (e) {
        result.errors.push(`timeline: ${String((e as Error)?.message || e)}`);
      }
    }
    const geomap = widgets.find((w) => w.id === "GEO_MAP");
    if (geomap) {
      try {
        result.regions = parseRegions(await widgetData(geomap, "comparedgeo", String(lang)), max);
      } catch (e) {
        result.errors.push(`regions: ${String((e as Error)?.message || e)}`);
      }
    }
    const related = widgets.find((w) => w.id === "RELATED_QUERIES");
    if (related) {
      try {
        result.related = parseRelated(await widgetData(related, "relatedsearches", String(lang)), max);
      } catch (e) {
        result.errors.push(`related: ${String((e as Error)?.message || e)}`);
      }
    }

    const yielded =
      (result.timeline?.length ?? 0) + (result.regions?.length ?? 0) + (result.related?.length ?? 0);

    saveRawArtifact({
      runId: run.id,
      sourceId: "trends",
      subjectKey: run.subjectKey,
      endpoint: "google-trends-explore",
      url: `${BASE}/explore`,
      params: { terms, region: geo, lang, timeframe, gprop: prop },
      payload: { timeline: result.timeline, regions: result.regions, related: result.related, isPartial: result.isPartial },
      collector: "uni-trends",
      collectorVersion: "1",
    });
    finishRun(run, {
      status: yielded ? (result.errors.length ? "partial" : "completed") : "partial",
      yielded,
      errors: result.errors.map((m) => ({ endpoint: "uni-trends", message: m, at: Date.now() })),
    });
    // Só cacheia quando veio algo útil (erros/zeros não devem "travar" o cache).
    if (yielded) {
      setCached("uni-trends", cacheParams, { action, terms, region: geo, timeframe: String(timeframe), isPartial: result.isPartial, ...result }, 30 * 60 * 1000);
    }
    return res.json({ action, terms, region: geo, timeframe: String(timeframe), ...result });
  } catch (err) {
    console.error("uni-trends connector error:", err);
    if (run) {
      finishRun(run, { status: "failed", errors: [{ endpoint: "uni-trends", message: String((err as Error)?.message || err) }] });
    }
    return res.status(500).json({ error: String((err as Error)?.message || err) });
  }
};
