/**
 * Testes da API — herméticos: storage em memória + registry de adaptadores
 * fake (sem rede). Valida o CONTRATO HTTP end-to-end.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { CollectOptions, CollectResponse, DatasetEntry, NormalizedItem, SourceCapability } from "@v4/contracts";
import type { SourcePort, StoragePort } from "@v4/domain";
import { createApp } from "../src/server.js";
import type { AppDeps } from "../src/deps.js";

class MemoryStorage implements StoragePort {
  readonly map = new Map<string, DatasetEntry>();
  async list(): Promise<DatasetEntry[]> {
    return [...this.map.values()].sort((a, b) => b.collectedAt - a.collectedAt);
  }
  async get(key: string): Promise<DatasetEntry | undefined> {
    return this.map.get(key);
  }
  async upsert(entry: DatasetEntry): Promise<boolean> {
    const isNew = !this.map.has(entry.key);
    this.map.set(entry.key, entry);
    return isNew;
  }
  async upsertMany(entries: DatasetEntry[]): Promise<number> {
    let added = 0;
    for (const e of entries) {
      if (await this.upsert(e)) added += 1;
    }
    return added;
  }
  async revision(): Promise<number> {
    return this.map.size;
  }
}

class FakeSource implements SourcePort {
  readonly id: string;
  readonly label = "FAKE";
  readonly kind = "news";
  readonly description = "fonte fake de teste";
  readonly capabilities: SourceCapability[] = ["news", "custom"];
  readonly rateLimit = { rps: 1, burst: 1 };

  constructor(id = "hackernews") {
    this.id = id;
  }

  async collect(options: CollectOptions): Promise<CollectResponse> {
    const items: NormalizedItem[] = [
      { id: `${options.query}-1`, source: this.id, kind: "article", title: `${options.query} #1`, url: `https://ex.test/1?q=${options.query}` },
      { id: `${options.query}-2`, source: this.id, kind: "article", title: `${options.query} #2`, url: `https://ex.test/2?q=${options.query}` },
    ].slice(0, options.limit ?? 2);
    return { source: this.id, query: options.query, items };
  }
}

const storage = new MemoryStorage();
const fakeAdapters = { hackernews: () => new FakeSource() };
const deps: AppDeps = { storage, keys: {}, adapters: fakeAdapters, port: 0, dataDir: ".data-test" };
const app = createApp(deps);

let server: Server;
let base: string;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.on("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object", "server deve escutar em porta efêmera");
  base = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

async function get(path: string): Promise<{ status: number; json: any }> {
  const resp = await fetch(`${base}${path}`);
  return { status: resp.status, json: await resp.json().catch(() => null) };
}

async function post(path: string, body: unknown): Promise<{ status: number; json: any }> {
  const resp = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: resp.status, json: await resp.json().catch(() => null) };
}

test("health", async () => {
  const { status, json } = await get("/api/health");
  assert.equal(status, 200);
  assert.equal(json.ok, true);
  assert.equal(json.name, "datareview-v4");
});

test("catalog: lista fontes com metadados completos", async () => {
  const { status, json } = await get("/api/catalog");
  assert.equal(status, 200);
  assert.ok(json.total >= 55, `catálogo deve ter >=55 fontes (tem ${json.total})`);
  const hn = json.sources.find((s: any) => s.id === "hackernews");
  assert.ok(hn, "hackernews deve estar no catálogo");
  assert.equal(hn.method, "api");
  assert.ok(Array.isArray(hn.params) && hn.params.length > 0);
  assert.ok(typeof json.byGroup === "object" && Object.keys(json.byGroup).length >= 5, "byGroup deve agregar grupos");
});

test("catalog: detalhe por id e por alias", async () => {
  const viaId = await get("/api/catalog/wikipedia");
  assert.equal(viaId.status, 200);
  assert.equal(viaId.json.entry.id, "wikipedia");
  const viaAlias = await get("/api/catalog/coingecko");
  assert.equal(viaAlias.status, 200);
  assert.equal(viaAlias.json.entry.id, "crypto");
  const missing = await get("/api/catalog/zzz");
  assert.equal(missing.status, 404);
});

test("audit: registry + categorias", async () => {
  const { status, json } = await get("/api/audit");
  assert.equal(status, 200);
  assert.ok(Array.isArray(json.entries) && json.entries.length >= 50);
  assert.ok(typeof json.categories === "object" && Object.keys(json.categories).length > 0);
});

test("dataset e stats começam vazios", async () => {
  const dataset = await get("/api/dataset");
  assert.equal(dataset.status, 200);
  assert.equal(dataset.json.total, 0);
  const stats = await get("/api/stats");
  assert.equal(stats.status, 200);
  assert.equal(stats.json.total, 0);
});

test("run: coleta uma fonte do catálogo e persiste no dataset", async () => {
  const { status, json } = await post("/api/run", { source: "hackernews", query: "typescript", limit: 2 });
  assert.equal(status, 200);
  assert.equal(json.source, "hackernews");
  assert.equal(json.added, 2);
  assert.equal(json.total, 2);
  assert.equal(json.response.error, undefined);
  assert.ok(Array.isArray(json.response.items));

  const dataset = await get("/api/dataset");
  assert.equal(dataset.status, 200);
  assert.equal(dataset.json.total, 2);
  assert.equal(dataset.json.entries[0].item.source, "hackernews");

  const stats = await get("/api/stats");
  assert.equal(stats.json.total, 2);
  assert.equal(stats.json.byKind.article, 2);
});

test("run: segunda coleta com a mesma query não duplica (dedup)", async () => {
  await post("/api/run", { source: "hackernews", query: "typescript", limit: 2 });
  const dataset = await get("/api/dataset");
  assert.equal(dataset.json.total, 2, "dedup por stableId deve impedir duplicatas");
});

test("run: validações de entrada", async () => {
  const noSource = await post("/api/run", { query: "x" });
  assert.equal(noSource.status, 400);
  const noQuery = await post("/api/run", { source: "hackernews" });
  assert.equal(noQuery.status, 400);
});

test("run: fonte fora do catálogo dá 404; fonte conhecida não portada dá 501", async () => {
  const unknown = await post("/api/run", { source: "zzz", query: "x" });
  assert.equal(unknown.status, 404);
  const unimplemented = await post("/api/run", { source: "youtube", query: "x" });
  assert.equal(unimplemented.status, 501);
  assert.equal(unimplemented.json.catalog.id, "youtube");
  assert.equal(unimplemented.json.catalog.status, "bridge");
});

test("pipeline: coleta + derive, IA ausente não bloqueia", async () => {
  const { status, json } = await post("/api/pipeline", { source: "hackernews", query: "rust", limit: 2 });
  assert.equal(status, 200);
  assert.equal(json.added, 2);
  assert.equal(json.aiResponse, null);
});

test("suggest-options: vocabulário disponível para o front", async () => {
  const { status, json } = await get("/api/suggest-options");
  assert.equal(status, 200);
  assert.ok(json.verticals.length >= 4);
  assert.ok(json.regions.length >= 12);
  assert.ok(json.groups.length >= 10);
  assert.ok(json.providers.length >= 5);
});

test("dataset: lookups por chave", async () => {
  const dataset = await get("/api/dataset");
  const key = dataset.json.entries[0].key;
  const found = await get(`/api/dataset/${encodeURIComponent(key)}`);
  assert.equal(found.status, 200);
  assert.equal(found.json.key, key);
  const missing = await get("/api/dataset/nao-existe");
  assert.equal(missing.status, 404);
});

test("derive: stats e hint após coleta", async () => {
  const { status, json } = await get("/api/derive");
  assert.equal(status, 200);
  assert.ok(json.stats.total >= 2);
  assert.ok(typeof json.hint === "string" && json.hint.length > 0);
});