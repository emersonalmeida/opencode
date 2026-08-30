// @vitest-environment jsdom
/**
 * Concorrência de IA — worker pool do iaRunner + configurações.
 *
 * O streaming é mockado: cada chamada conta quantos streams estão ativos
 * ao mesmo tempo (inFlight/maxFlight), permitindo provar que o pool roda
 * em paralelo no modo "parallel" e um-por-vez no "sequential", e que a
 * pausa aborta TODOS os streams em voo.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

let inFlight = 0;
let maxFlight = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

vi.mock("@/lib/experimentApi", () => ({
  streamExperiment: async (
    _section: string,
    _apps: unknown,
    handlers: { onDone: (t: string) => void },
    signal?: AbortSignal,
  ) => {
    inFlight++; maxFlight = Math.max(maxFlight, inFlight);
    await sleep(30);
    inFlight--;
    if (!signal?.aborted) handlers.onDone("ok");
  },
}));
vi.mock("@/lib/experimentChatApi", () => ({
  streamExperimentChat: async (
    _apps: unknown,
    _msgs: unknown,
    handlers: { onDone: (t: string) => void },
    signal?: AbortSignal,
  ) => {
    inFlight++; maxFlight = Math.max(maxFlight, inFlight);
    await sleep(30);
    inFlight--;
    if (!signal?.aborted) handlers.onDone("ok");
  },
}));

import {
  enqueueJobs, clearQueue, startQueue, getIAQueue, pauseQueue,
  setAppsResolverForTests, type IAJob,
} from "@/lib/iaRunner";
import {
  setConcurrencyMode, setMaxConcurrent, getAISettings,
  clampMaxConcurrent, isParallelIA, setAIMode,
} from "@/lib/aiSettings";
import type { DatasetEntry } from "@/lib/datasetStore";

const job = (id: string): IAJob => ({ id, label: id, kind: "section", section: "summary" });
const fakeEntry = {
  app: { store: "apple", id: "1", name: "App" },
  reviews: [],
  collectedAt: 1,
} as unknown as DatasetEntry;

beforeEach(() => {
  localStorage.clear();
  inFlight = 0;
  maxFlight = 0;
  clearQueue();
  setAppsResolverForTests(() => [fakeEntry]);
  // O default do sistema é SEM IA (mode "none") — a fila exige IA ativa.
  setAIMode("local");
  setConcurrencyMode("parallel");
  setMaxConcurrent(3);
});

describe("iaRunner — worker pool paralelo", () => {
  it("modo parallel: roda múltiplos jobs ao mesmo tempo (até maxConcurrent)", async () => {
    enqueueJobs([job("a"), job("b"), job("c"), job("d"), job("e")]);
    await startQueue();
    const q = getIAQueue();
    expect(q.jobs.every((j) => q.results[j.id] === "done")).toBe(true);
    expect(q.status).toBe("done");
    expect(maxFlight).toBeGreaterThan(1);
    expect(maxFlight).toBeLessThanOrEqual(3);
  });

  it("maxConcurrent=2 limita o pico de streams simultâneos", async () => {
    setMaxConcurrent(2);
    enqueueJobs([job("a"), job("b"), job("c"), job("d")]);
    await startQueue();
    expect(maxFlight).toBeLessThanOrEqual(2);
    expect(maxFlight).toBeGreaterThan(1);
  });

  it("modo sequential: um stream por vez (pico 1)", async () => {
    setConcurrencyMode("sequential");
    enqueueJobs([job("a"), job("b"), job("c")]);
    await startQueue();
    expect(maxFlight).toBe(1);
    const q = getIAQueue();
    expect(q.jobs.every((j) => q.results[j.id] === "done")).toBe(true);
  });

  it("pauseQueue aborta TODOS os streams em voo e volta jobs a pending", async () => {
    enqueueJobs([job("a"), job("b"), job("c")]);
    const promise = startQueue();
    await sleep(5); // garante que os 3 entraram em voo
    pauseQueue();
    await promise;
    const q = getIAQueue();
    expect(q.status).toBe("paused");
    expect(Object.values(q.results).every((r) => r === "pending")).toBe(true);
  });

  it("retomada após pausa executa o que faltava (jobs done são pulados)", async () => {
    enqueueJobs([job("a"), job("b"), job("c")]);
    const p1 = startQueue();
    await sleep(5);
    pauseQueue();
    await p1;
    await startQueue(); // retoma
    const q = getIAQueue();
    expect(q.status).toBe("done");
    expect(Object.values(q.results).every((r) => r === "done")).toBe(true);
  });
});

describe("aiSettings — configuração de concorrência", () => {
  it("defaults: parallel com 3 simultâneos", () => {
    const s = getAISettings();
    expect(s.concurrencyMode).toBe("parallel");
    expect(s.maxConcurrent).toBe(3);
    expect(isParallelIA(s)).toBe(true);
  });

  it("clampMaxConcurrent: limita 1–8 com fallback 3", () => {
    expect(clampMaxConcurrent(0)).toBe(1);
    expect(clampMaxConcurrent(99)).toBe(8);
    expect(clampMaxConcurrent(2)).toBe(2);
    expect(clampMaxConcurrent(NaN)).toBe(3);
    expect(clampMaxConcurrent("x")).toBe(3);
  });

  it("setConcurrencyMode/setMaxConcurrent persistem e isParallelIA reflete", () => {
    setConcurrencyMode("sequential");
    expect(isParallelIA()).toBe(false);
    setConcurrencyMode("parallel");
    setMaxConcurrent(1);
    expect(isParallelIA()).toBe(false); // 1 simultâneo = comportamento sequencial
    setMaxConcurrent(4);
    expect(isParallelIA()).toBe(true);
  });

  it("storage antigo (sem os campos novos) migra para os defaults", () => {
    localStorage.setItem("aso:ai-settings:v1", JSON.stringify({ mode: "local" }));
    const s = getAISettings();
    expect(s.concurrencyMode).toBe("parallel");
    expect(s.maxConcurrent).toBe(3);
  });
});
