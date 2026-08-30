/**
 * Google Trends explore (ponte v1 → SourcePort).
 * Fluxo do pytrends em Node puro (endpoints públicos, sem auth):
 *   1. POST /trends/api/explore → widgets (TIMESERIES/GEO_MAP/RELATED_QUERIES)
 *   2. GET  widgetdata/multiline|comparedgeo|relatedsearches (prefixo ")]}'").
 *
 * query = termos separados por vírgula (1-5); country = geo (padrão BR);
 * engine = timeframe (padrão "today 3-m"). Falha de UMA visão não derruba as
 * demais. Cache em memória de 30min na mesma (query, geo, timeframe) para não
 * martelar o endpoint (Google rate-limita por IP).
 */
import type { CollectOptions, NormalizedItem } from "@v4/contracts";
import type { SourcePort } from "@v4/domain";
import { cap, defineAdapter, item, num, str } from "./base.js";

const BASE = "https://trends.google.com/trends/api";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36";
const HEADERS = {
  "User-Agent": UA,
  Accept: "application/json",
  Cookie: "CONSENT=YES+cbcb",
};

interface TrendsWidget {
  id: string;
  title?: string;
  token: string;
  request: unknown;
}

const cache = new Map<string, { at: number; payload: unknown }>();
const CACHE_TTL_MS = 30 * 60 * 1000;

function cacheKey(terms: string[], geo: string, timeframe: string): string {
  return JSON.stringify([terms, geo, timeframe]);
}

async function trendsJson(url: string, init?: RequestInit): Promise<unknown> {
  let lastStatus = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 2000));
    const resp = await fetch(url, {
      ...init,
      headers: { ...HEADERS, ...(init?.headers ?? {}) },
      signal: AbortSignal.timeout(20000),
    });
    lastStatus = resp.status;
    if (resp.ok) {
      const text = await resp.text();
      return JSON.parse(text.replace(/^\)\]\}',?\n/, "")) as unknown;
    }
    if (resp.status !== 429 && resp.status < 500) break;
  }
  throw new Error(`trends http ${lastStatus}`);
}

async function fetchWidgets(terms: string[], hl: string, geo: string, timeframe: string, gprop: string): Promise<TrendsWidget[]> {
  const comparisonItem = terms.map((keyword) => ({ keyword, geo, time: timeframe }));
  const body = new URLSearchParams({ hl, tz: "0", req: JSON.stringify({ comparisonItem, category: 0, property: gprop }) });
  const data = (await trendsJson(`${BASE}/explore`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: body.toString(),
  })) as { widgets?: TrendsWidget[] };
  return data?.widgets ?? [];
}

function widgetData(widget: TrendsWidget, path: string, hl: string): Promise<unknown> {
  const params = new URLSearchParams({ hl, tz: "0", req: JSON.stringify(widget.request), token: widget.token });
  return trendsJson(`${BASE}/widgetdata/${path}?${params.toString()}`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseTimeline(raw: any): { points: { date: string; values: number[] }[]; isPartial: boolean } {
  const timeline = (raw?.default?.timelineData ?? []) as { time?: string; formattedTime?: string; value?: number[]; valueHint?: string[] }[];
  const points = timeline.map((p) => ({
    date: p.formattedTime ?? new Date(Number(p.time) * 1000).toISOString().slice(0, 10),
    values: (p.value ?? []).map((v) => Number(v) || 0),
  }));
  const isPartial = timeline.some((p, i, arr) => i === arr.length - 1 && (p.valueHint ?? []).length === 0);
  return { points, isPartial };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseRegions(raw: any, limit: number): { region: string; values: number[] }[] {
  const geo = (raw?.default?.geoMapData ?? []) as { geoName?: string; value?: number[] }[];
  return geo
    .map((g) => ({ region: g.geoName ?? "?", values: (g.value ?? []).map((v) => Number(v) || 0) }))
    .sort((a, b) => Math.max(...b.values) - Math.max(...a.values))
    .slice(0, limit);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseRelated(raw: any, limit: number): { text: string; value: number; kind: "top" | "rising" }[] {
  const ranked = (raw?.default?.rankedList ?? []) as { rankedKeyword?: { query?: string; value?: number }[] }[];
  const kinds: ("top" | "rising")[] = ["top", "rising"];
  const out: { text: string; value: number; kind: "top" | "rising" }[] = [];
  ranked.forEach((list, i) => {
    const kind = kinds[i] ?? "top";
    for (const k of (list.rankedKeyword ?? []).slice(0, limit)) {
      out.push({ text: k.query ?? "", value: Number(k.value) || 0, kind });
    }
  });
  return out.filter((q) => q.text);
}

export const trends = defineAdapter(
  {
    id: "trends",
    label: "Google Trends (explore)",
    kind: "trend-point",
    description: "Explora tendências do Google (query=termos, vírgula; country=geo; engine=timeframe): related + geo + timeline.",
    capabilities: ["trends"],
    rateLimit: { rps: 1, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      const terms = options.query
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 5);
      if (terms.length === 0) throw new Error("query deve ter 1-5 termos (separados por vírgula)");
      const geo = /^[A-Z]{2}$/i.test(options.country ?? "") ? (options.country as string).toUpperCase() : "BR";
      const timeframe = options.engine || "today 3-m";
      const hl = "pt-BR";
      const limit = cap(options.limit ?? 10, 25);

      const key = cacheKey(terms, geo, timeframe);
      const hit = cache.get(key);
      const fresh = hit && Date.now() - hit.at < CACHE_TTL_MS ? hit.payload : undefined;
      if (fresh) return fresh;

      const widgets = await fetchWidgets(terms, hl, geo, timeframe, "");
      const result: {
        terms: string[];
        geo: string;
        timeframe: string;
        timeline?: { points: { date: string; values: number[] }[]; isPartial: boolean };
        regions?: { region: string; values: number[] }[];
        related?: { text: string; value: number; kind: "top" | "rising" }[];
        errors: string[];
      } = { terms, geo, timeframe, errors: [] };

      const timeseries = widgets.find((w) => w.id === "TIMESERIES");
      if (timeseries) {
        try {
          result.timeline = parseTimeline(await widgetData(timeseries, "multiline", hl));
        } catch (e) {
          result.errors.push(`timeline: ${(e as Error)?.message ?? String(e)}`);
        }
      }
      const geomap = widgets.find((w) => w.id === "GEO_MAP");
      if (geomap) {
        try {
          result.regions = parseRegions(await widgetData(geomap, "comparedgeo", hl), limit);
        } catch (e) {
          result.errors.push(`regions: ${(e as Error)?.message ?? String(e)}`);
        }
      }
      const related = widgets.find((w) => w.id === "RELATED_QUERIES");
      if (related) {
        try {
          result.related = parseRelated(await widgetData(related, "relatedsearches", hl), limit);
        } catch (e) {
          result.errors.push(`related: ${(e as Error)?.message ?? String(e)}`);
        }
      }

      const yielded = (result.timeline?.points.length ?? 0) + (result.regions?.length ?? 0) + (result.related?.length ?? 0);
      if (yielded === 0) throw new Error(`nenhuma visão de trends veio com dados: ${result.errors.join("; ") || "widgets vazios"}`);
      if (fresh === undefined) cache.set(key, { at: Date.now(), payload: result });
      return result;
    },
    map(data: unknown, options: CollectOptions): NormalizedItem[] {
      const r = (data ?? {}) as Record<string, unknown>;
      const terms = (Array.isArray(r.terms) ? r.terms.map((t) => str(t)) : [str(r.terms)]).filter(Boolean).join(", ") || "trends";
      const out: NormalizedItem[] = [];
      for (const q of (r.related as { text: string; value: number; kind: "top" | "rising" }[] | undefined) ?? []) {
        out.push(
          item(
            {
              id: `trends:related:${q.kind}:${q.text}`,
              title: q.text,
              score: Math.max(1, num(q.value) ?? 0),
              meta: { view: "related", kind: q.kind, terms, geo: str(r.geo), timeframe: str(r.timeframe) },
            },
            "trends",
            "suggestion",
          ),
        );
      }
      for (const g of (r.regions as { region: string; values: number[] }[] | undefined) ?? []) {
        const peak = Math.max(...(g.values ?? [0]));
        out.push(
          item(
            {
              id: `trends:geo:${g.region}`,
              title: g.region,
              score: Number.isFinite(peak) ? Math.max(1, peak) : undefined,
              meta: { view: "geo", values: g.values, terms, geo: str(r.geo), timeframe: str(r.timeframe) },
            },
            "trends",
            "trend-point",
          ),
        );
      }
      const tl = r.timeline as { points: { date: string; values: number[] }[]; isPartial: boolean } | undefined;
      if (tl && tl.points.length) {
        const last = tl.points[tl.points.length - 1]?.values ?? [];
        const fibers = tl.points.flatMap((p) => (p.values ?? []).map((v) => v));
        const peak = fibers.length ? Math.max(...fibers) : 0;
        out.push(
          item(
            {
              id: `trends:timeline:${terms}:${str(r.geo)}:${str(r.timeframe)}`,
              title: `Interesse: ${terms}`,
              text: `pico ${peak}/100, último ponto ${last.join("/")} (dados parciais: ${String(tl.isPartial)})`,
              meta: { view: "timeline", points: tl.points.length, isPartial: tl.isPartial, peak, terms, geo: str(r.geo), timeframe: str(r.timeframe) },
            },
            "trends",
            "trend-point",
          ),
        );
      }
      return out.slice(0, cap(options.limit ?? 25, 50));
    },
  },
);

export const trendsSources: Record<string, () => SourcePort> = {
  trends: () => trends,
};