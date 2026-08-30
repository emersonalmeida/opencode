/**
 * FlowActivity — timeline global do sistema (activityStore), a "linha do
 * tempo vivo" do System Flow na seção Monitorar (`/fluxo`).
 *
 * Filtros por origem (coleta/canvas/pipeline/agente/ia/sistema/outros) e por
 * fase (tudo/erro/concluído/em progresso), persistidos — sempre com saída
 * preferida por acessibilidade (estado ≠ cor).
 */
import { useMemo, useState } from "react";
import { useActivityEvents, useTrackedTasks } from "@/lib/activityStore";
import { PHASE_META } from "@/lib/statusSystem";
import { EmptyState } from "@/components/shared/EmptyState";
import { Activity, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

const COLOR_CLASS: Record<string, string> = {
  info: "text-status-info",
  running: "text-status-running",
  success: "text-status-success",
  error: "text-status-error",
  skipped: "text-status-skipped",
  warning: "text-status-warning",
  idle: "text-muted-foreground",
};

/** Filtros persistidos (origem + fase). */
const FILTER_KEY = "aso:flow-activity-filter";
function loadFilters(): { source: string; phase: string } {
  try {
    const raw = localStorage.getItem(FILTER_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return { source: p.source ?? "todos", phase: p.phase ?? "todos" };
    }
  } catch { /* ignore */ }
  return { source: "todos", phase: "todos" };
}
function saveFilters(source: string, phase: string) {
  try {
    localStorage.setItem(FILTER_KEY, JSON.stringify({ source, phase }));
  } catch { /* quota */ }
}

function fmtTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "";
  }
}

const KNOWN_SOURCES = ["todos", "coleta", "canvas", "pipeline", "agente", "ia", "sistema", "outros"];
const PHASE_FILTERS: { id: string; label: string }[] = [
  { id: "todos", label: "Tudo" },
  { id: "error", label: "Erros" },
  { id: "done", label: "Concluídos" },
  { id: "running", label: "Em progresso" },
  { id: "skip", label: "Ignorados" },
];

export function FlowActivity({ limit = 30 }: { limit?: number }) {
  const events = useActivityEvents();
  const tasks = useTrackedTasks();
  const [filters, setFilters] = useState<{ source: string; phase: string }>(() => loadFilters());
  const active = tasks.filter((t) => t.status === "running" || t.status === "streaming" || t.status === "queued");

  const filtered = useMemo(() => {
    return events.filter((ev) => {
      const srcOk =
        filters.source === "todos" ||
        (filters.source === "outros"
          ? !["coleta", "canvas", "pipeline", "agente", "ia", "sistema"].includes(ev.source)
          : ev.source === filters.source);
      const phOk =
        filters.phase === "todos" ||
        (filters.phase === "running"
          ? ev.phase === "start" || ev.phase === "progress" || ev.phase === "plan"
          : ev.phase === filters.phase);
      return srcOk && phOk;
    });
  }, [events, filters]);

  const recent = [...filtered].reverse().slice(0, limit);

  const setSource = (source: string) => {
    saveFilters(source, filters.phase);
    setFilters({ source, phase: filters.phase });
  };
  const setPhase = (phase: string) => {
    saveFilters(filters.source, phase);
    setFilters({ source: filters.source, phase });
  };

  return (
    <div className="space-y-3" role="log" aria-label="Timeline de atividade do sistema">
      {active.length > 0 && (
        <div className="rounded-lg border border-status-running/30 bg-status-running/5 p-2.5">
          <p className="text-[11px] font-semibold text-status-running">Em execução agora</p>
          <ul className="mt-1 space-y-1">
            {active.map((t) => (
              <li key={t.id} className="text-xs">
                <span className="font-medium">{t.label}</span>
                {t.detail && <span className="text-muted-foreground"> — {t.detail}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Filtros por origem + fase */}
      <div className="space-y-1.5" aria-label="Filtros da timeline">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
            <Filter className="h-3 w-3" aria-hidden /> Origem
          </span>
          {KNOWN_SOURCES.map((s) => (
            <button
              key={s}
              onClick={() => setSource(s)}
              aria-pressed={filters.source === s}
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] capitalize",
                filters.source === s
                  ? "bg-primary/15 text-primary"
                  : "bg-secondary text-muted-foreground hover:text-foreground",
              )}
            >
              {s === "todos" ? "Tudo" : s}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold text-muted-foreground">Fase</span>
          {PHASE_FILTERS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPhase(p.id)}
              aria-pressed={filters.phase === p.id}
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px]",
                filters.phase === p.id
                  ? "bg-primary/15 text-primary"
                  : "bg-secondary text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {recent.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="Nenhuma atividade no filtro atual"
          description="Ajuste os filtros acima — ou comece uma coleta/análise para ver a timeline preenchida."
          compact
        />
      ) : (
        <ol className="space-y-1.5" aria-label="Atividades filtradas">
          {recent.map((ev) => {
            const meta = PHASE_META[ev.phase];
            return (
              <li key={ev.id} className="flex items-baseline gap-2 text-xs">
                <span className="shrink-0 tabular-nums text-[10px] text-muted-foreground">{fmtTime(ev.ts)}</span>
                <span className={cn("shrink-0 font-medium", COLOR_CLASS[meta.color] ?? "text-muted-foreground")}>
                  {meta.label}
                </span>
                <span className="min-w-0">
                  <span className="font-medium">{ev.message}</span>
                  {ev.detail && <span className="text-muted-foreground"> — {ev.detail}</span>}
                  <span className="text-muted-foreground/60"> [{ev.source}]</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
