import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import {
  SERPAPI_FALLBACKS,
  SerpApiSource,
  fallbackEngineFor,
  normalizeSerpApiResults,
  AUDIT_REGISTRY,
  auditSourceById,
  sourceStats,
  categoryCounts,
} from "../src/index.js";

describe("serpapi fallback registry", () => {
  test("mapeia fontes existentes para engines aprovados", () => {
    assert.equal(fallbackEngineFor("suggest"), "google_autocomplete");
    assert.equal(fallbackEngineFor("trends"), "google_trends");
    assert.equal(fallbackEngineFor("hackernews"), "google_search");
    assert.equal(fallbackEngineFor("unknown-source"), undefined);
  });

  test("sugestoes gardam capacidades da fonte", () => {
    assert.ok(SERPAPI_FALLBACKS.suggest!.capabilities.includes("trends"));
    assert.ok(SERPAPI_FALLBACKS.youtube!.capabilities.includes("media"));
  });

  test("engine desconhecido usa google_search por padrao", () => {
    assert.equal(SERPAPI_FALLBACKS.reddit!.engine, "google_search");
    assert.equal(SERPAPI_FALLBACKS.apple!.engine, "apple_app_store");
  });
});

describe("normalizeSerpApiResults", () => {
  test("converte organic_results em NormalizedItem", () => {
    const payload = {
      organic_results: [
        { position: 1, title: "GitHub", link: "https://github.com", snippet: "Build software", result_id: "r1" },
      ],
    };
    const items = normalizeSerpApiResults("google_search", payload);
    assert.equal(items.length, 1);
    assert.equal(items[0]!.title, "GitHub");
    assert.equal(items[0]!.url, "https://github.com");
    assert.equal(items[0]!.score, 99);
    assert.equal(items[0]!.meta!.engine, "google_search");
  });

  test("autocomplete devolve suggestions como strings", () => {
    const items = normalizeSerpApiResults("google_autocomplete", { suggestions: ["ruby", "rust"] });
    assert.equal(items.length, 2);
    assert.equal(items[0]!.kind, "suggestion");
    assert.equal(items[1]!.title, "rust");
  });

  test("payload invalido retorna lista vazia", () => {
    assert.deepEqual(normalizeSerpApiResults("google_search", null), []);
    assert.deepEqual(normalizeSerpApiResults("google_search", { organic_results: "nope" }), []);
  });
});

describe("SerpApiSource", () => {
  test("sem api key devolve erro honesto", async () => {
    const src = new SerpApiSource({ apiKey: "" });
    const res = await src.collect({ query: "q" });
    assert.match(res.error ?? "", /api key missing/);
  });

  describe("audit registry real", () => {
    test("55 fontes auditadas vindas da auditoria", () => {
      assert.equal(AUDIT_REGISTRY.length, 55);
      assert.ok(AUDIT_REGISTRY.every((e) => e.status === "audited"));
      assert.ok(AUDIT_REGISTRY.every((e) => e.implemented));
    });

    test("stats reproduz KPIs da auditoria", () => {
      const s = sourceStats(AUDIT_REGISTRY);
      assert.deepEqual(s, { sources:  55, audited:  55, inProgress: 0, pending:  0, implemented:  55 });
    });

    test("auditSourceById resolve e categoryCounts agrupa", () => {
      assert.equal(auditSourceById("steam")?.name, "Steam");
      assert.equal(auditSourceById("nao-existe"), undefined);
      assert.equal((categoryCounts(AUDIT_REGISTRY).get("Social") ?? 0), 4);
    });
  });
});
