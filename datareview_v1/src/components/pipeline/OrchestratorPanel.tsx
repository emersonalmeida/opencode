/**
 * OrchestratorPanel — a mesa de decisão do orquestrador.
 *
 * Tabela viva com todas as análises candidatas pontuadas em
 * Potencial × Evidência × Custo → Prioridade (🔥 = vale o custo agora).
 * Cada score é explicável (tooltip com os motivos). O usuário pode executar
 * qualquer análise individualmente ou deixar o loop autônomo decidir.
 */
import { BrainCircuit, CheckCheck, Flame, Play } from "lucide-react";
import type { OrchestratorScore } from "@/lib/pipeline/orchestrator";
import { STAGE_META } from "@/lib/pipeline/types";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Props {
  scores: OrchestratorScore[];
  runningId: string | null;
  disabled: boolean;
  onRun: (analysisId: string) => void;
}

function ScoreBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className="flex items-center gap-1.5 min-w-[72px]">
      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", className ?? "bg-primary")}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-[10px] tabular-nums text-muted-foreground w-6 text-right">{value}</span>
    </div>
  );
}

const COST_LABEL: Record<string, string> = { baixo: "Baixo", "médio": "Médio", alto: "Alto" };

export function OrchestratorPanel({ scores, runningId, disabled, onRun }: Props) {
  const hot = scores.filter((s) => s.hot).length;
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 overflow-hidden flex flex-col min-h-0 h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-card/60 flex-shrink-0">
        <BrainCircuit className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-bold text-foreground">Orquestrador</h2>
        <span className="text-[10px] text-muted-foreground">
          {scores.length} análises · {hot} quentes 🔥
        </span>
        <span className="text-[9px] text-muted-foreground/70 ml-auto hidden lg:inline">
          prioridade = 50% potencial + 35% evidência + 15% custo
        </span>
      </div>
      <div className="overflow-auto min-h-0">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card/95 backdrop-blur-sm z-10">
            <tr className="text-[10px] text-muted-foreground border-b border-border/50">
              <th className="text-left font-medium px-3 py-1.5">Análise</th>
              <th className="text-left font-medium px-2 py-1.5 hidden md:table-cell">Estágio</th>
              <th className="text-left font-medium px-2 py-1.5">Potencial</th>
              <th className="text-left font-medium px-2 py-1.5">Evidência</th>
              <th className="text-left font-medium px-2 py-1.5 hidden sm:table-cell">Custo</th>
              <th className="text-left font-medium px-2 py-1.5">Prioridade</th>
              <th className="px-2 py-1.5" aria-label="ações" />
            </tr>
          </thead>
          <tbody>
            {scores.map((s) => {
              const meta = STAGE_META[s.analysis.stage];
              const running = runningId === s.analysis.id;
              return (
                <tr
                  key={s.analysis.id}
                  className={cn(
                    "border-b border-border/30 transition-colors",
                    s.hot ? "bg-primary/[0.04]" : s.alreadyRun ? "opacity-55" : "",
                    running && "bg-primary/10",
                  )}
                >
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-1.5">
                      {s.hot && <Flame className="h-3 w-3 text-orange-500 flex-shrink-0" aria-label="quente" />}
                      {s.alreadyRun && <CheckCheck className="h-3 w-3 text-emerald-500 flex-shrink-0" aria-label="já executada" />}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="font-medium text-foreground cursor-help truncate max-w-[180px] inline-block align-middle">
                            {s.analysis.label}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs text-xs">
                          <p>{s.analysis.description}</p>
                          {s.reasons.length > 0 && (
                            <ul className="mt-1 space-y-0.5 text-muted-foreground">
                              {s.reasons.map((r, i) => <li key={i}>· {r}</li>)}
                            </ul>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="text-[9px] text-muted-foreground/70 truncate max-w-[220px]">{s.analysis.description}</p>
                  </td>
                  <td className="px-2 py-1.5 hidden md:table-cell">
                    <span className={cn("inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full border", meta.color, meta.textColor)}>
                      {meta.short}
                    </span>
                  </td>
                  <td className="px-2 py-1.5"><ScoreBar value={s.potential} className="bg-violet-500" /></td>
                  <td className="px-2 py-1.5"><ScoreBar value={s.evidence} className="bg-sky-500" /></td>
                  <td className="px-2 py-1.5 hidden sm:table-cell">
                    <span className="text-[10px] text-muted-foreground">{COST_LABEL[s.analysis.cost]}</span>
                  </td>
                  <td className="px-2 py-1.5"><ScoreBar value={s.priority} className={s.hot ? "bg-orange-500" : "bg-primary"} /></td>
                  <td className="px-2 py-1.5 text-right">
                    <button
                      onClick={() => onRun(s.analysis.id)}
                      disabled={disabled || running}
                      aria-label={`Executar ${s.analysis.label}`}
                      className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-40"
                    >
                      <Play className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
