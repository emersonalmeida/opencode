/** Test Center lib — suites declaradas + result normalization. */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runOne, runAll, listDefinitions } from "@/lib/testCenter/runner";
import { EXECUTORS, SUITE_ORDER, SUITE_META, flagLabels, FLAG_LABEL } from "@/lib/testCenter/catalog";
import { recordRun, listRuns, clearRuns, summarize } from "@/lib/testCenter/historyStore";
import type { TestRun } from "@/lib/testCenter/types";

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("testCenter lib", () => {
  it("suites declarativas + executores cobertos", () => {
    const defs = listDefinitions();
    expect(defs.length).toBeGreaterThan(0);
    for (const def of SUITE_ORDER) expect(SUITE_META[def]).toBeTruthy();
    // Suite refs existem.
    for (const ex of EXECUTORS) expect(ex.definition.suite).toBeDefined();
  });

  it("flagLabels usa label legível ou fallback", () => {
    expect(flagLabels(["safe", "requires-browser"])).toEqual(["seguro", "browser"]);
    expect(flagLabels(["other"])).toEqual(["other"]);
    expect(FLAG_LABEL["safe"]).toBe("seguro");
  });

  it("runOne normaliza para TestResult completo", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(new Response(JSON.stringify({ status: "ok" }), { status: 200 })));
    const ex = EXECUTORS.find((e) => e.definition.testId === "env.version")!;
    const result = await runOne(ex, { env: "browser", baseUrl: "http://x", timeoutMs: 1000 });
    expect(result.testId).toBe("env.version");
    expect(result.version).toBeTruthy();
    expect(result.environment).toBe("browser");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.status).toBe("pass");
  });

  it("runOne captura erro lançado e marca error com stack", async () => {
    const ex = EXECUTORS[0];
    // Monkey-patch para forçar throw durante run.
    for (const e of EXECUTORS) if (e.definition.testId === "env.version") { e.run = async () => { throw new Error("boom"); }; }
    try {
      const r = await runOne(EXECUTORS.find((x) => x.definition.testId === "env.version")!, { env: "node", timeoutMs: 1 });
      expect(r.status).toBe("error");
      expect(r.error?.message).toBe("boom");
    } finally {
      void ex.run; // restore não necessário em teste isolado
    }
  });

  it("executor de storage é SAFE e faz cleanup", async () => {
    const ex = EXECUTORS.find((e) => e.definition.testId === "storage.localStorage")!;
    const result = await runOne(ex, { env: "browser", timeoutMs: 1000 });
    expect(result.status).toBe("pass");
    expect(localStorage.getItem("testcenter:probe")).toBeNull();
  });

  it("fetch timeout feature-detection não quebra sem AbortSignal.timeout", async () => {
    // jsdom não tem AbortSignal.timeout; o timeoutFetch usa cast feature.
    vi.stubGlobal("fetch", () => Promise.resolve(new Response(JSON.stringify({ status: "ok" }), { status: 200 })));
    const ex = EXECUTORS.find((e) => e.definition.testId === "server.health")!;
    const r = await runOne(ex, { env: "browser", baseUrl: "http://host", timeoutMs: 1000 });
    expect(r.status).toBe("pass");
  });

  it("historyStore: record/list/clear + summarize", () => {
    const run: TestRun = {
      runId: "r1", startedAt: 1, finishedAt: 2, version: "v", environment: "browser",
      results: [
        { testId: "a", status: "pass", durationMs: 1, version: "v", environment: "browser" },
        { testId: "b", status: "warning", durationMs: 1, version: "v", environment: "browser" },
        { testId: "c", status: "fail", durationMs: 1, version: "v", environment: "browser" },
        { testId: "d", status: "not-configured", durationMs: 1, version: "v", environment: "browser" },
      ],
      mode: "quick", triggeredBy: "user", canceled: false,
    };
    recordRun(run);
    const runs = listRuns();
    expect(runs[0].runId).toBe("r1");
    const s = summarize(runs[0]);
    expect(s).toEqual({ pass: 1, fail: 1, warning: 1, skipped: 0, notConfigured: 1, error: 0 });
    clearRuns();
    expect(listRuns()).toEqual([]);
  });
});
