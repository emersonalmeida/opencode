/**
 * Session store — persistência unificada de tudo que é coletado e gerado.
 *
 * Princípio: "nada se perde". Toda coleta de app/reviews e toda geração de IA
 * (atlas run, canvas run, chat) é registrada como um evento de sessão em
 * localStorage, organizado e pesquisável, para ser acessado novamente sem
 * precisar refazer. O dataset coletado continua vivendo no `datasetStore`
 * (fonte de verdade dos apps/reviews); aqui fica o **histórico de atividade**
 * (o que foi gerado, quando, sobre quais apps) + os **snapshots de canvas**
 * salvos pelo usuário.
 *
 * Duas coleções:
 *  - `generations`: log append-only de gerações (IA + coletas). Cap 200.
 *  - `canvasSessions`: snapshots nomeados do canvas (nodes/edges/outputs).
 *
 * Pub/sub como os demais stores (datasetStore, chatHistoryStore).
 */
import type { CanvasNode, CanvasEdge } from "@/lib/canvasStore";
import { datasetRevision } from "@/lib/datasetStore";

/** Tipo de evento de geração registrado no histórico. */
export type GenerationType =
  | "collect"       // coleta de app/reviews
  | "atlas-run"     // execução de módulo(s) do Atlas
  | "canvas-run"    // execução de pipeline do Canvas
  | "chat"          // resposta de IA no chat
  | "ai-section";   // análise de IA isolada (AppDetail/Compare/Dashboard)

export interface GenerationRecord {
  id: string;
  type: GenerationType;
  /** Título legível (ex.: "Pipeline completo", "Nubank · 500 reviews"). */
  title: string;
  /** Chaves dos apps no escopo, formato `${store}:${id}`. */
  appKeys: string[];
  /** Resultado em markdown (gerações de IA). Vazio para coletas. */
  markdown?: string;
  /** Resumo curto (ex.: "532 reviews coletados"). */
  summary?: string;
  /** Origem: qual página/disparou (atlas, canvas, chat, appdetail...). */
  source?: string;
  /** Revisão do dataset (`datasetRevision()`) no momento da geração —
   *  proveniência/freshness: se o dataset avançou depois, esta geração é
   *  potencialmente desatualizada. */
  datasetRev?: number;
  createdAt: number;
}

export interface CanvasSnapshot {
  id: string;
  title: string;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  /** Outputs computados no momento do snapshot (sobrevive ao reload). */
  outputs: Record<string, unknown>;
  status: Record<string, string>;
  createdAt: number;
}

const GEN_KEY = "aso:generations:v1";
const SNAP_KEY = "aso:canvas-sessions:v1";
const MAX_GENERATIONS = 200;
const MAX_SNAPSHOTS = 50;

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() { listeners.forEach((l) => l()); }

function readGen(): GenerationRecord[] {
  try { return JSON.parse(localStorage.getItem(GEN_KEY) || "[]"); } catch { return []; }
}
function writeGen(list: GenerationRecord[]) {
  try {
    localStorage.setItem(GEN_KEY, JSON.stringify(list.slice(-MAX_GENERATIONS)));
  } catch {
    // Quota — drop oldest half and retry once.
    try { localStorage.setItem(GEN_KEY, JSON.stringify(list.slice(-Math.floor(MAX_GENERATIONS / 2)))); } catch { /* give up */ }
  }
  notify();
}

function readSnaps(): CanvasSnapshot[] {
  try { return JSON.parse(localStorage.getItem(SNAP_KEY) || "[]"); } catch { return []; }
}
function writeSnaps(list: CanvasSnapshot[]) {
  try {
    localStorage.setItem(SNAP_KEY, JSON.stringify(list.slice(-MAX_SNAPSHOTS)));
  } catch {
    try { localStorage.setItem(SNAP_KEY, JSON.stringify(list.slice(-Math.floor(MAX_SNAPSHOTS / 2)))); } catch { /* give up */ }
  }
  notify();
}

function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Registra uma geração no histórico (append). Retorna o id. */
export function recordGeneration(rec: Omit<GenerationRecord, "id" | "createdAt" | "datasetRev">): string {
  const list = readGen();
  const id = genId("gen");
  // Guarantee strictly-increasing timestamps so newest-first sort is stable
  // even when multiple records are created within the same millisecond.
  const lastTs = list.length ? list[list.length - 1].createdAt : 0;
  const createdAt = Math.max(Date.now(), lastTs + 1);
  // Proveniência: revisão do dataset na hora da geração (freshness).
  let datasetRev: number | undefined;
  try { datasetRev = datasetRevision(); } catch { /* storage indisponível */ }
  list.push({ ...rec, id, createdAt, datasetRev });
  writeGen(list);
  return id;
}

/** Lista gerações (mais recentes primeiro), opcionalmente filtradas por tipo. */
export function listGenerations(type?: GenerationType): GenerationRecord[] {
  const all = readGen().sort((a, b) => b.createdAt - a.createdAt);
  return type ? all.filter((g) => g.type === type) : all;
}

export function getGeneration(id: string): GenerationRecord | undefined {
  return readGen().find((g) => g.id === id);
}

export function deleteGeneration(id: string) {
  writeGen(readGen().filter((g) => g.id !== id));
}

/** Restaura gerações (ex.: undo de limpeza do histórico). */
export function restoreGenerations(records: GenerationRecord[]) {
  const list = readGen();
  const merged = [...records, ...list.filter((g) => !records.some((r) => r.id === g.id))];
  writeGen(merged);
}

export function clearGenerations() { writeGen([]); }

/* ----------------------------------------------------- canvas snapshots -- */

export function saveCanvasSnapshot(
  title: string,
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  outputs: Record<string, unknown>,
  status: Record<string, string>,
): string {
  const list = readSnaps();
  const id = genId("snap");
  const lastTs = list.length ? list[list.length - 1].createdAt : 0;
  const createdAt = Math.max(Date.now(), lastTs + 1);
  list.push({ id, title, nodes, edges, outputs, status, createdAt });
  writeSnaps(list);
  return id;
}

export function listSnapshots(): CanvasSnapshot[] {
  return readSnaps().sort((a, b) => b.createdAt - a.createdAt);
}

export function getSnapshot(id: string): CanvasSnapshot | undefined {
  return readSnaps().find((s) => s.id === id);
}

export function deleteSnapshot(id: string) {
  writeSnaps(readSnaps().filter((s) => s.id !== id));
}

export function renameSnapshot(id: string, title: string) {
  const list = readSnaps();
  const idx = list.findIndex((s) => s.id === id);
  if (idx >= 0) { list[idx] = { ...list[idx], title }; writeSnaps(list); }
}

export function clearSnapshots() { writeSnaps([]); }

/* ----------------------------------------------------------- subscribe -- */

export function subscribeSessions(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
