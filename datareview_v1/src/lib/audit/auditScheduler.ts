/**
 * auditScheduler — agendador de sondas do Audit Engine (A10). Fila sequencial
 * (1 sonda por vez — respeita rate-limits), com status por fonte e controle
 * start/stop/restart. Estado em pub/sub; UI assina via useSyncExternalStore.
 */
import { AUDIT_PROBES, postProbe } from "./auditProbes";

export type ProbeRunStatus = "pending" | "running" | "done" | "error" | "aborted";
export type SchedulerStatus = "idle" | "running" | "paused" | "done";

export interface ProbeRunState {
  status: ProbeRunStatus;
  error?: string;
  durationMs?: number;
  startedAt?: number;
  finishedAt?: number;
}

export interface SchedulerState {
  status: SchedulerStatus;
  index: number;
  total: number;
  /** Status por fonte (acumulado entre sessões; persistido). */
  runs: Record<string, ProbeRunState>;
}

const STORAGE_KEY = "aso:audit-scheduler:v1";
const CONFIG_KEY = "aso:audit-scheduler-config:v1";

/**
 * Budget de segurança da auditoria (briefing §5/§6): "nunca desperdiçar
 * requisições" e "não causar comportamento abusivo contra uma fonte".
 */
export interface SchedulerBudget {
  /** Máximo de sondas por execução (para quando atinge). */
  maxRequests: number;
  /** Intervalo mínimo entre sondas (respiro para rate-limits). */
  delayBetweenMs: number;
  /** Timeout por sonda (AbortSignal). */
  timeoutMs: number;
}

export const DEFAULT_BUDGET: SchedulerBudget = {
  maxRequests: 50,
  delayBetweenMs: 800,
  timeoutMs: 30000,
};

export const BUDGET_LIMITS = {
  maxRequests: { min: 1, max: 200 },
  delayBetweenMs: { min: 0, max: 10000 },
  timeoutMs: { min: 5000, max: 120000 },
} as const;

function clampBudget(b: Partial<SchedulerBudget>): SchedulerBudget {
  // NÃO usar `|| fallback`: 0 é um valor válido (delay 0 = sem respiro).
  const num = (v: unknown, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  return {
    maxRequests: Math.max(BUDGET_LIMITS.maxRequests.min, Math.min(BUDGET_LIMITS.maxRequests.max, Math.round(num(b.maxRequests, DEFAULT_BUDGET.maxRequests)))),
    delayBetweenMs: Math.max(BUDGET_LIMITS.delayBetweenMs.min, Math.min(BUDGET_LIMITS.delayBetweenMs.max, Math.round(num(b.delayBetweenMs, DEFAULT_BUDGET.delayBetweenMs)))),
    timeoutMs: Math.max(BUDGET_LIMITS.timeoutMs.min, Math.min(BUDGET_LIMITS.timeoutMs.max, Math.round(num(b.timeoutMs, DEFAULT_BUDGET.timeoutMs)))),
  };
}

let budget: SchedulerBudget = loadBudget();

function loadBudget(): SchedulerBudget {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return DEFAULT_BUDGET;
    return clampBudget(JSON.parse(raw) as Partial<SchedulerBudget>);
  } catch {
    return DEFAULT_BUDGET;
  }
}

export function getBudget(): SchedulerBudget {
  return budget;
}

export function setBudget(patch: Partial<SchedulerBudget>): void {
  budget = clampBudget({ ...budget, ...patch });
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(budget));
  } catch {
    // sem storage — segue em memória
  }
  notify();
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

let state: SchedulerState = { status: "idle", index: 0, total: AUDIT_PROBES.length, runs: {} };
const listeners = new Set<() => void>();

export function subscribeScheduler(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** getSnapshot no padrão useSyncExternalStore. */
export function getSchedulerState(): SchedulerState {
  return state;
}

function notify(): void {
  for (const cb of listeners) cb();
}

function setState(next: Partial<SchedulerState>): void {
  state = { ...state, ...next };
  persist();
  notify();
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ runs: state.runs }));
  } catch {
    // sem storage/quota — o agendador segue em memória
  }
}

function hydrate(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as { runs?: Record<string, ProbeRunState> };
    if (saved?.runs) state = { ...state, runs: saved.runs };
  } catch {
    // storage ilegível — ignora
  }
}

/** Marca cada sonda como "pendente" quando não tem estado gravado ainda. */
function ensureQueued(): void {
  const runs = { ...state.runs };
  let changed = false;
  for (const probe of AUDIT_PROBES) {
    if (!runs[probe.sourceId]) {
      runs[probe.sourceId] = { status: "pending" };
      changed = true;
    }
  }
  if (changed) setState({ runs });
}

hydrate();
ensureQueued();

// ------ execução ------
let currentAbort: AbortController | null = null;
let runningPromise: Promise<void> | null = null;

/** Zera completamente o estado da fila (usado pela Zona de perigo e em testes). */
export function resetScheduler(): void {
  currentAbort?.abort();
  runningPromise = null;
  state = { status: "idle", index: 0, total: AUDIT_PROBES.length, runs: {} };
  ensureQueued();
}

/** Inicia/retoma a fila (ignora se já rodando). */
export function startScheduler(): Promise<void> {
  if (state.status === "running" && runningPromise) return runningPromise;
  if (state.status === "done") {
    // Tudo concluído numa sessão anterior — reiniciar zera as sondas.
    state = { status: "idle", index: 0, total: AUDIT_PROBES.length, runs: {} };
    ensureQueued();
  }
  runningPromise = processQueue();
  return runningPromise;
}

/** Stop aborta a sonda em voo; a fila fica retomável. */
export function stopScheduler(): void {
  currentAbort?.abort();
  if (state.status === "running") setState({ status: "paused" });
}

/** Reinicia do zero (zera todos os estados). */
export function restartScheduler(): Promise<void> {
  stopScheduler();
  state = { status: "idle", index: 0, total: AUDIT_PROBES.length, runs: {} };
  ensureQueued();
  return startScheduler();
}

async function processQueue(): Promise<void> {
  setState({ status: "running" });
  let spent = 0; // requisições desta execução (budget §5)
  while (state.index < AUDIT_PROBES.length) {
    if (spent >= budget.maxRequests) {
      setState({ status: "paused" }); // atingiu o teto — retomável
      break;
    }
    const probe = AUDIT_PROBES[state.index];
    const prev = state.runs[probe.sourceId];
    if (prev?.status === "done" || prev?.status === "error") {
      setState({ index: state.index + 1 });
      continue;
    }
    if (spent > 0 && budget.delayBetweenMs > 0) await sleep(budget.delayBetweenMs);
    currentAbort = new AbortController();
    // Timeout: abort próprio do budget — vira erro honesto e a fila CONTINUA
    // (uma sonda lenta não pode derrubar as demais). Abort do usuário para tudo.
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      currentAbort?.abort();
    }, budget.timeoutMs);
    const started = Date.now();
    setRun(probe.sourceId, { status: "running", startedAt: started });
    const res = await postProbe(probe.route, probe.body, currentAbort.signal);
    clearTimeout(timer);
    spent++;
    const durationMs = Date.now() - started;
    if (res.ok) {
      setRun(probe.sourceId, { status: "done", durationMs, finishedAt: Date.now() });
    } else if (res.error === "cancelado" && timedOut) {
      setRun(probe.sourceId, { status: "error", error: `timeout (${budget.timeoutMs}ms)`, durationMs, finishedAt: Date.now() });
    } else if (res.error === "cancelado") {
      setRun(probe.sourceId, { status: "aborted", error: "cancelado", durationMs });
      break;
    } else {
      setRun(probe.sourceId, { status: "error", error: res.error, durationMs, finishedAt: Date.now() });
    }
    setState({ index: state.index + 1 });
  }
  if (state.index >= AUDIT_PROBES.length) setState({ status: "done" });
  runningPromise = null;
}

function setRun(sourceId: string, patch: ProbeRunState): void {
  state = { ...state, runs: { ...state.runs, [sourceId]: { ...state.runs[sourceId], ...patch } } };
  persist();
  notify();
}
