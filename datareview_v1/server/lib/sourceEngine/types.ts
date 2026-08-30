/**
 * Source Engine — contratos do motor unificado de fontes plugáveis.
 *
 * Objetivo (fase 1): padronizar o QUE as fontes têm em comum
 * (identidade, metadados, capabilities, contrato de coleta e item
 * normalizado) preservando o QUE é individual de cada fonte
 * (parâmetros extras via `paramsSpec`, payload bruto via `meta`, método,
 * rate-limit, regiões). Uma fonte = UMA implementação de `SourceCollector`
 * registrada no registry — plugar/desplugar não toca em mais nada.


 * A fonte de verdade é este arquivo + registry.ts: rotas, UI e testes
 * consomem SÓ estes contratos. Inspirado nos padrões: adapter/port-and-adapters
 * (negócio não conhece a fonte), registry/factory (decisão de wiring num
 * lugar só)e camada de abstração de dados (item normalizado único com `meta`
 * preservando o payload específico — nada é descartado, derivado é recomputável).
 */

/* ---------------------------------------------------------------- kinds --- */

export type SourceKind =
  | "store"
  |"social"
  |"news"
  |"search"
  |"academic"
  |"developer"
  |"video"
  |"audio"
  |"dataset"
  |"government"
  |"other";

/** Como a fonte autentica. `none` = pública sem chave. */
export type SourceAuth = "none" | "apikey" | "oauth" | "byok" | "custom";

/* ---------------------------------------------------------- capabilities --- */

export interface SourceCapabilities {
  search?: boolean;
  lookup?: boolean;
  reviews?: boolean;
  topCharts?: boolean;
  healthCheck?: boolean;
}

/* ------------------------------------------------------------ descriptors --- */

/** Spec de um parâmetro EXTRA da fonte (preserva as características individuais
 *  num shape padronizado — a UI genérica renderiza a partir dele. */
export interface SourceParamSpec {
  /** Chave do parâmetro (ex.: "region", "lang", "vertical"). */
  id: string;
  label: string;
  /** "text" | "select" | "number" | "boolean" | "textarea". */
  type?: "text" | "select" | "number" | "boolean" | "textarea";
  /** Opções quando type=select. */
  options?: { value: string; label: string }[];
  /** Valor padrão. */
  default?: string | number | boolean;
  placeholder?: string;
  /** Se true, aparece dobrado (avançado). */
  advanced?: boolean;
}

export interface SourceRateLimit {
  rps?: number;
  burst?: number;
  note?: string;
}

/** Metadados público de uma fonte registrada — o que a UI/auditoria
 *  consomem. Derivado do collector de forma canônica (ver descriptors()). */
export interface SourceDescriptor {
  id: string;
  label: string;
  kind: SourceKind;
  description?: string;
  auth: SourceAuth;
  capabilities: SourceCapabilities;
  rateLimit?: SourceRateLimit;
  supportsIncremental?: boolean;
  supportsHistorical?: boolean;
  regions?: string[];
  tosNote?: string;
  method?: string;
  collector?: string;
  collectorVersion?: string;
  /** Parâmetros extras declarados pela fonte (por fonte, padronizados). */
  paramsSpec?: SourceParamSpec[];
  tags?: string[];
}

/* ----------------------------------------------------------------- items --- */

/**
 * Item normalizado produzido por QUALQUER fonte. O payload específico da
 * fonte fica em `meta` (os consumidores não dependem de formatos originais;
 * o que é individual sobrevive intacto em meta).
 */
export interface SourceItem {
  /** Id estável (dedup). Gerado pelo engine quando ausente. */
  id?: string;
  /** Id da fonte de origem. */
  source: string;
  /** Tipo do item (post/article/video/question/product/…). */
  kind: string;
  title: string;
  text?: string;
  url?: string;
  author?: string;
  date?: string;
  /** Pontuação nativa da fonte (upvotes, stars, downloads, score). */
  score?: number;
  /** Payload específico da fonte, preservado (nunca descartado). */
  meta?: Record<string, unknown>;
  /** Idioma detectado/provido pela fonte (ex.: "pt", "en"). */
  lang?: string;
}

/* -------------------------------------------------------------- requests --- */

export interface SourceRequest {
  /** Id da fonte registrada. */
  source: string;
  /** Consulta do usuário. */
  query: string;
  /** Parâmetros extras validados contra `paramsSpec` da fonte. */
  params?: Record<string, unknown>;
  /** Teto de itens (default 20; clamp 1..100). */
  limit?: number;
  /** Sinal de cancelamento (passado para fetch/signal downstream). */
  signal?: AbortSignal;
}

/** Resultado de uma coleta executada pelo engine. */
export interface SourceResult {
  source: string;
  query: string;
  items: SourceItem[];
  count: number;
  /** true quando um cache atendeu (nada novo foi coletado). */
  cached?: boolean;
  /** kind agregado quando a fonte é multi-kind. */
  kind?: string;
  error?: string;
  warnings?: string[];
  durationMs?: number;
}

/* -------------------------------------------------------------- collector --- */

/** Saída bruta de uma execução de collector (antes da normalização do engine). */
export interface CollectOutcome {
  items: SourceItem[];
  /** true quando o próprio collector usou cache. */
  cached?: boolean;
  /** kind agregado quando multi-kind. */
  kind?: string;
  /** Payload bruto da fonte (opcional; gravado na camada RAW pelo engine. */
  raw?: unknown;
  warnings?: string[];
}

/**
 * Contrato de uma fonte plugável. Implementação possível de 2 formas:
 *  - Declarativa (adapter sobre config: buildUrl+listPath+mapItem);
 *   - Imperativa (função async com a lógica própria da fonte).
 * Ambas produzem `CollectOutcome` com SourceItem[] já razoavelmente
 * normalizado; o engine aplica o resto do pipeline común (cache, RAW,
 * observação, dedup, clamps).
 */
export interface SourceCollector {
  id: string;
  label: string;
  kind: SourceKind;
  description?: string;
  auth?: SourceAuth;
  capabilities?: Partial<SourceCapabilities>;
  rateLimit?: SourceRateLimit;
  supportsIncremental?: boolean;
  supportsHistorical?: boolean;
  regions?: string[];
  tosNote?: string;
  method?: string;
  collector?: string;
  collectorVersion?: string;
  paramsSpec?: SourceParamSpec[];
  tags?: string[];
  /** Executa a coleta da fonte. Deve jogar Error com mensagem legível. */
  collect: (req: SourceRequest) => Promise<CollectOutcome>;
}