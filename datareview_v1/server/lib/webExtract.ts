/**
 * Núcleo puro de extração para os coletores universais (página `/00` Uni):
 * - extractArticle: HTML → título + texto legível + metadados (estilo Readability)
 * - parseFeed: XML RSS 2.0 / Atom → itens normalizados
 * - splitTextItems: texto colado (.md/.txt/.json/.csv) → itens normalizados
 *
 * Sem I/O de rede aqui — o fetch fica na rota. Usa cheerio (HTML/XML).
 */
import * as cheerio from "cheerio";

const MAX_TEXT_CHARS = 20000;
const MAX_FEED_ITEMS = 100;

export interface WebArticle {
  title: string;
  text: string;
  url: string;
  siteName: string;
  author: string;
  publishedAt: string;
  description: string;
  lang: string;
  words: number;
}

const REMOVE_SEL =
  "script, style, noscript, iframe, svg, canvas, video, audio, form, button, select, input, nav, footer, aside, [role=navigation], [role=banner], [role=complementary], [aria-hidden=true], .ad, .ads, .advertisement, .social-share, .comments, #comments, .cookie, .popup, .modal, .newsletter";

function metaContent($: cheerio.CheerioAPI, ...names: string[]): string {
  for (const n of names) {
    const v =
      $(`meta[property="${n}"]`).attr("content") ??
      $(`meta[name="${n}"]`).attr("content") ??
      "";
    if (v) return v.trim();
  }
  return "";
}

/** Extrai o conteúdo legível de uma página HTML (estilo Readability simplificado). */
export function extractArticle(html: string, url: string): WebArticle {
  const $ = cheerio.load(html);
  $(REMOVE_SEL).remove();

  const title =
    metaContent($, "og:title", "twitter:title") ||
    $("h1").first().text().trim() ||
    $("title").text().trim();
  const description = metaContent($, "og:description", "twitter:description", "description");
  const author = metaContent($, "author", "article:author", "og:article:author", "byl");
  const publishedAt = metaContent(
    $,
    "article:published_time",
    "og:published_time",
    "datePublished",
    "date",
    "pubdate",
    "publishdate",
  );
  const siteName = metaContent($, "og:site_name", "application-name");
  const lang = $("html").attr("lang") ?? "";

  // Candidatos de conteúdo: <article>, <main>, [role=main], senão body.
  const scope = $("article, main, [role=main]").first();
  const root = scope.length ? scope : $("body");

  // Blocos de texto: parágrafos/cabeçalhos/listas dentro do escopo.
  const blocks: string[] = [];
  root.find("p, h1, h2, h3, h4, li, blockquote, pre, td").each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    // Ignora blocos curtos (menus, breadcrumbs) e duplicados.
    if (t.length >= 40 && !blocks.includes(t)) blocks.push(t);
  });

  let text = blocks.join("\n\n");
  if (!text) {
    // Fallback: texto bruto do body (páginas com estrutura atípica).
    text = $("body").text().replace(/\s+/g, " ").trim();
  }
  if (text.length > MAX_TEXT_CHARS) text = `${text.slice(0, MAX_TEXT_CHARS)}…`;

  return {
    title: title.slice(0, 300),
    text,
    url,
    siteName,
    author,
    publishedAt,
    description: description.slice(0, 500),
    lang,
    words: text ? text.split(/\s+/).length : 0,
  };
}

export interface FeedItem {
  title: string;
  url: string;
  date: string;
  text: string;
  author: string;
}

function stripCdata(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
}

/** Parse genérico de RSS 2.0 e Atom (cobre blogs, Google News RSS, fóruns…). */
export function parseFeed(xml: string, limit = MAX_FEED_ITEMS): FeedItem[] {
  const $ = cheerio.load(xml, { xml: true });
  const items: FeedItem[] = [];
  const clean = (s: string) =>
    cheerio.load(stripCdata(s)).text().replace(/\s+/g, " ").trim();

  // RSS 2.0: <channel><item>
  $("item").each((_, el) => {
    if (items.length >= limit) return;
    const $el = $(el);
    const title = clean($el.find("title").first().text());
    const url = $el.find("link").first().text().trim() || $el.find("guid").first().text().trim();
    const date = $el.find("pubDate").first().text().trim() || $el.find("dc\\:date, date").first().text().trim();
    const text = clean($el.find("description").first().text());
    const author = clean($el.find("author, dc\\:creator").first().text());
    if (title || url) items.push({ title, url, date, text, author });
  });

  // Atom: <feed><entry>
  if (!items.length) {
    $("entry").each((_, el) => {
      if (items.length >= limit) return;
      const $el = $(el);
      const title = clean($el.find("title").first().text());
      const url = $el.find("link[href]").first().attr("href") ?? "";
      const date =
        $el.find("published").first().text().trim() || $el.find("updated").first().text().trim();
      const text = clean($el.find("summary, content").first().text());
      const author = clean($el.find("author > name").first().text());
      if (title || url) items.push({ title, url, date, text, author });
    });
  }

  return items;
}

export interface TextItem {
  title: string;
  text: string;
  meta?: Record<string, string>;
}

/** Divide texto colado em itens: markdown (por heading), JSON (array/objetos),
 * CSV (por linha) ou texto plano (por parágrafo ~500 chars). */
export function splitTextItems(input: string, format: "auto" | "md" | "txt" | "json" | "csv"): TextItem[] {
  const fmt = format === "auto" ? detectFormat(input) : format;
  if (fmt === "json") return splitJson(input);
  if (fmt === "csv") return splitCsv(input);
  if (fmt === "md") return splitMarkdown(input);
  return splitPlain(input);
}

function detectFormat(input: string): "md" | "txt" | "json" | "csv" {
  const t = input.trim();
  if ((t.startsWith("[") && t.endsWith("]")) || (t.startsWith("{") && t.endsWith("}"))) return "json";
  if (/^#{1,6}\s/m.test(t)) return "md";
  const firstLine = t.split("\n", 1)[0];
  if (firstLine.includes(",") && firstLine.split(",").length >= 3 && t.split("\n").length >= 3) return "csv";
  return "txt";
}

function splitMarkdown(input: string): TextItem[] {
  const out: TextItem[] = [];
  const parts = input.split(/^(?=#{1,6}\s)/m);
  for (const part of parts) {
    const t = part.trim();
    if (!t) continue;
    const head = /^#{1,6}\s+(.+)$/m.exec(t);
    const title = head ? head[1].trim() : t.slice(0, 80);
    out.push({ title: title.slice(0, 200), text: t });
  }
  return out;
}

function splitPlain(input: string): TextItem[] {
  const out: TextItem[] = [];
  const paras = input.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  let buf: string[] = [];
  let idx = 0;
  const flush = () => {
    if (!buf.length) return;
    const text = buf.join("\n\n");
    out.push({ title: text.slice(0, 80), text });
    buf = [];
    idx++;
  };
  for (const p of paras) {
    buf.push(p);
    if (buf.join("\n\n").length >= 1500) flush();
  }
  flush();
  return out.slice(0, MAX_FEED_ITEMS);
}

function splitJson(input: string): TextItem[] {
  try {
    const data = JSON.parse(input) as unknown;
    const arr = Array.isArray(data) ? data : [data];
    return arr.slice(0, MAX_FEED_ITEMS).map((v, i) => {
      if (v && typeof v === "object") {
        const o = v as Record<string, unknown>;
        const title = String(o.title ?? o.name ?? o.id ?? `item ${i + 1}`);
        const text = String(o.text ?? o.body ?? o.description ?? o.content ?? JSON.stringify(o, null, 2));
        return { title: title.slice(0, 200), text: text.slice(0, MAX_TEXT_CHARS) };
      }
      return { title: `item ${i + 1}`, text: String(v) };
    });
  } catch {
    return splitPlain(input);
  }
}

function splitCsv(input: string): TextItem[] {
  const lines = input.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return splitPlain(input);
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const out: TextItem[] = [];
  for (const line of lines.slice(1, MAX_FEED_ITEMS + 1)) {
    const cells = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const meta: Record<string, string> = {};
    headers.forEach((h, i) => {
      if (cells[i]) meta[h] = cells[i];
    });
    const title = cells[0] ?? `linha ${out.length + 1}`;
    out.push({ title: title.slice(0, 200), text: cells.join(" — "), meta });
  }
  return out;
}
