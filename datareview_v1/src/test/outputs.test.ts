import { describe, it, expect, beforeEach } from "vitest";
import {
  inventoryOutputs, listAsoKeys, formatBytes, deleteKey, deleteGroup,
  resetAllLocalData, countLocalRecords, factoryReset, OUTPUT_GROUPS,
} from "@/lib/outputs";

beforeEach(() => localStorage.clear());

describe("outputs inventory", () => {
  it("lista apenas chaves aso:*", () => {
    localStorage.setItem("aso:dataset:v1", "[]");
    localStorage.setItem("outra-coisa", "x");
    expect(listAsoKeys()).toEqual(["aso:dataset:v1"]);
  });

  it("agrupa por natureza do dado", () => {
    localStorage.setItem("aso:dataset:v1", "[]");
    localStorage.setItem("aso:ai-outputs:v1", "{}");
    localStorage.setItem("aso:canvas:v1", "{}");
    localStorage.setItem("aso:feature-flags:v1", "{}");
    const groups = inventoryOutputs();
    const ids = groups.map((g) => g.group.id);
    expect(ids).toEqual(["base", "ia", "projetos", "sistema"]);
  });

  it("computa bytes e contagem de itens de arrays JSON", () => {
    localStorage.setItem("aso:dataset:v1", JSON.stringify([{ a: 1 }, { a: 2 }]));
    const g = inventoryOutputs().find((x) => x.group.id === "base")!;
    expect(g.entries[0].items).toBe(2);
    expect(g.entries[0].json).toBe(true);
    expect(g.entries[0].bytes).toBeGreaterThan(0);
    expect(g.totalBytes).toBe(g.entries[0].bytes);
  });

  it("marca chaves sensíveis (credenciais de IA)", () => {
    localStorage.setItem("aso:ai-settings:v1", "{}");
    const g = inventoryOutputs().find((x) => x.group.id === "sistema")!;
    expect(g.entries[0].sensitive).toBe(true);
  });

  it("deleteKey remove e retorna sucesso; idempotente", () => {
    localStorage.setItem("aso:dataset:v1", "[]");
    expect(deleteKey("aso:dataset:v1")).toBe(true);
    expect(localStorage.getItem("aso:dataset:v1")).toBeNull();
    expect(deleteKey("aso:dataset:v1")).toBe(false);
  });

  it("deleteGroup apaga só as chaves do grupo", () => {
    localStorage.setItem("aso:dataset:v1", "[]");
    localStorage.setItem("aso:canvas:v1", "{}");
    expect(deleteGroup("base")).toBe(1);
    expect(localStorage.getItem("aso:dataset:v1")).toBeNull();
    expect(localStorage.getItem("aso:canvas:v1")).not.toBeNull();
  });

  it("resetAllLocalData apaga tudo e retorna a contagem", () => {
    localStorage.setItem("aso:dataset:v1", "[]");
    localStorage.setItem("aso:ai-outputs:v1", "{}");
    localStorage.setItem("nao-aso", "x");
    expect(resetAllLocalData()).toBe(2);
    expect(countLocalRecords()).toBe(0);
    expect(localStorage.getItem("nao-aso")).toBe("x"); // não-aso preservado
  });

  it("factoryReset apaga TUDO (localStorage + sessionStorage), sem exceção", () => {
    localStorage.setItem("aso:dataset:v1", "[]");
    localStorage.setItem("aso:ai-settings:v1", "{}");
    localStorage.setItem("app-theme", "dark");
    localStorage.setItem("app-primary-color", "0 0% 0%");
    localStorage.setItem("collection-settings", "{}");
    sessionStorage.setItem("algo-temporario", "x");
    const n = factoryReset();
    expect(n).toBe(5);
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it("formatBytes formata B/KB/MB", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.00 MB");
  });

  it("grupos cobrem os prefixos principais sem overlap", () => {
    const all = OUTPUT_GROUPS.flatMap((g) => g.prefixes);
    expect(new Set(all).size).toBe(all.length);
  });
});
