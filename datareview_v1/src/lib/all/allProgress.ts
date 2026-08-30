/**
 * Progresso da jornada `/all` — checklist de tarefas concluídas por seção.
 * Store pub/sub persistida (`aso:all:done:v1`): o usuário marca a tarefa
 * como concluída e o progresso sobrevive a reloads. Funções puras são
 * testáveis sem DOM (`nextDone(ids, id)`); o wrapper de storage fica fino.
 */
import { useEffect, useState } from "react";
import { ALL_STORAGE_PREFIX, totalTasks } from "@/lib/all/allModel";

const KEY = `${ALL_STORAGE_PREFIX}done:v1`;

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  for (const l of listeners) l();
}

export function subscribeAllDone(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Leitura segura (storage corrompido → conjunto vazio). */
export function getDoneIds(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr: unknown = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Próximo estado (puro): adiciona/remove o id. */
export function nextDone(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

/** Persiste e notifica. */
export function setDoneIds(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* quota */
  }
  notify();
}

/** Alterna a conclusão de uma seção. */
export function toggleDone(id: string) {
  setDoneIds(nextDone(getDoneIds(), id));
}

/** Progresso (0..1) sobre as tarefas embutíveis do modelo. */
export function doneProgress(doneIds: string[], tasks: number = totalTasks()): number {
  if (tasks <= 0) return 0;
  return Math.min(1, doneIds.length / tasks);
}

/** Hook reativo no padrão useDataset (useState + subscribe — NÃO
 *  useSyncExternalStore com snapshot mutável). */
export function useAllDone(): string[] {
  const [ids, setIds] = useState<string[]>(() => getDoneIds());
  useEffect(() => subscribeAllDone(() => setIds(getDoneIds())), []);
  return ids;
}
