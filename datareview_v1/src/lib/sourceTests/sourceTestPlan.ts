/**
 * Plano de teste ao vivo por fonte (página /testes-fontes).
 *
 * Princípio do briefing: "testar tudo que a fonte é capaz" de forma
 * honesta — cobrir as fontes coletáveis por termo (PIPELINE_SOURCES), as
 * fontes do radar Discover (fetchDiscover) e os extratores com entrada
 * dedicada (web/feed/paste/tiktok). Fontes que não rodam com um termo de
 * busca genérico são marcadas como "puladas" com a razão (nunca inventar
 * resultado).
 *
 * Cada variação de uma fonte vira um "probe" com id estável —
 * `source:variant` — registrado no log ao vivo e no resultado final.
 */

export type TestStatus = "pending" | "running" | "done" | "error" | "skipped";

/** Uma variação executável de uma fonte (probe). */
export interface TestProbe {
  /** id estável: `source:variant` (âncora na página). */
  id: string;
  /** fonte principal (id do AuditSource/UniSourceId). */
  sourceId: string;
  /** rótulo curto da variação (ex.: "vertical yt", "janela 7d"). */
  label: string;
  /** descrição do que a variação extrai. */
  description: string;
  /** executor client-side (chama a rota/fetch correspondente). */
  run: (term: string, limit: number, signal?: AbortSignal) => Promise<unknown[]>;
  /** true quando a fonte precisa de entrada própria (URL, texto colado). */
  needsInput?: "url" | "text";
}

/** Resultado de um probe após executar. */
export interface ProbeResult {
  id: string;
  sourceId: string;
  label: string;
  status: TestStatus;
  /** quantidade de itens retornados. */
  count: number;
  /** campos distintos vistos nos itens (união das chaves). */
  fields: string[];
  /** amostra dos primeiros itens (máx 3, truncados). */
  sample: Record<string, unknown>[];
  /** itens reais (cap 200) — alimentam a visão unificada. */
  items: Record<string, unknown>[];
  /** erro honesto quando falhou. */
  error?: string;
  /** razão quando pulado (entrada incompatível). */
  skippedReason?: string;
  /** duração da execução. */
  durationMs: number;
}

/** Resultado agregado por fonte. */
export interface SourceTestResult {
  sourceId: string;
  probes: ProbeResult[];
  /** união dos campos de todos os probes. */
  allFields: string[];
  totalItems: number;
  durationMs: number;
}

/** Ordem canônica das fontes no teste (segue a auditoria/registry). */
export const TEST_SOURCE_ORDER: string[] = [
  "suggest", "trends", "serp", "youtube", "reddit", "producthunt",
  "apple", "google", "steam", "itchio", "hackernews", "mastodon",
  "bluesky", "lobsters", "devto", "stackexchange", "github", "arxiv",
  "semanticscholar", "openalex", "crossref", "doaj", "wikipedia",
  "wikidata", "openlibrary", "npm", "pypi", "rubygems", "cratesio",
  "gdelt", "googlenews", "tvmaze", "openfoodfacts", "archive",
  "reclameaqui", "web", "feed", "paste", "custom",
  // Discover (momento/radar)
  "discover-wikitop", "discover-wikiviews", "discover-onthisday",
  "discover-podcasts", "discover-crypto", "discover-steamtop",
  "discover-clima", "discover-brasil", "discover-music",
  "discover-books", "discover-packages", "discover-github-trending",
  "discover-mastodon-trends",
  // Social testada ao vivo
  "tiktok",
];

/** Descrição honesta do que cada variação tenta extrair (para o terminal). */
export const PROBE_HINTS: Record<string, string> = {
  suggest: "autocomplete × 4 verticais (web/yt/news/shopping)",
  trends: "timeline + geo + related (explore)",
  serp: "multi-engine (bing/ddg/brave/google)",
  youtube: "vídeos + comentários do 1º vídeo",
  reddit: "posts + comentários do 1º post",
  producthunt: "feed do dia + graphql (se chave)",
  apple: "busca iTunes + top charts",
  google: "busca play + top charts",
};

/** Rótulo humano da fonte (fallback para o id). */
export function sourceLabel(id: string, registry?: Record<string, string>): string {
  return registry?.[id] ?? id;
}
