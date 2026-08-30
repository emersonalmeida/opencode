import { describe, it, expect, beforeEach } from "vitest";
import {
  getSearchState, searchResultsByStore, subscribeSearch, clearSearch,
} from "@/lib/searchStore";
import type { AppInfo } from "@/lib/appStoreApi";

const app = (id: string, store: "apple" | "google"): AppInfo => ({
  id, store, name: `App ${id}`, developer: "Dev",
  icon: "", rating: 4.5, ratingCount: 10,
  price: "Grátis", genre: "Finanças", description: "", version: "1.0",
  releaseDate: "", currentVersionReleaseDate: "", url: "", screenshots: [], raw: {},
});

describe("searchStore — estado de busca compartilhado entre painéis", () => {
  beforeEach(() => clearSearch());

  it("estado inicial: sem busca, sem resultados, não pesquisou", () => {
    const s = getSearchState();
    expect(s.term).toBe("");
    expect(s.results).toBeNull();
    expect(s.searching).toBe(false);
    expect(s.searchedAt).toBe(0);
  });

  it("searchResultsByStore separa por loja (derivado, sem rede)", () => {
    const grouped = searchResultsByStore({
      term: "x",
      results: [app("1", "apple"), app("2", "google"), app("3", "apple")],
      searching: false,
      error: null,
      searchedAt: 1,
    });
    expect(grouped.apple).toHaveLength(2);
    expect(grouped.google).toHaveLength(1);
  });

  it("searchResultsByStore tolera results null (nunca buscou)", () => {
    const grouped = searchResultsByStore(getSearchState());
    expect(grouped.apple).toEqual([]);
    expect(grouped.google).toEqual([]);
  });

  it("clearSearch volta ao estado inicial e notifica", () => {
    let calls = 0;
    const unsub = subscribeSearch(() => { calls += 1; });
    clearSearch();
    expect(calls).toBe(1);
    expect(getSearchState().results).toBeNull();
    unsub();
    clearSearch();
    expect(calls).toBe(1); // unsubscribe funciona
  });
});
