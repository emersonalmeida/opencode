/**
 * Núcleo (Core Page) — agrega os sinais do sistema numa visão pura (testável):
 * sinais do Fluxo (dataset, IA, análises, decisões, oportunidades, decks),
 * tarefas vivas (activityStore) e os membros do modelo do Fluxo com status.
 * A página `/nucleo` renderiza esse agregado; o mesmo agregado alimenta a
 * seção Monitorar do Fluxo.
 */
import type { FlowSnapshot } from "@/lib/flow/flowModel";

export type SignalTone = "ok" | "warn" | "attention" | "live";

export interface NucleoSignal {
  id: string;
  emoji: string;
  level: SignalTone;
  label: string;
  detail?: string;
}

/** Constrói os sinais do sistema a partir do snapshot do Fluxo.
 *  Ordena com atenções primeiro (warn/attention) e live depois. */
export function buildSignals(s: FlowSnapshot): NucleoSignal[] {
  const sigs: NucleoSignal[] = [];

  sigs.push({
    id: "dataset",
    emoji: "🗄",
    level: s.apps > 0 ? "ok" : "attention",
    label: s.apps > 0 ? "Dataset pronto" : "Dataset vazio",
    detail:
      s.apps > 0
        ? `${s.apps} app(s) · ${s.reviews.toLocaleString("pt-BR")} reviews coletados.`
        : "Colete apps em Descobrir → Coletar para ativar o sistema.",
  });

  sigs.push({
    id: "selection",
    emoji: "✅",
    level: "ok",
    label: s.selected > 0 ? `${s.selected} app(s) selecionados` : "Escopo = todos os apps",
  });

  if (s.insights > 0)
    sigs.push({ id: "insights", emoji: "💡", level: "ok", label: `${s.insights} insight(s) de IA` });

  if (s.artifacts > 0)
    sigs.push({ id: "artifacts", emoji: "🧱", level: "ok", label: `${s.artifacts} artefato(s) no vault` });

  if (s.findings > 0)
    sigs.push({ id: "findings", emoji: "🧪", level: "ok", label: `${s.findings} finding(s) do Lab` });

  if (s.candidates > 0)
    sigs.push({ id: "candidates", emoji: "🚀", level: "ok", label: `${s.candidates} produto(s) candidato(s)` });

  if (s.decks > 0)
    sigs.push({ id: "decks", emoji: "📊", level: "ok", label: `${s.decks} deck(s) de apresentação` });

  if (s.canvasNodes > 0)
    sigs.push({ id: "canvas", emoji: "🕸", level: "ok", label: `Canvas com ${s.canvasNodes} nó(s)` });

  if (s.designPages > 0)
    sigs.push({ id: "design", emoji: "🎨", level: "ok", label: `Design Canvas: ${s.designPages} página(s)` });

  return sigs;
}

/** Ordena: warn/attention primeiro, ok depois. Estável dentro do grupo. */
export function sortSignals(sigs: NucleoSignal[]): NucleoSignal[] {
  const rank: Record<SignalTone, number> = { attention: 0, warn: 1, live: 2, ok: 3 };
  return [...sigs].sort((a, b) => rank[a.level] - rank[b.level]);
}
