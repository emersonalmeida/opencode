import type { RequestHandler } from "express";
// Camada RAW imutável (provenance): registra CollectionRun + RawArtifact por
// coleta. Failure-safe por design — nunca muda o comportamento da rota.
import { startRun, finishRun, saveRawArtifact, type CollectionRun } from "../lib/rawStore.js";
// Telemetria local de rate-limit (todo.md P0): instrumenta os status por
// fonte; o snapshot do run vai na resposta para o cliente alertar degradadas.
import { recordStatus, getTelemetry, isDegraded } from "../lib/rateLimitTelemetry.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type TelemetrySnapshot = ReturnType<typeof getTelemetry>;
/** Delta do contador amp-api entre duas capturas (before/after de um run). */
function computeAmpDelta(before: TelemetrySnapshot | null, after: TelemetrySnapshot) {
  const b = before?.sources?.amp;
  const a = after.sources.amp;
  return {
    attempts: a.attempts - (b?.attempts ?? 0),
    ok: a.ok - (b?.ok ?? 0),
    status429: a.status429 - (b?.status429 ?? 0),
    status0: a.status0 - (b?.status0 ?? 0),
    other: a.other - (b?.other ?? 0),
    last429At: a.last429At,
  } as const;
}

// ─────────────────────────────────────────────────────────────────────────────
// Apple reviews collection strategy (maximizes yield, ~3 sources combined):
//
// 1. amp-api (PRIMARY): https://apps.apple.com/api/apps/v1/catalog/{cc}/apps/{id}/reviews
//    A JSON API da web App Store (proxied via apps.apple.com, SEM bearer token
//    necessário — diferente de chamar amp-api.apps.apple.com diretamente).
//    Retorna 20 reviews/página com paginação por cursor de offset, profunda
//    (~500-750 por país). Fonte de maior rendimento.
// 2. Página web SSR (SUPLEMENTO): a página localizada apps.apple.com renderiza
//    no servidor ~24-40 reviews "most helpful" num blob JSON
//    <script id="serialized-server-data">. Adiciona reviews que o amp-api pode
//    omitir (sort diferente), dedup por id.
// 3. RSS (FALLBACK): feed legado itunes.apple.com/.../rss/customerreviews
//    (quase deprecado, ocasionalmente traz reviews de páginas esparsas).
//
// Todas as fontes são agregadas em vários storefronts e deduplicadas por id de
// review. O teto do amp-api por país é ~500-750; combinando storefronts dá para
// chegar a milhares em apps globais. Paramos no maxReviews solicitado.
// ─────────────────────────────────────────────────────────────────────────────

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";

// Storefronts to try, ordered by review volume (requested country first).
const ALL_COUNTRIES = [
  "us", "br", "gb", "ca", "au", "de", "fr", "it", "es", "nl", "jp",
  "kr", "in", "mx", "ru", "tr", "sa", "ae", "id", "th", "vn",
  "tw", "hk", "sg", "my", "ph", "pl", "cz", "ua", "ar", "cl", "co", "pe",
  "se", "no", "dk", "fi", "be", "ch", "at", "pt", "lu", "ie", "nz", "za",
  "gr", "ee", "lv", "lt", "sk", "hu", "ro", "il", "is",
];

const SSR_RE = /<script type="application\/json" id="serialized-server-data">([\s\S]*?)<\/script>/;

interface NormalizedReview {
  id: string;
  rating: number;
  title: string;
  text: string;
  author: string;
  date: string;
  country: string;
}

function normalize(
  id: unknown, rating: unknown, title: unknown, text: unknown,
  author: unknown, date: unknown, country: string,
): NormalizedReview | null {
  const rid = String(id ?? "").trim();
  if (!rid) return null;
  const r = typeof rating === "string" ? parseInt(rating, 10) : Number(rating ?? 0);
  return {
    id: rid,
    rating: Number.isFinite(r) ? r : 0,
    title: String(title ?? "").trim(),
    text: String(text ?? "").trim(),
    author: String(author ?? "").trim(),
    date: String(date ?? "").trim(),
    country,
  };
}

// ── Source 1: amp-api (token-less proxy) ────────────────────────────────────
const AMP_URL = "https://apps.apple.com/api/apps/v1/catalog/{cc}/apps/{id}/reviews";

// Concurrency helper: bounded parallel work with cooperative early-stop.
// JS is single-threaded, so tasks mutate shared collectors deterministically.
export async function pool<T>(items: T[], concurrency: number, shouldStop: () => boolean, fn: (item: T) => Promise<void>): Promise<void> {
  let idx = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (idx < items.length) {
      if (shouldStop()) break;
      const item = items[idx++];
      try {
        await fn(item);
      } catch {
        // individual failures never kill the sweep — best-effort collection
      }
    }
  });
  await Promise.all(workers);
}

async function ampFetchJson(url: string): Promise<{ data?: Array<Record<string, unknown>>; next?: string | null; status: number }> {
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "application/json",
        Origin: "https://apps.apple.com",
        Referer: "https://apps.apple.com/",
        "Accept-Language": "en-US,en;q=0.7",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) { recordStatus("amp", resp.status); return { status: resp.status }; }
    const data = await resp.json();
    recordStatus("amp", resp.status);
    return { data: data?.data, next: data?.next, status: resp.status };
  } catch {
    recordStatus("amp", 0);
    return { status: 0 }; // timeout/network — treated as transient by caller
  }
}

async function fetchAmpApiReviews(appId: string, country: string, max: number): Promise<NormalizedReview[]> {
  const out: NormalizedReview[] = [];
  const seen = new Set<string>();
  let offset = 1;
  // Per-country amp-api caps ~500-750 (≈38 pages of 20). For very large
  // targets we allow more pages per country to extract more depth.
  const MAX_PAGES = max > 2000 ? 100 : 60;
  const MAX_RETRIES = 3;
  for (let page = 0; page < MAX_PAGES; page++) {
    if (out.length >= max) break;
    const url = `${AMP_URL.replace("{cc}", country).replace("{id}", encodeURIComponent(appId))}?l=en-US&platform=web&offset=${offset}&limit=20`;
    let data: { data?: Array<Record<string, unknown>>; next?: string | null; status: number } | null = null;
    // Retry with backoff on 429 (Apple rate-limits the amp-api hard) and on
    // transient status 0 (timeout/network).
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      data = await ampFetchJson(url);
      if (data.status !== 429 && data.status !== 0) break;
      const backoff = 1000 * (attempt + 1); // 1s, 2s, 3s
      await new Promise((r) => setTimeout(r, backoff));
    }
    if (!data) break;
    if (data.status !== 200) break; // 400/403/404 — app not available here; stop this country
    const arr = Array.isArray(data?.data) ? data.data : [];
    if (!arr.length) break;
    for (const item of arr) {
      const attrs = (item?.attributes ?? {}) as Record<string, unknown>;
      const n = normalize(
        item?.id,
        attrs.rating,
        attrs.title,
        attrs.review ?? attrs.body ?? attrs.contents,
        attrs.userName ?? attrs.reviewerNickname,
        attrs.date,
        country,
      );
      if (!n || seen.has(n.id)) continue;
      seen.add(n.id);
      out.push(n);
      if (out.length >= max) break;
    }
    const next = data?.next;
    const m = next && typeof next === "string" ? /offset=(\d+)/.exec(next) : null;
    if (!m) break;
    const nextOffset = parseInt(m[1], 10);
    if (!Number.isFinite(nextOffset) || nextOffset <= offset) break;
    offset = nextOffset;
    await new Promise((r) => setTimeout(r, 200)); // polite delay between pages
  }
  return out;
}

// ── Source 2: SSR web page ──────────────────────────────────────────────────
function walkForReviews(obj: unknown, found: Record<string, unknown>[]): void {
  if (!obj) return;
  if (Array.isArray(obj)) {
    for (const v of obj) walkForReviews(v, found);
    return;
  }
  if (typeof obj === "object") {
    const o = obj as Record<string, unknown>;
    if (o["$kind"] === "Review") {
      found.push(o);
      return;
    }
    for (const v of Object.values(o)) walkForReviews(v, found);
  }
}

function extractSSRReviews(html: string, country: string): NormalizedReview[] {
  const m = SSR_RE.exec(html);
  if (!m) return [];
  let state: unknown;
  try {
    state = JSON.parse(m[1]);
  } catch {
    return [];
  }
  const found: Record<string, unknown>[] = [];
  walkForReviews(state, found);
  const out: NormalizedReview[] = [];
  for (const f of found) {
    const n = normalize(f.id, f.rating, f.title, f.contents ?? f.body, f.reviewerName, f.date ?? f.dateText, country);
    if (n) out.push(n);
  }
  return out;
}

async function fetchPage(appId: string, country: string): Promise<{ html: string | null; unavailable: boolean }> {
  const url = `https://apps.apple.com/${country}/app/id${encodeURIComponent(appId)}`;
  try {
    // AbortSignal.timeout: a hanging storefront never stalls the sweep.
    const resp = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.7",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    });
    if (!resp.ok) {
      // Non-2xx (404 etc.) = app not in this storefront — skip deep phases
      // for it later. A timeout keeps `unavailable=false` (retryable).
      recordStatus("ssr", resp.status);
      return { html: null, unavailable: true };
    }
    recordStatus("ssr", resp.status);
    return { html: await resp.text(), unavailable: false };
  } catch {
    recordStatus("ssr", 0);
    return { html: null, unavailable: false };
  }
}

// ── Source 3: RSS (fallback) ────────────────────────────────────────────────
async function fetchRSSReviews(appId: string, country: string): Promise<NormalizedReview[]> {
  const out: NormalizedReview[] = [];
  for (let page = 1; page <= 10; page++) {
    const url = `https://itunes.apple.com/${country}/rss/customerreviews/id=${encodeURIComponent(appId)}/page=${page}/sortby=mostrecent/json`;
    try {
      const resp = await fetch(url, { headers: { "User-Agent": UA } });
      if (!resp.ok) { recordStatus("rss", resp.status); continue; }
      recordStatus("rss", resp.status);
      const data = await resp.json();
      const entries = data?.feed?.entry;
      if (!Array.isArray(entries)) continue;
      for (const e of entries) {
        if (!e || typeof e !== "object" || !("im:rating" in e)) continue;
        const n = normalize(e?.id?.label, e?.["im:rating"]?.label, e?.title?.label, e?.content?.label, e?.author?.name?.label, e?.updated?.label, country);
        if (n) out.push(n);
      }
    } catch {
      // ignore single-page errors
      recordStatus("rss", 0);
    }
  }
  return out;
}

// ── Orchestrator ────────────────────────────────────────────────────────────
// Two-phase strategy to maximize yield while respecting Apple's aggressive
// amp-api rate limiting (429s):
//   Phase A (fast, broad): SSR page sweep across all storefronts — 1 request
//     each, rarely rate-limited, yields a baseline of hundreds. PARALLEL with
//     a concurrency-8 pool + per-request timeout (12s): the sweep finishes in
//     ~2-4s instead of ~20-25s sequential. Storefronts that 404 the app page
//     are remembered as `unavailable` and skipped in the deep phase.
//   Phase B (deep, targeted): amp-api paginated only on the top storefronts by
//     review volume (primary first, then us/gb/ca/de/jp...), with 429 retry
//     backoff. Runs with concurrency 2 across countries (bounded request rate,
//     ~2× faster than sequential).
// Both phases dedupe by review id and stop as soon as the target is met.
// Deep-amp-api is capped to a small number of storefronts to bound latency.
// Number of storefronts to deep-paginate via amp-api grows with the target so
// large limits can actually reach thousands for globally-installed apps.
export function deepCountriesForTarget(target: number): number {
  if (target > 5000) return 14;
  if (target > 2000) return 10;
  return 6;
}

export const appleReviews: RequestHandler = async (req, res) => {
  res.set(corsHeaders);
  let run: CollectionRun | null = null;
  let before: ReturnType<typeof getTelemetry> | null = null;
  try {
    const { appId, country, maxReviews, sort } = req.body ?? {};
    if (!appId || typeof appId !== "string") {
      return res.status(400).json({ error: "Missing appId" });
    }
    // Snapshot "antes" do run: a resposta inclui o delta de telemetria deste
    // run (não os totais acumulados do processo) — degradado = 429s ≥ 30%.
    before = getTelemetry();
    const primary = (typeof country === "string" && country.trim()) ? country.toLowerCase().trim() : "br";
    const target = Math.max(1, Math.min(Number(maxReviews) || 500, 10000));
    // CollectionRun RAW/provenance (aditivo): params + versão do collector.
    run = startRun({
      sourceId: "apple",
      subjectKey: `apple:app:${appId}`,
      collector: "apple-reviews",
      collectorVersion: "1",
      params: { appId, country: primary, maxReviews: target, sort: sort ?? "mixed" },
      requested: target,
    });

    // Preferência de ordenação (best-effort — as APIs públicas da Apple não
    // expõem um parâmetro de sort real na fonte):
    //   "helpful" → prioriza a página web SSR (que renderiza reviews "most
    //     helpful") para os reviews mais curtidos virem primeiro.
    //   "recent" → prioriza o amp-api (retorna reviews das mais recentes) e
    //     pula o viés "most helpful" do sweep SSR.
    //   "rating"/"mixed"/ausente → mantém a estratégia original broad-then-deep
    //     (baseline SSR + profundidade amp-api + fallback RSS) p/ maximizar
    //     rendimento.
    const sortPref = typeof sort === "string" ? sort : "mixed";
    const prioritizeRecent = sortPref === "recent";
    const prioritizeHelpful = sortPref === "helpful";

    const ordered = [primary, ...ALL_COUNTRIES.filter((c) => c !== primary)];
    const seen = new Set<string>();
    const reviews: NormalizedReview[] = [];
    const perCountry: Record<string, number> = {};
    // Storefronts where the app page returned a non-2xx in Phase A — the deep
    // amp-api phase skips them (an app that 404s a storefront has no reviews
    // there, and paginating it wastes a rate-limit budget slot).
    const unavailable = new Set<string>();

    const pushNew = (r: NormalizedReview): boolean => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      reviews.push(r);
      return true;
    };

    const ssrSweep = () =>
      // SSR is never rate-limited, so a wide pool (8) cuts the broad sweep
      // from ~20-25s sequential to ~2-4s.
      pool(ordered, 8, () => reviews.length >= target, async (cc) => {
        const { html, unavailable: un } = await fetchPage(appId, cc);
        if (un) { unavailable.add(cc); return; }
        if (!html) return;
        let added = 0;
        for (const r of extractSSRReviews(html, cc)) {
          if (pushNew(r)) { added++; if (reviews.length >= target) break; }
        }
        if (added) perCountry[cc] = (perCountry[cc] || 0) + added;
      });

    // ── Phase A: SSR broad sweep (fast baseline, parallel) ──
    // Skipped when the user wants strictly "recent" reviews (SSR is "most
    // helpful" biased) so amp-api's most-recent ordering is preserved.
    if (!prioritizeRecent) await ssrSweep();

    // ── Phase B: amp-api deep on top storefronts (depth the SSR lacks) ──
    // Concurrency 2 across countries: the amp-api rate-limits per-IP, so we
    // keep the request rate bounded while still halving deep-phase latency.
    if (reviews.length < target) {
      const deepLimit = deepCountriesForTarget(target);
      let deepStarted = 0;
      await pool(ordered, 2, () => reviews.length >= target || deepStarted >= deepLimit, async (cc) => {
        if (unavailable.has(cc)) return;
        deepStarted++;
        const amp = await fetchAmpApiReviews(appId, cc, target - reviews.length);
        let added = 0;
        for (const r of amp) {
          if (pushNew(r)) { added++; if (reviews.length >= target) break; }
        }
        if (added) perCountry[cc] = (perCountry[cc] || 0) + added;
      });
    }

    // Quando o usuário quer "helpful", roda o sweep SSR AGORA (após o amp-api)
    // para complementar com reviews most-helpful que o amp-api pode ter omitido.
    if (prioritizeHelpful && reviews.length < target) await ssrSweep();

    // ── Phase C: RSS fallback (primary/us/gb only) for any stragglers ──
    if (reviews.length < target) {
      for (const cc of [primary, "us", "gb"]) {
        if (reviews.length >= target) break;
        let added = 0;
        for (const r of await fetchRSSReviews(appId, cc)) {
          if (pushNew(r)) { added++; if (reviews.length >= target) break; }
        }
        if (added) perCountry[cc] = (perCountry[cc] || 0) + added;
      }
    }

    // RawArtifact imutável: payload agregado + hash sha256 + provenance.
    saveRawArtifact({
      runId: run.id,
      sourceId: "apple",
      subjectKey: `apple:app:${appId}`,
      endpoint: "apple-reviews",
      params: { target, country: primary, sort: sort ?? "mixed" },
      payload: { reviews, count: reviews.length, perCountry },
      collector: "apple-reviews",
      collectorVersion: "1",
    });
    finishRun(run, { status: reviews.length ? "completed" : "partial", yielded: reviews.length });
    // Delta de telemetria deste run (amp-api é a fonte sujeita a rate-limit).
    const ampDelta = computeAmpDelta(before, getTelemetry());
    return res.json({ reviews, count: reviews.length, perCountry, telemetry: { amp: ampDelta, degraded: isDegraded(ampDelta) } });
  } catch (err) {
    console.error("apple-reviews error:", err);
    if (run) {
      finishRun(run, { status: "failed", errors: [{ endpoint: "apple-reviews", message: String((err as Error)?.message || err) }] });
    }
    return res.status(500).json({ error: String((err as Error)?.message || err) });
  }
};
