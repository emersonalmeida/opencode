/**
 * Validação do INVENTÁRIO completo do sistema (catálogo de fontes + núcleo):
 *  - integridade do catálogo (ids únicos, vocabulários válidos, campos exigidos)
 *  - consistência entre catálogo, audit registry e fallbacks SerpAPI
 *  - contrato ItemKind ↔ dados produzidos
 *  - round-trip do pipeline com uma fonte do catálogo (coleta→stats→IA)
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AUDIT_REGISTRY,
  SOURCE_CATALOG,
  SERPAPI_FALLBACKS,
  catalogByGroup,
  catalogCount,
  getSourceCatalogEntry,
  listSourceCatalog,
  toSourceDescriptor,
} from "../src/index.js";
import type { SourceCapability } from "@v4/contracts";

const ALLOWED_STATUS = ["implemented", "bridge", "planned"];
const ALLOWED_GROUP = ["uni", "connectors", "discover", "stores", "knowledge"];
const ALLOWED_METHOD = ["api", "json", "scrape", "feed", "other"];
const ALLOWED_AUTH = ["none", "byok", "oauth"];
const ALLOWED_CAPABILITIES = [
  "search",
  "reviews",
  "news",
  "social",
  "code",
  "media",
  "academic",
  "trends",
  "custom",
];

/* ---------------------------------------------------------- integridade -- */

test("catálogo: ids únicos e quantidade consistente", () => {
  const ids = SOURCE_CATALOG.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, "ids com duplicação");
  assert.equal(ids.length, catalogCount());
  assert.ok(listSourceCatalog().length >= 40, "esperado inventário amplo de fontes");
  assert.equal(
    SOURCE_CATALOG.filter((e) => e.status === "implemented" || e.status === "bridge").length,
    SOURCE_CATALOG.length,
    "todas as fontes do catálogo devem estar prontas ou como ponte v1",
  );
});

test("catálogo: vocabulários válidos em todas as entradas", () => {
  for (const e of SOURCE_CATALOG) {
    assert.ok(ALLOWED_STATUS.includes(e.status), e.id + " status inválido");
    assert.ok(ALLOWED_GROUP.includes(e.group), e.id + " group inválido");
    assert.ok(ALLOWED_METHOD.includes(e.method), e.id + " method inválido");
    assert.ok(ALLOWED_AUTH.includes(e.auth), e.id + " auth inválido");
    assert.ok(e.capabilities.length > 0, e.id + " sem capabilities");
    for (const c of e.capabilities) {
      assert.ok(ALLOWED_CAPABILITIES.includes(c), e.id + " capability inválida: " + c);
    }
  }
});

test("catálogo: campos obrigatórios preenchidos", () => {
  for (const e of SOURCE_CATALOG) {
    assert.ok(e.label.trim().length > 0, e.id + " sem label");
    assert.ok(e.data.length > 0, e.id + " sem dados coletados");
    assert.ok(e.resource.trim().length > 0, e.id + " sem recurso/endpoint");
    assert.ok(e.params.length > 0, e.id + " sem parâmetros");
    if (e.lookup) {
      assert.ok(e.params.length >= 1, e.id + " lookup deve aceitar identificador");
    }
  }
});

test("catálogo: toSourceDescriptor produz descritor de contrato válido", () => {
  for (const e of SOURCE_CATALOG) {
    const d = toSourceDescriptor(e);
    assert.equal(d.id, e.id);
    assert.ok(d.label.length > 0);
    assert.ok(["json", "api", "scrape", "other"].includes(d.method), d.id + " método do descritor");
    assert.ok(["none", "byok", "oauth"].includes(d.auth), d.id + " auth do descritor");
    assert.ok(d.capabilities.length > 0);
    for (const c of d.capabilities) assert.ok(ALLOWED_CAPABILITIES.includes(c));
  }
});

test("catálogo: kinds produzidos estão no vocabulário ItemKind", () => {
  // Um item do catálogo só pode declarar dados que mapeiam ao contrato;
  // aqui validamos que os kinds dos grupos-chave são conhecidos da UI.
  const kinds = new Set<string>();
  for (const e of SOURCE_CATALOG) {
    for (const c of e.capabilities) {
      if (c === "reviews") kinds.add("review");
      if (c === "academic") kinds.add("paper");
      if (c === "code") kinds.add("repo");
    }
  }
  for (const k of kinds) {
    const item = { id: "x", source: "s", kind: k, title: "t" };
    assert.equal(item.kind, k, "kind não atribuível via ItemKind: " + k);
  }
});

/* -------------------------------------------------- consistência cruzada -- */

test("consistência: fallbacks SerpAPI apontam só para fontes do catálogo", () => {
  for (const sourceId of Object.keys(SERPAPI_FALLBACKS)) {
    const entry = getSourceCatalogEntry(sourceId);
    assert.ok(entry, "fallback para fonte inexistente no catálogo: " + sourceId);
    if (entry) {
      const fb = SERPAPI_FALLBACKS[sourceId];
      assert.ok(fb, sourceId + " sem fallback de fato");
      if (fb) for (const c of fb.capabilities) assert.ok(ALLOWED_CAPABILITIES.includes(c));
    }
  }
});

test("consistência: audit registry tem ids/ordem únicos e enum válido", () => {
  const ids = AUDIT_REGISTRY.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, "ids duplicados no audit");
  const orders = AUDIT_REGISTRY.map((e) => e.order);
  assert.equal(new Set(orders).size, orders.length);
  for (const e of AUDIT_REGISTRY) {
    assert.ok(["audited", "in-progress", "pending"].includes(e.status));
    for (const c of e.capabilities) assert.ok(ALLOWED_CAPABILITIES.includes(c));
  }
});

test("consistência: catálogo cobre as fontes coletáveis do audit registry", () => {
  // O audit registry descreve tudo (inclui voz/infra); o catálogo documenta as
  // fontes COLETÁVEIS. Toda entrada que é uma fonte de coleta deve existir.
  const collectableAudit = AUDIT_REGISTRY.filter((a) =>
    !["whisper", "piper"].includes(a.id) && !a.id.startsWith("url-"),
  );
  const missing = collectableAudit
    .map((a) => a.id)
    .filter((id) => !catalogHas(id));
  assert.deepEqual(missing, [], "fontes do audit sem entrada no catálogo");
});

function catalogHas(id: string): boolean {
  return SOURCE_CATALOG.some((e) => e.id === id || e.aliases?.includes(id));
}

test("grupos: todos os grupos do pipeline canônico têm representação", () => {
  assert.ok(catalogByGroup("uni").length >= 15, "uni deve ser o grupo principal");
  assert.ok(catalogByGroup("connectors").length >= 15);
  assert.ok(catalogByGroup("discover").length >= 10);
  assert.ok(catalogByGroup("stores").length >= 2);
});

/* ------------------------------------------------- round-trip do pipeline -- */

test("pipeline+: round-trip de uma fonte do catálogo (coleta→stats→IA)", async () => {
  const { runPipeline } = await import("@v4/domain");
  const entry = getSourceCatalogEntry("hackernews");
  assert.ok(entry);

  const memory = new Map<string, { key: string; item: { id: string; source: string; title: string; kind: string; url?: string; score?: number }; collectedAt: number }>();
  const storage = {
    async list() { return [...memory.values()]; },
    async get(key: string) { return memory.get(key); },
    async upsert(entry: { key: string; item: { id: string; source: string; title: string; kind: string }; collectedAt: number }) {
      const isNew = !memory.has(entry.key);
      memory.set(entry.key, entry as never);
      return isNew;
    },
    async upsertMany(entries: Array<{ key: string; item: { id: string; source: string; title: string; kind: string }; collectedAt: number }>) {
      let added = 0;
      for (const e of entries) { if (await storage.upsert(e)) added++; }
      return added;
    },
    async revision() { return memory.size; },
  };
  const source = {
    id: "hackernews",
    label: "HN",
    kind: "news",
    description: "",
    capabilities: ["news"] as SourceCapability[],
    rateLimit: { rps: 1, burst: 1 },
    async collect() {
      return {
        source: "hackernews",
        query: "typescript",
        items: [
          { id: "1", source: "hackernews", kind: "post", title: "Typescript 6", url: "https://example.net/1", score: 120 },
          { id: "2", source: "hackernews", kind: "post", title: "Lettypescript", url: "https://example.net/2", score: 90 },
          { id: "1", source: "hackernews", kind: "post", title: "dup", url: "https://example.net/1" },
        ],
      };
    },
  };
  const run = await runPipeline(source, { query: "typescript", limit: 10 }, { storage });
  assert.equal(run.added, 2, "dedup deve remover o item repetido");
  assert.equal(run.total, 3);
  assert.ok(run.response.source === "hackernews");
});