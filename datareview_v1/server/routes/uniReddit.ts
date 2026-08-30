import type { RequestHandler } from "express";
// Camada RAW/provenance (aditivo): helper failure-safe, nunca muda a resposta.
import { startRun, finishRun, saveRawArtifact, type CollectionRun } from "../lib/rawStore.js";
import { withObservation } from "../lib/auditObservation.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Conector Reddit — referência: docs/_uni.py (buscar_posts com PRAW).
 *
 * Dois caminhos (prioridade: OAuth quando configurado):
 *  1. OAuth client_credentials (script app): REDDIT_CLIENT_ID +
 *     REDDIT_CLIENT_SECRET no env do servidor → oauth.reddit.com (funciona de
 *     datacenter, rate-limit estável 100 req/min).
 *  2. JSON público: www.reddit.com/*.json — sem auth, mas o Reddit bloqueia
 *     IPs de datacenter (403); de IPs residenciais funciona. Endpoints genéricos
 *     (subreddit listing, comments, detalhes de usuário, preferências com OAuth).
 *
 * Ações:
 *  - posts:    { query, subreddit?, sort? (hot|new|top), limit? }
 *  - comments: { postId, subreddit?, limit? } (top comentários de um post)
 */

export interface RedditPost {
  id: string;
  title: string;
  author: string;
  score: number;
  upvoteRatio?: number;
  url: string;
  permalink: string;
  subreddit: string;
  numComments: number;
  selftext?: string;
  createdAt: string;
}

export interface RedditComment {
  id: string;
  postId: string;
  author: string;
  body: string;
  score: number;
  createdAt: string;
}

const UA = "AppDataReview/1.0 (research; +local)";

// ---------- OAuth (client_credentials) ----------
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getOAuthToken(): Promise<string | null> {
  const id = process.env.REDDIT_CLIENT_ID;
  const secret = process.env.REDDIT_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;
  const resp = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": UA,
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) return null;
  const data = (await resp.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) return null;
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return cachedToken.token;
}

interface RedditChild<T> { kind: string; data: T }
interface RedditListing<T> { kind: string; data?: { children?: RedditChild<T>[] } }

interface RedditUser {
  name: string;
  linkKarma?: number;
  commentKarma?: number;
  created?: number;
}

async function fetchUserAbout(name: string): Promise<RedditUser | null> {
  const token = await getOAuthToken();
  if (!token) return null;
  const resp = await fetch(`https://oauth.reddit.com/u/${name}/about`, {
    headers: { Authorization: `Bearer ${token}`, "User-Agent": UA },
    signal: AbortSignal.timeout(10000),
  });
  if (!resp.ok) return null;
  return ((await resp.json()) as { data?: RedditUser })?.data ?? null;
}

interface RedditSubreddit {
  display_name: string;
  subscribers?: number;
  public_description?: string;
  title?: string;
}

async function fetchSubreddits(q = "", limit = 10): Promise<RedditSubreddit[]> {
  const useOAuth = !!process.env.REDDIT_CLIENT_ID && !!process.env.REDDIT_CLIENT_SECRET;
  const token = useOAuth ? await getOAuthToken() : null;
  const url = `https://www.reddit.com/subreddits/search.json?q=${encodeURIComponent(q)}&limit=${limit}&raw_json=1`;
  const headers: Record<string, string> = { "User-Agent": UA };
  if (token) headers.Authorization = `Bearer ${token}`;
  const targetUrl = token
    ? `https://oauth.reddit.com/subreddits/search?q=${encodeURIComponent(q)}&limit=${limit}&raw_json=1`
    : url;
  const resp = await fetch(targetUrl, { headers, signal: AbortSignal.timeout(15000) });
  if (!resp.ok) return [];
  const data = (await resp.json()) as RedditListing<{ display_name?: string; subscribers?: number; public_description?: string; title?: string }>;
  const children = data?.data?.children ?? [];
  return children.map((c) => ({
    display_name: c.data.display_name ?? "",
    subscribers: c.data.subscribers,
    public_description: c.data.public_description,
    title: c.data.title,
  }));
}

interface RawPost {
  id: string; title?: string; author?: string; score?: number;
  upvote_ratio?: number; url?: string; permalink?: string; subreddit?: string;
  num_comments?: number; selftext?: string; created_utc?: number;
}
interface RawComment {
  id: string; author?: string; body?: string; score?: number; created_utc?: number;
}

async function redditGet(path: string, params: Record<string, string>): Promise<unknown> {
  const token = await getOAuthToken();
  const base = token ? "https://oauth.reddit.com" : "https://www.reddit.com";
  const qs = new URLSearchParams({ raw_json: "1", ...params }).toString();
  const resp = await fetch(`${base}${path}.json?${qs}`, {
    headers: {
      "User-Agent": UA,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal: AbortSignal.timeout(20000),
  });
  if (resp.status === 403 && !token) {
    throw new Error(
      "Reddit bloqueou este IP (403). Configure REDDIT_CLIENT_ID/REDDIT_CLIENT_SECRET no servidor para usar OAuth, ou rode de uma rede residencial.",
    );
  }
  if (!resp.ok) throw new Error(`reddit http ${resp.status}`);
  return resp.json();
}

function mapPost(p: RawPost): RedditPost {
  return {
    id: p.id,
    title: p.title ?? "",
    author: p.author ?? "[deleted]",
    score: p.score ?? 0,
    upvoteRatio: p.upvote_ratio,
    url: p.url ?? "",
    permalink: `https://www.reddit.com${p.permalink ?? ""}`,
    subreddit: p.subreddit ?? "",
    numComments: p.num_comments ?? 0,
    selftext: p.selftext?.slice(0, 2000) || undefined,
    createdAt: p.created_utc ? new Date(p.created_utc * 1000).toISOString() : "",
  };
}

function mapComment(postId: string, c: RawComment): RedditComment {
  return {
    id: c.id,
    postId,
    author: c.author ?? "[deleted]",
    body: (c.body ?? "").slice(0, 2000),
    score: c.score ?? 0,
    createdAt: c.created_utc ? new Date(c.created_utc * 1000).toISOString() : "",
  };
}

export const uniReddit: RequestHandler = async (req, res) => {
  res.set(corsHeaders);
  let run: CollectionRun | null = null;
  try {
    const { action, query, subreddit = "all", sort = "top", limit } = req.body ?? {};
    const max = Math.max(1, Math.min(Number(limit) || 10, 100));
    const sortMode = ["hot", "new", "top", "relevance"].includes(String(sort)) ? String(sort) : "top";

    if (action === "posts") {
      if (!query || typeof query !== "string") return res.status(400).json({ error: "query required" });
      const sub = String(subreddit).replace(/[^\w]/g, "") || "all";
      run = startRun({
        sourceId: "reddit",
        subjectKey: `reddit:${sub}:${query}`,
        collector: "uni-reddit",
        collectorVersion: "1",
        params: { action, query, subreddit: sub, sort: sortMode, limit: max },
      });
      const path = sub === "all" ? "/search" : `/r/${sub}/search`;
      const data = await withObservation(
        run.id, "reddit", "reddit-search", undefined,
        { action, query, subreddit: sub, sort: sortMode, limit: max },
        () => redditGet(path, {
          q: query, sort: sortMode, limit: String(max), ...(sub === "all" ? {} : { restrict_sr: "1" }),
        }) as Promise<RedditListing<RawPost>>,
      );
      const posts = (data?.data?.children ?? [])
        .filter((c) => c.kind === "t3")
        .map((c) => mapPost(c.data));
      saveRawArtifact({
        runId: run.id,
        sourceId: "reddit",
        subjectKey: run.subjectKey,
        endpoint: "reddit-search",
        params: { action, query, subreddit: sub, sort: sortMode, limit: max },
        payload: posts,
        collector: "uni-reddit",
        collectorVersion: "1",
      });
      finishRun(run, { status: posts.length ? "completed" : "partial", yielded: posts.length });
      return res.json({ action, query, subreddit: sub, posts, count: posts.length });
    }

    if (action === "comments") {
      const postId = String(req.body?.postId ?? "").replace(/[^\w]/g, "");
      if (!postId) return res.status(400).json({ error: "postId required" });
      const sub = String(subreddit).replace(/[^\w]/g, "") || "all";
      run = startRun({
        sourceId: "reddit",
        subjectKey: `reddit:comments:${postId}`,
        collector: "uni-reddit",
        collectorVersion: "1",
        params: { action, postId, subreddit: sub, limit: max },
      });
      const path = sub === "all" ? `/comments/${postId}` : `/r/${sub}/comments/${postId}`;
      // Resposta: [listing do post, listing de comentários].
      const data = (await redditGet(path, { limit: String(max), depth: "1", sort: "top" })) as unknown[];
      const commentListing = Array.isArray(data) ? (data[1] as RedditListing<RawComment>) : null;
      const comments = (commentListing?.data?.children ?? [])
        .filter((c) => c.kind === "t1")
        .map((c) => mapComment(postId, c.data))
        .slice(0, max);
      saveRawArtifact({
        runId: run.id,
        sourceId: "reddit",
        subjectKey: run.subjectKey,
        endpoint: "reddit-comments",
        params: { action, postId, subreddit: sub, limit: max },
        payload: comments,
        collector: "uni-reddit",
        collectorVersion: "1",
      });
      finishRun(run, { status: comments.length ? "completed" : "partial", yielded: comments.length });
      return res.json({ action, postId, comments, count: comments.length });
    }

    if (action === "user-about") {
      const name = String(query ?? "");
      if (!name) return res.status(400).json({ error: "query (username) required" });
      const user = await fetchUserAbout(name);
      if (!user) return res.status(502).json({ error: "Exige REDDIT_CLIENT_ID/SECRET (OAuth)" });
      return res.json({ action, user });
    }

    if (action === "subreddits") {
      const max = Math.max(1, Math.min(Number(limit) || 10, 50));
      const subs = await fetchSubreddits(String(query || ""), max);
      return res.json({ action, query, subreddits: subs, count: subs.length });
    }

    return res.status(400).json({ error: `unknown action: ${action} (use posts|comments|user-about|subreddits)` });
  } catch (err) {
    console.error("uni-reddit connector error:", err);
    if (run) {
      finishRun(run, { status: "failed", errors: [{ endpoint: "uni-reddit", message: String((err as Error)?.message || err) }] });
    }
    return res.status(502).json({ error: String((err as Error)?.message || err) });
  }
};
