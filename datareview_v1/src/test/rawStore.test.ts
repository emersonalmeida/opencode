// @vitest-environment node
/**
 * Testes da camada RAW imutável (server/lib/rawStore).
 * Usa RAW_STORE_DIR apontado para um tmpdir isolado por suite, criado e
 * removido em beforeEach/afterEach — nunca toca o diretório real de dados.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  hashPayload,
  startRun,
  finishRun,
  saveRawArtifact,
  listArtifacts,
  listRunEvents,
  type RawArtifact,
} from "../../server/lib/rawStore";

let tmp: string;
const OLD_ENV = process.env.RAW_STORE_DIR;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rawstore-"));
  process.env.RAW_STORE_DIR = tmp;
});

afterEach(() => {
  if (OLD_ENV === undefined) delete process.env.RAW_STORE_DIR;
  else process.env.RAW_STORE_DIR = OLD_ENV;
  fs.rmSync(tmp, { recursive: true, force: true });
});

function makeRun() {
  return startRun({
    sourceId: "apple",
    subjectKey: "apple:app:814456780",
    collector: "apple-reviews",
    collectorVersion: "1",
    params: { appId: "814456780", country: "br", maxReviews: 100 },
    requested: 100,
  });
}

describe("rawStore — raw artifacts imutáveis + collection runs", () => {
  it("hashPayload é determinístico e sha256", () => {
    const payload = { a: 1, b: [2, 3] };
    const h1 = hashPayload(payload);
    const h2 = hashPayload({ a: 1, b: [2, 3] });
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    expect(hashPayload(payload)).not.toBe(hashPayload({ a: 2 }));
  });

  it("startRun registra o evento de início com params/status running", () => {
    const run = makeRun();
    expect(run.id).toMatch(/^run_/);
    expect(run.status).toBe("running");
    const events = listRunEvents();
    expect(events.length).toBe(1);
    expect(events[0].event).toBe("start");
    expect(events[0].run.id).toBe(run.id);
    expect(events[0].run.params).toMatchObject({ appId: "814456780" });
  });

  it("saveRawArtifact grava JSONL imutável com hash, bytes e provenance", () => {
    const run = makeRun();
    const art = saveRawArtifact({
      runId: run.id,
      sourceId: "apple",
      subjectKey: "apple:app:814456780",
      endpoint: "apple-reviews",
      url: "https://apps.apple.com/api/apps/v1/catalog/br/apps/814456780/reviews",
      params: { maxReviews: 100 },
      payload: { reviews: [{ id: "r1", rating: 5, text: "ótimo" }], count: 1 },
      collector: "apple-reviews",
      collectorVersion: "1",
    });
    expect(art).not.toBeNull();
    const cast = art as RawArtifact;
    expect(cast.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(cast.bytes).toBeGreaterThan(0);
    expect(cast.runId).toBe(run.id);
    expect(cast.collector).toBe("apple-reviews");

    const file = path.join(tmp, "artifacts.jsonl");
    expect(fs.existsSync(file)).toBe(true);
    const back = listArtifacts();
    expect(back.length).toBe(1);
    expect(back[0].id).toBe(cast.id);
    // Imutabilidade: gravar outro artifact NÃO edita o anterior (append-only).
    saveRawArtifact({
      runId: run.id,
      sourceId: "apple",
      endpoint: "apple-reviews",
      params: {},
      payload: { reviews: [] },
      collector: "apple-reviews",
      collectorVersion: "1",
    });
    const all = listArtifacts();
    expect(all.length).toBe(2);
    expect(all[1].id).toBe(cast.id); // o primeiro continua intacto
  });

  it("finishRun registra status/yield/errors da coleta", () => {
    const run = makeRun();
    finishRun(run, {
      status: "partial",
      yielded: 42,
      errors: [{ endpoint: "amp-api", message: "HTTP 429" }],
    });
    const events = listRunEvents();
    const finish = events.find((e) => e.event === "finish");
    expect(finish).toBeDefined();
    expect(finish?.run.status).toBe("partial");
    expect(finish?.run.yielded).toBe(42);
    expect(finish?.run.errors[0].message).toContain("429");
    expect(finish?.run.finishedAt).toBeGreaterThan(0);
  });

  it("listArtifacts/listRunEvents retornam mais recentes primeiro", () => {
    const run = makeRun();
    finishRun(run, { status: "completed", yielded: 0 });
    const events = listRunEvents();
    expect(events[0].event).toBe("finish");
    expect(events[1].event).toBe("start");
  });

  it("é failure-safe: RAW_STORE_DIR inválido não quebra a coleta", () => {
    // aponta para um ARQUIVO (mkdir recursive falha) — deve só logar warn
    const blocker = path.join(tmp, "blocker");
    fs.writeFileSync(blocker, "x");
    process.env.RAW_STORE_DIR = blocker;
    const run = startRun({
      sourceId: "google",
      collector: "google-play",
      collectorVersion: "1",
      params: {},
    });
    const art = saveRawArtifact({
      runId: run.id,
      sourceId: "google",
      endpoint: "google-play",
      params: {},
      payload: { ok: true },
      collector: "google-play",
      collectorVersion: "1",
    });
    finishRun(run, { status: "completed", yielded: 1 });
    // não lançou exceção; artifact retorna null em falha de I/O
    expect(art).toBeNull();
    expect(run.status).toBe("completed");
  });
});
