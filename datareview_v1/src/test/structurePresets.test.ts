import { describe, it, expect } from "vitest";
import { STRUCTURE_PRESETS, structurePresetById, specStats } from "@/lib/structurePresets";

describe("structurePresets — esqueletos estruturais da página Estrutura", () => {
  it("ids únicos e metadados completos", () => {
    const ids = STRUCTURE_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of STRUCTURE_PRESETS) {
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.description.length).toBeGreaterThan(0);
    }
  });

  it("cobre os padrões pedidos: grid, 1, 3, 5 colunas e laterais divididas", () => {
    const ids = STRUCTURE_PRESETS.map((p) => p.id);
    expect(ids).toContain("grid");
    expect(ids).toContain("one-column");
    expect(ids).toContain("three-columns");
    expect(ids).toContain("five-columns");
    expect(ids).toContain("five-split-2");
    expect(ids).toContain("five-split-3");
    expect(ids).toContain("all-split-2");
  });

  it("preset de 5 colunas tem exatamente 5 colunas (laterais sidebar + centro largo)", () => {
    const spec = structurePresetById("five-columns")!.build();
    expect(spec.columns.length).toBe(5);
    expect(spec.columns[2].role).toBe("content");
    expect(spec.columns[2].widthWeight).toBeGreaterThan(1);
    expect(spec.columns[0].role).toBe("sidebar");
    expect(spec.columns[4].role).toBe("sidebar");
  });

  it("laterais divididas em 2 e 3 (e centro intacto)", () => {
    const s2 = structurePresetById("five-split-2")!.build();
    expect(s2.columns[0].blocks.length).toBe(2);
    expect(s2.columns[3].blocks.length).toBe(2);
    expect(s2.columns[2].blocks.length).toBe(1);
    const s3 = structurePresetById("five-split-3")!.build();
    expect(s3.columns[0].blocks.length).toBe(3);
    expect(s3.columns[1].blocks.length).toBe(3);
    const all2 = structurePresetById("all-split-2")!.build();
    for (const c of all2.columns) expect(c.blocks.length).toBe(2);
  });

  it("todo bloco nasce sem componente (estrutura pura, sem conteúdo)", () => {
    for (const p of STRUCTURE_PRESETS) {
      const spec = p.build();
      const all = [
        ...spec.columns.flatMap((c) => c.blocks),
        ...spec.top.flatMap((r) => r.blocks),
        ...spec.bottom.flatMap((r) => r.blocks),
      ];
      for (const b of all) expect(b.component).toBeUndefined();
    }
  });

  it("specStats conta colunas, blocos e linhas", () => {
    const spec = structurePresetById("header-footer")!.build();
    const stats = specStats(spec);
    expect(stats.columns).toBe(3);
    expect(stats.rows).toBe(2);
    // 2 blocos/coluna × 3 + 2 topo + 2 rodapé
    expect(stats.blocks).toBe(10);
  });

  it("structurePresetById retorna undefined p/ id desconhecido", () => {
    expect(structurePresetById("nope")).toBeUndefined();
  });
});
