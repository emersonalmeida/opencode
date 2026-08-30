import { describe, it, expect, beforeEach } from "vitest";
import {
  listDataset, upsertDataset, removeDataset, clearDataset,
  getDatasetEntry, hasDataset, datasetRevision, subscribeDataset,
  type DatasetEntry,
} from "@/lib/datasetStore";

const app = (id: string) => ({
  store: "apple" as const, id, name: `App ${id}`, developer: "Dev",
  icon: "", rating: 4.5, ratingCount: 100, price: "Grátis", genre: "Finanças",
  description: "", version: "1.0", releaseDate: "", currentVersionReleaseDate: "",
  screenshots: [], url: "",
});
const entry = (id: string, n = 3): DatasetEntry => ({
  app: app(id),
  reviews: Array.from({ length: n }, (_, i) => ({
    id: `${id}-r${i}`, store: "apple" as const, appId: id, appName: `App ${id}`,
    author: `U${i}`, rating: 5, date: "2026-01-01", text: `texto ${i}`, title: `t${i}`,
  })),
  collectedAt: Date.now(),
});

describe("datasetStore — cache de parse + revisão + índice", () => {
  beforeEach(() => { localStorage.clear(); clearDataset(); });

  it("listDataset retorna a MESMA referência entre writes (sem re-parse)", () => {
    upsertDataset(entry("1"));
    const a = listDataset();
    const b = listDataset();
    expect(b).toBe(a);
  });

  it("write muda a referência e incrementa a revisão", () => {
    const r0 = datasetRevision();
    upsertDataset(entry("1"));
    const r1 = datasetRevision();
    const ref1 = listDataset();
    upsertDataset(entry("2"));
    const r2 = datasetRevision();
    expect(r1).toBeGreaterThan(r0);
    expect(r2).toBeGreaterThan(r1);
    expect(listDataset()).not.toBe(ref1);
  });

  it("getDatasetEntry/hasDataset usam índice (O(1)) e refletem upsert/remove", () => {
    upsertDataset(entry("1"));
    expect(hasDataset("apple", "1")).toBe(true);
    expect(getDatasetEntry("apple", "1")?.reviews).toHaveLength(3);
    upsertDataset(entry("1", 7)); // mesmo app, mais reviews → substitui
    expect(getDatasetEntry("apple", "1")?.reviews).toHaveLength(7);
    expect(listDataset()).toHaveLength(1);
    removeDataset("apple", "1");
    expect(hasDataset("apple", "1")).toBe(false);
    expect(getDatasetEntry("apple", "1")).toBeUndefined();
  });

  it("upsert preserva as outras entries", () => {
    upsertDataset(entry("1"));
    upsertDataset(entry("2"));
    upsertDataset(entry("3"));
    expect(listDataset().map((e) => e.app.id).sort()).toEqual(["1", "2", "3"]);
  });

  it("clearDataset zera e notifica subscribers", () => {
    let notified = 0;
    const unsub = subscribeDataset(() => notified++);
    upsertDataset(entry("1"));
    clearDataset();
    expect(listDataset()).toHaveLength(0);
    expect(notified).toBeGreaterThanOrEqual(2);
    unsub();
  });

  it("parse tolerante a JSON corrompido", () => {
    localStorage.setItem("aso:dataset:v1", "{quebrado");
    expect(listDataset()).toEqual([]);
  });
});
