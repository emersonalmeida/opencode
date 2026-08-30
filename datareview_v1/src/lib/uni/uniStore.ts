/**
 * Uni Store — coleções salvas da página /00 (aso:uni:v1).
 *
 * Store pub/sub no padrão dos demais stores do sistema. Dados GERADOS por IA
 * não ficam aqui: usam o aiOutputStore (aso:ai-outputs:v1) — este store é só
 * para dados COLETADOS das fontes.
 */
import { useEffect, useState } from "react";
import type { UniCollection, UniItem, UniSourceId } from "./types";

const KEY = "aso:uni:v1";
const CAP = 60; // coleções salvas (drop da mais antiga)
const listeners = new Set<() => void>();

let cache: UniCollection[] | null = null;

function load(): UniCollection[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as UniCollection[]) : [];
    cache = Array.isArray(parsed) ? parsed.filter((c) => c?.id && Array.isArray(c.items)) : [];
  } catch {
    cache = [];
  }
  return cache!;
}

function persist(next: UniCollection[]): void {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* quota excedida — mantém em memória */
  }
  listeners.forEach((fn) => fn());
}

export function subscribeUni(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function listCollections(): UniCollection[] {
  return load();
}

export function getCollection(id: string): UniCollection | undefined {
  return load().find((c) => c.id === id);
}

export function saveCollection(input: {
  label: string;
  source: UniSourceId;
  query: string;
  items: UniItem[];
  params?: Record<string, unknown>;
}): UniCollection {
  const collection: UniCollection = {
    id: `uni_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    label: input.label.trim() || `${input.source} · ${input.query}`.slice(0, 60),
    source: input.source,
    query: input.query,
    items: input.items,
    collectedAt: Date.now(),
    params: input.params,
  };
  const next = [collection, ...load()].slice(0, CAP);
  persist(next);
  return collection;
}

export function renameCollection(id: string, label: string): void {
  persist(load().map((c) => (c.id === id ? { ...c, label: label.trim() || c.label } : c)));
}

export function deleteCollection(id: string): UniCollection | undefined {
  const found = getCollection(id);
  persist(load().filter((c) => c.id !== id));
  return found;
}

/** Restaura uma coleção excluída (undo). */
export function restoreCollection(collection: UniCollection): void {
  persist([collection, ...load().filter((c) => c.id !== collection.id)].slice(0, CAP));
}

export function clearCollections(): UniCollection[] {
  const prev = load();
  persist([]);
  return prev;
}

/** Hook reativo (padrão useDataset: useState + subscribe — NÃO
 * useSyncExternalStore com lista mutável). */
export function useUniCollections(): UniCollection[] {
  const [collections, setCollections] = useState<UniCollection[]>(() => load());
  useEffect(() => subscribeUni(() => setCollections(load())), []);
  return collections;
}

/** Todos os itens de coleções selecionadas (ou todas se vazio). */
export function collectItems(collections: UniCollection[], ids?: Set<string>): UniItem[] {
  const scope = ids?.size ? collections.filter((c) => ids.has(c.id)) : collections;
  return scope.flatMap((c) => c.items);
}
