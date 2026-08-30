/**
 * Apple App Store reviews (SourcePort nativo).
 *
 * 3 fontes combinadas, legado do v1:
 *   1. amp-api  (primária): GET https://apps.apple.com/api/apps/v1/catalog/{cc}/apps/{id}/reviews
 *   2. RSS      (fallback): GET https://itunes.apple.com/{cc}/rss/customerreviews/id={id}/json
 *   SSR embutido permanece como estratégia futura (não portado: sweep de
 *   storefronts). Erros honestos quando ambas falham.
 */
import type { CollectOptions, NormalizedItem } from "@v4/contracts";
import type { SourcePort } from "@v4/domain";
import { defineAdapter, item, num, str } from "./base.js";
import { asArray, asRecord, fetchJson } from "./http.js";

const APP_RL = "https://apps.apple.com/api/apps/v1/catalog";
const UA_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";

interface AppleReview {
  id: string;
  rating: number;
  title: string;
  text: string;
  author: string;
  date: string;
  version?: string;
  country?: string;
}

function appId(raw: string): string {
  const q = raw.trim().replace(/\D/g, "");
  if (!q) throw new Error("query deve ser o id do app (ex.: 284882215 para Facebook)");
  return q;
}

function ccOf(country?: string): string {
  const c = country?.toLowerCase() ?? "br";
  return /^[a-z]{2}$/.test(c) ? c : "br";
}

/** Normaliza entry do amp-api OU do SSR embutido (atributos têm review/rating/date). */
function findReviews(blob: unknown, out: AppleReview[]): void {
  if (Array.isArray(blob)) {
    for (const b of blob) findReviews(b, out);
    return;
  }
  if (typeof blob !== "object" || blob === null) return;
  const r = blob as Record<string, unknown>;
  const attrs = asRecord(r.attributes);
  const reviewText = str(attrs.review);
  const rating = num(attrs.rating);
  if (reviewText && rating !== undefined) {
    out.push({
      id: str(r.id) || String(out.length),
      rating,
      title: str(attrs.title) || reviewText.slice(0, 60),
      text: reviewText,
      author: str(attrs.author),
      date: str(attrs.date),
      version: str(attrs.version) || undefined,
    });
  }
  for (const v of Object.values(r)) findReviews(v, out);
}

/** RSS: entry → review (shape itunes xml→json). */
export function parseRss(z: unknown, cc: string): AppleReview[] {
  const entries = asArray(asRecord(asRecord(asRecord(z).feed).entry));
  return entries.map((e, i) => {
    const er = asRecord(e);
    const label = (k: string) => str(asRecord(er[k]).label);
    const digits = label("im:rating");
    return {
      id: str(er.id) || `rss:${i}`,
      rating: num(digits) ?? 0,
      title: label("title") || label("im:name"),
      text: label("content"),
      author: label("author"),
      date: label("updated"),
      version: str(asRecord(er["im:version"]).label) || undefined,
      country: cc,
    };
  });
}

function dedupe(reviews: AppleReview[]): AppleReview[] {
  const seen = new Set<string>();
  return reviews.filter((r) => {
    const k = `${r.rating}|${r.author}|${r.date.slice(0, 10)}|${r.text.slice(0, 30)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export const apple = defineAdapter(
  {
    id: "apple",
    label: "Apple App Store (reviews)",
    kind: "review",
    description: "Reviews da App Store (amp-api primária, RSS fallback; query = id do app).",
    capabilities: ["reviews", "media"],
    lookup: true,
    rateLimit: { rps: 1, burst: 2 },
  },
  {
    async fetch(options: CollectOptions) {
      const id = appId(options.query);
      const cc = ccOf(options.country);
      const sort = options.engine || "mostrecent";
      const limit = options.limit ?? 25;
      const results: AppleReview[] = [];
      let ampFailed = "";

      if (sort !== "rss") {
        try {
          let offset = 0;
          while (results.length < limit && offset < 300 && !options.signal?.aborted) {
            const before = results.length;
            const url = `${APP_RL}/${cc}/apps/${id}/reviews?l=pt-BR&platform=web&offset=${offset}&limit=20&sort=${sort === "mosthelpful" ? "mostHelpful" : "mostRecent"}`;
            const data = await fetchJson(url, {
              signal: options.signal,
              timeoutMs: 15000,
              headers: { Origin: "https://apps.apple.com", Referer: "https://apps.apple.com/", "User-Agent": UA_SAFARI },
            });
            findReviews(data, results);
            offset += 20;
            if (results.length === before) break;
          }
        } catch (error) {
          ampFailed = error instanceof Error ? error.message : "amp-api falhou";
        }
      }

      if (results.length === 0) {
        const url = `https://itunes.apple.com/${cc}/rss/customerreviews/id=${id}/page=1/sortby=mostrecent/json`;
        const rssJson = await fetchJson(url, { signal: options.signal, timeoutMs: 15000, noAccept: true });
        results.push(...parseRss(rssJson, cc));
      }
      if (results.length === 0) {
        throw new Error(ampFailed ? `amp-api: ${ampFailed} · RSS sem reviews` : "nenhuma review encontrada");
      }
      return { id, cc, sort, reviews: dedupe(results).slice(0, capLimit(limit)) };
    },
    map(data: unknown): NormalizedItem[] {
      const r = asRecord(data);
      const cc = str(r.cc);
      return asArray(r.reviews).map((raw) => {
        const rev = asRecord(raw);
        const rating = num(rev.rating);
        return item(
          {
            id: `apple:${str(r.id)}:${str(rev.id)}`,
            title: str(rev.title) || `Avaliação ${rating ?? "?"} estrelas`,
            text: str(rev.text) || undefined,
            author: str(rev.author) || undefined,
            date: str(rev.date) || undefined,
            score: rating,
            meta: {
              rating,
              version: str(rev.version) || undefined,
              country: cc,
              helpful: num(rev.helpful),
            },
          },
          "apple",
          "review",
        );
      });
    },
  },
);

function capLimit(n: number): number {
  return Math.max(1, Math.min(Math.floor(n), 50));
}

export const appleSources: Record<string, () => SourcePort> = {
  apple: () => apple,
};

export type AppleSourceId = keyof typeof appleSources;