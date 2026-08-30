/** Test Center — suites e executores SAFE (failure-safe; fetch com timeout). */
import type { TestDefinition, TestExecutor } from "./types";
import { AUDIT_PROBES } from "@/lib/audit/auditProbes";

export const SUITE_ORDER = ["01-environment", "02-server", "03-sources", "04-api", "05-storage"] as const;
export type SuiteId = (typeof SUITE_ORDER)[number];
export const SUITE_META: Record<SuiteId, { label: string; desc: string }> = {
  "01-environment": { label: "01 — Ambiente", desc: "Versão, config e requisitos." },
  "02-server": { label: "02 — Servidor", desc: "/health e rotas base." },
  "03-sources": { label: "03 — Fontes", desc: "Connectors do registry." },
  "04-api": { label: "04 — APIs", desc: "Smoke de endpoints (/system-profile…)." },
  "05-storage": { label: "05 — Storage", desc: "RAW (FS) e localStorage." },
};

export const FLAG_LABEL: Record<string, string> = {
  "requires-network": "rede",
  "requires-gpu": "GPU",
  "requires-ollama": "Ollama",
  "requires-external-api": "API externa",
  "requires-browser": "browser",
  "requires-storage": "storage",
  "requires-cpu-only": "CPU-only",
  destructive: "destrutivo",
  caution: "cuidado",
  safe: "seguro",
};
const SAFE_TIMEOUT_MS = 8_000;
const VERSION = ((import.meta.env.npm_package_version ?? "dev") as string);

async function timeoutFetch(url: string, timeoutMs = SAFE_TIMEOUT_MS, init?: RequestInit): Promise<Response> {
  const withTimeout = (AbortSignal as { timeout?: (ms: number) => AbortSignal }).timeout;
  return fetch(url, {
    ...init,
    signal: withTimeout ? withTimeout(timeoutMs) : init?.signal,
  });
}

function def(p: Omit<TestDefinition, "suite"> & { suite: SuiteId }): TestDefinition {
  return { ...p, suite: p.suite };
}

export const EXECUTORS: TestExecutor[] = [
  {
    definition: def({
      suite: "01-environment", testId: "env.version", name: "Versão do app",
      description: "Versão do build.", kind: "health-check", severity: "minor", priority: 90,
      enabled: true, requires: ["safe"], timeoutsMs: SAFE_TIMEOUT_MS,
    }),
    run: async () => ({ status: "pass", actual: VERSION }),
  },
  {
    definition: def({
      suite: "02-server", testId: "server.health", name: "/health",
      description: "Health do servidor Express.", kind: "health-check", severity: "critical", priority: 10,
      enabled: true, requires: ["safe"], timeoutsMs: SAFE_TIMEOUT_MS,
    }),
    run: async (ctx) => {
      const r = await timeoutFetch(`${ctx.baseUrl}/health`);
      const body = await r.json().catch(() => ({}));
      return { status: r.ok ? "pass" : "fail", actual: body };
    },
  },
  {
    definition: def({
      suite: "03-sources", testId: "sources.catalog", name: "Catálogo de fontes",
      description: "Connectors com capabilities.", kind: "integration", severity: "critical", priority: 10,
      enabled: true, requires: ["safe"], timeoutsMs: SAFE_TIMEOUT_MS,
    }),
    run: async (ctx) => {
      const r = await timeoutFetch(`${ctx.baseUrl}/functions/v1/sources`);
      const data = (await r.json().catch(() => ({}))) as { sources?: { id?: string }[] };
      const sources = data.sources ?? [];
      if (!sources.length) return { status: "fail", actual: data };
      return { status: "pass", actual: sources.map((s) => s.id) };
    },
  },
  {
    definition: def({
      suite: "03-sources", testId: "sources.wikipedia", name: "Fonte: Wikipedia",
      description: "Wikipedia declarada.", kind: "integration", severity: "minor", priority: 20,
      enabled: true, requires: ["safe"], timeoutsMs: SAFE_TIMEOUT_MS,
    }),
    run: async (ctx) => {
      const r = await timeoutFetch(`${ctx.baseUrl}/functions/v1/sources`);
      const data = (await r.json().catch(() => ({}))) as { sources?: { id?: string }[] };
      const found = (data.sources ?? []).find((s) => s.id === "wikipedia");
      return { status: found ? "pass" : "warning", actual: found ?? {} };
    },
  },
  // --- Sondas de descoberta: TODAS as fontes (AUDIT_PROBES, 35) ---
  // Cada sonda chama a rota da fonte end-to-end (mínimo). Failure-safe:
  // rede/rate-limit/timeout viram "warning" (não "fail") — o objetivo é
  // descobrir o que CADA fonte oferece, não derrubar a suíte por instabilidade.
  ...AUDIT_PROBES.map((p) => ({
    definition: def({
      suite: "03-sources" as const,
      testId: `probe.${p.sourceId}`,
      name: `Sonda: ${p.label}`,
      description: `Descoberta mínima da fonte ${p.sourceId} (rota ${p.route}).`,
      kind: "integration" as const,
      severity: "minor" as const,
      priority: 40,
      enabled: true,
      requires: ["safe" as const, "requires-network" as const, "requires-external-api" as const],
      timeoutsMs: 15_000,
      tags: ["sonda", p.sourceId],
    }),
    run: async (ctx) => {
      try {
        const r = await timeoutFetch(`${ctx.baseUrl}/functions/v1/${p.route}`, 15_000, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(p.body),
        });
        const body = (await r.json().catch(() => ({}))) as { error?: string };
        if (!r.ok) {
          const status: "warning" | "fail" = body.error ? "warning" : "fail";
          return { status, actual: { http: r.status, error: body.error ?? `HTTP ${r.status}` } };
        }
        return { status: "pass" as const, actual: body };
      } catch (err) {
        return {
          status: "warning" as const,
          actual: { erro: err instanceof Error ? err.message : String(err) },
        };
      }
    },
  })),
  {
    definition: def({
      suite: "04-api", testId: "api.systemProfile", name: "/system-profile",
      description: "Profile de hardware.", kind: "integration", severity: "major", priority: 20,
      enabled: true, requires: ["safe"], timeoutsMs: SAFE_TIMEOUT_MS,
    }),
    run: async (ctx) => {
      const r = await timeoutFetch(`${ctx.baseUrl}/functions/v1/system-profile`);
      const body = await r.json().catch(() => ({}));
      return { status: r.ok ? "pass" : "fail", actual: body };
    },
  },
  {
    definition: def({
      suite: "05-storage", testId: "storage.localStorage", name: "localStorage do cliente",
      description: "Probe com cleanup.", kind: "unit", severity: "major", priority: 30,
      enabled: true, requires: ["safe", "requires-browser"], timeoutsMs: SAFE_TIMEOUT_MS,
    }),
    run: async () => {
      try {
        localStorage.setItem("testcenter:probe", "1");
        const v = localStorage.getItem("testcenter:probe");
        localStorage.removeItem("testcenter:probe");
        return { status: v === "1" ? "pass" : "fail", actual: { probe: v } };
      } catch {
        return { status: "skipped", actual: "localStorage indisponível" };
      }
    },
  },
];

export function flagLabels(flags: string[]): string[] {
  return flags.map((f) => FLAG_LABEL[f] ?? f);
}
