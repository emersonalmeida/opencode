/** Testes da separação explícita origem do dado (usuário × IA × derivado × sistema). */
import { describe, it, expect } from "vitest";
import {
  originForStorageKey, originForGenerationType, originForOutputGroup,
  ORIGIN_META, type DataOrigin,
} from "@/lib/dataOrigin";

describe("dataOrigin", () => {
  it("todas as origens têm metadados com rótulo curto e classes", () => {
    const origins: DataOrigin[] = ["user", "ai", "derived", "system"];
    for (const o of origins) {
      expect(ORIGIN_META[o].label.length).toBeGreaterThan(0);
      expect(ORIGIN_META[o].shortLabel.length).toBeGreaterThan(0);
      expect(ORIGIN_META[o].badgeClass).toContain("border");
    }
  });

  it("classifica chaves de IA como 'ai' e dataset como 'user'", () => {
    expect(originForStorageKey("aso:dataset:v1")).toBe("user");
    expect(originForStorageKey("aso:history")).toBe("user");
    expect(originForStorageKey("aso:ai-outputs:v1")).toBe("ai");
    expect(originForStorageKey("aso:insights:v1")).toBe("ai");
    expect(originForStorageKey("aso:generations:v1")).toBe("ai");
    expect(originForStorageKey("aso:pipeline-artifacts:v1")).toBe("ai");
    expect(originForStorageKey("aso:lab:experiments")).toBe("ai");
    expect(originForStorageKey("aso:chat-history:v1")).toBe("ai");
    expect(originForStorageKey("aso:cache:foo")).toBe("derived");
    expect(originForStorageKey("aso:feature-flags:v1")).toBe("system");
    expect(originForStorageKey("aso:qualquer")).toBe("system");
  });

  it("classifica tipos de geração: collect → user, resto → ai", () => {
    expect(originForGenerationType("collect")).toBe("user");
    expect(originForGenerationType("chat")).toBe("ai");
    expect(originForGenerationType("atlas-run")).toBe("ai");
    expect(originForGenerationType("canvas-run")).toBe("ai");
    expect(originForGenerationType("ai-section")).toBe("ai");
  });

  it("mapeia grupos de Outputs para origens", () => {
    expect(originForOutputGroup("base")).toBe("user");
    expect(originForOutputGroup("projetos")).toBe("user");
    expect(originForOutputGroup("ia")).toBe("ai");
    expect(originForOutputGroup("noai")).toBe("derived");
    expect(originForOutputGroup("sistema")).toBe("system");
    expect(originForOutputGroup("outros")).toBe("system");
    expect(originForOutputGroup("nada")).toBe("system");
  });
});
