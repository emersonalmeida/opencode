/**
 * GitInspector — inspector contextual (spec §31).
 *
 * Ao selecionar um objeto, abre um painel flutuante à direita SEM tirar o
 * usuário do canvas. Mostra os metadados reais do objeto + ações com
 * disponibilidade honesta + camada educacional opcional (§46: explicação
 * humana) e equivalente Git (§43, modo avançado).
 */
import { useState } from "react";
import { X, BookOpen, Ban, CheckCircle2, Circle, CircleDashed, XCircle } from "lucide-react";
import type { GitCanvasNode } from "@/lib/gitCanvas/graph";
import type { ProjectMap, AgentInfo, PullRequest, WorkflowRun, Branch, Commit } from "@/lib/gitCanvas/types";
import { actionsForNode, type ResolvedObjectAction } from "@/lib/gitCanvas/objectActions";
import { KIND_LABEL } from "./GitObjectNode";
import { cn } from "@/lib/utils";

export interface GitInspectorProps {
  node: GitCanvasNode;
  map: ProjectMap;
  onAction(action: ResolvedObjectAction): void;
  onClose(): void;
}

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className={cn("text-right text-[12px] break-all", mono && "font-mono")}>{value}</span>
    </div>
  );
}

function fmtDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

const STEP_ICON = {
  done: <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--status-success))]" />,
  running: <Circle className="h-3.5 w-3.5 animate-pulse text-[hsl(var(--status-running))]" />,
  pending: <CircleDashed className="h-3.5 w-3.5 text-muted-foreground/50" />,
  failed: <XCircle className="h-3.5 w-3.5 text-[hsl(var(--status-error))]" />,
};

export function GitInspector({ node, map, onAction, onClose }: GitInspectorProps) {
  const [guide, setGuide] = useState(() => {
    try { return localStorage.getItem("aso:git-canvas:guide") !== "off"; } catch { return true; }
  });
  const meta = (node.data.meta ?? {}) as Record<string, unknown>;
  const actions = actionsForNode(node, map);

  const toggleGuide = () => {
    const next = !guide;
    setGuide(next);
    try { localStorage.setItem("aso:git-canvas:guide", next ? "on" : "off"); } catch { /* ok */ }
  };

  return (
    <aside
      className="absolute right-3 top-24 bottom-16 z-20 flex w-80 max-w-[85vw] flex-col overflow-hidden rounded-xl border border-border/70 bg-card/95 shadow-lg backdrop-blur-md"
      role="complementary"
      aria-label={`Inspector: ${KIND_LABEL[node.data.kind]}`}
    >
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          {KIND_LABEL[node.data.kind]} selecionado
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={toggleGuide}
          aria-pressed={guide}
          title={guide ? "Ocultar explicações (§46)" : "Mostrar explicações (§46)"}
          className={cn(
            "rounded-md p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
            guide ? "text-primary" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <BookOpen className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar inspector (Esc)"
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        <h2 className="text-sm font-semibold leading-snug">{node.data.label}</h2>
        {node.data.sub && <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{node.data.sub}</p>}

        <div className="mt-2 divide-y divide-border/40">
          <KindFields kind={node.data.kind} meta={meta} />
        </div>

        {/* Ciclo de vida do agente (§14) */}
        {node.data.kind === "agent" && Array.isArray((meta as unknown as AgentInfo).steps) && (
          <div className="mt-3">
            <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">Ciclo de vida</p>
            <ol className="space-y-1">
              {(meta as unknown as AgentInfo).steps.map((s) => (
                <li key={s.label} className="flex items-center gap-2 text-[12px]">
                  {STEP_ICON[s.state]}
                  <span className={s.state === "pending" ? "text-muted-foreground" : undefined}>{s.label}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {actions.length > 0 && (
          <div className="mt-3 border-t border-border/60 pt-2">
            <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">Ações</p>
            <div className="space-y-1">
              {actions.map((a) => (
                <div key={a.id}>
                  <button
                    type="button"
                    disabled={!a.available}
                    onClick={() => onAction(a)}
                    title={!a.available ? a.reason : a.description}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md border border-border/60 bg-background/60 px-2.5 py-1.5 text-left text-[12px] transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                      a.available ? "hover:border-primary/40 hover:bg-accent" : "cursor-not-allowed opacity-60",
                      a.danger && a.available && "border-destructive/40 text-destructive hover:bg-destructive/10",
                    )}
                  >
                    {!a.available && <Ban className="h-3 w-3 shrink-0 text-amber-500" />}
                    <span className="flex-1">{a.label}</span>
                    {a.gitEquivalent && (
                      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[9px] text-muted-foreground">{a.gitEquivalent}</code>
                    )}
                  </button>
                  {guide && (a.available ? a.description : a.reason) && (
                    <p className={cn("mt-0.5 px-1 text-[10.5px]", a.available ? "text-muted-foreground" : "text-amber-600 dark:text-amber-400")}>
                      {a.available ? a.description : a.reason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

/** Campos por tipo de objeto — todos derivados do meta real do node. */
function KindFields({ kind, meta }: { kind: string; meta: Record<string, unknown> }) {
  switch (kind) {
    case "commit": {
      const m = meta as unknown as Commit;
      return (
        <>
          <Field label="SHA" value={m.sha} mono />
          <Field label="Autor" value={m.author} />
          <Field label="Data" value={fmtDate(m.date)} />
          <Field label="Branch" value={m.branch} mono />
          <Field label="Parent" value={m.parents?.join(", ").slice(0, 7)} mono />
          <Field label="Arquivos" value={m.filesChanged} />
          <Field label="Alterações" value={`+${m.additions} −${m.deletions}`} mono />
        </>
      );
    }
    case "branch": {
      const m = meta as unknown as Branch;
      return (
        <>
          <Field label="HEAD" value={m.headSha} mono />
          <Field label="Upstream" value={m.upstream ?? "—"} mono />
          <Field label="Ahead/Behind" value={`↑${m.ahead} ↓${m.behind}`} mono />
          <Field label="Local" value={m.local ? "sim" : "não"} />
          <Field label="Remoto" value={m.remote ? "sim" : "não"} />
          <Field label="Último commit" value={m.lastCommitMessage} />
        </>
      );
    }
    case "pull-request": {
      const m = meta as unknown as PullRequest;
      return (
        <>
          <Field label="Estado" value={m.state} />
          <Field label="Branches" value={`${m.sourceBranch} → ${m.targetBranch}`} mono />
          <Field label="Arquivos" value={m.filesChanged} />
          <Field label="Alterações" value={`+${m.additions} −${m.deletions}`} mono />
          <Field label="Reviews" value={m.reviews.map((r) => `${r.author}: ${r.state}`).join(" · ") || "nenhuma"} />
          <Field label="Checks" value={m.checks.map((c) => `${c.name}: ${c.status}`).join(" · ") || "nenhum"} />
          <Field label="Comentários" value={m.comments} />
          <Field label="Atualizado" value={fmtDate(m.updatedAt)} />
        </>
      );
    }
    case "workflow": {
      const m = meta as unknown as WorkflowRun;
      return (
        <>
          <Field label="Status" value={m.status} />
          <Field label="Branch" value={m.branch} mono />
          <Field label="Commit" value={m.commitSha} mono />
          <Field label="Jobs" value={m.jobs.map((j) => `${j.name}: ${j.status}`).join(" · ")} />
        </>
      );
    }
    case "agent": {
      const m = meta as unknown as AgentInfo;
      return (
        <>
          <Field label="Provider" value={m.provider} />
          <Field label="Status" value={m.status} />
          <Field label="Branch" value={m.branch} mono />
          <Field label="Arquivos" value={m.filesChanged} />
          <Field label="Alterações" value={`+${m.additions} −${m.deletions}`} mono />
          {m.testsTotal !== undefined && <Field label="Testes" value={`${m.testsPassed ?? 0}/${m.testsTotal}`} mono />}
          <Field label="Iniciado" value={fmtDate(m.startedAt)} />
        </>
      );
    }
    case "local-repository":
      return (
        <>
          <Field label="Branch atual" value={String(meta.branch ?? "—")} mono />
          <Field label="HEAD" value={String(meta.headSha ?? "—")} mono />
          <Field label="Ahead/Behind" value={`↑${String(meta.ahead ?? 0)} ↓${String(meta.behind ?? 0)}`} mono />
          <Field label="Modificados" value={Number(meta.modifiedFiles ?? 0)} />
          <Field label="Staged" value={Number(meta.stagedFiles ?? 0)} />
          <Field label="Não rastreados" value={Number(meta.untrackedFiles ?? 0)} />
        </>
      );
    case "deployment":
      return (
        <>
          <Field label="Ambiente" value={String(meta.environment ?? "")} />
          <Field label="Status" value={String(meta.status ?? "")} />
          <Field label="Versão" value={String(meta.version ?? "")} mono />
          <Field label="Commit" value={String(meta.commitSha ?? "")} mono />
          <Field label="URL" value={String(meta.url ?? "")} mono />
        </>
      );
    case "release":
      return (
        <>
          <Field label="Tag" value={String(meta.tag ?? "")} mono />
          <Field label="Data" value={fmtDate(String(meta.date ?? ""))} />
          <Field label="Commits" value={Number(meta.commits ?? 0)} />
          <Field label="PRs" value={Number(meta.prs ?? 0)} />
          <Field label="Notas" value={String(meta.notes ?? "")} />
        </>
      );
    case "issue":
      return (
        <>
          <Field label="Estado" value={String(meta.state ?? "")} />
          <Field label="Labels" value={(meta.labels as string[] | undefined)?.join(", ")} />
          <Field label="Responsável" value={String(meta.assignee ?? "—")} />
          <Field label="Milestone" value={String(meta.milestone ?? "—")} />
          <Field label="Atualizada" value={fmtDate(String(meta.updatedAt ?? ""))} />
        </>
      );
    case "file":
    case "folder":
      return <Field label="Caminho" value={String(meta.path ?? "")} mono />;
    default:
      return (
        <>
          <Field label="URL" value={String(meta.url ?? "")} mono />
          <Field label="Descrição" value={String(meta.description ?? "")} />
        </>
      );
  }
}
