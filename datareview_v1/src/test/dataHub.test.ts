import { describe, it, expect, beforeEach } from "vitest";
import { factoryReset, deleteKeys, inventoryOutputs, countLocalRecords } from "@/lib/outputs";
import { exportSelectedData, inspectBackup, importAllData, listExportableKeys } from "@/lib/dataPortability";

describe("data hub (outputs + portabilidade)", () => {
  beforeEach(() => localStorage.clear());

  it("deleteKeys apaga um conjunto arbitrário de chaves", () => {
    localStorage.setItem("aso:a", "1");
    localStorage.setItem("aso:b", "2");
    localStorage.setItem("aso:c", "3");
    expect(deleteKeys(["aso:a", "aso:c", "aso:inexistente"])).toBe(2);
    expect(localStorage.getItem("aso:a")).toBeNull();
    expect(localStorage.getItem("aso:b")).toBe("2");
  });

  it("exportSelectedData exporta apenas as chaves pedidas, no formato bundle", () => {
    localStorage.setItem("aso:dataset:v1", "[]");
    localStorage.setItem("aso:feature-flags:v1", "{}");
    const json = exportSelectedData(["aso:dataset:v1"]);
    const bundle = JSON.parse(json);
    expect(bundle.app).toBe("app-intelligence");
    expect(Object.keys(bundle.data)).toEqual(["aso:dataset:v1"]);
  });

  it("exportSelectedData nunca exporta chave sensível (credenciais de IA)", () => {
    localStorage.setItem("aso:ai-settings:v1", JSON.stringify({ cloud: { apiKey: "segredo" } }));
    localStorage.setItem("aso:dataset:v1", "[]");
    const bundle = JSON.parse(exportSelectedData(["aso:ai-settings:v1", "aso:dataset:v1"]));
    expect(bundle.data["aso:ai-settings:v1"]).toBeUndefined();
    expect(bundle.data["aso:dataset:v1"]).toBe("[]");
    expect(listExportableKeys()).not.toContain("aso:ai-settings:v1");
  });

  it("inspectBackup valida o arquivo sem importar", () => {
    expect(inspectBackup("não é json").ok).toBe(false);
    expect(inspectBackup(JSON.stringify({ app: "outro" })).ok).toBe(false);
    const good = JSON.stringify({ app: "app-intelligence", version: 1, exportedAt: "", data: { a: "1", b: "2" } });
    expect(inspectBackup(good)).toEqual({ ok: true, keys: 2 });
  });

  it("importAllData mescla sem sobrescrever chaves existentes (merge)", () => {
    localStorage.setItem("aso:x", "existente");
    const bundle = JSON.stringify({ app: "app-intelligence", version: 1, exportedAt: "", data: { "aso:x": "novo", "aso:y": "y" } });
    const res = importAllData(bundle, "merge");
    expect(res.ok).toBe(true);
    expect(res.imported).toBe(1);
    expect(res.skipped).toBe(1);
    expect(localStorage.getItem("aso:x")).toBe("existente");
    expect(localStorage.getItem("aso:y")).toBe("y");
  });

  it("importAllData replace sobrescreve e ignora chave sensível", () => {
    localStorage.setItem("aso:x", "velho");
    const bundle = JSON.stringify({ app: "app-intelligence", version: 1, exportedAt: "", data: { "aso:x": "novo", "aso:ai-settings:v1": "hack" } });
    const res = importAllData(bundle, "replace");
    expect(res.ok).toBe(true);
    expect(localStorage.getItem("aso:x")).toBe("novo");
    expect(localStorage.getItem("aso:ai-settings:v1")).toBeNull();
  });

  it("factoryReset apaga TUDO (wipe total, estado de primeiro acesso)", () => {
    localStorage.setItem("aso:dataset:v1", "[]");
    localStorage.setItem("app-theme", "dark");
    localStorage.setItem("app-primary-color", "blue");
    localStorage.setItem("collection-settings", "{}");
    localStorage.setItem("chave-de-outro-app", "também apagada — o reset é total");
    const n = factoryReset();
    expect(n).toBe(5);
    expect(localStorage.length).toBe(0);
    expect(countLocalRecords()).toBe(0);
    expect(inventoryOutputs()).toEqual([]);
  });
});
