/**
 * Contratos compartilhados — a ÚNICA fonte de verdade dos tipos do sistema.
 *
 * Front, backend e adaptadores de fonte importam daqui; nunca duplicamos
 * tipos entre camadas (no legado havia `UniItem` e `SourceItem` divergentes).
 *
 * O pipeline canônico que estes contratos modelam:
 *   DISCOVER → SEARCH → COLLECT → NORMALIZE → DEDUPLICATE → STORE DATASET
 *   → DERIVE INSIGHTS → AI ANALYSIS
 */

/* ------------------------------------------------------------- fontes --- */

/** Identificador de fonte — vocabulário aberto (novas fontes não exigem mudança). */
export type SourceId = string;

/** Capacidade declarada por uma fonte (feed a UI/formatadores genéricos). */
export type SourceCapability =
  | "search"     // busca textual
  | "reviews"   // reviews/opiniões de produtos
  | "news"      // notícias/artigos
  | "social"    // posts/comentários sociais
  | "code"      // repos/issues/pacotes
  | "media"     // vídeo/jogo/áudio
  | "academic"  // papers/perguntas acadêmicas
  | "trends"    // tendências/autocomplete/rankings
  | "custom";   // qualquer outra (fonte declarativa livre)

/** Item normalizado produzido por QUALQUER fonte. O payload específico da
 *  fonte fica em `meta` (Bronze preservado — auditável); este shape é o Silver. */
export interface NormalizedItem {
  /** Identidade estável usada na deduplicação (gerada quando ausente). */
  id: string;
  /** Fonte de origem (ex.: "apple", "reddit"). */
  source: SourceId;
  /** Tipo do item — vocabulário aberto (post/article/question/video/package…). */
  kind: string;
  title: string;
  /** URL canônica do item (usada como identidade quando presente). */
  url?: string;
  text?: string;
  author?: string;
  date?: string;
  /** Score nativo da fonte (upvotes, stars, volume) quando aplicável. */
  score?: number;
  /** Metadados específicos da fonte — preservados integralmente (Bronze). */
  meta?: Record<string, unknown>;
}

/** Descreve uma fonte para catálogos/menus (GET /sources). */
export interface SourceDescriptor {
  id: SourceId;
  label: string;
  kind: string;
  description: string;
  capabilities: SourceCapability[];
  /** true = a query é um identificador exato (ex.: nome de pacote, id de app). */
  lookup?: boolean;
  /** Protocolo de coleta da fonte (ex.: "json", "api", "scrape"). */
  method?: "json" | "api" | "scrape" | "other";
  /** Tipo de autenticação (byok = traga sua própria chave; none = público). */
  auth?: "none" | "byok" | "oauth";
  /** Notas de termos de serviço/rate-limit para exibição na UI. */
  tosNote?: string;
}

/** Opções de uma chamada de coleta (contrato de entrada do adaptador). */
export interface CollectOptions {
  /** Termo de busca (ou id, quando `lookup`). */
  query: string;
  /** Limite de itens (1..50; fonte pode ter teto menor). */
  limit?: number;
  /** País/locale quando a fonte suporta (ex.: "br", "us"). */
  country?: string;
  /** Sinal de cancelamento da chamada. */
  signal?: AbortSignal;
}

/** Resultado estruturado de coleta — falha de UMA fonte nunca é exceção. */
export interface CollectResponse {
  source: SourceId;

  query: string;
  items: NormalizedItem[];
  /** true quando um cache do servidor atendeu (proveniência explícita). */
  cached?: boolean;
  /** Erro estruturado (a coleta é parcial-OK por design). */
  error?: string;
}

/** Link de cache HTTP conservador. */
export interface RateLimit {
  /** Requisições por segundo (média). */
  rps: number;
  /** Rajada máxima em 1s (burst. */
  burst: number;
}

/* ------------------------------------------------------------- dataset --- */

/** Entrada persistida no dataset local (Gold básico). */
export interface DatasetEntry {
  /** Chave de unicidade (o id do item. */
  key: string;
  item: NormalizedItem;
  /** Momento da gravação (ms epoch). */
  collectedAt: number;
}

/* ------------------------------------------------------------------ IA --- */

/** Modos de operação da IA. */
export type AIMode = "none" | "auto" | "local" | "cloud";

/** Provedor cloud suportado pelo dispatcher. */
export type CloudProvider = "openai" | "anthropic" | "gemini" | "openai-compatible";

export interface LocalAIConfig {
  ollamaUrl: string;
  /** "auto" = escolhe o melhor modelo instalado para o hardware (server-side). */
  model: string;
  useGpu: boolean;
  /** "auto" = num_ctx recomendado pelo perfil detectado. */
  numCtx?: number | "auto";
}

export interface CloudAIConfig {
  provider: CloudProvider;

  apiKey: string;
  /** Override de base URL (obrigatório p/ openai-compatible. */
  baseUrl: string;
  model: string;
}

export interface AIConfig {
  mode: AIMode;
  local?: LocalAIConfig;
  cloud?: CloudAIConfig;
}

/** Mensagem de chat no formato canônico do pipeline. */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Pedido de chat à IA (enviado via SSE — deltas OpenAI-compatíveis. */
export interface ChatRequest {
  messages: ChatMessage[];
  config?: AIConfig;

  /** Contexto determinístico construído a partir do dataset (nunca recalculado
   *   no prompt; vem do `derive` do núcleo. */
  contextHint?: string;
}

/* -------------------------------------------------------------- resposta -- */

/** Tipo de item suportado pelos formatadores genéricos da UI. */
export type ItemKind =
  | "post"
  | "article"
  | "question"
  | "answer"
  | "video"
  | "review"
  | "suggestion"
  | "trend-point"
  | "news"
  | "paper"
  | "repo"
  | "issue"
  | "game"
  | "complaint"
  | "document"
  | "book"
  | "package"
  | (string & {})