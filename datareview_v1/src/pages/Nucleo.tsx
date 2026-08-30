/**
 * /nucleo — Core Page: o ponto de controle do sistema.
 *
 * Agrega (sem sair da página):
 *  • Sinais do sistema — builder puro (`src/lib/nucleo.ts`) sobre o Flow.
 *  • Pipeline do Fluxo — os 16 estágios macro com status e contadores; clique
 *    navega para /fluxo com a seção focada.
 *  • Memória do sistema — eventos do Nexus OS, insights proativos e score de
 *  • aprendizado (sempre o que o sistema já viu).
 */
import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Atom, Lightbulb, Activity, Cpu, Network, Check, AlertTriangle, Loader2, MinusCircle } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { ErrorBoundary } from "@/components/dashboard/ErrorBoundary";
import { useFlowScope } from "@/components/flow/useFlowScope";
import { useTrackedTasks } from "@/lib/activityStore";
import {
  FLOW_SECTIONS, allSectionStates, flowProgress, sectionForTask,
  type FlowSectionState, type FlowSectionId,
} from "@/lib/flow/flowModel";
import { setFocusedSection } from "@/lib/flow/flowFocus";
import { buildSignals, sortSignals, type NucleoSignal } from "@/lib/nucleo";
import {
  useOSEvents, buildOSInsights, learningScore, commandFrequency,
  type OSInsight,
} from "@/lib/os/memory";
import { useInsights } from "@/lib/insightStore";
import { useArtifacts } from "@/lib/pipeline/artifactStore";
import { useLabFindings, useLabProductCandidates } from "@/lib/lab/hooks";
import { useAIOutputs } from "@/lib/aiOutputStore";
import { useGenerations } from "@/hooks/useSessions";
import { useCanvasStore } from "@/lib/canvasStore";
import { useDesignStore } from "@/lib/designCanvas/store";
import { listDecks, subscribePresentations, type Deck } from "@/lib/presentations";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const TONE_CLASS: Record<NucleoSignal["level"], string> = {
  attention: "border-status-warning/50 bg-status-warning/5",
  warn: "border-status-warning/50 bg-status-warning/5",
  ok: "border-border/50 bg-background/60",
  live: "border-primary/40 bg-primary/5",
};

export default function Nucleo({ embedded = false }: { embedded?: boolean }) {
  return (
    <ErrorBoundary title="Erro ao renderizar o Núcleo">
      <NucleoInner embedded={embedded} />
    </ErrorBoundary>
  );
}

function NucleoInner({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const { entries, selected, totalReviews } = useFlowScope();
  const insights = useInsights();
  const artifacts = useArtifacts();
  const findings = useLabFindings();
  const candidates = useLabProductCandidates();
  const outputs = useAIOutputs();
  const generations = useGenerations();
  const canvasNodes = useCanvasStore((s) => s.nodes);
  const designPages = useDesignStore((s) => s.pages);
  const tasks = useTrackedTasks();
  const events = useOSEvents();
  const [decks, setDecks] = useState<Deck[]>(() => listDecks());
  useEffect(() => subscribePresentations(() => setDecks(listDecks())), []);

  const snapshot = useMemo(
    () => ({
      apps: entries.length,
      reviews: totalReviews,
      selected: selected.size,
      insights: insights.length,
      artifacts: artifacts.length,
      findings: findings.length,
      candidates: candidates.length,
      decks: decks.length,
      outputs: outputs.length,
      generations: generations.length,
      canvasNodes: canvasNodes.length,
      designPages: designPages.length,
    }),
    [entries, totalReviews, selected, insights, artifacts, findings, candidates, decks, outputs, generations, canvasNodes, designPages],
  );

  const signals = useMemo(() => sortSignals(buildSignals(snapshot)), [snapshot]);
  const osInsights = useMemo(() => buildOSInsights(entries, events), [entries, events]);
  const score = useMemo(() => learningScore(entries, events), [entries, events]);
  const freq = useMemo(() => commandFrequency(events).slice(0, 6), [events]);

  const states = useMemo(() => {
    const base = allSectionStates(snapshot) as Record<FlowSectionId, FlowSectionState>;
    const active = tasks.filter((t) => t.status === "running" || t.status === "streaming" || t.status === "queued");
    for (const t of active) {
      const secId = sectionForTask(t);
      if (!secId) continue;
      const b = base[secId];
      if (!b || b.status === "done" || b.status === "done-warning") continue;
      base[secId] = { ...b, status: t.status === "streaming" ? "processing" : "running" };
    }
    return base;
  }, [snapshot, tasks]);

  const progress = flowProgress(states);

  const openFlowSection = (id: FlowSectionId) => {
    setFocusedSection(id);
    navigate("/fluxo");
    // dispara após o Flow montar (o handler vive nas seções)
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("flow:open", { detail: id }));
      document.getElementById(`flow-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  };

  return (
    <div className="min-h-full">
      {!embedded && (
        <AppHeader
          title="Núcleo"
          crumb="Core Page — sinais, memória e controle do sistema"
        />
      )}
      <div className="mx-auto w-full max-w-[1100px] px-4 py-5 space-y-5">
        {/* sinais */}
        <section aria-label="Sinais do sistema">
          <div className="mb-2 flex items-center gap-2">
            <Atom className="h-4 w-4 text-primary" aria-hidden />
            <h2 className="text-sm font-semibold">Sinais do sistema</h2>
            <span className="text-[10px] text-muted-foreground" role="status">
              {signals.length} sinal(s)
            </span>
          </div>
          <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {signals.map((s) => (
              <li key={s.id} className={cn("rounded-lg border px-2.5 py-2", TONE_CLASS[s.level])}>
                <p className="flex items-center gap-1.5 text-xs font-medium">
                  <span aria-hidden>{s.emoji}</span> {s.label}
                </p>
                {s.detail && <p className="mt-0.5 text-[10px] text-muted-foreground">{s.detail}</p>}
              </li>
            ))}
          </ul>
        </section>

        {/* pipeline do fluxo */}
        <section aria-label="Pipeline do Fluxo">
          <div className="mb-2 flex items-center gap-2">
            <Network className="h-4 w-4 text-primary" aria-hidden />
            <h2 className="text-sm font-semibold">Pipeline do Fluxo</h2>
            <span className="text-[10px] text-muted-foreground" role="status">
              {progress.done}/{progress.total} concluídas ({progress.pct}%)
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-secondary overflow-hidden mb-2" role="progressbar" aria-valuenow={progress.pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso do Fluxo">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress.pct}%` }} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FLOW_SECTIONS.map((sec) => {
              const st = states[sec.id];
              const Icon = st?.status === "done" ? Check : st?.status === "blocked" || st?.status === "error" ? AlertTriangle : st?.status === "done-warning" ? AlertTriangle : st?.status === "running" || st?.status === "processing" ? Loader2 : MinusCircle;
              return (
                <button
                  key={sec.id}
                  onClick={() => openFlowSection(sec.id)}
                  title={sec.subtitle}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px]",
                    st?.status === "done"
                      ? "border-primary/40 bg-primary/5"
                      : st?.status === "blocked" || st?.status === "error" || st?.status === "done-warning"
                        ? "border-status-warning/60 bg-status-warning/10"
                        : "border-border/50 bg-background/60 hover:bg-secondary",
                  )}
                >
                  <Icon className={cn("h-3 w-3", (st?.status === "running" || st?.status === "processing") && "animate-spin")} aria-hidden />
                  <span className="font-medium">{sec.num}</span>
                  <span>{sec.title}</span>
                </button>
              );
            })}
          </div>
          <Link to="/fluxo" className="mt-2 inline-block text-[11px] text-primary hover:underline">
            Abrir o Fluxo completo →
          </Link>
        </section>

        {/* memória */}
        <section aria-label="Memória do sistema">
          <div className="mb-2 flex items-center gap-2">
            <Cpu className="h-4 w-4 text-primary" aria-hidden />
            <h2 className="text-sm font-semibold">Memória do sistema</h2>
            <span
              className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary"
              role="status"
              title="Aprendizado com base nos eventos registrados"
            >
              {score} aprendizado
            </span>
          </div>

          {events.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nenhum evento registrado ainda. O sistema aprende com coletas, análises, comandos e exports — cada ação vira memória e orienta os insights abaixo.
            </p>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              <div>
                {osInsights.length > 0 && (
                  <>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Insights proativos</p>
                    <ul className="space-y-1.5 mb-3">
                      {osInsights.slice(0, 4).map((i: OSInsight) => (
                        <li key={i.id} className="rounded-md border border-border/40 bg-background/60 px-2.5 py-1.5 text-xs flex items-start gap-2">
                          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                          <div className="min-w-0">
                            <p className="font-medium">{i.title}</p>
                            {i.detail && <p className="text-[10px] text-muted-foreground">{i.detail}</p>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Comandos mais usados</p>
                {freq.length > 0 ? (
                  <ul className="space-y-0.5">
                    {freq.map(([cmd, n]) => (
                      <li key={cmd} className="flex justify-between rounded px-1.5 py-1 text-[11px]">
                        <span className="font-mono">{cmd}</span>
                        <span className="text-muted-foreground">×{n}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[11px] text-muted-foreground">Ainda sem comandos.</p>
                )}
              </div>
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Eventos recentes</p>
                <ul className="max-h-64 overflow-y-auto space-y-0.5" role="log" aria-label="Eventos recentes do Nexus OS">
                  {events.slice(0, 12).map((e) => (
                    <li key={e.id} className="flex items-center gap-2 rounded px-1.5 py-1 text-[11px]">
                      <span className="w-24 truncate font-mono text-muted-foreground">{e.kind}</span>
                      <span className="flex-1 truncate">{e.detail}</span>
                      <span className="text-[10px] text-muted-foreground">{new Date(e.ts).toLocaleTimeString("pt-BR")}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
