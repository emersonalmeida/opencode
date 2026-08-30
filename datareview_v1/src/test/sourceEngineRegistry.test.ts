// @vitest-environment node
/**
 * Testes da fundação do Source Engine (server/lib/sourceEngine):
 * registry plugável + contrato de types. Padrão dos testes do server:
 * ambiente node, import relativo, zero deps. */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { SourceCollector } from "../../server/lib/sourceEngine/types";
import {
  registerSource,
  registerSources,
  unregisterSource,
  getCollector,
  listCollectors,
  listDescriptors,
  getDescriptor,
  clearRegistry,
} from "../../server/lib/sourceEngine/registry";

const dummy = (id: string, overrides: Partial<SourceCollector> = {}): SourceCollector => ({
  id,
  label: `Fonte ${id}`,
  kind: "news",
  auth: "none",
  capabilities: { search: true },
  collect: async () => ({ items: [] }),
  ...overrides,
});

describe("sourceEngine/registry — plugabilidade", () => {
  beforeEach(() => clearRegistry());
  afterEach(() => clearRegistry());

  it("registra e resolve UMA fonte", () => {
    registerSource(dummy("a"));
    expect(getCollector("a")).toBeDefined();
    expect(listCollectors().map((c) => c.id)).toEqual(["a"]);
  });

  it("registra N fontes de uma vez e preserva ordem", () => {
    registerSources([dummy("a"), dummy("b"), dummy("c")]);
    expect(listCollectors().map((c) => c.id)).toEqual(["a", "b", "c"]);
  });


  it("idempotente: mesma id substitui, sem duplicar", () => {
    registerSource(dummy("a"));
    registerSource(dummy("a", { label: "Nova" }));
    expect(listCollectors()).toHaveLength(1);
    expect(getCollector("a")?.label).toBe("Nova");
  });


  it("unregister remove a fonte", () => {
    registerSource(dummy("a"));
    unregisterSource("a");
    expect(getCollector("a")).toBeUndefined();
  });


  it("clearRegistry zera tudo (testes)", () => {
    registerSources([dummy("a"), dummy("b")]);
    clearRegistry();
    expect(listCollectors()).toHaveLength(0);
  });
});

describe("sourceEngine/registry — descriptors canônicos", () => {
  beforeEach(() => clearRegistry());
  afterEach(() => clearRegistry());


  it("derive descriptor do collector com defaults sensatos", () => {
    registerSource(dummy("a", {
      kind: "store",
      capabilities: { search: true, reviews: true },
      rateLimit: { rps: 1 },
      regions: ["br", "us"],
      method: "API oficial",
      collector: "acme-collector",
      collectorVersion: "3",
      paramsSpec: [{ id: "region", label: "Região", type: "select", options: [{ value: "br", label: "Brasil" }] }],
    }));
    const d = getDescriptor("a")!;
    expect(d.auth).toBe("none");
    expect(d.capabilities).toEqual({ search: true, reviews: true, lookup: undefined, topCharts: undefined, healthCheck: undefined });
    expect(d.rateLimit).toEqual({ rps: 1 });
    expect(d.paramsSpec).toHaveLength(1);
    expect(d.collector).toBe("acme-collector");
  });


  it("omite campos ausentes (descriptor enxuto)", () => {
    registerSource(dummy("a"));
    const d = getDescriptor("a")!;
    expect(d.tosNote).toBeUndefined();
    expect(d.method).toBeUndefined();
    expect(d.tags).toBeUndefined();
  });


  it("listDescriptors lista na ordem de registro", () => {
    registerSources([dummy("b"), dummy("a")]);
    expect(listDescriptors().map((d) => d.id)).toEqual(["b", "a"]);
  });
});