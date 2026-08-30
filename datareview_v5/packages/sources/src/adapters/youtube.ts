/**
 * YouTube (SourcePort nativo) — scraping sem API key.
 *
 *   action "videos" (padrão): GET /results → ytInitialData → videoRenderer
 *   action "comments": GET /watch?v= → continuation → POST youtubei/v1/next
 *
 * Ordem via engine: relevance | date | views | rating (protobuf sp).
 * Erros honestos quando o cookie consent bloqueia ou estrutura muda.
 */
import type { CollectOptions, NormalizedItem } from "@v5/contracts";
import { cap, defineAdapter, item, str } from "./base.js";
import { asArray, asRecord, fetchJson, fetchText } from "./http.js";

const ORDER_SP: Record<string, string> = {
  relevance: "",
  date: "CAISAhAB",
  views: "CAMSAhAB",
  rating: "CAESAhAB",
};

function ytInitialData(html: string): Record<string, unknown> {
  const m = html.match(/ytInitialData\s*=\s*(\{.*?\})\s*;\s*<\/script>/s);
  if (!m) throw new Error("ytInitialData não encontrado (YouTube pode ter mudado o markup ou bloqueado o acesso)");
  return asRecord(JSON.parse(m[1]!) as unknown);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function collectRenderers<T>(blob: unknown, key: string, out: T[] = []): T[] {
  if (Array.isArray(blob)) {
    for (const b of blob) collectRenderers(b, key, out);
    return out;
  }
  if (typeof blob !== "object" || blob === null) return out;
  const r = blob as Record<string, unknown>;
  const hit = r[key];
  if (hit && typeof hit === "object") out.push(hit as T);
  for (const v of Object.values(r)) collectRenderers(v, key, out);
  return out;
}

interface VideoRaw {
  videoId?: string;
  title?: string;
  channel?: string;
  published?: string;
  views?: string;
  duration?: string;
}

function parsePtViews(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const m = /([\d.,]+)\s*(mil|mi|bi|m)?\b/i.exec(v.replace(/\s+/g, " "));
  if (!m) return undefined;
  const digits = (m[1] ?? "").replace(/\.(?=\d{3}(\.|$))/g, "").replace(/,/g, ".");
  const n = Number(digits);
  const unit = (m[2] ?? "").toLowerCase();
  const mult = unit === "mil" ? 1_000 : unit === "mi" || unit === "m" ? 1_000_000 : unit === "bi" ? 1_000_000_000 : 1;
  return Number.isFinite(n) ? Math.round(n * mult) : undefined;
}

export const youtube = defineAdapter(
  {
    id: "youtube",
    label: "YouTube",
    kind: "video",
    description: "Busca de vídeos (engine = ordem: relevance|date|views|rating; action comments em engine).",
    capabilities: ["media", "social"],
    rateLimit: { rps: 2, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      const action = options.engine?.trim() === "comments" ? "comments" : "videos";
      if (action === "comments") return fetchComments(options);
      const q = options.query.trim();
      if (!q) throw new Error("query de busca vazia");
      const order = ORDER_SP[options.engine?.trim() ?? ""] ?? ORDER_SP.relevance!;
      const sp = order ? `&sp=${order}` : "";
      const html = await fetchText(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&hl=pt-BR&gl=BR${sp}`, {
        signal: options.signal,
        timeoutMs: 20000,
      });
      const root = ytInitialData(html);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const renders = collectRenderers<any>(root, "videoRenderer")
        .map((vr: Loose): VideoRaw => {
          return {
            videoId: str(vr.videoId) || undefined,
            title: runsText(vr.title) || undefined,
            channel: runsText(vr.ownerText) || undefined,
            published: strTime(vr.publishedTimeText),
            views: strTime(vr.viewCountText),
            duration: strTime(vr.lengthText),
          };
        })
        .filter((v: VideoRaw) => v.videoId && v.title);
      if (renders.length === 0) throw new Error("nenhum vídeo no resultado (consent/anti-bot?)");
      return { videos: renders };
    },
    map(data: unknown, options: CollectOptions): NormalizedItem[] {
      return asArray(asRecord(data).videos)
        .slice(0, cap(options.limit ?? 25, 50))
        .map((raw) => {
          const v = asRecord(raw);
          const title = str(v.title);
          const views = parsePtViews(str(v.views));
          return item(
            {
              id: `youtube:${str(v.videoId)}`,
              title: title || "Vídeo sem título",
              author: str(v.channel) || undefined,
              text: `${str(v.views) || "?"} views · ${str(v.duration) || "?"} · ${str(v.published) || "?"}`.replace(/ · \? · \?/, "") || undefined,
              url: str(v.videoId) ? `https://www.youtube.com/watch?v=${str(v.videoId)}` : undefined,
              score: views,
              meta: { videoId: str(v.videoId), views, duration: str(v.duration), published: str(v.published) },
            },
            "youtube",
            "video",
          );
        });
    },
  },
);

type Loose = Record<string, unknown>;

function runsText(v: unknown): string {
  const r = asRecord(v);
  return asArray(r.runs)
    .map((t) => (typeof t === "string" ? t : str(asRecord(t).text)))
    .join("");
}

function strTime(v: unknown): string {
  if (typeof v === "string") return v;
  const r = asRecord(v);
  return str(r.simpleText) || runsText(v);
}

/* --------------------------------------------------------------- comments - */

interface CommentRaw {
  author?: string;
  text?: string;
  votes?: string;
  published?: string;
}

async function fetchComments(options: CollectOptions): Promise<{ comments: CommentRaw[] }> {
  const raw = options.query.trim();
  const videoId =
    raw.match(/^[A-Za-z0-9_-]{11}$/)?.[0] ??
    raw.match(/[?&]v=([A-Za-z0-9_-]+)/)?.[1] ??
    raw.match(/\/([A-Za-z0-9_-]{11})$/)?.[1];
  if (!videoId) throw new Error("query deve ser a URL/id do vídeo (action comments)");
  const html = await fetchText(`https://www.youtube.com/watch?v=${videoId}&hl=pt-BR`, { signal: options.signal, timeoutMs: 20000 });
  const key = html.match(/"INNERTUBE_API_KEY"\s*:\s*"([^"]+)"/)?.[1] ?? html.match(/INNERTUBE_API_KEY[^"]*"([^"]+)"/)?.[1];
  if (!key) throw new Error("INNERTUBE_API_KEY não encontrada na página");
  const root = ytInitialData(html);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tokens = collectRenderers<any>(root, "continuationCommand")
    .map((c: Loose) => (typeof c.token === "string" ? c.token : str(asRecord(c.token).continuation)))
    .filter(Boolean);
  if (tokens.length === 0) throw new Error("sem token de continuação para comentários (desativados?)");
  const body = {
    context: { client: { clientName: "WEB", clientVersion: "2.20240801.00.00", hl: "pt-BR", gl: "BR" } },
    continuation: "",
  };
  const url = `https://www.youtube.com/youtubei/v1/next?key=${encodeURIComponent(key)}`;
  let merged: CommentRaw[] = [];
  for (const token of tokens.slice(0, 4)) {
    if (options.signal?.aborted) break;
    const data = asRecord(
      await fetchJson(url, {
        signal: options.signal,
        timeoutMs: 15000,
        method: "POST",
        body: JSON.stringify({ ...body, continuation: token }),
        headers: { "Content-Type": "application/json", Origin: "https://www.youtube.com", Referer: `https://www.youtube.com/watch?v=${videoId}` },
      }),
    );
    merged = extractComments(data);
    if (merged.length > 0) break;
  }
  if (merged.length === 0) throw new Error("nenhum comentário encontrado (estrutura nova não reconhecida)");
  return { comments: merged };
}

function extractComments(data: unknown): CommentRaw[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const comments = collectRenderers<any>(data, "commentRenderer")
    .map((c: Loose): CommentRaw => ({
      author: str(asRecord(c.authorText).simpleText) || runsText(c.authorText) || undefined,
      text: runsText(c.contentText),
      votes: strTime(c.voteCount),
      published: strTime(c.publishedTimeText),
    }))
    .filter((c: CommentRaw) => (c.text ?? "").length > 0);
  if (comments.length > 0) return comments;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return collectRenderers<any>(data, "commentViewModel")
    .map((c: Loose) => (c.commentViewModel && typeof c.commentViewModel === "object" ? (c.commentViewModel as Loose) : c))
    .map((c: Loose): CommentRaw => ({
      author: runsText(c.authorText) || str(asRecord(c.authorText).channel) || str(asRecord(c.author).viewerName) || undefined,
      text: runsText(c.commentContent) || runsText(c.contentText) || str(asRecord(c.contentText).content) || str(asRecord(c.commentContent).content),
      votes: runsText(c.voteCount) || str(asRecord(c.voteCount).simpleText) || undefined,
      published: runsText(c.publishedTimeText) || strTime(c.publishedTimeText) || undefined,
    }))
    .filter((c: CommentRaw) => (c.text ?? "").length > 0);
}