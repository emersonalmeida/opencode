// @vitest-environment node
/**
 * Testes do adapter declarativo do Source Engine:
 * converte os conectores JSON existentes (uniConnectors) em collectors
 * do motor sem reescrevê-los — preserva: ids, labels, kinds, itens
 * normalizados e metadados. */
import { describe, it, expect } from "vitest";
import { declarativeCollectors, declarativeCollector } from "../../server/lib/sourceEngine/collectors/declarative";
import { registerSources, listDescriptors, clearRegistry, getCollector } from "../../server/lib/sourceEngine/registry";

describe("sourceEngine/declarative — adapter sobre uniConnectors", () => {
  afterEach(() => clearRegistry());

  it("gera UM collector por conector existente, com ids únicos", () => {
    const cols = declarativeCollectors();
    expect(cols.length).toBeGreaterThanOrEqual(15);
    const ids = cols.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });


  it("cada collector tem contrato canônico preenchido", () => {
    for (const c of declarativeCollectors()) {
      expect(c.id).toBeTruthy();
      expect(c.label).toBeTruthy();
      expect(c.kind).toBeTruthy();
      expect(typeof c.collect).toBe("function");
      expect(c.capabilities).toBeDefined();
    }
  });


  it("descriptor derivado registra todos com auth default none/ex.: devto", () => {
    const cols = declarativeCollectors();
    registerSources(cols);
    const desc = listDescriptors().find((d) => d.id === "devto")!;
    expect(desc.auth).toBe("none");
    expect(desc.capabilities?.search).toBe(true);
    expect(desc.kind).toBe("news");
  });


  it("kind aberto é normalizado para enum do motor", () => {
    const c = declarativeCollector("npm")!;
    expect(c.kind).toBe("developer");
    const store = declarativeCollector("openlibrary")!;
    expect(store.kind).toBe("store");
  });


  it("converte UMA id inexistente em undefined", () => {
    expect(declarativeCollector("nao-existe")).toBeUndefined();
  });


  it("collect executa mapConnectorItems e normaliza com source/kind", async () => {
    const c = declarativeCollector("tvmaze")!;
    const out = await c.collect({ source: "tvmaze", query: "breaking bad", limit: 3 });
    expect(out.items.length).toBeGreaterThanOrEqual(1);
    for (const it of out.items) {
      expect(it.source).toBe("tvmaze");
      expect(it.kind).toBeTruthy();
      expect(it.title).toBeTruthy();
      expect(it.meta?.rawKind).toBe("video");
    }
  });
});