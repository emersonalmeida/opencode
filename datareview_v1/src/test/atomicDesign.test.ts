import { describe, it, expect } from "vitest";
import { ATOMIC_META, ATOMIC_ORDER, atomicCounts, atomicLevelOf, type AtomicLevel } from "@/lib/atomicDesign";
import { COMPONENT_INVENTORY } from "@/lib/componentInventory.generated";
import { COMPONENT_MODULES } from "@/lib/componentModules.generated";

describe("atomicDesign — metadados e inventário enriquecido", () => {
  it("todo nível tem label + descrição + classe de badge", () => {
    for (const level of ATOMIC_ORDER) {
      const meta = ATOMIC_META[level];
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.description.length).toBeGreaterThan(0);
      expect(meta.badge).toContain("bg-");
    }
  });

  it("toda entry do inventário tem nível atomic válido", () => {
    for (const e of COMPONENT_INVENTORY) {
      expect(ATOMIC_ORDER).toContain(e.atomic);
      expect(Array.isArray(e.deps)).toBe(true);
      expect(Array.isArray(e.hooks)).toBe(true);
    }
  });

  it("atomicCounts soma o total do inventário", () => {
    const counts = atomicCounts(COMPONENT_INVENTORY);
    const sum = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(sum).toBe(COMPONENT_INVENTORY.length);
  });

  it("atomicLevelOf faz fallback para atom em dados antigos", () => {
    expect(atomicLevelOf({})).toBe("atom");
    expect(atomicLevelOf({ atomic: "organism" })).toBe("organism");
    expect(atomicLevelOf({ atomic: "x" as AtomicLevel })).toBe("atom");
  });

  it("COMPONENT_MODULES cobre todos os arquivos do inventário", () => {
    for (const e of COMPONENT_INVENTORY) {
      expect(typeof COMPONENT_MODULES[e.file]).toBe("function");
    }
  });

  it("para todo arquivo do inventário, deps apontam para arquivos existentes", () => {
    const files = new Set(COMPONENT_INVENTORY.map((e) => e.file));
    for (const e of COMPONENT_INVENTORY) {
      for (const d of e.deps) expect(files.has(d)).toBe(true);
    }
  });
});
