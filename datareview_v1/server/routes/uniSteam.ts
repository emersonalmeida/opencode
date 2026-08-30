import type { RequestHandler } from "express";
// Camada RAW/provenance (aditivo): helper failure-safe, nunca muda a resposta.
import { startRun, finishRun, saveRawArtifact, type CollectionRun } from "../lib/rawStore.js";
import { withObservation } from "../lib/auditObservation.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Conector Steam — busca de jogos (scrape da página de busca) + reviews de
 * usuários (endpoint appreviews público, JSON, sem auth). Referência:
 * docs/_uni.py (steam_search / steam_reviews).
 *
 * Ações:
 *  - search:  { query, limit? } — store.steampowered.com/search/?term=..
 *  - reviews: { appId, language?: "all"|"portuguese"|"english", limit? }
 *             — store.steampowered.com/appreviews/{appId}?json=1
 */
const STEAM_SEARCH = "https://store.steampowered.com/search/";
const STEAM_REVIEWS = "https://store.steampowered.com/appreviews";
const UA = "Mozilla/5.0 (compatible; AppDataReview/1.0)";

function decodeHtml(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Parse do HTML da busca da Steam: <a class="search_result_row" data-ds-appid="..">…<span class="title">..</span>. */
function parseSteamSearch(html: string, limit: number): { appId: string; title: string }[] {
  const out: { appId: string; title: string }[] = [];
  const rowRe = /<a\b[^>]*search_result_row[^>]*>([\s\S]*?)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html)) && out.length < limit) {
    const idM = /data-ds-appid="(\d+)"/.exec(m[0]);
    const titleM = /<span class="title">([^<]+)<\/span>/.exec(m[1]);
    if (idM && titleM) out.push({ appId: idM[1], title: decodeHtml(titleM[1].trim()) });
  }
  return out;
}

interface SteamReview {
  recommendationid?: string;
  review?: string;
  votes_up?: number;
  voted_up?: boolean;
  timestamp_created?: number;
  author?: { steamid?: string; num_games_owned?: number; playtime_forever?: number };
}

export const uniSteam: RequestHandler = async (req, res) => {
  res.set(corsHeaders);
  let run: CollectionRun | null = null;
  try {
    const { action } = req.body ?? {};

    if (action === "search") {
      const { query, limit } = req.body ?? {};
      if (!query || typeof query !== "string") return res.status(400).json({ error: "query required" });
      const max = Math.max(1, Math.min(Number(limit) || 10, 50));
      run = startRun({
        sourceId: "steam",
        subjectKey: `steam:${query}`,
        collector: "uni-steam",
        collectorVersion: "1",
        params: { action, query, limit: max },
      });
      const url = `${STEAM_SEARCH}?term=${encodeURIComponent(query)}`;
      const games = await withObservation(
        run.id, "steam", "steam-search", url,
        { action, query, limit: max },
        async () => {
          const resp = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
          if (!resp.ok) throw new Error(`Steam retornou ${resp.status}`);
          return parseSteamSearch(await resp.text(), max);
        },
      );
      saveRawArtifact({
        runId: run.id, sourceId: "steam", subjectKey: `steam:${query}`,
        endpoint: "steam-search", url, params: { action, query, limit: max },
        payload: { count: games.length }, collector: "uni-steam", collectorVersion: "1",
      });
      finishRun(run, { status: games.length ? "completed" : "partial", yielded: games.length });
      return res.json({ games, count: games.length });
    }

    if (action === "reviews") {
      const { appId, language = "all", limit } = req.body ?? {};
      if (!appId) return res.status(400).json({ error: "appId required (busque o jogo primeiro)" });
      const max = Math.max(1, Math.min(Number(limit) || 30, 100));
      const lang = String(language || "all");
      run = startRun({
        sourceId: "steam",
        subjectKey: `steam:reviews:${appId}:${lang}`,
        collector: "uni-steam",
        collectorVersion: "1",
        params: { action, appId, language: lang, limit: max },
      });
      const params = new URLSearchParams({
        json: "1", language: lang, purchase_type: "all",
        num_per_page: String(max), filter: "recent",
      });
      const url = `${STEAM_REVIEWS}/${encodeURIComponent(String(appId))}?${params}`;
      const reviews = await withObservation(
        run.id, "steam", "steam-reviews", url,
        { action, appId, language: lang, limit: max },
        async () => {
          const resp = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
          if (!resp.ok) throw new Error(`Steam retornou ${resp.status}`);
          const data = (await resp.json()) as { success?: number; reviews?: SteamReview[] };
          if (data.success !== 1) throw new Error("Steam não retornou reviews (appId inválido?)");
          const raw = data.reviews ?? [];
          return raw.map((r) => ({
            id: r.recommendationid ?? "",
            text: r.review ?? "",
            recommended: !!r.voted_up,
            votesUp: r.votes_up ?? 0,
            createdAt: r.timestamp_created ? new Date(r.timestamp_created * 1000).toISOString() : "",
            playtimeHours: r.author?.playtime_forever ? Math.round((r.author.playtime_forever / 60) * 10) / 10 : null,
          }));
        },
      );
      saveRawArtifact({
        runId: run.id, sourceId: "steam", subjectKey: `steam:reviews:${appId}:${lang}`,
        endpoint: "steam-reviews", url, params: { action, appId, language: lang, limit: max },
        payload: { count: reviews.length }, collector: "uni-steam", collectorVersion: "1",
      });
      finishRun(run, { status: reviews.length ? "completed" : "partial", yielded: reviews.length });
      return res.json({ reviews, count: reviews.length });
    }

    return res.status(400).json({ error: `unknown action: ${action} (use search|reviews)` });
  } catch (err) {
    console.error("uni-steam error:", err);
    if (run) {
      finishRun(run, { status: "failed", errors: [{ endpoint: "steam", message: String((err as Error)?.message || err) }] });
    }
    return res.status(500).json({ error: String((err as Error)?.message || err) });
  }
};
