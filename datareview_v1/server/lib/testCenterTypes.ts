/** Tipos shared do Test Center no server (sem depender de ../../src). */
export type TestStatus =
  | "not-run" | "pass" | "fail" | "warning" | "skipped" | "blocked"
  | "not-implemented" | "not-configured" | "timeout" | "error";

export type TestKind = "health-check" | "unit" | "integration" | "e2e" | "smoke" | "performance" | "security" | "compatibility";
export type TestFlag =
  | "requires-network" | "requires-gpu" | "requires-ollama" | "requires-external-api"
  | "requires-browser" | "requires-storage" | "requires-cpu-only"
  | "destructive" | "caution" | "safe";

export interface TestDefinition {
  testId: string;
  name: string;
  description: string;
  suite: string;
  kind: TestKind;
  severity: "critical" | "major" | "minor";
  priority: number;
  enabled: boolean;
  requires: TestFlag[];
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

export interface TestRun {
  runId: string;
  suiteId?: string;
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
  baseUrl?: string;
  timeoutMs: number;
  signal?: AbortSignal;
}

export interface TestExecutor {
  definition: TestDefinition;
  run(ctx: TestRunContext): Promise<Partial<Omit<TestResult, "testId" | "durationMs" | "version" | "environment">>>;
}
