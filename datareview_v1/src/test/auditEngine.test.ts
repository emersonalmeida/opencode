/**
 * Guarda do cliente do Audit Engine (página /auditoria):
 * - enrichWithReliability mescla catálogo documentado com evidência;
 * - formatRate converte taxa em %, escondendo ruído com minObs.
 */
import { describe, expect, it } from "vitest";
import { enrichWithReliability, formatRate, type SourceReliability } from "@/lib/audit/auditEngine";
import { AUDIT_SOURCES } from "@/lib/audit/auditSources";

describe("auditEngine — enrichWithReliability", () => {
  const rel: SourceReliability[] = [
    { id: "suggest", observations: 5, successRate: 0.8, errorRate: 0.2, avgDurationMs: 120, avgConfidence: 0.9 },
  ];

  it("anexa observação à fonte correspondente (suggest é 1ª)", () => {
    const enriched = enrichWithReliability(AUDIT_SOURCES, rel);
    const suggest = enriched.find((s) => s.id === "suggest")!;
    expect(suggest.observed?.observations).toBe(5);
    expect(suggest.observed?.successRate).toBeCloseTo(0.8);
  });

  it("fontes sem evidência ficam undefined (estado honesto)", () => {
    const rel: SourceReliability[] = [
      { id: "suggest", observations: 1, successRate: 1, errorRate: 0, avgDurationMs: 10, avgConfidence: 1 },
    ];
    const enriched = enrichWithReliability(AUDIT_SOURCES, rel);
    expect(enriched.find((s) => s.id === "web")!.observed).toBeUndefined();
  });
});

describe("auditEngine — formatRate", () => {
  it("converte 0–1 em %, e esconde ruído com <1 observação", () => {
    expect(formatRate(0.93, 3)).toBe("93%");
    expect(formatRate(undefined, 2)).toBeNull();
    expect(formatRate(0.5, 0)).toBeNull(); // 0 obs = ruído
    expect(formatRate(0.5, 1)).toBe("50%");
  });
});
