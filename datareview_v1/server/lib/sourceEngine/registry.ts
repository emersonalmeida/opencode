/**
 * Source Engine — registry central de fontes plugáveis.
 *
 * Uma fonte = um `SourceCollector` registrado aqui. Plugar/desplugar =
 * uma linha (registerSource/registerSources). O registry é a única
 * fonte de verdade de "quais fontes o sistema tem" — rotas, UI, auditoria
 * e testes consomem SÓ este módulo (nunca importam collectors direto).
 *
 * Descriptor é derivado do collector de forma canônica (nunca duplicado:
 * o que não for declarado no collector usa default sensato).
 */
import type { SourceCollector, SourceDescriptor } from "./types.js";
export type { SourceCollector, SourceDescriptor } from "./types.js";

const registered = new Map<string, SourceCollector>();

/** Registra UMA fonte plugável. Idempotente: mesma id substitui (permite
 *  recarregamento de módulo em testes sem duplicar. */
export function registerSource(source: SourceCollector): void {
  registered.set(source.id, source);
}

/** Registra N fontes de uma vez (conveniência para lotes de adapters). */
export function registerSources(sources: SourceCollector[]): void {
  for (const s of sources) registerSource(s);
}

/** Desregistra uma fonte (usado em testes p/ manter o registry limpo. */
export function unregisterSource(id: string): void {
  registered.delete(id);
}

/** Coletor registrado por id. Undefined quando desconhecida. */
export function getCollector(id: string): SourceCollector | undefined {
  return registered.get(id);
}

/** Coletores registrados, em ordem de registro estável. */
export function listCollectors(): SourceCollector[] {
  return [...registered.values()];
}

/** Limpa tod os registros (testes/teardown). */
export function clearRegistry(): void {
  registered.clear();
}

/** Deriva a `SourceDescriptor` pública de um collector de forma canônica. */
export function describeSource(c: SourceCollector): SourceDescriptor {
  return {
    id: c.id,
    label: c.label,
    kind: c.kind,
    ...(c.description ? { description: c.description } : {}),
    auth: c.auth ?? "none",
    capabilities: {
      search: c.capabilities?.search,
      lookup: c.capabilities?.lookup,
      reviews: c.capabilities?.reviews,
      topCharts: c.capabilities?.topCharts,
      healthCheck: c.capabilities?.healthCheck,
    },
    ...(c.rateLimit ? { rateLimit: c.rateLimit } : {}),
    ...(c.supportsIncremental !== undefined ? { supportsIncremental: c.supportsIncremental } : {}),
    ...(c.supportsHistorical !== undefined ? { supportsHistorical: c.supportsHistorical } : {}),
    ...(c.regions?.length ? { regions: c.regions } : {}),
    ...(c.tosNote ? { tosNote: c.tosNote } : {}),
    ...(c.method ? { method: c.method } : {}),
    ...(c.collector ? { collector: c.collector } : {}),
    ...(c.collectorVersion ? { collectorVersion: c.collectorVersion } : {}),
    ...(c.paramsSpec?.length ? { paramsSpec: c.paramsSpec } : {}),
    ...(c.tags?.length ? { tags: c.tags } : {}),
  };
}

/** Descritores de todas as fontes registradas (para GET /engine/sources). */
export function listDescriptors(): SourceDescriptor[] {
  return listCollectors().map(describeSource);
}

/** Descritor de uma fonte por id. Undefined quando desconhecida. */
export function getDescriptor(id: string): SourceDescriptor | undefined {
  const c = getCollector(id);
  return c ? describeSource(c) : undefined;
}