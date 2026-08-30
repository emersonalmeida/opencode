/**
 * Log ao vivo do teste de fontes (pub/sub) — alimenta o terminal da
 * sidebar direita da página /testes-fontes. Nada é omitido: cada probe
 * gera eventos de início/fim/erro/skip com contagens e campos vistos.
 */
import type { TestStatus } from "./sourceTestPlan";

export interface TestLogEntry {
  id: string;
  at: number;
  level: "info" | "success" | "warn" | "error";
  probeId: string;
  sourceId: string;
  label: string;
  message: string;
  /** payload estruturado opcional (contagem, campos, duração). */
  data?: Record<string, unknown>;
}

const MAX_LOG = 2000;
const listeners = new Set<() => void>();
let log: TestLogEntry[] = [];
let seq = 0;

function notify() {
  for (const fn of listeners) fn();
}

export function logTestEvent(
  level: TestLogEntry["level"],
  probeId: string,
  sourceId: string,
  label: string,
  message: string,
  data?: Record<string, unknown>,
) {
  log = [
    ...log.slice(-(MAX_LOG - 1)),
    {
      id: `t${Date.now()}:${++seq}`,
      at: Date.now(),
      level,
      probeId,
      sourceId,
      label,
      message,
      data,
    },
  ];
  notify();
}

export function clearTestLog() {
  log = [];
  notify();
}

export function listTestLog(): TestLogEntry[] {
  return log;
}

export function subscribeTestLog(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Snapshot memoizado (anti-loop do useSyncExternalStore). */
let cached: TestLogEntry[] = [];
let cachedFingerprint = "";
export function snapshotTestLog(): TestLogEntry[] {
  const fp = log.length ? `${log.length}:${log[log.length - 1]!.id}` : "";
  if (fp !== cachedFingerprint) {
    cachedFingerprint = fp;
    cached = log;
  }
  return cached;
}

/** Estatísticas derivadas do log (para o resumo do terminal). */
export function logStats(entries: TestLogEntry[]): {
  total: number;
  done: number;
  error: number;
  skipped: number;
  running: number;
} {
  const lastByProbe = new Map<string, TestStatus>();
  for (const e of entries) {
    if (e.data?.status) lastByProbe.set(e.probeId, e.data.status as TestStatus);
  }
  const counts = { pending: 0, running: 0, done: 0, error: 0, skipped: 0 };
  for (const st of lastByProbe.values()) counts[st]++;
  return {
    total: lastByProbe.size,
    done: counts.done,
    error: counts.error,
    skipped: counts.skipped,
    running: counts.running,
  };
}
