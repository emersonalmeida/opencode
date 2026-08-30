/**
 * Superfícies embutíveis — registry + resolução fuzzy.
 */
import { describe, it, expect } from "vitest";
import {
  EMBEDDABLE_SURFACES,
  COMPONENT_FENCE_INSTRUCTIONS,
  normText,
  resolveSurface,
  searchSurfaces,
} from "@/lib/embeddableSurfaces";
import { surfaceRendererExists } from "@/components/shared/EmbeddedSurface";

describe("embeddableSurfaces — registry", () => {
  it("ids únicos e contrato completo", () => {
    const ids = EMBEDDABLE_SURFACES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of EMBEDDABLE_SURFACES) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.description.length).toBeGreaterThan(0);
      expect(s.keywords.length).toBeGreaterThan(0);
      expect(s.originPath.startsWith("/")).toBe(true);
    }
  });

  it("toda superfície do registry tem renderer real", () => {
    for (const s of EMBEDDABLE_SURFACES) {
      expect(surfaceRendererExists(s.id), `renderer ausente: ${s.id}`).toBe(true);
    }
  });

  it("instruções do fence cobrem todas as superfícies", () => {
    for (const s of EMBEDDABLE_SURFACES) {
      expect(COMPONENT_FENCE_INSTRUCTIONS).toContain(s.id);
    }
  });
});

describe("embeddableSurfaces — normText", () => {
  it("remove acentos e normaliza caixa", () => {
    expect(normText("Gráficos Ótimo")).toBe("graficos otimo");
    expect(normText("  Configuração  ")).toBe("configuracao");
  });
});

describe("embeddableSurfaces — resolveSurface", () => {
  it("resolve por id exato", () => {
    expect(resolveSurface("pipeline")?.id).toBe("pipeline");
    expect(resolveSurface("charts")?.id).toBe("charts");
  });

  it("resolve por label com acento e caixa mista", () => {
    expect(resolveSurface("Gráficos")?.id).toBe("charts");
    expect(resolveSurface("PIPELINE")?.id).toBe("pipeline");
  });

  it("resolve por keyword", () => {
    expect(resolveSurface("sentimento")?.id).toBe("charts");
    expect(resolveSurface("validacao")?.id).toBe("data-quality");
    expect(resolveSurface("relatorio")?.id).toBe("report");
  });

  it("ignora prefixos de pedido (página de / componente de)", () => {
    expect(resolveSurface("página de pipeline")?.id).toBe("pipeline");
    expect(resolveSurface("componente de gráficos")?.id).toBe("charts");
  });

  it("retorna null para consulta sem correspondência", () => {
    expect(resolveSurface("xyzabc desconhecido")).toBeNull();
    expect(resolveSurface("")).toBeNull();
  });
});

describe("embeddableSurfaces — searchSurfaces", () => {
  it("retorna primeiras N sem consulta", () => {
    expect(searchSurfaces("", 3)).toHaveLength(3);
  });

  it("ordena por relevância", () => {
    const res = searchSurfaces("coleta");
    expect(res.length).toBeGreaterThan(0);
    expect(["apps", "collection-config"]).toContain(res[0].id);
  });
});
