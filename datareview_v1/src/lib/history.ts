/**
 * User activity history (apps visited, comparisons opened).
 * Persisted in localStorage. Emits a "change" event so the sidebar re-renders.
 */
import type { SourceId } from "./appStoreApi";

const KEY = "aso:history";
const MAX = 60;

export type HistoryEntry =
  | { type: "app"; store: SourceId; id: string; name: string; icon?: string; ts: number }
  | { type: "compare"; apps: { store: SourceId; id: string; name: string; icon?: string }[]; ts: number };

const listeners = new Set<() => void>();

function read(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function write(list: HistoryEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    listeners.forEach(l => l());
  } catch { /* ignore */ }
}

export function getHistory(): HistoryEntry[] {
  return read();
}

export function pushHistory(entry: HistoryEntry) {
  const list = read();
  // Deduplicate: same key gets moved to top with new timestamp.
  const key = entry.type === "app"
    ? `app:${entry.store}:${entry.id}`
    : `compare:${entry.apps.map(a => `${a.store}:${a.id}`).sort().join(",")}`;
  const filtered = list.filter(e => {
    const k = e.type === "app"
      ? `app:${e.store}:${e.id}`
      : `compare:${e.apps.map(a => `${a.store}:${a.id}`).sort().join(",")}`;
    return k !== key;
  });
  filtered.unshift(entry);
  write(filtered);
}

export function removeHistory(entry: HistoryEntry) {
  const list = read();
  const key = entry.type === "app"
    ? `app:${entry.store}:${entry.id}`
    : `compare:${entry.apps.map(a => `${a.store}:${a.id}`).sort().join(",")}`;
  const filtered = list.filter(e => {
    const k = e.type === "app"
      ? `app:${e.store}:${e.id}`
      : `compare:${e.apps.map(a => `${a.store}:${a.id}`).sort().join(",")}`;
    return k !== key;
  });
  write(filtered);
}

export function clearHistory() {
  write([]);
}

export function subscribeHistory(fn: () => void): () => void {
  listeners.add(fn);
  const storageHandler = (e: StorageEvent) => { if (e.key === KEY) fn(); };
  window.addEventListener("storage", storageHandler);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", storageHandler);
  };
}

export function groupByDate(list: HistoryEntry[]): { label: string; items: HistoryEntry[] }[] {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const week = new Date(today); week.setDate(week.getDate() - 7);

  const buckets: Record<string, HistoryEntry[]> = { Hoje: [], Ontem: [], "Últimos 7 dias": [], "Mais antigo": [] };
  for (const e of list) {
    const d = new Date(e.ts);
    if (d >= today) buckets["Hoje"].push(e);
    else if (d >= yesterday) buckets["Ontem"].push(e);
    else if (d >= week) buckets["Últimos 7 dias"].push(e);
    else buckets["Mais antigo"].push(e);
  }
  return Object.entries(buckets).filter(([, items]) => items.length > 0).map(([label, items]) => ({ label, items }));
}
