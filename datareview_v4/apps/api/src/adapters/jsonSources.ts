/**
 * Adaptadores reais (SourcePort) portados do legado v1 — fontes que expõem
 * JSON público ou APIs simples sem chave. Cada uma é um `defineAdapter` com
 * fetch + map → NormalizedItem (catalogado em docs/SOURCES.md como PONTE(v1)).
 */
import type { CollectOptions, NormalizedItem } from "@v4/contracts";
import { cap, defineAdapter, item, num, str } from "./base.js";
import { asArray, asRecord, fetchJson } from "./http.js";

/* ------------------------------------------------------------- Hacker News - */
/* Search API (Algolia) — https://hn.algolia.com/api — sem chave. */
export const hackernews = defineAdapter(
  {
    id: "hackernews",
    label: "Hacker News",
    kind: "post",
    description: "Histórias, perguntas e comentários do Hacker News (Algolia Search API).",
    capabilities: ["news", "social"],
    rateLimit: { rps: 2, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      const action = options.engine === "by_date" ? "search_by_date" : "search";
      const url = `https://hn.algolia.com/api/v1/${action}?query=${encodeURIComponent(options.query)}&hitsPerPage=${cap(options.limit ?? 20)}`;
      return fetchJson(url, { signal: options.signal });
    },
    map(data: unknown): NormalizedItem[] {
      const hits = asArray(asRecord(data).hits);
      return hits
        .map((h) => {
          const hit = asRecord(h);
          const title = str(hit.title) || str(hit.story_title);
          if (!title) return null;
          const text = str(hit.comment_text) || str(hit.story_text);
          return item(
            {
              id: str(hit.objectID) || title,
              title,
              url: str(hit.url) || (str(hit.story_id) ? `https://news.ycombinator.com/item?id=${hit.story_id}` : undefined),
              text,
              author: str(hit.author) || undefined,
              date: str(hit.created_at) || undefined,
              score: num(hit.points),
              meta: { numComments: num(hit.num_comments), type: str(hit._tags) || undefined },
            },
            "hackernews",
            text && !str(hit.url) ? "question" : "post",
          );
        })
        .filter((x): x is NormalizedItem => x !== null);
    },
  },
);

/* ------------------------------------------------------------------- GDELT - */
/* DOC 2.0 API — notícias globais — sem chave. */
export const gdelt = defineAdapter(
  {
    id: "gdelt",
    label: "GDELT",
    kind: "article",
    description: "Notícias globais em tempo quase real (GDELT Project DOC 2.0).",
    capabilities: ["news"],
    rateLimit: { rps: 1, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(options.query)}&format=json&maxrecords=${cap(options.limit ?? 10, 25)}`;
      return fetchJson(url, { signal: options.signal });
    },
    map(data: unknown): NormalizedItem[] {
      return asArray(asRecord(data).articles)
        .map((a) => {
          const article = asRecord(a);
          const title = str(article.title);
          if (!title) return null;
          return item(
            {
              id: str(article.url) || title,
              title,
              url: str(article.url) || undefined,
              author: str(article.source) || undefined,
              date: str(article.seendate) || undefined,
              score: num(article.tone),
              meta: {
                language: str(article.language) || undefined,
                sourceCountry: str(article.sourcecountry) || undefined,
                domain: str(article.domain) || undefined,
              },
            },
            "gdelt",
            "article",
          );
        })
        .filter((x): x is NormalizedItem => x !== null);
    },
  },
);

/* ------------------------------------------------------------------ GitHub - */
/* Search API — repos (default) ou issues (engine="issues"). Token opcional. */
export const github = defineAdapter(
  {
    id: "github",
    label: "GitHub",
    kind: "repo",
    description: "Repositórios e issues do GitHub (Search API).",
    capabilities: ["code"],
    rateLimit: { rps: 0.5, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      const scope = options.engine === "issues" ? "issues" : "repositories";
      const url = `https://api.github.com/search/${scope}?q=${encodeURIComponent(options.query)}&per_page=${cap(options.limit ?? 10, 30)}&sort=stars&order=desc`;
      return fetchJson(url, {
        signal: options.signal,
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });
    },
    map(data: unknown): NormalizedItem[] {
      return asArray(asRecord(data).items)
        .map((r) => {
          const repo = asRecord(r);
          const isIssue = Boolean(asRecord(repo).pull_request);
          const title = str(repo.title) || str(repo.full_name) || str(repo.name);
          if (!title) return null;
          return item(
            {
              id: str(repo.id) || title,
              title,
              url: str(repo.html_url) || undefined,
              text: str(repo.description) || str(repo.body),
              author: authorOf(repo),
              date: str(repo.updated_at) || str(repo.created_at) || undefined,
              score: num(repo.stargazers_count) ?? num(repo.score),
              meta: {
                language: str(repo.language) || undefined,
                forks: num(repo.forks_count),
                openIssues: num(repo.open_issues_count),
                topics: asArray(repo.topics),
                state: str(repo.state) || undefined,
              },
            },
            "github",
            isIssue ? "issue" : "repo",
          );
        })
        .filter((x): x is NormalizedItem => x !== null);
    },
  },
);

function authorOf(r: Record<string, unknown>): string | undefined {
  const owner = asRecord(r.user ?? r.owner);
  const login = str(owner.login);
  return login || str(owner.display_name) || undefined;
}

/* ------------------------------------------------------------------ arXiv - */
/* Atom XML — parseado de forma conservadora (sem dep XML). kind="paper". */
function xmlEntryField(entry: string, tag: string): string {
  const m = entry.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  const raw = m ? m[1] ?? "" : "";
  const text = raw
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
  return text.trim();
}

export const arxiv = defineAdapter(
  {
    id: "arxiv",
    label: "arXiv",
    kind: "paper",
    description: "Preprints científicos do arXiv (Atom API).",
    capabilities: ["academic"],
    rateLimit: { rps: 1, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(options.query)}&start=0&max_results=${cap(options.limit ?? 10, 25)}`;
      const resp = await fetch(url, { signal: options.signal });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp.text();
    },
    map(data: unknown): NormalizedItem[] {
      const xml = typeof data === "string" ? data : "";
      const entries = xml.split("<entry>").slice(1);
      return entries
        .flatMap((raw) => {
          const id = xmlEntryField(raw, "id");
          const title = xmlEntryField(raw, "title");
          if (!title) return [];
          const authors = raw
            .split("<author>")
            .slice(1)
            .map((a) => xmlEntryField(a, "name"))
            .filter(Boolean);
          return [
            item(
              {
                id: id || title,
                title,
                url: id || undefined,
                text: xmlEntryField(raw, "summary"),
                author: authors[0],
                date: xmlEntryField(raw, "published"),
                meta: { authors, categories: xmlEntryField(raw, "category").split(",").filter(Boolean) },
              },
              "arxiv",
              "paper",
            ),
          ];
        })
        .slice(0, cap(50));
    },
  },
);

/* ------------------------------------------------------------ StackExchange - */
/* search/advanced 2.3 — site por engine (default stackoverflow). */
export const stackexchange = defineAdapter(
  {
    id: "stackexchange",
    label: "StackExchange",
    kind: "question",
    description: "Perguntas e respostas da rede StackExchange.",
    capabilities: ["academic"],
    rateLimit: { rps: 2, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      const site = options.engine ?? "stackoverflow";
      const url = `https://api.stackexchange.com/2.3/search/advanced?site=${encodeURIComponent(site)}&q=${encodeURIComponent(options.query)}&pagesize=${cap(options.limit ?? 10, 30)}&order=desc&sort=relevance`;
      return fetchJson(url, { signal: options.signal });
    },
    map(data: unknown): NormalizedItem[] {
      return asArray(asRecord(data).items)
        .map((q) => {
          const question = asRecord(q);
          const title = str(question.title);
          if (!title) return null;
          const owner = asRecord(question.owner);
          return item(
            {
              id: str(question.question_id) || title,
              title,
              url: str(question.link) || undefined,
              text: str(question.body) || undefined,
              author: str(owner.display_name) || undefined,
              date: question.creation_date ? new Date(num(question.creation_date)! * 1000).toISOString() : undefined,
              score: num(question.score),
              meta: {
                answerCount: num(question.answer_count),
                viewCount: num(question.view_count),
                isAnswered: Boolean(question.is_answered),
                tags: asArray(question.tags),
                site: undefined,
              },
            },
            "stackexchange",
            "question",
          );
        })
        .filter((x): x is NormalizedItem => x !== null);
    },
  },
);

/* ----------------------------------------------------------- Semantic Scholar - */
/* Graph API v1 paper/search — sem chave, com backoff simples (429). */
export const semanticscholar = defineAdapter(
  {
    id: "semanticscholar",
    label: "Semantic Scholar",
    kind: "paper",
    description: "Papers e citações (Semantic Scholar Graph API).",
    capabilities: ["academic"],
    rateLimit: { rps: 1, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      const url =
        `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(options.query)}` +
        `&limit=${cap(options.limit ?? 10, 30)}&fields=title,abstract,year,authors,citationCount,externalIds,url`;
      return fetchJson(url, { signal: options.signal, timeoutMs: 20000 });
    },
    map(data: unknown): NormalizedItem[] {
      const root = asRecord(data);
      const raw = root.data ?? root.papers ?? [];
      const papers = typeof raw === "string" ? [] : asArray(raw);
      return papers
        .map((p) => {
          const paper = asRecord(p);
          const title = str(paper.title);
          if (!title) return null;
          const authors = asArray(paper.authors).map((a) => str(asRecord(a).name));
          const ext = asRecord(paper.externalIds);
          return item(
            {
              id: str(paper.paperId) || title,
              title,
              url: str(paper.url) || str(ext.DOI) || undefined,
              text: str(paper.abstract) || undefined,
              author: authors[0],
              date: paper.year ? String(paper.year) : undefined,
              score: num(paper.citationCount),
              meta: { authors, year: paper.year, doi: str(ext.DOI) || undefined },
            },
            "semanticscholar",
            "paper",
          );
        })
        .filter((x): x is NormalizedItem => x !== null);
    },
  },
);

/* --------------------------------------------------------------- Wikipedia - */
/* action=query&list=search — lang via engine (default pt). */
export const wikipedia = defineAdapter(
  {
    id: "wikipedia",
    label: "Wikipedia",
    kind: "document",
    description: "Artigos da Wikipédia (API de busca).",
    capabilities: ["news"],
    rateLimit: { rps: 1, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      const lang = /^[a-z]{2,3}(-[a-z]{2})?$/.test(options.engine ?? "") ? options.engine : "pt";
      const url =
        `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&format=json&formatversion=2` +
        `&srsearch=${encodeURIComponent(options.query)}&srlimit=${cap(options.limit ?? 10, 20)}`;
      return fetchJson(url, { signal: options.signal });
    },
    map(data: unknown, options: CollectOptions): NormalizedItem[] {
      const lang = /^[a-z]{2,3}(-[a-z]{2})?$/.test(options.engine ?? "") ? (options.engine as string) : "pt";
      const search = asArray(asRecord(asRecord(data).query).search);
      return search
        .map((s) => {
          const page = asRecord(s);
          const title = str(page.title);
          if (!title) return null;
          return item(
            {
              id: str(page.pageid) || title,
              title,
              url: `https://${lang}.wikipedia.org/wiki/${title.replaceAll(" ", "_")}`,
              text: str(page.snippet).replace(/<[^>]+>/g, ""),
              meta: { wordcount: num(page.wordcount), size: num(page.size) },
            },
            "wikipedia",
            "document",
          );
        })
        .filter((x): x is NormalizedItem => x !== null);
    },
  },
);

/* ------------------------------------------------------------------ Reddit - */
/* JSON público — com fallback honesto de erro (datacenter 403 é documentado). */
export const reddit = defineAdapter(
  {
    id: "reddit",
    label: "Reddit",
    kind: "post",
    description: "Posts do Reddit (JSON público; OAuth no v1 para robustez).",
    capabilities: ["social"],
    rateLimit: { rps: 0.5, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(options.query)}&limit=${cap(options.limit ?? 10, 25)}&sort=relevance`;
      return fetchJson(url, { signal: options.signal });
    },
    map(data: unknown): NormalizedItem[] {
      const children = asArray(asRecord(asRecord(asRecord(data).data).children));
      return children
        .map((c) => {
          const post = asRecord(asRecord(c).data);
          const title = str(post.title);
          if (!title) return null;
          return item(
            {
              id: str(post.id) || title,
              title,
              url: str(post.url) || (str(post.permalink) ? `https://www.reddit.com${post.permalink}` : undefined),
              text: str(post.selftext).slice(0, 500) || undefined,
              author: str(post.author) || undefined,
              date: post.created_utc ? new Date(num(post.created_utc)! * 1000).toISOString() : undefined,
              score: num(post.score),
              meta: {
                subreddit: str(post.subreddit) || undefined,
                numComments: num(post.num_comments),
              },
            },
            "reddit",
            "post",
          );
        })
        .filter((x): x is NormalizedItem => x !== null);
    },
  },
);

/* ------------------------------------------------------------------ vetoer - */
/* Prove market validity — mantém o mapa de adaptadores centralizado aqui. */
export const SIMPLE_JSON_ADAPTERS = {
  hackernews,
  gdelt,
  github,
  arxiv,
  stackexchange,
  semanticscholar,
  wikipedia,
  reddit,
} as const;

export type SimpleJsonAdapterId = keyof typeof SIMPLE_JSON_ADAPTERS;