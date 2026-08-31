/**
 * Bridge do front para o motor @v6/sources — sem backend.
 * BYOK (traga sua chave): setChave/resetChaves recriam o registry
 * e persistem no localStorage do browser (nunca no servidor;.
 */
import {
  createSources,
  sourcesFromEnv,
  collectAll,
  listSourceCatalog,
} from "@v6/sources";
import type { CollectOptions, CollectResponse } from "@v6/contracts";
import type { ApiKeys } from "@v6/sources";

export type { CollectOptions, CollectResponse } from "@v6/contracts";
export type { SourceRegistry, ApiKeys } from "@v6/sources";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const KEYS_STORAGE = "datareview.v6.keys";
const isBrowser = typeof window !== "undefined";

function defaultStorage(): StorageLike | null {
  return isBrowser && typeof localStorage !== "undefined" ? localStorage : null;
}

function readChaves(storage: StorageLike | null): ApiKeys {
  if (!storage) return {};
  try {
    const raw = storage.getItem(KEYS_STORAGE);
    return raw ? (JSON.parse(raw) as ApiKeys) : {};
  } catch {
    return {};
  }
}

let chaves: ApiKeys = readChaves(defaultStorage());

export let motor = isBrowser ? createSources({ keys: chaves }) : sourcesFromEnv();

export const catalogo = listSourceCatalog();
export const grupos = catalogo.reduce<Record<string, number>>((acc,c) => {
  acc[c.group] = (acc[c.group] ?? 0) + 1;
  return acc;
}, {});
export const ativas = motor.enabled;

function persistir(storage: StorageLike | null) {
  if (!storage) return;
  if (Object.keys(chaves).length === 0) storage.removeItem(KEYS_STORAGE);
  else storage.setItem(KEYS_STORAGE, JSON.stringify(chaves));
}

export function setChave(nome: string, valor: string, storage: StorageLike | null = defaultStorage()) {
  chaves = { ...chaves, [nome]: valor.trim() || undefined };
  persistir(storage);
  motor = isBrowser ? createSources({ keys: chaves }) : sourcesFromEnv();
}

export function resetChaves(storage: StorageLike | null = defaultStorage()) {
  chaves = {};
  persistir(storage);
  motor = isBrowser ? createSources({ keys: chaves }) : sourcesFromEnv();
}

export function chavesAtivas(): ApiKeys {
  return { ...chaves };
}

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