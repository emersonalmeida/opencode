/** Executor server-side dos tests SAFE. POST /functions/v1/test-run:
 * body {suite?, mode?, baseUrl?} — retorna {run} com os resultados, sem
 * persistir em FS (opcional: persist é opcional via ?persist=1). */
import type { RequestHandler } from "express";
import { EXECUTORS } from "../lib/testCenterCore.js";
import type { TestRun, TestResult, TestRunContext, TestExecutor } from "../lib/testCenterTypes.js";

const VERSION = "1.0-test";

async function runOne(ex: TestExecutor, ctx: TestRunContext): Promise<TestResult> {
  const started = Date.now();
  try {
    const partial = await ex.run(ctx);
    return {
      testId: ex.definition.testId,
      status: (partial as { status?: TestResult["status"] }).status ?? "error",
      durationMs: Math.max(0, Date.now() - started),
      version: VERSION,
      environment: "server",
      input: (partial as { input?: unknown }).input,
      expected: (partial as { expected?: unknown }).expected,
      actual: (partial as { actual?: unknown }).actual,
      error: (partial as { error?: TestResult["error"] }).error,
    };
  } catch (error) {
    return {
      testId: ex.definition.testId,
      status: "error",
      durationMs: Date.now() - started,
      version: VERSION,
      environment: "server",
      error: { message: (error as Error)?.message ?? String(error) },
    } as TestResult;
  }
}

export const testRun: RequestHandler = async (req, res) => {
  const { suite, mode = "quick", baseUrl: baseUrlBody = "" } = req.body ?? {};
  const baseUrl = String(baseUrlBody || "http://localhost:" + (process.env.PORT ?? 8787));
  const ctx: TestRunContext = {
    env: "server",
    baseUrl,
    timeoutMs: 8_000,
  };
  const selected = EXECUTORS.filter((ex) => !suite || ex.definition.suite === suite);
  const startedAt = Date.now();
  const results: TestResult[] = [];
  for (const ex of selected) results.push(await runOne(ex, ctx));
  const finishedAt = Date.now();
  const run: TestRun = {
    runId: `run_${Date.now().toString(36)}`,
    suiteId: typeof suite === "string" && suite ? suite : undefined,
    startedAt, finishedAt,
    version: VERSION,
    environment: "server",
    results,
    mode: (mode as TestRun["mode"]) ?? "quick",
    triggeredBy: "user",
    canceled: false,
  };
  res.json({ run });
};

export default testRun;
