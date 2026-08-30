import type { RequestHandler } from "express";
// Camada RAW/provenance (aditivo): helper failure-safe, nunca muda a resposta.
import { startRun, finishRun, saveRawArtifact, type CollectionRun } from "../lib/rawStore.js";
import { withObservation } from "../lib/auditObservation.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Conector Hacker News — API Algolia oficial, pública, sem auth, sem
 * rate-limit agressivo. Referência: docs/_uni.py (buscar_hn).
 *
 * Ações:
 *  - search:   { query, sort?: "relevance"|"date", limit? }
 *      https://hn.algolia.com/api/v1/search[_by_date]?query=..&tags=story
 *  - comments: { storyId, limit? }
 *      https://hn.algolia.com/api/v1/items/{storyId} → árvore achatada.
 */
const HN_SEARCH = "https://hn.algolia.com/api/v1/search";
const HN_SEARCH_DATE = "https://hn.algolia.com/api/v1/search_by_date";
const HN_ITEM = "https://hn.algolia.com/api/v1/items";
const UA = "AppDataReview/1.0 (research)";

interface HnHit {
  objectID: string;
  title?: string;
  url?: string;
  author?: string;
  points?: number;
  num_comments?: number;
  created_at?: string;
  story_text?: string;
}

interface HnNode {
  id: number;
  author?: string;
  text?: string;
  points?: number;
  created_at?: string;
  children?: HnNode[];
}

function stripHtml(html: string): string {
  return html
    .replace(/<a[^>]*href="([^"]+)"[^>]*>[^<]*<\/a>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/\s+/g, " ")
    .trim();
}

async function getJson(url: string): Promise<unknown> {
  const resp = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`Hacker News retornou ${resp.status}`);
  return resp.json();
}

/** Achata a árvore de comentários (DFS) até o limite. */
function flattenComments(node: HnNode, out: HnNode[], limit: number, depth = 0): void {
  if (out.length >= limit) return;
  if (node.author && node.text) {
    out.push({ ...node, points: node.points ?? undefined });
  }
  for (const child of node.children ?? []) {
    if (out.length >= limit) break;
    flattenComments(child, out, limit, depth + 1);
  }
}

export const uniHn: RequestHandler = async (req, res) => {
  res.set(corsHeaders);
  let run: CollectionRun | null = null;
  try {
    const { action } = req.body ?? {};

    if (action === "search") {
      const { query, sort = "relevance", limit } = req.body ?? {};
      if (!query || typeof query !== "string") return res.status(400).json({ error: "query required" });
      const max = Math.max(1, Math.min(Number(limit) || 20, 100));
      const mode = sort === "date" ? "date" : "relevance";
      run = startRun({
        sourceId: "hackernews",
        subjectKey: `hackernews:${query}:${mode}`,
        collector: "uni-hn",
        collectorVersion: "1",
        params: { action, query, sort: mode, limit: max },
      });
      const base = mode === "date" ? HN_SEARCH_DATE : HN_SEARCH;
      const url = `${base}?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=${max}`;
      const data = await withObservation(
        run.id, "hackernews", "hn-search", url,
        { action, query, sort: mode, limit: max },
        () => getJson(url) as Promise<{ hits?: HnHit[] }>,
      );
      const hits = data.hits ?? [];
      const stories = hits.map((h) => ({
        id: h.objectID,
        title: h.title ?? "(sem título)",
        url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
        author: h.author ?? "",
        points: h.points ?? 0,
        numComments: h.num_comments ?? 0,
        text: h.story_text ? stripHtml(h.story_text) : "",
        createdAt: h.created_at ?? "",
      }));
      saveRawArtifact({
        runId: run.id, sourceId: "hackernews", subjectKey: `hackernews:${query}:${mode}`,
        endpoint: "hn-search", url, params: { action, query, sort: mode, limit: max },
        payload: { count: stories.length }, collector: "uni-hn", collectorVersion: "1",
      });
      finishRun(run, { status: stories.length ? "completed" : "partial", yielded: stories.length });
      return res.json({ stories, count: stories.length });
    }

    if (action === "comments") {
      const { storyId, limit } = req.body ?? {};
      if (!storyId) return res.status(400).json({ error: "storyId required" });
      const max = Math.max(1, Math.min(Number(limit) || 20, 100));
      run = startRun({
        sourceId: "hackernews",
        subjectKey: `hackernews:comments:${storyId}`,
        collector: "uni-hn",
        collectorVersion: "1",
        params: { action, storyId, limit: max },
      });
      const url = `${HN_ITEM}/${encodeURIComponent(String(storyId))}`;
      const data = (await getJson(url)) as HnNode;
      const flat: HnNode[] = [];
      for (const child of data.children ?? []) {
        if (flat.length >= max) break;
        flattenComments(child, flat, max);
      }
      const comments = flat.map((c) => ({
        id: String(c.id),
        author: c.author ?? "",
        text: stripHtml(c.text ?? ""),
        createdAt: c.created_at ?? "",
      }));
      saveRawArtifact({
        runId: run.id, sourceId: "hackernews", subjectKey: `hackernews:comments:${storyId}`,
        endpoint: "hn-comments", url, params: { action, storyId, limit: max },
        payload: { count: comments.length }, collector: "uni-hn", collectorVersion: "1",
      });
      finishRun(run, { status: comments.length ? "completed" : "partial", yielded: comments.length });
      return res.json({ storyTitle: data.text ? stripHtml(data.text) : undefined, comments, count: comments.length });
    }

    return res.status(400).json({ error: `unknown action: ${action} (use search|comments)` });
  } catch (err) {
    console.error("uni-hn error:", err);
    if (run) {
      finishRun(run, { status: "failed", errors: [{ endpoint: "hn", message: String((err as Error)?.message || err) }] });
    }
    return res.status(500).json({ error: String((err as Error)?.message || err) });
  }
};
