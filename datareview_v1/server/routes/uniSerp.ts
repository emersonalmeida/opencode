import type { RequestHandler } from "express";
// Camada RAW/provenance (aditivo): helper failure-safe, nunca muda a resposta.
import { startRun, finishRun, saveRawArtifact, type CollectionRun } from "../lib/rawStore.js";
import { withObservation } from "../lib/auditObservation.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Conector SERP — referência: docs/_uni.py (coletar_duckduckgo/coletar_google/
 * coletar_brave/coletar_bing + scrap_conteudo).
 *
 * Engines:
 *  - bing:   scraping HTML público (www.bing.com/search) — funciona sem key.
 *  - duckduckgo: html.duckduckgo.com — sem key mas rate-limita datacenters
 *    (modal anti-bot); erro honesto quando bloqueado.
 *  - brave:  API oficial, requer BRAVE_API_KEY no env do servidor.
 *  - google: Custom Search API, requer GOOGLE_API_KEY + GOOGLE_CX no env.
 *
 * Ações:
 *  - search:  { query, region?, lang?, limit?, engines? } → resultados merged
 *             com dedup por URL (engine com melhor rank vence).
 *  - content: { url } → extrai headings/parágrafos da página (tratamento de
 *             conteúdo, equivalente ao scrap_conteudo do _uni.py).
 */

export interface SerpResult {
  engine: string;
  rank: number;
  title: string;
  link: string;
  snippet?: string;
}

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

/** Decodificador mínimo de entidades HTML (named comuns + numéricas). */
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

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

/** Bing embrulha links em bing.com/ck/a?...&u=a1<base64url-da-url-real>. */
function decodeBingLink(href: string): string {
  try {
    const u = new URL(href.replace(/&amp;/g, "&")).searchParams.get("u");
    if (u?.startsWith("a1")) {
      const b64 = u.slice(2).replace(/-/g, "+").replace(/_/g, "/");
      return Buffer.from(b64, "base64").toString("utf8");
    }
  } catch {
    /* link direto — mantém como veio */
  }
  return href;
}

async function searchBing(query: string, region: string, lang: string, limit: number): Promise<SerpResult[]> {
  const params = new URLSearchParams({ q: query, cc: region, setlang: lang, count: String(Math.min(limit, 30)) });
  const url = `https://www.bing.com/search?${params.toString()}`;
  // 1ª tentativa sem cookies; se vier vazio, refaz com os cookies setados.
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
  const blocks = html.split('<li class="b_algo"').slice(1);
  const results: SerpResult[] = [];
  for (const block of blocks) {
    const m = block.match(/<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!m) continue;
    const link = decodeBingLink(m[1]);
    const title = stripTags(m[2]);
    const snip = block.match(/class="b_lineclamp\d+"[^>]*>([\s\S]*?)<\/p>/);
    const snippet = snip ? stripTags(snip[1]) : undefined;
    if (title && link) results.push({ engine: "bing", rank: results.length + 1, title, link, snippet });
    if (results.length >= limit) break;
  }
  return results;
}

interface DuckDuckGoFilters {
  lang?: string;
  // URL pública aceita parâmetros de filtro (tbs/filter/pws/nfpr/uule)
  // com checks no modo query — evita usar item por literal pesquisado.
  tbs?: string;
  filter?: boolean;
  pws?: boolean;
  nfpr?: boolean;
}

async function searchDuckDuckGo(query: string, region: string, limit: number, filters?: DuckDuckGoFilters): Promise<SerpResult[]> {
  const params = new URLSearchParams({ q: query, kl: `${region}-${region === "br" ? "pt" : region}` });
  if (filters?.tbs) params.set("tbs", filters.tbs);
  if (filters?.filter === false) params.set("filter", "0");
  if (filters?.pws === false) params.set("pws", "0");
  if (filters?.nfpr) params.set("nfpr", "1");
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
    // DDG embrulha em /l/?uddg=<url-encodada>.
    let link = m[1].replace(/&amp;/g, "&");
    try {
      const uddg = new URL(link, "https://duckduckgo.com").searchParams.get("uddg");
      if (uddg) link = uddg;
    } catch { /* mantém */ }
    // Filtra anúncios (redirect /y.js) — não são resultados orgânicos.
    if (link.includes("duckduckgo.com/y.js")) continue;
    results.push({ engine: "duckduckgo", rank: results.length + 1, title: stripTags(m[2]), link });
  }
  return results;
}

async function searchBrave(query: string, region: string, _lang: string, limit: number): Promise<SerpResult[]> {
  const key = process.env.BRAVE_API_KEY;
  if (!key) throw new Error("BRAVE_API_KEY não configurada no servidor");
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

async function searchGoogleCse(query: string, region: string, lang: string, limit: number): Promise<SerpResult[]> {
  const key = process.env.GOOGLE_API_KEY;
  const cx = process.env.GOOGLE_CX;
  if (!key || !cx) throw new Error("GOOGLE_API_KEY/GOOGLE_CX não configuradas no servidor");
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

const ENGINES: Record<string, (q: string, region: string, lang: string, limit: number) => Promise<SerpResult[]>> = {
  bing: searchBing,
  duckduckgo: (q, region, _lang, limit) => searchDuckDuckGo(q, region, limit),
  brave: searchBrave,
  google: searchGoogleCse,
};

/** scrap_conteudo do _uni.py: extrai headings + parágrafos de uma URL. */
async function scrapeContent(url: string): Promise<{ tag: string; text: string }[]> {
  const resp = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`content http ${resp.status}`);
  const html = await resp.text();
  const out: { tag: string; text: string }[] = [];
  const seen = new Set<string>();
  const re = /<(h[1-6]|p|strong|b)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 400) {
    const text = stripTags(m[2]);
    if (text && text.length > 1 && !seen.has(text)) {
      seen.add(text);
      out.push({ tag: m[1].toLowerCase(), text });
    }
  }
  return out;
}

export const uniSerp: RequestHandler = async (req, res) => {
  res.set(corsHeaders);
  let run: CollectionRun | null = null;
  try {
    const { action, query, region = "br", lang = "pt", limit } = req.body ?? {};
    const max = Math.max(1, Math.min(Number(limit) || 10, 50));
    const regionCode = /^[a-z]{2}$/i.test(String(region)) ? String(region).toLowerCase() : "br";

    if (action === "search") {
      if (!query || typeof query !== "string") return res.status(400).json({ error: "query required" });
      const requested: string[] = Array.isArray(req.body?.engines) && req.body.engines.length
        ? req.body.engines.filter((e: string) => e in ENGINES)
        : ["bing", "duckduckgo", "brave", "google"];
      // Filtros de URL pública opcionais por engine (ex.: ddG tbs/filter/pws/nfpr).
      const ddf = (req.body?.filters?.duckduckgo ?? undefined) as DuckDuckGoFilters | undefined;
      run = startRun({
        sourceId: "serp",
        subjectKey: `serp:${regionCode}:${query}`,
        collector: "uni-serp",
        collectorVersion: "1",
        params: { action, query, region: regionCode, lang, limit: max, engines: requested, filters: ddf },
      });

      // Engines em paralelo; falha de uma não derruba as demais (erro honesto).
      const settled = await withObservation(
        run.id, "serp", "serp-engines", undefined,
        { action, query, region: regionCode, lang, limit: max, engines: requested, filters: ddf },
        () => Promise.allSettled(
          requested.map((name) =>
            name === "duckduckgo"
              ? (ENGINES[name] as (query: string, region: string, lang: string, limit: number, filters?: DuckDuckGoFilters) => Promise<SerpResult[]>)(query, regionCode, String(lang), max, ddf)
              : ENGINES[name](query, regionCode, String(lang), max),
          ),
        ),
      );
      const perEngine: Record<string, { count: number; error?: string }> = {};
      const byUrl = new Map<string, SerpResult>();
      settled.forEach((s, i) => {
        const name = requested[i];
        if (s.status === "fulfilled") {
          perEngine[name] = { count: s.value.length };
          for (const r of s.value) {
            const prev = byUrl.get(r.link);
            if (!prev || r.rank < prev.rank) byUrl.set(r.link, r);
          }
        } else {
          perEngine[name] = { count: 0, error: String((s.reason as Error)?.message || s.reason) };
        }
      });
      const results = [...byUrl.values()].sort((a, b) => a.rank - b.rank).slice(0, max * 2);

      saveRawArtifact({
        runId: run.id,
        sourceId: "serp",
        subjectKey: run.subjectKey,
        endpoint: "serp-search",
        params: { action, query, region: regionCode, lang, limit: max, engines: requested },
        payload: results,
        collector: "uni-serp",
        collectorVersion: "1",
      });
      finishRun(run, { status: results.length ? "completed" : "partial", yielded: results.length });
      return res.json({ action, query, results, count: results.length, perEngine });
    }

    if (action === "content") {
      const url = String(req.body?.url ?? "");
      if (!/^https?:\/\//.test(url)) return res.status(400).json({ error: "url http(s) required" });
      run = startRun({
        sourceId: "serp",
        subjectKey: `serp:content:${url}`,
        collector: "uni-serp",
        collectorVersion: "1",
        params: { action, url },
      });
      const content = await scrapeContent(url);
      saveRawArtifact({
        runId: run.id,
        sourceId: "serp",
        subjectKey: run.subjectKey,
        endpoint: "serp-content",
        url,
        params: { action, url },
        payload: content,
        collector: "uni-serp",
        collectorVersion: "1",
      });
      finishRun(run, { status: content.length ? "completed" : "partial", yielded: content.length });
      return res.json({ action, url, content, count: content.length });
    }

    return res.status(400).json({ error: `unknown action: ${action} (use search|content)` });
  } catch (err) {
    console.error("uni-serp connector error:", err);
    if (run) {
      finishRun(run, { status: "failed", errors: [{ endpoint: "uni-serp", message: String((err as Error)?.message || err) }] });
    }
    return res.status(500).json({ error: String((err as Error)?.message || err) });
  }
};
