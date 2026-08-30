/**
 * Nexus OS — motor de aprendizado local ("o sistema aprende com o uso").
 *
 * Registra TUDO que o usuário faz dentro do OS (comandos executados, views
 * abertas, análises geradas, agentes rodados, coletas, exports, chats) num
 * log persistido (`aso:os-memory:v1`, cap 300 eventos) e deriva:
 *
 *  - FREQUÊNCIA: os comandos/ações mais usados (para atalhos proativos);
 *  - COBERTURA: quais seções de análise já foram geradas sobre o dataset;
 *  - INSIGHTS PROATIVOS: recomendações acionáveis ("você ainda não rodou
 *    Problemas", "o app X tem 58% de reviews negativos", "seu comando mais
 *    usado foi /stats — fixe-o como atalho").
 *
 * Tudo local, determinístico, sem rede — é a "memória" que torna o sistema
 * mais assertivo quanto mais o usuário trabalha.
 */
import { useEffect, useState } from "react";
import type { DatasetEntry } from "@/lib/datasetStore";
import { EXPERIMENT_SECTIONS } from "@/lib/experimentSections";

export type OSEventKind =
  | "command"   // comando de CLI/paleta executado
  | "view"      // view da coluna central aberta
  | "analysis"  // seção de análise de IA gerada
  | "agent"     // pipeline de agente executado
  | "collect"   // app coletado via OS
  | "chat"      // pergunta enviada ao chat do OS
  | "export";   // exportação disparada

export interface OSEvent {
  ts: number;
  kind: OSEventKind;
  /** identificador da ação: id do comando, da seção, do agente, da view… */
  id: string;
  detail?: string;
}

export type OSInsightTone = "info" | "warn" | "tip" | "action";

export interface OSInsight {
  id: string;
  tone: OSInsightTone;
  title: string;
  detail: string;
  /** Comando CLI sugerido (o botão "Executar" roda isso no console). */
  command?: string;
}

const KEY = "aso:os-memory:v1";
const MAX_EVENTS = 300;

type Listener = () => void;
const listeners = new Set<Listener>();

function read(): OSEvent[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

let cache: OSEvent[] | null = null;
function readCached(): OSEvent[] {
  if (cache === null) cache = read();
  return cache;
}

function write(list: OSEvent[]) {
  cache = list;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* quota — memória nunca quebra o sistema */
  }
  listeners.forEach((l) => l());
}

/** Registra um evento de uso. Timestamps estritamente crescentes. */
export function trackOSEvent(kind: OSEventKind, id: string, detail?: string) {
  const list = readCached();
  const lastTs = list.length > 0 ? list[list.length - 1].ts : 0;
  const ts = Math.max(Date.now(), lastTs + 1);
  write([...list, { ts, kind, id, detail }].slice(-MAX_EVENTS));
}

export function listOSEvents(): OSEvent[] {
  return readCached();
}

export function clearOSMemory() {
  write([]);
}

export function subscribeOSMemory(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Hook reativo (padrão useDataset: useState + subscribe). */
export function useOSEvents(): OSEvent[] {
  const [events, setEvents] = useState<OSEvent[]>(() => listOSEvents());
  useEffect(() => subscribeOSMemory(() => setEvents(listOSEvents())), []);
  return events;
}

/* ------------------------------------------------------------ derivações */

/** Frequência de uso por id de comando/ação, ordenada desc. */
export function commandFrequency(events: OSEvent[]): Array<[string, number]> {
  const freq = new Map<string, number>();
  for (const e of events) {
    if (e.kind === "command" || e.kind === "analysis" || e.kind === "agent") {
      freq.set(e.id, (freq.get(e.id) ?? 0) + 1);
    }
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]);
}

/** Cobertura de análises: quais seções de IA já foram geradas (e as que faltam). */
export function analysisCoverage(events: OSEvent[]): { done: string[]; missing: string[] } {
  const done = new Set(events.filter((e) => e.kind === "analysis").map((e) => e.id));
  const aiSections = EXPERIMENT_SECTIONS.filter((s) => s.kind === "ai").map((s) => s.id);
  return {
    done: aiSections.filter((id) => done.has(id)),
    missing: aiSections.filter((id) => !done.has(id)),
  };
}

/* --------------------------------------------------------- insights ----- */

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/**
 * Gera os insights proativos do OS a partir do dataset + memória de uso.
 * Ordenados por relevância (warn > action > tip > info). Determinístico.
 */
export function buildOSInsights(entries: DatasetEntry[], events: OSEvent[]): OSInsight[] {
  const insights: OSInsight[] = [];
  const totalReviews = entries.reduce((s, e) => s + e.reviews.length, 0);

  // 1. Sem dados — o passo zero.
  if (entries.length === 0) {
    insights.push({
      id: "no-data",
      tone: "action",
      title: "O OS precisa de dados para raciocinar",
      detail: "Colete o primeiro app (Apple ou Google Play). A partir daí, fatos, análises e decisões passam a ser gerados sobre dados reais.",
      command: "/collect ",
    });
    return prioritize(insights);
  }

  // 2. Apps com alta negatividade — alerta proativo.
  for (const e of entries) {
    const neg = e.reviews.filter((r) => r.rating <= 2).length;
    const pct = e.reviews.length > 0 ? Math.round((neg / e.reviews.length) * 100) : 0;
    if (e.reviews.length >= 10 && pct >= 40) {
      insights.push({
        id: `neg-${e.app.store}-${e.app.id}`,
        tone: "warn",
        title: `${e.app.name}: ${pct}% de reviews negativos`,
        detail: `${neg} de ${e.reviews.length} reviews são ★1-2. Vale investigar os problemas recorrentes antes da próxima release.`,
        command: "/analyze problems",
      });
    }
  }

  // 3. Cobertura de análises — o que ainda não foi explorado.
  const { done, missing } = analysisCoverage(events);
  if (done.length === 0) {
    insights.push({
      id: "first-analysis",
      tone: "action",
      title: "Nenhuma análise de IA gerada ainda",
      detail: `Você tem ${totalReviews} reviews coletados. Comece pelo Resumo executivo — ele orienta todas as análises seguintes.`,
      command: "/analyze summary",
    });
  } else if (missing.length > 0) {
    const label = EXPERIMENT_SECTIONS.find((s) => s.id === missing[0])?.label ?? missing[0];
    insights.push({
      id: "coverage",
      tone: "tip",
      title: `Cobertura de análises: ${done.length}/${done.length + missing.length}`,
      detail: `Próxima sugerida: ${label}. Cada análise concluída melhora o contexto das seguintes.`,
      command: `/analyze ${missing[0]}`,
    });
  }

  // 4. Volume grande sem decomposição quantitativa (versões/países).
  const withVersions = entries.reduce((s, e) => s + e.reviews.filter((r) => r.version).length, 0);
  if (totalReviews >= 200 && withVersions >= 20 && !done.includes("quantitative")) {
    insights.push({
      id: "versions",
      tone: "tip",
      title: "Dataset rico em versões",
      detail: `${withVersions} reviews têm versão do app. A análise quantitativa revela regressões entre releases.`,
      command: "/analyze quantitative",
    });
  }

  // 5. Hábito detectado — transformar uso repetido em consciência de atalho.
  const top = commandFrequency(events)[0];
  if (top && top[1] >= 3) {
    insights.push({
      id: "habit",
      tone: "info",
      title: `Hábito detectado: /${top[0]} (${top[1]}×)`,
      detail: "Você repete esta ação com frequência. Ela já aparece fixada nos atalhos da barra inferior.",
    });
  }

  // 6. Agentes nunca usados.
  const agentsUsed = new Set(events.filter((e) => e.kind === "agent").map((e) => e.id));
  if (agentsUsed.size === 0 && done.length >= 2) {
    insights.push({
      id: "agents",
      tone: "tip",
      title: "Delegue um fluxo inteiro a um agente",
      detail: "Os agentes executam pipelines completos (ex.: Produto = resumo → problemas → solicitações → oportunidades) sem intervenção.",
      command: "/agent seg-produto",
    });
  }

  // 7. Dataset unilateral (só uma loja).
  const stores = new Set(entries.map((e) => e.app.store));
  if (stores.size === 1) {
    const other = stores.has("apple") ? "Google Play" : "Apple App Store";
    insights.push({
      id: "one-store",
      tone: "info",
      title: "Visão de uma loja só",
      detail: `Todos os apps vêm da ${stores.has("apple") ? "Apple" : "Google"}. Coletar equivalentes na ${other} habilita comparativos cross-store.`,
      command: "/collect ",
    });
  }

  return prioritize(insights);
}

function prioritize(insights: OSInsight[]): OSInsight[] {
  const rank: Record<OSInsightTone, number> = { warn: 0, action: 1, tip: 2, info: 3 };
  return [...insights].sort((a, b) => rank[a.tone] - rank[b.tone]);
}

/** Score 0-100 de "quanto o OS conhece o seu contexto" (barra de aprendizado). */
export function learningScore(entries: DatasetEntry[], events: OSEvent[]): number {
  const totalReviews = entries.reduce((s, e) => s + e.reviews.length, 0);
  const { done } = analysisCoverage(events);
  const agentsUsed = new Set(events.filter((e) => e.kind === "agent").map((e) => e.id)).size;
  const data = clamp(entries.length * 10 + Math.min(totalReviews / 50, 20), 0, 30);
  const analyses = clamp(done.length * 5, 0, 40);
  const agents = clamp(agentsUsed * 5, 0, 15);
  const usage = clamp(events.length / 10, 0, 15);
  return clamp(Math.round(data + analyses + agents + usage), 0, 100);
}
