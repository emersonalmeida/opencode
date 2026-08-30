/**
 * GitTimelinePanel — Activity Stream compacto (spec §22/§45).
 *
 * Lista os eventos do projeto (commits, PRs, agentes, CI, deploys, releases)
 * do mais recente ao mais antigo. Cada evento leva ao objeto no canvas.
 * Painel flutuante, colapsável, não invasivo.
 */
import { useMemo } from "react";
import {
  Bot, CloudUpload, GitBranch, GitCommitHorizontal, GitPullRequest,
  Laptop, Rocket, Tag, Workflow, X, CircleDot, type LucideIcon,
} from "lucide-react";
import { buildTimeline, type ProjectMap, type TimelineEvent } from "@/lib/gitCanvas/types";
import { useGitCanvas } from "@/lib/gitCanvas/store";

const EVENT_ICON: Record<TimelineEvent["icon"], LucideIcon> = {
  agent: Bot,
  commit: GitCommitHorizontal,
  branch: GitBranch,
  pr: GitPullRequest,
  ci: Workflow,
  deploy: Rocket,
  issue: CircleDot,
  release: Tag,
  local: Laptop,
};

function timeLabel(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export interface GitTimelinePanelProps {
  map: ProjectMap;
  onFocus(nodeId: string): void;
  onClose(): void;
}

export function GitTimelinePanel({ map, onFocus, onClose }: GitTimelinePanelProps) {
  const nodes = useGitCanvas((s) => s.nodes);
  const events = useMemo(() => buildTimeline(map).slice(0, 30), [map]);
  const visible = useMemo(() => new Set(nodes.map((n) => n.id)), [nodes]);

  return (
    <section
      className="absolute bottom-3 left-3 z-20 flex max-h-[45%] w-80 max-w-[85vw] flex-col overflow-hidden rounded-xl border border-border/70 bg-card/95 shadow-lg backdrop-blur-md"
      aria-label="Atividade recente"
    >
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Atividade recente</span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar atividade (T)"
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <ol className="flex-1 overflow-y-auto px-2 py-1.5" role="log">
        {events.map((e) => {
          const Icon = EVENT_ICON[e.icon] ?? GitCommitHorizontal;
          const focusable = !!e.nodeId && visible.has(e.nodeId);
          return (
            <li key={e.id}>
              <button
                type="button"
                disabled={!focusable}
                onClick={() => e.nodeId && onFocus(e.nodeId)}
                title={focusable ? "Focar objeto no canvas" : "Objeto não está nesta visão"}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent disabled:cursor-default disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <span className="w-9 shrink-0 font-mono text-[10px] text-muted-foreground">{timeLabel(e.date)}</span>
                <Icon className="h-3.5 w-3.5 shrink-0 text-primary/80" />
                <span className="min-w-0 flex-1 truncate text-[11.5px]">{e.text}</span>
              </button>
            </li>
          );
        })}
        {events.length === 0 && (
          <li className="px-2 py-3 text-center text-[11px] text-muted-foreground">Nenhuma atividade ainda.</li>
        )}
      </ol>
    </section>
  );
}
