/**
 * Test Center — modelos declarativos (FASE 1 foundation). Catálogo de testes
 * (definitions), histórico de execução (runs/results), estados canônicos e
 * flags de requisito (network/GPU/Ollama/external/storage/cpu-only) +
 * SAFE/CAUTION/DESTRUCTIVE.
 */

export type TestStatus =
  | "not-run"
  | "pass"
  | "fail"
  | "warning"
  | "skipped"
  | "blocked"
  | "not-implemented"
  | "not-configured"
  | "timeout"
  | "error";

export const TEST_STATUS_META: Record<TestStatus, { label: string; tone: "ok" | "warn" | "bad" | "skip" | "muted" }> = {
  "not-run": { label: "nunca executado", tone: "muted" },
  pass: { label: "passa", tone: "ok" },
  fail: { label: "falha", tone: "bad" },
  warning: { label: "aviso", tone: "warn" },
  skipped: { label: "pulada", tone: "skip" },
  blocked: { label: "bloqueada", tone: "muted" },
  "not-implemented": { label: "não implementada", tone: "muted" },
  "not-configured": { label: "não configurada", tone: "muted" },
  timeout: { label: "timeout", tone: "bad" },
  error: { label: "erro", tone: "bad" },
};

export type TestKind = "health-check" | "unit" | "integration" | "e2e" | "smoke" | "performance" | "security" | "compatibility";

export type TestFlag =
  | "requires-network"
  | "requires-gpu"
  | "requires-ollama"
  | "requires-external-api"
  | "requires-browser"
  | "requires-storage"
  | "requires-cpu-only"
  | "destructive"
  | "caution"
  | "safe";

export interface TestDefinition {
  testId: string;
  name: string;
  description: string;
  suite: string;
  kind: TestKind;
  severity: "critical" | "major" | "minor";
  priority: number; // menor = maior prioridade
  enabled: boolean;
  requires: TestFlag[];
  /** Comportamento esperado detalhável. */
  expected?: string;
  timeoutsMs: number;
  tags?: string[];
}

export interface TestResult {
  testId: string;
  status: Exclude<TestStatus, "not-run">;
  durationMs: number;
  version: string;
  environment: string;
  input?: unknown;
  expected?: unknown;
  actual?: unknown;
  error?: { message: string; stack?: string };
  metrics?: Record<string, number | string>;
  artifacts?: { label: string; kind: string; value: unknown }[];
  logs?: { level: string; message: string; at: number }[];
}

/** Executor dentro-assuring: a execução parcial parcial produzida ao
 * componente ao `runOne` normaliza para TestResult completo. */
export interface TestExecutor {
  definition: TestDefinition;
  run(ctx: TestRunContext): Promise<Partial<Omit<TestResult, "testId" | "durationMs" | "version" | "environment">>>;
}

export interface TestRun {
  runId: string;
  suiteId?: string; // vazio = adhoc
  startedAt: number;
  finishedAt: number;
  version: string;
  environment: string;
  results: TestResult[];
  mode: "quick" | "standard" | "full" | "deep" | "e2e";
  triggeredBy: "user" | "system";
  canceled: boolean;
}

export interface TestRunContext {
  env: "browser" | "server" | "node";
  baseUrl?: string; // URL do servidor local para testes integration/e2e
  timeoutMs: number;
  signal?: AbortSignal;
}
