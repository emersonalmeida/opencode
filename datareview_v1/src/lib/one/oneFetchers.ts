/**
 * One Page — camada de efeito: um fetcher por tipo de fonte, todos
 * devolvendo o contrato único OneFetchResult (items UniItem).
 *
 * Reutiliza os clientes já existentes (uniApi, trendingApi, discoverApi,
 * customSources) — nenhuma lógica de fonte é duplicada aqui, só adaptação
 * de contrato + leitura de params da seção.
 */
import type { UniItem } from "@/lib/uni/types";
import {
  fetchSuggest,
  fetchTrends,
  fetchSerp,
  fetchYoutubeVideos,
  fetchRedditPosts,
  fetchWikipediaSearch,
  fetchHnStories,
  fetchGdeltNews,
  fetchArxivPapers,
  fetchSeQuestions,
  fetchGithubRepos,
  fetchS2Papers,
  fetchSteamGames,
  fetchWebPage,
  fetchFeedItems,
  pasteTextItems,
  fetchConnector,
  fetchYoutubeComments,
  fetchRedditComments,
  fetchHnComments,
  fetchWikipediaArticle,
  fetchSeAnswers,
  fetchSteamReviews,
  fetchReclameAquiCompanies,
  fetchReclameAquiComplaints,
  fetchReclameAquiTerm,
  type ConnectorSourceId,
  type SuggestVertical,
  type UniFetchResult,
} from "@/lib/uni/uniApi";
import type { DrillTarget } from "./oneDrills";
import { fetchTrending, toUniItems as trendingToUni } from "@/lib/trending/trendingApi";
import { fetchDiscover } from "@/lib/discover/discoverApi";
import { listCustomSources } from "@/lib/uni/customSources";
import { fetchCustomSource } from "@/lib/uni/uniApi";
import type { OneFetchResult, OneSectionDef } from "./oneSources";

function fromUni(r: UniFetchResult): OneFetchResult {
  return { ok: r.ok, items: r.items, error: r.error };
}

/** Fetchers das fontes clássicas da Uni (kind "uni"). */
async function fetchUniSource(def: OneSectionDef, query: string, params: Record<string, string>, signal?: AbortSignal): Promise<OneFetchResult> {
  const limit = 30;
  switch (def.id) {
    case "suggest": {
      const vertical = (params.vertical || "web") as SuggestVertical;
      const r = await fetchSuggest(query, { vertical, expand: params.expand === "yes", limit }, signal);
      return fromUni(r);
    }
    case "trends":
      return fromUni(await fetchTrends([query], { region: params.geo || "BR" }, signal));
    case "serp":
      return fromUni(await fetchSerp(query, { limit }, signal));
    case "youtube":
      return fromUni(await fetchYoutubeVideos(query, { limit }, signal));
    case "reddit":
      return fromUni(await fetchRedditPosts(query, { limit }, signal));
    case "wikipedia": {
      const r = await fetchWikipediaSearch(query, params.lang || "pt", 15, signal);
      return fromUni(r);
    }
    case "hackernews":
      return fromUni(await fetchHnStories(query, (params.sort as "relevance" | "date") || "relevance", limit, signal));
    case "gdelt":
      return fromUni(await fetchGdeltNews(query, { limit }, signal));
    case "arxiv":
      return fromUni(await fetchArxivPapers(query, (params.sort as never) || "relevance", limit, signal));
    case "stackexchange":
      return fromUni(await fetchSeQuestions(query, (params.site as never) || "stackoverflow", "relevance", limit, signal));
    case "github":
      return fromUni(await fetchGithubRepos(query, (params.sort as never) || "stars", limit, signal));
    case "semanticscholar":
      return fromUni(await fetchS2Papers(query, "relevance", limit, signal));
    case "steam":
      return fromUni(await fetchSteamGames(query, 12, signal));
    case "reclameaqui": {
      // Busca a empresa pelo termo; com match coleta as reclamações dela,
      // senão cai na busca livre de reclamações por termo.
      const companies = await fetchReclameAquiCompanies(query, signal);
      if (!companies.ok) return fromUni(companies);
      const best = companies.items[0];
      if (!best) return fromUni(await fetchReclameAquiTerm(query, limit, signal));
      const shortname = String(best.meta?.shortname ?? "");
      const companyId = String(best.meta?.companyId ?? "");
      return fromUni(await fetchReclameAquiComplaints(
        { companyId: companyId || undefined, shortname: shortname || undefined, limit }, signal));
    }
    case "web": {
      if (!params.url) return { ok: false, items: [], error: "Cole a URL da página." };
      return fromUni(await fetchWebPage(params.url, signal));
    }
    case "feed": {
      if (!params.url) return { ok: false, items: [], error: "Cole a URL do feed." };
      return fromUni(await fetchFeedItems(params.url, 50, signal));
    }
    case "paste": {
      if (!params.text) return { ok: false, items: [], error: "Cole o texto para transformar em itens." };
      return fromUni(await pasteTextItems(params.text, "auto", signal));
    }
    default:
      return { ok: false, items: [], error: `Fonte Uni não mapeada: ${def.id}` };
  }
}

/** Ponto de entrada único: despacha pelo kind da seção. */
export async function fetchOneSection(
  def: OneSectionDef,
  query: string,
  params: Record<string, string>,
  signal?: AbortSignal,
): Promise<OneFetchResult> {
  switch (def.kind) {
    case "uni":
      return fetchUniSource(def, query, params, signal);
    case "connector": {
      if (!def.connectorId) return { ok: false, items: [], error: "Conector sem id." };
      return fromUni(await fetchConnector(def.connectorId as ConnectorSourceId, query, 25, signal));
    }
    case "trending": {
      const r = await fetchTrending(params.geo || "br", Number(params.hours) || 24, signal);
      if (!r.ok) return { ok: false, items: [], error: r.error };
      return { ok: true, items: trendingToUni(r.items), cached: r.cached };
    }
    case "discover": {
      const p: Record<string, unknown> = { ...params };
      const r = await fetchDiscover(def.discoverSource!, p, signal);
      if (!r.ok) return { ok: false, items: [], error: r.error };
      // Adapta DiscoverItem → UniItem (já há conversor no discoverApi; inline aqui p/ não acoplar).
      const items: UniItem[] = r.items.map((it) => ({
        id: `discover-${def.discoverSource}:${it.id}`,
        source: "custom",
        kind: "web-result",
        title: it.title,
        text: [it.subtitle, it.score != null ? `${it.score} ${it.scoreLabel ?? ""}`.trim() : ""].filter(Boolean).join(" · ") || undefined,
        url: it.url,
        score: it.score,
        date: it.publishedAt,
        meta: { ...it.meta, image: it.image },
      }));
      return { ok: true, items, note: r.note, cached: r.cached };
    }
    case "custom": {
      const sources = listCustomSources();
      if (!sources.length) return { ok: false, items: [], error: "Nenhuma fonte customizada cadastrada — crie na Uni (/00)." };
      // Coleta da primeira fonte custom habilitada (a Uni gerencia o CRUD).
      return fromUni(await fetchCustomSource(sources[0], query, 20, signal));
    }
    default:
      return { ok: false, items: [], error: `Tipo de fonte desconhecido: ${def.kind}` };
  }
}

/** Executa o drill de um item (comentários/artigo/respostas/reviews). */
export async function fetchOneDrill(drill: DrillTarget, lang = "pt", signal?: AbortSignal): Promise<OneFetchResult> {
  switch (drill.kind) {
    case "comments": {
      // youtube: target = videoId · reddit: "sub/postId" · hackernews: storyId
      if (drill.target.includes("/")) {
        const [sub, id] = drill.target.split("/");
        return fromUni(await fetchRedditComments(id, sub, 20, signal));
      }
      // heurística: storyId do HN é numérico; videoId do YouTube não é
      if (/^\d+$/.test(drill.target)) return fromUni(await fetchHnComments(drill.target, 20, signal));
      return fromUni(await fetchYoutubeComments(drill.target, 20, signal));
    }
    case "article":
      return fromUni(await fetchWikipediaArticle(Number(drill.target), lang, signal));
    case "answers": {
      const [site, qid] = drill.target.split("/");
      return fromUni(await fetchSeAnswers(Number(qid), (site as never) || "stackoverflow", 10, signal));
    }
    case "reviews":
      return fromUni(await fetchSteamReviews(drill.target, "all", 30, signal));
    default:
      return { ok: false, items: [], error: "Drill desconhecido" };
  }
}

