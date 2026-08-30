/**
 * Cliente das rotas Uni (/functions/v1/uni-*). Cada chamada retorna UniItem[]
 * normalizado + metadados da coleta — a página nunca vê o payload bruto da
 * fonte (que fica em `meta` de cada item).
 */
import { uniItemId, type UniItem, type UniItemKind, type UniSourceId } from "./types";
import { apiUrl } from "@/lib/apiBase";
import { buildAuthPayload } from "./sourceSecrets";

const SUPA_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export interface UniFetchResult {
  ok: boolean;
  items: UniItem[];
  /** Diagnósticos por engine/visão quando a fonte é multi-parte. */
  notes?: Record<string, unknown>;
  error?: string;
}

/** Sonda barata: o servidor local responde /health? Sem isso toda chamada
 *  às rotas falha com HTML do Vite ou "Failed to fetch" — a página de teste
 *  distingue "servidor offline" de "a fonte errou". */
export async function probeServer(signal?: AbortSignal): Promise<{ reachable: boolean; error?: string }> {
  try {
    const resp = await fetch(apiUrl("/health"), { signal: signal ?? AbortSignal.timeout(4000) });
    if (!resp.ok) return { reachable: false, error: `servidor respondeu ${resp.status}` };
    return { reachable: true };
  } catch (e) {
    return { reachable: false, error: e instanceof Error ? e.message : "Failed to fetch" };
  }
}

async function post(route: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<UniFetchResult> {
  try {
    const resp = await fetch(apiUrl(`/functions/v1/${route}`), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPA_KEY}` },
      body: JSON.stringify(body),
      signal,
    });
    const ct = resp.headers.get("content-type") ?? "";
    if (!ct.includes("json")) {
      // Vite dev/preview respondendo HTML (índice) — servidor local inacessível.
      const body2 = await resp.text().catch(() => "");
      const prefix = body2.slice(0, 40).replace(/\s+/g, " ").trim();
      return { ok: false, items: [], error: `servidor local inacessível (resposta não-JSON: "${prefix || ct || resp.status || "?"}")` };
    }
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return { ok: false, items: [], error: (data.error as string) || `Erro ${resp.status}` };
    }
    return { ok: true, items: [], ...data } as UniFetchResult;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return { ok: false, items: [], error: "cancelado" };
    }
    return { ok: false, items: [], error: e instanceof Error ? e.message : "Falha de conexão" };
  }
}

// ---------- Suggest ----------

export type SuggestVertical = "web" | "youtube" | "news" | "shopping";

export async function fetchSuggest(
  query: string,
  opts: { region?: string; lang?: string; vertical?: SuggestVertical; expand?: boolean; limit?: number },
  signal?: AbortSignal,
): Promise<UniFetchResult> {
  const vertical = opts.vertical ?? "web";
  const res = await post("uni-suggest", {
    action: opts.expand ? "expand" : "suggest",
    query,
    region: opts.region ?? "br",
    lang: opts.lang ?? "pt",
    vertical,
    limit: opts.limit ?? 10,
  }, signal);
  if (!res.ok) return res;
  const raw = res as unknown as { items?: { text: string; relevance: number; seed?: string }[] };
  const items: UniItem[] = (raw.items ?? []).map((s) => ({
    id: uniItemId("suggest", s.text),
    source: "suggest" as UniSourceId,
    kind: "suggestion",
    title: s.text,
    score: s.relevance,
    meta: { vertical, seed: s.seed, query },
  }));
  return { ok: true, items };
}

// ---------- Trends ----------

export interface TrendsData {
  timeline: { date: string; values: number[] }[];
  regions: { region: string; values: number[] }[];
  related: { text: string; value: number; kind: "top" | "rising" }[];
  errors: string[];
  terms: string[];
}

export async function fetchTrends(
  terms: string[],
  opts: { region?: string; lang?: string; timeframe?: string; gprop?: string; topn?: number },
  signal?: AbortSignal,
): Promise<UniFetchResult & { data?: TrendsData }> {
  const res = await post("uni-trends", {
    action: "explore",
    terms,
    region: opts.region ?? "BR",
    lang: opts.lang ?? "pt-BR",
    timeframe: opts.timeframe ?? "today 3-m",
    gprop: opts.gprop ?? "",
    topn: opts.topn ?? 10,
  }, signal);
  if (!res.ok) return res;
  const raw = res as unknown as Omit<TrendsData, "terms"> & { terms?: string[] };
  const termList = raw.terms ?? terms;
  const items: UniItem[] = [];
  for (const q of raw.related ?? []) {
    items.push({
      id: uniItemId("trends", `${q.kind}:${q.text}`),
      source: "trends",
      kind: "trend-query",
      title: q.text,
      score: q.value,
      meta: { kind: q.kind, terms: termList },
    });
  }
  for (const r of raw.regions ?? []) {
    items.push({
      id: uniItemId("trends", `region:${r.region}`),
      source: "trends",
      kind: "trend-region",
      title: r.region,
      score: Math.max(...r.values, 0),
      meta: { values: r.values, terms: termList },
    });
  }
  return {
    ok: true,
    items,
    data: { timeline: raw.timeline ?? [], regions: raw.regions ?? [], related: raw.related ?? [], errors: raw.errors ?? [], terms: termList },
  };
}

// ---------- SERP ----------

export async function fetchSerp(
  query: string,
  opts: { region?: string; lang?: string; limit?: number; engines?: string[] },
  signal?: AbortSignal,
): Promise<UniFetchResult> {
  const res = await post("uni-serp", {
    action: "search",
    query,
    region: opts.region ?? "br",
    lang: opts.lang ?? "pt",
    limit: opts.limit ?? 10,
    engines: opts.engines,
  }, signal);
  if (!res.ok) return res;
  const raw = res as unknown as {
    results?: { engine: string; rank: number; title: string; link: string; snippet?: string }[];
    perEngine?: Record<string, { count: number; error?: string }>;
  };
  const items: UniItem[] = (raw.results ?? []).map((r) => ({
    id: uniItemId("serp", r.link),
    source: "serp",
    kind: "web-result",
    title: r.title,
    text: r.snippet,
    url: r.link,
    score: r.rank ? 100 - r.rank : undefined, // rank 1 → score 99 (ordenável)
    meta: { engine: r.engine, rank: r.rank, query },
  }));
  return { ok: true, items, notes: { perEngine: raw.perEngine } };
}

/** Extrai headings/parágrafos de uma página (scrap_conteudo). */
export async function fetchPageContent(url: string, signal?: AbortSignal): Promise<UniFetchResult> {
  const res = await post("uni-serp", { action: "content", url }, signal);
  if (!res.ok) return res;
  const raw = res as unknown as { content?: { tag: string; text: string }[] };
  const items: UniItem[] = (raw.content ?? []).map((c) => ({
    id: uniItemId("serp", `${url}#${c.tag}:${c.text.slice(0, 30)}`),
    source: "serp",
    kind: "article",
    title: c.tag.toUpperCase(),
    text: c.text,
    url,
  }));
  return { ok: true, items };
}

// ---------- YouTube ----------

export interface YtVideoRef { videoId: string; title: string; channel: string }

export async function fetchYoutubeVideos(
  query: string,
  opts: { region?: string; lang?: string; order?: string; limit?: number },
  signal?: AbortSignal,
): Promise<UniFetchResult & { videos?: YtVideoRef[] }> {
  const res = await post("uni-youtube", {
    action: "videos",
    query,
    region: opts.region ?? "BR",
    lang: opts.lang ?? "pt-BR",
    order: opts.order ?? "relevance",
    limit: opts.limit ?? 10,
  }, signal);
  if (!res.ok) return res;
  const raw = res as unknown as {
    videos?: { videoId: string; title: string; channel: string; published?: string; views?: string; duration?: string; link: string; thumb?: string }[];
  };
  const videos: YtVideoRef[] = [];
  const items: UniItem[] = (raw.videos ?? []).map((v) => {
    videos.push({ videoId: v.videoId, title: v.title, channel: v.channel });
    return {
      id: uniItemId("youtube", v.videoId),
      source: "youtube" as UniSourceId,
      kind: "video",
      title: v.title,
      author: v.channel,
      url: v.link,
      date: v.published,
      meta: { videoId: v.videoId, views: v.views, duration: v.duration, thumb: v.thumb, query },
    };
  });
  return { ok: true, items, videos };
}

export async function fetchYoutubeComments(videoId: string, limit = 20, signal?: AbortSignal): Promise<UniFetchResult> {
  const res = await post("uni-youtube", { action: "comments", videoId, limit }, signal);
  if (!res.ok) return res;
  const raw = res as unknown as { comments?: { author: string; text: string; likes: number; published?: string }[] };
  const items: UniItem[] = (raw.comments ?? []).map((c) => ({
    id: uniItemId("youtube", `${videoId}:${c.author}:${c.text.slice(0, 20)}`),
    source: "youtube",
    kind: "comment",
    title: c.text.slice(0, 80) || "(comentário)",
    text: c.text,
    author: c.author,
    score: c.likes,
    date: c.published,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    meta: { videoId },
  }));
  return { ok: true, items };
}

// ---------- Reddit ----------

export interface RedditPostRef { id: string; title: string; subreddit: string }

export async function fetchRedditPosts(
  query: string,
  opts: { subreddit?: string; sort?: string; limit?: number },
  signal?: AbortSignal,
): Promise<UniFetchResult & { posts?: RedditPostRef[] }> {
  const res = await post("uni-reddit", {
    action: "posts",
    query,
    subreddit: opts.subreddit ?? "all",
    sort: opts.sort ?? "top",
    limit: opts.limit ?? 10,
  }, signal);
  if (!res.ok) return res;
  const raw = res as unknown as {
    posts?: { id: string; title: string; author: string; score: number; upvoteRatio?: number; url: string; permalink: string; subreddit: string; numComments: number; selftext?: string; createdAt: string }[];
  };
  const posts: RedditPostRef[] = [];
  const items: UniItem[] = (raw.posts ?? []).map((p) => {
    posts.push({ id: p.id, title: p.title, subreddit: p.subreddit });
    return {
      id: uniItemId("reddit", p.id),
      source: "reddit" as UniSourceId,
      kind: "post",
      title: p.title,
      text: p.selftext,
      author: p.author,
      url: p.permalink,
      score: p.score,
      date: p.createdAt,
      meta: { subreddit: p.subreddit, numComments: p.numComments, upvoteRatio: p.upvoteRatio, link: p.url, query },
    };
  });
  return { ok: true, items, posts };
}

export async function fetchRedditComments(postId: string, subreddit = "all", limit = 20, signal?: AbortSignal): Promise<UniFetchResult> {
  const res = await post("uni-reddit", { action: "comments", postId, subreddit, limit }, signal);
  if (!res.ok) return res;
  const raw = res as unknown as { comments?: { id: string; author: string; body: string; score: number; createdAt: string }[] };
  const items: UniItem[] = (raw.comments ?? []).map((c) => ({
    id: uniItemId("reddit", `${postId}:${c.id}`),
    source: "reddit",
    kind: "comment",
    title: c.body.slice(0, 80) || "(comentário)",
    text: c.body,
    author: c.author,
    score: c.score,
    date: c.createdAt,
    meta: { postId, subreddit },
  }));
  return { ok: true, items };
}

// ---------- Wikipedia (rota /functions/v1/wikipedia, pré-existente) ----------

export interface WikiSearchHit { title: string; pageid: number; snippet: string; }

export interface UniWikiResult extends UniFetchResult {
  hits?: WikiSearchHit[];
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#039;/g, "'").trim();
}

export async function fetchWikipediaSearch(query: string, lang = "pt", limit = 10, signal?: AbortSignal): Promise<UniWikiResult> {
  const res = await post("wikipedia", { action: "search", query, lang, limit }, signal);
  if (!res.ok) return res;
  const raw = res as unknown as { results?: { title: string; pageid: number; snippet: string; timestamp?: string }[] };
  const hits: WikiSearchHit[] = (raw.results ?? []).map((r) => ({
    title: r.title,
    pageid: r.pageid,
    snippet: stripHtml(r.snippet ?? ""),
  }));
  const items: UniItem[] = (raw.results ?? []).map((r) => ({
    id: uniItemId("wikipedia", String(r.pageid)),
    source: "wikipedia" as UniSourceId,
    kind: "article",
    title: r.title,
    text: stripHtml(r.snippet ?? ""),
    url: `https://${lang}.wikipedia.org/?curid=${r.pageid}`,
    date: r.timestamp,
    meta: { pageid: r.pageid, lang, query },
  }));
  return { ok: true, items, hits };
}

export async function fetchWikipediaArticle(pageid: number, lang = "pt", signal?: AbortSignal): Promise<UniFetchResult> {
  const res = await post("wikipedia", { action: "article", pageid, lang }, signal);
  if (!res.ok) return res;
  const raw = res as unknown as { article?: { title?: string; extract?: string } | null; found?: boolean };
  if (!raw.found || !raw.article?.extract) {
    return { ok: false, items: [], error: "Artigo não encontrado na Wikipédia." };
  }
  const items: UniItem[] = [{
    id: uniItemId("wikipedia", `full:${pageid}`),
    source: "wikipedia",
    kind: "article",
    title: raw.article.title ?? "Artigo",
    text: raw.article.extract.slice(0, 6000),
    url: `https://${lang}.wikipedia.org/?curid=${pageid}`,
    meta: { pageid, lang, full: true },
  }];
  return { ok: true, items };
}

// ---------- Hacker News (API Algolia) ----------

export async function fetchHnStories(query: string, sort: "relevance" | "date" = "relevance", limit = 20, signal?: AbortSignal): Promise<UniFetchResult> {
  const res = await post("uni-hackernews", { action: "search", query, sort, limit }, signal);
  if (!res.ok) return res;
  const raw = res as unknown as {
    stories?: { id: string; title: string; url: string; author: string; points: number; numComments: number; text: string; createdAt: string }[];
  };
  const items: UniItem[] = (raw.stories ?? []).map((h) => ({
    id: uniItemId("hackernews", h.id),
    source: "hackernews" as UniSourceId,
    kind: "post",
    title: h.title,
    text: h.text || undefined,
    author: h.author,
    url: h.url,
    score: h.points,
    date: h.createdAt,
    meta: { hnId: h.id, numComments: h.numComments, query },
  }));
  return { ok: true, items };
}

export async function fetchHnComments(storyId: string, limit = 20, signal?: AbortSignal): Promise<UniFetchResult> {
  const res = await post("uni-hackernews", { action: "comments", storyId, limit }, signal);
  if (!res.ok) return res;
  const raw = res as unknown as { comments?: { id: string; author: string; text: string; createdAt: string }[] };
  const items: UniItem[] = (raw.comments ?? []).map((c) => ({
    id: uniItemId("hackernews", `${storyId}:${c.id}`),
    source: "hackernews",
    kind: "comment",
    title: c.text.slice(0, 80) || "(comentário)",
    text: c.text,
    author: c.author,
    date: c.createdAt,
    meta: { storyId },
  }));
  return { ok: true, items };
}

// ---------- GDELT (notícias globais) ----------

export type GdeltSort = "date" | "relevance";

export async function fetchGdeltNews(
  query: string,
  opts: { sort?: GdeltSort; lang?: string; limit?: number; startDate?: string; endDate?: string } = {},
  signal?: AbortSignal,
): Promise<UniFetchResult> {
  const res = await post("uni-gdelt", { action: "search", query, ...opts }, signal);
  if (!res.ok) return res;
  const raw = res as unknown as {
    articles?: { url: string; title: string; seenDate: string; domain: string; language: string; sourceCountry: string }[];
  };
  const items: UniItem[] = (raw.articles ?? []).map((a) => ({
    id: uniItemId("gdelt", a.url || a.title),
    source: "gdelt" as UniSourceId,
    kind: "news",
    title: a.title,
    url: a.url,
    date: a.seenDate,
    meta: { domain: a.domain, language: a.language, sourceCountry: a.sourceCountry, query },
  }));
  return { ok: true, items };
}

// ---------- arXiv (artigos científicos) ----------

export type ArxivSort = "relevance" | "lastUpdatedDate" | "submittedDate";

export async function fetchArxivPapers(query: string, sort: ArxivSort = "relevance", limit = 20, signal?: AbortSignal): Promise<UniFetchResult> {
  const res = await post("uni-arxiv", { action: "search", query, sort, limit }, signal);
  if (!res.ok) return res;
  const raw = res as unknown as {
    papers?: { id: string; title: string; summary: string; authors: string[]; published: string; updated: string; url: string; pdf: string; categories: string[] }[];
  };
  const items: UniItem[] = (raw.papers ?? []).map((a) => ({
    id: uniItemId("arxiv", a.id),
    source: "arxiv" as UniSourceId,
    kind: "paper",
    title: a.title,
    text: a.summary,
    author: a.authors.slice(0, 3).join(", ") + (a.authors.length > 3 ? " et al." : ""),
    url: a.url,
    date: a.published,
    meta: { pdf: a.pdf, categories: a.categories, updated: a.updated, query },
  }));
  return { ok: true, items };
}

// ---------- StackExchange (Q&A) ----------

export type SeSite = "stackoverflow" | "pt.stackoverflow" | "superuser" | "serverfault" | "android" | "apple" | "webapps";
export type SeSort = "relevance" | "votes" | "creation" | "activity";

export async function fetchSeQuestions(query: string, site: SeSite = "stackoverflow", sort: SeSort = "relevance", limit = 20, signal?: AbortSignal): Promise<UniFetchResult> {
  const res = await post("uni-stackexchange", { action: "search", query, site, sort, limit }, signal);
  if (!res.ok) return res;
  const raw = res as unknown as {
    questions?: { id: number; title: string; link: string; score: number; answerCount: number; viewCount: number; isAnswered: boolean; body: string; createdAt: string; tags: string[]; author: string }[];
  };
  const items: UniItem[] = (raw.questions ?? []).map((q) => ({
    id: uniItemId("stackexchange", String(q.id)),
    source: "stackexchange" as UniSourceId,
    kind: "question",
    title: q.title,
    text: q.body || undefined,
    author: q.author,
    url: q.link,
    score: q.score,
    date: q.createdAt,
    meta: { questionId: q.id, site, answerCount: q.answerCount, viewCount: q.viewCount, isAnswered: q.isAnswered, tags: q.tags, query },
  }));
  return { ok: true, items };
}

export async function fetchSeAnswers(questionId: number, site: SeSite = "stackoverflow", limit = 10, signal?: AbortSignal): Promise<UniFetchResult> {
  const res = await post("uni-stackexchange", { action: "answers", questionId, site, limit }, signal);
  if (!res.ok) return res;
  const raw = res as unknown as {
    answers?: { id: number; score: number; isAccepted: boolean; body: string; createdAt: string; author: string }[];
  };
  const items: UniItem[] = (raw.answers ?? []).map((a) => ({
    id: uniItemId("stackexchange", `${questionId}:${a.id}`),
    source: "stackexchange",
    kind: "answer",
    title: (a.body.slice(0, 80) || "(resposta)"),
    text: a.body,
    author: a.author,
    score: a.score,
    date: a.createdAt,
    meta: { questionId, site, isAccepted: a.isAccepted },
  }));
  return { ok: true, items };
}

// ---------- GitHub (repos + issues) ----------

export type GhRepoSort = "stars" | "updated" | "forks";
export type GhIssueState = "open" | "closed" | "all";

export async function fetchGithubRepos(query: string, sort: GhRepoSort = "stars", limit = 20, signal?: AbortSignal): Promise<UniFetchResult> {
  const res = await post("uni-github", { action: "repos", query, sort, limit }, signal);
  if (!res.ok) return res;
  const raw = res as unknown as {
    repos?: { name: string; description: string; url: string; stars: number; forks: number; openIssues: number; language: string; updatedAt: string; topics: string[] }[];
  };
  const items: UniItem[] = (raw.repos ?? []).map((r) => ({
    id: uniItemId("github", r.name),
    source: "github" as UniSourceId,
    kind: "repo",
    title: r.name,
    text: r.description || undefined,
    url: r.url,
    score: r.stars,
    date: r.updatedAt,
    meta: { forks: r.forks, openIssues: r.openIssues, language: r.language, topics: r.topics, query },
  }));
  return { ok: true, items };
}

export async function fetchGithubIssues(query: string, state: GhIssueState = "open", limit = 20, signal?: AbortSignal): Promise<UniFetchResult> {
  const res = await post("uni-github", { action: "issues", query, state, limit }, signal);
  if (!res.ok) return res;
  const raw = res as unknown as {
    issues?: { id: number; title: string; url: string; state: string; comments: number; repo: string; author: string; createdAt: string; labels: string[] }[];
  };
  const items: UniItem[] = (raw.issues ?? []).map((i) => ({
    id: uniItemId("github", `issue:${i.id}`),
    source: "github",
    kind: "issue",
    title: i.title,
    author: i.author,
    url: i.url,
    score: i.comments,
    date: i.createdAt,
    meta: { state: i.state, repo: i.repo, labels: i.labels, comments: i.comments, query },
  }));
  return { ok: true, items };
}

// ---------- Semantic Scholar (acadêmico) ----------

export type S2Sort = "relevance" | "citationCount";

export async function fetchS2Papers(query: string, sort: S2Sort = "relevance", limit = 20, signal?: AbortSignal): Promise<UniFetchResult> {
  const res = await post("uni-semanticscholar", { action: "search", query, sort, limit }, signal);
  if (!res.ok) return res;
  const raw = res as unknown as {
    papers?: { id: string; title: string; abstract: string; year: number | null; url: string; citations: number; authors: string[] }[];
  };
  const items: UniItem[] = (raw.papers ?? []).map((p) => ({
    id: uniItemId("semanticscholar", p.id),
    source: "semanticscholar" as UniSourceId,
    kind: "paper",
    title: p.title,
    text: p.abstract || undefined,
    author: p.authors.slice(0, 3).join(", ") + (p.authors.length > 3 ? " et al." : ""),
    url: p.url,
    score: p.citations,
    date: p.year ? `${p.year}-01-01` : undefined,
    meta: { year: p.year, citations: p.citations, query },
  }));
  return { ok: true, items };
}

// ---------- Steam (jogos + reviews) ----------

export type SteamLang = "all" | "portuguese" | "english" | "spanish";

export async function fetchSteamGames(query: string, limit = 10, signal?: AbortSignal): Promise<UniFetchResult> {
  const res = await post("uni-steam", { action: "search", query, limit }, signal);
  if (!res.ok) return res;
  const raw = res as unknown as { games?: { appId: string; title: string }[] };
  const items: UniItem[] = (raw.games ?? []).map((g) => ({
    id: uniItemId("steam", g.appId),
    source: "steam" as UniSourceId,
    kind: "game",
    title: g.title,
    url: `https://store.steampowered.com/app/${g.appId}`,
    meta: { appId: g.appId, query },
  }));
  return { ok: true, items };
}

export async function fetchSteamReviews(appId: string, language: SteamLang = "all", limit = 30, signal?: AbortSignal): Promise<UniFetchResult> {
  const res = await post("uni-steam", { action: "reviews", appId, language, limit }, signal);
  if (!res.ok) return res;
  const raw = res as unknown as {
    reviews?: { id: string; text: string; recommended: boolean; votesUp: number; createdAt: string; playtimeHours: number | null }[];
  };
  const items: UniItem[] = (raw.reviews ?? []).map((r) => ({
    id: uniItemId("steam", `review:${r.id}`),
    source: "steam",
    kind: "review",
    title: r.recommended ? "👍 Recomendado" : "👎 Não recomendado",
    text: r.text,
    score: r.votesUp,
    date: r.createdAt,
    meta: { appId, language, recommended: r.recommended, playtimeHours: r.playtimeHours },
  }));
  return { ok: true, items };
}

// ---------- ReclameAqui (empresas + reclamações) ----------

export interface RaCompanyLite { id: string; name: string; shortname: string; city?: string; state?: string }

interface RaComplaintJson {
  id: string; title: string; text: string; created: string;
  status: string; statusRaw: string; solved: boolean | null; evaluated: boolean;
  dealAgain: boolean | null; score: number | null; city?: string; state?: string; url: string;
  companyName?: string;
}

function raComplaintToItem(c: RaComplaintJson, extraMeta: Record<string, unknown>): UniItem {
  return {
    id: uniItemId("reclameaqui", `complaint:${c.id}`),
    source: "reclameaqui" as UniSourceId,
    kind: "complaint",
    title: c.title,
    text: c.text,
    author: [c.city, c.state].filter(Boolean).join("/") || undefined,
    url: c.url,
    score: c.score ?? undefined,
    date: c.created,
    meta: {
      complaintId: c.id, status: c.status, statusRaw: c.statusRaw, solved: c.solved,
      evaluated: c.evaluated, dealAgain: c.dealAgain, city: c.city, state: c.state,
      ...extraMeta,
    },
  };
}

/** Busca empresas do RA por nome (retorna UniItems "web-result" com o shortname em meta). */
export async function fetchReclameAquiCompanies(query: string, signal?: AbortSignal): Promise<UniFetchResult> {
  const res = await post("uni-reclameaqui", { action: "search", query }, signal);
  if (!res.ok) return res;
  const raw = res as unknown as { companies?: RaCompanyLite[] };
  const items: UniItem[] = (raw.companies ?? []).map((c) => ({
    id: uniItemId("reclameaqui", `company:${c.id || c.shortname}`),
    source: "reclameaqui" as UniSourceId,
    kind: "web-result",
    title: c.name,
    text: [c.city, c.state].filter(Boolean).join("/") || undefined,
    url: `https://www.reclameaqui.com.br/empresa/${c.shortname}/`,
    meta: { companyId: c.id, shortname: c.shortname, city: c.city, state: c.state },
  }));
  return { ok: true, items };
}

/** Reclamações de uma empresa (por companyId ou shortname). */
export async function fetchReclameAquiComplaints(
  opts: { companyId?: string; shortname?: string; limit?: number },
  signal?: AbortSignal,
): Promise<UniFetchResult> {
  const res = await post("uni-reclameaqui", { action: "complaints", ...opts }, signal);
  if (!res.ok) return res;
  const raw = res as unknown as { complaints?: RaComplaintJson[]; total?: number; companyName?: string };
  const items: UniItem[] = (raw.complaints ?? []).map((c) =>
    raComplaintToItem(c, { companyName: raw.companyName, total: raw.total }));
  return { ok: true, items };
}

/** Busca livre de reclamações por termo (qualquer empresa). */
export async function fetchReclameAquiTerm(query: string, limit = 25, signal?: AbortSignal): Promise<UniFetchResult> {
  const res = await post("uni-reclameaqui", { action: "term", query, limit }, signal);
  if (!res.ok) return res;
  const raw = res as unknown as { complaints?: RaComplaintJson[] };
  const items: UniItem[] = (raw.complaints ?? []).map((c) =>
    raComplaintToItem(c, { query, companyName: c.companyName }));
  return { ok: true, items };
}

// ---------- Coletores universais (Web/PDF/Feed/Texto) ----------

/** Extrai o conteúdo legível de uma página web (ou PDF via URL). */
export async function fetchWebPage(url: string, signal?: AbortSignal): Promise<UniFetchResult> {
  const res = await post("uni-web", { action: "page", url }, signal);
  if (!res.ok) return res;
  const raw = res as unknown as {
    kind: "page" | "pdf";
    article?: { title: string; text: string; url: string; siteName: string; author: string; publishedAt: string; description: string; lang: string; words: number };
    pages?: string[];
  };
  if (raw.kind === "pdf") {
    const items: UniItem[] = (raw.pages ?? []).map((t, i) => ({
      id: uniItemId("web", `pdf:${url}:${i}`),
      source: "web",
      kind: "document",
      title: `PDF · página ${i + 1}`,
      text: t,
      url,
      meta: { url, page: String(i + 1) },
    }));
    return { ok: true, items };
  }
  const a = raw.article;
  if (!a || !a.text) return { ok: false, error: "Nenhum texto extraído da página.", items: [] };
  return {
    ok: true,
    items: [{
      id: uniItemId("web", url),
      source: "web",
      kind: "article",
      title: a.title || url,
      text: a.text,
      url: a.url,
      author: a.author,
      date: a.publishedAt,
      meta: { siteName: a.siteName, description: a.description, lang: a.lang, words: String(a.words) },
    }],
  };
}

/** Extrai texto de um PDF via URL (uma entrada por página). */
export async function fetchPdfText(url: string, signal?: AbortSignal): Promise<UniFetchResult> {
  const res = await post("uni-web", { action: "pdf", url }, signal);
  if (!res.ok) return res;
  const raw = res as unknown as { pages?: string[] };
  const items: UniItem[] = (raw.pages ?? []).map((t, i) => ({
    id: uniItemId("web", `pdf:${url}:${i}`),
    source: "web",
    kind: "document",
    title: `PDF · página ${i + 1}`,
    text: t,
    url,
    meta: { url, page: String(i + 1) },
  }));
  if (!items.length) return { ok: false, error: "PDF sem texto extraível (pode ser digitalizado/imagem).", items: [] };
  return { ok: true, items };
}

/** Coleta qualquer feed RSS/Atom (blog, portal, Google News…). */
export async function fetchFeedItems(url: string, limit = 50, signal?: AbortSignal): Promise<UniFetchResult> {
  const res = await post("uni-web", { action: "feed", url, limit }, signal);
  if (!res.ok) return res;
  const raw = res as unknown as { items?: { title: string; url: string; date: string; text: string; author: string }[] };
  const items: UniItem[] = (raw.items ?? []).map((it) => ({
    id: uniItemId("feed", it.url || it.title),
    source: "feed",
    kind: "news",
    title: it.title || it.url,
    text: it.text,
    url: it.url,
    author: it.author,
    date: it.date,
    meta: { feedUrl: url },
  }));
  if (!items.length) return { ok: false, error: "Nenhum item no feed (URL não é RSS/Atom?).", items: [] };
  return { ok: true, items };
}

/** Product Hunt — lançamentos do dia (feed Atom público) ou GraphQL oficial (com token no servidor). */
export async function fetchProductHuntPosts(
  opts: { topic?: string; via?: "feed" | "graphql"; limit?: number } = {},
  signal?: AbortSignal,
): Promise<UniFetchResult> {
  const { topic = "", via = "feed", limit = 20 } = opts;
  const res = await post(
    "uni-producthunt",
    via === "graphql"
      ? { action: "graphql", first: limit, order: "RANKING" }
      : { action: "posts", topic, limit },
    signal,
  );
  if (!res.ok) return res;
  const raw = res as unknown as {
    via?: string;
    posts?: { id: string; name: string; tagline: string; url: string; date: string; rank: number; votesCount?: number; commentsCount?: number; topics?: string[] }[];
  };
  const items: UniItem[] = (raw.posts ?? []).map((p) => ({
    id: uniItemId("producthunt", p.id || p.url || p.name),
    source: "producthunt",
    kind: "post",
    title: p.name,
    text: p.tagline,
    url: p.url,
    date: p.date,
    score: p.votesCount ?? 0,
    meta: {
      rank: String(p.rank),
      via: raw.via ?? via,
      ...(topic ? { topic } : {}),
      ...(p.commentsCount != null ? { commentsCount: String(p.commentsCount) } : {}),
      ...(p.topics?.length ? { topics: p.topics.join(", ") } : {}),
    },
  }));
  if (!items.length) return { ok: false, error: "Nenhum lançamento retornado pelo Product Hunt.", items: [] };
  return { ok: true, items };
}

/** Converte texto colado (.md/.txt/.json/.csv) em itens. */
export async function pasteTextItems(text: string, format: "auto" | "md" | "txt" | "json" | "csv" = "auto", signal?: AbortSignal): Promise<UniFetchResult> {
  const res = await post("uni-web", { action: "text", text, format }, signal);
  if (!res.ok) return res;
  const raw = res as unknown as { items?: { title: string; text: string; meta?: Record<string, string> }[]; format?: string };
  const items: UniItem[] = (raw.items ?? []).map((it, i) => ({
    id: uniItemId("paste", `${raw.format ?? "auto"}:${i}:${it.title.slice(0, 40)}`),
    source: "paste",
    kind: "document",
    title: it.title,
    text: it.text,
    meta: { ...(it.meta ?? {}), format: raw.format ?? "auto" },
  }));
  if (!items.length) return { ok: false, error: "Nenhum item extraído do texto.", items: [] };
  return { ok: true, items };
}

// ---------- Motor de conectores declarativos (uni-source) ----------

export type ConnectorSourceId =
  | "devto" | "lobsters" | "mastodon" | "bluesky" | "wikidata"
  | "openalex" | "crossref" | "openlibrary" | "npm" | "pypi" | "itchio"
  | "rubygems" | "cratesio" | "doaj" | "openfoodfacts" | "archive" | "tvmaze";

/** Busca em uma fonte customizada do usuário (definição enviada no body). */
export async function fetchCustomSource(
  def: import("./customSources").CustomSourceDef,
  query: string,
  limit = 20,
  signal?: AbortSignal,
): Promise<UniFetchResult> {
  // Auth (Onda 4.3): o valor do segredo vem do vault local e viaja só no
  // body da requisição — a def exportável nunca carrega credencial.
  const auth = def.auth ? buildAuthPayload(def.id, def.auth) : undefined;
  const res = await post("uni-source", { source: "custom", query, limit, custom: { ...def, auth } }, signal);
  if (!res.ok) return res;
  const raw = res as unknown as {
    items?: { title: string; text?: string; url?: string; author?: string; date?: string; score?: number; meta?: Record<string, string> }[];
  };
  const items: UniItem[] = (raw.items ?? []).map((it) => ({
    id: uniItemId(`custom:${def.id}`, it.url || it.title),
    source: "custom" as UniSourceId,
    kind: def.kind,
    title: it.title,
    text: it.text,
    url: it.url,
    author: it.author,
    date: it.date,
    score: it.score,
    meta: { ...it.meta, customSourceId: def.id, customLabel: def.label },
  }));
  if (!items.length) return { ok: false, error: "Nenhum resultado nesta fonte para o termo.", items: [] };
  return { ok: true, items };
}

/** Busca em qualquer fonte do motor declarativo (devto, lobsters, bluesky…). */
export async function fetchConnector(source: ConnectorSourceId, query: string, limit = 20, signal?: AbortSignal): Promise<UniFetchResult> {
  const res = await post("uni-source", { source, query, limit }, signal);
  if (!res.ok) return res;
  const raw = res as unknown as {
    kind: UniItemKind;
    source: string;
    items?: { title: string; text?: string; url?: string; author?: string; date?: string; score?: number; meta?: Record<string, string> }[];
  };
  const items: UniItem[] = (raw.items ?? []).map((it) => ({
    id: uniItemId(source, it.url || it.title),
    source: source as UniSourceId,
    kind: raw.kind as UniItemKind,
    title: it.title,
    text: it.text,
    url: it.url,
    author: it.author,
    date: it.date,
    score: it.score,
    meta: it.meta,
  }));
  if (!items.length) return { ok: false, error: "Nenhum resultado nesta fonte para o termo.", items: [] };
  return { ok: true, items };
}

// ---------- Multi-recurso (modos de coleta: várias opções da mesma fonte) ----------

/**
 * Suggest em VÁRIAS verticais de uma vez (web + youtube + news + shopping…),
 * sequencial (cada vertical é uma run própria no terminal Output) com merge
 * por texto — maior relevância vence e `meta.verticals` acumula as origens.
 */
export async function fetchSuggestMulti(
  query: string,
  verticals: SuggestVertical[],
  opts: { region?: string; lang?: string; expand?: boolean; limit?: number },
  signal?: AbortSignal,
): Promise<UniFetchResult> {
  const collected: UniItem[] = [];
  const errors: string[] = [];
  for (const vertical of verticals) {
    const res = await fetchSuggest(query, { ...opts, vertical }, signal);
    if (!res.ok) {
      errors.push(`${vertical}: ${res.error ?? "erro"}`);
      continue;
    }
    collected.push(...res.items);
  }
  const best = new Map<string, { item: UniItem; verticals: Set<string> }>();
  for (const item of collected) {
    const prev = best.get(item.id);
    const v = String(item.meta?.vertical ?? "web");
    if (!prev) {
      best.set(item.id, { item, verticals: new Set([v]) });
    } else {
      prev.verticals.add(v);
      if ((item.score ?? 0) > (prev.item.score ?? 0)) prev.item = item;
    }
  }
  const items = [...best.values()].map(({ item, verticals: vset }) => ({
    ...item,
    meta: { ...item.meta, verticals: [...vset] },
  }));
  if (!items.length && errors.length) {
    return { ok: false, items: [], error: errors.join(" · ") };
  }
  return { ok: true, items, notes: errors.length ? { partialErrors: errors } : undefined };
}

/** Uma combinação período × vertical do Trends executada dentro de um multi. */
export interface TrendsComboResult {
  label: string;
  timeframe: string;
  gprop: string;
  data?: TrendsData;
  error?: string;
}

/**
 * Trends em VÁRIAS combinações (períodos × verticais) de uma vez — como o
 * _uni.py permite selecionar "todos os períodos e verticais". Sequencial,
 * cada combinação é uma run própria; falhas individuais não derrubam o lote.
 */
export async function fetchTrendsMulti(
  terms: string[],
  combos: { timeframe: string; gprop: string }[],
  opts: { region?: string; lang?: string; topn?: number },
  signal?: AbortSignal,
): Promise<UniFetchResult & { trendsList?: TrendsComboResult[] }> {
  const items: UniItem[] = [];
  const trendsList: TrendsComboResult[] = [];
  const errors: string[] = [];
  for (const combo of combos) {
    const label = `${combo.timeframe}${combo.gprop ? ` · ${combo.gprop}` : ""}`;
    const res = await fetchTrends(terms, { ...opts, timeframe: combo.timeframe, gprop: combo.gprop }, signal);
    if (!res.ok) {
      errors.push(`${label}: ${res.error ?? "erro"}`);
      trendsList.push({ label, timeframe: combo.timeframe, gprop: combo.gprop, error: res.error });
      continue;
    }
    // Tag do combo no meta para distinguir período/vertical de origem.
    for (const it of res.items) {
      items.push({ ...it, id: `${it.id}:${combo.timeframe}:${combo.gprop || "web"}`, meta: { ...it.meta, combo: label } });
    }
    trendsList.push({ label, timeframe: combo.timeframe, gprop: combo.gprop, data: res.data });
  }
  if (!items.length && errors.length) {
    return { ok: false, items: [], error: errors[0], trendsList };
  }
  return { ok: true, items, trendsList, notes: errors.length ? { partialErrors: errors } : undefined };
}
