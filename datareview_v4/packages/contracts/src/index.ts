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
  /** Tipo do item — vocabulário aberto (ver `ItemKind`; os valores canônicos
   *   são compartilhados com os formatadores da UI). */
  kind: ItemKind;
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
  /** Proveniência quando a fonte primária falhou e um fallback multi-fonte
   *   (ex.: `serpapi`) atendeu a chamada (ADR-0002). */
  fallback?: EngineFallback;
}
/** Proveniência de fallback multi-fonte (ADR-0002). */
export interface EngineFallback {
  /** Motor/nome do produto SerpAPI usado (ex.: google_search, google_news) quando o adaptador caiu nele. */
  engine: string;
  /** Fonte que foi contornada (id do adaptador primário que falhou). */
  forSource: SourceId;
  /** true = a chamada só existe por causa do fallback (orelha de orçamento gasto.. */
  quotaConsumed: boolean;
}

/** Janela de orçamento SerpAPI (Free: 250 buscas/mês — ADR-0002. */
export interface SerpApiBudget {
  /** Total permitido na janela (250). */
  limit: number;
  /** Quantas chamadas SerpAPI já consumiram a janela (local ou no servidor.. */
  used: number;
  /** Quando a janela renova (epoch ms.. */
  resetsAt: number;
  /** Limite diário opcional (sub-janela mais conversadora.. */
  dailyLimit?: number;
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
  /** Operador/vertical da fonte (ex.: "site:ycombinator.com" para HN via SERP). */
  engine?: string;
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
  /** Erro estruturado (a coleta é parcial-OK por design）. */
  error?: string;
  /** Metadados de execução da coleta (ex.: engine serpapi usado,. */
  meta?: Record<string, unknown>;
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

/** Vocabulário documentado de itens suportados pelos formatadores da UI.
 *  O sentinela `(string & {})` mantém o vocabulário ABERTO (novas fontes
 *  não exigem mudança aqui), mas os valores abaixo são os canônicos — os
 *  adaptadores DEVEM usar exatamente estes quando aplicáveis. */
export type ItemKind =
  | "post"        // postagem social (Reddit, HN, Mastodon, Bluesky, Lobsters)
  | "article"     // artigo/notícia/feed (DEV, Web, GDELT, Google News)
  | "question"    // pergunta (StackExchange, Reddit)
  | "answer"      // resposta (StackExchange)
  | "video"       // vídeo (YouTube)
  | "review"      // review de produto (Apple, Google Play, ReclameAqui, Steam)
  | "suggestion"  // sugestão de autocomplete (Google Suggest, multi-provedor)
  | "trend-point" // ponto de tendência/série (Google Trends, trending)
  | "news"        // item de notícia sem artigo completo
  | "paper"       // paper acadêmico (arXiv, Semantic Scholar, OpenAlex, Crossref, DOAJ)
  | "repo"        // repositório (GitHub, GitLab)
  | "issue"       // issue/pull request (GitHub)
  | "game"        // jogo (Steam, itch.io, SteamSpy)
  | "complaint"   // reclamação (ReclameAqui)
  | "document"    // página/URL extraída genérica (Web, Wikipedia)
  | "book"        // livro (Open Library)
  | "package"     // pacote de código (npm, PyPI, RubyGems, crates.io)
  | "app"         // aplicativo (Apple App Store, Google Play)
  | "result"      // resultado de SERP
  | "series"      // série de TV (TVMaze)
  | "track"       // faixa de música (Deezer)
  | "podcast"     // podcast (iTunes charts)
  | "product"     // produto físico (Open Food Facts)
  | "company"     // empresa/marca (ReclameAqui)
  | "entity"      // entidade estruturada (Wikidata)
  | "event"       // evento do dia (Wikipedia onThisDay)
  | "metric"      // dado agregado/série temporal (câmbio, clima, downloads, views)
  | "crypto"      // criptomoeda (CoinGecko)
  | "person"      // pessoa/nome (IBGE nomes)
  | (string & {})