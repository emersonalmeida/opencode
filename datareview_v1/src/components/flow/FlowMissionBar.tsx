/**
 * FlowMissionBar — a "linha de estado" global do `/fluxo`, fixa no topo:
 * responde em tempo real "onde estou, o que já foi feito, o que falta".
 *
 * Mostra: progresso global, sinais do sistema (apps/reviews/escopo, insights,
 * candidatos, decks), tarefas em execução e o próximo passo sugerido.
 */
import { Sparkles, ArrowRight, Loader2 } from "lucide-react";
import type { FlowProgress, FlowSectionDef, FlowSnapshot } from "@/lib/flow/flowModel";

interface Props {
  snapshot: FlowSnapshot;
  progress: FlowProgress;
  next: FlowSectionDef | null;
  runningTasks: number;
  onGoTo: (id: string) => void;
}

export function FlowMissionBar({ snapshot, progress, next, runningTasks, onGoTo }: Props) {
  const chips: { label: string; value: string }[] = [
    { label: "apps", value: String(snapshot.apps) },
    { label: "reviews", value: snapshot.reviews.toLocaleString("pt-BR") },
    { label: "escopo", value: snapshot.selected > 0 ? `${snapshot.selected}` : "todos" },
    { label: "insights", value: String(snapshot.insights) },
    { label: "candidatos", value: String(snapshot.candidates) },
    { label: "decks", value: String(snapshot.decks) },
  ];

  return (
    <div
      className="sticky top-0 z-20 -mx-1 rounded-xl border border-border/60 bg-background/80 backdrop-blur-md px-4 py-3 shadow-sm"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-40">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
            <span className="font-semibold uppercase tracking-wide">Jornada de inteligência</span>
            {runningTasks > 0 && (
              <span className="inline-flex items-center gap-1 text-status-running">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                {runningTasks} em execução
              </span>
            )}
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <div
              className="h-1.5 w-40 rounded-full bg-secondary overflow-hidden"
              role="progressbar"
              aria-valuenow={progress.pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progresso da jornada"
            >
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${progress.pct}%` }}
              />
            </div>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {progress.done}/{progress.total} etapas · {progress.pct}%
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {chips.map((c) => (
            <span key={c.label} className="text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground tabular-nums">{c.value}</span> {c.label}
            </span>
          ))}
        </div>

        <div className="ml-auto">
          {next ? (
            <button
              onClick={() => onGoTo(next.id)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              Próximo passo: {next.title}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-status-success/10 px-3 py-1.5 text-xs font-medium text-status-success">
              ✓ Jornada completa — monitore e reinicie o ciclo
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
