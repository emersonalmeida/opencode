/**
 * Funções puras que computam métricas agregadas a partir do dataset coletado.
 * Usadas pela página de Dashboard para gerar gráficos e tabelas instantaneamente
 * (sem depender da IA), permitindo filtros por loja e por app.
 */
import type { DatasetEntry } from "@/lib/datasetStore";
import type { ReviewEntry } from "@/lib/appStoreApi";

export interface DashboardFilters {
  store: "all" | "apple" | "google";
  appKeys: Set<string>; // `${store}:${id}` — vazio = todos
  sentiment: "all" | "positive" | "neutral" | "negative";
}

export const DEFAULT_FILTERS: DashboardFilters = {
  store: "all",
  appKeys: new Set(),
  sentiment: "all",
};

/** Chave única de uma entry. */
export function entryKey(store: string, id: string) {
  return `${store}:${id}`;
}

/** Filtra o dataset conforme store + apps selecionados e retorna reviews filtrados por sentimento. */
export function filterDataset(
  entries: DatasetEntry[],
  filters: DashboardFilters,
): { filteredEntries: DatasetEntry[]; filteredReviews: ReviewReviewWithContext[] } {
  const filteredEntries = entries.filter((e) => {
    const k = entryKey(e.app.store, e.app.id);
    if (filters.store !== "all" && e.app.store !== filters.store) return false;
    if (filters.appKeys.size > 0 && !filters.appKeys.has(k)) return false;
    return true;
  });

  const filteredReviews: ReviewReviewWithContext[] = [];
  for (const e of filteredEntries) {
    for (const r of e.reviews) {
      if (filters.sentiment !== "all") {
        if (filters.sentiment === "positive" && r.rating < 4) continue;
        if (filters.sentiment === "neutral" && r.rating !== 3) continue;
        if (filters.sentiment === "negative" && r.rating > 2) continue;
      }
      filteredReviews.push({
        ...r,
        appName: e.app.name,
        appIcon: e.app.icon,
        appStore: e.app.store,
        appId: e.app.id,
      });
    }
  }

  return { filteredEntries, filteredReviews };
}

/** Review com contexto do app pai (para a lista de reviews recentes). */
export interface ReviewReviewWithContext extends ReviewEntry {
  appName: string;
  appIcon: string;
  appStore: string;
  appId: string;
}

/* ---------------------------------------------------------------- KPIs --- */

export interface DashboardKPIs {
  totalApps: number;
  totalReviews: number;
  avgRating: number;
  positivePct: number;
  neutralPct: number;
  negativePct: number;
  storeCount: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  withDeveloperReply: number;
  oldestDate: string | null;
  newestDate: string | null;
  avgTextLength: number;
}

export function computeKPIs(reviews: ReviewEntry[], entries: DatasetEntry[]): DashboardKPIs {
  const total = reviews.length;
  const positive = reviews.filter((r) => r.rating >= 4).length;
  const neutral = reviews.filter((r) => r.rating === 3).length;
  const negative = reviews.filter((r) => r.rating <= 2).length;
  const withReply = reviews.filter((r) => r.developerReply).length;
  const sum = total ? reviews.reduce((s, r) => s + r.rating, 0) : 0;
  const textSum = total ? reviews.reduce((s, r) => s + r.text.length, 0) : 0;

  const dated = reviews.filter((r) => r.date).map((r) => new Date(r.date).getTime());
  const oldest = dated.length ? new Date(Math.min(...dated)).toISOString() : null;
  const newest = dated.length ? new Date(Math.max(...dated)).toISOString() : null;

  return {
    totalApps: entries.length,
    totalReviews: total,
    avgRating: total ? +(sum / total).toFixed(2) : 0,
    positivePct: total ? Math.round((positive / total) * 100) : 0,
    neutralPct: total ? Math.round((neutral / total) * 100) : 0,
    negativePct: total ? Math.round((negative / total) * 100) : 0,
    storeCount: new Set(entries.map((e) => e.app.store)).size,
    positiveCount: positive,
    negativeCount: negative,
    neutralCount: neutral,
    withDeveloperReply: withReply,
    oldestDate: oldest,
    newestDate: newest,
    avgTextLength: total ? Math.round(textSum / total) : 0,
  };
}

/* ------------------------------------------------------- Rating dist --- */

export function computeRatingDistribution(reviews: ReviewEntry[]) {
  return [1, 2, 3, 4, 5].map((star) => ({
    star: `★${star}`,
    count: reviews.filter((r) => r.rating === star).length,
    rating: star,
  }));
}

/* ---------------------------------------------------------- Sentiment --- */

export function computeSentiment(reviews: ReviewEntry[]) {
  const positive = reviews.filter((r) => r.rating >= 4).length;
  const neutral = reviews.filter((r) => r.rating === 3).length;
  const negative = reviews.filter((r) => r.rating <= 2).length;
  return [
    { name: "Positivo (★4-5)", value: positive },
    { name: "Neutro (★3)", value: neutral },
    { name: "Negativo (★1-2)", value: negative },
  ].filter((d) => d.value > 0);
}

/* ------------------------------------------------------------ Timeline --- */

export function computeTimeline(reviews: ReviewEntry[]) {
  const dated = reviews
    .filter((r) => r.date)
    .map((r) => ({ ...r, ts: new Date(r.date).getTime() }))
    .filter((r) => Number.isFinite(r.ts));

  if (dated.length < 2) return [];

  const byMonth: Record<string, { ratings: number[]; count: number }> = {};
  for (const r of dated) {
    const d = new Date(r.ts);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!byMonth[key]) byMonth[key] = { ratings: [], count: 0 };
    byMonth[key].ratings.push(r.rating);
    byMonth[key].count++;
  }

  return Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, d]) => ({
      month,
      avgRating: +(d.ratings.reduce((a, b) => a + b, 0) / d.ratings.length).toFixed(2),
      count: d.count,
    }));
}

/* --------------------------------------------------- Store comparison --- */

export function computeStoreComparison(entries: DatasetEntry[]) {
  const stores = ["apple", "google"] as const;
  return stores
    .map((store) => {
      const storeEntries = entries.filter((e) => e.app.store === store);
      const reviews = storeEntries.flatMap((e) => e.reviews);
      const positive = reviews.filter((r) => r.rating >= 4).length;
      return {
        store: store === "apple" ? "Apple App Store" : "Google Play",
        shortName: store === "apple" ? "Apple" : "Google",
        apps: storeEntries.length,
        reviews: reviews.length,
        avgRating: reviews.length
          ? +(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(2)
          : 0,
        positivePct: reviews.length ? Math.round((positive / reviews.length) * 100) : 0,
      };
    })
    .filter((s) => s.apps > 0);
}

/* ----------------------------------------------------------- Word cloud --- */

const STOP_WORDS = new Set([
  "a", "o", "e", "de", "da", "do", "que", "em", "para", "com", "não", "um", "uma",
  "os", "as", "no", "na", "por", "mais", "se", "mas", "ao", "ele", "ela", "das",
  "dos", "ou", "ser", "quando", "muito", "há", "nos", "já", "eu", "também", "é",
  "foi", "esse", "essa", "está", "são", "tem", "seu", "sua", "isso", "este",
  "me", "meu", "minha", "ter", "como", "the", "and", "is", "it", "to", "of", "in",
  "app", "aplicativo", "que", "mas", "pra", "pro", "tá", "vai", "bem", "só",
  "nem", "sem", "uma", "pelo", "pela", "aos", "às", "num", "numa", "estou",
  "estava", "minha", "isso", "tudo", "aqui", "lá", "então", "assim", "sobre",
  "após", "antes", "desde", "entre", "até", "their", "this", "that", "they",
  "you", "your", "but", "not", "for", "with", "have", "has", "was", "were",
]);

export function computeWordCloud(reviews: ReviewEntry[], limit = 40) {
  if (reviews.length === 0) return [];
  const text = reviews.map((r) => `${r.title} ${r.text}`).join(" ").toLowerCase();
  const words = text.split(/[\s,.!?;:()"\-/]+/).filter((w) => w.length > 3 && !STOP_WORDS.has(w));
  const freq: Record<string, number> = {};
  for (const w of words) freq[w] = (freq[w] || 0) + 1;
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, limit);
}

/* ------------------------------------------------------- Per-app stats --- */

export interface PerAppStat {
  key: string;
  name: string;
  store: string;
  icon: string;
  rating: number;
  ratingCount: number;
  reviewCount: number;
  avgCollected: number;
  positivePct: number;
  negativePct: number;
  topThemes: [string, number][];
  oldestDate: string | null;
  newestDate: string | null;
  withReply: number;
}

function topThemesFor(reviews: ReviewEntry[], n: number): [string, number][] {
  const freq: Record<string, number> = {};
  for (const r of reviews) {
    const words = `${r.title} ${r.text}`.toLowerCase().split(/[\s,.!?;:()"\-/]+/);
    const seen = new Set<string>();
    for (const w of words) {
      if (w.length < 4 || STOP_WORDS.has(w) || seen.has(w)) continue;
      seen.add(w);
      freq[w] = (freq[w] || 0) + 1;
    }
  }
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, n);
}

/* Cache por assinatura de entry (2026-08-19): o stat de um app só muda quando
 * o app é recoletado (reviews.length ou collectedAt mudam). Como o dataset
 * inteiro é re-lido/filtrado por MUITAS superfícies (Dashboard, sidebar de
 * gráficos, pipeline, canvas, OS, Flow...), cachear por app evita re-tokenizar
 * reviews e re-agregar a cada escopo/render. Assinatura:
 * `${store}:${id}:${reviews.length}:${collectedAt}`. */
const perAppCache = new Map<string, PerAppStat>();
const PER_APP_CACHE_CAP = 500;

function entrySignature(e: DatasetEntry): string {
  return `${entryKey(e.app.store, e.app.id)}:${e.reviews.length}:${e.collectedAt}`;
}

export function computePerAppStats(entries: DatasetEntry[]): PerAppStat[] {
  const out: PerAppStat[] = new Array(entries.length);
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const sig = entrySignature(e);
    const cached = perAppCache.get(sig);
    if (cached) { out[i] = cached; continue; }
    out[i] = statForEntry(e);
    if (perAppCache.size >= PER_APP_CACHE_CAP) perAppCache.clear(); // apps são poucos; cap defensivo
    perAppCache.set(sig, out[i]);
  }
  return out;
}

function statForEntry(e: DatasetEntry): PerAppStat {
  {
    const reviews = e.reviews;
    const total = reviews.length;
    const positive = reviews.filter((r) => r.rating >= 4).length;
    const negative = reviews.filter((r) => r.rating <= 2).length;
    const sum = total ? reviews.reduce((s, r) => s + r.rating, 0) : 0;
    const dated = reviews.filter((r) => r.date).map((r) => new Date(r.date).getTime());
    return {
      key: entryKey(e.app.store, e.app.id),
      name: e.app.name,
      store: e.app.store,
      icon: e.app.icon,
      rating: e.app.rating,
      ratingCount: e.app.ratingCount,
      reviewCount: total,
      avgCollected: total ? +(sum / total).toFixed(2) : 0,
      positivePct: total ? Math.round((positive / total) * 100) : 0,
      negativePct: total ? Math.round((negative / total) * 100) : 0,
      topThemes: topThemesFor(reviews, 5),
      oldestDate: dated.length ? new Date(Math.min(...dated)).toISOString() : null,
      newestDate: dated.length ? new Date(Math.max(...dated)).toISOString() : null,
      withReply: reviews.filter((r) => r.developerReply).length,
    };
  }
}

/* ------------------------------------------------------ Recent reviews --- */

export function computeRecentReviews(
  reviews: ReviewReviewWithContext[],
  limit = 50,
): ReviewReviewWithContext[] {
  return [...reviews]
    .filter((r) => r.date)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit);
}

/* --------------------------------------------------- Version analysis --- */

export function computeVersionBreakdown(reviews: ReviewEntry[]) {
  const byVersion: Record<string, { ratings: number[]; count: number }> = {};
  for (const r of reviews) {
    if (!r.version) continue;
    const v = r.version;
    if (!byVersion[v]) byVersion[v] = { ratings: [], count: 0 };
    byVersion[v].ratings.push(r.rating);
    byVersion[v].count++;
  }
  return Object.entries(byVersion)
    .map(([version, d]) => ({
      version,
      count: d.count,
      avgRating: +(d.ratings.reduce((a, b) => a + b, 0) / d.ratings.length).toFixed(2),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}
