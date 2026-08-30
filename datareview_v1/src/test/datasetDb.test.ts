/**
 * Adapter IndexedDB do dataset (Onda 3.1): testes com fake-indexeddb —
 * round-trip REAL do IDB (não mock): escrever, ler, limpar, reidratar o
 * datasetStore quando o localStorage está vazio, e no-op fora de IDB.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { indexedDB } from "fake-indexeddb";
import { idbWriteAll, idbReadAll, idbClear, requestPersistence } from "@/lib/datasetDb";
import {
  initDatasetStore, listDataset, upsertDataset, clearDataset, datasetRevision,
  type DatasetEntry,
} from "@/lib/datasetStore";
import type { AppInfo, ReviewEntry } from "@/lib/appStoreApi";

// fake-indexeddb no jsdom
(globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = indexedDB;

function mkEntry(id: string, reviews: number): DatasetEntry {
  const app = { store: "apple", id, name: `App ${id}` } as AppInfo;
  const list: ReviewEntry[] = Array.from({ length: reviews }, (_, i) => ({
    id: `${id}-r${i}`, rating: 5, title: "", text: "", author: "u", date: "2026-08-01",
  })) as ReviewEntry[];
  return { app, reviews: list, collectedAt: Date.now() };
}

describe("datasetDb — adapter IndexedDB (Onda 3.1)", () => {
  beforeEach(async () => {
    localStorage.clear();
    clearDataset();
    await idbClear();
  });

  it("round-trip: escreve e lê entries completos (reviews inclusos)", async () => {
    const entries = [mkEntry("1", 50), mkEntry("2", 200)];
    await idbWriteAll(entries);
    const read = await idbReadAll();
    expect(read).toHaveLength(2);
    expect(read.find((e) => e.app.id === "2")?.reviews).toHaveLength(200);
  });

  it("sobrescreve no write seguinte (sem duplicar)", async () => {
    await idbWriteAll([mkEntry("1", 10)]);
    await idbWriteAll([mkEntry("1", 20), mkEntry("3", 5)]);
    const read = await idbReadAll();
    expect(read).toHaveLength(2);
    expect(read.find((e) => e.app.id === "1")?.reviews).toHaveLength(20);
  });

  it("idbClear esvazia", async () => {
    await idbWriteAll([mkEntry("1", 10)]);
    await idbClear();
    expect(await idbReadAll()).toEqual([]);
  });

  it("initDatasetStore reidrata do IDB quando o localStorage está vazio", async () => {
    // Estado: localStorage vazio, IDB com dados (ex.: eviction do LS).
    await idbWriteAll([mkEntry("9", 30)]);
    const revBefore = datasetRevision();
    await initDatasetStore();
    expect(listDataset()).toHaveLength(1);
    expect(listDataset()[0].app.id).toBe("9");
    expect(listDataset()[0].reviews).toHaveLength(30);
    expect(datasetRevision()).toBeGreaterThan(revBefore);
    // localStorage repovoado (boot rápido na próxima sessão)
    expect(localStorage.getItem("aso:dataset:v1")).toContain('"9"');
  });

  it("initDatasetStore não sobrescreve quando o localStorage tem dados", async () => {
    upsertDataset(mkEntry("local", 5));
    await idbWriteAll([mkEntry("idb", 99)]);
    await initDatasetStore();
    const ids = listDataset().map((e) => e.app.id);
    expect(ids).toContain("local");
    expect(ids).not.toContain("idb"); // localStorage vence (é o mais recente)
  });

  it("requestPersistence não quebra fora de navegador real", async () => {
    // jsdom não tem navigator.storage.persist — resolve false, sem throw.
    const result = await requestPersistence();
    expect(typeof result).toBe("boolean");
  });
});
