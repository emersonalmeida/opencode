/**
 * Insights de IA sobre o dataset — o "feedback loop" do sistema.
 *
 * Toda geração de IA completa registra um insight indexado por appKeys +
 * section, de forma determinística e reutilizável. A página Pipeline de dados
 * expõe esses insights como estágio "Derivado", e qualquer superfície pode
 * consultar insights por app/section com `getInsights(appKey?)`.
 */
import { useEffect, useState } from "react";
import { datasetRevision } from "@/lib/datasetStore";

export interface InsightRecord {
  id: string;
  /** appKeys envolvidas (ex: "apple:123, google:com.x") */
  appKeys: string[];
  /** seção de análise (summary, problems, custom, lab-structured, etc.) */
  section: string;
  /** resumo curto (primeiras 200 chars do markdown) */
  summary: string;
  /** markdown completo */
  markdown: string;
  /** modelo/provider usado (ex.: "local gemma3:12b"), best-effort */
  provenance?: string;
  /** Revisão do dataset na geração (freshness/proveniência). */
  datasetRev?: number;
  generatedAt: number;
}

const STORAGE_KEY = "aso:insights:v1";
const CAP = 300;
const listeners = new Set<() => void>();
let items: InsightRecord[] = [];

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) items = JSON.parse(raw);
  } catch { /* corrupt */ }
}
load();

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  listeners.forEach((l) => l());
}

/**
 * Chame quando uma geração de IA completar (onComplete). Idempotente por call
 * (chamadas duplas com mesmo markdown/section/app evitam duplicar).
 */
export function recordInsight(
  appKeys: string[],
  section: string,
  markdown: string,
  provenance?: string,
): InsightRecord {
  const last = items[items.length - 1];
  if (
    last &&
    last.appKeys.join(",") === appKeys.join(",") &&
    last.section === section &&
    last.markdown === markdown
  ) {
    return last;
  }
  let datasetRev: number | undefined;
  try { datasetRev = datasetRevision(); } catch { /* storage indisponível */ }
  const rec: InsightRecord = {
    id: `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    appKeys,
    section,
    summary: markdown.trim().slice(0, 200),
    markdown,
    provenance,
    datasetRev,
    generatedAt: Date.now(),
  };
  items = [...items.slice(-CAP + 1), rec];
  persist();
  return rec;
}

export function listInsights(): InsightRecord[] {
  return [...items].reverse(); // newest first
}

export function getInsights(appKey?: string): InsightRecord[] {
  const all = listInsights();
  if (!appKey) return all;
  return all.filter((i) => i.appKeys.includes(appKey));
}

export function clearInsights() {
  items = [];
  persist();
}

export function subscribeInsights(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Hook reativo (padrão useDataset). */
export function useInsights(): InsightRecord[] {
  const [s, setS] = useState(items);
  useEffect(() => subscribeInsights(() => setS(items)), []);
  return s;
}
