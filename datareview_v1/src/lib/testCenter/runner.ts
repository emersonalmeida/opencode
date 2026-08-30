/** Runner dos executores SAFE com result normalization. */
import { EXECUTORS } from "./catalog";
import type { TestExecutor, TestResult, TestRun, TestRunContext } from "./types";

const VERSION = ((import.meta.env.npm_package_version ?? "dev") as string);

export function listDefinitions(): TestExecutor[] {
  return EXECUTORS;
}

export async function runOne(
  ex: TestExecutor,
  ctx: TestRunContext,
): Promise<TestResult> {
  const started = Date.now();
  try {
    const partial = await ex.run(ctx);
    return {
      testId: ex.definition.testId,
      durationMs: Math.max(0, Date.now() - started),
      version: VERSION,
      environment: ctx.env,
      status: (partial as { status?: TestResult["status"] }).status ?? "error",
      input: (partial as { input?: unknown }).input,
      expected: (partial as { expected?: unknown }).expected,
      actual: (partial as { actual?: unknown }).actual,
      error: (partial as { error?: TestResult["error"] }).error,
      metrics: (partial as { metrics?: TestResult["metrics"] }).metrics,
      artifacts: (partial as { artifacts?: TestResult["artifacts"] }).artifacts,
      logs: (partial as { logs?: TestResult["logs"] }).logs,
    };
  } catch (error) {
    return {
      testId: ex.definition.testId,
      durationMs: Date.now() - started,
      version: VERSION,
      environment: ctx.env,
      status: "error",
      error: { message: (error as Error)?.message ?? String(error) },
    };
  }
}

export async function runAll(
  ctx: TestRunContext,
  suite?: string,
): Promise<Omit<TestRun, "runId" | "finishedAt" | "canceled">> {
  const selected = listDefinitions().filter((ex) =>
    !suite || ex.definition.suite === suite,
  );
  const started = Date.now();
  const results: TestResult[] = [];
  for (const ex of selected) {
    results.push(await runOne(ex, ctx));
  }
  return {
    startedAt: started,
    version: VERSION,
    environment: ctx.env,
    suiteId: suite,
    results,
    mode: "quick",
    triggeredBy: "user",
  };
}
