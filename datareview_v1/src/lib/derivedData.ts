/**
 * derivedData.ts — BASE DERIVADA DETERMINÍSTICA do dataset (camada única).
 *
 * O sistema tem 3 bases de dados:
 *   1. BRUTA      — `aso:dataset:v1` (apps + reviews coletados, datasetStore)
 *   2. DERIVADA   — esta camada: agregados determinísticos computados a partir
 *                   da bruta (KPIs, distribuições, temas, versões, países…)
 *   3. IA         — saídas de IA (aiOutputStore/insightStore/sessionStore/
 *                   artifactStore) com proveniência.
 *
 * POR QUE EXISTE (2026-08-19): com o datasetStore cacheado, `listDataset()`
 * retorna a MESMA referência de array entre writes. Este módulo explora isso:
 * - `getDatasetDigest(entries)` é memoizado por REFERÊNCIA (WeakMap): todas as
 *   superfícies que consomem o dataset inteiro (Dashboard, OS, Flow, Journey,
 *   decks, pipeline) compartilham UM cálculo — o primeiro a pedir paga o custo,
 *   os demais leem de graça. O cache invalida sozinho quando o dataset muda
 *   (nova referência de array).
 * - Cada parte do digest é computada LAZY por chave (só o que a superfície
 *   pede é calculado).
 * - `getEntryDerived(entry)` memoiza por ASSINATURA da entry
 *   (`key:reviews.length:collectedAt`), então recoletar UM app não invalida os
 *   derivados dos outros — mesmo em escopos filtrados.
 *
 * Regra: esta camada é 100% determinística (mesma entrada → mesma saída) e
 * nunca escreve no storage — é derivável da base bruta a qualquer momento.
 */
import type { DatasetEntry } from "@/lib/datasetStore";
import type { ReviewEntry } from "@/lib/appStoreApi";
import {
  computeKPIs,
  computeRatingDistribution,
  computeSentiment,
  computeTimeline,
  computeStoreComparison,
  computeWordCloud,
  computePerAppStats,
  entryKey,
  type DashboardKPIs,
  type PerAppStat,
} from "@/lib/dashboardAnalytics";

/* ------------------------------------------------- dataset-level digest --- */

export interface DatasetDigest {
  totalApps: number;
  totalReviews: number;
  reviews: ReviewEntry[];
  kpis: DashboardKPIs;
  ratingDistribution: ReturnType<typeof computeRatingDistribution>;
  sentiment: ReturnType<typeof computeSentiment>;
  timeline: ReturnType<typeof computeTimeline>;
  storeComparison: ReturnType<typeof computeStoreComparison>;
  wordCloud: [string, number][];
  perApp: PerAppStat[];
  /** Reviews por app `${store}:${id}` → contagem (mapa rápido). */
  reviewCountByKey: Record<string, number>;
}

const digestCache = new WeakMap<DatasetEntry[], Map<string, unknown>>();

function cached<T>(entries: DatasetEntry[], key: string, fn: () => T): T {
  let m = digestCache.get(entries);
  if (!m) {
    m = new Map();
    digestCache.set(entries, m);
  }
  if (m.has(key)) return m.get(key) as T;
  const v = fn();
  m.set(key, v);
  return v;
}

/**
 * Digest determinístico do dataset (ou de um escopo estável). Memoizado por
 * referência do array `entries` — passe sempre a referência vinda de
 * `listDataset()`/`useDataset()` para compartilhamento global.
 */
export function getDatasetDigest(entries: DatasetEntry[]): DatasetDigest {
  return {
    totalApps: entries.length,
    totalReviews: cached(entries, "totalReviews", () =>
      entries.reduce((s, e) => s + e.reviews.length, 0)),
    reviews: cached(entries, "reviews", () => entries.flatMap((e) => e.reviews)),
    kpis: cached(entries, "kpis", () =>
      computeKPIs(getDatasetDigestReviews(entries), entries)),
    ratingDistribution: cached(entries, "ratingDist", () =>
      computeRatingDistribution(getDatasetDigestReviews(entries))),
    sentiment: cached(entries, "sentiment", () =>
      computeSentiment(getDatasetDigestReviews(entries))),
    timeline: cached(entries, "timeline", () =>
      computeTimeline(getDatasetDigestReviews(entries))),
    storeComparison: cached(entries, "storeComparison", () =>
      computeStoreComparison(entries)),
    wordCloud: cached(entries, "wordCloud", () =>
      computeWordCloud(getDatasetDigestReviews(entries), 40)),
    perApp: cached(entries, "perApp", () => computePerAppStats(entries)),
    reviewCountByKey: cached(entries, "reviewCountByKey", () => {
      const m: Record<string, number> = {};
      for (const e of entries) m[entryKey(e.app.store, e.app.id)] = e.reviews.length;
      return m;
    }),
  };
}

function getDatasetDigestReviews(entries: DatasetEntry[]): ReviewEntry[] {
  return cached(entries, "reviews", () => entries.flatMap((e) => e.reviews));
}

/** Atalho: digest do dataset GLOBAL (referência estável do store). */
export function getGlobalDigest(entries: DatasetEntry[]): DatasetDigest {
  return getDatasetDigest(entries);
}

/* -------------------------------------------------- per-entry derivados --- */

export interface EntryDerived {
  key: string;
  /** Versões com volume + nota média + % negativa (análise de regressão). */
  versions: { version: string; count: number; avgRating: number; negativePct: number }[];
  /** Países/storefronts com volume + nota média + % negativa. */
  countries: { country: string; count: number; avgRating: number; negativePct: number }[];
  /** Bandas de qualidade dos reviews enriquecidos. */
  quality: { rich: number; medium: number; poor: number; enriched: number };
  withReply: number;
  withDate: number;
  withVersion: number;
  withCountry: number;
  helpfulTotal: number;
}

const entryCache = new Map<string, EntryDerived>();
const ENTRY_CACHE_CAP = 500;

/**
 * Derivados determinísticos de UMA entry, computados numa ÚNICA passagem pelos
 * reviews (antes: 4-6 passes separados por consumidor). Cache por assinatura:
 * recoletar outro app não invalida este.
 */
export function getEntryDerived(entry: DatasetEntry): EntryDerived {
  const key = entryKey(entry.app.store, entry.app.id);
  const sig = `${key}:${entry.reviews.length}:${entry.collectedAt}`;
  const hit = entryCache.get(sig);
  if (hit) return hit;

  const versions: Record<string, { count: number; sum: number; neg: number }> = {};
  const countries: Record<string, { count: number; sum: number; neg: number }> = {};
  let rich = 0, medium = 0, poor = 0, enriched = 0;
  let withReply = 0, withDate = 0, withVersion = 0, withCountry = 0, helpfulTotal = 0;

  for (const r of entry.reviews) {
    if (r.date) withDate++;
    if (r.version) {
      withVersion++;
      const v = (versions[r.version] ??= { count: 0, sum: 0, neg: 0 });
      v.count++; v.sum += r.rating;
      if (r.rating <= 2) v.neg++;
    }
    if (r.country) {
      withCountry++;
      const c = (countries[r.country.toUpperCase()] ??= { count: 0, sum: 0, neg: 0 });
      c.count++; c.sum += r.rating;
      if (r.rating <= 2) c.neg++;
    }
    if (r.developerReply) withReply++;
    if ((r.thumbsUp ?? 0) > 0) helpfulTotal++;
    const er = r as ReviewEntry & { qualityBand?: string; sentiment?: string };
    if (er.sentiment != null) enriched++;
    if (er.qualityBand === "rich") rich++;
    else if (er.qualityBand === "medium") medium++;
    else if (er.qualityBand === "poor") poor++;
  }

  const round2 = (n: number) => +n.toFixed(2);
  const derived: EntryDerived = {
    key,
    versions: Object.entries(versions)
      .map(([version, d]) => ({
        version,
        count: d.count,
        avgRating: round2(d.sum / d.count),
        negativePct: Math.round((d.neg / d.count) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    countries: Object.entries(countries)
      .map(([country, d]) => ({
        country,
        count: d.count,
        avgRating: round2(d.sum / d.count),
        negativePct: Math.round((d.neg / d.count) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12),
    quality: { rich, medium, poor, enriched },
    withReply,
    withDate,
    withVersion,
    withCountry,
    helpfulTotal,
  };

  if (entryCache.size >= ENTRY_CACHE_CAP) entryCache.clear();
  entryCache.set(sig, derived);
  return derived;
}

/* ----------------------------------------------------- índices úteis --- */

/** Índice de reviews por id — O(1) para validação/lookup de evidências. */
const reviewIndexCache = new WeakMap<DatasetEntry[], Map<string, { entry: DatasetEntry; review: ReviewEntry }>>();

export function getReviewIndex(entries: DatasetEntry[]): Map<string, { entry: DatasetEntry; review: ReviewEntry }> {
  const hit = reviewIndexCache.get(entries);
  if (hit) return hit;
  const map = new Map<string, { entry: DatasetEntry; review: ReviewEntry }>();
  for (const entry of entries) {
    for (const review of entry.reviews) {
      if (review.id && !map.has(review.id)) map.set(review.id, { entry, review });
    }
  }
  reviewIndexCache.set(entries, map);
  return map;
}
