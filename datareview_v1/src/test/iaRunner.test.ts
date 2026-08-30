// @vitest-environment jsdom
/**
 * Testes da fila global de IA (iaRunner): gerenciamento de estado, persistência
 * e a semântica de interrupção/retomada (refresh da página = pausa; job
 * "running" volta a "pending"; jobs "done" são preservados na retomada).
 * O streaming em si (rede) não é exercitado aqui — só o estado da fila.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  enqueueJobs, clearQueue, resetQueue, pauseQueue, getIAQueue,
  hasResumableQueue, queueCounts, type IAJob,
} from "@/lib/iaRunner";

const job = (id: string): IAJob => ({ id, label: id, kind: "section", section: "summary" });

beforeEach(() => {
  clearQueue();
});

describe("iaRunner — enfileiramento", () => {
  it("enqueue adiciona jobs como pending e pausa a fila", () => {
    enqueueJobs([job("a"), job("b")]);
    const q = getIAQueue();
    expect(q.jobs.map((j) => j.id)).toEqual(["a", "b"]);
    expect(q.results).toEqual({ a: "pending", b: "pending" });
    expect(q.status).toBe("paused");
    expect(hasResumableQueue()).toBe(true);
  });

  it("replace preserva resultados 'done' de jobs com o mesmo id (retomada)", () => {
    // Simula estado previamente concluído via seed + reimport
    localStorage.setItem("aso:ia-runner:v1", JSON.stringify({
      jobs: [job("a")], results: { a: "done" }, status: "done", current: -1, updatedAt: 1,
    }));
    vi.resetModules();
    return import("@/lib/iaRunner").then((mod) => {
      mod.enqueueJobs([job("a"), job("b")], "replace");
      const q = mod.getIAQueue();
      expect(q.results.a).toBe("done"); // preservado
      expect(q.results.b).toBe("pending"); // novo
    });
  });

  it("resetQueue zera resultados (recomeçar do zero) sem remover jobs", () => {
    enqueueJobs([job("a"), job("b")]);
    resetQueue();
    const q = getIAQueue();
    expect(q.jobs).toHaveLength(2);
    expect(Object.values(q.results).every((r) => r === "pending")).toBe(true);
  });

  it("clearQueue esvazia a fila e volta a idle", () => {
    enqueueJobs([job("a")]);
    clearQueue();
    const q = getIAQueue();
    expect(q.jobs).toHaveLength(0);
    expect(q.status).toBe("idle");
    expect(hasResumableQueue()).toBe(false);
  });

  it("pauseQueue marca fila como pausada", () => {
    enqueueJobs([job("a")]);
    pauseQueue();
    expect(getIAQueue().status).toBe("paused");
  });

  it("queueCounts conta done/error/pending corretamente", () => {
    enqueueJobs([job("a"), job("b"), job("c")]);
    const c = queueCounts();
    expect(c).toEqual({ total: 3, done: 0, error: 0, pending: 3 });
  });
});

describe("iaRunner — persistência e refresh", () => {
  it("persiste a fila em aso:ia-runner:v1", () => {
    enqueueJobs([job("x")]);
    const raw = localStorage.getItem("aso:ia-runner:v1");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.jobs[0].id).toBe("x");
  });

  it("refresh: job 'running' volta a pending e fila pausada (interrupção)", async () => {
    localStorage.setItem("aso:ia-runner:v1", JSON.stringify({
      jobs: [job("a"), job("b")],
      results: { a: "done", b: "running" },
      status: "running",
      current: 1,
      updatedAt: 1,
    }));
    vi.resetModules();
    const mod = await import("@/lib/iaRunner");
    const q = mod.getIAQueue();
    expect(q.results.a).toBe("done");
    expect(q.results.b).toBe("pending"); // running → pending (interrompido)
    expect(q.status).toBe("paused"); // running → paused (retomável)
    expect(q.current).toBe(-1);
    expect(mod.hasResumableQueue()).toBe(true);
  });

  it("refresh: fila 100% concluída vira done (nada a retomar)", async () => {
    localStorage.setItem("aso:ia-runner:v1", JSON.stringify({
      jobs: [job("a")], results: { a: "done" }, status: "running", current: 0, updatedAt: 1,
    }));
    vi.resetModules();
    const mod = await import("@/lib/iaRunner");
    expect(mod.getIAQueue().status).toBe("done");
    expect(mod.hasResumableQueue()).toBe(false);
  });

  it("storage corrompido → fila vazia (nunca quebra a importação)", async () => {
    localStorage.setItem("aso:ia-runner:v1", "{não é json");
    vi.resetModules();
    const mod = await import("@/lib/iaRunner");
    expect(mod.getIAQueue().jobs).toHaveLength(0);
  });
});
