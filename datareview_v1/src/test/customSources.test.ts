// @vitest-environment jsdom
/**
 * Fontes customizadas do usuário (customSources.ts) — validação, slugify,
 * URL template, CRUD com pub/sub, cap e storage corrompido. E o conector
 * custom do servidor (uniSource.customConnector) com payloads mínimos.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  slugify, validateCustomSource, buildCustomUrl, saveCustomSource, deleteCustomSource,
  listCustomSources, getCustomSource, subscribeCustomSources, type CustomSourceDef,
} from "../lib/uni/customSources";
import { customConnector } from "../../server/routes/uniSource";
import { mapConnectorItems } from "../../server/lib/uniConnectors";

const base: Omit<CustomSourceDef, "id" | "createdAt"> = {
  label: "Minha API",
  description: "teste",
  kind: "web-result",
  urlTemplate: "https://api.exemplo.com/search?q={q}&n={limit}",
  listPath: "results",
  fields: { title: "title", url: "link", score: "rank" },
  access: "gratuita",
  apiKind: "api-oficial",
};

beforeEach(() => {
  localStorage.clear();
  for (const d of listCustomSources()) deleteCustomSource(d.id);
});

describe("customSources — validação e URL", () => {
  it("slugify normaliza acentos e caracteres especiais", () => {
    expect(slugify("Minha Fonte (v2)!")).toBe("minha-fonte-v2");
    expect(slugify("")).toBe("fonte");
  });
  it("validação exige label, URL http(s) com {q} e campo título", () => {
    expect(validateCustomSource({})).toHaveLength(3);
    expect(validateCustomSource({ ...base, urlTemplate: "https://x.com/busca" })).toEqual([
      "A URL deve conter o placeholder {q} para o termo de busca.",
    ]);
    expect(validateCustomSource(base)).toEqual([]);
  });
  it("buildCustomUrl substitui {q} (encodado) e {limit} (clamped)", () => {
    const def = { ...base, id: "x", createdAt: 0 } as CustomSourceDef;
    expect(buildCustomUrl(def, "meu app", 5)).toBe("https://api.exemplo.com/search?q=meu%20app&n=5");
    expect(buildCustomUrl(def, "ok", 999)).toContain("n=100");
  });
});

describe("customSources — CRUD com pub/sub", () => {
  it("salva, lista, edita (mesmo id) e exclui", () => {
    const saved = saveCustomSource(base);
    expect("id" in saved && saved.id).toBe("minha-api");
    expect(listCustomSources()).toHaveLength(1);
    const edited = saveCustomSource({ ...base, label: "Minha API v2" }, "minha-api");
    expect("id" in edited && edited.label).toBe("Minha API v2");
    expect(listCustomSources()).toHaveLength(1);
    deleteCustomSource("minha-api");
    expect(listCustomSources()).toHaveLength(0);
  });
  it("recusa def inválida com erros", () => {
    const res = saveCustomSource({ ...base, label: "" });
    expect("errors" in res && res.errors.length).toBeGreaterThan(0);
    expect(listCustomSources()).toHaveLength(0);
  });
  it("notifica subscribers ao salvar", () => {
    let n = 0;
    const unsub = subscribeCustomSources(() => n++);
    saveCustomSource(base);
    expect(n).toBe(1);
    unsub();
  });
  it("storage corrompido não quebra a leitura", () => {
    localStorage.setItem("aso:uni-custom-sources:v1", "{quebrado");
    expect(getCustomSource("x")).toBeUndefined();
  });
});

describe("uniSource.customConnector — conector do usuário", () => {
  it("rejeita def sem {q} ou sem fields.title", () => {
    expect(customConnector({ urlTemplate: "https://x.com", fields: { title: "t" } })).toBeNull();
    expect(customConnector({ urlTemplate: "https://x.com?q={q}", fields: {} })).toBeNull();
  });
  it("monta URL e mapeia itens com dot-paths", () => {
    const conn = customConnector({
      id: "minha-api", label: "Minha API", kind: "post",
      urlTemplate: "https://api.exemplo.com/search?q={q}&n={limit}",
      listPath: "results",
      fields: { title: "title", url: "link", score: "rank", author: "by.name" },
    })!;
    expect(conn.buildUrl("teste termo", 3)).toBe("https://api.exemplo.com/search?q=teste%20termo&n=3");
    const items = mapConnectorItems(conn, {
      results: [
        { title: "Item 1", link: "https://x/1", rank: 9, by: { name: "Ana" } },
        { link: "sem título" },
      ],
    }, 10);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Item 1");
    expect(items[0].score).toBe(9);
    expect(items[0].author).toBe("Ana");
    expect(items[0].meta?.customSource).toBe("Minha API");
  });
});
