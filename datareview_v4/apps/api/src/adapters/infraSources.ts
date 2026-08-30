/**
 * Fontes de infra-estrutura e entrada manual (SourcePort). Não são "APIs de
 * dados" — são utilitárias: paste (texto do usuário), feed (qualquer RSS/Atom),
 * custom (JSON público genérico), embed-search (resolução de URL → fonte) e
 * itunes-proxy (passthrough allowlist de hostnames Apple).
 */
import type { CollectOptions, NormalizedItem } from "@v4/contracts";
import type { SourcePort } from "@v4/domain";
import { defineAdapter, item, num, str } from "./base.js";
import { asArray, asRecord, fetchJson } from "./http.js";

function stripTags(value: string): string {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .trim();
}

function field(blob: string, tag: string): string {
  const m = blob.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return m ? stripTags(m[1] ?? "") : "";
}

/** Link de RSS (<link>…</link>) ou Atom self-closing (<link href="…"/>) . */
function linkField(blob: string): string {
  const selfClosing = blob.match(/<link[^>]*?href="([^"]+)"[^>]*\/?>/i);
  if (selfClosing) return selfClosing[1] ?? "";
  return field(blob, "link").trim();
}

/** Autor RSS 2.0 pode ser "email (Nome)" → extrai o nome. */
function authorField(blob: string): string {
  const raw = field(blob, "author") || field(blob, "dc:creator");
  const named = raw.match(/^\S+\s*\(\s*([^)]+)\s*\)$/);
  return named ? (named[1] ?? "").trim() : raw;
}

/* ------------------------------------------------------------------- Paste - */
/* Texto colado vira dados Uni: cada linha = um item (query = conteúdo). */
export const paste = defineAdapter(
  {
    id: "paste",
    label: "Paste (entrada manual)",
    kind: "document",
    description: "Texto livre colado vira itens (uma linha = um item).",
    capabilities: ["custom"],
    rateLimit: { rps: 0, burst: 0 },
  },
  {
    async fetch(options: CollectOptions) {
      return { lines: options.query.split(/\r?\n/).map((l) => l.trim()).filter(Boolean) };
    },
    map(data: unknown): NormalizedItem[] {
      return asArray(asRecord(data).lines).map((l, i) => {
        const content = str(l);
        return item({ id: `paste-${i}-${content.slice(0, 40)}`, title: content.slice(0, 120) || "(linha vazia)", text: content }, "paste", "document");
      });
    },
  },
);

/* Generic RSS/Atom parser (compartilhado: feed, trending RSS, podcasts). */
export interface FeedEntry {
  title: string;
  url?: string;
  text?: string;
  author?: string;
  date?: string;
  id?: string;
}

export function parseFeed(xml: string, max = 50): FeedEntry[] {
  const isAtom = /<feed[\s>]/.test(xml);
  const raw = xml.split(isAtom ? "<entry" : "<item").slice(1);
  return raw
    .map((blob): FeedEntry | null => {
      const title = field(blob, "title");
      if (!title) return null;
      const link = linkField(blob);
      return {
        title,
        url: link || undefined,
        text: field(blob, "summary") || field(blob, "description") || field(blob, "content:encoded") || field(blob, "content") || undefined,
        author: authorField(blob) || undefined,
        date: field(blob, "published") || field(blob, "updated") || field(blob, "pubDate") || undefined,
        id: field(blob, "id") || field(blob, "guid") || link || undefined,
      } satisfies FeedEntry;
    })
    .filter((e): e is FeedEntry => e !== null)
    .slice(0, max);
}

/* ----------------------------------------------------------- Feed (RSS) ---- */
/* query = URL do feed (RSS 2.0 / Atom 1.0) — genérico. */
export const feed = defineAdapter(
  {
    id: "feed",
    label: "RSS/Atom (feed monitor)",
    kind: "article",
    description: "Qualquer feed RSS 2.0 ou Atom 1.0 (query = URL do feed).",
    capabilities: ["news", "custom"],
    rateLimit: { rps: 1, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      const url = options.query.trim();
      if (!/^https?:\/\//i.test(url)) throw new Error("query deve ser uma URL de feed (ex.: https://…/feed)");
      const resp = await fetch(url, { signal: options.signal });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp.text();
    },
    map(data: unknown): NormalizedItem[] {
      return parseFeed(typeof data === "string" ? data : "").map((e) =>
        item({ id: e.id ?? e.title, title: e.title, url: e.url, text: e.text, author: e.author, date: e.date }, "feed", "article"),
      );
    },
  },
);

/* ---------------------------------------------------- custom (JSON) -------- */
/* query = URL de um JSON público qualquer → normaliza heuristicamente. */
function slurp(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "object" && value !== null) {
    const root = value as Record<string, unknown>;
    for (const k of ["data", "items", "results", "docs", "posts", "works", "objects"]) {
      const v = root[k];
      if (Array.isArray(v)) return v;
      if (typeof v === "object" && v !== null) return [v];
    }
    return [root];
  }
  return [];
}

function pick(row: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}

function bestName(row: Record<string, unknown>): string | undefined {
  const raw = pick(row, ["title", "name", "text", "headline", "label", "login"]);
  if (typeof raw === "string") return raw;
  if (typeof raw === "number") return String(raw);
  if (typeof raw === "object" && raw !== null) {
    const sub = raw as Record<string, unknown>;
    return bestName(sub) ?? JSON.stringify(sub).slice(0, 200);
  }
  return undefined;
}

export const custom = defineAdapter(
  {
    id: "custom",
    label: "Fontes customizadas (JSON genérico)",
    kind: "document",
    description: "Qualquer API pública JSON (query = URL): normaliza itens por heurística.",
    capabilities: ["custom"],
    rateLimit: { rps: 1, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      const url = options.query.trim();
      if (!/^https?:\/\//i.test(url)) throw new Error("query deve ser uma URL de JSON público");
      return fetchJson(url, { signal: options.signal, timeoutMs: 20000 });
    },
    map(data: unknown): NormalizedItem[] {
      return slurp(data)
        .slice(0, 50)
        .map((row) => {
          const r = asRecord(row);
          const title = bestName(r);
          if (!title) return null;
          const rawUrl = pick(r, ["url", "link", "html_url", "web_url", "trackViewUrl", "permalink"]);
          const url = typeof rawUrl === "string" ? rawUrl.replace(/^at:\/\//, "https://bsky.app/profile/") : undefined;
          const rawAuthor = pick(r, ["author", "user", "submitter", "artist"]);
          const authorName =
            typeof rawAuthor === "object" && rawAuthor !== null
              ? (pick(rawAuthor as Record<string, unknown>, ["name", "login", "username", "display_name"]) as unknown)
              : rawAuthor;
          const score = num(pick(r, ["score", "stars", "upvotes", "points", "favorites_count"]));
          return item(
            {
              id: str(pick(r, ["id", "uri", "guid", "objectID", "slug", "key", "name"])) || title,
              title,
              url,
              text: str(pick(r, ["description", "summary", "snippet", "abstract", "body", "text"])),
              author: typeof authorName === "string" ? authorName : undefined,
              date: str(pick(r, ["date", "created_at", "updated_at", "published_at", "indexedAt", "published"])),
              score,
            },
            "custom",
            "document",
          );
        })
        .filter((x): x is NormalizedItem => x !== null);
    },
  },
);

/* ------------------------------------------------------- embed-search ------- */
/* query = URL → resolve {kind, id, apiUrl, fanoutTerm} (roteador de URL). */
interface Resolved {
  kind: string;
  id: string;
  apiUrl: string;
  fanoutTerm: string;
}

const URL_RESOLVERS: Array<{ re: RegExp; kind: string; resolve: (m: RegExpMatchArray) => Resolved }> = [
  { re: /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/i, kind: "youtube", resolve: (m) => ({ kind: "youtube", id: m[1]!, apiUrl: `https://www.youtube.com/watch?v=${m[1]}`, fanoutTerm: m[1]! }) },
  { re: /^https?:\/\/([\w-]+)\.wikipedia\.org\/wiki\/(.+)$/i, kind: "wikipedia", resolve: (m) => ({ kind: "wikipedia", id: m[2]!.replaceAll("_", " "), apiUrl: "https://pt.wikipedia.org/w/api.php", fanoutTerm: m[2]!.replaceAll("_", " ") }) },
  { re: /^https?:\/\/(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+)\/?$/i, kind: "github", resolve: (m) => ({ kind: "github", id: `${m[1]}/${m[2]}`, apiUrl: "https://api.github.com/search/repositories", fanoutTerm: m[2]! }) },
  { re: /^https?:\/\/(?:www\.)?npmjs\.com\/package\/([\w@./-]+)/i, kind: "npm", resolve: (m) => ({ kind: "npm", id: m[1]!, apiUrl: "https://registry.npmjs.org/-/v1/search", fanoutTerm: m[1]! }) },
  { re: /^https?:\/\/pypi\.org\/project\/([\w.-]+)/i, kind: "pypi", resolve: (m) => ({ kind: "pypi", id: m[1]!, apiUrl: `https://pypi.org/pypi/${m[1]}/json`, fanoutTerm: m[1]! }) },
  { re: /^https?:\/\/(?:dx\.)?doi\.org\/(.+)$/i, kind: "doi", resolve: (m) => ({ kind: "doi", id: m[1]!, apiUrl: `https://api.crossref.org/works/${m[1]}`, fanoutTerm: m[1]! }) },
  { re: /^https?:\/\/(?:itunes|apps)\.apple\.com\/[^/]+\/(?:app\/[\w-]+\/id|show\/[\w-]+\/id)(\d+)/i, kind: "apple", resolve: (m) => ({ kind: "apple", id: m[1]!, apiUrl: "https://itunes.apple.com/search?media=software", fanoutTerm: m[1]! }) },
  { re: /^https?:\/\/play\.google\.com\/store\/apps\/details\?id=([\w.]+)/i, kind: "googleplay", resolve: (m) => ({ kind: "googleplay", id: m[1]!, apiUrl: "https://play.google.com/store/apps/details", fanoutTerm: m[1]! }) },
  { re: /^https?:\/\/store\.steampowered\.com\/app\/(\d+)/i, kind: "steam", resolve: (m) => ({ kind: "steam", id: m[1]!, apiUrl: "https://store.steampowered.com/api/storesearch/", fanoutTerm: m[1]! }) },
  { re: /^https?:\/\/openlibrary\.org\/(?:works|books)\/([\w]+)/i, kind: "openlibrary", resolve: (m) => ({ kind: "openlibrary", id: m[1]!, apiUrl: "https://openlibrary.org/search.json", fanoutTerm: m[1]! }) },
  { re: /^https?:\/\/(?:www\.)?reddit\.com\/r\/([\w]+)/i, kind: "reddit", resolve: (m) => ({ kind: "reddit", id: `r/${m[1]}`, apiUrl: "https://www.reddit.com/search.json", fanoutTerm: m[1]! }) },
  { re: /^@([\w.-]+)@([\w.-]+)$/i, kind: "mastodon", resolve: (m) => ({ kind: "mastodon", id: `@${m[1]}@${m[2]}`, apiUrl: `https://${m[2]}/api/v1/accounts/lookup`, fanoutTerm: m[1]! }) },
];

export const embedSearch = defineAdapter(
  {
    id: "embed-search",
    label: "Resolução de URL (fanout)",
    kind: "document",
    description: "Roteador de URL → fonte canônica (youtube/wikipedia/github/npm/pypi/doi/apple/google/steam/openlibrary/reddit/mastodon).",
    capabilities: ["custom"],
    rateLimit: { rps: 0, burst: 0 },
  },
  {
    async fetch(options: CollectOptions) {
      const url = options.query.trim();
      for (const r of URL_RESOLVERS) {
        const m = url.match(r.re);
        if (m) return r.resolve(m);
      }
      throw new Error("URL não reconhecida (tente youtube/wikipedia/github/npm/pypi/doi/apple/google/steam/openlibrary/reddit/mastodon)");
    },
    map(data: unknown): NormalizedItem[] {
      const r = asRecord(data);
      return [
        item(
          {
            id: str(r.id) || "unk",
            title: `${str(r.kind)}: ${str(r.id)}`,
            url: str(r.apiUrl) || undefined,
            meta: { kind: str(r.kind), id: str(r.id), apiUrl: str(r.apiUrl), fanoutTerm: str(r.fanoutTerm) },
          },
          "embed-search",
          "document",
        ),
      ];
    },
  },
);

/* ------------------------------------------------------ itunes-proxy ------- */
/* Passthrough só para hostnames Apple permitidos (query = URL completa). */
export const itunesProxy = defineAdapter(
  {
    id: "itunes-proxy",
    label: "iTunes/Apple proxy (passthrough)",
    kind: "document",
    description: "Proxy pass-through para hostnames Apple permitidos (query = URL).",
    capabilities: ["custom"],
    rateLimit: { rps: 1, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      const url = options.query.trim();
      if (!/^https:\/\/(itunes|apps)\.apple\.com\//i.test(url)) {
        throw new Error("apenas hostnames permitidos: itunes.apple.com / apps.apple.com");
      }
      const resp = await fetch(url, { signal: options.signal });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return { url, text: (await resp.text().catch(() => "")).slice(0, 20000) };
    },
    map(data: unknown): NormalizedItem[] {
      const r = asRecord(data);
      return [
        item(
          {
            id: str(r.url) || "itunes",
            title: str(r.url) || "itunes response",
            text: str(r.text) || undefined,
            meta: { raw: str(r.text)?.slice(0, 2000) || undefined },
          },
          "itunes-proxy",
          "document",
        ),
      ];
    },
  },
);

/** Infra/manual: factories sem chave (assignable a AdapterFactory). */
export const INFRA_ADAPTERS: Record<string, () => SourcePort> = {
  paste: () => paste,
  feed: () => feed,
  custom: () => custom,
  "embed-search": () => embedSearch,
  "itunes-proxy": () => itunesProxy,
};

export type InfraAdapterId = keyof typeof INFRA_ADAPTERS;