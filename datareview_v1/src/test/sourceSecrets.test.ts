import { describe, it, expect, beforeEach } from "vitest";
import {
  getSourceSecret, setSourceSecret, deleteSourceSecret, hasSourceSecret, buildAuthPayload,
} from "@/lib/uni/sourceSecrets";
import { saveCustomSource, deleteCustomSource, getCustomSource } from "@/lib/uni/customSources";
import { inventoryOutputs } from "@/lib/outputs";

const KEY = "aso:uni-source-secrets:v1";

describe("sourceSecrets — vault local de credenciais de fontes custom (Onda 4.3)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("set/get/has + persistência no localStorage", () => {
    expect(hasSourceSecret("newsapi")).toBe(false);
    setSourceSecret("newsapi", "sk-abc123");
    expect(getSourceSecret("newsapi")).toBe("sk-abc123");
    expect(hasSourceSecret("newsapi")).toBe(true);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ newsapi: "sk-abc123" });
  });

  it("valor vazio remove o segredo", () => {
    setSourceSecret("newsapi", "sk-abc123");
    setSourceSecret("newsapi", "   ");
    expect(hasSourceSecret("newsapi")).toBe(false);
    expect(localStorage.getItem(KEY)).toBe("{}");
  });

  it("deleteSourceSecret limpa", () => {
    setSourceSecret("newsapi", "x");
    deleteSourceSecret("newsapi");
    expect(getSourceSecret("newsapi")).toBe("");
  });

  it("buildAuthPayload inclui valor só quando há segredo", () => {
    const auth = { type: "header" as const, key: "X-Api-Key" };
    expect(buildAuthPayload("newsapi", auth)).toBeUndefined();
    setSourceSecret("newsapi", "segredo");
    expect(buildAuthPayload("newsapi", auth)).toEqual({ type: "header", key: "X-Api-Key", value: "segredo" });
    expect(buildAuthPayload("newsapi")).toBeUndefined();
  });

  it("def com auth guarda tipo+chave SEM o valor (exportável)", () => {
    const saved = saveCustomSource({
      label: "News API",
      kind: "news",
      urlTemplate: "https://newsapi.org/v2/everything?q={q}",
      fields: { title: "title" },
      access: "com-chave",
      apiKind: "api-oficial",
      auth: { type: "query", key: "apiKey" },
    });
    expect("errors" in saved).toBe(false);
    if (!("errors" in saved)) {
      expect(saved.auth).toEqual({ type: "query", key: "apiKey" });
      expect(JSON.stringify(getCustomSource(saved.id))).not.toContain("value");
    }
  });

  it("excluir a fonte leva o segredo junto", () => {
    const saved = saveCustomSource({
      label: "Temp Source",
      kind: "news",
      urlTemplate: "https://x.com/q?q={q}",
      fields: { title: "t" },
      access: "com-chave",
      apiKind: "api-oficial",
      auth: { type: "bearer", key: "" },
    });
    if ("errors" in saved) throw new Error("save falhou");
    setSourceSecret(saved.id, "token-secreto");
    deleteCustomSource(saved.id);
    expect(hasSourceSecret(saved.id)).toBe(false);
  });

  it("vault é sensitive no inventário (nunca exportado)", () => {
    localStorage.setItem(KEY, JSON.stringify({ newsapi: "sk-secreto" }));
    localStorage.setItem("aso:dataset:v1", "[]");
    const secrets = inventoryOutputs()
      .flatMap((g) => g.entries)
      .find((k) => k.key === KEY);
    expect(secrets?.sensitive).toBe(true);
  });
});
