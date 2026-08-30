import { describe, it, expect } from "vitest";
import { groupBySimilarity, componentName, standardizationBadge, inventoryStats } from "@/lib/inventoryPage";
import { COMPONENT_INVENTORY } from "@/lib/componentInventory.generated";

describe("inventoryPage — agrupamento por similaridade", () => {
  it("todo componente do inventário aparece em EXATAMENTE um grupo", () => {
    const groups = groupBySimilarity();
    const assigned = groups.flatMap((g) => g.components.map((c) => c.file));
    expect(assigned.length).toBe(COMPONENT_INVENTORY.length);
    expect(new Set(assigned).size).toBe(COMPONENT_INVENTORY.length);
  });

  it("grupos têm rótulo e hint (e não são vazios por definição)", () => {
    for (const g of groupBySimilarity()) {
      expect(g.label.length).toBeGreaterThan(0);
      expect(g.hint.length).toBeGreaterThan(0);
      expect(g.components.length).toBeGreaterThan(0);
    }
  });

  it("componentName tira o diretório e a extensão", () => {
    expect(componentName("components/shared/AIOutputCard.tsx")).toBe("AIOutputCard");
    expect(componentName("components/ux/UxPrimitives.tsx")).toBe("UxPrimitives");
  });

  it("badge de padronização classifica reuso ×N / específico / sem consumidores", () => {
    expect(standardizationBadge({ consumers: 4 } as never).tone).toBe("success");
    expect(standardizationBadge({ consumers: 1 } as never).label).toBe("específico");
    expect(standardizationBadge({ consumers: 0 } as never).tone).toBe("warning");
  });

  it("inventoryStats cobre o inventário inteiro", () => {
    const stats = inventoryStats();
    expect(stats.total).toBe(COMPONENT_INVENTORY.length);
    expect(stats.groups).toBeGreaterThanOrEqual(5);
    expect(stats.duplicates).toBeGreaterThanOrEqual(0);
  });
});
