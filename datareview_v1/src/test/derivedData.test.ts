import { describe, it, expect } from "vitest";
import { getDatasetDigest, getEntryDerived, getReviewIndex } from "@/lib/derivedData";
import { computePerAppStats } from "@/lib/dashboardAnalytics";
import type { DatasetEntry } from "@/lib/datasetStore";

const entry = (id: string, reviews: Partial<DatasetEntry["reviews"][number]>[]): DatasetEntry => ({
  app: { store: "apple", id, name: `App ${id}`, developer: "Dev", icon: "", rating: 4.5, ratingCount: 100, price: "Grátis", genre: "Finanças", description: "", version: "1.0", releaseDate: "", currentVersionReleaseDate: "", screenshots: [], url: "" },
  reviews: reviews.map((r, i) => ({
    id: `${id}-r${i}`, store: "apple" as const, appId: id, appName: `App ${id}`, author: "U", rating: 5, date: "2026-01-01", text: "texto", title: "t", ...r,
  })) as DatasetEntry["reviews"],
  collectedAt: 1000,
});

describe("derivedData — base derivada determinística (cacheada)", () => {
  it("getDatasetDigest memoiza por referência do array", () => {
    const entries = [entry("1", [{ rating: 5 }, { rating: 2 }])];
    const d1 = getDatasetDigest(entries);
    const d2 = getDatasetDigest(entries);
    expect(d1.reviews).toBe(d2.reviews);
    expect(d1.totalReviews).toBe(2);
    expect(d1.kpis.totalReviews).toBe(2);
  });

  it("digest invalida quando o array muda (nova referência)", () => {
    const e1 = [entry("1", [{ rating: 5 }])];
    const e2 = [entry("1", [{ rating: 5 }, { rating: 1 }])];
    expect(getDatasetDigest(e1).totalReviews).toBe(1);
    expect(getDatasetDigest(e2).totalReviews).toBe(2);
  });

  it("getEntryDerived: versões + países numa única passagem", () => {
    const e = entry("1", [
      { rating: 5, version: "8.3", country: "br" },
      { rating: 1, version: "8.4", country: "BR" },
      { rating: 2, version: "8.4", country: "us" },
    ]);
    const d = getEntryDerived(e);
    expect(d.versions.find((v) => v.version === "8.4")).toMatchObject({ count: 2, avgRating: 1.5, negativePct: 100 });
    expect(d.countries.find((c) => c.country === "BR")).toMatchObject({ count: 2 });
    expect(d.withVersion).toBe(3);
    expect(d.withCountry).toBe(3);
  });

  it("getEntryDerived cacheia por assinatura e invalida em recollection", () => {
    const e = entry("1", [{ rating: 5, version: "8.3" }]);
    const d1 = getEntryDerived(e);
    expect(getEntryDerived(e)).toBe(d1); // mesma referência
    const e2 = { ...e, collectedAt: 2000 }; // recoletado
    expect(getEntryDerived(e2)).not.toBe(d1);
  });

  it("computePerAppStats reusa o stat cacheado do mesmo app entre escopos", () => {
    const a = entry("1", [{ rating: 5 }]);
    const b = entry("2", [{ rating: 1 }]);
    const s1 = computePerAppStats([a, b]);
    const s2 = computePerAppStats([b, a]); // ordem diferente, mesmos apps
    expect(s2.find((s) => s.key === a.app.id || s.name === a.app.name)).toBeTruthy();
    // O stat do app "1" é o MESMO objeto nos dois escopos (cache por assinatura)
    const statA1 = s1.find((s) => s.name === "App 1")!;
    const statA2 = s2.find((s) => s.name === "App 1")!;
    expect(statA2).toBe(statA1);
    // Recollection (assinatura nova) → recomputa
    const a2 = { ...a, collectedAt: 9999 };
    const s3 = computePerAppStats([a2]);
    expect(s3[0]).not.toBe(statA1);
  });

  it("getReviewIndex resolve review por id em O(1)", () => {
    const e1 = entry("1", [{ rating: 5 }]);
    const e2 = entry("2", [{ rating: 3 }]);
    const entries = [e1, e2];
    const idx = getReviewIndex(entries);
    expect(idx.get("2-r0")?.entry.app.id).toBe("2");
    expect(idx.get("inexistente")).toBeUndefined();
    expect(getReviewIndex(entries)).toBe(idx); // memoizado por referência
  });
});
