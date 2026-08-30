/**
 * Lote 2 de adaptadores reais (SourcePort) — fontes com API pública estável
 * (sem chave). Mesma convenção do restante: fetch + map → NormalizedItem, com
 * try/catch via defineAdapter (parcial-OK).
 */
import type { CollectOptions, NormalizedItem } from "@v4/contracts";
import { cap, defineAdapter, item, num, str } from "./base.js";
import { asArray, asRecord, fetchJson } from "./http.js";

/** Remove tags HTML e re-escapa entidades simples (content do Mastodon). */
function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function excerpt(value: string, max = 200): string | undefined {
  const clean = stripHtml(value);
  return clean ? clean.slice(0, max) : undefined;
}

/* ----------------------------------------------------------------- Bluesky - */
/* public.api.bsky.app/xrpc — busca pública de posts, sem chave. */
export const bluesky = defineAdapter(
  {
    id: "bluesky",
    label: "Bluesky",
    kind: "post",
    description: "Posts do Bluesky (public.api.bsky.app — busca pública).",
    capabilities: ["social"],
    rateLimit: { rps: 1, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      const url = `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(options.query)}&limit=${cap(options.limit ?? 10, 25)}&lang=pt`;
      return fetchJson(url, { signal: options.signal });
    },
    map(data: unknown): NormalizedItem[] {
      return asArray(asRecord(data).posts)
        .map((p) => {
          const post = asRecord(p);
          const record = asRecord(post.record);
          const text = str(record.text);
          if (!text) return null;
          const author = asRecord(post.author);
          return item(
            {
              id: str(post.uri) || text,
              title: text.slice(0, 120),
              url: str(post.uri)?.replace("at://", "https://bsky.app/profile/") || undefined,
              text: text,
              author: str(author.handle) || str(author.displayName) || undefined,
              date: str(post.indexedAt) || undefined,
              score: num(post.likeCount),
              meta: {
                likes: num(post.likeCount),
                reposts: num(post.repostCount),
                replies: num(post.replyCount),
                displayName: str(author.displayName) || undefined,
              },
            },
            "bluesky",
            "post",
          );
        })
        .filter((x): x is NormalizedItem => x !== null);
    },
  },
);

/* ------------------------------------------------------------------ Deezer - */
/* api.deezer.com/search — busca pública de faixas, sem chave. */
export const deezer = defineAdapter(
  {
    id: "deezer",
    label: "Deezer",
    kind: "track",
    description: "Faixas e artistas do catálogo Deezer (API pública).",
    capabilities: ["media"],
    rateLimit: { rps: 1, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      const url = `https://api.deezer.com/search?q=${encodeURIComponent(options.query)}&limit=${cap(options.limit ?? 10, 25)}`;
      return fetchJson(url, { signal: options.signal });
    },
    map(data: unknown): NormalizedItem[] {
      return asArray(asRecord(data).data)
        .map((t) => {
          const track = asRecord(t);
          const title = str(track.title);
          if (!title) return null;
          const artist = asRecord(track.artist);
          const album = asRecord(track.album);
          return item(
            {
              id: str(track.id) || title,
              title: `${title} — ${str(artist.name) || "?"}`,
              url: str(track.link) || undefined,
              text: str(album.title) || undefined,
              author: str(artist.name) || undefined,
              score: num(track.rank),
              meta: {
                artist: str(artist.name) || undefined,
                album: str(album.title) || undefined,
                duration: num(track.duration),
                preview: str(track.preview) || undefined,
                explicitLyrics: Boolean(track.explicit_lyrics),
              },
            },
            "deezer",
            "track",
          );
        })
        .filter((x): x is NormalizedItem => x !== null);
    },
  },
);

/* ------------------------------------------------------------------ Steam - */
/* store.steampowered.com/api/storesearch — busca pública de jogos (cc via country). */
export const steam = defineAdapter(
  {
    id: "steam",
    label: "Steam",
    kind: "game",
    description:
      "Jogos da loja Steam (StoreSearch API; engine=reviews usa appreviews JSON).",
    capabilities: ["media", "reviews"],
    rateLimit: { rps: 1, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      const engine = options.engine || "search";
      if (engine === "reviews") {
        const appId = String(options.query.trim());
        if (!/^\d+$/.test(appId))
          throw new Error("engine=reviews exige appId numerico como query");
        const language = str(options.language) || "all";
        const limit = cap(options.limit ?? 30, 100);
        const params = new URLSearchParams({
          json: "1",
          language,
          purchase_type: "all",
          num_per_page: String(limit),
          filter: "recent",
        });
        const url = `https://store.steampowered.com/appreviews/${appId}?${params}`;
        return { appId, language, limit, reviewsUrl: url };
      }
      const cc = /^[a-z]{2}$/.test(options.country ?? "")
        ? options.country
        : "br";
      const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(options.query)}&cc=${cc}&l=english`;
      return fetchJson(url, { signal: options.signal });
    },
    map(data: unknown): NormalizedItem[] {
      const r = asRecord(data);
      if (Array.isArray(r.reviews)) {
        return asArray(r.reviews).map((raw) => {
          const rev = asRecord(raw);
          const author =
            asRecord(rev.author) ?? ({} as Record<string, unknown>);
          const votesUp = num(rev.votes_up);
          const createdAt = num(rev.timestamp_created);
          return item(
            {
              id: `steam:${str(r.appId)}:${str(rev.recommendationid)}`,
              title:
                `${votesUp ?? 0} ${String(rev.voted_up ?? "")}`.trim() ||
                "steam review",
              text: str(rev.review) || undefined,
              author: str(author.steamid) || undefined,
              date: createdAt
                ? new Date(createdAt * 1000).toISOString()
                : undefined,
              score: votesUp ?? undefined,
              meta: {
                recommended: Boolean(rev.voted_up),
                votesUp,
                playtimeForeverHours: num(author.playtime_forever)
                  ? Math.round(
                      ((num(author.playtime_forever) ?? 0) / 60) * 10,
                    ) / 10
                  : undefined,
                language: str(r.language) || undefined,
              },
            },
            "steam",
            "review",
          );
        });
      }
      return asArray(r.items)
        .map((r) => {
          const game = asRecord(r);
          const name = str(game.name);
          if (!name) return null;
          const appId = String(game.id);
          const price = asRecord(game.price);
          const metacritic = asRecord(game.metacritic);
          const final = num(price.final);
          return item(
            {
              id: appId || name,
              title: name,
              url: appId
                ? `https://store.steampowered.com/app/${appId}/`
                : undefined,
              text: game.discount
                ? `${str(price.currency)} ${final !== undefined ? (final / 100).toFixed(2) : "?"}${game.discount ? ` (${str(game.discount)}% off)` : ""}`
                : undefined,
              score: num(metacritic.score),
              meta: {
                priceCents: final,
                currency: str(price.currency) || undefined,
                discountPercent: num(game.discount),
                platforms: asArray(game.platforms),
                metacriticUrl: str(metacritic.url) || undefined,
              },
            },
            "steam",
            "game",
          );
        })
        .filter((x): x is NormalizedItem => x !== null);
    },
  },
);

/* ---------------------------------------------------- Google News (RSS) ---- */
/* news.google.com/rss/search — feed RSS público, sem chave. */
function rssField(entry: string, tag: string): string {
  const m = entry.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  const raw = m ? m[1] ?? "" : "";
  return raw
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

export const googlenews = defineAdapter(
  {
    id: "googlenews",
    label: "Google News",
    kind: "article",
    description: "Notícias do Google News (feed RSS público).",
    capabilities: ["news"],
    rateLimit: { rps: 1, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      const hl = /^[a-z]{2,3}(-[a-z]{2,3})?$/.test(options.country ?? "") ? `pt-BR` : "pt-BR";
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(options.query)}&hl=${hl}&gl=BR&ceid=BR:pt-419`;
      const resp = await fetch(url, { signal: options.signal });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp.text();
    },
    map(data: unknown): NormalizedItem[] {
      const xml = typeof data === "string" ? data : "";
      const items = xml.split("<item>").slice(1);
      return items
        .map((raw) => {
          const title = rssField(raw, "title");
          if (!title) return null;
          const link = rssField(raw, "link");
          const source = rssField(raw, "source");
          return item(
            {
              id: title,
              title,
              url: link || undefined,
              author: source || undefined,
              date: rssField(raw, "pubDate") || undefined,
              meta: {
                source: source || undefined,
                guid: rssField(raw, "guid") || undefined,
              },
            },
            "googlenews",
            "article",
          );
        })
        .filter((x): x is NormalizedItem => x !== null)
        .slice(0, cap(50));
    },
  },
);

/* ---------------------------------------------------------------- Wikidata - */
/* action=wbsearchentities — busca declarativa de entidades, sem chave. */
export const wikidata = defineAdapter(
  {
    id: "wikidata",
    label: "Wikidata",
    kind: "entity",
    description: "Entidades da base de conhecimento Wikidata (wbsearchentities).",
    capabilities: ["custom"],
    rateLimit: { rps: 1, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      const url =
        `https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=pt` +
        `&search=${encodeURIComponent(options.query)}&limit=${cap(options.limit ?? 10, 20)}`;
      return fetchJson(url, { signal: options.signal });
    },
    map(data: unknown): NormalizedItem[] {
      return asArray(asRecord(data).search)
        .map((e) => {
          const entity = asRecord(e);
          const label = str(entity.label);
          if (!label) return null;
          const id = str(entity.id);
          return item(
            {
              id: id || label,
              title: label,
              url: `https://www.wikidata.org/wiki/${id}`,
              text: str(entity.description) || undefined,
              meta: {
                entityId: id || undefined,
                language: str(entity.language) || undefined,
                aliases: asArray(entity.aliases),
              },
            },
            "wikidata",
            "entity",
          );
        })
        .filter((x): x is NormalizedItem => x !== null);
    },
  },
);

/* ---------------------------------------------------------------- OpenAlex - */
/* api.openalex.org/works — busca acadêmica pública, sem chave. */
export const openalex = defineAdapter(
  {
    id: "openalex",
    label: "OpenAlex",
    kind: "paper",
    description: "Trabalhos acadêmicos e citações (OpenAlex Works API).",
    capabilities: ["academic"],
    rateLimit: { rps: 1, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      const url = `https://api.openalex.org/works?search=${encodeURIComponent(options.query)}&per-page=${cap(options.limit ?? 10, 25)}`;
      return fetchJson(url, { signal: options.signal });
    },
    map(data: unknown): NormalizedItem[] {
      return asArray(asRecord(data).results)
        .map((w) => {
          const work = asRecord(w);
          const title = str(work.title) ?? str(work.display_name);
          if (!title) return null;
          const authorships = asArray(work.authorships);
          const first = authorships[0] ? asRecord(asRecord(authorships[0]).author) : null;
          return item(
            {
              id: str(work.id) || title,
              title,
              url: str(work.doi) || undefined,
              author: first ? str(first.display_name) || undefined : undefined,
              date: work.publication_year ? String(work.publication_year) : undefined,
              score: num(work.cited_by_count),
              meta: {
                doi: str(work.doi) || undefined,
                year: work.publication_year,
                authors: authorships
                  .map((a) => str(asRecord(asRecord(a).author).display_name))
                  .filter(Boolean)
                  .slice(0, 20),
                type: str(work.type) || undefined,
              },
            },
            "openalex",
            "paper",
          );
        })
        .filter((x): x is NormalizedItem => x !== null);
    },
  },
);

/* ----------------------------------------------------------------- Mastodon - */
/* timelines/tag público — hashtag (engine="hashtag" ou query com '#'). */
export const mastodon = defineAdapter(
  {
    id: "mastodon",
    label: "Mastodon",
    kind: "post",
    description: "Posts públicos por hashtag no Mastodon (mastodon.social).",
    capabilities: ["social"],
    rateLimit: { rps: 1, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      const tag = options.query.replace(/^#/, "").trim();
      if (!tag) throw new Error("query necessária para timeline de hashtag");
      const url = `https://mastodon.social/api/v1/timelines/tag/${encodeURIComponent(tag)}?limit=${cap(options.limit ?? 10, 25)}`;
      return fetchJson(url, { signal: options.signal });
    },
    map(data: unknown): NormalizedItem[] {
      return asArray(data)
        .map((p) => {
          const post = asRecord(p);
          const content = str(post.content);
          if (!content) return null;
          const account = asRecord(post.account);
          return item(
            {
              id: str(post.id) || str(post.uri) || content,
              title: excerpt(content, 120) ?? content.slice(0, 120),
              url: str(post.url) || str(post.uri) || undefined,
              text: excerpt(content, 500),
              author: str(account.username) || str(account.display_name) || undefined,
              date: str(post.created_at) || undefined,
              score: (num(post.reblogs_count) ?? 0) + (num(post.favourites_count) ?? 0),
              meta: {
                accountDisplay: str(account.display_name) || undefined,
                favourites: num(post.favourites_count),
                reblogs: num(post.reblogs_count),
                replies: num(post.replies_count),
              },
            },
            "mastodon",
            "post",
          );
        })
        .filter((x): x is NormalizedItem => x !== null);
    },
  },
);

/* ------------------------------------------------------------------- npm ---- */
/* registry.npmjs.org/-/v1/search — busca pública de pacotes, sem chave. */
export const npm = defineAdapter(
  {
    id: "npm",
    label: "npm",
    kind: "package",
    description: "Pacotes JavaScript (npm registry search público).",
    capabilities: ["code"],
    rateLimit: { rps: 1, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(options.query)}&size=${cap(options.limit ?? 10, 20)}`;
      return fetchJson(url, { signal: options.signal });
    },
    map(data: unknown): NormalizedItem[] {
      return asArray(asRecord(data).objects)
        .map((o) => {
          const pkg = asRecord(asRecord(o).package);
          const name = str(pkg.name);
          if (!name) return null;
          const links = asRecord(pkg.links);
          const publisher = asRecord(pkg.publisher);
          return item(
            {
              id: name,
              title: name,
              url: str(links.npm) || str(links.homepage) || undefined,
              text: str(pkg.description) || undefined,
              author: str(publisher.username) || undefined,
              date: str(pkg.date) || undefined,
              score: num(asRecord(o).searchScore) !== undefined ? Math.round(num(asRecord(o).searchScore)! * 100) : undefined,
              meta: {
                version: str(pkg.version) || undefined,
                scope: str(pkg.scope) || undefined,
                keywords: asArray(pkg.keywords),
                scoreFinal: num(asRecord(asRecord(o).score).final),
                maintanersCount: asArray(pkg.maintainers).length,
              },
            },
            "npm",
            "package",
          );
        })
        .filter((x): x is NormalizedItem => x !== null);
    },
  },
);

/* --------------------------------------------------------------- Crossref - */
/* api.crossref.org/works — busca bibliográfica pública, sem chave. */
export const crossref = defineAdapter(
  {
    id: "crossref",
    label: "Crossref",
    kind: "paper",
    description: "Publicações científicas (Crossref REST API — without key).",
    capabilities: ["academic"],
    rateLimit: { rps: 1, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      const url = `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(options.query)}&rows=${cap(options.limit ?? 10, 25)}`;
      return fetchJson(url, { signal: options.signal });
    },
    map(data: unknown): NormalizedItem[] {
      const items = asArray(asRecord(asRecord(asRecord(data).message).items));
      return items
        .map((w) => {
          const work = asRecord(w);
          const titles = asArray(work.title).map((t) => str(t)).filter(Boolean);
          const title = titles[0];
          if (!title) return null;
          const authors = asArray(work.author)
            .map((a) => {
              const author = asRecord(a);
              return [str(author.given), str(author.family)].filter(Boolean).join(" ");
            })
            .filter(Boolean);
          const dateParts = asArray(asRecord(work["published-print"])["date-parts"]);
          const yearRow = Array.isArray(dateParts[0]) ? (dateParts[0] as unknown[]) : [];
          const year = yearRow[0] != null ? String(yearRow[0]) : undefined;
          return item(
            {
              id: str(work.DOI) || title,
              title,
              url: str(work.URL) || (str(work.DOI) ? `https://doi.org/${work.DOI}` : undefined),
              text: asArray(work["container-title"]).map((c) => str(c)).filter(Boolean)[0] || undefined,
              author: authors[0],
              date: year,
              score: num(work["is-referenced-by-count"]),
              meta: {
                authors: authors.slice(0, 20),
                doi: str(work.DOI) || undefined,
                type: str(work.type) || undefined,
                journal: asArray(work["container-title"]).map((c) => str(c)).filter(Boolean)[0] || undefined,
              },
            },
            "crossref",
            "paper",
          );
        })
        .filter((x): x is NormalizedItem => x !== null);
    },
  },
);

/* ------------------------------------------------------------ Open Library - */
/* openlibrary.org/search.json — busca pública de livros, sem chave. */
export const openlibrary = defineAdapter(
  {
    id: "openlibrary",
    label: "Open Library",
    kind: "book",
    description: "Livros do Open Library (search.json público).",
    capabilities: ["custom"],
    rateLimit: { rps: 1, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(options.query)}&limit=${cap(options.limit ?? 10, 25)}`;
      return fetchJson(url, { signal: options.signal });
    },
    map(data: unknown): NormalizedItem[] {
      return asArray(asRecord(data).docs)
        .map((d) => {
          const doc = asRecord(d);
          const title = str(doc.title);
          if (!title) return null;
          const key = str(doc.key);
          const authors = asArray(doc.author_name).map((a) => str(a)).filter(Boolean);
          const firstIsbn = asArray(doc.isbn).map((i) => str(i)).filter(Boolean)[0];
          return item(
            {
              id: key || `${title}-${doc.first_publish_year ?? ""}`,
              title,
              url: key ? `https://openlibrary.org${key}` : undefined,
              text: typeof doc.first_publish_year === "number" ? String(doc.first_publish_year) : undefined,
              author: authors[0],
              meta: {
                authors: authors.slice(0, 10),
                firstPublishYear: doc.first_publish_year,
                isbn: firstIsbn || undefined,
                coverId: num(doc.cover_i),
              },
            },
            "openlibrary",
            "book",
          );
        })
        .filter((x): x is NormalizedItem => x !== null);
    },
  },
);

/* ------------------------------------------------------------------ DEV.to - */
/* API Forem pública — por tag (sem busca full-text pública; query vira tag). */
export const devto = defineAdapter(
  {
    id: "devto",
    label: "DEV Community",
    kind: "article",
    description: "Artigos dev por tag (Forem API pública — sem busca full-text).",
    capabilities: ["news", "code"],
    rateLimit: { rps: 1, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      const url = `https://dev.to/api/articles?tag=${encodeURIComponent(options.query)}&per_page=${cap(options.limit ?? 10, 30)}`;
      return fetchJson(url, { signal: options.signal });
    },
    map(data: unknown): NormalizedItem[] {
      return asArray(data)
        .map((a) => {
          const article = asRecord(a);
          const title = str(article.title);
          if (!title) return null;
          const user = asRecord(article.user);
          return item(
            {
              id: str(article.id) || title,
              title,
              url: str(article.url) || undefined,
              text: str(article.description) || undefined,
              author: str(user.name) || str(user.username) || undefined,
              date: str(article.published_at) || undefined,
              score: num(article.positive_reactions_count),
              meta: {
                comments: num(article.comments_count),
                tags: asArray(article.tags),
                readingMinutes: num(article.reading_time_minutes),
              },
            },
            "devto",
            "article",
          );
        })
        .filter((x): x is NormalizedItem => x !== null);
    },
  },
);

export const MORE_JSON_ADAPTERS = {
  bluesky,
  deezer,
  steam,
  googlenews,
  wikidata,
  openalex,
  mastodon,
  npm,
  crossref,
  openlibrary,
  devto,
} as const;

export type MoreJsonAdapterId = keyof typeof MORE_JSON_ADAPTERS;