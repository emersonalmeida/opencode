import type { RequestHandler } from "express";
// Camada RAW/provenance (aditivo): helper failure-safe, nunca muda a resposta.
import { startRun, finishRun, saveRawArtifact, type CollectionRun } from "../lib/rawStore.js";
import { withObservation } from "../lib/auditObservation.js";
import { parseFeed } from "../lib/webExtract.js";
import { getCached, setCached } from "../lib/routeCache.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Conector Product Hunt — lançamentos de produtos (posts).
 *
 * Dois caminhos honestos:
 *  1. Feed Atom público (SEM auth): https://www.producthunt.com/feed
 *     (opcional ?category=<slug> por tópico). Ranking = ordem do feed.
 *     Campos: título, tagline (summary), link, data — SEM votos/comentários.
 *  2. GraphQL oficial v2 (COM token): api.producthunt.com/v2/api/graphql com
 *     Bearer PRODUCT_HUNT_TOKEN (env do servidor) — posts com votesCount,
 *     commentsCount, topics e paginação por cursor.
 *
 * Ações:
 *  - posts:   { topic?, limit? }              — feed Atom público (default)
 *  - graphql: { first?, order? }              — API oficial (exige token no env)
 */

const FEED_URL = "https://www.producthunt.com/feed";
const GRAPHQL_URL = "https://api.producthunt.com/v2/api/graphql";
const UA = "Mozilla/5.0 (compatible; AppDataReview/1.0; +https://appdatareview.local)";
const FEED_TTL = 30 * 60 * 1000; // feed atualiza ~de hora em hora

interface PhPost {
  id: string;
  name: string;
  tagline: string;
  url: string;
  date: string;
  rank: number;
  votesCount?: number;
  commentsCount?: number;
  topics?: string[];
}

async function fetchFeed(topic: string, limit: number): Promise<PhPost[]> {
  const url = topic ? `${FEED_URL}?category=${encodeURIComponent(topic)}` : FEED_URL;
  const resp = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/atom+xml,application/xml,text/xml,*/*" },
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`producthunt feed http ${resp.status}`);
  const items = parseFeed(await resp.text(), limit);
  return items.map((it, i) => ({
    id: it.url || `ph-${i}`,
    name: it.title,
    // O summary do feed termina com os links "Discussion | Link" — corta.
    tagline: it.text.replace(/\s*Discussion\s*\|.*$/i, "").trim(),
    url: it.url,
    date: it.date,
    rank: i + 1, // a ordem do feed É o ranking do dia
  }));
}

const POSTS_QUERY = `query ($first: Int!, $order: PostsOrder) {
  posts(first: $first, order: $order) {
    edges { node { id name tagline url createdAt votesCount commentsCount
      topics { edges { node { name } } } } }
  }
}`;
const COMMENTS_QUERY = `query ($id: ID!, $first: Int!) {
  post(id: $id) { comments(first: $first) { edges { node { id body user { name } createdAt votesCount } } } }
}`;

interface PhComment {
  id: string;
  body: string;
  user?: string;
  createdAt?: string;
}

async function fetchComments(postId: string, first: number): Promise<PhComment[]> {
  const token = process.env.PRODUCT_HUNT_TOKEN;
  if (!token) throw new Error("Exige PRODUCT_HUNT_TOKEN");
  const resp = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query: COMMENTS_QUERY, variables: { id: postId, first } }),
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`comments http ${resp.status}`);
  const data = (await resp.json()) as {
    data?: { post?: { comments?: { edges?: { node?: { id?: string; body?: string; user?: { name?: string }; createdAt?: string } }[] } } };
  };
  const edges = data.data?.post?.comments?.edges ?? [];
  return edges.map((e) => ({
    id: String(e.node?.id ?? ""),
    body: String(e.node?.body ?? ""),
    user: e.node?.user?.name,
    createdAt: e.node?.createdAt,
  }));
}

async function fetchGraphql(first: number, order: string): Promise<PhPost[]> {
  const token = process.env.PRODUCT_HUNT_TOKEN;
  if (!token) {
    throw new Error(
      "GraphQL do Product Hunt exige PRODUCT_HUNT_TOKEN no env do servidor (developer token em api.producthunt.com/v2/oauth/applications). O feed público (ação posts) funciona sem token.",
    );
  }
  const resp = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "User-Agent": UA,
    },
    body: JSON.stringify({ query: POSTS_QUERY, variables: { first, order } }),
    signal: AbortSignal.timeout(20000),
  });
  if (!resp.ok) throw new Error(`producthunt graphql http ${resp.status}`);
  const data = (await resp.json()) as {
    data?: { posts?: { edges?: { node?: Record<string, unknown> }[] } };
    errors?: { message?: string }[];
  };
  if (data.errors?.length) throw new Error(`graphql: ${data.errors[0]?.message ?? "erro"}`);
  const edges = data.data?.posts?.edges ?? [];
  return edges
    .map((e, i): PhPost | null => {
      const n = e.node;
      if (!n || typeof n.name !== "string") return null;
      const topics = (n.topics as { edges?: { node?: { name?: string } }[] } | undefined)?.edges
        ?.map((t) => t.node?.name)
        .filter((x): x is string => Boolean(x));
      return {
        id: String(n.id ?? `ph-${i}`),
        name: n.name,
        tagline: String(n.tagline ?? ""),
        url: String(n.url ?? ""),
        date: String(n.createdAt ?? ""),
        rank: i + 1,
        votesCount: Number(n.votesCount ?? 0),
        commentsCount: Number(n.commentsCount ?? 0),
        topics,
      };
    })
    .filter((p): p is PhPost => p !== null);
}

export const uniProductHunt: RequestHandler = async (req, res) => {
  res.set(corsHeaders);
  let run: CollectionRun | null = null;
  try {
    const { action = "posts", topic = "", limit, first, order } = req.body ?? {};
    const max = Math.max(1, Math.min(Number(limit ?? first) || 20, 100));
    const gqlOrder = ["VOTES", "NEWEST", "FEATURED", "RANKING"].includes(String(order))
      ? String(order)
      : "RANKING";

    run = startRun({
      sourceId: "producthunt",
      subjectKey: `producthunt:${action}:${topic || "geral"}`,
      collector: "uni-producthunt",
      collectorVersion: "1",
      params: { action, topic, limit: max, order: gqlOrder },
    });

    if (action === "graphql") {
      const posts = await withObservation(
        run.id, "producthunt", "ph-graphql", GRAPHQL_URL,
        { first: max, order: gqlOrder },
        () => fetchGraphql(max, gqlOrder),
      );
      // Se comments=true, enriquece os posts com comentários (1 request
      // extra por post, limitada a max posts).
      const withComments = req.body?.comments === true;
      if (withComments && posts.length) {
        const count = Math.min(posts.length, max);
        for (let i = 0; i < count; i++) {
          try {
            (posts[i] as PhPost & { comments?: PhComment[] }).comments = await fetchComments(posts[i].id, 5);
          } catch {
            // comentários falham → post sem comments (best-effort)
          }
        }
      }
      saveRawArtifact({
        runId: run.id, sourceId: "producthunt", subjectKey: run.subjectKey,
        endpoint: "ph-graphql", url: GRAPHQL_URL, params: { first: max, order: gqlOrder },
        payload: { count: posts.length }, collector: "uni-producthunt", collectorVersion: "1",
      });
      finishRun(run, { status: posts.length ? "completed" : "partial", yielded: posts.length });
      return res.json({ kind: "producthunt", via: "graphql", posts, count: posts.length });
    }

    // ação default: posts via feed Atom público (cache 30min)
    const cacheParams = { action, topic, limit: max };
    const cached = getCached("uni-producthunt", cacheParams) as Record<string, unknown> | undefined;
    if (cached) {
      finishRun(run, { status: "completed", yielded: Number(cached.count) || 0 });
      return res.json({ ...cached, cached: true });
    }
    const posts = await withObservation(
      run.id, "producthunt", "ph-feed",
      topic ? `${FEED_URL}?category=${topic}` : FEED_URL,
      { action, topic, limit: max },
      () => fetchFeed(String(topic).trim(), max),
    );
    saveRawArtifact({
      runId: run.id, sourceId: "producthunt", subjectKey: run.subjectKey,
      endpoint: "ph-feed", url: topic ? `${FEED_URL}?category=${topic}` : FEED_URL,
      params: { topic, limit: max },
      payload: { count: posts.length }, collector: "uni-producthunt", collectorVersion: "1",
    });
    finishRun(run, { status: posts.length ? "completed" : "partial", yielded: posts.length });
    const payload = { kind: "producthunt", via: "feed", posts, count: posts.length };
    if (posts.length) setCached("uni-producthunt", cacheParams, payload, FEED_TTL);
    return res.json(payload);
  } catch (err) {
    if (run) finishRun(run, { status: "failed", errors: [{ endpoint: "producthunt", message: String((err as Error)?.message || err) }] });
    return res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
};
