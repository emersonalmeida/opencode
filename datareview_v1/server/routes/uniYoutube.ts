import type { RequestHandler } from "express";
// Camada RAW/provenance (aditivo): helper failure-safe, nunca muda a resposta.
import { startRun, finishRun, saveRawArtifact, type CollectionRun } from "../lib/rawStore.js";
import { withObservation } from "../lib/auditObservation.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Conector YouTube — referência: docs/_uni.py (buscar_videos/buscar_comentarios
 * com fallback de scraping quando a API key não está configurada).
 *
 * Sem YOUTUBE_API_KEY: scraping público (equivalente a youtube-search-python +
 * youtube-comment-downloader):
 *  - vídeos: GET /results?search_query=... → ytInitialData (videoRenderer).
 *  - comentários: GET /watch?v=... → ytInitialData (token de continuação) →
 *    POST /youtubei/v1/next?key=INNERTUBE_API_KEY (paginação por continuação).
 *
 * Ações:
 *  - videos:   { query, region?, lang?, order?, limit? }
 *  - comments: { videoId, limit? }  (ordenação = top comentários, default YT)
 */

export interface YtVideo {
  videoId: string;
  title: string;
  channel: string;
  published?: string;
  views?: string;
  duration?: string;
  link: string;
  thumb?: string;
}

export interface YtComment {
  author: string;
  text: string;
  likes: number;
  published?: string;
}

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

/** Ordem → parâmetro `sp` do YouTube (filtros protobuf documentados). */
const ORDER_SP: Record<string, string> = {
  relevance: "",
  date: "CAISAhAB",
  views: "CAMSAhAB",
  rating: "CAESAhAB",
};

/** Filtros de busca por `sp` (upload/date/duration/live etc.). */
interface SpFilters {
  upload?: "hour" | "today" | "week" | "month" | "year";
  duration?: "short" | "medium" | "long";
  type?: "video" | "channel" | "playlist" | "live";
  // Features contém opções booleanas (ex.: 4K, legendas, HD).
  features?: Record<string, true | false>;
}

/** Constrói o valor sp do YouTube a partir dos filtros declarados. */
function buildSp(filters: SpFilters | undefined): string | undefined {
  if (!filters) return undefined;
  // Protobuf é bitfield com offsets fixos (briefing documentado); por
  // simplicidade usamos um mapeamento conservado por significância.
  const map: Record<string, string> = {
    // upload
    hour: "CAcSBBAB",
    today: "CAQSBhAB",
    week: "CAUSBhAB",
    month: "CAYSBhAB",
    year: "CAcSBhCB",
    // duration
    short: "CAYSBxAB",
    medium: "CAYSBxAB",
    long: "CAYSBxAB",
    // type
    video: "CAISAhAB",
    channel: "CAISAhAB",
    playlist: "CAISAhAB",
    live: "CAISAhAB",
  };
  if (filters.upload && map[filters.upload]) return map[filters.upload];
  if (filters.type && map[filters.type]) return map[filters.type];
  if (filters.duration && map[filters.duration]) return map[filters.duration];
  return undefined;
}

async function fetchHtml(url: string): Promise<string> {
  const resp = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8" },
    signal: AbortSignal.timeout(20000),
  });
  if (!resp.ok) throw new Error(`youtube http ${resp.status}`);
  return resp.text();
}

/** Extrai o objeto ytInitialData embutido na página. */
function extractInitialData(html: string): Record<string, unknown> | null {
  const m = html.match(/ytInitialData\s*=\s*(\{.+?\})\s*;\s*<\/script>/s)
    ?? html.match(/var ytInitialData\s*=\s*(\{.+?\});/s);
  if (!m) return null;
  try {
    return JSON.parse(m[1]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractApiKey(html: string): string | null {
  return html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1] ?? null;
}

function extractClientVersion(html: string): string {
  return html.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/)?.[1] ?? "2.20240101.00.00";
}

/** Busca recursiva pelo primeiro nó com a chave dada. */
function findKey(node: unknown, key: string): unknown {
  if (!node || typeof node !== "object") return undefined;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findKey(item, key);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  const rec = node as Record<string, unknown>;
  if (key in rec) return rec[key];
  for (const value of Object.values(rec)) {
    const found = findKey(value, key);
    if (found !== undefined) return found;
  }
  return undefined;
}

/** Caminha por todos os nós com a chave dada (coleta múltipla). */
function collectKey(node: unknown, key: string, out: unknown[]): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) collectKey(item, key, out);
    return;
  }
  const rec = node as Record<string, unknown>;
  if (key in rec) out.push(rec[key]);
  for (const value of Object.values(rec)) collectKey(value, key, out);
}

function runsText(runs: unknown): string {
  if (!Array.isArray(runs)) return "";
  return runs.map((r) => (r as { text?: string })?.text ?? "").join("").trim();
}

function simpleText(node: unknown): string {
  const rec = node as { simpleText?: string; runs?: unknown } | undefined;
  return rec?.simpleText ?? runsText(rec?.runs) ?? "";
}

function parseVideos(initial: Record<string, unknown>, limit: number): YtVideo[] {
  const renderers: unknown[] = [];
  collectKey(initial, "videoRenderer", renderers);
  const seen = new Set<string>();
  const videos: YtVideo[] = [];
  for (const raw of renderers) {
    const v = raw as Record<string, unknown>;
    const videoId = String(v.videoId ?? "");
    if (!videoId || seen.has(videoId)) continue;
    seen.add(videoId);
    const thumbs = (v.thumbnail as { thumbnails?: { url?: string }[] })?.thumbnails;
    videos.push({
      videoId,
      title: simpleText(v.title),
      channel: simpleText(v.ownerText) || simpleText(v.shortBylineText),
      published: simpleText(v.publishedTimeText) || undefined,
      views: simpleText(v.viewCountText) || undefined,
      duration: simpleText(v.lengthText) || undefined,
      link: `https://www.youtube.com/watch?v=${videoId}`,
      thumb: thumbs?.[thumbs.length - 1]?.url,
    });
    if (videos.length >= limit) break;
  }
  return videos;
}

interface YtPage {
  comments: YtComment[];
  continuation?: string;
}

/**
 * YouTube migrou comentários para o schema commentViewModel: a página de
 * continuação traz view models com chaves e os dados reais vêm em
 * frameworkUpdates.entityBatchUpdate.mutations[].payload.commentEntityPayload.
 * Mantemos fallback para o schema legado (commentRenderer).
 */
function parseCommentPage(data: unknown): YtPage {
  const rec = data as Record<string, unknown> | null;
  const comments: YtComment[] = [];

  // Schema novo (entities).
  const mutations = ((rec?.frameworkUpdates as { entityBatchUpdate?: { mutations?: unknown[] } })
    ?.entityBatchUpdate?.mutations ?? []) as { payload?: { commentEntityPayload?: unknown } }[];
  for (const mut of mutations) {
    const ce = mut?.payload?.commentEntityPayload as {
      properties?: { commentId?: string; content?: { content?: string }; publishedTime?: string };
      author?: { displayName?: string };
      toolbar?: { likeCountNotliked?: string; likeCountLiked?: string };
    } | undefined;
    const text = ce?.properties?.content?.content?.trim();
    if (!ce || !text) continue;
    comments.push({
      author: ce.author?.displayName ?? "?",
      text,
      likes: Number(ce.toolbar?.likeCountNotliked ?? ce.toolbar?.likeCountLiked ?? 0) || 0,
      published: ce.properties?.publishedTime,
    });
  }

  // Schema legado (commentRenderer) — só se o novo não veio.
  if (!comments.length) {
    const threads: unknown[] = [];
    collectKey(data, "commentRenderer", threads);
    for (const raw of threads) {
      const c = raw as Record<string, unknown>;
      const text = runsText((c.contentText as { runs?: unknown })?.runs);
      if (!text) continue;
      comments.push({
        author: simpleText(c.authorText),
        text,
        likes: Number(c.likeCount ?? c.voteCount ?? 0) || 0,
        published: runsText((c.publishedTimeText as { runs?: unknown })?.runs) || undefined,
      });
    }
  }

  // Próxima continuação: última da página (as primeiras são de replies).
  const tokens: string[] = [];
  const collectTokens = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach(collectTokens); return; }
    const r = node as Record<string, unknown>;
    const cmd = r.continuationCommand as { token?: string } | undefined;
    if (cmd?.token) tokens.push(cmd.token);
    Object.values(r).forEach(collectTokens);
  };
  collectTokens(rec?.onResponseReceivedEndpoints);
  return { comments, continuation: tokens[tokens.length - 1] };
}

export const uniYoutube: RequestHandler = async (req, res) => {
  res.set(corsHeaders);
  let run: CollectionRun | null = null;
  try {
    const { action, query, region = "BR", lang = "pt-BR", order = "relevance", limit } = req.body ?? {};
    const max = Math.max(1, Math.min(Number(limit) || 10, 100));

    if (action === "videos") {
      if (!query || typeof query !== "string") return res.status(400).json({ error: "query required" });
      run = startRun({
        sourceId: "youtube",
        subjectKey: `youtube:${query}`,
        collector: "uni-youtube",
        collectorVersion: "1",
        params: { action, query, region, lang, order, limit: max },
      });
      const sp = ORDER_SP[String(order)] ?? buildSp(req.body?.sp ?? undefined);
      const params = new URLSearchParams({ search_query: query, hl: String(lang), gl: String(region) });
      if (sp) params.set("sp", sp);
      const url = `https://www.youtube.com/results?${params.toString()}`;
      const html = await withObservation(
        run.id, "youtube", "youtube-search", url,
        { action, query, limit: max },
        () => fetchHtml(url),
      );
      const initial = extractInitialData(html);
      const videos = initial ? parseVideos(initial, max) : [];
      saveRawArtifact({
        runId: run.id,
        sourceId: "youtube",
        subjectKey: run.subjectKey,
        endpoint: "youtube-search",
        params: { action, query, region, lang, order, limit: max },
        payload: videos,
        collector: "uni-youtube",
        collectorVersion: "1",
      });
      finishRun(run, { status: videos.length ? "completed" : "partial", yielded: videos.length });
      return res.json({ action, query, videos, count: videos.length });
    }

    if (action === "comments") {
      const videoId = String(req.body?.videoId ?? "");
      if (!/^[\w-]{11}$/.test(videoId)) return res.status(400).json({ error: "videoId inválido (11 chars)" });
      run = startRun({
        sourceId: "youtube",
        subjectKey: `youtube:comments:${videoId}`,
        collector: "uni-youtube",
        collectorVersion: "1",
        params: { action, videoId, limit: max },
      });
      const html = await fetchHtml(`https://www.youtube.com/watch?v=${videoId}&hl=pt-BR`);
      const apiKey = extractApiKey(html);
      const clientVersion = extractClientVersion(html);
      const initial = extractInitialData(html);
      // Todos os tokens da watch page — a seção de comentários pode não ser a
      // 1ª (também há continuações de vídeos relacionados).
      const initialTokens: string[] = [];
      collectKey(initial, "continuationCommand", initialTokens);
      const tokens = initialTokens
        .map((t) => (t as { token?: string })?.token)
        .filter((t): t is string => !!t);
      if (!apiKey || !tokens.length) {
        finishRun(run, { status: "partial", yielded: 0 });
        return res.json({ action, videoId, comments: [], count: 0, note: "comentários indisponíveis (desativados ou página sem seção de comentários)" });
      }

      const postNext = async (continuation: string): Promise<YtPage> => {
        const resp = await fetch(`https://www.youtube.com/youtubei/v1/next?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "User-Agent": UA },
          body: JSON.stringify({
            context: { client: { clientName: "WEB", clientVersion, hl: "pt-BR", gl: "BR" } },
            continuation,
          }),
          signal: AbortSignal.timeout(20000),
        });
        if (!resp.ok) return { comments: [] };
        return parseCommentPage(await resp.json());
      };

      const comments: YtComment[] = [];
      const seen = new Set<string>();
      let pages = 0;
      let started = false;
      for (const token of tokens.slice(0, 6)) {
        // Tenta cada token até achar a seção de comentários.
        const first = await postNext(token);
        if (!first.comments.length) continue;
        started = true;
        let page: YtPage = first;
        while (page.comments.length || page.continuation) {
          pages++;
          for (const c of page.comments) {
            const k = `${c.author}|${c.text.slice(0, 40)}`;
            if (!seen.has(k)) { seen.add(k); comments.push(c); }
          }
          if (!page.continuation || comments.length >= max || pages >= 10) break;
          page = await postNext(page.continuation);
          if (!page.comments.length) break;
        }
        break;
      }
      if (!started) {
        finishRun(run, { status: "partial", yielded: 0 });
        return res.json({ action, videoId, comments: [], count: 0, note: "seção de comentários não encontrada (desativados?)" });
      }
      const sliced = comments.slice(0, max);
      saveRawArtifact({
        runId: run.id,
        sourceId: "youtube",
        subjectKey: run.subjectKey,
        endpoint: "youtube-comments",
        params: { action, videoId, limit: max, pages },
        payload: sliced,
        collector: "uni-youtube",
        collectorVersion: "1",
      });
      finishRun(run, { status: sliced.length ? "completed" : "partial", yielded: sliced.length });
      return res.json({ action, videoId, comments: sliced, count: sliced.length });
    }

    return res.status(400).json({ error: `unknown action: ${action} (use videos|comments)` });
  } catch (err) {
    console.error("uni-youtube connector error:", err);
    if (run) {
      finishRun(run, { status: "failed", errors: [{ endpoint: "uni-youtube", message: String((err as Error)?.message || err) }] });
    }
    return res.status(500).json({ error: String((err as Error)?.message || err) });
  }
};
