/**
 * FlowNavigator — o "mapa da jornada" da página /fluxo: âncoras para todas as
 * seções com status (✓ concluída / → pronta / ○ aguardando), progresso global
 * e destaque da seção visível (scroll-spy via IntersectionObserver). Montado
 * pela página como sidebar INTERNA esquerda (modelo de 5 colunas).
 */
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  FLOW_SECTIONS, FLOW_STATUS_META,
  type FlowProgress,
  type FlowSectionId,
  type FlowSectionState,
} from "@/lib/flow/flowModel";
import { setFocusedSection } from "@/lib/flow/flowFocus";

function Dot({ status }: { status: FlowSectionState["status"] }) {
  const Icon = FLOW_STATUS_META[status].icon;
  return (
    <Icon
      className={cn("h-3 w-3 shrink-0", FLOW_STATUS_META[status].dot.replace("bg-", "text-"))}
      aria-hidden
    />
  );
}

interface NavigatorBodyProps {
  states: Record<FlowSectionId, FlowSectionState>;
  progress: FlowProgress;
  current: FlowSectionId | null;
  onGoTo: (id: string) => void;
}

function NavigatorBody({ states, progress, current, onGoTo }: NavigatorBodyProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/40 px-3 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Mapa da jornada
        </p>
        <div className="mt-2 flex items-center gap-2">
          <div
            className="h-1.5 flex-1 rounded-full bg-secondary overflow-hidden"
            role="progressbar"
            aria-valuenow={progress.pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progresso da jornada"
          >
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress.pct}%` }} />
          </div>
          <span className="text-[10px] tabular-nums text-muted-foreground">{progress.pct}%</span>
        </div>
      </div>
      <nav aria-label="Seções da jornada" className="flex-1 overflow-y-auto p-2">
        <ol className="space-y-0.5">
          {FLOW_SECTIONS.map((sec) => {
            const st = states[sec.id];
            const Icon = sec.icon;
            const active = current === sec.id;
            return (
              <li key={sec.id}>
                <button
                  onClick={() => onGoTo(sec.id)}
                  aria-current={active ? "location" : undefined}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                    active ? "bg-primary/10 text-foreground" : "hover:bg-secondary text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Dot status={st?.status ?? "idle"} />
                  <span className="w-5 shrink-0 tabular-nums text-[10px] text-muted-foreground">{sec.num}</span>
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="flex-1 truncate font-medium">{sec.title}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
      <p className="border-t border-border/40 px-3 py-2 text-[10px] text-muted-foreground">
        Clique para navegar e expandir a seção.
      </p>
    </div>
  );
}

interface Props {
  states: Record<FlowSectionId, FlowSectionState>;
  progress: FlowProgress;
  onGoTo: (id: string) => void;
}

export function FlowNavigator({ states, progress, onGoTo }: Props) {
  const [current, setCurrent] = useState<FlowSectionId | null>(null);

  // Scroll-spy: marca a seção visível no navegador E sincroniza o foco
  // (alimenta o painel contextual da sidebar direita).
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const id = (e.target as HTMLElement).dataset.flowSection as FlowSectionId | undefined;
            if (id) {
              setCurrent(id);
              setFocusedSection(id);
            }
          }
        }
      },
      { rootMargin: "-20% 0px -60% 0px" },
    );
    for (const sec of FLOW_SECTIONS) {
      const el = document.getElementById(`flow-${sec.id}`);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return <NavigatorBody states={states} progress={progress} current={current} onGoTo={onGoTo} />;
}
