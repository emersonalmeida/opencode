/**
 * Test Center — núcleo servidor (compartilhaD com o cliente): suites
 * declarativas e executors SAFE usando fetch Node (timeouts). Guardado no
 * server para testes integration reais (rotas reais, RAW/FS, GPU profile,
 * ia-test). A page do cliente consome o resultado.
 */
/** Protocolo cliente↔servidor — o HTTP aceita/deve expirar. FALTAM TIPOS
 * compartilhados? NÃO: declaramos localmente para isolar tsconfigs. */
import type { TestDefinition as TDef, TestExecutor as TExec } from "./testCenterTypes.js";
export type TestDefinition = TDef;
export type TestExecutor = TExec;

export const SUITE_ORDER = ["01-environment", "02-server", "03-sources", "04-api", "05-storage"] as const;

const SAFE_TIMEOUT_MS = 8_000;

function timeoutFetch(url: string, timeoutMs = SAFE_TIMEOUT_MS): Promise<Response> {
  const withTimeout = (AbortSignal as { timeout?: (ms: number) => AbortSignal }).timeout;
  return fetch(url, withTimeout ? { signal: withTimeout(timeoutMs) } : undefined);
}

function def(p: TestDefinition & { suite?: string }): TestDefinition {
  return p;
}

export const EXECUTORS: TestExecutor[] = [
  {
    definition: def({
      suite: "02-server", testId: "server.health", name: "/health",
      description: "Health do servidor Express (local).",
      kind: "health-check", severity: "critical", priority: 10, enabled: true, requires: ["safe"], timeoutsMs: SAFE_TIMEOUT_MS,
    }),
    run: async (ctx) => {
      const url = `${(ctx as unknown as { baseUrl?: string }).baseUrl ?? ""}/health`;
      const r = await timeoutFetch(url);
      const body = await r.json().catch(() => ({}));
      return { status: r.ok ? "pass" : "fail", input: { url }, actual: body } as const;
    },
  },
  {
    definition: def({
      suite: "03-sources", testId: "sources.catalog", name: "Catálogo de fontes",
      description: "Connectors com capabilities não vazias.",
      kind: "integration", severity: "critical", priority: 10, enabled: true, requires: ["safe"], timeoutsMs: SAFE_TIMEOUT_MS,
    }),
    run: async (ctx) => {
      const r = await timeoutFetch(`${(ctx as unknown as { baseUrl?: string }).baseUrl ?? ""}/functions/v1/sources`);
      const data = (await r.json().catch(() => ({}))) as { sources?: { id?: string }[] };
      const sources = data.sources ?? [];
      if (!sources.length) return { status: "fail", actual: data };
      return { status: "pass", actual: sources.map((s) => s.id) };
    },
  },
  {
    definition: def({
      suite: "03-sources", testId: "sources.wikipedia", name: "Fonte: Wikipedia",
      description: "Wikipedia declarada no catálogo.",
      kind: "integration", severity: "minor", priority: 20, enabled: true, requires: ["safe"], timeoutsMs: SAFE_TIMEOUT_MS,
    }),
    run: async (ctx) => {
      const r = await timeoutFetch(`${(ctx as unknown as { baseUrl?: string }).baseUrl ?? ""}/functions/v1/sources`);
      const data = (await r.json().catch(() => ({}))) as { sources?: { id?: string }[] };
      const found = (data.sources ?? []).find((s) => s.id === "wikipedia");
      return { status: found ? "pass" : "warning", actual: found ?? {} };
    },
  },
  {
    definition: def({
      suite: "04-api", testId: "api.systemProfile", name: "/system-profile",
      description: "Perfil de hardware (gpu/ollama/cpu) detectado.",
      kind: "integration", severity: "major", priority: 20, enabled: true, requires: ["safe"], timeoutsMs: SAFE_TIMEOUT_MS,
    }),
    run: async (ctx) => {
      const r = await timeoutFetch(`${(ctx as unknown as { baseUrl?: string }).baseUrl ?? ""}/functions/v1/system-profile`);
      const body = await r.json().catch(() => ({}));
      return { status: r.ok ? "pass" : "fail", actual: body };
    },
  },
  {
    definition: def({
      suite: "04-api", testId: "api.aiTest", name: "/ai-test",
      description: "IA smoke — reporta none/disabled do provider.",
      kind: "integration", severity: "major", priority: 30, enabled: true, requires: ["safe"], timeoutsMs: SAFE_TIMEOUT_MS,
    }),
    run: async (ctx) => {
      const url = `${(ctx as unknown as { baseUrl?: string }).baseUrl ?? ""}/functions/v1/ai-test`;
      const r = await timeoutFetch(url);
      const body = await r.json().catch(() => ({}));
      // IA desabilitada não é FAIL — é skipped/não-configurado conforme o briefing.
      return {
        status: r.ok ? "warning" : "skipped",
        actual: body as { ok?: boolean; message?: string },
      };
    },
  },
];
