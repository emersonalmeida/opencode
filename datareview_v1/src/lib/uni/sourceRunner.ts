/**
 * sourceRunner — despachante UNIFORME de coleta por fonte (motor da página
 * Pipeline Multifonte). Recebe `(sourceId, query, opts)` e chama a função de
 * coleta correta do uniApi com parâmetros sensatos do modo de coleta.
 *
 * Fontes que não operam por termo de busca (web/feed precisam de URL, paste
 * precisa de texto colado) são puladas com razão honesta — nunca fingidas.
 */
import {
  fetchArxivPapers,
  fetchConnector,
  fetchFeedItems,
  fetchGdeltNews,
  fetchGithubRepos,
  fetchHnStories,
  fetchRedditPosts,
  fetchS2Papers,
  fetchSeQuestions,
  fetchSerp,
  fetchSteamGames,
  fetchSuggestMulti,
  fetchTrendsMulti,
  fetchWebPage,
  fetchWikipediaSearch,
  fetchYoutubeVideos,
  type ConnectorSourceId,
  type UniFetchResult,
} from "./uniApi";
import { fetchCustomSource } from "./uniApi";
import { modeExpand, modeLimit, type CollectMode } from "./collectModes";
import { logCollectedItems } from "./uniOutputLog";
import { getCustomSource, type CustomSourceDef } from "./customSources";
import type { UniItem, UniSourceId } from "./types";

export interface SourceCollectOutcome {
  ok: boolean;
  items: UniItem[];
  error?: string;
  /** Razão honesta quando a fonte não roda para o input dado. */
  skippedReason?: string;
}

/** Fontes coletáveis por termo de busca no pipeline multifonte. */
export const PIPELINE_SOURCES: UniSourceId[] = [
  "suggest", "trends", "serp", "youtube", "reddit", "wikipedia", "hackernews",
  "gdelt", "arxiv", "stackexchange", "github", "semanticscholar", "steam",
  "web", "feed", "devto", "lobsters", "mastodon", "bluesky", "wikidata",
  "openalex", "crossref", "openlibrary", "npm", "pypi", "itchio",
  "rubygems", "cratesio", "doaj", "openfoodfacts", "archive", "tvmaze",
];

const CONNECTOR_IDS = new Set<string>([
  "devto", "lobsters", "mastodon", "bluesky", "wikidata",
  "openalex", "crossref", "openlibrary", "npm", "pypi", "itchio",
  "rubygems", "cratesio", "doaj", "openfoodfacts", "archive", "tvmaze",
]);

const URL_RE = /^https?:\/\/.+/i;

/** Razão pela qual uma fonte não roda com o input atual (ou null se roda). */
export function sourceSkipReason(source: UniSourceId, query: string): string | null {
  if (source === "paste") return "A fonte Colar texto precisa de texto colado, não de busca.";
  if ((source === "web" || source === "feed") && !URL_RE.test(query.trim())) {
    return `A fonte ${source === "web" ? "Web" : "RSS/Atom"} precisa de uma URL (https://…).`;
  }
  if (!query.trim()) return "Digite um termo de busca.";
  return null;
}

/** Executa a coleta de UMA fonte com o modo de coleta dado. */
export async function collectFromSource(
  source: UniSourceId,
  query: string,
  mode: CollectMode,
  customLimit?: number,
  signal?: AbortSignal,
): Promise<SourceCollectOutcome> {
  const skip = sourceSkipReason(source, query);
  if (skip) return { ok: false, items: [], skippedReason: skip };

  const limit = modeLimit(mode, customLimit);
  const expand = modeExpand(mode);
  const q = query.trim();

  let res: UniFetchResult;
  if (CONNECTOR_IDS.has(source)) {
    res = await fetchConnector(source as ConnectorSourceId, q, limit, signal);
  } else {
    switch (source) {
      case "suggest":
        res = await fetchSuggestMulti(q, ["web"], { limit, expand }, signal);
        break;
      case "trends":
        res = await fetchTrendsMulti([q], [{ timeframe: "today 3-m", gprop: "" }], { topn: limit }, signal);
        break;
      case "serp":
        res = await fetchSerp(q, { limit }, signal);
        break;
      case "youtube":
        res = await fetchYoutubeVideos(q, { limit }, signal);
        break;
      case "reddit":
        res = await fetchRedditPosts(q, { limit }, signal);
        break;
      case "wikipedia":
        res = await fetchWikipediaSearch(q, "pt", limit, signal);
        break;
      case "hackernews":
        res = await fetchHnStories(q, "relevance", limit, signal);
        break;
      case "gdelt":
        res = await fetchGdeltNews(q, { limit }, signal);
        break;
      case "arxiv":
        res = await fetchArxivPapers(q, "relevance", limit, signal);
        break;
      case "stackexchange":
        res = await fetchSeQuestions(q, "stackoverflow", "relevance", limit, signal);
        break;
      case "github":
        res = await fetchGithubRepos(q, "stars", limit, signal);
        break;
      case "semanticscholar":
        res = await fetchS2Papers(q, "relevance", limit, signal);
        break;
      case "steam":
        res = await fetchSteamGames(q, limit, signal);
        break;
      case "web":
        res = await fetchWebPage(q, signal);
        break;
      case "feed":
        res = await fetchFeedItems(q, limit, signal);
        break;
      default:
        return { ok: false, items: [], skippedReason: `Fonte ${source} ainda não tem runner no pipeline.` };
    }
  }
  // Loga os itens na aba "Output" da sidebar direita (tempo real, estilo
  // _uni.py) — itens numerados após o cabeçalho da execução.
  if (res.ok && res.items.length > 0) logCollectedItems(res.items);
  return { ok: res.ok, items: res.items, error: res.error };
}

/** Coleta de uma def customizada (resolved por id `custom:<defId>` no pipeline). */
export async function collectFromCustomSource(
  defIdOrDef: string | CustomSourceDef,
  query: string,
  mode: CollectMode,
  customLimit?: number,
  signal?: AbortSignal,
): Promise<SourceCollectOutcome> {
  const def = typeof defIdOrDef === "string" ? getCustomSource(defIdOrDef) : defIdOrDef;
  if (!def) return { ok: false, items: [], error: `Fonte customizada não encontrada: ${defIdOrDef}` };
  if (!query.trim()) return { ok: false, items: [], skippedReason: "Digite um termo de busca." };
  const res = await fetchCustomSource(def, query.trim(), modeLimit(mode, customLimit), signal);
  if (res.ok && res.items.length > 0) logCollectedItems(res.items);
  return { ok: res.ok, items: res.items, error: res.error };
}

// ---------------------------------------------------------------------------
// Orquestração do pipeline multifonte (coleta → análise determinística → doc)
// ---------------------------------------------------------------------------

export type PipelineStepStatus = "pending" | "running" | "done" | "error" | "skipped";

export interface PipelineStep {
  source: UniSourceId;
  /** Id da def custom (quando source === "custom") — distingue defs entre si. */
  customId?: string;
  status: PipelineStepStatus;
  itemCount: number;
  error?: string;
  skippedReason?: string;
}

export function initialSteps(sources: UniSourceId[], query: string): PipelineStep[] {
  return sources.map((source) => {
    const reason = sourceSkipReason(source, query);
    return {
      source,
      status: reason ? "skipped" : "pending",
      itemCount: 0,
      skippedReason: reason ?? undefined,
    };
  });
}

/**
 * Documento markdown determinístico do pipeline (sem IA) — cabeçalho com
 * parâmetros, resumo por fonte e top itens de cada fonte.
 */
export function buildPipelineDocument(
  query: string,
  steps: PipelineStep[],
  items: UniItem[],
  aiMarkdown?: string,
): string {
  const done = steps.filter((s) => s.status === "done");
  const lines: string[] = [
    `# Pipeline Multifonte — ${query}`,
    "",
    `_Gerado em ${new Date().toLocaleString("pt-BR")} · ${items.length} itens de ${done.length} fontes_`,
    "",
    "## Resumo por fonte",
    "",
    "| Fonte | Status | Itens | Observação |",
    "|---|---|---|---|",
    ...steps.map((s) => `| ${s.source} | ${s.status} | ${s.itemCount} | ${s.error ?? s.skippedReason ?? "—"} |`),
    "",
  ];
  for (const step of done) {
    const sourceItems = items.filter((i) => i.source === step.source).slice(0, 15);
    if (!sourceItems.length) continue;
    lines.push(`## ${step.source} (${step.itemCount} itens)`, "");
    for (const it of sourceItems) {
      const link = it.url ? ` — ${it.url}` : "";
      const score = it.score != null && it.score > 0 ? ` (▲ ${it.score})` : "";
      lines.push(`- **${it.title}**${score}${link}`);
    }
    lines.push("");
  }
  if (aiMarkdown) {
    lines.push("## Análise de IA", "", aiMarkdown, "");
  }
  return lines.join("\n");
}
