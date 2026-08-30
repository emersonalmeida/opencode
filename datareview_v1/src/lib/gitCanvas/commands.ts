/**
 * Git Canvas — registry da Command Palette (spec §5).
 *
 * Toda ação declara o que PRECISA para executar de verdade (`needs`) e, se
 * for uma ação de UI (trocar visão, focar objeto), executa de verdade já.
 * Ações que exigem integração ainda não conectada ficam INDISPONÍVEIS com a
 * razão honesta (§51: nunca simular sucesso) + equivalente Git (§43) +
 * explicação humana (§46).
 */
import type { GitCanvasView, GitNodeKind, ProjectMap } from "./types";

export type CommandGroupId = "git" | "github" | "projeto" | "agentes" | "local" | "navegacao";

export const COMMAND_GROUPS: { id: CommandGroupId; label: string }[] = [
  { id: "git", label: "Git" },
  { id: "github", label: "GitHub" },
  { id: "projeto", label: "Projeto" },
  { id: "agentes", label: "Agentes" },
  { id: "local", label: "Local" },
  { id: "navegacao", label: "Navegação" },
];

export type Need = "git" | "local" | "agents" | "ci";

export type CommandUIAction =
  | { type: "view"; view: GitCanvasView }
  | { type: "focus"; kind: GitNodeKind }
  | { type: "panel"; panel: "timeline" };

export interface GitCommand {
  id: string;
  group: CommandGroupId;
  label: string;
  /** Explicação humana da ação (camada educacional, §46). */
  description?: string;
  /** Equivalente Git mostrado no modo avançado (§43). */
  gitEquivalent?: string;
  keywords?: string[];
  needs?: Need[];
  uiAction?: CommandUIAction;
  /** true = ainda nem a arquitetura de execução existe ("Disponível em breve"). */
  planned?: boolean;
}

export const GIT_COMMANDS: GitCommand[] = [
  // --- Git (§5) ---
  { id: "git.branch.create", group: "git", label: "Criar branch", description: "Cria uma linha paralela de trabalho sem mexer na principal.", gitEquivalent: "git checkout -b <nome>", needs: ["local"] },
  { id: "git.branch.checkout", group: "git", label: "Trocar branch", description: "Muda o código da sua máquina para outra branch.", gitEquivalent: "git checkout <branch>", needs: ["local"] },
  { id: "git.commit", group: "git", label: "Commitar alterações", description: "Grava um ponto na história com as alterações preparadas.", gitEquivalent: "git commit -m \"…\"", needs: ["local"] },
  { id: "git.pull", group: "git", label: "Pull", description: "Traz commits novos do GitHub para a sua máquina.", gitEquivalent: "git pull --rebase origin main", needs: ["local", "git"] },
  { id: "git.push", group: "git", label: "Push", description: "Envia seus commits locais para o GitHub.", gitEquivalent: "git push origin <branch>", needs: ["local", "git"] },
  { id: "git.fetch", group: "git", label: "Fetch", description: "Verifica novidades do remoto sem alterar seu código.", gitEquivalent: "git fetch --all", needs: ["local", "git"] },
  { id: "git.merge", group: "git", label: "Merge", description: "Une o trabalho de outra branch na branch atual.", gitEquivalent: "git merge <branch>", needs: ["local"] },
  { id: "git.rebase", group: "git", label: "Rebase", description: "Coloca sua branch sobre a versão mais recente de main. Reorganiza o histórico da sua branch.", gitEquivalent: "git rebase main", needs: ["local"] },
  { id: "git.cherry-pick", group: "git", label: "Cherry-pick", description: "Copia um commit específico para a branch atual.", gitEquivalent: "git cherry-pick <sha>", needs: ["local"] },
  { id: "git.revert", group: "git", label: "Revert", description: "Cria um commit novo que desfaz outro commit (seguro para histórico compartilhado).", gitEquivalent: "git revert <sha>", needs: ["local"] },
  { id: "git.stash", group: "git", label: "Stash", description: "Guarda alterações não commitadas para depois.", gitEquivalent: "git stash", needs: ["local"] },
  { id: "git.tag", group: "git", label: "Criar tag", description: "Marca um ponto da história com um nome (ex.: v1.2.0).", gitEquivalent: "git tag <nome>", needs: ["local", "git"] },
  { id: "git.release", group: "git", label: "Criar release", description: "Publica uma versão com notas a partir de uma tag.", needs: ["git"] },

  // --- GitHub (§5) ---
  { id: "gh.issue.create", group: "github", label: "Criar Issue", description: "Registra um problema ou ideia para o projeto.", needs: ["git"] },
  { id: "gh.pr.create", group: "github", label: "Criar Pull Request", description: "Propõe juntar uma branch na principal com revisão.", needs: ["git"] },
  { id: "gh.pr.review", group: "github", label: "Revisar PR", description: "Lê as mudanças e deixa comentários.", uiAction: { type: "view", view: "review" } },
  { id: "gh.pr.approve", group: "github", label: "Aprovar PR", needs: ["git"] },
  { id: "gh.pr.request-changes", group: "github", label: "Solicitar alterações", needs: ["git"] },
  { id: "gh.pr.merge", group: "github", label: "Fazer merge", description: "Integra o PR na branch de destino.", needs: ["git"] },
  { id: "gh.pr.close", group: "github", label: "Fechar PR", needs: ["git"] },
  { id: "gh.pr.reopen", group: "github", label: "Reabrir PR", needs: ["git"] },
  { id: "gh.label.add", group: "github", label: "Adicionar label", needs: ["git"] },
  { id: "gh.issue.assign", group: "github", label: "Atribuir Issue", needs: ["git"] },
  { id: "gh.comment", group: "github", label: "Comentar", needs: ["git"] },

  // --- Projeto (§5) ---
  { id: "proj.open", group: "projeto", label: "Abrir repositório", uiAction: { type: "view", view: "project" } },
  { id: "proj.files", group: "projeto", label: "Mostrar arquivos", uiAction: { type: "view", view: "architecture" }, keywords: ["arquitetura", "pastas"] },
  { id: "proj.architecture", group: "projeto", label: "Mostrar arquitetura", uiAction: { type: "view", view: "architecture" } },
  { id: "proj.deps", group: "projeto", label: "Mostrar dependências", planned: true, description: "Mapa de pacotes do projeto (npm primeiro, §20)." },
  { id: "proj.activity", group: "projeto", label: "Mostrar atividade recente", uiAction: { type: "panel", panel: "timeline" }, keywords: ["timeline"] },
  { id: "proj.history", group: "projeto", label: "Mostrar histórico", uiAction: { type: "view", view: "git" }, keywords: ["commits"] },
  { id: "proj.timeline", group: "projeto", label: "Mostrar linha do tempo", description: "Todos os eventos em ordem cronológica, do início ao mais recente.", uiAction: { type: "view", view: "timeline" }, keywords: ["timeline", "histórico", "cronologia"] },

  // --- Agentes (§5/§13) ---
  { id: "agent.start", group: "agentes", label: "Iniciar agente", description: "Cria uma tarefa para um agente de IA trabalhar numa branch.", needs: ["agents"] },
  { id: "agent.stop", group: "agentes", label: "Parar agente", needs: ["agents"] },
  { id: "agent.inspect", group: "agentes", label: "Inspecionar agente", uiAction: { type: "focus", kind: "agent" } },
  { id: "agent.task", group: "agentes", label: "Abrir tarefa", uiAction: { type: "focus", kind: "agent" } },
  { id: "agent.review-changes", group: "agentes", label: "Revisar alterações", uiAction: { type: "view", view: "review" } },

  // --- Local (§5/§12) ---
  { id: "local.pull", group: "local", label: "Pull (local)", gitEquivalent: "git pull", needs: ["local", "git"] },
  { id: "local.push", group: "local", label: "Push (local)", gitEquivalent: "git push", needs: ["local", "git"] },
  { id: "local.detect", group: "local", label: "Detectar alterações", gitEquivalent: "git status", needs: ["local"] },
  { id: "local.compare", group: "local", label: "Comparar local e remoto", uiAction: { type: "view", view: "local" } },
  { id: "local.terminal", group: "local", label: "Abrir terminal", needs: ["local"], description: "Shell seguro via ponte local (§44)." },
  { id: "local.test", group: "local", label: "Executar testes", gitEquivalent: "npm test", needs: ["local"] },

  // --- Navegação (§5) ---
  { id: "nav.project", group: "navegacao", label: "Focar projeto", uiAction: { type: "focus", kind: "project" } },
  { id: "nav.branch", group: "navegacao", label: "Focar branch", uiAction: { type: "focus", kind: "branch" } },
  { id: "nav.commit", group: "navegacao", label: "Focar commit", uiAction: { type: "focus", kind: "commit" } },
  { id: "nav.agent", group: "navegacao", label: "Focar agente", uiAction: { type: "focus", kind: "agent" } },
  { id: "nav.pr", group: "navegacao", label: "Focar PR", uiAction: { type: "focus", kind: "pull-request" } },
  { id: "nav.local", group: "navegacao", label: "Focar máquina local", uiAction: { type: "focus", kind: "local-repository" } },
];

// ---------------------------------------------------------------------------
// Resolução de disponibilidade (§51 — nunca fingir)
// ---------------------------------------------------------------------------

export interface ResolvedCommand extends GitCommand {
  available: boolean;
  reason?: string;
}

const NEED_REASON: Record<Need, string> = {
  git: "GitHub não conectado — configure GITHUB_TOKEN no servidor local.",
  local: "Repositório local não conectado — requer ponte local (companion app/CLI/WebSocket).",
  agents: "OpenHands ainda não está conectado.",
  ci: "CI não conectado.",
};

export function resolveCommand(cmd: GitCommand, map: ProjectMap | null): ResolvedCommand {
  if (cmd.uiAction) {
    if (!map) return { ...cmd, available: false, reason: "Nenhum projeto aberto." };
    return { ...cmd, available: true };
  }
  if (cmd.planned) return { ...cmd, available: false, reason: "Disponível em breve." };
  if (!map) return { ...cmd, available: false, reason: "Nenhum projeto aberto." };
  if (map.demo)
    return { ...cmd, available: false, reason: "Modo demo — ação não executada (sem efeito real)." };
  for (const n of cmd.needs ?? []) {
    if (map.connections[n] !== "connected") return { ...cmd, available: false, reason: NEED_REASON[n] };
  }
  return { ...cmd, available: true };
}

// ---------------------------------------------------------------------------
// Filtro (normalizado, tolerante a separadores)
// ---------------------------------------------------------------------------

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

export function filterCommands(commands: GitCommand[], query: string): GitCommand[] {
  const q = norm(query);
  if (!q) return commands;
  return commands.filter((c) =>
    norm(c.label).includes(q) ||
    norm(c.description ?? "").includes(q) ||
    (c.keywords ?? []).some((k) => norm(k).includes(q)) ||
    norm(c.gitEquivalent ?? "").includes(q),
  );
}

/** Atalhos de teclado do canvas (§33) — letra → visão/ação. */
export const VIEW_SHORTCUTS: Record<string, GitCanvasView> = {
  g: "git",
  a: "agents",
  p: "review",
  r: "architecture",
  d: "deploy",
  l: "local",
  o: "project",
  h: "timeline", // H = histórico (linha do tempo do início ao último evento)
  b: "blocks", // B = blocos (cards expansíveis, alternativa ao canvas)
};
