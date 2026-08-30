/**
 * IAQueueBar — barra de controle da fila global de IA (`iaRunner`).
 *
 * Aparece onde há pipelines de IA (Investigar, Decision Center, Metodologias):
 * mostra progresso (x/y), job atual e os 4 controles exigidos:
 *  - Pausar (interrompe pela interface — job corrente volta a pendente);
 *  - Retomar (continua de onde parou — jobs concluídos são pulados);
 *  - Recomeçar (zera resultados e roda tudo de novo);
 *  - Limpar (esvazia a fila).
 * A execução continua mesmo se o usuário navegar para outra página (o runner
 * é module-level); se a página for recarregada, a fila fica pausada e esta
 * barra oferece Retomar/Recomeçar.
 */
import { Play, Pause, RotateCcw, Trash2, ListChecks } from "lucide-react";
import {
  useIAQueue, pauseQueue, resumeQueue, restartQueue, clearQueue,
} from "@/lib/iaRunner";

export function IAQueueBar({ origin }: { origin?: string }) {
  const q = useIAQueue();
  const jobs = origin ? q.jobs.filter((j) => j.origin === origin) : q.jobs;
  if (jobs.length === 0) return null;

  const ids = new Set(jobs.map((j) => j.id));
  const done = jobs.filter((j) => q.results[j.id] === "done").length;
  const currentJob = q.current >= 0 ? q.jobs[q.current] : undefined;
  const mineRunning = q.status === "running" && currentJob && ids.has(currentJob.id);
  /** Quantos desta origem estão gerando AGORA (worker pool paralelo). */
  const runningNow = jobs.filter((j) => q.results[j.id] === "running").length;
  const pending = jobs.filter((j) => q.results[j.id] !== "done").length;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-secondary/40 px-3 py-2 text-xs"
    >
      <ListChecks className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
      <span className="font-medium">
        Fila de IA: {done}/{jobs.length} concluída(s)
      </span>
      {mineRunning && currentJob && (
        <span className="text-status-running">
          · {runningNow > 1 ? `${runningNow} em paralelo (ex.: ${currentJob.label})` : `executando: ${currentJob.label}`}
        </span>
      )}
      {q.status === "paused" && pending > 0 && (
        <span className="text-status-warning">· pausada ({pending} pendente(s))</span>
      )}
      {q.status === "done" && <span className="text-status-success">· concluída</span>}
      <div className="ml-auto flex items-center gap-1">
        {mineRunning ? (
          <button
            onClick={pauseQueue}
            aria-label="Pausar fila de IA"
            className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 hover:bg-secondary/80"
          >
            <Pause className="h-3 w-3" aria-hidden /> Pausar
          </button>
        ) : pending > 0 ? (
          <button
            onClick={resumeQueue}
            aria-label="Retomar fila de onde parou"
            className="inline-flex items-center gap-1 rounded-md bg-primary/15 px-2 py-1 text-primary hover:bg-primary/25"
          >
            <Play className="h-3 w-3" aria-hidden /> Retomar
          </button>
        ) : null}
        <button
          onClick={restartQueue}
          aria-label="Recomeçar fila do zero"
          className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 hover:bg-secondary/80"
        >
          <RotateCcw className="h-3 w-3" aria-hidden /> Recomeçar
        </button>
        {!mineRunning && (
          <button
            onClick={clearQueue}
            aria-label="Limpar fila de IA"
            className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-muted-foreground hover:text-destructive hover:bg-secondary/80"
          >
            <Trash2 className="h-3 w-3" aria-hidden /> Limpar
          </button>
        )}
      </div>
    </div>
  );
}
