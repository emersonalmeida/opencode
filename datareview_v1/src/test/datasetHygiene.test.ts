// Higiene do dataset: poda entries sintéticas de teste sem tocar em dados
// reais nem no demo de primeiro acesso (guard permanente do todo.md P0).
import { describe, it, expect, beforeEach } from "vitest";
import {
  isSyntheticEntry,
  findSyntheticEntries,
  runDatasetHygiene,
} from "@/lib/datasetHygiene";
import { upsertDataset, listDataset, removeDataset } from "@/lib/datasetStore";
import { buildDemoEntry, DEMO_APP_ID, DEMO_STORE } from "@/lib/demoDataset";
import type { DatasetEntry } from "@/lib/datasetStore";
import type { AppInfo, ReviewEntry } from "@/lib/appStoreApi";

function makeApp(store: string, id: string, name: string): AppInfo {
  return { id, store, name, icon: "", developer: "dev", rating: 4, ratingCount: 10, price: "Grátis", genre: "x", description: "", version: "1", releaseDate: "", currentVersionReleaseDate: "", screenshots: [], url: "" };
}

function makeReviews(store: string, id: string, names: string[]): ReviewEntry[] {
  return names.map((author, i) => ({
    id: `r${i}`,
    store,
    appId: id,
    appName: "x",
    author,
    rating: 5,
    title: "t",
    text: "texto qualquer",
    date: "2026-01-01",
  }));
}

function entry(store: string, id: string, name: string, authors: string[]): DatasetEntry {
  return { app: makeApp(store, id, name), reviews: makeReviews(store, id, authors), collectedAt: 1 };
}

describe("datasetHygiene", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("detecta o entry fake documentado (User0..User59 genéricos)", () => {
    const synthetic = entry("apple", "123456789", "Nubank", Array.from({ length: 60 }, (_, i) => `User${i}`));
    expect(isSyntheticEntry(synthetic)).toBe(true);
  });

  it("mantém entries com autores reais (nomes variados)", () => {
    const real = entry("google", "com.nu.production", "Nubank", [
      "Ana Silva", "Carlos P.", "Maria", "João", "user123", "Lucas", "Fernanda",
    ]);
    expect(isSyntheticEntry(real)).toBe(false);
  });

  it("exige mínimo de reviews para decidir (<5 não poda)", () => {
    const few = entry("apple", "1", "x", ["User1", "User2", "User3"]);
    expect(isSyntheticEntry(few)).toBe(false);
  });

  it("não poda a entry demo de primeiro acesso (prefixo demo:)", () => {
    upsertDataset(buildDemoEntry());
    expect(findSyntheticEntries(listDataset())).toEqual([]);
    removeDataset(DEMO_STORE, DEMO_APP_ID);
  });

  it("runDatasetHygiene remove só as sintéticas e retorna hits com razão", () => {
    upsertDataset({ ...buildDemoEntry() });
    upsertDataset(entry("apple", "123456789", "Fake", Array.from({ length: 10 }, (_, i) => `User${i}`)));
    upsertDataset(entry("google", "real.app", "Real", ["Ana", "Bia", "Caco", "Duda", "Eva", "Fio"]));

    const hits = runDatasetHygiene();
    expect(hits).toHaveLength(1);
    expect(hits[0].id).toBe("123456789");
    expect(hits[0].reason).toContain("autores genéricos");

    const left = listDataset();
    expect(left.some((e) => e.app.id === "real.app")).toBe(true);
    expect(left.some((e) => e.app.id.startsWith("demo:"))).toBe(true);
    expect(left.some((e) => e.app.id === "123456789")).toBe(false);
  });

  it("idempotente: segunda varredura sem hits não escreve", () => {
    upsertDataset(buildDemoEntry());
    expect(runDatasetHygiene()).toEqual([]);
    expect(listDataset().length).toBe(1);
  });
});
