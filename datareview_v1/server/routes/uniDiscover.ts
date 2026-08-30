import type { RequestHandler } from "express";
// Camada RAW/provenance (aditivo): helper failure-safe, nunca muda a resposta.
import { startRun, finishRun, saveRawArtifact, type CollectionRun } from "../lib/rawStore.js";
import { withObservation } from "../lib/auditObservation.js";
// Cache de respostas (mesmo padrão das outras rotas Uni).
import { getCached, setCached } from "../lib/routeCache.js";
import {
  buildWikitopUrl, parseWikitop,
  buildWikiviewsUrl, parseWikiviews,
  buildOnThisDayUrl, parseOnThisDay, type OnThisDayType,
  buildGoogleNewsUrl, parseGoogleNewsRss,
  buildPodcastsUrl, parseApplePodcasts,
  COINGECKO_TRENDING_URL, parseCoinGeckoTrending,
  buildSteamTopUrl, parseSteamTop, type SteamTopRequest,
  buildWeatherUrl, parseOpenMeteo, DEFAULT_CITIES, type CityInput,
  buildBrasilApiUrl, buildFrankfurterUrl, buildIbgeNomesUrl,
  parseFeriados, parseTaxas, parseFrankfurter, parseIbgeNomes,
  buildDeezerUrl, parseDeezer,
  buildOpenLibraryTrendingUrl, parseOpenLibraryTrending,
  buildNpmDownloadsUrl, parseNpmDownloads, type NpmPeriod,
  buildGithubTrendingUrl, parseGithubTrending,
  buildMastodonTrendsUrl, parseMastodonTrends,
  type DiscoverItem, type DiscoverResult,
} from "../lib/discoverCore.js";
import { resolveUrl, fanoutTerm, type ResolvedTarget } from "../lib/urlResolver.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Rota Descoberta — fontes novas verificadas ao vivo (2026-08-25), todas
 * públicas e sem chave. Uma rota única com `source` + params por fonte; a
 * página /descoberta organiza cada fonte numa seção.
 *
 * POST /functions/v1/uni-discover
 *  { source: "wikitop",    project?, date? }              artigos mais lidos/dia
 *  { source: "wikiviews",  article, project?, days? }     série diária de um artigo
 *  { source: "onthisday",  month?, day?, type?, lang? }   "neste dia" da Wikipédia
 *  { source: "googlenews", query, hl?, gl? }              notícias por termo (RSS)
 *  { source: "podcasts",   country?, limit? }             charts Apple Podcasts
 *  { source: "crypto" }                                   moedas em alta (CoinGecko)
 *  { source: "steamtop",   request? }                     top jogos (SteamSpy)
 */
const UA = "AppDataReview/1.0 (research)";

interface SourceSpec {
  /** TTL do cache em ms (fontes diárias podem cachear mais). */
  ttlMs: number;
  note?: string;
}

const SOURCES: Record<string, SourceSpec> = {
  wikitop: { ttlMs: 30 * 60 * 1000 },
  wikiviews: { ttlMs: 30 * 60 * 1000 },
  onthisday: { ttlMs: 6 * 60 * 60 * 1000 },
  googlenews: { ttlMs: 10 * 60 * 1000 },
  podcasts: { ttlMs: 60 * 60 * 1000 },
  crypto: { ttlMs: 5 * 60 * 1000 },
  steamtop: {
    ttlMs: 60 * 60 * 1000,
    note: "SteamSpy limita a 1 requisição/segundo por IP.",
  },
  clima: { ttlMs: 15 * 60 * 1000 },
  brasil: { ttlMs: 6 * 60 * 60 * 1000 },
  music: { ttlMs: 30 * 60 * 1000 },
  books: { ttlMs: 60 * 60 * 1000 },
  packages: { ttlMs: 60 * 60 * 1000 },
  "github-trending": {
    ttlMs: 30 * 60 * 1000,
    note: "Extração da página pública do GitHub (pode mudar o HTML sem aviso).",
  },
  "mastodon-trends": { ttlMs: 10 * 60 * 1000 },
};

/** fetch com timeout + erro honesto. */
async function fetchText(url: string, timeoutMs = 20000): Promise<string> {
  const resp = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "*/*" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!resp.ok) throw new Error(`fonte retornou HTTP ${resp.status}`);
  return resp.text();
}

async function fetchJson(url: string, timeoutMs = 20000): Promise<unknown> {
  const text = await fetchText(url, timeoutMs);
  return JSON.parse(text);
}

/** Despacha para a fonte: retorna { url, items }. */
async function collect(source: string, body: Record<string, unknown>): Promise<{ url: string; items: DiscoverItem[] }> {
  switch (source) {
    case "wikitop": {
      const url = buildWikitopUrl(String(body.project || "pt.wikipedia"), body.date ? String(body.date) : undefined);
      return { url, items: parseWikitop(await fetchJson(url) as Parameters<typeof parseWikitop>[0]) };
    }
    case "wikiviews": {
      const article = String(body.article ?? "").trim();
      if (!article) throw new Error("article obrigatório (ex.: \"Brasil\")");
      const url = buildWikiviewsUrl(article, String(body.project || "pt.wikipedia"), Number(body.days) || 30);
      return { url, items: parseWikiviews(article, await fetchJson(url) as Parameters<typeof parseWikiviews>[1]) };
    }
    case "onthisday": {
      const now = new Date();
      const month = Number(body.month) || now.getUTCMonth() + 1;
      const day = Number(body.day) || now.getUTCDate();
      const url = buildOnThisDayUrl(month, day, (body.type as OnThisDayType) || "all", String(body.lang || "pt"));
      return { url, items: parseOnThisDay(await fetchJson(url) as Parameters<typeof parseOnThisDay>[0]) };
    }
    case "googlenews": {
      const query = String(body.query ?? "").trim();
      if (!query) throw new Error("query obrigatória");
      const url = buildGoogleNewsUrl(query, String(body.hl || "pt-BR"), String(body.gl || "BR"));
      return { url, items: parseGoogleNewsRss(await fetchText(url)) };
    }
    case "podcasts": {
      const url = buildPodcastsUrl(String(body.country || "br"), Number(body.limit) || 50);
      return { url, items: parseApplePodcasts(await fetchJson(url)) };
    }
    case "crypto": {
      return { url: COINGECKO_TRENDING_URL, items: parseCoinGeckoTrending(await fetchJson(COINGECKO_TRENDING_URL) as Parameters<typeof parseCoinGeckoTrending>[0]) };
    }
    case "steamtop": {
      const url = buildSteamTopUrl(body.request as SteamTopRequest);
      return { url, items: parseSteamTop(await fetchJson(url) as Parameters<typeof parseSteamTop>[0]) };
    }
    case "clima": {
      const cities = Array.isArray(body.cities) && (body.cities as CityInput[]).length
        ? (body.cities as CityInput[]).filter((c) => c && typeof c.lat === "number" && typeof c.lon === "number" && c.name)
        : DEFAULT_CITIES;
      const url = buildWeatherUrl(cities);
      return { url, items: parseOpenMeteo(cities, await fetchJson(url)) };
    }
    case "brasil": {
      const resource = String(body.resource || "feriados");
      if (resource === "feriados") {
        const url = buildBrasilApiUrl("feriados", body);
        return { url, items: parseFeriados(await fetchJson(url)) };
      }
      if (resource === "taxas") {
        const url = buildBrasilApiUrl("taxas", body);
        return { url, items: parseTaxas(await fetchJson(url)) };
      }
      if (resource === "cambio") {
        const base = String(body.base || "USD").toUpperCase();
        const url = buildFrankfurterUrl(base, String(body.symbols || "BRL,EUR,GBP,JPY,ARS"));
        return { url, items: parseFrankfurter(base, await fetchJson(url)) };
      }
      if (resource === "nomes") {
        const url = buildIbgeNomesUrl(String(body.localidade || "BR"));
        return { url, items: parseIbgeNomes(await fetchJson(url)) };
      }
      throw new Error(`resource desconhecido: ${resource} (use feriados|taxas|cambio|nomes)`);
    }
    case "music": {
      const resource = String(body.resource || "tracks");
      const query = String(body.query ?? "").trim();
      const url = buildDeezerUrl(resource, query || undefined, Number(body.limit) || 25);
      return { url, items: parseDeezer(resource === "search" ? "tracks" : resource, await fetchJson(url)) };
    }
    case "books": {
      const url = buildOpenLibraryTrendingUrl(String(body.period || "daily"));
      return { url, items: parseOpenLibraryTrending(await fetchJson(url)) };
    }
    case "packages": {
      const packages = Array.isArray(body.packages)
        ? (body.packages as unknown[]).map(String)
        : String(body.packages ?? "").split(",");
      if (!packages.some((p) => p.trim())) throw new Error("packages obrigatório (ex.: \"react,vue\")");
      const url = buildNpmDownloadsUrl(packages, body.period as NpmPeriod);
      return { url, items: parseNpmDownloads(await fetchJson(url)) };
    }
    case "github-trending": {
      const url = buildGithubTrendingUrl(String(body.language ?? ""), String(body.since || "daily"));
      return { url, items: parseGithubTrending(await fetchText(url)) };
    }
    case "mastodon-trends": {
      const resource = String(body.resource || "statuses");
      const url = buildMastodonTrendsUrl(String(body.instance || "mastodon.social"), resource, Number(body.limit) || 20);
      return { url, items: parseMastodonTrends(resource, await fetchJson(url)) };
    }
    default:
      throw new Error(`fonte desconhecida: ${source} (disponíveis: ${Object.keys(SOURCES).join(", ")})`);
  }
}

export const uniDiscover: RequestHandler = async (req, res) => {
  res.set(corsHeaders);
  let run: CollectionRun | null = null;
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;

    // Ação "resolve": URL/identificador → tipo de entidade + detalhes da API
    // pública correspondente (quando há). O fan-out multi-fonte fica no cliente.
    if (body.action === "resolve") {
      const input = String(body.url ?? body.input ?? "").trim();
      if (!input) return res.status(400).json({ error: "url obrigatória" });
      const target = resolveUrl(input);
      if (!target) return res.status(400).json({ error: "URL inválida — cole um link completo (ex.: https://github.com/facebook/react)" });
      const resolved: ResolvedTarget & { fanout?: string; detail?: Record<string, unknown> } = {
        ...target,
        fanout: fanoutTerm(target) || undefined,
      };
      if (target.apiUrl) {
        const cacheKey = `uni-discover:resolve:${target.kind}:${target.id}`;
        const cachedDetail = getCached(cacheKey, {}) as Record<string, unknown> | undefined;
        if (cachedDetail) {
          resolved.detail = cachedDetail;
        } else {
          try {
            const detail = await fetchJson(target.apiUrl);
            resolved.detail = detail as Record<string, unknown>;
            setCached(cacheKey, {}, resolved.detail, 30 * 60 * 1000);
          } catch (err) {
            // Detalhe indisponível não invalida a resolução — reporta o motivo.
            resolved.detail = { error: String((err as Error)?.message || err) };
          }
        }
      }
      return res.json(resolved);
    }

    const source = String(body.source ?? "");
    const spec = SOURCES[source];
    if (!spec) {
      return res.status(400).json({ error: `fonte desconhecida ou ausente: "${source}" (disponíveis: ${Object.keys(SOURCES).join(", ")})` });
    }

    const cacheParams = { ...body };
    const cached = getCached(`uni-discover:${source}`, cacheParams) as DiscoverResult | undefined;
    if (cached) return res.json({ ...cached, cached: true });

    run = startRun({
      sourceId: `discover-${source}`,
      subjectKey: `discover:${source}:${JSON.stringify(cacheParams)}`,
      collector: "uni-discover",
      collectorVersion: "1",
      params: cacheParams,
    });

    const { url, items } = await withObservation(
      run.id, `discover-${source}`, source, undefined,
      cacheParams,
      () => collect(source, body),
    );

    saveRawArtifact({
      runId: run.id, sourceId: `discover-${source}`,
      subjectKey: `discover:${source}:${JSON.stringify(cacheParams)}`,
      endpoint: source, url, params: cacheParams,
      payload: { count: items.length }, collector: "uni-discover", collectorVersion: "1",
    });
    finishRun(run, { status: items.length ? "completed" : "partial", yielded: items.length });

    const result: DiscoverResult = { source, items, count: items.length, ...(spec.note ? { note: spec.note } : {}) };
    if (items.length) setCached(`uni-discover:${source}`, cacheParams, result, spec.ttlMs);
    return res.json(result);
  } catch (err) {
    console.error("uni-discover error:", err);
    if (run) {
      finishRun(run, { status: "failed", errors: [{ endpoint: "discover", message: String((err as Error)?.message || err) }] });
    }
    return res.status(500).json({ error: String((err as Error)?.message || err) });
  }
};
