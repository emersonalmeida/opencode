import { test } from "node:test";
import assert from "node:assert/strict";
import { createSources, sourcesFromEnv, collectAll } from "../src/index.js";

const PUBLIC_DEFAULT = ["suggest", "trends", "serp", "youtube", "googleplay", "apple", "producthunt", "reclameaqui"];

test("createSources ativa as 8 publicas por padrao", () => {
  const registry = createSources({});
  assert.deepEqual([...registry.enabled].sort(), [...PUBLIC_DEFAULT].sort());
  assert.equal(registry.adapters.size, 8);
});

test("createSources respeita overrides", () => {
  const registry = createSources({
    overrides: { serp: false, reclameaqui: false, github: true },
  });
  assert.ok(!registry.enabled.includes("serp"));
  assert.ok(!registry.enabled.includes("reclameaqui"));
  assert.ok(registry.enabled.includes("github"));
});

test("createSources injeta keys para o SerpAPI", () => {
  const registry = createSources({ keys: { SERPAPI_KEY: "teste" } });
  assert.ok(registry.adapters.has("serp"));
});

test("collectAll retorna resposta por fonte ativa", async () => {
  const registry = createSources({});
  const q = "gato";
  const responses = await collectAll(registry, { query: q, limit: 1 });
  assert.equal(responses.length, registry.enabled.length);
  for (const r of responses) {
    assert.equal(r.query,q);
    assert.ok(Array.isArray(r.items));
    assert.ok("source" in r);
  }
});

test("sourcesFromEnv usa process.env para keys", () => {
  const prev = process.env.SERPAPI_KEY;
  process.env.SERPAPI_KEY = "x";
  try {
    const registry = sourcesFromEnv();
    assert.ok(registry.adapters.has("serp"));
  } finally {
    if (prev !== undefined) process.env.SERPAPI_KEY = prev;
  }
});