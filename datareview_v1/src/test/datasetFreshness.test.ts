// Freshness do dataset (todo.md P1): labels PT-BR, tons fresh/aging/stale e
// TTL — helpers puros de idade derivada de collectedAt.
import { describe, it, expect } from "vitest";
import { freshness, ageDays, DEFAULT_TTL_DAYS } from "@/lib/datasetFreshness";

const NOW = Date.parse("2026-08-25T12:00:00Z");

describe("datasetFreshness", () => {
  it("ageDays arredonda para dias completos não-negativos", () => {
    expect(ageDays(NOW - 86400000 * 3 - 1000, NOW)).toBe(3);
    expect(ageDays(0, NOW)).toBe(0);
    expect(ageDays(NOW + 1000, NOW)).toBe(0);
  });

  it("label: hoje / 1 dia / N dias / N semanas / meses", () => {
    expect(freshness(NOW - 1000, NOW)?.label).toBe("hoje");
    expect(freshness(NOW - 86400000, NOW)?.label).toBe("há 1 dia");
    expect(freshness(NOW - 86400000 * 4, NOW)?.label).toBe("há 4 dias");
    expect(freshness(NOW - 86400000 * 9, NOW)?.label).toBe("há 1 semana");
    expect(freshness(NOW - 86400000 * 40, NOW)?.label).toBe("há ~1 mês");
    expect(freshness(NOW - 86400000 * 60, NOW)?.label).toBe("há ~2 meses");
  });

  it("tone: fresh ≤3d · aging ≤14d · stale além", () => {
    expect(freshness(NOW, NOW)?.tone).toBe("fresh");
    expect(freshness(NOW - 86400000 * 3, NOW)?.tone).toBe("fresh");
    expect(freshness(NOW - 86400000 * 7, NOW)?.tone).toBe("aging");
    expect(freshness(NOW - 86400000 * 15, NOW)?.tone).toBe("stale");
  });

  it("stale respeita TTL padrão (7 dias) e customizado", () => {
    expect(freshness(NOW - 86400000 * 8, NOW)?.stale).toBe(true);
    expect(freshness(NOW - 86400000 * 8, NOW, 30)?.stale).toBe(false);
    expect(freshness(NOW - 86400000 * 6, NOW)?.stale).toBe(false);
  });

  it("sem coleta → null", () => {
    expect(freshness(0, NOW)).toBeNull();
    expect(DEFAULT_TTL_DAYS).toBe(7);
  });
});
