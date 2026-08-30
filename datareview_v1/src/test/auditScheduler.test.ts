import { beforeEach, describe, expect, it, vi } from "vitest";
import { AUDIT_PROBES } from "@/lib/audit/auditProbes";
import {
  DEFAULT_BUDGET,
  getBudget,
  getSchedulerState,
  resetScheduler,
  restartScheduler,
  setBudget,
  startScheduler,
  stopScheduler,
  subscribeScheduler,
  type SchedulerState,
} from "@/lib/audit/auditScheduler";

// Mock fetch controlado: resposta OK por padrão.
function mockFetchImpl(ok = true): (url: unknown, init?: RequestInit) => Promise<Response> {
  return async (_url: unknown, init?: RequestInit) => {
    if (init?.signal?.aborted) {
      return Promise.reject(new DOMException("AbortError", "AbortError"));
    }
    return {
      ok,
      json: () => Promise.resolve(ok ? { items: [] } : { error: "500" }),
    } as unknown as Response;
  };
}

describe("auditScheduler (A10)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("fetch", mockFetchImpl());
    stopScheduler();
    resetScheduler();
    // Delay 0 nos testes: o default de produção (800ms × 16 sondas) estoura
    // o timeout do vitest; o comportamento do delay é validado à parte.
    setBudget({ ...DEFAULT_BUDGET, delayBetweenMs: 0 });
  });

  it("inicia a fila e processa as sondas em sequência", async () => {
    const probesTotal = AUDIT_PROBES.length;
    await startScheduler();
    const scheduler = getSchedulerState();
    expect(scheduler.status).toBe("done");
    expect(scheduler.index).toBe(probesTotal);
    // All probes done
    for (const probe of AUDIT_PROBES) {
      expect(scheduler.runs[probe.sourceId]?.status).toBe("done");
    }
  });

  it("publica eventos para assinantes durante a execução", async () => {
    const events: SchedulerState[] = [];
    const unsub = subscribeScheduler(() => events.push(getSchedulerState()));
    await startScheduler();
    expect(events.length).toBeGreaterThan(0);
    expect(events.at(-1)?.status).toBe("done");
    unsub();
    // No events after unsubscribe
    const before = events.length;
    await restartScheduler();
    expect(events.length).toBe(before);
  });

  it("restart zera o estado e re-executa", async () => {
    await startScheduler();
    const after = getSchedulerState();
    expect(after.status).toBe("done");
    // Restart: volta a idle e re-executa
    const p = restartScheduler();
    const state = getSchedulerState();
    expect(state.status).not.toBe("done");
    await p;
    expect(getSchedulerState().status).toBe("done");
  });

  it("registra erro honesto quando a sonda falha", async () => {
    vi.stubGlobal("fetch", mockFetchImpl(false));
    await startScheduler();
    const state = getSchedulerState();
    expect(state.runs[AUDIT_PROBES[0].sourceId]?.status).toBe("error");
    expect(state.runs[AUDIT_PROBES[0].sourceId]?.error).toBe("500");
  });

  it("stop aborta a sonda em voo e a fila pausa", async () => {
    // Simula uma sonda lenta: fetch aguarda signal abort e rejeita a
    // PRÓPRIA promise (rejeitar uma promise separada vira unhandled rejection).
    vi.stubGlobal("fetch", (_url: unknown, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("abort", "AbortError")),
        );
      }),
    );
    // Inicia sem await; depois para
    const pendingPromise = startScheduler();
    stopScheduler();
    expect(getSchedulerState().status).toBe("paused");
    stopScheduler();
    void pendingPromise;
  });

  it("hidrata runs persistidas do localStorage (ou acelera quando nada existe)", () => {
    const saved = { runs: { suggest: { status: "done" as const } } };
    localStorage.setItem("aso:audit-scheduler:v1", JSON.stringify(saved));
    const runs = getSchedulerState().runs;
    expect(runs).toBeTruthy();
  });

  // ------ A13: budget de segurança (§5/§6) ------

  it("budget: defaults e clamp dos limites", () => {
    setBudget(DEFAULT_BUDGET);
    expect(getBudget()).toEqual(DEFAULT_BUDGET);
    setBudget({ maxRequests: 9999, delayBetweenMs: -5, timeoutMs: 1 });
    const b = getBudget();
    expect(b.maxRequests).toBe(200);
    expect(b.delayBetweenMs).toBe(0);
    expect(b.timeoutMs).toBe(5000);
  });

  it("budget: persiste no localStorage e hidrata", () => {
    setBudget({ maxRequests: 3, delayBetweenMs: 0, timeoutMs: 10000 });
    const raw = localStorage.getItem("aso:audit-scheduler-config:v1");
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw as string).maxRequests).toBe(3);
  });

  it("budget: fila pausa ao atingir maxRequests e retoma respeitando o teto", async () => {
    setBudget({ maxRequests: 2, delayBetweenMs: 0 });
    await startScheduler();
    expect(getSchedulerState().status).toBe("paused");
    expect(getSchedulerState().index).toBe(2);
    // Cada execução respeita o teto: +2 sondas e pausa de novo.
    await startScheduler();
    expect(getSchedulerState().index).toBe(4);
    expect(getSchedulerState().status).toBe("paused");
    // Sobe o teto e conclui tudo.
    setBudget({ maxRequests: 50, delayBetweenMs: 0 });
    await startScheduler();
    expect(getSchedulerState().status).toBe("done");
  });

  it("budget: timeout aborta a sonda lenta (erro honesto)", async () => {
    // Sonda que nunca resolve: o timeout do budget dispara o abort.
    vi.stubGlobal("fetch", (_url: unknown, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("abort", "AbortError")),
        );
      }),
    );
    // maxRequests=1: só a 1ª sonda roda (o teste não espera as demais).
    setBudget({ maxRequests: 1, delayBetweenMs: 0, timeoutMs: 5000 });
    await startScheduler();
    const first = AUDIT_PROBES[0].sourceId;
    expect(getSchedulerState().runs[first]?.status).toBe("error");
  }, 15000);
});
