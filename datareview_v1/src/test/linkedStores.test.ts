import { describe, it, expect } from "vitest";
import { normalizeAppName, storeLinkScore, linkStoresAcrossStores, crossStoreGroups } from "@/lib/linkedStores";
import { upsertDataset, clearDataset, type DatasetEntry } from "@/lib/datasetStore";

function entry(store: "apple" | "google", id: string, name: string, dev = "Dev", nReviews = 2): DatasetEntry {
  return {
    app: {
      store, id, name, icon: "", developer: dev, rating: 4, ratingCount: 1,
      price: "", url: "", genre: "", version: "1", description: "",
      screenshots: [], releaseDate: "", currentVersionReleaseDate: "",
    } as DatasetEntry["app"],
    reviews: Array.from({ length: nReviews }, (_, i) => ({
      id: `${store}${id}r${i}`, store, appId: id, appName: name, author: `U${i}`,
      rating: 5, title: "t", text: "ok", date: "2024-01-01",
    })),
    collectedAt: Date.now(),
  };
}

describe("linkedStores (Apple↔Google do mesmo app)", () => {
  it("normaliza nomes (acento, case, pontuação)", () => {
    expect(normalizeAppName("Núbänk Pro!")).toBe("nubank pro");
    expect(normalizeAppName("BIPA - Invest")).toBe("bipa invest");
    expect(normalizeAppName("  Mercado  Bitcoin ")).toBe("mercado bitcoin");
  });

  it("match exato com dev igual vale 1.0", () => {
    const a = entry("apple", "1", "Nubank", "Nu Holdings");
    const b = entry("google", "2", "Nubank", "Nu Holdings");
    expect(storeLinkScore(a, b)).toBe(1);
  });

  it("match exato com dev divergente vale 0.7", () => {
    const a = entry("apple", "1", "Nubank", "Nu Holdings");
    const b = entry("google", "2", "Nubank", "Different Dev");
    expect(storeLinkScore(a, b)).toBe(0.7);
  });

  it("match de prefixo forte vale 0.4; nomes distintos 0", () => {
    const a = entry("apple", "1", "Spotify Music");
    const b = entry("google", "2", "Spotify");
    expect(storeLinkScore(a, b)).toBe(0.4);
    const c = entry("apple", "3", "WhatsApp");
    const d = entry("google", "4", "Telegram");
    expect(storeLinkScore(c, d)).toBe(0);
  });

  it("agrupa cross-store e reporta lojas/distintos", () => {
    clearDataset();
    upsertDataset(entry("apple", "1", "Nubank", "Nu Holdings"));
    upsertDataset(entry("google", "2", "Nubank", "Nu Holdings"));
    upsertDataset(entry("apple", "3", "Coinbase", "Coinbase Inc"));
    const groups = linkStoresAcrossStores(
      [
        entry("apple", "1", "Nubank", "Nu Holdings"),
        entry("google", "2", "Nubank", "Nu Holdings"),
        entry("apple", "3", "Coinbase", "Coinbase Inc"),
      ],
      0.4,
    );
    const ng = groups.find((g) => g.name === "nubank")!;
    expect(ng.stores.sort()).toEqual(["apple", "google"]);
    expect(ng.entries.length).toBe(2);
    expect(ng.confidence).toBe(1);
  });

  it("crossStoreGroups filtra só com múltiplas lojas", () => {
    const res = crossStoreGroups([
      entry("apple", "1", "Nubank", "Nu Holdings"),
      entry("google", "2", "Nubank", "Nu Holdings"),
      entry("apple", "3", "Solo", "X"),
    ]);
    expect(res).toHaveLength(1);
    expect(res[0].name).toBe("nubank");
  });
});
