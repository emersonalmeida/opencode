/**
 * Guarda das observações auditáveis no rawStore (briefing §2):
 * - extractSchema deriva chaves de objeto / 1º item de array (até 32);
 * - captureObservation grava com schema + confidence (array/objeto/null);
 * - listObservations filtra por fonte e é failure-safe (sem quebrar coleta).
 *
 * rawStore é server-side (fs). Testa com um diretório temporário via
 * RAW_STORE_DIR — sem tocar em data/raw do usuário.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("rawStore observations (server)", () => {
  const dir = mkdtempSync(join(tmpdir(), "rawstore-"));
  process.env.RAW_STORE_DIR = dir;

  it("extractSchema pega chaves de objeto e 1º item de array", async () => {
    const { extractSchema } = await import("../../server/lib/rawStore");
    expect(extractSchema({ title: "x", score: 1 })).toEqual(["title", "score"]);
    expect(extractSchema([{ title: "a", url: "u" }])).toEqual(["title", "url"]);
    expect(extractSchema(null)).toEqual([]);
    expect(extractSchema(["a", "b"])).toEqual([]);
  });

  it("captureObservation registra schema + confidence e list filtra", async () => {
    const rs = await import("../../server/lib/rawStore");
    const run = rs.startRun({
      sourceId: "suggest", collector: "test", collectorVersion: "1", params: { q: "app" },
    });
    const obs1 = rs.captureObservation({
      runId: run.id, sourceId: run.sourceId, endpoint: "suggest",
      params: { q: "app" }, payload: [{ q: "app" }, { q: "apple" }],
    });
    expect(obs1?.schema).toContain("q");
    expect(obs1?.confidence).toBe(1);
    rs.saveRawArtifact({
      runId: run.id, sourceId: run.sourceId, endpoint: "suggest",
      params: { q: "app" }, payload: { ok: true }, collector: "test", collectorVersion: "1",
    });
    const list = rs.listObservations("suggest");
    expect(list.some((o) => o.endpoint === "suggest")).toBe(true);
    expect(rs.listObservations("web").every((o) => o.sourceId === "web")).toBe(true);
    rs.finishRun(run, { status: "completed", yielded: 2 });
  });

  it("failure-safe: diretório inválido não quebra a coleta", async () => {
    const rs = await import("../../server/lib/rawStore");
    process.env.RAW_STORE_DIR = "/definitely/invalid/path\0bad";
    expect(rs.captureObservation({
      runId: "r", sourceId: "x", endpoint: "e", params: {}, payload: {},
    })).toBeNull();
    process.env.RAW_STORE_DIR = dir;
  });

  it("cleanup", () => {
    rmSync(dir, { recursive: true, force: true });
  });
});
