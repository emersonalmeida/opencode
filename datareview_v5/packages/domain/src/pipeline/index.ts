/**
 * Pipeline canonico - orquestrador FONTE-AGNOSTICO do sistema.
 *
 *   COLETA (fonte adaptador) -> NORMALIZA (ja vem normalizado do adaptador)
 *   -> DEDUP (storage upsert) -> DERIVA (stats/contextHint, opcional) -> IA (opcional).
 *
 * O pipeline NUNCA conhece uma fonte concreta: recebe SourcePort, StoragePort
 * e (opcional) AIPort como dependencias. Nova fonte = 0 mudancas aqui.

 * Medallion por design:

 *  - Bronze: o meta de cada item preserva o payload bruto da fonte (auditavel).
 *  - Silver: os itens normalizados vem do adaptador (id estavel para dedup).
 *  - Gold: os derivados (stats/contextHint) sao computados aqui, sob demanda.
.
 */
import type {
  CollectOptions,
  CollectResponse,
  DatasetEntry,
  NormalizedItem,
} from "@v5/contracts";
import type { AIPort, SourcePort, StoragePort } from "../ports/index.js";
import { derive } from "./derive.js";
import { stableId } from "./stableId.js";

export interface CollectRun<TMeta = unknown> {
  /** Itens novos que entraram no dataset. */
  added: number;

  /** Itens total devolvidos pela fonte (novos + ja existentes. */
  total: number;
  /** Resposta crua do adaptador (com itens normalizados. */
  response: CollectResponse;
  /** Metadados da execucao (proveniencia,, opcional. */
  meta?: TMeta;
}

/** Resultado de uma execucao completa de pipeline com IA. */
export interface AnalyzeRun<TMeta = unknown> extends CollectRun<TMeta> {
  /** Resposta da IA quando ela foi fornecida. */
  aiResponse?: string;
}

export interface PipelineDeps {
  storage: StoragePort;

  ai?: AIPort;
}

/** Executa coleta->dedup->persistir para UMA fonte. Nunca lanca - erros
 *  de fonte viram collect.error (parcial-OK por design.. */
export async function runSource(
  source: SourcePort,
  options: CollectOptions,
  deps: PipelineDeps,
  meta?: unknown,
): Promise<CollectRun> {
  const response = await source.collect(options);
  const entries: DatasetEntry[] = response.items.map((item: NormalizedItem) => ({
    key: stableId(item),
    item,
    collectedAt: Date.now(),
  }));
  const added = await deps.storage.upsertMany(entries);
  return { added, total: entries.length, response, meta: meta as never };
}

/** Executa o pipeline completo (coleta + derive + IA opcional.. */
export async function runPipeline(
  source: SourcePort,
  options: CollectOptions,
  deps: PipelineDeps,
): Promise<AnalyzeRun> {
  const run = await runSource(source, options, deps);
  let aiResponse: string | undefined;
  if (deps.ai && !run.response.error && run.response.items.length > 0) {
    const list = await deps.storage.list();
    const stats = derive.stats(list);
    if (stats.total > 0) {
      aiResponse = await deps.ai.chat({
        messages: [
          {
            role: "system",
            content: "Voce e um analista de dados de fontes publicas. Responda em PT-BR, "
              + "com base APENAS no contexto fornecido, citando a fonte de cada afirmacao.",
          },
          { role: "user", content: derive.contextHint(list) },
        ],
      });
    }
  }
  return { ...run, aiResponse };
}

/** Constroi derivados Gold sob demanda a partir do storage. */
export async function deriveFromDataset(storage: StoragePort) {
  const list = await storage.list();
  return { stats: derive.stats(list), hint: derive.contextHint(list) };
}
