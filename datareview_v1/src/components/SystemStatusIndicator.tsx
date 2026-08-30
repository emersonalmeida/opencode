import { useEffect, useState, useRef } from "react";
import { CheckCircle2, AlertCircle, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { useTrackedTasks } from "@/lib/activityStore";
import { STATUS_META, isActiveStatus } from "@/lib/statusSystem";

/**
 * Indicador global de status de tarefas/sistemas no AppHeader.
 * Idle → ✅. Executando → ⚡ pulsante com contagem. Clique = popover com
 * cada tarefa (o que está fazendo, desde quando, status). O usuário sempre
 * sabe "como está" o sistema.
 */
export function SystemStatusIndicator() {
  const tasks = useTrackedTasks();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const active = tasks.filter((t) => isActiveStatus(t.status));
  const recentDone = [...tasks].filter((t) => !isActiveStatus(t.status) && t.endedAt).slice(-30);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);

  const label = active.length === 0 ? "Tarefas" : `${active.length} em execução`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={active.length === 0 ? "Nenhuma tarefa em execução — abrir detalhes" : `${active.length} tarefa(s) em execução — abrir detalhes`}
        title={active.length === 0 ? "Nenhuma tarefa em execução" : active.map((t) => t.label).join(", ")}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] transition-colors ${active.length > 0 ? "bg-status-running/10 text-status-running" : "bg-secondary/60 text-muted-foreground hover:text-foreground"}`}
      >
        {active.length > 0 ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            <span className="max-w-[110px] truncate">{label}</span>
          </>
        ) : (
          <>
            <CheckCircle2 className="h-3 w-3 text-status-success" />
            <span className="hidden lg:inline">Idle</span>
          </>
        )}
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-72 rounded-lg border border-border bg-popover shadow-lg z-50 anim-scale-in">
          <div className="px-3 py-2 border-b border-border/50">
            <p className="text-[11px] font-medium text-foreground">Status do sistema</p>
          </div>
          <div className="max-h-64 overflow-y-auto p-1.5 space-y-0.5">
            {active.length === 0 && recentDone.length === 0 && (
              <p className="text-[11px] text-muted-foreground px-2 py-3">
                Nenhuma tarefa registrada ainda. Execute o canvas, o pipeline, uma coleta ou uma análise de IA.
              </p>
            )}
            {active.length > 0 && (
              <div className="px-2 py-1">
                <p className="text-[9px] uppercase tracking-wider font-semibold text-status-running mb-1">Em execução</p>
                {active.map((t) => (
                  <TaskRow key={t.id} task={t} live />
                ))}
              </div>
            )}
            {recentDone.length > 0 && (
              <div className="px-2 py-1">
                <p className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">Recentes</p>
                {recentDone.slice(-8).reverse().map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TaskRow({ task, live }: { task: ReturnType<typeof useTrackedTasks>[number]; live?: boolean }) {
  const meta = STATUS_META[task.status];
  const cls = meta.color;
  return (
    <div className="flex items-center gap-1.5 py-0.5 text-[11px]" title={meta.hint}>
      {task.status === "error" ? (
        <AlertCircle className={`h-3 w-3 text-status-${cls} shrink-0`} />
      ) : live ? (
        <Loader2 className={`h-3 w-3 text-status-${cls} animate-spin shrink-0`} />
      ) : (
        <CheckCircle2 className={`h-3 w-3 text-status-${cls} shrink-0`} />
      )}
      <span className="truncate flex-1 text-foreground/90">{task.label}</span>
      <span className={`text-[9px] text-status-${cls} shrink-0`}>{meta.label}</span>
    </div>
  );
}
