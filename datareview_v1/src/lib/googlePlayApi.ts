/* eslint-disable @typescript-eslint/no-explicit-any --
 * Fronteira de API: os payloads JSON do Google Play (via rota local
 * google-play-scraper) não têm tipagem pública. Normalizados imediatamente
 * para AppInfo/ReviewEntry (tipados) na entrada do sistema. */
import type { AppInfo, ReviewEntry, TopChartEntry, SourceId } from "./appStoreApi";
import { supabase } from "@/integrations/supabase/client";
import { cached, makeKey } from "@/lib/cache";
import { langForCountry } from "@/lib/region";

export interface ParsedStoreInput {
  type: "url" | "id" | "term";
  value: string;
  store?: SourceId;
  country?: string;
}

async function callGPlayFunction(body: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke("google-play-scraper", { body });
  if (error) throw new Error(error.message || "Edge function error");
  return data;
}

// ─── Input detection ───────────────────────────────────────────────
export function detectSingleInput(input: string): ParsedStoreInput {
  const trimmed = input.trim();
  if (!trimmed) return { type: "term", value: "" };
  const gpUrlMatch = trimmed.match(/play\.google\.com\/store\/apps\/details\?id=([a-zA-Z0-9._]+)/);
  if (gpUrlMatch) return { type: "url", value: gpUrlMatch[1], store: "google" };
  const appleUrlMatch = trimmed.match(/apps\.apple\.com\/([a-z]{2})\/app\/[^/]+\/id(\d+)/i);
  if (appleUrlMatch) return { type: "url", value: appleUrlMatch[2], store: "apple", country: appleUrlMatch[1].toLowerCase() };
  const itunesUrlMatch = trimmed.match(/itunes\.apple\.com\/([a-z]{2})?\/?app\/[^/]+\/id(\d+)/i);
  if (itunesUrlMatch) return { type: "url", value: itunesUrlMatch[2], store: "apple", country: itunesUrlMatch[1]?.toLowerCase() };
  if (/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*){1,}$/.test(trimmed)) return { type: "id", value: trimmed, store: "google" };
  if (/^\d{6,}$/.test(trimmed)) return { type: "id", value: trimmed, store: "apple" };
  return { type: "term", value: trimmed };
}

export function parseMultiInput(raw: string): ParsedStoreInput[] {
  // Divide em vírgulas, quebras de linha, ponto-e-vírgula, tabs e pipes.
  const parts = raw.split(/[\n;,\t|]+/).map(s => s.trim()).filter(Boolean);
  if (parts.length <= 1) {
    const single = detectSingleInput(raw.trim());
    return single.value ? [single] : [];
  }
  const seen = new Set<string>();
  const out: ParsedStoreInput[] = [];
  for (const p of parts) {
    const d = detectSingleInput(p);
    if (!d.value) continue;
    const key = `${d.store ?? "term"}:${d.value.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(d);
  }
  return out;
}

export function detectInputType(input: string) { return detectSingleInput(input); }

// ─── Mapping ──────────────────────────────────────────────────────
function mapGPlayApp(raw: Record<string, unknown>): AppInfo {
  const r = raw as any;
  return {
    id: r.appId || "",
    store: "google",
    name: r.title || "",
    icon: r.icon || "",
    developer: r.developer || "",
    rating: r.score || 0,
    ratingCount: r.ratings || 0,
    price: r.free ? "Grátis" : (r.priceText || r.price || "Pago"),
    genre: r.genre || (r.categories?.[0]?.name) || "",
    description: r.description || r.summary || "",
    version: r.version || "",
    releaseDate: r.released || "",
    currentVersionReleaseDate: r.updated ? new Date(r.updated).toISOString() : "",
    screenshots: r.screenshots || [],
    url: r.url || `https://play.google.com/store/apps/details?id=${r.appId}`,
    downloads: r.installs || r.maxInstalls?.toLocaleString("pt-BR") || undefined,
    contentRating: r.contentRating || undefined,
    lastUpdated: r.updated ? new Date(r.updated).toLocaleDateString("pt-BR") : undefined,
    size: r.size || undefined,
    minimumOsVersion: r.androidVersionText || undefined,
    recentChanges: r.recentChanges || undefined,
    histogram: r.histogram || undefined,
    developerEmail: r.developerEmail || undefined,
    developerWebsite: r.developerWebsite || undefined,
    privacyPolicy: r.privacyPolicy || undefined,
    headerImage: r.headerImage || undefined,
    video: r.video || undefined,
    editorsChoice: r.editorsChoice || undefined,
    adSupported: r.adSupported || undefined,
    offersIAP: r.offersIAP || undefined,
    containsAds: r.containsAds || undefined,
    free: r.free || undefined,
    developerId: r.developerId != null ? String(r.developerId) : undefined,
    developerAddress: r.developerAddress || undefined,
    summary: r.summary || undefined,
    genreIds: r.genreId ? [String(r.genreId)] : undefined,
    currency: r.currency || undefined,
    minInstalls: typeof r.minInstalls === "number" ? r.minInstalls : undefined,
    maxInstalls: typeof r.maxInstalls === "number" ? r.maxInstalls : undefined,
    reviewsCount: typeof r.reviews === "number" ? r.reviews : undefined,
    comments: Array.isArray(r.comments) ? r.comments : undefined,
    raw: r,
  };
}

export async function searchGooglePlayApps(term: string, country = "br", limit = 10): Promise<AppInfo[]> {
  try {
    const lang = langForCountry(country);
    const key = makeKey(["gp:search", term.toLowerCase(), country, lang, limit]);
    const data = await cached(key, () => callGPlayFunction({ action: "search", term, country, lang, num: limit }), { ttlMs: 1000 * 60 * 60 * 6, skipCacheIf: (v) => !Array.isArray(v) || v.length === 0 });
    if (!Array.isArray(data)) return [];
    return data.map((r: any) => mapGPlayApp(r));
  } catch (err) {
    console.error("Google Play search failed:", err);
    return [];
  }
}

export async function fetchGooglePlayAppDetails(packageId: string, country = "br"): Promise<AppInfo | null> {
  try {
    const lang = langForCountry(country);
    const key = makeKey(["gp:app", packageId, country, lang]);
    const data = await cached(key, () => callGPlayFunction({ action: "app", appId: packageId, country, lang }), { ttlMs: 1000 * 60 * 60 * 12 });
    if (!data || typeof data !== "object") return null;
    return mapGPlayApp(data as Record<string, unknown>);
  } catch (err) {
    console.error("GP detail fail:", packageId, err);
    return null;
  }
}

export async function fetchGooglePlayReviews(
  packageId: string,
  appName: string,
  country = "br",
  num = 150,
  sort: "recent" | "helpful" | "rating" | "mixed" = "mixed",
): Promise<ReviewEntry[]> {
  try {
    const lang = langForCountry(country);
    const key = makeKey(["gp:reviews", packageId, country, lang, num, sort]);
    const data = await cached(
      key,
      () => callGPlayFunction({ action: "reviews", appId: packageId, country, lang, num, sort }),
      { ttlMs: 1000 * 60 * 60 * 3 },
    );
    if (!Array.isArray(data)) return [];
    return data.map((r: any, i: number) => ({
      id: r.id || `gp-${packageId}-${i}`,
      store: "google" as const,
      appId: packageId,
      appName,
      author: r.userName || "Anônimo",
      rating: r.score || 0,
      title: r.title || "",
      text: r.text || "",
      date: r.date || "",
      version: r.version || undefined,
      thumbsUp: typeof r.thumbsUp === "number" ? r.thumbsUp : undefined,
      developerReply: r.replyText || undefined,
      developerReplyDate: r.replyDate || undefined,
      country,
    }));
  } catch (err) {
    console.error("GP reviews fail:", err);
    return [];
  }
}

/** Google Play top charts. category is a gplay category constant (e.g. "APPLICATION", "GAME"). */
export async function fetchGooglePlayTopList(country: string, category?: string, collection: "TOP_FREE" | "TOP_PAID" | "GROSSING" = "TOP_FREE", num = 25): Promise<TopChartEntry[]> {
  try {
    const lang = langForCountry(country);
    const key = makeKey(["gp:list", country, lang, collection, category ?? "", num]);
    const data = await cached(key, () => callGPlayFunction({ action: "list", country, lang, collection, category, num }), { ttlMs: 1000 * 60 * 60 * 6 });
    if (!Array.isArray(data)) return [];
    return data.map((r: any) => ({
      id: String(r.appId || ""),
      store: "google" as const,
      name: String(r.title || ""),
      icon: String(r.icon || ""),
      developer: String(r.developer || ""),
      url: r.url || `https://play.google.com/store/apps/details?id=${r.appId}`,
      genre: r.genre,
      rating: typeof r.score === "number" ? r.score : undefined,
      ratingCount: typeof r.ratings === "number" ? r.ratings : undefined,
      installs: r.installs || undefined,
      free: r.free ?? undefined,
      price: r.priceText || r.price || undefined,
    }));

  } catch (err) {
    console.error("GP top list failed:", err);
    return [];
  }
}
