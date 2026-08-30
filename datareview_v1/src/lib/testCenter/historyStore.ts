/** Histórico de runs do Test Center (cliente, localStorage). */
import type { TestRun, TestResult } from "./types";

const KEY = "aso:test-center:v1";
const MAX_RUNS = 30;

function load(): TestRun[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as TestRun[];
  } catch {
    return [];
  }
}

function save(runs: TestRun[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(runs.slice(0, MAX_RUNS)));
  } catch {
    // storage cheio: drop mais antigo
    try {
      localStorage.setItem(KEY, JSON.stringify(runs.slice(0, Math.max(1, runs.length - 5))));
    } catch {
      // ignora
    }
  }
}

export function listRuns(): TestRun[] {
  return load();
}

export function recordRun(run: TestRun): void {
  const runs = load();
  const withoutDup = runs.filter((r) => r.runId !== run.runId);
  save([run, ...withoutDup]);
}

export function clearRuns(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignora
  }
}

export function summarize(run: TestRun): {
  pass: number; fail: number; warning: number; skipped: number; notConfigured: number; error: number;
} {
  const acc = { pass: 0, fail: 0, warning: 0, skipped: 0, notConfigured: 0, error: 0 };
  for (const r of run.results) {
    const s = r.status;
    if (s === "pass") acc.pass++;
    else if (s === "fail") acc.fail++;
    else if (s === "warning") acc.warning++;
    else if (s === "skipped" || s === "blocked") acc.skipped++;
    else if (s === "not-configured") acc.notConfigured++;
    else if (s === "error" || s === "timeout") acc.error++;
  }
  return acc;
}
