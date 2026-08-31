/**
 * Bridge do front para o motor @v6/sources — sem backend.
 * O registry singleton (8 fontes públicas ativas por padrão) é criado
 * com createSources no browser e sourcesFromEnv no servidor (keys BYOK.
 */
import {
  createSources,
  sourcesFromEnv,
  collectAll,
  listSourceCatalog,
} from "@v6/sources";
import type { CollectOptions, CollectResponse } from "@v6/contracts";

export type { CollectOptions, CollectResponse } from "@v6/contracts";
export type { SourceRegistry, ApiKeys } from "@v6/sources";

const isBrowser = typeof window !== "undefined";
export const motor = isBrowser ? createSources({}) : sourcesFromEnv();
export const catalogo = listSourceCatalog();
export const grupos = catalogo.reduce<Record<string, number>>((acc, f) => {
  acc[f.group] = (acc[f.group] ?? 0) + 1;
  return acc;
}, {});
export const ativas = motor.enabled;

export async function coletar(
  opts: CollectOptions,
  alvo?: readonly string[]
): Promise<CollectResponse[]> {
  const respostas = await collectAll(motor, { ...opts, limit: opts.limit ?? 10 });
  return alvo ? respostas.filter((r) => alvo.includes(r.source)) : respostas;
}

export function ativaCount(): number {
  return ativas.length;
}
