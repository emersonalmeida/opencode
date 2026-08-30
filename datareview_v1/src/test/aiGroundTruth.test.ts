import { describe, it, expect } from "vitest";
import { evaluateAIOutput } from "@/lib/aiEvaluation";
import type { DatasetEntry } from "@/lib/datasetStore";

const APPLE_ENTRY: DatasetEntry = {
  app: {
    store: "apple", id: "1", name: "TestApp", icon: "", developer: "Dev",
    rating: 4, ratingCount: 2, price: "", url: "", genre: "", version: "1", description: "",
    screenshots: [], releaseDate: "", currentVersionReleaseDate: "",
  } as DatasetEntry["app"],
  reviews: [
    { id: "r1", store: "apple", appId: "1", appName: "TestApp", author: "U1", rating: 5, title: "bom", text: "muito bom", date: "2024-01-01" } as DatasetEntry["reviews"][number],
    { id: "r2", store: "apple", appId: "1", appName: "TestApp", author: "U2", rating: 2, title: "ruim", text: "instável", date: "2024-01-02" } as DatasetEntry["reviews"][number],
  ],
  collectedAt: Date.now(),
};

const ENTRIES = [APPLE_ENTRY];

/** Dataset de referência (gold) com outputs conhecidos: honesto, com vazios e com alucinação. */
const TRIO = {
  HONEST:
    "## Resumo\nReviews positivos 50%, negativos 50%.\n\n## Evidência\n>\u00A01\u00A2 estrelas positivas, 2\u00A2 negativas\n\n## Ação\nPriorizar crash.",
  EMPTY: "Sem dados suficientes.",
  HALLUCINATED: "## Resumo\nReviews positivos 80%, negativos 20%.",
};

describe("aiEvaluation — dataset de referência (ground truth)", () => {
  it("honesto & completo marca acima de 50", () => {
    const e = evaluateAIOutput(TRIO.HONEST, ENTRIES);
    expect(e.overall).toBeDefined();
    expect(e.overall!).toBeGreaterThan(50);
  });

  it("honesto ausente → status honesto com nota mínima", () => {
    const e = evaluateAIOutput(TRIO.EMPTY, ENTRIES);
    expect(e.overall).toBeDefined();
  });

  it("alucinação (80% vs ~50) cai numa banda fraca", () => {
    const good = evaluateAIOutput(TRIO.HONEST, ENTRIES);
    const bad = evaluateAIOutput(TRIO.HALLUCINATED, ENTRIES);
    expect(bad.overall!).toBeLessThan(good.overall!);
  });

  it("blockquotes densify evidência", () => {
    const noQuote = "O app crasha. A bateria drena. O menu travit.";
    const withQuote = "## E\n> O app crasha! \n> A bateria drena! \n> O menu travit.";
    const a = evaluateAIOutput(noQuote, ENTRIES);
    const b = evaluateAIOutput(withQuote, ENTRIES);
    const evi = (e: typeof a | typeof b) => e.dimensions.find((d) => d.id === "evidence")?.score ?? 0;
    expect(evi(b)).toBeGreaterThan(evi(a));
  });

  it("overall = média das dimensões pontuadas", () => {
    const e = evaluateAIOutput(TRIO.HONEST, ENTRIES);
    const scored = e.dimensions.filter((d) => d.score !== undefined);
    const avg = scored.reduce((s, d) => s + d.score!, 0) / scored.length;
    expect(e.overall).toBe(Math.round(avg));
  });
});
