/**
 * Adapter IndexedDB do dataset (Onda 3.1, fatia 1): backend durável de
 * grande capacidade por trás do datasetStore (localStorage vira cache de
 * boot rápido; o IDB aguenta centenas de MB — sem teto físico de 5-10MB).
 *
 * Failure-safe por design: sem IndexedDB (SSR, modo privado, navegador
 * antigo) tudo vira no-op silencioso e o sistema segue 100% funcional só
 * com o localStorage. Nenhum consumidor muda — a API pública do
 * datasetStore continua síncrona (o IDB é escrita assíncrona em background
 * + fonte de reidratação quando o localStorage estiver vazio).
 */
import type { DatasetEntry } from "./datasetStore";

const DB_NAME = "aso-dataset";
const STORE = "entries";

let dbPromise: Promise<IDBDatabase | null> | null = null;

/** Abre (ou cria) o banco — promise única por processo. */
export function openDatasetDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "key" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

interface StoredEntry {
  key: string;
  entry: DatasetEntry;
}

function tx<T>(db: IDBDatabase, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return new Promise((resolve) => {
    try {
      const t = db.transaction(STORE, mode);
      const req = fn(t.objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      t.onerror = () => resolve(null);
      t.onabort = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** Escreve TODO o dataset (sobrescreve o store inteiro — dataset é pequeno
 *  em número de apps; reviews grandes vivem dentro de cada entry). */
export async function idbWriteAll(entries: DatasetEntry[]): Promise<void> {
  const db = await openDatasetDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const t = db.transaction(STORE, "readwrite");
      const store = t.objectStore(STORE);
      store.clear();
      for (const entry of entries) {
        const record: StoredEntry = { key: `${entry.app.store}:${entry.app.id}`, entry };
        store.put(record);
      }
      t.oncomplete = () => resolve();
      t.onerror = () => resolve();
      t.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

/** Lê TODO o dataset (boot/reidratação). */
export async function idbReadAll(): Promise<DatasetEntry[]> {
  const db = await openDatasetDb();
  if (!db) return [];
  const result = await tx(db, "readonly", (store) => store.getAll() as IDBRequest<StoredEntry[]>);
  if (!Array.isArray(result)) return [];
  return result.map((r) => r.entry).filter(Boolean);
}

/** Limpa o store. */
export async function idbClear(): Promise<void> {
  const db = await openDatasetDb();
  if (!db) return;
  await tx(db, "readwrite", (store) => store.clear());
}

/** Pede persistência durável ao navegador (evita eviction sob pressão). */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.storage?.persist) {
      return await navigator.storage.persist();
    }
  } catch {
    // não suportado
  }
  return false;
}
