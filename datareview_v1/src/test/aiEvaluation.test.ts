import { describe, it, expect } from "vitest";
import {
  evaluateAIOutput,
  evaluateCompleteness,
  evaluateNumericFidelity,
  evaluateEvidenceCoverage,
  evaluateCalibration,
  evaluateScopeCoverage,
  evaluateStructure,
  extractPercents,
} from "@/lib/aiEvaluation";
import type { DatasetEntry } from "@/lib/datasetStore";

const entries: DatasetEntry[] = [
  {
    app: {
      id: "a1", store: "apple", name: "Nubank", icon: "", developer: "Nu",
      rating: 4.5, ratingCount: 100, price: "", url: "", genre: "Finance",
      version: "1", description: "", screenshots: [], releaseDate: "",
      currentVersionReleaseDate: "",
    } as DatasetEntry["app"],
    reviews: Array.from({ length: 50 }, (_, i) => ({
      id: `r${i}`, store: "apple", appId: "a1", appName: "Nubank",
      author: `U${i}`, rating: i % 2 === 0 ? 5 : 1, title: "t", text: `t${i}`,
      date: "2024-01-01",
    })),
    collectedAt: Date.now(),
  },
];

describe("aiEvaluation (framework determinístico)", () => {
  it("completude: saída completa marca 100; cortada no meio marca baixo", () => {
    expect(evaluateCompleteness("Ok.").score).toBe(100);
    expect(evaluateCompleteness("Quantificação... o resultado é").score).toBeLessThan(50);
  });

  it("estrutura: cabeçalhos + camadas pontuam", () => {
    const clean = evaluateStructure("");
    expect(clean.score).toBeUndefined();
    const s = evaluateStructure("## Insight\noi\n## Quantificação\n## Evidência");
    expect(s.score).toBeGreaterThan(30);
  });

  it("extrai percentuais do texto", () => {
    const p = extractPercents("Positivo em 62% dos reviews e negativo 10%");
    expect(p.map((x) => x.value)).toEqual([62, 10]);
  });

  it("fidelidade: percentuais alinhados com agregados marcam alto; desviados marcam baixo", () => {
    const sentiment = evaluateNumericFidelity("Positivo: ~50%", entries);
    expect(sentiment.score).toBeGreaterThan(40);
    const off = evaluateNumericFidelity("Positivo: 99% dos reviews", entries);
    expect(off.score).toBeLessThan(60);
  });

  it("evidência: citações em blockquotes pontuam", () => {
    const e = evaluateEvidenceCoverage("## Insight\n> \"App trava sempre\"\n\n> \"UI rápida\"", entries);
    expect(e.score).toBeGreaterThan(20);
  });

  it("calibração: amostra pequena exige incerteza", () => {
    const tiny = [
      {
        app: entries[0].app,
        reviews: entries[0].reviews.slice(0, 3),
        collectedAt: Date.now(),
      },
    ];
    const conf = evaluateCalibration("Decisão: fazer agora", tiny);
    expect(conf.score).toBeLessThan(50);
    const honest = evaluateCalibration("Há pouco evidência para conclusão (pequena amostra)", tiny);
    expect(honest.score).toBeGreaterThan(70);
  });

  it("escopo: menciona os apps do dataset", () => {
    const sc = evaluateScopeCoverage("O Nubank foi analisado.", entries);
    expect(sc.score).toBe(100);
    const missed = evaluateScopeCoverage("A empresa foi analisada.", entries);
    expect(missed.score).toBe(0);
  });

  it("avaliação composta: dimensões + overall + issues", () => {
    const r = evaluateAIOutput("Positivo 50% ## Insight", entries);
    expect(r.dimensions.length).toBeGreaterThanOrEqual(6);
    expect(r.overall).toBeGreaterThan(0);
    expect(Array.isArray(r.issues)).toBe(true);
  });
});
