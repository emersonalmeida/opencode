/**
 * IA Runner — fila global de gerações de IA.
 *
 * Resolve o requisito "rodar independente OU pipeline completo, continuar ao
 * navegar, pausar pela interface, retomar de onde parou ou recomeçar do zero":
 *
 * - **Singleton module-level**: o loop async vive fora do React — trocar de
 *   página (SPA) NÃO mata a execução. Só recarregar a página interrompe o
 *   stream em voo (e nesse caso o estado persistido marca o job "running"
 *   de volta para "pending" na próxima inicialização).
 * - **Persistência** (`aso:ia-runner:v1`): fila + resultado por job. Após um
 *   refresh, `resumeQueue()` continua do primeiro job pendente (jobs "done"
 *   são pulados — retomada de onde parou); `resetQueue()` zera os resultados
 *   (recomeço do zero).
 * - **Controle pela interface**: `pauseQueue()` aborta o stream atual e
 *   marca a fila como pausada; o job corrente volta a "pending".
 * - **Saídas persistidas**: cada job pode declarar `saveAs` (scope + key) —
 *   o resultado é gravado via `saveAIOutput`, então páginas como o Decision
 *   Center reidratam as decisões mesmo após navegação/refresh.
 * - **Eventos vivos**: `subscribeRunnerEvents` emite token/done/error para
 *   UI acompanhar o streaming (ephemeral — nada disso vai pro storage).
 *
 * O runner NÃO é React: componentes leem estado via `useIAQueue()` e eventos
 * via `subscribeRunnerEvents()`. O app de dados é resolvido no momento da
 * execução de cada job (dataset + seleção global atuais), nunca congelado.
 */
import { useEffect, useState } from "react";
import { listDataset, type DatasetEntry } from "@/lib/datasetStore";
import { streamExperiment } from "@/lib/experimentApi";
import { streamExperimentChat } from "@/lib/experimentChatApi";
import { saveAIOutput } from "@/lib/aiOutputStore";
import { logActivity, taskStart, taskUpdate, taskEnd } from "@/lib/activityStore";
import { getAISettings, isAIEnabled } from "@/lib/aiSettings";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export type IAJobKind = "section" | "chat";

export interface IAJob {
  /** Id estável e único dentro da fila (usado na retomada). */
  id: string;
  label: string;
  kind: IAJobKind;
  /** kind "section": id da seção (streamExperiment). */
  section?: string;
  /** kind "chat": prompt do usuário (streamExperimentChat). */
  prompt?: string;
  /** Se definido, a saída final é persistida (sobrevive a refresh/navegação). */
  saveAs?: { section: string; key: string };
  /** Identificador livre p/ UI agrupar (ex.: "decision-center"). */
  origin?: string;
}

export type IAJobState = "pending" | "running" | "done" | "error";

export interface IAQueueState {
  jobs: IAJob[];
  results: Record<string, IAJobState>;
  status: "idle" | "running" | "paused" | "done";
  /** Índice do job corrente (quando running). */
  current: number;
  updatedAt: number;
}

export interface RunnerEvent {
  type: "token" | "done" | "error" | "queued" | "state";
  jobId?: string;
  text?: string;
}

const QUEUE_KEY = "aso:ia-runner:v1";

const EMPTY_QUEUE: IAQueueState = { jobs: [], results: {}, status: "idle", current: -1, updatedAt: 0 };

// ---------------------------------------------------------------------------
// Estado interno (módulo) + pub/sub
// ---------------------------------------------------------------------------

let state: IAQueueState = loadQueue();
const stateListeners = new Set<() => void>();
const eventListeners = new Set<(ev: RunnerEvent) => void>();
/** Controladores dos streams em voo (worker pool: pode haver vários). */
const inFlightAborts = new Map<string, AbortController>();
/** Resolver de apps injetável (testes). Default: dataset filtrado pela seleção global. */
let appsResolver: () => DatasetEntry[] = defaultAppsResolver;

function loadQueue(): IAQueueState {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return { ...EMPTY_QUEUE };
    const p = JSON.parse(raw) as IAQueueState;
    if (!Array.isArray(p.jobs) || typeof p.results !== "object") return { ...EMPTY_QUEUE };
    // Refresh = interrupção: job "running" volta a pending; fila vira pausada
    // (o usuário retoma pela interface, ou recomeça do zero).
    const results: Record<string, IAJobState> = { ...p.results };
    for (const id of Object.keys(results)) {
      if (results[id] === "running") results[id] = "pending";
    }
    const status = p.status === "running" ? "paused" : (p.status ?? "idle");
    const pendingLeft = p.jobs.some((j) => (results[j.id] ?? "pending") !== "done");
    return {
      jobs: p.jobs,
      results,
      status: pendingLeft ? status : (p.jobs.length > 0 ? "done" : "idle"),
      current: -1,
      updatedAt: p.updatedAt ?? Date.now(),
    };
  } catch {
    return { ...EMPTY_QUEUE };
  }
}

function persist() {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(state));
  } catch { /* quota */ }
}

function notify() {
  stateListeners.forEach((fn) => {
    try { fn(); } catch { /* listener */ }
  });
}

function emit(ev: RunnerEvent) {
  eventListeners.forEach((fn) => {
    try { fn(ev); } catch { /* listener */ }
  });
}

function defaultAppsResolver(): DatasetEntry[] {
  const entries = listDataset();
  try {
    const raw = localStorage.getItem("aso:selected-apps:v1");
    const sel: string[] = raw ? JSON.parse(raw) : [];
    if (Array.isArray(sel) && sel.length > 0) {
      const set = new Set(sel);
      const filtered = entries.filter((e) => set.has(`${e.app.store}:${e.app.id}`));
      if (filtered.length > 0) return filtered;
    }
  } catch { /* fallback: dataset inteiro */ }
  return entries;
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

export function getIAQueue(): IAQueueState {
  return state;
}

export function subscribeIAQueue(fn: () => void): () => void {
  stateListeners.add(fn);
  return () => stateListeners.delete(fn);
}

export function subscribeRunnerEvents(fn: (ev: RunnerEvent) => void): () => void {
  eventListeners.add(fn);
  return () => eventListeners.delete(fn);
}

/** Testes: injeta um resolver de apps. */
export function setAppsResolverForTests(resolver: () => DatasetEntry[]) {
  appsResolver = resolver;
}

/**
 * Coloca jobs na fila. `mode: "replace"` (default) substitui a fila anterior
 * preservando resultados "done" de jobs com MESMO id (retomada natural);
 * "append" só adiciona jobs novos.
 */
export function enqueueJobs(jobs: IAJob[], mode: "replace" | "append" = "replace") {
  const prevResults = { ...state.results };
  const nextJobs = mode === "append" ? [...state.jobs, ...jobs] : jobs;
  const results: Record<string, IAJobState> = {};
  for (const j of nextJobs) {
    results[j.id] = prevResults[j.id] === "done" ? "done" : "pending";
  }
  const hasPending = nextJobs.some((j) => results[j.id] !== "done");
  state = {
    jobs: nextJobs,
    results,
    status: nextJobs.length === 0 ? "idle" : hasPending ? "paused" : "done",
    current: -1,
    updatedAt: Date.now(),
  };
  persist();
  notify();
  emit({ type: "queued" });
}

/** Limpa a fila inteira. */
export function clearQueue() {
  pauseQueue();
  state = { ...EMPTY_QUEUE, updatedAt: Date.now() };
  persist();
  notify();
}

/** Zera resultados — todos os jobs voltam a pending (recomeçar do zero). */
export function resetQueue() {
  pauseQueue();
  const results: Record<string, IAJobState> = {};
  for (const j of state.jobs) results[j.id] = "pending";
  state = { ...state, results, status: state.jobs.length > 0 ? "paused" : "idle", current: -1, updatedAt: Date.now() };
  persist();
  notify();
}

/** Pausa: aborta TODOS os streams em voo (pool); jobs correntes voltam a pending. */
export function pauseQueue() {
  for (const c of inFlightAborts.values()) c.abort();
  inFlightAborts.clear();
  if (state.status === "running") {
    const results = { ...state.results };
    for (const id of Object.keys(results)) {
      if (results[id] === "running") results[id] = "pending";
    }
    state = { ...state, results, status: "paused", current: -1, updatedAt: Date.now() };
    persist();
    notify();
  }
}

/** Atalho: o que a UI mostra como "há algo retomável?". */
export function hasResumableQueue(): boolean {
  return state.jobs.length > 0 && state.jobs.some((j) => (state.results[j.id] ?? "pending") !== "done");
}

export function queueCounts() {
  const done = state.jobs.filter((j) => state.results[j.id] === "done").length;
  const error = state.jobs.filter((j) => state.results[j.id] === "error").length;
  return { total: state.jobs.length, done, error, pending: state.jobs.length - done - error };
}

/**
 * Executa a fila respeitando o modo de concorrência de IA:
 * - **parallel** (default): worker pool com até `maxConcurrent` streams
 *   simultâneos — vários jobs gerando em tempo real ao mesmo tempo.
 * - **sequential**: um stream por vez (comportamento clássico).
 * Jobs já "done" são pulados (retomada). Uma falha num job NÃO derruba a
 * fila — marca "error" e segue. `pauseQueue` aborta todos os em voo.
 */
export async function startQueue(): Promise<void> {
  if (state.status === "running") return;
  const ai = getAISettings();
  if (!isAIEnabled(ai)) {
    logActivity("ia", "error", "Fila de IA não iniciada — IA desativada");
    return;
  }
  if (state.jobs.length === 0) return;
  const poolSize = ai.concurrencyMode === "sequential" ? 1 : Math.max(1, ai.maxConcurrent || 1);
  state = { ...state, status: "running", updatedAt: Date.now() };
  persist();
  notify();
  logActivity("ia", "plan", `Fila de IA iniciada (${queueCounts().pending} pendente(s), ${poolSize} em paralelo)`);

  /** Próximo índice pendente (claim atômico: JS é single-threaded). */
  const claimNext = (): number => {
    for (let i = 0; i < state.jobs.length; i++) {
      if ((state.results[state.jobs[i].id] ?? "pending") === "pending") return i;
    }
    return -1;
  };

  const runOne = async (i: number): Promise<void> => {
    const job = state.jobs[i];
    if (state.status !== "running") return; // pausado pela interface
    const apps = appsResolver();
    if (apps.length === 0) {
      state = { ...state, results: { ...state.results, [job.id]: "error" }, updatedAt: Date.now() };
      persist(); notify();
      emit({ type: "error", jobId: job.id, text: "Dataset vazio" });
      return;
    }
    state = { ...state, results: { ...state.results, [job.id]: "running" }, current: i, updatedAt: Date.now() };
    persist(); notify();

    const tid = taskStart(null, job.label, "ia", job.section ?? job.origin);
    const controller = new AbortController();
    inFlightAborts.set(job.id, controller);
    const signal = controller.signal;
    let outcome: "done" | "error" | "aborted" = "aborted";

    const handlers = {
      onToken: (full: string) => emit({ type: "token", jobId: job.id, text: full }),
      onDone: (full: string) => {
        outcome = "done";
        if (job.saveAs && getAISettings().autoSaveOutputs !== false) {
          const keys = apps.map((e) => `${e.app.store}:${e.app.id}`);
          saveAIOutput(job.saveAs.section, keys, full, undefined, job.saveAs.key);
        }
        taskEnd(tid, "done");
        logActivity("ia", "done", `${job.label} — concluído`);
      },
      onError: (msg: string) => {
        if (outcome === "aborted") outcome = "error";
        taskEnd(tid, "error", msg);
        logActivity("ia", "error", `${job.label} — ${msg}`);
      },
    };

    if (job.kind === "section" && job.section) {
      await streamExperiment(job.section, apps, handlers, signal, ai).catch(() => {});
    } else if (job.prompt) {
      await streamExperimentChat(
        apps,
        [{ role: "user", content: job.prompt }],
        handlers,
        signal,
        ai,
        "custom",
      ).catch(() => {});
    }
    inFlightAborts.delete(job.id);

    if (signal.aborted && outcome === "aborted") {
      // Pausa pela interface — job volta a pending (o worker encerra).
      taskUpdate(tid, { status: "cancelled", detail: "Interrompido pelo usuário" });
      state = {
        ...state,
        results: { ...state.results, [job.id]: "pending" },
        current: -1,
        updatedAt: Date.now(),
      };
      persist(); notify();
      return;
    }

    // Neste ponto "aborted" já foi tratado acima — restam done/error.
    // (cast: o narrowing de TS não enxerga as atribuições dentro dos handlers)
    const doneOk = (outcome as string) === "done";
    state = {
      ...state,
      results: { ...state.results, [job.id]: doneOk ? "done" : "error" },
      current: -1,
      updatedAt: Date.now(),
    };
    persist(); notify();
    emit({ type: doneOk ? "done" : "error", jobId: job.id });
  };

  const worker = async (): Promise<void> => {
    while (state.status === "running") {
      const i = claimNext();
      if (i < 0) return;
      await runOne(i);
    }
  };

  await Promise.all(Array.from({ length: Math.min(poolSize, state.jobs.length) }, () => worker()));

  if (state.status === "running") {
    const hasPending = state.jobs.some((j) => state.results[j.id] !== "done");
    state = { ...state, status: hasPending ? "paused" : "done", current: -1, updatedAt: Date.now() };
    persist(); notify();
  }
}

/** Retoma a fila do primeiro job pendente (jobs done são pulados). */
export function resumeQueue() {
  void startQueue();
}

/** Recomeça do zero: zera resultados e inicia imediatamente. */
export function restartQueue() {
  resetQueue();
  void startQueue();
}

// ---------------------------------------------------------------------------
// Hook React (padrão useDataset: useState + subscribe — sem useSyncExternalStore
// com snapshot mutável, que causa "Maximum update depth exceeded").
// ---------------------------------------------------------------------------

export function useIAQueue(): IAQueueState {
  const [q, setQ] = useState<IAQueueState>(getIAQueue());
  useEffect(() => subscribeIAQueue(() => setQ({ ...getIAQueue() })), []);
  return q;
}
