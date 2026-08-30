/* eslint-disable @typescript-eslint/no-explicit-any --
 * Fronteira de API: os payloads JSON da Apple (iTunes Search/Lookup, RSS
 * legacy, marketing-tools) não têm tipagem pública. Eles são normalizados
 * imediatamente para AppInfo/ReviewEntry (tipados) na entrada do sistema. */
/**
 * SourceId — id de fonte aberto ("apple" | "google" | futuras fontes).
 * Alargado propositalmente de union fechada para `string` na Phase 3 do
 * target-state: as 63 comparações `store === "apple"` seguem funcionando
 * e novas fontes passam a ser admitidas pelo tipo sem refatoração.
 */
export type SourceId = string;

export interface AppInfo {
  id: string;
  store: SourceId;
  name: string;
  icon: string;
  developer: string;
  rating: number;
  ratingCount: number;
  price: string;
  genre: string;
  description: string;
  version: string;
  releaseDate: string;
  currentVersionReleaseDate: string;
  screenshots: string[];
  url: string;
  // Extended metadata
  size?: string;
  minimumOsVersion?: string;
  contentRating?: string;
  downloads?: string;
  lastUpdated?: string;
  // NEW: enriched fields (best-effort — populated depending on store)
  releaseNotes?: string;
  sellerName?: string;
  languages?: string[];
  supportedDevices?: string[];
  ratingCurrentVersion?: number;
  ratingCountCurrentVersion?: number;
  advisories?: string[];
  primaryGenreId?: number;
  bundleId?: string;
  trackContentRating?: string;
  histogram?: Record<string, number>; // Google Play rating distribution
  recentChanges?: string;
  developerEmail?: string;
  developerWebsite?: string;
  privacyPolicy?: string;
  headerImage?: string;
  video?: string;
  editorsChoice?: boolean;
  adSupported?: boolean;
  offersIAP?: boolean;
  containsAds?: boolean;
  free?: boolean;
  // Campos adicionais auditados (completud total por fonte)
  genres?: string[];          // Apple: lista de gêneros
  genreIds?: string[];        // Apple: ids dos gêneros / Google: genreId
  currency?: string;          // Apple: moeda de formattedPrice / Google: currency
  features?: string[];        // Apple: features (ex.: gameCenter, iosUniversal)
  ipadScreenshots?: string[]; // Apple: screenshots de iPad
  appletvAppScreenshots?: string[]; // Apple: screenshots Apple TV
  developerId?: string;       // Google: id do desenvolvedor
  developerAddress?: string;  // Google: endereço do desenvolvedor (público)
  summary?: string;           // Google: texto-resumo curto
  ratingsByCount?: boolean[]; // reservado (não usado)
  minInstalls?: number;       // Google: installs (limite inferior)
  maxInstalls?: number;       // Google: installs (limite superior)
  reviewsCount?: number;      // Google: número total de reviews públicas
  comments?: string[];        // Google: comentários destacados na loja
  // Full raw payload from the store — the AI panel can inspect this verbatim
  raw?: unknown;
}

export interface ReviewEntry {
  id: string;
  store: SourceId;
  appId: string;
  appName: string;
  author: string;
  rating: number;
  title: string;
  text: string;
  date: string;
  // NEW
  version?: string;
  thumbsUp?: number;
  developerReply?: string;
  developerReplyDate?: string;
  /** Storefront country the review was collected from (e.g. "br", "us"). */
  country?: string;
}

import { supabase } from "@/integrations/supabase/client";
import { cached, makeKey } from "@/lib/cache";
import { checkAppleTelemetry } from "@/lib/rateLimitAlerts";

const ITUNES_SEARCH = "https://itunes.apple.com/search";
const ITUNES_LOOKUP = "https://itunes.apple.com/lookup";
const ITUNES_REVIEWS = "https://itunes.apple.com/{country}/rss/customerreviews/id={appId}/page={page}/sortby=mostrecent/json";
const APPLE_TOP_RSS = "https://rss.marketingtools.apple.com/api/v2/{country}/apps/{feed}/{limit}/apps.json";
const APPLE_LEGACY_RSS = "https://itunes.apple.com/{country}/rss/{feedType}/limit={limit}/genre={genre}/json";
const APPLE_FALLBACK_COUNTRIES = ["br", "us"];

async function itunesFetch(url: string): Promise<any> {
  const { data, error } = await supabase.functions.invoke("itunes-proxy", { body: { url } });
  if (error) throw new Error(error.message || "itunes-proxy error");
  return data;
}

export interface AppleSearchOptions {
  /** Incluir/excluir apps marcas como explícitos (iTunes attribute). */
  explicit?: boolean;
}

export async function searchApps(
  term: string,
  country = "br",
  limit = 10,
  opts: AppleSearchOptions = {},
): Promise<AppInfo[]> {
  try {
    const fetchCountry = (targetCountry: string) => {
      const key = makeKey(["apple:search", term.toLowerCase(), targetCountry, limit, opts.explicit ?? ""]);
      return cached(key, () => {
        const params = new URLSearchParams({ term, country: targetCountry, entity: "software", limit: String(limit) });
        if (opts.explicit !== undefined) params.set("explicit", opts.explicit ? "1" : "0");
        return itunesFetch(`${ITUNES_SEARCH}?${params.toString()}`);
      }, { ttlMs: 1000 * 60 * 60 * 6, skipCacheIf: (v: any) => !v?.results?.length });
    };

    const primaryData = await fetchCountry(country);
    const primaryResults = Array.isArray(primaryData?.results) ? primaryData.results : [];
    if (country.toLowerCase() !== "br" && !hasStrongAppleMatch(primaryResults, term)) {
      const brData = await fetchCountry("br");
      const brResults = Array.isArray(brData?.results) ? brData.results : [];
      return mergeAppleResults([...brResults, ...primaryResults]).map(mapAppleApp);
    }

    return mergeAppleResults(primaryResults).map(mapAppleApp);
  } catch (err) {
    console.error("Apple search failed:", err);
    return [];
  }
}

export async function lookupApp(id: string, country = "br"): Promise<AppInfo | null> {
  const countries = uniqueCountries([country, ...APPLE_FALLBACK_COUNTRIES]);
  for (const targetCountry of countries) {
    try {
      const key = makeKey(["apple:lookup", id, targetCountry]);
      const data = await cached(key, () => itunesFetch(`${ITUNES_LOOKUP}?id=${id}&country=${targetCountry}`), {
        ttlMs: 1000 * 60 * 60 * 12,
        skipCacheIf: (v: any) => !v?.results?.length,
      });
      if (data?.results && data.results.length > 0) return mapAppleApp(data.results[0]);
    } catch (err) {
      console.error(`Apple lookup failed for ${targetCountry}:`, err);
    }
  }
  try {
    const data = await cached(makeKey(["apple:lookup", id, "any"]), () => itunesFetch(`${ITUNES_LOOKUP}?id=${id}`), {
      ttlMs: 1000 * 60 * 60 * 12,
      skipCacheIf: (v: any) => !v?.results?.length,
    });
    if (data?.results && data.results.length > 0) return mapAppleApp(data.results[0]);
    return null;
  } catch (err) {
    console.error("Apple lookup failed:", err);
    return null;
  }
}

function normalizeSearchText(value: unknown): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function hasStrongAppleMatch(results: any[], term: string): boolean {
  const q = normalizeSearchText(term).trim();
  if (!q || q.length < 3) return results.length > 0;
  return results.some((r) => {
    const name = normalizeSearchText(r?.trackName);
    const seller = normalizeSearchText(r?.sellerName || r?.artistName);
    const bundle = normalizeSearchText(r?.bundleId);
    return name.includes(q) || seller.includes(q) || bundle.includes(q);
  });
}

function mergeAppleResults(results: any[]): any[] {
  const seen = new Set<string>();
  const merged: any[] = [];
  for (const result of results) {
    const id = String(result?.trackId || result?.bundleId || "");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    merged.push(result);
  }
  return merged;
}

function uniqueCountries(countries: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const country of countries) {
    const normalized = country.toLowerCase().trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

// Apple's public customer-reviews RSS is partially deprecated: most apps/pages
// return `feed.entry: null`, but some apps still expose reviews on *scattered*
// pages (e.g. page 2 or 9 — not page 1). So we must scan ALL pages 1..MAX per
// (country, sort), not just the first few, and keep whatever comes back.
// O RSS público tem teto rígido de 10 páginas × 50 reviews = 500 por (país, sort).
const APPLE_MAX_PAGES = 10;
const APPLE_PAGE_SIZE = 50;
const APPLE_HARD_CAP = 500;

function isRealReviewEntry(e: any): boolean {
  // O feed RSS às vezes lista o bloco de metadados do próprio app como primeira
  // entrada (tem `im:name`, sem `im:rating`). Reviews reais sempre trazem `im:rating`.
  return !!e && typeof e === "object" && "im:rating" in e && "author" in e;
}

function mapAppleReview(e: any, appId: string, appName: string, country?: string): ReviewEntry | null {
  if (!isRealReviewEntry(e)) return null;
  const id = e?.id?.label || "";
  return {
    id: id || `${appId}-${Math.random().toString(36).slice(2)}`,
    store: "apple",
    appId,
    appName,
    author: e?.author?.name?.label || "Anônimo",
    rating: parseInt(e?.["im:rating"]?.label || "0", 10) || 0,
    title: e?.title?.label || "",
    text: e?.content?.label || "",
    date: e?.updated?.label || "",
    version: e?.["im:version"]?.label,
    country,
  };
}

export async function fetchReviews(
  appId: string,
  appName: string,
  country = "br",
  maxReviews = 500,
  sort: "recent" | "helpful" | "rating" | "mixed" = "mixed"
): Promise<ReviewEntry[]> {
  // Apple deprecated the public RSS customer-reviews feed — most pages return
  // `feed.entry: null`, and even where it works it caps at ~500 reviews per
  // (country, sort). The new primary source is the localized App Store *web
  // page*, which server-side renders ~24-40 reviews per country into a
  // `<script id="serialized-server-data">` JSON blob. The server route
  // `apple-reviews` fetches that page across many storefronts + falls back to
  // RSS, dedupes by review id, and returns up to the requested `maxReviews`
  // (hard cap 10000). Typical yield: hundreds to low-thousands of unique reviews.
  //
  // NOTE on sort: Apple's public review sources do NOT expose a source-level
  // sort parameter the way Google Play does. The `sort` hint is passed to the
  // server route, which reorders its source priority ("helpful" → SSR "most
  // helpful" first; "recent" → amp-api "most recent" first) as a best-effort
  // preference. Final ordering is applied client-side after collection.
  const target = Math.max(1, Math.min(maxReviews, 10000));
  const seenIds = new Set<string>();

  // Primary: dedicated server route (does SSR scraping + RSS fallback).
  try {
    const { data, error } = await supabase.functions.invoke("apple-reviews", {
      body: { appId, country, maxReviews: target, sort },
    });
    if (!error && data && Array.isArray(data.reviews)) {
      // Telemetria P0: alerta quando o run veio degradado por 429 do amp-api.
      checkAppleTelemetry(data?.telemetry, appName);
      const out: ReviewEntry[] = [];
      for (const r of data.reviews) {
        const id = String(r?.id || "").trim();
        if (!id) continue;
        // Dedupe defensively even though the server route already dedupes —
        // protects against any duplicate ids in the payload.
        if (seenIds.has(id)) continue;
        seenIds.add(id);
        out.push({
          id,
          store: "apple",
          appId,
          appName,
          author: r?.author || "Anônimo",
          rating: Number(r?.rating) || 0,
          title: r?.title || "",
          text: r?.text || "",
          date: r?.date || "",
          country: r?.country || undefined,
        });
        if (out.length >= target) break;
      }
      if (out.length) return out;
    }
  } catch (err) {
    console.error("apple-reviews route failed, falling back to RSS:", err);
  }

  // Fallback: legacy RSS multi-page scan (kept for resilience if the server
  // route is unavailable). Scans all 10 pages per (country, sort) without
  // breaking on null — reviews can appear on scattered pages.
  const countries = uniqueCountries([country, ...APPLE_FALLBACK_COUNTRIES]);
  const sorts = ["mostrecent", "mosthelpful"] as const;
  const reviews: ReviewEntry[] = [];
  for (const targetCountry of countries) {
    for (const sortby of sorts) {
      if (reviews.length >= target) return reviews;
      for (let page = 1; page <= APPLE_MAX_PAGES; page++) {
        if (reviews.length >= target) return reviews;
        try {
          const url = ITUNES_REVIEWS
            .replace("{country}", targetCountry)
            .replace("{appId}", appId)
            .replace("{page}", String(page));
          const key = makeKey(["apple:reviews", appId, targetCountry, sortby, page]);
          const data = await cached(key, () => itunesFetch(url), {
            ttlMs: 1000 * 60 * 60 * 3,
          });
          const entries = data?.feed?.entry;
          if (!Array.isArray(entries)) continue;
          for (const e of entries) {
            const rev = mapAppleReview(e, appId, appName, targetCountry);
            if (!rev) continue;
            if (rev.id && seenIds.has(rev.id)) continue;
            if (rev.id) seenIds.add(rev.id);
            reviews.push(rev);
            if (reviews.length >= target) return reviews;
          }
        } catch (err) {
          console.error(`Apple RSS fetch failed (${targetCountry}/${sortby}/p${page}):`, err);
        }
      }
    }
  }
  return reviews;
}

export interface TopChartEntry {
  id: string;
  store: SourceId;
  name: string;
  icon: string;
  developer: string;
  url: string;
  genre?: string;
  rating?: number;
  ratingCount?: number;
  installs?: string;
  free?: boolean;
  price?: string;
  /** Data da última atualização/listagem quando a fonte expõe (ex.: Apple RSS). */
  releaseDate?: string;
}


/** Apple top charts. Uses legacy iTunes RSS when a genreId is given (supports category filter),
 *  otherwise the marketingtools API. */
export async function fetchAppleTopList(country: string, feed: "top-free" | "top-paid" | "top-grossing" = "top-free", limit = 25, genreId?: number): Promise<TopChartEntry[]> {
  try {
    if (genreId) {
      const feedType = feed === "top-paid" ? "toppaidapplications" : feed === "top-grossing" ? "topgrossingapplications" : "topfreeapplications";
      const url = APPLE_LEGACY_RSS
        .replace("{country}", country)
        .replace("{feedType}", feedType)
        .replace("{limit}", String(limit))
        .replace("{genre}", String(genreId));
      const key = makeKey(["apple:top-legacy", country, feedType, limit, genreId]);
      const data = await cached(key, () => itunesFetch(url), { ttlMs: 1000 * 60 * 60 * 6 });
      const entries = data?.feed?.entry;
      if (!Array.isArray(entries)) return [];
      return entries.map((e: any) => ({
        id: String(e?.id?.attributes?.["im:id"] || ""),
        store: "apple" as const,
        name: String(e?.["im:name"]?.label || ""),
        icon: String(e?.["im:image"]?.[e["im:image"].length - 1]?.label || ""),
        developer: String(e?.["im:artist"]?.label || ""),
        url: String(e?.id?.label || ""),
        genre: e?.category?.attributes?.label,
        releaseDate: String(e?.["im:releaseDate"]?.label || e?.["im:releaseDate"] || ""),
      }));
    }
    const url = APPLE_TOP_RSS
      .replace("{country}", country)
      .replace("{feed}", feed)
      .replace("{limit}", String(limit));
    const key = makeKey(["apple:top", country, feed, limit]);
    const data = await cached(key, () => itunesFetch(url), { ttlMs: 1000 * 60 * 60 * 6 });
    const results = data?.feed?.results;
    if (!Array.isArray(results)) return [];
    return results.map((r: any) => ({
      id: String(r.id),
      store: "apple" as const,
      name: String(r.name || ""),
      icon: String(r.artworkUrl100 || ""),
      developer: String(r.artistName || ""),
      url: String(r.url || ""),
      genre: r.genres?.[0]?.name,
      releaseDate: String(r.releaseDate || r.currentVersionReleaseDate || ""),
    }));
  } catch (err) {
    console.error("Apple top list failed:", err);
    return [];
  }
}

function mapAppleApp(r: Record<string, unknown>): AppInfo {
  const anyR = r as any;
  return {
    id: String(anyR.trackId || ""),
    store: "apple",
    name: String(anyR.trackName || ""),
    icon: String(anyR.artworkUrl512 || anyR.artworkUrl100 || ""),
    developer: String(anyR.artistName || ""),
    rating: Number(anyR.averageUserRating || 0),
    ratingCount: Number(anyR.userRatingCount || 0),
    price: anyR.formattedPrice ? String(anyR.formattedPrice) : "Grátis",
    genre: String(anyR.primaryGenreName || ""),
    description: String(anyR.description || ""),
    version: String(anyR.version || ""),
    releaseDate: String(anyR.releaseDate || ""),
    currentVersionReleaseDate: String(anyR.currentVersionReleaseDate || ""),
    screenshots: (anyR.screenshotUrls as string[]) || [],
    url: String(anyR.trackViewUrl || ""),
    size: anyR.fileSizeBytes ? `${(Number(anyR.fileSizeBytes) / 1048576).toFixed(1)} MB` : undefined,
    minimumOsVersion: anyR.minimumOsVersion ? String(anyR.minimumOsVersion) : undefined,
    contentRating: anyR.contentAdvisoryRating ? String(anyR.contentAdvisoryRating) : undefined,
    trackContentRating: anyR.trackContentRating ? String(anyR.trackContentRating) : undefined,
    releaseNotes: anyR.releaseNotes ? String(anyR.releaseNotes) : undefined,
    sellerName: anyR.sellerName ? String(anyR.sellerName) : undefined,
    languages: Array.isArray(anyR.languageCodesISO2A) ? anyR.languageCodesISO2A : undefined,
    supportedDevices: Array.isArray(anyR.supportedDevices) ? anyR.supportedDevices : undefined,
    ratingCurrentVersion: anyR.averageUserRatingForCurrentVersion ? Number(anyR.averageUserRatingForCurrentVersion) : undefined,
    ratingCountCurrentVersion: anyR.userRatingCountForCurrentVersion ? Number(anyR.userRatingCountForCurrentVersion) : undefined,
    advisories: Array.isArray(anyR.advisories) ? anyR.advisories : undefined,
    primaryGenreId: anyR.primaryGenreId ? Number(anyR.primaryGenreId) : undefined,
    bundleId: anyR.bundleId ? String(anyR.bundleId) : undefined,
    developerWebsite: anyR.sellerUrl ? String(anyR.sellerUrl) : undefined,
    developerId: anyR.artistId ? String(anyR.artistId) : undefined,
    genres: Array.isArray(anyR.genres) ? anyR.genres : undefined,
    genreIds: Array.isArray(anyR.genreIds) ? anyR.genreIds : undefined,
    currency: anyR.currency ? String(anyR.currency) : undefined,
    features: Array.isArray(anyR.features) ? anyR.features : undefined,
    ipadScreenshots: Array.isArray(anyR.ipadScreenshotUrls) ? anyR.ipadScreenshotUrls : undefined,
    appletvAppScreenshots: Array.isArray(anyR.appletvScreenshotUrls) ? anyR.appletvScreenshotUrls : undefined,
    free: anyR.price === 0,
    raw: r,
  };
}
