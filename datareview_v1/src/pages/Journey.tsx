import { useEffect, useMemo, useState } from "react";
import { confirmDestructive } from "@/lib/ux";
import { Link } from "react-router-dom";
import {
  Search, Database, BrainCircuit, BarChart3, Scale, Presentation,
  Check, ChevronLeft, ChevronRight, RotateCcw, ArrowRight,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { useDataset } from "@/hooks/useDataset";
import { useSelection, entryKey } from "@/context/SelectionContext";
import {
  JOURNEY_STEPS, loadJourney, saveJourney, subscribeJourney,
  resetJourney, advanceTo, goTo, nextStep, prevStep, stepStatus,
  journeyProgress, type JourneyState, type JourneyStepId,
} from "@/lib/journey";
import { StageDiscover } from "@/components/journey/StageDiscover";
import { StageCollect } from "@/components/journey/StageCollect";
import { StageAnalyze } from "@/components/journey/StageAnalyze";
import { StageVisualize } from "@/components/journey/StageVisualize";
import { StageDecide } from "@/components/journey/StageDecide";
import { StagePresent } from "@/components/journey/StagePresent";
import type { LucideIcon } from "lucide-react";

const STEP_ICONS: Record<JourneyStepId, LucideIcon> = {
  descobrir: Search,
  coletar: Database,
  analisar: BrainCircuit,
  visualizar: BarChart3,
  decidir: Scale,
  apresentar: Presentation,
};

/**
 * `/jornada` — a página que junta todas as páginas: pipeline guiado de ponta
 * a ponta (Descobrir → Coletar → Analisar → Visualizar → Decidir → Apresentar).
 * Estado persistido (aso:journey:v1) — o usuário retoma de onde parou.
 */
export default function Journey({ embedded = false }: { embedded?: boolean }) {
  const [state, setState] = useState<JourneyState>(() => loadJourney());
  const { entries } = useDataset();
  const { selected } = useSelection();

  useEffect(() => subscribeJourney(() => setState(loadJourney())), []);

  const scoped = useMemo(
    () => (selected.size > 0
      ? entries.filter((e) => selected.has(entryKey(e.app.store, e.app.id)))
      : entries),
    [entries, selected],
  );

  const step = JOURNEY_STEPS.find((s) => s.id === state.currentStep)!;
  const progress = journeyProgress(state);
  const next = nextStep(state.currentStep);
  const prev = prevStep(state.currentStep);

  const advance = () => {
    if (!next) return;
    const nextState = advanceTo(state, next);
    saveJourney(nextState);
  };
  const back = () => {
    if (!prev) return;
    saveJourney(goTo(state, prev));
  };
  const jump = (id: JourneyStepId) => saveJourney(goTo(state, id));
  const restart = () => resetJourney();

  return (
    <div className="h-full flex flex-col">
      {!embedded && (
        <AppHeader
          title="Jornada"
          crumb={`${step.label} · etapa ${JOURNEY_STEPS.findIndex((s) => s.id === state.currentStep) + 1} de ${JOURNEY_STEPS.length}`}
        />
      )}

      {/* Barra de progresso global */}
      <div className="h-1 bg-secondary/60" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso da jornada">
        <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      <div className="flex-1 min-h-0 flex">
        {/* Stepper lateral */}
        <nav aria-label="Etapas da jornada" className="w-56 shrink-0 border-r border-border/60 p-3 space-y-1 overflow-y-auto">
          {JOURNEY_STEPS.map((s, i) => {
            const st = stepStatus(state, s.id);
            const Icon = STEP_ICONS[s.id];
            return (
              <button
                key={s.id}
                onClick={() => jump(s.id)}
                aria-current={st === "current" ? "step" : undefined}
                className={`w-full flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors ${
                  st === "current"
                    ? "bg-primary/10 border border-primary/40"
                    : "hover:bg-secondary/60 border border-transparent"
                }`}
              >
                <span
                  className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${
                    st === "done"
                      ? "bg-success text-success-foreground"
                      : st === "current"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {st === "done" ? <Check className="h-3 w-3" aria-hidden /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <Icon className="h-3 w-3 text-muted-foreground shrink-0" aria-hidden />
                    <span className="text-xs font-semibold truncate">{s.label}</span>
                  </span>
                  <span className="block text-[10px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">{s.desc}</span>
                </span>
              </button>
            );
          })}

          <div className="pt-3 border-t border-border/60 mt-3">
            <button
              onClick={() => { if (confirmDestructive("Recomeçar a jornada do zero?", "O progresso atual será perdido.")) restart(); }}
              className="w-full inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-md text-muted-foreground hover:bg-secondary/60"
            >
              <RotateCcw className="h-3 w-3" aria-hidden /> Recomeçar jornada
            </button>
            <p className="text-[9px] text-muted-foreground px-3 pt-1 leading-snug">
              {progress}% concluído · progresso salvo automaticamente
            </p>
          </div>
        </nav>

        {/* Conteúdo da etapa */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          <div className="content-fluid py-6">
            {state.currentStep === "descobrir" && <StageDiscover />}
            {state.currentStep === "coletar" && <StageCollect />}
            {state.currentStep === "analisar" && <StageAnalyze scoped={scoped} />}
            {state.currentStep === "visualizar" && <StageVisualize scoped={scoped} />}
            {state.currentStep === "decidir" && <StageDecide scoped={scoped} />}
            {state.currentStep === "apresentar" && <StagePresent scoped={scoped} onRestart={restart} />}

            {/* Navegação da etapa */}
            <div className="flex items-center justify-between gap-3 mt-8 pt-5 border-t border-border/60">
              {prev ? (
                <button
                  onClick={back}
                  className="inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden /> {JOURNEY_STEPS.find((s) => s.id === prev)!.label}
                </button>
              ) : <span />}
              {next ? (
                <button
                  onClick={advance}
                  className="inline-flex items-center gap-1.5 text-sm px-5 py-2.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90"
                >
                  Concluir e ir para {JOURNEY_STEPS.find((s) => s.id === next)!.label}
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              ) : (
                <button
                  onClick={() => { saveJourney(advanceTo(state, state.currentStep)); }}
                  className="inline-flex items-center gap-1.5 text-sm px-5 py-2.5 rounded-lg bg-success text-success-foreground hover:opacity-90"
                >
                  <Check className="h-4 w-4" aria-hidden /> Concluir jornada
                </button>
              )}
            </div>

            {/* Deep link para a página especializada */}
            <p className="text-[11px] text-muted-foreground mt-4">
              Quer mais controle nesta etapa?{" "}
              <Link to={step.deepLink} className="text-primary hover:underline inline-flex items-center gap-1">
                Abrir {step.deepLinkLabel} <ArrowRight className="h-3 w-3" aria-hidden />
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
