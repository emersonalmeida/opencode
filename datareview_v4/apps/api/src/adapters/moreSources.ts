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
    description: "Jogos da loja Steam (StoreSearch API — sem chave).",
    capabilities: ["media"],
    rateLimit: { rps: 1, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      const cc = /^[a-z]{2}$/.test(options.country ?? "") ? options.country : "br";
      const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(options.query)}&cc=${cc}&l=english`;
      return fetchJson(url, { signal: options.signal });
    },
    map(data: unknown): NormalizedItem[] {
      return asArray(asRecord(data).items)
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
              url: appId ? `https://store.steampowered.com/app/${appId}/` : undefined,
              text: game.discount ? `${str(price.currency)} ${final !== undefined ? (final / 100).toFixed(2) : "?"}${game.discount ? ` (${str(game.discount)}% off)` : ""}` : undefined,
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

export const MORE_JSON_ADAPTERS = {
  bluesky,
  deezer,
  steam,
  googlenews,
  wikidata,
  openalex,
  mastodon,
} as const;

export type MoreJsonAdapterId = keyof typeof MORE_JSON_ADAPTERS;