/**
 * SERP multi-engine (ponte v1 → SourcePort):
 *   - bing:         scraping HTML público (sem chave)
 *   - duckduckgo:   html.duckduckgo.com (sem chave; anti-bot = erro honesto)
 *   - brave:        API oficial — exige BRAVE_API_KEY (env do servidor)
 *   - google:       Custom Search API — exige GOOGLE_API_KEY + GOOGLE_CX
 *
 * engine = seletor: auto|bing|duckduckgo|brave|google; engine="content" extrai
 * o texto de uma URL (action content do v1). Convenção: nunca lança; falha de
 * UMA engine não derruba as demais em modo auto (merge com dedup por URL).
 */
import type { CollectOptions, NormalizedItem } from "@v4/contracts";
import type { SourcePort } from "@v4/domain";
import type { ApiKeys } from "../keys.js";
import { getKey, hasKeys } from "../keys.js";
import { cap, defineAdapter, item, num, str } from "./base.js";
import { asArray, asRecord, fetchText } from "./http.js";
import { stripTags } from "./uni.js";

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

/** Decodificador HTML (named comuns do pt-BR + numéricas dec/hex). */
const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ccedil: "ç", Ccedil: "Ç",
  atilde: "ã", Atilde: "Ã", otilde: "õ", Otilde: "Õ", aacute: "á", eacute: "é",
  iacute: "í", oacute: "ó", uacute: "ú", Aacute: "Á", Eacute: "É", Iacute: "Í",
  Oacute: "Ó", Uacute: "Ú", acirc: "â", ecirc: "ê", ocirc: "ô", Acirc: "Â",
  Ecirc: "Ê", Ocirc: "Ô", agrave: "à", Agrave: "À", hellip: "…", mdash: "—",
  ndash: "–", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", laquo: "«", raquo: "»",
};
function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => NAMED[name] ?? m);
}

function clean(s: string): string {
  return decodeEntities(stripTags(s));
}

interface SerpResult {
  engine: string;
  rank: number;
  title: string;
  link: string;
  snippet?: string;
}

/** Bing embrulha links em bing.com/ck/a?...&u=a1<base64url>. */
function decodeBingLink(href: string): string {
  try {
    const u = new URL(decodeEntities(href)).searchParams.get("u");
    if (u?.startsWith("a1")) {
      const b64 = u.slice(2).replace(/-/g, "+").replace(/_/g, "/");
      return Buffer.from(b64, "base64").toString("utf8");
    }
  } catch {
    /* link direto — mantém como veio */
  }
  return decodeEntities(href);
}

async function searchBing(query: string, region: string, lang: string, limit: number): Promise<SerpResult[]> {
  const params = new URLSearchParams({ q: query, cc: region, setlang: lang, count: String(Math.min(limit, 30)) });
  const url = `https://www.bing.com/search?${params.toString()}`;
  let html = "";
  let cookieHeader = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const resp = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html", ...(cookieHeader ? { Cookie: cookieHeader } : {}) },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) return [];
    cookieHeader = (resp.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
    html = await resp.text();
    if (html.includes('class="b_algo"')) break;
  }
  const results: SerpResult[] = [];
  for (const block of html.split('<li class="b_algo"').slice(1)) {
    const m = block.match(/<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!m) continue;
    const link = decodeBingLink(m[1] as string);
    const title = clean(m[2] as string);
    const snip = block.match(/class="b_lineclamp\d+"[^>]*>([\s\S]*?)<\/p>/);
    const snippet = snip ? clean(snip[1] as string) : undefined;
    if (title && link) results.push({ engine: "bing", rank: results.length + 1, title, link, snippet });
    if (results.length >= limit) break;
  }
  return results;
}

async function searchDuckDuckGo(query: string, region: string, limit: number): Promise<SerpResult[]> {
  const params = new URLSearchParams({ q: query, kl: `${region}-${region === "br" ? "pt" : region}` });
  const resp = await fetch(`https://html.duckduckgo.com/html/?${params.toString()}`, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`duckduckgo http ${resp.status}`);
  const html = await resp.text();
  if (html.includes("anomaly-modal")) {
    throw new Error("duckduckgo bloqueou este IP (modal anti-bot) — tente novamente mais tarde");
  }
  const results: SerpResult[] = [];
  const linkRe = /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) && results.length < limit) {
    let link = decodeEntities(m[1] as string);
    try {
      const uddg = new URL(link, "https://duckduckgo.com").searchParams.get("uddg");
      if (uddg) link = uddg;
    } catch {
      /* mantém */
    }
    if (link.includes("duckduckgo.com/y.js")) continue; // anúncios
    results.push({ engine: "duckduckgo", rank: results.length + 1, title: clean(m[2] as string), link });
  }
  return results;
}

async function searchBrave(query: string, region: string, limit: number, key: string): Promise<SerpResult[]> {
  const params = new URLSearchParams({ q: query, count: String(Math.min(limit, 20)), country: region });
  const resp = await fetch(`https://api.search.brave.com/res/v1/web/search?${params.toString()}`, {
    headers: { Accept: "application/json", "X-Subscription-Token": key, "User-Agent": UA },
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`brave http ${resp.status}`);
  const data = (await resp.json()) as { web?: { results?: { title?: string; url?: string; description?: string }[] } };
  return (data?.web?.results ?? []).slice(0, limit).map((r, i) => ({
    engine: "brave",
    rank: i + 1,
    title: r.title ?? "",
    link: r.url ?? "",
    snippet: r.description,
  }));
}

async function searchGoogleCse(query: string, region: string, lang: string, limit: number, key: string, cx: string): Promise<SerpResult[]> {
  const results: SerpResult[] = [];
  let start = 1;
  while (results.length < limit && start <= 91) {
    const params = new URLSearchParams({
      q: query, key, cx, gl: region, num: String(Math.min(10, limit - results.length)), start: String(start),
    });
    if (lang !== "auto") params.set("lr", `lang_${lang}`);
    const resp = await fetch(`https://www.googleapis.com/customsearch/v1?${params.toString()}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) throw new Error(`google cse http ${resp.status}`);
    const data = (await resp.json()) as { items?: { title?: string; link?: string; snippet?: string }[] };
    const items = data?.items ?? [];
    if (!items.length) break;
    for (const item of items) {
      results.push({ engine: "google", rank: results.length + 1, title: item.title ?? "", link: item.link ?? "", snippet: item.snippet });
    }
    start += 10;
  }
  return results;
}

/** action content do v1: extrai headings/parágrafos de uma URL. */
async function scrapeContent(url: string): Promise<{ tag: string; text: string }[]> {
  const html = await fetchText(url, { timeoutMs: 15000 });
  const out: { tag: string; text: string }[] = [];
  const seen = new Set<string>();
  const re = /<(h[1-6]|p|strong|b)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 400) {
    const text = clean(m[2] as string);
    if (text && text.length > 1 && !seen.has(text)) {
      seen.add(text);
      out.push({ tag: (m[1] as string).toLowerCase(), text });
    }
  }
  return out;
}

export function serpFactory(keys: ApiKeys): SourcePort {
  return defineAdapter(
    {
      id: "serp",
      label: "SERP multi-engine",
      kind: "article",
      description: "Busca web em 4 engines (bing/ddg sem chave; brave/google BYOK). engine=auto|bing|duckduckgo|brave|google|content.",
      capabilities: ["search"],
      rateLimit: { rps: 1, burst: 2 },
    },
    {
      async fetch(options: CollectOptions) {
        const region = /^[a-z]{2}$/i.test(options.country ?? "") ? String(options.country).toLowerCase() : "br";
        const lang = region === "br" ? "pt" : "auto";
        const limit = cap(options.limit ?? 25, 50);
        const engine = options.engine || "auto";

        if (engine === "content") {
          const url = options.query.trim();
          if (!/^https?:\/\//i.test(url)) throw new Error("engine=content exige URL http(s) na query");
          const content = await scrapeContent(url);
          if (content.length === 0) throw new Error("nenhum conteúdo textual extraído da URL");
          return { action: "content", url, content };
        }

        const braveKey = getKey(keys, "BRAVE_API_KEY");
        const googleKey = getKey(keys, "GOOGLE_API_KEY");
        const googleCx = getKey(keys, "GOOGLE_CX");

        const requested: string[] =
          engine === "auto"
            ? ["bing", "duckduckgo", ...(braveKey ? ["brave"] : []), ...(hasKeys(keys, "GOOGLE_API_KEY", "GOOGLE_CX") ? ["google"] : [])]
            : [engine];

        const perEngine: Record<string, { count: number; error?: string }> = {};
        const byUrl = new Map<string, SerpResult[]>();
        const settled = await Promise.allSettled(
          requested.map((name) => {
            if (name === "brave") {
              if (!braveKey) throw new Error("BRAVE_API_KEY não configurada no servidor");
              return searchBrave(options.query.trim(), region, limit, braveKey);
            }
            if (name === "google") {
              if (!googleKey || !googleCx) throw new Error("GOOGLE_API_KEY/GOOGLE_CX não configuradas no servidor");
              return searchGoogleCse(options.query.trim(), region, lang, limit, googleKey, googleCx);
            }
            if (name === "duckduckgo") return searchDuckDuckGo(options.query.trim(), region, limit);
            return searchBing(options.query.trim(), region, lang, limit);
          }),
        );

        let allFailed = 0;
        settled.forEach((s, i) => {
          const name = requested[i] ?? "";
          if (s.status === "fulfilled") {
            perEngine[name] = { count: s.value.length };
            for (const r of s.value) {
              const bucket = byUrl.get(r.link) ?? [];
              bucket.push(r);
              byUrl.set(r.link, bucket);
            }
          } else {
            allFailed++;
            perEngine[name] = { count: 0, error: String((s.reason as Error)?.message || s.reason) };
          }
        });

        if (allFailed === settled.length) {
          const messages = settled
            .map((s) => (s.status === "rejected" ? String((s.reason as Error)?.message || s.reason) : null))
            .filter((m): m is string => m !== null);
          throw new Error(`todas as engines falharam: ${[...new Set(messages)].join("; ")}`);
        }

        const merged = [...byUrl.values()]
          .map((bucket) => bucket.reduce((best, r) => (r.rank < best.rank ? r : best)))
          .sort((a, b) => a.rank - b.rank)
          .slice(0, limit);
        return { action: "search", query: options.query.trim(), results: merged, perEngine };
      },
      map(data: unknown, options: CollectOptions): NormalizedItem[] {
        void options;
        const r = asRecord(data);
        if (str(r.action) === "content") {
          const blocks = asArray(r.content).map((b) => {
            const rec = asRecord(b);
            return { tag: str(rec.tag), text: str(rec.text) };
          });
          const heading = blocks.find((b) => /^h[1-3]$/.test(b.tag))?.text ?? blocks[0]?.text ?? "Conteúdo";
          const text = blocks.map((b) => b.text).filter(Boolean).join("\n");
          return [
            item(
              {
                id: `serp:content:${encodeURIComponent(str(r.url)).slice(0, 60)}`,
                title: heading.slice(0, 120),
                url: str(r.url) || undefined,
                text,
                meta: { blocks: blocks.length, tags: blocks.map((b) => b.tag) },
              },
              "serp",
              "document",
            ),
          ];
        }
        return asArray(r.results).map((raw) => {
          const s = asRecord(raw);
          const rank = num(s.rank) ?? 0;
          return item(
            {
              id: `serp:${str(s.engine)}:${rank}:${encodeURIComponent(str(s.link)).slice(0, 60)}`,
              title: str(s.title),
              url: str(s.link) || undefined,
              text: str(s.snippet) || undefined,
              author: str(s.engine),
              score: Math.max(1, 1000 - rank * 10),
              meta: { engine: str(s.engine), rank },
            },
            "serp",
            "article",
          );
        });
      },
    },
  );
}

export const serpSources: Record<string, (keys: ApiKeys) => SourcePort> = {
  serp: serpFactory,
};