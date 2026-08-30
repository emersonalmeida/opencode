/**
 * Testes do builder puro de sinais do Núcleo (`src/lib/nucleo.ts`).
 */
import { describe, it, expect } from "vitest";
import { buildSignals, sortSignals } from "@/lib/nucleo";
import type { FlowSnapshot } from "@/lib/flow/flowModel";

const snap = (patch: Partial<FlowSnapshot> = {}): FlowSnapshot => ({
  apps: 0,
  reviews: 0,
  selected: 0,
  insights: 0,
  artifacts: 0,
  findings: 0,
  candidates: 0,
  decks: 0,
  outputs: 0,
  generations: 0,
  canvasNodes: 0,
  designPages: 0,
  ...patch,
});

describe("buildSignals", () => {
  it("dataset vazio → sinal de atenção", () => {
    const sigs = buildSignals(snap());
    const ds = sigs.find((s) => s.id === "dataset")!;
    expect(ds.level).toBe("attention");
  });

  it("dataset com dados → ok com contadores", () => {
    const sigs = buildSignals(snap({ apps: 3, reviews: 1234 }));
    const ds = sigs.find((s) => s.id === "dataset")!;
    expect(ds.level).toBe("ok");
    expect(ds.detail).toContain("3 app(s)");
  });

  it("seleção vazia informa que o escopo é o dataset inteiro", () => {
    const sigs = buildSignals(snap({ apps: 1 }));
    const sel = sigs.find((s) => s.id === "selection")!;
    expect(sel.label).toContain("todos os apps");
  });

  it("sinais condicionais só aparecem com dados", () => {
    const empty = buildSignals(snap());
    expect(empty.find((s) => s.id === "insights")).toBeUndefined();
    expect(empty.find((s) => s.id === "candidates")).toBeUndefined();
    const full = buildSignals(snap({ apps: 2, insights: 5, candidates: 2, canvasNodes: 4 }));
    expect(full.find((s) => s.id === "insights")!.label).toContain("5");
    expect(full.find((s) => s.id === "candidates")).toBeDefined();
    expect(full.find((s) => s.id === "canvas")).toBeDefined();
  });
});

describe("sortSignals", () => {
  it("atenção vem antes de ok, estável dentro do grupo", () => {
    const sigs = buildSignals(snap({ apps: 0, insights: 2, candidates: 1 }));
    const sorted = sortSignals(sigs);
    expect(sorted[0].level).toBe("attention");
    expect(sorted[sorted.length - 1].level).toBe("ok");
    // não muta o array original
    expect(sigs[0].id).toBe("dataset");
  });
});
