// @vitest-environment node
/**
 * Testes do Source Registry (server/lib/sourceRegistry) — catálogo declarativo
 * de fontes com capabilities (foundation para expansão multi-fonte).
 */
import { describe, it, expect } from "vitest";
import { listSources, getSource, hasCapability, type SourceMeta } from "../../server/lib/sourceRegistry";

describe("sourceRegistry — catálogo de fontes com capabilities", () => {
  it("lista as fontes registradas (apple, google, wikipedia…) com metadados completos", () => {
    const sources = listSources();
    const ids = sources.map((s) => s.id);
    // A lista cresce a cada fonte nova — as três primeiras (lojas + wikipedia)
    // permanecem estáveis no início.
    expect(ids.slice(0, 3)).toEqual(["apple", "google", "wikipedia"]);
    for (const src of sources) {
      expect(src.label).toBeTruthy();
      expect(["none", "apikey", "oauth"]).toContain(src.auth);
      expect(src.collector).toBeTruthy();
      expect(src.tosNote).toBeTruthy();
      expect(src.method).toBeTruthy();
    }
  });

  it("getSource retorna a fonte certa e undefined para id desconhecido", () => {
    const src = getSource("apple") as SourceMeta;
    expect(src.id).toBe("apple");
    expect(src.capabilities.reviews).toBe(true);
    expect(getSource("fonte-inexistente")).toBeUndefined();
    expect(getSource(undefined)).toBeUndefined();
  });

  it("hasCapability consulta capability declarada", () => {
    expect(hasCapability("apple", "reviews")).toBe(true);
    expect(hasCapability("apple", "healthCheck")).toBe(false);
    expect(hasCapability("google", "healthCheck")).toBe(true);
    expect(hasCapability("google", "topCharts")).toBe(true);
    expect(hasCapability("unknown-source", "reviews")).toBe(false);
  });

  it("ids são únicos e estáveis (chave do catálogo)", () => {
    const ids = listSources().map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
