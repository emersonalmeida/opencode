/**
 * Git Canvas — modelo de domínio tipado e extensível.
 *
 * Camada de ENTIDADES NORMALIZADAS: o Canvas nunca consome payloads crus de
 * GitHub/Git/agentes — consome este modelo. Providers (Parte 6+) traduzem o
 * mundo real para cá; o modo demo gera o mesmo shape deterministicamente.
 *
 * Regra fundamental do produto: NUNCA simular sucesso. Toda entidade carrega
 * estado de conexão/origem para a UI ser tecnicamente honesta.
 */

/** Tipos de objeto do Canvas (spec §6). Extensível: novos kinds entram aqui. */
export type GitNodeKind =
  | "project"
  | "repository"
  | "remote"
  | "local-repository"
  | "branch"
  | "commit"
  | "file"
  | "folder"
  | "diff"
  | "pull-request"
  | "issue"
  | "review"
  | "agent"
  | "workflow"
  | "build"
  | "deployment"
  | "environment"
  | "release"
  | "test"
  | "package"
  | "documentation"
  | "person"
  | "task"
  | "terminal";

/** Estado de conexão de um provider/origem de dados (honestidade técnica). */
export type ConnectionState = "connected" | "disconnected" | "demo" | "error";

/** Status visual compartilhado pelos objetos (badge/ícone/cor no node). */
export type ObjectStatus =
  | "ok"
  | "running"
  | "pending"
  | "warning"
  | "error"
  | "offline"
  | "unknown";

// ---------------------------------------------------------------------------
// Entidades de domínio
// ---------------------------------------------------------------------------

export interface Repository {
  id: string;
  owner: string;
  name: string;
  defaultBranch: string;
  url?: string;
  provider: string;
  description?: string;
}

export interface Branch {
  name: string;
  headSha: string;
  upstream?: string;
  /** commits à frente/atrás do upstream (quando conhecido). */
  ahead: number;
  behind: number;
  isDefault: boolean;
  /** existe na máquina local / existe no remoto. */
  local: boolean;
  remote: boolean;
  lastCommitMessage?: string;
  lastCommitDate?: string;
}

export interface Commit {
  sha: string;
  message: string;
  author: string;
  date: string; // ISO
  parents: string[];
  branch?: string;
  filesChanged: number;
  additions: number;
  deletions: number;
}

export type PRState = "open" | "merged" | "closed" | "draft";

export interface ReviewInfo {
  id: string;
  author: string;
  state: "approved" | "changes-requested" | "commented" | "pending";
  date: string;
}

export interface CheckInfo {
  name: string;
  status: "queued" | "running" | "success" | "failure" | "cancelled";
}

export interface PullRequest {
  number: number;
  title: string;
  state: PRState;
  sourceBranch: string;
  targetBranch: string;
  filesChanged: number;
  additions: number;
  deletions: number;
  reviews: ReviewInfo[];
  checks: CheckInfo[];
  comments: number;
  url?: string;
  updatedAt: string;
}

export interface Issue {
  number: number;
  title: string;
  state: "open" | "closed";
  labels: string[];
  assignee?: string;
  milestone?: string;
  /** relações visuais: por que essa alteração de código existe. */
  linkedBranch?: string;
  linkedPR?: number;
  linkedAgent?: string;
  url?: string;
  updatedAt: string;
}

export type AgentStatus = "working" | "done" | "failed" | "stopped" | "queued";

export interface AgentStep {
  label: string;
  state: "done" | "running" | "pending" | "failed";
}

export interface AgentInfo {
  id: string;
  provider: string; // "openhands" | "codex" | ... (spec §13)
  task: string;
  status: AgentStatus;
  branch?: string;
  filesChanged: number;
  additions: number;
  deletions: number;
  testsPassed?: number;
  testsTotal?: number;
  steps: AgentStep[];
  startedAt: string;
}

export type WorkflowStatus =
  | "queued"
  | "running"
  | "success"
  | "failure"
  | "cancelled";

export interface WorkflowJob {
  name: string;
  status: WorkflowStatus;
}

export interface WorkflowRun {
  id: string;
  name: string;
  status: WorkflowStatus;
  commitSha?: string;
  branch?: string;
  jobs: WorkflowJob[];
  url?: string;
  updatedAt: string;
}

export type EnvironmentKind = "local" | "development" | "preview" | "staging" | "production";

export interface Deployment {
  id: string;
  environment: EnvironmentKind;
  status: "success" | "failure" | "running" | "pending";
  url?: string;
  version?: string;
  commitSha?: string;
  date: string;
}

export interface Release {
  tag: string;
  name: string;
  date: string;
  commits: number;
  prs: number;
  notes?: string;
  url?: string;
}

/** Estado do repositório LOCAL (spec §12) — entidade de primeira classe. */
export interface LocalRepoState {
  connected: boolean;
  branch?: string;
  headSha?: string;
  ahead: number;
  behind: number;
  modifiedFiles: number;
  stagedFiles: number;
  untrackedFiles: number;
}

/** Estrutura de código (spec §11/§21) — derivada do repositório, nunca inventada. */
export interface CodeTreeNode {
  id: string;
  name: string;
  kind: "folder" | "file";
  children?: CodeTreeNode[];
}

// ---------------------------------------------------------------------------
// ProjectMap — o modelo normalizado que o Canvas consome
// ---------------------------------------------------------------------------

export interface ProjectMap {
  project: { name: string; description?: string };
  repository?: Repository;
  branches: Branch[];
  commits: Commit[];
  pullRequests: PullRequest[];
  issues: Issue[];
  agents: AgentInfo[];
  workflows: WorkflowRun[];
  deployments: Deployment[];
  releases: Release[];
  local: LocalRepoState;
  codeTree?: CodeTreeNode;
  /** Refs não-branch que só um upload de repositório revela: reflog, stash, tags. */
  refs?: {
    /** entradas do `git reflog` (mais recente primeiro). */
    reflog?: ReflogEntry[];
    /** entradas do `git stash list`. */
    stash?: StashEntry[];
    /** tags anotadas/leves apontando para um sha. */
    tags?: { name: string; sha: string; message?: string; date?: string }[];
  };
  connections: {
    git: ConnectionState;
    agents: ConnectionState;
    ci: ConnectionState;
    local: ConnectionState;
  };
  /** true quando o dataset é o modo demo (spec §37) — a UI SEMPRE mostra o badge. */
  demo: boolean;
  /** true quando o dataset veio de upload de arquivos git (não de conexão real). */
  upload?: boolean;
  /** metadados do upload (nome, arquivos lidos, gaps). */
  uploadMeta?: {
    name: string;
    filesRead: number;
    gaps: string[];
    /** origem dos dados: upload manual, snapshot do servidor ou pasta local. */
    source?: "upload" | "local-snapshot" | "local-folder";
  };
}

/** Uma linha do `git reflog` — o "GPS do repo" (inclusive commits apagados). */
export interface ReflogEntry {
  sha: string;
  action: string;
  message?: string;
  author?: string;
  date?: string;
}

/** Uma entrada do `git stash list` — trabalho guardado sem commit. */
export interface StashEntry {
  message: string;
  branch?: string;
  date?: string;
  author?: string;
}

// ---------------------------------------------------------------------------
// Visões do mesmo Canvas (spec §34) — projeções, não páginas
// ---------------------------------------------------------------------------

export type GitCanvasView =
  | "project"
  | "git"
  | "agents"
  | "review"
  | "architecture"
  | "deploy"
  | "local"
  | "timeline"
  | "blocks";

export const GIT_CANVAS_VIEWS: { id: GitCanvasView; label: string; hint: string }[] = [
  { id: "project", label: "Projeto", hint: "Tudo conectado" },
  { id: "git", label: "Git", hint: "Branches + commits + tags" },
  { id: "agents", label: "Agentes", hint: "Agentes + tarefas + branches" },
  { id: "review", label: "Review", hint: "PRs + diffs + reviews + CI" },
  { id: "architecture", label: "Arquitetura", hint: "Pastas + arquivos + dependências" },
  { id: "deploy", label: "Deploy", hint: "CI/CD + ambientes + releases" },
  { id: "local", label: "Local", hint: "Máquina + GitHub + sincronização" },
  { id: "timeline", label: "Timeline", hint: "Linha do tempo do início ao último evento" },
  { id: "blocks", label: "Blocos", hint: "Cards expansíveis em colunas — alternativa ao canvas" },
];

// ---------------------------------------------------------------------------
// Saúde do projeto (spec §23) — derivada de dados reais, nunca inventada
// ---------------------------------------------------------------------------

export type ProjectHealth = "healthy" | "attention";

export interface ProjectHealthReport {
  status: ProjectHealth;
  signals: string[];
}

export function computeProjectHealth(map: ProjectMap): ProjectHealthReport {
  const signals: string[] = [];
  if (map.workflows.some((w) => w.status === "failure")) signals.push("CI falhou");
  if (map.deployments.some((d) => d.status === "failure")) signals.push("Deployment falhou");
  if (map.local.connected && (map.local.modifiedFiles > 0 || map.local.untrackedFiles > 0))
    signals.push("Alterações locais pendentes");
  if (map.branches.some((b) => b.remote && b.local && (b.ahead > 0 || b.behind > 0)))
    signals.push("Branches divergentes");
  if (map.pullRequests.some((p) => p.state === "open" && !p.reviews.some((r) => r.state === "approved")))
    signals.push("PR aguardando review");
  if (map.agents.some((a) => a.status === "working")) signals.push("Agente trabalhando");
  if (map.agents.some((a) => a.status === "failed")) signals.push("Agente falhou");
  return { status: signals.length ? "attention" : "healthy", signals };
}

// ---------------------------------------------------------------------------
// Timeline / atividade (spec §22/§45) — cada evento aponta para um objeto
// ---------------------------------------------------------------------------

export interface TimelineEvent {
  id: string;
  date: string; // ISO
  icon: "agent" | "commit" | "branch" | "pr" | "ci" | "deploy" | "issue" | "release" | "local";
  text: string;
  /** id do node no canvas para focar ao clicar. */
  nodeId?: string;
}

export function buildTimeline(map: ProjectMap): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const c of map.commits)
    events.push({
      id: `commit:${c.sha}`,
      date: c.date,
      icon: "commit",
      text: `commit ${c.sha.slice(0, 7)} — ${c.message}`,
      nodeId: `commit:${c.sha}`,
    });
  for (const p of map.pullRequests)
    events.push({
      id: `pr:${p.number}`,
      date: p.updatedAt,
      icon: "pr",
      text: `PR #${p.number} ${p.state === "open" ? "aberto" : p.state === "merged" ? "merged" : "fechado"} — ${p.title}`,
      nodeId: `pr:${p.number}`,
    });
  for (const a of map.agents)
    events.push({
      id: `agent:${a.id}`,
      date: a.startedAt,
      icon: "agent",
      text: `${a.provider} ${a.status === "working" ? "trabalhando em" : a.status === "done" ? "concluiu" : "registrou"} — ${a.task}`,
      nodeId: `agent:${a.id}`,
    });
  for (const w of map.workflows)
    events.push({
      id: `workflow:${w.id}`,
      date: w.updatedAt,
      icon: "ci",
      text: `CI ${w.name}: ${w.status === "success" ? "passou" : w.status === "failure" ? "falhou" : w.status}`,
      nodeId: `workflow:${w.id}`,
    });
  for (const d of map.deployments)
    events.push({
      id: `deploy:${d.id}`,
      date: d.date,
      icon: "deploy",
      text: `deploy ${d.environment}: ${d.status === "success" ? "concluído" : d.status}`,
      nodeId: `deploy:${d.id}`,
    });
  for (const r of map.releases)
    events.push({
      id: `release:${r.tag}`,
      date: r.date,
      icon: "release",
      text: `release ${r.tag} — ${r.name}`,
      nodeId: `release:${r.tag}`,
    });
  // refs de upload: reflog, stash, tags (spec §12 — dados que só o upload revela)
  if (map.refs?.reflog) {
    for (const r of map.refs.reflog.slice(0, 10)) {
      events.push({
        id: `reflog:${r.sha}:${r.action}`,
        date: r.date ?? new Date().toISOString(),
        icon: "local",
        text: `reflog ${r.action} — ${r.message ?? r.sha.slice(0, 7)}`,
        nodeId: `commit:${r.sha}`,
      });
    }
  }
  if (map.refs?.stash) {
    for (const s of map.refs.stash) {
      events.push({
        id: `stash:${s.message.slice(0, 20)}`,
        date: s.date ?? new Date().toISOString(),
        icon: "local",
        text: `stash — ${s.message}`,
      });
    }
  }
  if (map.refs?.tags) {
    for (const t of map.refs.tags) {
      events.push({
        id: `tag:${t.name}`,
        date: t.date ?? new Date().toISOString(),
        icon: "release",
        text: `tag ${t.name}`,
        nodeId: `commit:${t.sha}`,
      });
    }
  }
  return events.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}
