/**
 * Guarda da rota audit-reliability (servidor): computeBySource agrupa
 * observações por fonte e deriva success/error/duration/confiance sem
 * "score mágico". Testa a função pura, sem subir o Express.
 */
import { describe, expect, it } from "vitest";
import { computeBySource, type SourceReliability } from "../../server/routes/auditReliability";
import type { Observation } from "../../server/lib/rawStore";

const obs = (id: string, over: Partial<Observation>): Observation => ({
  runId: "r", sourceId: id, endpoint: "op", params: {}, at: 1, ...over,
});

describe("auditReliability — computeBySource", () => {
  it("agrupa por sourceId com métricas derivadas", () => {
    const list = [
      obs("suggest", { confidence: 1, durationMs: 100 }),
      obs("suggest", { confidence: 1, durationMs: 200 }),
      obs("suggest", { confidence: 0, durationMs: 50 }),
      obs("trends", { confidence: 1, durationMs: 300 }),
    ];
    const out = computeBySource(list) as SourceReliability[];
    const suggest = out.find((r) => r.id === "suggest")!;
    expect(suggest.observations).toBe(3);
    expect(suggest.successRate).toBeCloseTo(2 / 3);
    expect(suggest.errorRate).toBeCloseTo(1 / 3);
    expect(suggest.avgDurationMs).toBeCloseTo((100 + 200 + 50) / 3);
    expect(suggest.avgConfidence).toBeCloseTo((1 + 1 + 0) / 3);
    expect(out.find((r) => r.id === "trends")).toBeDefined();
  });

  it("lista vazia retorna fontes vazias", () => {
    expect(computeBySource([])).toEqual([]);
  });
});
