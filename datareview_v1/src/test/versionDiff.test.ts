import { describe, it, expect } from "vitest";
import { diffVersions, listVersions, compareVersions } from "@/lib/versionDiff";
import type { ReviewEntry } from "@/lib/appStoreApi";

function mkReview(partial: Partial<ReviewEntry>): ReviewEntry {
  return {
    id: partial.id ?? Math.random().toString(36).slice(2),
    rating: partial.rating ?? 5,
    title: partial.title ?? "",
    text: partial.text ?? "",
    author: partial.author ?? "user",
    date: partial.date ?? "2026-08-01",
    version: partial.version,
    ...partial,
  } as ReviewEntry;
}

function buildReviews(): ReviewEntry[] {
  const out: ReviewEntry[] = [];
  // v1.0: boa (4-5 estrelas), termo "pagamento" frequente
  for (let i = 0; i < 10; i++) {
    out.push(mkReview({ rating: 5, version: "1.0", text: "ótimo app, pagamento rápido e pagamento fácil" }));
  }
  // v2.0: regressão (1-2 estrelas), termo "travando" em ascensão
  for (let i = 0; i < 10; i++) {
    out.push(mkReview({ rating: 1, version: "2.0", text: "app travando sempre, travando no login" }));
  }
  // v3.0: poucos reviews (dados insuficientes)
  out.push(mkReview({ rating: 4, version: "3.0", text: "ok" }));
  return out;
}

describe("versionDiff — diff de versões determinístico (Onda 4.2)", () => {
  it("compareVersions ordena semanticamente (1.9 < 1.10 < 2.0)", () => {
    expect(compareVersions("1.9", "1.10")).toBeLessThan(0);
    expect(compareVersions("2.0", "1.10")).toBeGreaterThan(0);
    expect(compareVersions("1.0", "1.0")).toBe(0);
  });

  it("listVersions retorna em ordem semântica e sem duplicatas", () => {
    const versions = listVersions(buildReviews());
    expect(versions).toEqual(["1.0", "2.0", "3.0"]);
  });

  it("detecta regressão com veredito honesto", () => {
    const d = diffVersions(buildReviews(), "1.0", "2.0");
    expect(d.verdict).toBe("regressao");
    expect(d.ratingDelta).toBeLessThan(-0.5);
    expect(d.pctNegativeDelta).toBeGreaterThanOrEqual(15);
    expect(d.narrative.some((l) => l.includes("REGRESSÃO"))).toBe(true);
  });

  it("termos em ascensão destacam o que piorou", () => {
    const d = diffVersions(buildReviews(), "1.0", "2.0");
    expect(d.rising.some((t) => t.term.includes("travando"))).toBe(true);
    expect(d.falling.length).toBeGreaterThan(0);
  });

  it("melhora na direção oposta (2.0 → 1.0 não aplica; compara 2.0 vs 1.0 invertido)", () => {
    const d = diffVersions(buildReviews(), "2.0", "1.0");
    expect(d.verdict).toBe("melhora");
    expect(d.narrative.some((l) => l.includes("MELHORA"))).toBe(true);
  });

  it("amostra pequena = dados-insuficientes (não inventa veredito)", () => {
    const d = diffVersions(buildReviews(), "1.0", "3.0");
    expect(d.verdict).toBe("dados-insuficientes");
    expect(d.narrative[0]).toContain("Amostra pequena");
  });

  it("dataset vazio = dados-insuficientes sem quebrar", () => {
    const d = diffVersions([], "1.0", "2.0");
    expect(d.verdict).toBe("dados-insuficientes");
    expect(d.a.count).toBe(0);
    expect(d.b.count).toBe(0);
  });

  it("versões com a mesma distribuição = estavel", () => {
    const reviews: ReviewEntry[] = [];
    for (let i = 0; i < 8; i++) {
      const rating = i % 2 === 0 ? 4 : 5;
      reviews.push(mkReview({ rating, version: "1.0", text: "bom aplicativo" }));
      reviews.push(mkReview({ rating, version: "1.1", text: "bom aplicativo" }));
    }
    const d = diffVersions(reviews, "1.0", "1.1");
    expect(d.verdict).toBe("estavel");
  });
});
