// @vitest-environment node
/**
 * Testes do routeCache — cache em memória de respostas das rotas de coleta
 * (padrão load_cache/save_cache do _uni.py) que protege APIs com rate-limit.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { cacheKey, cacheStats, clearRouteCache, getCached, setCached } from "../../server/lib/routeCache";

describe("routeCache", () => {
  beforeEach(() => clearRouteCache());

  it("round-trip: set → get retorna o payload", () => {
    setCached("rota", { q: "bitcoin" }, { items: [1, 2] }, 60_000);
    expect(getCached("rota", { q: "bitcoin" })).toEqual({ items: [1, 2] });
  });

  it("miss: rota ou params diferentes não compartilham entrada", () => {
    setCached("rota", { q: "a" }, "x", 60_000);
    expect(getCached("rota", { q: "b" })).toBeUndefined();
    expect(getCached("outra", { q: "a" })).toBeUndefined();
  });

  it("TTL expirado remove a entrada", () => {
    setCached("rota", { q: "a" }, "x", -1); // já expirado
    expect(getCached("rota", { q: "a" })).toBeUndefined();
    expect(cacheStats().size).toBe(0);
  });

  it("cacheKey normaliza ordem de arrays (mesmos termos, ordem diferente)", () => {
    const k1 = cacheKey("rota", { terms: ["b", "a"] });
    const k2 = cacheKey("rota", { terms: ["a", "b"] });
    expect(k1).toBe(k2);
    // Objetos com chaves em ordem diferente também colidem corretamente.
    expect(cacheKey("r", { a: 1, b: 2 })).toBe(cacheKey("r", { b: 2, a: 1 }));
  });

  it("respeita o teto removendo entradas antigas", () => {
    for (let i = 0; i < 210; i++) setCached("rota", { i }, i, 60_000);
    expect(cacheStats().size).toBeLessThanOrEqual(200);
    // As mais novas sobrevivem.
    expect(getCached("rota", { i: 209 })).toBe(209);
  });

  it("expiradas são removidas na leitura e na eviction por capacidade", () => {
    for (let i = 0; i < 199; i++) setCached("rota", { i }, i, -1); // tudo expirado
    setCached("rota", { q: "nova" }, "ok", 60_000);
    // A leitura de uma expirada a remove do store.
    expect(getCached("rota", { i: 0 })).toBeUndefined();
    expect(cacheStats().size).toBe(199);
    // Estourar o teto evicta as expiradas antes das válidas.
    for (let i = 0; i < 10; i++) setCached("rota", { extra: i }, i, 60_000);
    expect(getCached("rota", { q: "nova" })).toBe("ok");
    expect(getCached("rota", { extra: 9 })).toBe(9);
  });
});
