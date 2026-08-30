/**
 * Fontes "uni" restantes da ponte (v1 → nativo, SourcePort):
 *   - suggest-provider: autocomplete multi-provedor (bing, duckduckgo, brave,
 *     yahoo, yandex, baidu, naver, amazon, ebay, wikipedia)
 *   - web: extrator universal (page / feed / text) — action via engine
 *   - lobsters: timeline de tags (newest/t/{tag}.json)
 *
 * Convenção do núcleo: nunca lança (falha vira `error` honesto na resposta),
 * map (data, options) e cap(options.limit ?? 25, 50).
 */
import type { CollectOptions, NormalizedItem } from "@v6/contracts";
import type { SourcePort } from "@v6/domain";
import { defineAdapter, item, num, str, cap } from "./base.js";
import { asArray, asRecord, fetchJson, fetchText } from "./http.js";
import { parseFeed } from "./infraSources.js";

/* ------------------------------------------------- suggest-provider ------- */

interface SuggestProviderDef {
  id: string;
  label: string;
  buildUrl: (q: string, lang: string) => string;
  parse: (root: unknown) => string[];
}

function suggestStrings(list: unknown): string[] {
  const out: string[] = [];
  for (const el of asArray(list)) {
    if (typeof el === "string") out.push(el);
    else if (typeof el === "number") out.push(String(el));
    else if (Array.isArray(el)) out.push(...suggestStrings(el));
    else {
      const r = asRecord(el);
      const v = r.k ?? r.phrase ?? r.q ?? r.sug ?? r.name ?? r.text ?? r.value;
      if (typeof v === "string") out.push(v);
    }
  }
  return out.filter((s) => s.length > 1 && !/^[)\]}]*$/.test(s));
}

const suggestProviders: SuggestProviderDef[] = [
  {
    id: "bing",
    label: "Bing",
    buildUrl: (q, lang) => `https://api.bing.com/osjson.aspx?query=${encodeURIComponent(q)}&mkt=${lang}`,
    parse: (root) => suggestStrings(asArray(root)[1]),
  },
  {
    id: "duckduckgo",
    label: "DuckDuckGo",
    buildUrl: (q) => `https://ac.duckduckgo.com/ac/?q=${encodeURIComponent(q)}&type=list&kl=wt-wt`,
    parse: (root) => {
      const plain = suggestStrings(asArray(root)[1]);
      if (plain.length > 0) return plain;
      return asArray(root).map((e) => str(asRecord(e).phrase)).filter(Boolean);
    },
  },
  {
    id: "brave",
    label: "Brave",
    buildUrl: (q) => `https://search.brave.com/api/suggest?q=${encodeURIComponent(q)}`,
    parse: (root) => suggestStrings(asArray(root)[1]),
  },
  {
    id: "yahoo",
    label: "Yahoo",
    buildUrl: (q) => `https://search.yahoo.com/sugg/gossip/gossip-us-ura/?output=sd1&command=${encodeURIComponent(q)}`,
    parse: (root) => asArray(asRecord(root).r).map((e) => str(asRecord(e).k)).filter(Boolean),
  },
  {
    id: "yandex",
    label: "Yandex",
    buildUrl: (q) => `https://suggest.yandex.com/suggest-ff.cgi?v=4&part=${encodeURIComponent(q)}&geo=tr`,
    parse: (root) => suggestStrings(asArray(root)[1]),
  },
  {
    id: "baidu",
    label: "Baidu",
    buildUrl: (q) => `https://www.baidu.com/sugrec?pre=1&p=3&ie=utf-8&json=1&prod=pc&wd=${encodeURIComponent(q)}`,
    parse: (root) => asArray(asRecord(root).s).map((e) => str(asRecord(e).q)).filter(Boolean),
  },
  {
    id: "naver",
    label: "Naver",
    buildUrl: (q) =>
      `https://ac.search.naver.com/nx/ac?q=${encodeURIComponent(q)}&con=0&frm=nv&ans=2&r_format=json&r_enc=UTF-8&st=100`,
    parse: (root) =>
      asArray(asRecord(root).items)
        .flatMap((group) => asArray(group).flatMap((tuple) => suggestStrings(asArray(tuple))))
        .filter(Boolean),
  },
  {
    id: "amazon",
    label: "Amazon",
    buildUrl: (q) =>
      `https://completion.amazon.com/api/2017/suggestions?mid=ATVPDKIKX0DER&prefix=${encodeURIComponent(q)}&alias=aps`,
    parse: (root) => asArray(asRecord(root).suggestions).map((e) => str(asRecord(e).value)).filter(Boolean),
  },
  {
    id: "ebay",
    label: "eBay",
    buildUrl: (q) => `https://autosug.ebay.com/autosug?sId=0&kwd=${encodeURIComponent(q)}&siteid=0&mfs=1&sType=1`,
    parse: (root) => asArray(asRecord(root).results).map((e) => str(e)).filter(Boolean),
  },
  {
    id: "wikipedia",
    label: "Wikipedia",
    buildUrl: (q, lang) =>
      `https://${lang.split("-")[0]}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(q)}&limit=10&format=json`,
    parse: (root) => suggestStrings(asArray(root)[1]),
  },
];

export const suggestProvider = defineAdapter(
  {
    id: "suggest-provider",
    label: "Autocomplete multi-provedor",
    kind: "suggestion",
    description: "Sugestões de autocomplete de 10 provedores públicos (engine = provedor).",
    capabilities: ["trends", "custom"],
    rateLimit: { rps: 2, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      const q = options.query.trim();
      if (!q) throw new Error("query vazia");
      const def = suggestProviders.find((p) => p.id === options.engine) ?? suggestProviders[0]!;
      const lang = options.country?.toLowerCase() === "us" || options.country?.toLowerCase() === "gb" ? "en-US" : "pt-BR";
      const url = def.buildUrl(q, lang);
      const raw = await fetchText(url, { signal: options.signal, timeoutMs: 8000 }).catch(() => "");
      let root: unknown;
      if (raw.startsWith("parseSuggestions(")) {
        root = JSON.parse(raw.slice("parseSuggestions(".length, -1)) as unknown;
      } else {
        try {
          root = JSON.parse(raw) as unknown;
        } catch {
          throw new Error(`resposta não-JSON de ${def.id} (provedor pode bloquear datacenter)`);
        }
      }
      const suggs = def.parse(root).filter((s) => s.trim().toLowerCase() !== q.trim().toLowerCase());
      if (suggs.length === 0) throw new Error(`${def.id} devolveu 0 sugestões (rate-limit/geo?)`);
      return { provider: def.id, label: def.label, suggs, query: q };
    },
    map(data: unknown): NormalizedItem[] {
      const r = asRecord(data);
      const provider = str(r.provider);
      const label = str(r.label);
      const suggs = asArray(r.suggs).map((s) => str(s)).filter(Boolean);
      return suggs.map((s, i) =>
        item(
          {
            id: `suggest-provider:${provider}:${s}`,
            title: s,
            score: Math.max(1, 1000 - i * 100),
            meta: { provider, label, query: str(r.query), relevance: Math.max(1, 1000 - i * 100) },
          },
          "suggest-provider",
          "suggestion",
        ),
      );
    },
  },
);

/* ------------------------------------------------------------------ web --- */
/* Extrator universal. engine = action: page (padrão) | feed | text | pdf. */

const MAX_BYTES = 25_000_000;
const MAX_TEXT_CHARS = 20_000;

export function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

export function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

/** Remove scripts/styles/nav/footer/aside/form antes da extração (regex, sem DOM). */
function stripNoise(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|noscript|svg|iframe)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(nav|footer|aside|form|header)[^>]*>[\s\S]*?<\/\1>/gi, " ");
}

function extractTitle(html: string): string {
  const og = stripTags(html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]*)"/i)?.[1] ?? "");
  if (og) return og;
  const tw = stripTags(html.match(/<meta[^>]+name="twitter:title"[^>]+content="([^"]*)"/i)?.[1] ?? "");
  if (tw) return tw;
  const t = stripTags(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  if (t) return t;
  const h1 = stripTags(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
  return h1;
}

/** Extrai texto de artigo: prioriza article/main, depois blocos do body. */
function extractArticle(html: string): { title: string; text: string; words: number } {
  const title = extractTitle(html);
  const scope =
    /<article[^>]*>([\s\S]*?)<\/article>/i.exec(html)?.[1] ??
    /<main[^>]*>([\s\S]*?)<\/main>/i.exec(html)?.[1] ??
    /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html)?.[1] ??
    html;
  const norm = stripNoise(scope);
  const blocks: string[] = [];
  const re = /<(p|h[1-6]|li|blockquote|pre|td)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(norm)) !== null) {
    const text = stripTags(m[2] ?? "");
    if (text.length >= 40) blocks.push(text);
  }
  const text = blocks.slice(0, 200).join("\n\n").slice(0, MAX_TEXT_CHARS);
  return { title, text, words: text.split(/\s+/).length };
}

function collectLinks(html: string, max: number): string[] {
  const out = new Set<string>();
  const re = /<a[^>]+href="([^"#]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && out.size < max) {
    const href = m[1] ?? "";
    if (/^(https?:\/\/|www\.)/i.test(href)) out.add(href);
  }
  return [...out];
}

export const web = defineAdapter(
  {
    id: "web",
    label: "Web universal (extrator)",
    kind: "document",
    description: "Extrai conteúdo de URL (engine = page|feed|text; query = URL ou texto).",
    capabilities: ["search", "custom"],
    rateLimit: { rps: 1, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      const action = options.engine || "page";
      if (action === "text") return { action, text: options.query };
      const url = options.query.trim();
      if (!/^https?:\/\//i.test(url)) throw new Error("query deve ser uma URL http(s) para page/feed");
      const raw = await fetchText(url, { signal: options.signal, timeoutMs: 30000 });
      const html = raw.slice(0, MAX_BYTES);
      if (action === "feed") return { action, url, xml: html };
      if (/^%PDF/.test(html.trimStart())) {
        throw new Error("PDF detectado — extração de PDF exige unpdf (fora do escopo nativo; use 'page' no navegador)");
      }
      const article = extractArticle(html);
      if (!article.title && !article.text) throw new Error("nenhum conteúdo textual extraído (JS-only ou página bloqueada)");
      return { action: "page", url, article, links: collectLinks(html, 50) };
    },
    map(data: unknown, options: CollectOptions): NormalizedItem[] {
      const r = asRecord(data);
      const action = str(r.action);
      const base = `web:${action}`;
      if (action === "feed") {
        return parseFeed(str(r.xml), cap(options.limit ?? 25, 100)).map((e, i) =>
          item(
            {
              id: `${base}:${i}:${e.title}`,
              title: e.title,
              url: e.url,
              text: e.text,
              author: e.author,
              date: e.date,
            },
            "web",
            "article",
          ),
        );
      }
      if (action === "text") {
        return str(r.text)
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean)
          .slice(0, cap(options.limit ?? 25, 50))
          .map((l, i) => item({ id: `${base}:${i}:${l.slice(0, 40)}`, title: l.slice(0, 120), text: l }, "web", "document"));
      }
      const article = asRecord(r.article);
      const title = str(article.title) || "Página (sem título)";
      const text = str(article.text);
      return [
        item(
          {
            id: `${base}:${encodeURIComponent(str(r.url)).slice(0, 60)}`,
            title,
            url: str(r.url) || undefined,
            text: text || undefined,
            meta: { words: num(article.words), links: asArray(r.links).length },
          },
          "web",
          "document",
        ),
      ];
    },
  },
);

/* -------------------------------------------------------------- lobsters --- */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tagFrom(q: string): string {
  return q.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

export const lobsters = defineAdapter(
  {
    id: "lobsters",
    label: "Lobsters",
    kind: "post",
    description: "Timeline do Lobsters (query = tag; vazio = /newest).",
    capabilities: ["news", "social"],
    rateLimit: { rps: 1, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      const tag = tagFrom(options.query);
      const url = tag ? `https://lobste.rs/t/${tag}.json` : "https://lobste.rs/newest.json";
      const data = await fetchJson(url, { signal: options.signal, timeoutMs: 15000 });
      if (!Array.isArray(data)) throw new Error(`resposta inesperada de lobste.rs`);
      return data;
    },
    map(data: unknown, options: CollectOptions): NormalizedItem[] {
      return asArray(data)
        .slice(0, cap(options.limit ?? 25, 50))
        .map((raw) => {
          const s = asRecord(raw);
          const title = str(s.title);
          if (!title) return null;
          const submitter = asRecord(s.submitter_user);
          return item(
            {
              id: `lobsters:${str(s.short_id)}`,
              title,
              text: str(s.description) || undefined,
              url: str(s.short_id_url) || str(s.url) || undefined,
              author: str(submitter.username) || undefined,
              date: str(s.created_at) || undefined,
              score: num(s.score),
              meta: { comments: num(s.comment_count), tags: asArray(s.tags) },
            },
            "lobsters",
            "post",
          );
        })
        .filter((x): x is NormalizedItem => x !== null);
    },
  },
);

export const uniSources: Record<string, () => SourcePort> = {
  "suggest-provider": () => suggestProvider,
  web: () => web,
  lobsters: () => lobsters,
};

export type UniSourceId = keyof typeof uniSources;