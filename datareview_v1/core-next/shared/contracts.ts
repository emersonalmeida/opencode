/**
 * Contratos compartilhados entre servidor e cliente (única fonte de verdade).
 *
 * O pipeline do sistema é:
 *   DISCOVER → SEARCH → COLLECT → NORMALIZE → DEDUPLICATE → STORE DATASET
 *   → DERIVE INSIGHTS → AI ANALYSIS
 *
 * Estes tipos são a "coluna vertebral" — tanto o servidor (coleta/normalização)
 * quanto o cliente (dataset/IA) os usam.
 */

/* ------------------------------------------------------------------ fontes --- */

/** Item normalizado produzido por QUALQUER fonte. O payload bruto específico
 *  fica em `meta` (auditável) — a normalização nunca descarta informação. */
export interface SourceItem {
  /** Identidade estável usada na deduplicação. Gerada quando ausente. */
  id: string;
  /** Fonte de origem. */
  source: string;
  /** Tipo do item (post/article/question/video/…) — vocabulário aberto. */
  kind: string;
  title: string;
  text?: string;
  url?: string;
  author?: string;
  date?: string;
  /** Score nativo da fonte (upvotes, stars, volume) quando aplicável. */
  score?: number;
  /** Payload bruto normalizado (metadados específicos da fonte). */
  meta?: Record<string, string>;
}

/** Resultado de uma chamada a uma fonte. */
export interface CollectResponse {
  source: string;
  query: string;
  items: SourceItem[];
  /** true quando um cache do servidor atendeu (proveniência explícita). */
  cached?: boolean;
  /** Erro estruturado — falha de UMA fonte nunca derruba as demais. */
  error?: string;
}

/* ----------------------------------------------------------------- dataset --- */

/** Entrada persistida no dataset local. */
export interface DatasetEntry {
  /** Chave de unicidade. */
  key: string;
  item: SourceItem;
  /** Momento da gravação. */
  collectedAt: number;
}

/* ---------------------------------------------------------------------- IA --- */

export interface AIRequest {
  messages: { role: string; content: string }[];
  config?: AIConfig;
  /** Contexto determinístico construído pelo cliente a partir do dataset. */
  contextHint?: string;
}

export interface AIConfig {
  mode: "auto" | "none" | "local" | "cloud";
  local?: {
    ollamaUrl: string;
    model: string;
    useGpu: boolean;
    numCtx?: number | "auto";
  };
  cloud?: {
    provider: "openai" | "anthropic" | "gemini" | "openai-compatible";
    apiKey: string;
    baseUrl: string;
    model: string;
  };
}

/* ----------------------------------------------------- descrição de fontes --- */

export interface SourceDescriptor {
  id: string;
  label: string;
  kind: string;
  description: string;
  /** true coleta por lookup de identificador exato (nome de pacote etc.). */
  lookup?: boolean;
}
