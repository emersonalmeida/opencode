/**
 * Lote 6 de adaptadores reais (SourcePort) — mídia/conhecimento: Internet
 * Archive, TVMaze, Open Food Facts, Apple Podcasts (iTunes charts), Product
 * Hunt (feed público) e itch.io (scraping search). Convenção: fetch+map.
 */
import type { CollectOptions, NormalizedItem } from "@v4/contracts";
import { cap, defineAdapter, item, num, str } from "./base.js";
import { asArray, asRecord, fetchJson, fetchText } from "./http.js";
import { parseFeed } from "./infraSources.js";

function excerpt(value: string, max = 220): string | undefined {
  const clean = value.trim();
  return clean ? clean.slice(0, max) : undefined;
}

/* ----------------------------------------------------------- Internet Archive - */
/* archive.org/advancedsearch.php — busca pública (output=json), sem chave. */
export const archive = defineAdapter(
  {
    id: "archive",
    label: "Internet Archive",
    kind: "document",
    description: "Busca pública no Internet Archive (livros, áudio, vídeo, texto).",
    capabilities: ["media"],
    rateLimit: { rps: 1, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      const q = encodeURIComponent(options.query);
      const type = options.engine?.trim() ? ` AND mediatype:${encodeURIComponent(options.engine.trim())}` : "";
      const url = `https://archive.org/advancedsearch.php?q=${q}${type}&rows=${cap(options.limit ?? 25, 50)}&output=json`;
      return fetchJson(url, { signal: options.signal, timeoutMs: 15000 });
    },
    map(data: unknown): NormalizedItem[] {
      const docs = asArray(asRecord(asRecord(data).response).docs);
      return docs
        .map((d) => {
          const doc = asRecord(d);
          const title = str(doc.title);
          if (!title) return null;
          const identifier = str(doc.identifier);
          return item(
            {
              id: identifier || title,
              title,
              url: identifier ? `https://archive.org/details/${encodeURIComponent(identifier)}` : undefined,
              text: excerpt(str(doc.description)),
              author: str(doc.creator) || undefined,
              date: str(doc.date) || str(doc.year) || undefined,
              score: num(doc.downloads),
              meta: {
                identifier: identifier || undefined,
                mediaType: str(doc.mediatype) || str(doc.type) || undefined,
                downloads: num(doc.downloads),
              },
            },
            "archive",
            "document",
          );
        })
        .filter((x): x is NormalizedItem => x !== null);
    },
  },
);

/* ------------------------------------------------------------------- TVMaze - */
/* api.tvmaze.com/search/shows — busca pública de séries, sem chave. */
export const tvmaze = defineAdapter(
  {
    id: "tvmaze",
    label: "TVMaze",
    kind: "series",
    description: "Busca pública de séries de TV (query = termo).",
    capabilities: ["media"],
    rateLimit: { rps: 1, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      return fetchJson(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(options.query)}`, {
        signal: options.signal,
        timeoutMs: 15000,
      });
    },
    map(data: unknown): NormalizedItem[] {
      return asArray(data)
        .map((hit) => {
          const show = asRecord(asRecord(hit).show);
          const name = str(show.name);
          if (!name) return null;
          const rating = asRecord(show.rating);
          const score = num(rating.average);
          return item(
            {
              id: `tvmaze:${str(show.id)}`,
              title: name,
              url: str(show.url) || undefined,
              text: excerpt(str(show.summary)),
              date: str(show.premiered) || undefined,
              score,
              meta: {
                genres: asArray(show.genres),
                status: str(show.status) || undefined,
                premiered: str(show.premiered) || undefined,
                language: str(show.language) || undefined,
                image: str(asRecord(show.image).medium) || undefined,
              },
            },
            "tvmaze",
            "series",
          );
        })
        .filter((x): x is NormalizedItem => x !== null);
    },
  },
);

/* ----------------------------------------------------------- Open Food Facts - */
/* world.openfoodfacts.org/cgi/search.pl?json=1 — busca pública (OpenFoodFacts ODBL). */
export const openfoodfacts = defineAdapter(
  {
    id: "openfoodfacts",
    label: "Open Food Facts",
    kind: "product",
    description: "Busca pública de produtos alimentícios (query = nome/marca).",
    capabilities: ["custom"],
    rateLimit: { rps: 1, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      const url =
        `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(options.query)}&search_simple=1&action=process&json=1&page_size=${cap(options.limit ?? 25, 50)}`;
      // OFF responde 503 a QUALQUER header Accept → sem Accept (noAccept).
      return fetchJson(url, { signal: options.signal, timeoutMs: 15000, noAccept: true });
    },
    map(data: unknown): NormalizedItem[] {
      return asArray(asRecord(data).products)
        .map((p) => {
          const product = asRecord(p);
          const name = str(product.product_name);
          if (!name) return null;
          const code = str(product.code);
          const brands = str(product.brands);
          const ingredients = str(product.ingredients_text);
          const text = ingredients ? excerpt(ingredients) : brands ? `Marca: ${brands}` : undefined;
          return item(
            {
              id: code || name,
              title: name,
              url: `https://world.openfoodfacts.org/product/${encodeURIComponent(code || name)}`,
              text,
              meta: {
                code: code || undefined,
                brands: brands || undefined,
                nutriscore: str(product.nutriscore_grade) || undefined,
                nova: num(product.nova_group),
                categories: asArray(product.categories_tags).map((c) => str(c).replace(/^en:/, "")).slice(0, 8),
                image: str(product.image_url) || undefined,
              },
            },
            "openfoodfacts",
            "product",
          );
        })
        .filter((x): x is NormalizedItem => x !== null);
    },
  },
);

/* ------------------------------------------------------- Apple Podcasts charts - */
/* itunes.apple.com/{cc}/rss/toppodcasts/limit={n}/json — charts públicos. */
export const podcasts = defineAdapter(
  {
    id: "podcasts",
    label: "Apple Podcasts (charts)",
    kind: "podcast",
    description: "Top podcasts da Apple por país (sem query; country opcional).",
    capabilities: ["media"],
    rateLimit: { rps: 1, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      const cc = /^[a-z]{2}$/i.test(options.country?.trim() || "") ? (options.country as string).trim() : "br";
      const url = `https://itunes.apple.com/${cc}/rss/toppodcasts/limit=${cap(options.limit ?? 25, 50)}/json`;
      return fetchJson(url, { signal: options.signal, timeoutMs: 15000 });
    },
    map(data: unknown): NormalizedItem[] {
      const entries = asArray(asRecord(asRecord(data).feed).entry);
      return entries
        .map((e, i) => {
          const entry = asRecord(e);
          const title = str(asRecord(entry.title).label);
          if (!title) return null;
          const artist = str(asRecord(entry["im:artist"]).label);
          const images = asArray(entry["im:image"]).map((img) => str(asRecord(img).label));
          return item(
            {
              id: str(asRecord(entry.id).label) || title,
              title,
              url: str(asRecord(entry.id).label) || undefined,
              text: artist ? `Podcast por ${artist}.` : undefined,
              author: artist || undefined,
              score: i + 1,
              meta: {
                rank: i + 1,
                artist,
                feedUrl: str(asRecord(entry["im:contentType"]).label) || undefined,
                artwork: images[images.length - 1] || undefined,
              },
            },
            "podcasts",
            "podcast",
          );
        })
        .filter((x): x is NormalizedItem => x !== null);
    },
  },
);

/* ----------------------------------------------------------- Product Hunt - */
/* producthunt.com/feed — feed público Atom/RSS (sem chave); engine = categoria. */
export const producthunt = defineAdapter(
  {
    id: "producthunt",
    label: "Product Hunt",
    kind: "product",
    description: "Lançamentos do Product Hunt (feed público; engine = categoria).",
    capabilities: ["media", "news"],
    rateLimit: { rps: 1, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      const category = options.engine?.trim() ? `?category=${encodeURIComponent(options.engine.trim())}` : "";
      const url = `https://www.producthunt.com/feed${category}`;
      const resp = await fetch(url, { signal: options.signal });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp.text();
    },
    map(data: unknown, options: CollectOptions): NormalizedItem[] {
      return parseFeed(typeof data === "string" ? data : "", cap(options.limit ?? 25, 50))
        .map((e, index) => {
          // Título do feed costuma ser "Nome — Tagline".
          return item(
            {
              id: e.id ?? e.title,
              title: e.title,
              url: e.url,
              text: e.text,
              date: e.date,
              score: undefined,
              meta: { rank: index + 1, feedSource: "producthunt.com/feed" },
            },
            "producthunt",
            "product",
          );
        });
    },
  },
);

/* ------------------------------------------------------------------- itch.io - */
/* scraping itch.io/search — extração conservadora de títulos/preços do HTML. */
function htmlUnescape(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .trim();
}

export const itchio = defineAdapter(
  {
    id: "itchio",
    label: "itch.io",
    kind: "game",
    description: "Busca de jogos no itch.io (scraping conservador do HTML).",
    capabilities: ["media"],
    rateLimit: { rps: 1, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      return fetchText(`https://itch.io/search?q=${encodeURIComponent(options.query)}`, {
        signal: options.signal,
        timeoutMs: 15000,
      });
    },
    map(data: unknown, options: CollectOptions): NormalizedItem[] {
      const html = typeof data === "string" ? data : "";
      const cards: NormalizedItem[] = [];
      // Âncora inteira por match (ordem de atributos pode variar); extrai href/label depois.
      const re = /<a\b[^>]*\bclass="[^"]*title game_link[^"]*"[^>]*>[\s\S]*?<\/a>/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(html)) !== null && cards.length < cap(options.limit ?? 25, 50)) {
        const anchor = m[0] ?? "";
        const hrefMatch = anchor.match(/href="([^"]+)"/i);
        const labelMatch = anchor.match(/>\s*([\s\S]*?)<\/a>/i);
        const title = htmlUnescape(str(labelMatch?.[1]).replace(/<[^>]+>/g, "")).trim();
        if (!title) continue;
        const href = str(hrefMatch?.[1]);
        cards.push(
          item(
            {
              id: href || title,
              title,
              url: href.startsWith("http") ? href : `https://itch.io${href}`,
              meta: { searchResult: true },
            },
            "itchio",
            "game",
          ),
        );
      }
      if (cards.length === 0) {
        throw new Error("nenhum jogo extraído (estrutura do itch.io mudou ou resultado vazio)");
      }
      return cards;
    },
  },
);

export const mediaSources = {
  archive: () => archive,
  tvmaze: () => tvmaze,
  openfoodfacts: () => openfoodfacts,
  podcasts: () => podcasts,
  producthunt: () => producthunt,
  itchio: () => itchio,
};
export type MediaSourceId = keyof typeof mediaSources;