/**
 * Activity store — log vivo de TODA a aplicação (não só do canvas) +
 * rastreador de tarefas ativas.
 *
 * Duas coleções pub/sub:
 * - `events`: feed cronológico do que o sistema vai fazer / está fazendo /
 *   fez / pulou / falhou (alimenta o Terminal do sistema e auditoria).
 * - `tasks`: tarefas com status vivo (alimenta o indicador global do header
 *   e os painéis de status das páginas).
 *
 * Persiste os últimos eventos em localStorage para sobreviver a reloads.
 */

import { useSyncExternalStore } from "react";
import type { ActivityPhase, TaskStatus } from "@/lib/statusSystem";

export interface ActivityEvent {
  id: string;
  ts: number;
  /** Origem: "canvas" | "pipeline" | "agentes" | "coleta" | "ia" | "sistema" | ... */
  source: string;
  phase: ActivityPhase;
  message: string;
  detail?: string;
}

export interface TrackedTask {
  id: string;
  label: string;
  source: string;
  status: TaskStatus;
  detail?: string;
  startedAt: number;
  endedAt?: number;
}

const EVENTS_KEY = "aso:activity-events:v1";
const MAX_EVENTS = 500;

let events: ActivityEvent[] = loadEvents();
let tasks: TrackedTask[] = [];
const listeners = new Set<() => void>();

let seq = 0;
function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${(seq++).toString(36)}`;
}

function loadEvents(): ActivityEvent[] {
  try {
    const raw = localStorage.getItem(EVENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(-MAX_EVENTS) : [];
  } catch {
    return [];
  }
}

function persistEvents() {
  try {
    localStorage.setItem(EVENTS_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
  } catch {
    /* quota */
  }
}

let lastTs = 0;
function nextTs(): number {
  // timestamps estritamente crescentes → sort newest-first estável
  lastTs = Math.max(Date.now(), lastTs + 1);
  return lastTs;
}

function notify() {
  listeners.forEach((l) => l());
}

export function logActivity(
  source: string,
  phase: ActivityPhase,
  message: string,
  detail?: string,
): ActivityEvent {
  const ev: ActivityEvent = { id: genId("act"), ts: nextTs(), source, phase, message, detail };
  events = [...events, ev].slice(-MAX_EVENTS);
  persistEvents();
  notify();
  return ev;
}

export function clearActivity() {
  events = [];
  persistEvents();
  notify();
}

/** Leituras imperativas (testes, utilitários não-React). */
export function listActivities(): ActivityEvent[] {
  return events;
}

export function listTasks(): TrackedTask[] {
  return tasks;
}

/** Limpa tudo (eventos + tarefas) — usado em testes e no botão "Limpar". */
export function clearAll() {
  events = [];
  tasks = [];
  persistEvents();
  notify();
}

/** Inicia (ou cria) uma tarefa rastreada. Retorna o id para updates. */
export function taskStart(id: string | null, label: string, source: string, detail?: string): string {
  const tid = id ?? genId("task");
  tasks = [...tasks.filter((t) => t.id !== tid), {
    id: tid, label, source, status: "running", detail, startedAt: Date.now(),
  }];
  logActivity(source, "start", label, detail);
  notify();
  return tid;
}

export function taskUpdate(id: string, patch: Partial<Pick<TrackedTask, "status" | "detail" | "label">>) {
  tasks = tasks.map((t) => (t.id === id ? { ...t, ...patch } : t));
  notify();
}

/** Finaliza uma tarefa (done/error/skipped/cancelled) e loga o fechamento. */
export function taskEnd(id: string, status: TaskStatus, detail?: string) {
  const t = tasks.find((x) => x.id === id);
  tasks = tasks.map((x) => (x.id === id ? { ...x, status, detail: detail ?? x.detail, endedAt: Date.now() } : x));
  if (t) {
    const phase: ActivityPhase =
      status === "error" ? "error" : status === "skipped" ? "skip" : status === "cancelled" ? "skip" : "done";
    logActivity(t.source, phase, t.label, detail ?? t.detail);
  }
  notify();
}

/** Remove tarefas finalizadas com mais de `olderThanMs` (default 5 min). */
export function pruneFinishedTasks(olderThanMs = 5 * 60 * 1000) {
  const cutoff = Date.now() - olderThanMs;
  const next = tasks.filter((t) => !t.endedAt || t.endedAt > cutoff);
  if (next.length !== tasks.length) {
    tasks = next;
    notify();
  }
}

// --- leitura reativa -------------------------------------------------

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// snapshots memoizados (mesma referência se nada mudou)
let eventsSnap = events;
let tasksSnap = tasks;
let eventsFp = "";
let tasksFp = "";

function getEvents(): ActivityEvent[] {
  const fp = events.length === 0 ? "" : `${events.length}:${events[events.length - 1].id}`;
  if (fp !== eventsFp) {
    eventsFp = fp;
    eventsSnap = events;
  }
  return eventsSnap;
}

function getTasks(): TrackedTask[] {
  const fp = tasks.map((t) => `${t.id}:${t.status}`).join("|");
  if (fp !== tasksFp) {
    tasksFp = fp;
    tasksSnap = tasks;
  }
  return tasksSnap;
}

export function useActivityEvents(): ActivityEvent[] {
  return useSyncExternalStore(subscribe, getEvents);
}

export function useTrackedTasks(): TrackedTask[] {
  return useSyncExternalStore(subscribe, getTasks);
}

/** Tarefas vivas (running/streaming/queued) — alimenta o indicador global. */
export function useActiveTaskCount(): number {
  const list = useTrackedTasks();
  return list.filter((t) => t.status === "running" || t.status === "streaming" || t.status === "queued").length;
}
