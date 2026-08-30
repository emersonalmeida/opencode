/**
 * Monitoramento agendado (Onda 3.2): recoleta periódica configurável dos
 * apps do dataset com diff automático determinístico (novos reviews, variação
 * de nota e de % negativos). Tudo local: store `aso:monitors:v1` (pub/sub).
 *
 * Lib pura/testável — o runner (monitorRunner.ts) cuida do agendamento; a
 * UI (MonitorPanel na seção Monitorar do Fluxo) cuida da configuração.
 */
import type { ReviewEntry } from "@/lib/appStoreApi";

export interface MonitorSnapshot {
  at: number;
  reviewCount: number;
  avgRating: number;
  pctNegative: number;
}

export interface MonitorDiff {
  newReviews: number;
  ratingDelta: number;
  pctNegativeDelta: number;
  /** linha de resumo pronta para toast/atividade */
  summary: string;
}

export interface MonitorTask {
  id: string;
  /** `${store}:${id}` do app (chave do dataset). */
  appKey: string;
  appName: string;
  /** Intervalo em minutos entre recoletas. */
  intervalMin: number;
  enabled: boolean;
  lastRunAt?: number;
  lastSnapshot?: MonitorSnapshot;
  lastDiff?: MonitorDiff;
  createdAt: number;
}

export const MONITOR_INTERVALS = [
  { min: 60, label: "a cada hora" },
  { min: 360, label: "a cada 6h" },
  { min: 1440, label: "1× ao dia" },
  { min: 10080, label: "1× por semana" },
] as const;

const KEY = "aso:monitors:v1";
const CAP = 20;
type Listener = () => void;

function load(): MonitorTask[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isTask) : [];
  } catch {
    return [];
  }
}

function isTask(x: unknown): x is MonitorTask {
  const t = x as MonitorTask;
  return Boolean(t && typeof t.id === "string" && typeof t.appKey === "string" && typeof t.intervalMin === "number");
}

let tasks: MonitorTask[] = typeof localStorage !== "undefined" ? load() : [];
const listeners = new Set<Listener>();
let fp = "";

function fingerprint(): string {
  return tasks.map((t) => `${t.id}:${t.enabled}:${t.lastRunAt ?? 0}`).join("|");
}

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(tasks));
  } catch {
    // storage cheio — mantém em memória nesta sessão
  }
  listeners.forEach((l) => l());
}

// Snapshot memoizado (anti-loop no useSyncExternalStore): `fp` só avança
// na LEITURA (listMonitors), nunca no write — senão a leitura pós-write
// compara igual e devolve o snapshot velho.
let snap: MonitorTask[] = tasks;
if (typeof localStorage !== "undefined") fp = fingerprint();

/** Lista memoizada (referência estável entre writes — padrão useChatHistory). */
export function listMonitors(): MonitorTask[] {
  const current = fingerprint();
  if (current !== fp) {
    fp = current;
    snap = tasks;
  }
  return snap;
}

export function subscribeMonitors(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function addMonitor(input: { appKey: string; appName: string; intervalMin: number }): MonitorTask {
  const existing = tasks.find((t) => t.appKey === input.appKey);
  if (existing) {
    tasks = tasks.map((t) => (t.id === existing.id ? { ...t, intervalMin: input.intervalMin, enabled: true } : t));
    persist();
    return { ...existing, intervalMin: input.intervalMin, enabled: true };
  }
  const task: MonitorTask = {
    id: `mon_${Date.now().toString(36)}_${tasks.length}`,
    appKey: input.appKey,
    appName: input.appName,
    intervalMin: Math.max(15, input.intervalMin),
    enabled: true,
    createdAt: Date.now(),
  };
  tasks = [...tasks, task].slice(-CAP);
  persist();
  return task;
}

export function setMonitorEnabled(id: string, enabled: boolean): void {
  tasks = tasks.map((t) => (t.id === id ? { ...t, enabled } : t));
  persist();
}

export function removeMonitor(id: string): void {
  tasks = tasks.filter((t) => t.id !== id);
  persist();
}

/** Registra o resultado de uma recoleta (snapshot + diff). */
export function recordMonitorRun(id: string, snapshot: MonitorSnapshot, diff: MonitorDiff | null): void {
  tasks = tasks.map((t) =>
    t.id === id ? { ...t, lastRunAt: snapshot.at, lastSnapshot: snapshot, lastDiff: diff ?? t.lastDiff } : t,
  );
  persist();
}

/** Está na hora de rodar? (enabled + nunca rodou ou intervalo decorrido) */
export function isDue(t: MonitorTask, now = Date.now()): boolean {
  if (!t.enabled) return false;
  if (!t.lastRunAt) return true;
  return now - t.lastRunAt >= t.intervalMin * 60_000;
}

/** Tarefas prontas para recoletar agora. */
export function dueMonitors(now = Date.now()): MonitorTask[] {
  return listMonitors().filter((t) => isDue(t, now));
}

/** Snapshot determinístico de um conjunto de reviews. */
export function snapshotReviews(reviews: ReviewEntry[], at = Date.now()): MonitorSnapshot {
  const count = reviews.length;
  const avg = count ? reviews.reduce((s, r) => s + r.rating, 0) / count : 0;
  const neg = count ? reviews.filter((r) => r.rating <= 2).length : 0;
  return {
    at,
    reviewCount: count,
    avgRating: +avg.toFixed(2),
    pctNegative: count ? Math.round((neg / count) * 100) : 0,
  };
}

/** Diff entre snapshots — honesto (primeiro run = sem diff). */
export function diffSnapshots(prev: MonitorSnapshot | undefined, next: MonitorSnapshot): MonitorDiff | null {
  if (!prev) return null;
  const newReviews = Math.max(0, next.reviewCount - prev.reviewCount);
  const ratingDelta = +(next.avgRating - prev.avgRating).toFixed(2);
  const pctNegativeDelta = next.pctNegative - prev.pctNegative;
  const parts: string[] = [];
  parts.push(newReviews > 0 ? `+${newReviews} reviews novos` : "sem reviews novos");
  if (ratingDelta !== 0) parts.push(`nota ${ratingDelta > 0 ? "+" : ""}${ratingDelta}`);
  if (pctNegativeDelta !== 0) parts.push(`negativos ${pctNegativeDelta > 0 ? "+" : ""}${pctNegativeDelta}pp`);
  return { newReviews, ratingDelta, pctNegativeDelta, summary: parts.join(" · ") };
}

/** Etiqueta de próxima execução para a UI. */
export function nextRunLabel(t: MonitorTask, now = Date.now()): string {
  if (!t.enabled) return "desativado";
  if (!t.lastRunAt) return "agora";
  const remaining = t.lastRunAt + t.intervalMin * 60_000 - now;
  if (remaining <= 0) return "agora";
  const min = Math.ceil(remaining / 60_000);
  if (min < 60) return `em ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `em ${h}h${min % 60 ? ` ${min % 60}min` : ""}`;
  return `em ${Math.floor(h / 24)}d`;
}
