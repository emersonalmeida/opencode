/**
 * Git Canvas — ações contextuais por objeto (spec §32).
 *
 * Cada kind de node declara suas ações. Ações ligadas a um `commandId`
 * herdam disponibilidade/razão/explicação do registry da Command Palette
 * (resolveCommand — §51 nunca fingir). Ações `builtin` executam de verdade
 * já (copiar SHA, copiar link, abrir URL, focar objeto relacionado).
 */
import type { GitCanvasNode } from "./graph";
import { GIT_COMMANDS, resolveCommand, type GitCommand } from "./commands";
import type { ProjectMap } from "./types";

export type BuiltinAction = "copy-sha" | "copy-link" | "open-url" | "focus";

export interface ObjectActionDef {
  id: string;
  label: string;
  /** Ação do registry da palette — disponibilidade honesta + educação. */
  commandId?: string;
  /** Ação real executável pela UI hoje. */
  builtin?: BuiltinAction;
  /** Para builtin "focus": id do node alvo (derivado do meta do node). */
  focusNodeId?: string;
  danger?: boolean;
}

export interface ResolvedObjectAction extends ObjectActionDef {
  available: boolean;
  reason?: string;
  description?: string;
  gitEquivalent?: string;
}

/** Ações por kind (spec §32). */
export function actionsForNode(node: GitCanvasNode, map: ProjectMap): ResolvedObjectAction[] {
  const meta = (node.data.meta ?? {}) as Record<string, unknown>;
  const defs = defsFor(node, meta);
  return defs.map((d) => {
    if (d.commandId) {
      const cmd = GIT_COMMANDS.find((c) => c.id === d.commandId);
      if (cmd) {
        const r = resolveCommand(cmd, map);
        return { ...d, available: r.available, reason: r.reason, description: r.description, gitEquivalent: r.gitEquivalent };
      }
    }
    // Ações builtin (copy/open/focus) executam de verdade; se o alvo de foco
    // não estiver na projeção atual, a página avisa com toast honesto.
    return { ...d, available: true };
  });
}

function defsFor(node: GitCanvasNode, meta: Record<string, unknown>): ObjectActionDef[] {
  const kind = node.data.kind;
  switch (kind) {
    case "branch":
      return [
        { id: "checkout", label: "Checkout", commandId: "git.branch.checkout" },
        { id: "compare", label: "Comparar", commandId: "local.compare" },
        { id: "merge", label: "Merge", commandId: "git.merge" },
        { id: "rebase", label: "Rebase", commandId: "git.rebase" },
        { id: "push", label: "Push", commandId: "git.push" },
        { id: "pull", label: "Pull", commandId: "git.pull" },
        { id: "rename", label: "Renomear", commandId: "git.branch.create" },
        { id: "delete", label: "Excluir", commandId: "git.branch.create", danger: true },
      ];
    case "commit":
      return [
        { id: "diff", label: "Ver diff", commandId: "proj.history" },
        { id: "cherry-pick", label: "Cherry-pick", commandId: "git.cherry-pick" },
        { id: "revert", label: "Reverter", commandId: "git.revert" },
        { id: "branch", label: "Criar branch", commandId: "git.branch.create" },
        { id: "copy-sha", label: "Copiar SHA", builtin: "copy-sha" },
      ];
    case "pull-request":
      return [
        { id: "review", label: "Revisar", commandId: "gh.pr.review" },
        { id: "approve", label: "Aprovar", commandId: "gh.pr.approve" },
        { id: "request-changes", label: "Solicitar alterações", commandId: "gh.pr.request-changes" },
        { id: "merge", label: "Merge", commandId: "gh.pr.merge" },
        { id: "close", label: "Fechar", commandId: "gh.pr.close", danger: true },
        { id: "copy-link", label: "Copiar link", builtin: "copy-link" },
      ];
    case "issue": {
      const defs: ObjectActionDef[] = [];
      if (meta.linkedBranch) defs.push({ id: "branch", label: `Ver branch ${String(meta.linkedBranch)}`, builtin: "focus", focusNodeId: `branch:${String(meta.linkedBranch)}` });
      if (meta.linkedPR) defs.push({ id: "pr", label: `Ver PR #${String(meta.linkedPR)}`, builtin: "focus", focusNodeId: `pr:${String(meta.linkedPR)}` });
      if (meta.linkedAgent) defs.push({ id: "agent", label: "Ver agente", builtin: "focus", focusNodeId: `agent:${String(meta.linkedAgent)}` });
      if (meta.url) defs.push({ id: "open", label: "Abrir no GitHub", builtin: "open-url" });
      return defs;
    }
    case "agent":
      return [
        { id: "review", label: "Ver alterações", commandId: "agent.review-changes" },
        { id: "stop", label: "Parar agente", commandId: "agent.stop", danger: true },
      ];
    case "local-repository":
      return [
        { id: "detect", label: "Detectar alterações", commandId: "local.detect" },
        { id: "compare", label: "Comparar local e remoto", commandId: "local.compare" },
        { id: "pull", label: "Pull", commandId: "local.pull" },
        { id: "push", label: "Push", commandId: "local.push" },
      ];
    case "diff":
      return [
        { id: "review", label: "Revisar alterações", commandId: "local.compare" },
        { id: "commit", label: "Commitar", commandId: "git.commit" },
        { id: "discard", label: "Descartar", commandId: "git.stash", danger: true },
      ];
    case "deployment":
      return meta.url ? [{ id: "open", label: "Abrir URL", builtin: "open-url" }] : [];
    case "release":
    case "workflow":
    case "remote":
    case "repository":
    case "project":
      return meta.url ? [{ id: "open", label: "Abrir no GitHub", builtin: "open-url" }] : [];
    default:
      return [];
  }
}

/** Executa uma ação builtin (real). Retorna false se não for builtin. */
export function runBuiltinAction(
  action: ObjectActionDef,
  node: GitCanvasNode,
  focusNode: (id: string) => void,
): boolean {
  const meta = (node.data.meta ?? {}) as Record<string, unknown>;
  switch (action.builtin) {
    case "copy-sha": {
      const sha = String(meta.sha ?? node.data.sub ?? "");
      if (!sha) return false;
      void navigator.clipboard?.writeText(sha);
      return true;
    }
    case "copy-link": {
      const url = String(meta.url ?? "");
      if (!url) return false;
      void navigator.clipboard?.writeText(url);
      return true;
    }
    case "open-url": {
      const url = String(meta.url ?? "");
      if (!url) return false;
      window.open(url, "_blank", "noopener,noreferrer");
      return true;
    }
    case "focus": {
      if (action.focusNodeId) focusNode(action.focusNodeId);
      return true;
    }
    default:
      return false;
  }
}
