// @vitest-environment node
/**
 * Testes do orquestrador do Source Engine (server/lib/sourceEngine/engine).
 * pipeline comun sobre collectors falsos - normalizacao, dedup, clamp,
 * cache hooks, erro padronizado (HTTP-friendly)e validacao.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { SourceCollector, SourceRequest, SourceResult, SourceItem } from "../../server/lib/sourceEngine/types";
import { registerSource, clearRegistry } from "../../server/lib/sourceEngine/registry";
import { collectSource, clampLimit, stableItemId, normalizeItem, dedupItems } from "../../server/lib/sourceEngine/engine";

const mk = (id: string, collect?: SourceCollector["collect"]): SourceCollector => ({
  id,
  label: "Fonte " + id,
  kind: "news",
  auth: "none",
  capabilities: { search: true },
    collect: collect ?? (async () => ({ items: [] })),
});

const item = (title: string, extra: Partial<SourceItem> = {}): SourceItem => ({
  source: "a",
  kind: "news",
  title,
  ...extra,
});

describe("sourceEngine/engine - pipeline comun", () => {
  beforeEach(() => clearRegistry());
  afterEach(() => clearRegistry());


  it("clampLimit janela canonica 1..100", () => {
    expect(clampLimit(undefined)).toBe(20);
    expect(clampLimit(0)).toBe(1);
    expect(clampLimit(500)).toBe(100);
    expect(clampLimit(7)).toBe(7);
  });


  it("stableItemId e estavel e case-insensitive", () => {
    const a = stableItemId({ source: "A", kind: "News", title: "  Hello  World  " });
    const b = stableItemId({ source: "a", kind: "news", title: "Hello World" });
    expect(a).toBe(b);
  });


  it("normalizeItem limpa e trunca campos preserva meta", () => {
    const out = normalizeItem(item("  Titulo  ", { url: "x", score:  5, meta: { a: 1 } }), "a");
    expect(out.title).toBe("Titulo");
    expect(out.url).toBe("x");
    expect(out.score).toBe(5);
    expect(out.meta).toEqual({ a: 1 });
  });


  it("dedupItems mantem primeira ocorrencia preserva ordem", () => {
    const out = dedupItems([item("A"), item("a"), item("B"), item("A")]);
    const titles = out.map(function (i) { return i.title; });
    expect(titles).toEqual(["A", "a", "B"]);
  });


  it("collectSource roda collector do registry e normaliza", async () => {
    registerSource(mk("a", async () => ({ items: [item("X"), item("  Y  ")] }) ) );
    const res = await collectSource({ source: "a", query: "q" });
    expect(res.count).toBe(2);
    expect(res.items[1].title).toBe("Y");
    expect(res.error).toBeUndefined();
  });


  it("fonte desconhecida retorna erro em shape de resultado", async () => {
    const res = await collectSource({ source: "nope", query: "q" });
    expect(res.error).toMatch(/fonte desconhecida/);
    expect(res.items).toHaveLength(0);
  });


  it("valida query obrigatoria", async () => {
    registerSource(mk("a"));
    const res = await collectSource({ source: "a", query: "   " });
    expect(res.error).toMatch(/query required/);
  });


  it("erro interno do collector vira resultado de erro legivel", async () => {
    registerSource(mk("a", async () => { throw new Error("boom de teste"); }));
    const res = await collectSource({ source: "a", query: "q" });
    expect(res.error).toBe("boom de teste");
  });


  it("clamp limit aplica teto ao resultado", async () => {
    registerSource(mk("a", async () => ({ items: [item("1"), item("2"), item("3"), item("4")] }) ) );
const res = await collectSource({ source: "a", query: "q", limit:  2 });
    expect(res.items).toHaveLength(2);
  });


  it("hook cacheGet hit retorna resultado cacheado", async () => {
    registerSource(mk("a", async () => ({ items: [item("X")] }) ) );
const cachedRes : SourceResult = { source: "a", query: "q", items: [], count:  0, cached: true };
    const res = await collectSource({ source: "a", query: "q" }, { cacheGet: function () { return cachedRes; } });
    expect(res.cached).toBe(true);
    expect(res.items).toHaveLength(0);
  });


  it("hooks onRunStart onRunEnd sao chamados", async () => {
    let started = 0;
    let ended = 0;
    registerSource(mk("a", async () => ({ items: [item("X")] }) ) );
const res = await collectSource(
      { source: "a", query: "q" },
      {
        onRunStart: function () { started++; },
        onRunEnd: function () { ended++; },
      },
    );
    expect(started).toBe(1);
    expect(ended).toBe(1);
    expect(res.error).toBeUndefined();
  });


  it("cacheSet recebe o resultado pronto", async () => {
    registerSource(mk("a", async () => ({ items: [item("X")] }) ) );
let got : SourceResult | undefined;
    const res = await collectSource(
      { source: "a", query: "q" },
      {
        cacheSet: function (r, resv) { got = resv; },
      },
    );
    expect(got?.count).toBe(res.count);
  });


  it("query com params extras repassados ao collector", async () => {
    let seen: SourceRequest | undefined;
    const hookColletor = async (req: SourceRequest) => { seen = req; return { items: [] }; };
    registerSource(mk("a", hookColletor));
    await collectSource({ source: "a", query: "q", params: { region: "br" }, limit:  5 });
    expect(seen?.params).toEqual({ region: "br" });
    expect(seen?.limit).toBe(5);
  });
});