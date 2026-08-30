import { describe, it, expect, beforeEach } from "vitest";
import {
  buildDemoEntry, loadDemoDataset, removeDemoDataset, hasDemoDataset,
  isDemoEntry, DEMO_APP_ID, DEMO_APP_NAME,
} from "@/lib/demoDataset";
import { listDataset, clearDataset } from "@/lib/datasetStore";
import { computeKPIs, computeSentiment, computeRatingDistribution } from "@/lib/dashboardAnalytics";

describe("demoDataset — primeiro acesso sem rede (Onda 2.2)", () => {
  beforeEach(() => {
    localStorage.clear();
    clearDataset();
  });

  it("buildDemoEntry gera app demo identificável + 40 reviews", () => {
    const entry = buildDemoEntry();
    expect(entry.app.id).toBe(DEMO_APP_ID);
    expect(entry.app.name).toBe(DEMO_APP_NAME);
    expect(isDemoEntry(entry)).toBe(true);
    expect(entry.reviews.length).toBe(40);
  });

  it("reviews demo têm o shape completo (nota, texto, versão, país, data, thumbsUp)", () => {
    const { reviews } = buildDemoEntry();
    for (const r of reviews) {
      expect(r.rating).toBeGreaterThanOrEqual(1);
      expect(r.rating).toBeLessThanOrEqual(5);
      expect(r.text.length).toBeGreaterThan(20);
      expect(r.version).toBeTruthy();
      expect(r.country).toBeTruthy();
      expect(new Date(r.date).getTime()).not.toBeNaN();
      expect(r.id).toMatch(/^demo-review-/);
    }
    // variedade: pelo menos 3 notas distintas e 3 versões distintas
    expect(new Set(reviews.map((r) => r.rating)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(reviews.map((r) => r.version)).size).toBeGreaterThanOrEqual(4);
    // algumas reviews negativas têm resposta do desenvolvedor
    expect(reviews.some((r) => r.developerReply)).toBe(true);
  });

  it("datas são relativas a `now` (determinístico)", () => {
    const now = Date.UTC(2026, 7, 24);
    const { reviews } = buildDemoEntry(now);
    const days = reviews.map((r) => Math.round((now - new Date(r.date).getTime()) / 86400000));
    expect(Math.min(...days)).toBe(2);
    expect(Math.max(...days)).toBe(160);
  });

  it("loadDemoDataset é idempotente e persiste no dataset", () => {
    expect(hasDemoDataset()).toBe(false);
    loadDemoDataset();
    loadDemoDataset(); // segunda chamada não duplica
    const ds = listDataset();
    expect(ds.length).toBe(1);
    expect(hasDemoDataset()).toBe(true);
    expect(ds[0].reviews.length).toBe(40);
  });

  it("removeDemoDataset é o opt-out", () => {
    loadDemoDataset();
    removeDemoDataset();
    expect(hasDemoDataset()).toBe(false);
    expect(listDataset()).toHaveLength(0);
  });

  it("o demo alimenta a análise determinística inteira (KPIs/sentimento/distribuição)", () => {
    loadDemoDataset();
    const entries = listDataset();
    const reviews = entries.flatMap((e) => e.reviews);
    const kpis = computeKPIs(reviews, entries);
    expect(kpis.totalApps).toBe(1);
    expect(kpis.totalReviews).toBe(40);
    expect(kpis.avgRating).toBeGreaterThan(3);
    const sentiment = computeSentiment(reviews);
    expect(sentiment.reduce((sum, d) => sum + d.value, 0)).toBe(40);
    expect(sentiment.find((d) => d.name.startsWith("Negativo"))?.value).toBeGreaterThan(0);
    const dist = computeRatingDistribution(reviews);
    expect(dist.reduce((s, d) => s + d.count, 0)).toBe(40);
  });
});
