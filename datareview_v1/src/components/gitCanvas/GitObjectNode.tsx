/**
 * GitObjectNode — linguagem visual ÚNICA de todos os objetos do Git Canvas
 * (spec §30): mesma estrutura para todo kind; o que muda é ícone, cor de
 * acento, status e badges. Nada de transformar cada node numa UI diferente.
 *
 * Estrutura: [dot de status + ícone + KIND] / label / sub (mono) / badges.
 * Handles na linha do header (padrão do Canvas v4 do projeto).
 */
import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  Boxes, Cloud, Laptop, GitBranch, GitCommitHorizontal, FileCode2, Folder,
  FileDiff, GitPullRequest, CircleDot, MessageSquareWarning, Bot, Workflow,
  Container, Rocket, Globe, Tag, FlaskConical, Package, BookOpen, User,
  CheckSquare, Terminal, type LucideIcon,
} from "lucide-react";
import type { GitCanvasNodeData } from "@/lib/gitCanvas/graph";
import type { GitNodeKind, ObjectStatus } from "@/lib/gitCanvas/types";
import { cn } from "@/lib/utils";

export const KIND_ICON: Record<GitNodeKind, LucideIcon> = {
  project: Boxes,
  repository: Package,
  remote: Cloud,
  "local-repository": Laptop,
  branch: GitBranch,
  commit: GitCommitHorizontal,
  file: FileCode2,
  folder: Folder,
  diff: FileDiff,
  "pull-request": GitPullRequest,
  issue: CircleDot,
  review: MessageSquareWarning,
  agent: Bot,
  workflow: Workflow,
  build: Container,
  deployment: Rocket,
  environment: Globe,
  release: Tag,
  test: FlaskConical,
  package: Package,
  documentation: BookOpen,
  person: User,
  task: CheckSquare,
  terminal: Terminal,
};

/** Rótulo curto do tipo, exibido em caps no header do node. */
export const KIND_LABEL: Record<GitNodeKind, string> = {
  project: "Projeto",
  repository: "Repositório",
  remote: "Remoto",
  "local-repository": "Local",
  branch: "Branch",
  commit: "Commit",
  file: "Arquivo",
  folder: "Pasta",
  diff: "Diff",
  "pull-request": "Pull Request",
  issue: "Issue",
  review: "Review",
  agent: "Agente",
  workflow: "CI/CD",
  build: "Build",
  deployment: "Deploy",
  environment: "Ambiente",
  release: "Release",
  test: "Testes",
  package: "Pacote",
  documentation: "Docs",
  person: "Pessoa",
  task: "Tarefa",
  terminal: "Terminal",
};

/** Cor de acento do ícone por kind (sutil — spec §30). */
const KIND_ACCENT: Partial<Record<GitNodeKind, string>> = {
  project: "text-primary",
  remote: "text-sky-500",
  "local-repository": "text-emerald-500",
  branch: "text-primary",
  agent: "text-violet-500",
  "pull-request": "text-blue-500",
  issue: "text-amber-500",
  workflow: "text-teal-500",
  deployment: "text-indigo-500",
  release: "text-pink-500",
  folder: "text-amber-400",
  file: "text-muted-foreground",
};

/** Cor do dot de status (usa os tokens --status-* do design system). */
export const STATUS_DOT: Record<ObjectStatus, string> = {
  ok: "bg-[hsl(var(--status-success))]",
  running: "bg-[hsl(var(--status-running))] animate-pulse",
  pending: "bg-[hsl(var(--status-info))]",
  warning: "bg-[hsl(var(--status-warning))]",
  error: "bg-[hsl(var(--status-error))]",
  offline: "bg-muted-foreground/50",
  unknown: "bg-muted-foreground/30",
};

function GitObjectNodeInner({ id, data, selected }: NodeProps) {
  const d = data as GitCanvasNodeData;
  const Icon = KIND_ICON[d.kind] ?? Boxes;
  const status = d.status ?? "unknown";
  return (
    <div
      data-nodeid={id}
      data-kind={d.kind}
      className={cn(
        "min-w-[180px] max-w-[270px] rounded-lg border bg-card/90 backdrop-blur-sm px-3 py-2 shadow-sm transition-shadow",
        selected ? "ring-2 ring-primary border-primary/60 shadow-md" : "border-border/70 hover:shadow-md",
      )}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !bg-muted-foreground/60 !border-background" style={{ top: 18 }} />
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !bg-muted-foreground/60 !border-background" style={{ top: 18 }} />
      <div className="flex items-center gap-1.5">
        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", STATUS_DOT[status])} aria-label={`status: ${status}`} />
        <Icon className={cn("h-3.5 w-3.5 shrink-0", KIND_ACCENT[d.kind] ?? "text-muted-foreground")} />
        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{KIND_LABEL[d.kind]}</span>
      </div>
      <div className="mt-1 text-[13px] font-medium leading-tight break-words">{d.label}</div>
      {d.sub && <div className="mt-0.5 text-[11px] font-mono text-muted-foreground break-words">{d.sub}</div>}
      {d.badges && d.badges.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {d.badges.map((b, i) => (
            <span key={`${b}-${i}`} className="rounded bg-secondary/70 px-1.5 py-0.5 text-[9.5px] text-secondary-foreground">
              {b}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const GitObjectNode = memo(GitObjectNodeInner);
export default GitObjectNode;
