/**
 * Coleção local de datasets — guarda apps coletados com TODOS os reviews para
 * alimentar a página de Experimentos e a IA. Persistido em localStorage.
 *
 * Cada entry: { app: AppInfo, reviews: ReviewEntry[], collectedAt }.
 * A chave de unicidade é `${store}:${id}`.
 *
 * PERFORMANCE (2026-08-19): o dataset pode ter dezenas de milhares de reviews
 * (vários MB de JSON). Antes, CADA read() fazia JSON.parse de tudo (27+ call
 * sites). Agora o módulo mantém um CACHE de parse: `listDataset()` retorna a
 * MESMA referência de array entre writes — o que também estabiliza deps de
 * useMemo/useEffect em todos os consumidores (sem recomputo espúrio) e dá
 * `getDatasetEntry()`/`hasDataset()` lookup O(1) via índice lazy.
 */
import type { AppInfo, ReviewEntry } from "@/lib/appStoreApi";
import { idbWriteAll, idbReadAll, idbClear } from "@/lib/datasetDb";

export interface DatasetEntry {
  app: AppInfo;
  reviews: ReviewEntry[];
  collectedAt: number;
}

const KEY = "aso:dataset:v1";
type Listener = () => void;
const listeners = new Set<Listener>();

/* ---------------------------------------------------- cache de leitura --- */

interface Cache {
  /** string bruta lida do localStorage (identidade = conteúdo). */
  raw: string | null;
  /** array parseado — referência ESTÁVEL entre writes. */
  parsed: DatasetEntry[];
  /** revisão monotônica — incrementada a cada write. */
  rev: number;
  /** índice lazy por `${store}:${id}` (reconstruído quando rev muda). */
  index: Map<string, DatasetEntry> | null;
}
const cache: Cache = { raw: null, parsed: [], rev: 0, index: null };

function read(): DatasetEntry[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return cache.parsed;
  }
  // Identidade da string = conteúdo inalterado → retorna o parse cacheado.
  if (raw === cache.raw) return cache.parsed;
  let parsed: DatasetEntry[] = [];
  try {
    parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) parsed = [];
  } catch {
    parsed = [];
  }
  cache.raw = raw;
  cache.parsed = parsed;
  cache.rev++;
  cache.index = null;
  return parsed;
}

function write(list: DatasetEntry[]) {
  let raw = "[]";
  try {
    raw = JSON.stringify(list);
  } catch {
    raw = "[]";
  }
  let finalList = list;
  try {
    localStorage.setItem(KEY, raw);
  } catch {
    // Quota — drop oldest review tails and retry once.
    const trimmed = list.map((e) => ({
      ...e,
      reviews: e.reviews.slice(0, 200),
    }));
    finalList = trimmed;
    try {
      raw = JSON.stringify(trimmed);
      localStorage.setItem(KEY, raw);
    } catch {
      /* give up — keep in-memory state consistent anyway */
    }
  }
  // Atualiza o cache SEM re-parsear (a lista já está em memória).
  cache.raw = raw;
  cache.parsed = finalList;
  cache.rev++;
  cache.index = null;
  listeners.forEach((l) => l());
  // Espelho durável no IndexedDB (Onda 3.1): fire-and-forget — a escrita no
  // localStorage é a fonte síncrona; o IDB é o backup de grande capacidade
  // que sobrevive à eviction do localStorage e à quota estourada.
  void idbWriteAll(finalList);
}

/**
 * Boot (Onda 3.1, fatia migração): se o localStorage está vazio mas o
 * IndexedDB tem dados (ex.: localStorage foi limpo/evictado), reidrata o
 * cache + storage e notifica os consumidores. Também migra: quem tinha só
 * localStorage passa a ter o espelho IDB no próximo write.
 */
export async function initDatasetStore(): Promise<void> {
  if (read().length > 0) return; // localStorage é a fonte rápida — nada a fazer
  const fromIdb = await idbReadAll();
  if (fromIdb.length === 0) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(fromIdb));
  } catch {
    // Sem espaço no localStorage: alimenta só o cache em memória.
    cache.parsed = fromIdb;
    cache.rev++;
    cache.index = null;
    listeners.forEach((l) => l());
    return;
  }
  cache.raw = null; // força re-leitura do storage na próxima chamada
  listeners.forEach((l) => l());
}

/* ------------------------------------------------------- API pública --- */

export function listDataset(): DatasetEntry[] {
  return read();
}

/** Revisão monotônica do dataset — muda a cada write. Use para invalidar
 *  caches derivados ou estampar proveniência em bases derivadas. */
export function datasetRevision(): number {
  read(); // garante cache sincronizado com o storage
  return cache.rev;
}

export function datasetKey(store: string, id: string) {
  return `${store}:${id}`;
}

function index(): Map<string, DatasetEntry> {
  const list = read();
  if (!cache.index) {
    const map = new Map<string, DatasetEntry>();
    for (const e of list) map.set(datasetKey(e.app.store, e.app.id), e);
    cache.index = map;
  }
  return cache.index;
}

export function getDatasetEntry(store: string, id: string): DatasetEntry | undefined {
  return index().get(datasetKey(store, id));
}

export function hasDataset(store: string, id: string): boolean {
  return index().has(datasetKey(store, id));
}

export function upsertDataset(entry: DatasetEntry) {
  const list = read();
  const idx = list.findIndex(
    (e) => e.app.store === entry.app.store && e.app.id === entry.app.id
  );
  const next = [...list];
  if (idx >= 0) next[idx] = entry;
  else next.push(entry);
  write(next);
}

export function removeDataset(store: string, id: string) {
  write(read().filter((e) => !(e.app.store === store && e.app.id === id)));
}

export function clearDataset() {
  write([]);
  // Limpa também o espelho durável (write([]) já cobre, mas garante sem
  // depender do fire-and-forget da escrita vazia).
  void idbClear();
}

export function subscribeDataset(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
