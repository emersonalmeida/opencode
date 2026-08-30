/**
 * Painel do agendador de sondas (A10) — fila sequencial com status por fonte.
 * Botão simples: "Iniciar sondas" (ou "Retomar"/"Parar"/"Recomeçar") +
 * progresso e lista das mais recentes. Persiste estados em localStorage.
 */
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AUDIT_PROBES } from "@/lib/audit/auditProbes";
import {
  BUDGET_LIMITS,
  getBudget,
  getSchedulerState,
  setBudget,
  startScheduler,
  stopScheduler,
  restartScheduler,
  subscribeScheduler,
} from "@/lib/audit/auditScheduler";
import { CheckCircle2, Play, RotateCcw, Square } from "lucide-react";

export function AuditSchedulerCard() {
  // Ressincroniza quando a fila emite: getSchedulerState retorna o snapshot.
  const schedule = useSyncExternalStore(subscribeScheduler, getSchedulerState);
  const done = Object.values(schedule.runs).filter((r) => r?.status === "done").length;
  const errors = Object.values(schedule.runs).filter((r) => r?.status === "error").length;
  const progress = schedule.total ? (schedule.index / schedule.total) * 100 : 0;
  const statusLabel = {
    idle: "Filas adormecidas",
    running: "Sondando…",
    paused: "Pausado",
    done: "Concluído",
  }[schedule.status];

  return (
    <section
      aria-label="Agendador de sondas (audição automática)"
      className="rounded-lg border border-border/60 bg-card/40 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Agendador de sondas (1 por fonte)</div>
          <p className="text-xs text-muted-foreground">
            Fila sequencial que valida cada rota ponta a ponta, preenchendo
            a confiabilidade (auditoria automática em 1 clique).
          </p>
        </div>
        <div className="flex items-center gap-2">
          {schedule.status === "running" ? (
            <Button size="sm" variant="outline" onClick={stopScheduler}>
              <Square className="h-3.5 w-3.5" /> Parar
            </Button>
          ) : (
            <Button size="sm" onClick={() => void startScheduler()}>
              <Play className="h-3.5 w-3.5" /> {schedule.status === "paused" ? "Retomar" : "Iniciar sondas"}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => void restartScheduler()}>
            <RotateCcw className="h-3.5 w-3.5" /> Recomeçar
          </Button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <Progress value={progress} className="h-2 flex-1" />
        <span className="text-xs text-muted-foreground">
          {statusLabel} · {schedule.index}/{schedule.total} · {done} ok · {errors} erro
        </span>
      </div>

      {/* Budget de segurança (§5/§6): "nunca desperdiçar requisições". */}
      <BudgetControls />

      <ol className="mt-3 max-h-56 space-y-1 overflow-y-auto text-xs">
        {AUDIT_PROBES.map((probe) => {
          const run = schedule.runs[probe.sourceId];
          const tone = run?.status === "done"
            ? "text-emerald-600"
            : run?.status === "error"
              ? "text-red-600"
              : run?.status === "running"
                ? "text-amber-600"
                : "text-muted-foreground";
          return (
            <li key={probe.sourceId} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                {run?.status === "done" ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                ) : null}
                <span className={tone}>{probe.label}</span>
              </span>
              <span className={tone} role="status">
                {run?.status ?? "pending"}
                {run?.error ? ` (${run.error})` : ""}
                {run?.durationMs != null ? ` · ${run.durationMs}ms` : ""}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Controles do budget (clamps locais; valores sempre exibidos reais). */
function BudgetControls() {
  const schedule = useSyncExternalStore(subscribeScheduler, getSchedulerState);
  const budget = getBudget();
  const fields = [
    {
      key: "maxRequests" as const,
      label: "Máx. sondas/execução",
      hint: "Para a fila ao atingir (retomável).",
    },
    {
      key: "delayBetweenMs" as const,
      label: "Intervalo entre sondas (ms)",
      hint: "Respiro para rate-limits.",
    },
    {
      key: "timeoutMs" as const,
      label: "Timeout por sonda (ms)",
      hint: "Aborta a sonda lenta.",
    },
  ];
  return (
    <div className="mt-3 grid gap-2 border-t border-border/40 pt-3 sm:grid-cols-3" aria-label="Orçamento de segurança da auditoria">
      {fields.map((f) => {
        const limits = BUDGET_LIMITS[f.key];
        return (
          <label key={f.key} className="text-xs text-muted-foreground">
            <span className="mb-1 block font-medium text-foreground">{f.label}</span>
            <input
              type="number"
              min={limits.min}
              max={limits.max}
              value={budget[f.key]}
              disabled={schedule.status === "running"}
              onChange={(e) => setBudget({ [f.key]: Number(e.target.value) })}
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
              aria-label={f.label}
            />
            <span className="mt-0.5 block text-[11px]">{f.hint}</span>
          </label>
        );
      })}
    </div>
  );
}

