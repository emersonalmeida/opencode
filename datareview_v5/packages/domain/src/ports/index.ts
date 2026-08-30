/**
 * Ports do núcleo — as interfaces que o domínio conhece do mundo exterior.
 *
 * O núcleo NUNCA importa HTTP, banco, React nem fontes concretas; ele só
 * conversa com estes ports. Fontes, storage e IA são adaptadores que os
 * implementam — assim trocar qualquer um nunca toca no núcleo.
 */
import type {
  ChatRequest,
  CollectOptions,
  CollectResponse,
  DatasetEntry,
  RateLimit,
  SerpApiBudget,
  SourceDescriptor,
  SourceId,
} from "@v5/contracts";

/* ------------------------------------------------------- fonte (driving) - */

/** Contrato ÚNICO que TODAS as fontes implementam (1 interface, N fontes). */
export interface SourcePort {
  readonly id: SourceId;
  readonly label: string;
  readonly kind: string;
  readonly description: string;
  readonly capabilities: SourceDescriptor["capabilities"];
  readonly rateLimit: RateLimit;

  /** 1 chamada = 1 protocolo da fonte. Retorna SEMPRE itens normalizados
   *   + metadados; nunca lança — falhas viram `error` no resultado (parcial-OK). */
  collect(options: CollectOptions): Promise<CollectResponse>;
}

/* ------------------------------------------------------------ storage --- */

/** Persistência que o pipeline consome — desconhece SQLite/IDB/Postgres/Memória. */
export interface StoragePort {
  /** Lista geral (ordem: mais recente primeiro). */
  list(): Promise<DatasetEntry[]>;
  /** Lookup O(1) por chave. */
  get(key: string): Promise<DatasetEntry | undefined>;
  /** Insere/item atualiza (upsert por chave estável do item). Retorna true se novo. */
  upsert(entry: DatasetEntry): Promise<boolean>;
  /** Insere vários itens. Retorna quantos eram novos. */
  upsertMany(entries: DatasetEntry[]): Promise<number>;
  /** Revisão monotônica do dataset — muda a cada write (proveniência. */
  revision(): Promise<number>;
}

/* ---------------------------------------------------------------- IA --- */

/** Motor de IA que o pipeline usa (dispatcher LLM — adaptador trocável. */
export interface AIPort {
  /** Gera uma resposta a partir de mensagens + contexto determinístico. */
  chat(request: ChatRequest): Promise<string>;
}

/* ----------------------------------------------------------- derivados --- */

/* ------------------------------------------------------- fallback (serpapi) -- */

/** Rastreador de orçamento SerpAPI (fonte escassa — Free: 250 buscas/mês). Om
 *   `serpapi` e recurso dispensado; o pipeline deve checar `remaining()` antes
 *   de acionar o fallback e contabilizar cada chamada real (ADR-0002.. */
export interface SerpApiQuotaPort {
  /** Orçamento atual da janela (used/limit/resetsAt.. */
  budget(): Promise<SerpApiBudget>;

  /** true quando ainda há cota para N chamadas nesta janela/orçamento.. */
  remaining(count: number): Promise<boolean>;

  /** Consome a cota de N chamadas (chamar SÓ após `remaining()` e antes
   *   de disparar as requests — contabilizar é parte do controle de orçamento.. */
  consume(count: number, engine: string, forSource: SourceId): Promise<void>;

  /** Contabiliza a janela de forma idempotente (recompute usado.. */
  reconcile(): Promise<SerpApiBudget>;
}
/** Agregações determinísticas que a IA e a UI usam (derivar sem reinventar. */
export interface DatasetStats {
  total: number;
  bySource: Record<string, number>;
  byKind: Record<string, number>;
  withScore: number;
  newest: Date | null;
}

/** Funções puras de derivação — recebem entradas, devolvem dados. */
export interface DerivePort {
  stats(list: DatasetEntry[]): DatasetStats;

  /** Texto de contexto determinístico a alimentar a IA. */
  contextHint(list: DatasetEntry[], maxItems?: number): string;

  /** Busca acento-insensível por tokens (todos batem: title+text+author). */
  search(list: DatasetEntry[], term: string): DatasetEntry[];
}