import { describe, expect, it } from "vitest";
import {
  SUGGEST_PROVIDERS,
  getSuggestProvider,
  listSuggestProviderIds,
  SUGGEST_PROVIDER_GROUPS,
} from "../../server/lib/suggestProviders";

describe("suggestProviders - registry", () => {
  it("todos os provedores tem id,label,group,region e parser", () => {
    for (const p of SUGGEST_PROVIDERS) {
      expect(p.id).toBeTruthy();
      expect(p.label).toBeTruthy();
      expect(p.group).toBeTruthy();
      expect(p.region).toBeTruthy();
      expect(typeof p.buildUrl).toBe("function");
      expect(typeof p.parse).toBe("function");
    }
  });

  it("lookup por id e lista de ids", () => {
    expect(getSuggestProvider("bing")).toBeDefined();
    expect(getSuggestProvider("nao-existe")).toBeUndefined();
    const ids = listSuggestProviderIds();
    expect(ids).toContain("wikipedia");
    expect(ids.length).toBe(SUGGEST_PROVIDERS.length);
  });

  it("grupos de exibicao cobrem todos os grupos usados", () => {
    const groupIds = new Set(SUGGEST_PROVIDER_GROUPS.map((g) => g.id));
    for (const p of SUGGEST_PROVIDERS) {
      expect(groupIds.has(p.group)).toBe(true);
    }
  });
});

describe("suggestProviders - parsers (fixtures capturados ao vivo)", () => {
  it("Bing JSON", () => {
    const prov = getSuggestProvider("bing");
    const raw = '["python",["python download","python compiler","python online"]]';
    const items = prov.parse(raw, 10);
    expect(items.length).toBeGreaterThanOrEqual(3);
    expect(items[0].text).toBe("python download");
    expect(items[0].relevance).toBeGreaterThan(0);
  });

  it("DuckDuckGo JSON", () => {
    const prov = getSuggestProvider("duckduckgo");
    const raw = '["python",["python","python download","python online compiler"]]';
    const items = prov.parse(raw, 10);
    expect(items.some((i) => i.text === "python download")).toBe(true);
  });

  it("Brave JSON", () => {
    const prov = getSuggestProvider("brave");
    const raw = '["python",["python","python download","python online compiler"]]';
    const items = prov.parse(raw, 10);
    expect(items.length).toBeGreaterThan(0);
  });

  it("Yahoo JSON (r[].k)", () => {
    const prov = getSuggestProvider("yahoo");
    const raw = '{"q":"python","r":[{"k":"python download","m":6},{"k":"python.org","m":5}]}';
    const items = prov.parse(raw, 10);
    const texts = items.map((i) => i.text);
    expect(texts).toContain("python download");
    expect(texts).toContain("python.org");
  });

  it("Yandex JSON estilo Google", () => {
    const prov = getSuggestProvider("yandex");
    const raw = '["python",["python","python online"]]';
    const items = prov.parse(raw, 10);
    expect(items.length).toBe(2);
  });

  it("Baidu JSON (g[].q)", () => {
    const prov = getSuggestProvider("baidu");
    const raw = '{"q":"python","g":[{"type":"sug","q":"python jiao cheng"},{"type":"sug","q":"python guan wang"}]}';
    const items = prov.parse(raw, 10);
    const texts = items.map((i) => i.text);
    expect(texts).toContain("python jiao cheng");
    expect(items.length).toBe(2);
  });

  it("Naver JSON aninhado (items[i][1])", () => {
    const prov = getSuggestProvider("naver");
    const raw = '{"query":["python"],"items":[[["python"],["python deutf"],["python seolbi"]]]}';
    const items = prov.parse(raw, 10);
    const texts = items.map((i) => i.text);
    expect(texts).toContain("python deutf");
  });

  it("Amazon JSON (suggestions[].value)", () => {
    const prov = getSuggestProvider("amazon");
    const raw = '{"alias":"aps","suggestions":[{"value":"ball python tank accessories"},{"value":"python books"}]}';
    const items = prov.parse(raw, 10);
    const texts = items.map((i) => i.text);
    expect(texts).toContain("ball python tank accessories");
  });

  it("eBay JSONP (strip prefixo fn)", () => {
    const prov = getSuggestProvider("ebay");
    const raw = '/**/vjo.fn({"prefix":"python","res":{"sug":["python cowboy boots","python bag"]}})';
    const items = prov.parse(raw, 10);
    const texts = items.map((i) => i.text);
    expect(texts).toContain("python cowboy boots");
    expect(items.length).toBe(2);
  });

  it("Wikipedia opensearch", () => {
    const prov = getSuggestProvider("wikipedia");
    const raw = '["python",["Python","Python (genero)"],["",""],["url1","url2"]]';
    const items = prov.parse(raw, 10);
    const texts = items.map((i) => i.text);
    expect(texts).toContain("Python");
  });

  it("respostas invalidas viram lista vazia (sem lancar)", () => {
    const prov = getSuggestProvider("bing");
    expect(prov.parse("not json", 10)).toEqual([]);
    expect(prov.parse("", 10)).toEqual([]);
    expect(prov.parse("{}", 10)).toEqual([]);
  });
});
