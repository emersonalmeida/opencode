/** Testes de domínio (node:test nativo, sem framework mesmo em descrição). */
import { test, describe } from "node:test";
import { strict as assert } from "node:assert";
import { computeStats, buildContextHint } from "../src/core/dataset/derive.js";
import { DatasetStore } from "../src/core/dataset/store.js";

interface FakeStorage {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

class MemoryLocalStorage implements FakeStorage {
  private data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
  clear() { this.data.clear(); }
}

(globalThis as unknown as { localStorage: FakeStorage }).localStorage = new MemoryLocalStorage();

describe("dataset store", () => {
  test("dedup por id estável + revisão sobe", () => {
    const ds = new DatasetStore();
    assert.equal(ds.insert({ id: "s#1", source: "s", kind: "k", title: "t" }), true);
    assert.equal(ds.revision(), 1);
    assert.equal(ds.insert({ id: "s#1", source: "s", kind: "k", title: "t" }), false);
    assert.equal(ds.revision(), 1);
    assert.equal(ds.list().length, 1);
  });

  test("search acento-insensível", () => {
    const ds = new DatasetStore();
    ds.clear();
    ds.insert({ id: "x#1", source: "x", kind: "post", title: "Análise do Cafeeiro", author: "Jose" });
    assert.equal(ds.search("analise cafeeiro").length, 1);
    assert.equal(ds.search("xyz").length, 0);
  });

  test("insertMany conta só novidades", () => {
    const ds = new DatasetStore();
    ds.insertMany([
      { id: "a", source: "s", kind: "k", title: "a" },
      { id: "b", source: "s", kind: "k", title: "b" },
    ]);
    assert.equal(ds.insertMany([{ id: "a", source: "s", kind: "k", title: "a" }, { id: "c", source: "s", kind: "k", title: "c" }]), 1);
  });
});

describe("derive", () => {
  test("computeStats agrupa por fonte e tipo", () => {
    const list = [
      { key: "a", item: { id: "a", source: "hn", kind: "post", title: "t1", score: 10 }, collectedAt: 100 },
      { key: "b", item: { id: "b", source: "hn", kind: "post", title: "t2" }, collectedAt: 200 },
      { key: "c", item: { id: "c", source: "devto", kind: "article", title: "t3", score: 5 }, collectedAt: 300 },
    ];
    const s = computeStats(list);
    assert.equal(s.total, 3);
    assert.equal(s.bySource.hn, 2);
    assert.equal(s.bySource.devto, 1);
    assert.equal(s.byKind.post, 2);
    assert.equal(s.withScore, 2);
  });

  test("buildContextHint produz texto deterministico compacto", () => {
    const list = [
      { key: "a", item: { id: "a", source: "hn", kind: "post", title: "titulo", author: "x", text: "corpo do item" }, collectedAt: 100 },
    ];
    const hint = buildContextHint(list);
    assert.ok(hint.includes("DATASET: 1 itens"));
    assert.ok(hint.includes("[hn] titulo"));
  });
});
