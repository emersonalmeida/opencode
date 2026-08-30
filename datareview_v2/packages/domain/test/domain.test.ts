/**
 * Testes do núcleo puro (node:test nativo — zero framework).
 *
 * Cobrem as regras que NUNCA podem quebrar:
 *  - deduplicação por id estável (mesmo item duas vezes = 1 no dataset)
 *  - derivação determinística (stats por fonte/tipo, busca acento-insensível)
 *  - orquestrador fonte-agnóstico (pipeline chama adaptador+storage, sem
 *    conhecer nenhuma fonte concreta)
 */
import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import type { CollectOptions, CollectResponse, DatasetEntry, NormalizedItem } from "@v2/contracts";
import { derive, normalizeText, runPipeline, runSource, stableId } from "../src/index.js";
import type { AIPort, SourcePort, StoragePort } from "../src/index.js";

/* ------------------------------------------------------------- fakes --- */

/** Storage em memória — implementa StoragePort sem I/O. */
class MemoryStorage implements StoragePort {
  private entries = new Map<string, DatasetEntry>();
  private rev = 0;

  async list(): Promise<DatasetEntry[]> {
    return [...this.entries.values()].sort((a, b) => b.collectedAt - a.collectedAt);
  }
  async get(key: string): Promise<DatasetEntry | undefined> {
    return this.entries.get(key);
  }
  async upsert(entry: DatasetEntry): Promise<boolean> {
    const isNew = !this.entries.has(entry.key);
    this.entries.set(entry.key, entry);
    this.rev++;
    return isNew;
  }
  async upsertMany(entries: DatasetEntry[]): Promise<number> {
    let added = 0;
    for (const e of entries) {
      if (await this.upsert(e)) added++;
    }
    return added;
  }
  async revision(): Promise<number> {
    return this.rev;
  }
}

/** Fonte fake — retorna itens fixos. */
function fakeSource(items: NormalizedItem[] = defaultItems, fail =false): SourcePort {
  return {
    id: "fake",
    label: "Fake",
    kind: "test",
    description: "fonte de teste",
    capabilities: ["search"],
    rateLimit: { rps: 10, burst: 5 },
    async collect(options: CollectOptions): Promise<CollectResponse> {
      if (fail) return { source: "fake", query: options.query, items: [], error: "HTTP 500" };
      return { source: "fake", query: options.query, items };
    },
  };
}

const defaultItems: NormalizedItem[] = [
  { id: "1", source: "fake", kind: "post", title: "Primeiro item", author: "ana", score: 5, meta: { rawKind: "post" } },
  { id: "2", source: "fake", kind: "post", title: "Segundo item", author: "bob" },
];

/* -------------------------------------------------------------- testes --- */

describe("stableId", () => {
  test("prioriza id explícito e URL; cai para hash quando ausentes", () => {
    assert.equal(stableId({ id: "x", source: "s", kind: "k", title: "t" }), "s#x");
    assert.equal(
      stableId({ id: "", source: "s", kind: "k", title: "t", url: "https://a.com/1" }),
      "s#https://a.com/1",
    );
    const a = stableId({ id: "", source: "s", kind: "k", title: "t", text: "corpo" });
    const b = stableId({ id: "", source: "s", kind: "k", title: "t", text: "corpo" });
    assert.equal(a, b);
    const c = stableId({ id: "", source: "s", kind: "k", title: "OUTRO", text: "corpo" });
    assert.notEqual(a, c);
  });

 test("hash de conteúdo é determinístico e estável entre execuções", () => {
    assert.equal(
      stableId({ id: "", source: "s", kind: "k", title: "t", text: "corpo" }),
      "s#884e14be",
    );
    const s1 = stableId({ id: "", source: "s", kind: "k", title: "olá mundo", text: "x" });
    const s2 = stableId({ id: "", source: "s", kind: "k", title: "olá mundo", text: "x" });
    assert.equal(s1, s2);
  });
});

describe("derive", () => {
  test("computeStats agrupa por fonte e tipo", () => {
    const list: DatasetEntry[] = [
      { key: "a", item: { id: "a", source: "hn", kind: "post", title: "t1", score: 10 }, collectedAt: 100 },
      { key: "b", item: { id: "b", source: "hn", kind: "post", title: "t2" }, collectedAt: 200 },
      { key: "c", item: { id: "c", source: "devto", kind: "article", title: "t3", score: 5 }, collectedAt:  300 },
    ];
    const stats = derive.stats(list);
    assert.equal(stats.total, 3);
    assert.equal(stats.bySource.hn, 2);
    assert.equal(stats.bySource.devto, 1);
    assert.equal(stats.byKind.post, 2);
    assert.equal(stats.withScore, 2);
  });

  test("contextHint é determinístico e inclui fonte", () => {
    const list: DatasetEntry[] = [
      { key: "a", item: { id: "a", source: "hn", kind: "post", title: "titulo", author: "x" }, collectedAt: 100 },
    ];
    const hint = derive.contextHint(list);
    assert.ok(hint.includes("DATASET: 1 itens"));
    assert.ok(hint.includes("[hn] titulo"));
  });

  test("search é acento-insensível e por tokens", () => {
    const list: DatasetEntry[] = [
      { key: "a", item: { id: "a", source: "x", kind: "post", title: "Análise do Cafeeiro", author: "Jose" }, collectedAt:  100 },
    ];
    assert.equal(derive.search(list, "analise cafeeiro").length, 1);
    assert.equal(derive.search(list, "xyz").length, 0);
    assert.equal(normalizeText(" OLÁ "),"ola");
  });
});

describe("pipeline", () => {
  test("runSource deduplica por id estavel e persiste", async () => {
    const storage = new MemoryStorage();
    const source = fakeSource();
    const r1 = await runSource(source, { query: "q" }, { storage });
    const r2 = await runSource(source, { query: "q" }, { storage });

    // 1a rodada: 2 itens novos; 2a: mesmos ids ja no storage.
    assert.equal(r1.added, 2);
    assert.equal(r2.added, 0);
    assert.equal((await storage.list()).length, 2);
    assert.ok((await storage.revision()) > 0);
  });

  test("runSource reporta erro estruturado sem lançar", async () => {
    const storage = new MemoryStorage();
    const run = await runSource(fakeSource(defaultItems, true), { query: "q" }, { storage });
    assert.equal(run.response.error, "HTTP 500");
    assert.equal(run.added, 0);
  });

  test("runPipeline chama IA quando há itens e storage povoado", async () => {
    const storage = new MemoryStorage();
    const calls: string[] = [];
    const ai: AIPort = {
      async chat(request) {
        calls.push(request.messages.map((m) => m.role).join(","));
        return "resposta da IA";
      },
    };
    const run = await runPipeline(fakeSource(), { query: "q" }, { storage, ai });
    assert.equal(run.aiResponse, "resposta da IA");
    assert.deepEqual(calls, ["system,user"]);
  });

  test("runPipeline NÃO chama IA quando a fonte falha", async () => {
    const storage = new MemoryStorage();
    let called = false;
    const ai: AIPort = {
      async chat() {
        called = true;
        return "";
      },
    };
    const run = await runPipeline(fakeSource(defaultItems, true), { query: "q" }, { storage, ai });
    assert.equal(run.aiResponse, undefined);
    assert.equal(called, false);
  });
});
