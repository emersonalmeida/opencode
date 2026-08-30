/**
 * Git Canvas — construtor do grafo visual (spec §3/§34/§47).
 *
 * Transforma o `ProjectMap` normalizado em nodes/edges do React Flow com
 * layout DETERMINÍSTICO (sem aleatoriedade — testes e sessões estáveis).
 * Cada visão (§34) é uma PROJEÇÃO do mesmo modelo: filtra os grupos de
 * entidades e aplica o mesmo sistema de lanes.
 *
 * Convenção de ids: `${kind}:${key}` — ex.: `branch:main`, `commit:9aac58e1`,
 * `pr:42`, `agent:openhands-1`. O inspector e a busca usam esses ids.
 */
import type { Edge, Node } from "@xyflow/react";
import type {
  AgentInfo,
  CodeTreeNode,
  GitCanvasView,
  GitNodeKind,
  ObjectStatus,
  ProjectMap,
  PullRequest,
  WorkflowRun,
} from "./types";

export interface GitCanvasNodeData {
  kind: GitNodeKind;
  label: string;
  sub?: string;
  status?: ObjectStatus;
  badges?: string[];
  connection?: string;
  meta?: Record<string, unknown>;
  [key: string]: unknown;
}

export type GitCanvasNode = Node<GitCanvasNodeData>;
export type GitCanvasEdge = Edge;

export interface CanvasGraph {
  nodes: GitCanvasNode[];
  edges: GitCanvasEdge[];
}

// ---------------------------------------------------------------------------
// Constantes de layout (espaçamento espacial — spec §47: não é card grid)
// ---------------------------------------------------------------------------

const COL_PROJECT_X = 560;
const COL_REMOTE_X = 90;
const COL_LOCAL_X = 1080;
const ROW_TOP_Y = 150;
const LANE_LABEL_X = 60;
const LANE_FIRST_COMMIT_X = 330;
const COMMIT_DX = 200;
const LANE_H = 150;
const PR_COL_X = 1380;
const ISSUE_COL_X = 1690;
const DEPLOY_DX = 280;

// ---------------------------------------------------------------------------
// Helpers de status
// ---------------------------------------------------------------------------

export function workflowStatus(w: WorkflowRun): ObjectStatus {
  if (w.status === "success") return "ok";
  if (w.status === "failure") return "error";
  if (w.status === "running" || w.status === "queued") return "running";
  return "unknown";
}

export function prStatus(p: PullRequest): ObjectStatus {
  if (p.state === "merged") return "ok";
  if (p.state === "closed") return "offline";
  if (p.checks.some((c) => c.status === "failure")) return "error";
  if (p.checks.some((c) => c.status === "running" || c.status === "queued")) return "running";
  return "pending";
}

export function agentStatus(a: AgentInfo): ObjectStatus {
  if (a.status === "working") return "running";
  if (a.status === "done") return "ok";
  if (a.status === "failed") return "error";
  if (a.status === "stopped") return "offline";
  return "pending";
}

function node(
  id: string,
  kind: GitNodeKind,
  x: number,
  y: number,
  data: Partial<GitCanvasNodeData> & { label: string },
): GitCanvasNode {
  return { id, type: "gitObject", position: { x, y }, data: { kind, ...data } };
}

function edge(id: string, source: string, target: string, opts?: { dashed?: boolean; animated?: boolean; label?: string }): GitCanvasEdge {
  return {
    id,
    source,
    target,
    animated: opts?.animated ?? false,
    label: opts?.label,
    style: opts?.dashed ? { strokeDasharray: "6 4" } : undefined,
  };
}

// ---------------------------------------------------------------------------
// Projeções por visão (§34) — quais grupos entram em cada visão
// ---------------------------------------------------------------------------

interface ViewGroups {
  git: boolean;       // branches + commits
  prs: boolean;
  issues: boolean;
  agents: boolean;
  deploy: boolean;    // workflows + deployments + releases
  local: boolean;
  architecture: boolean;
}

function groupsFor(view: GitCanvasView): ViewGroups {
  switch (view) {
    case "git": return { git: true, prs: false, issues: false, agents: false, deploy: false, local: false, architecture: false };
    case "agents": return { git: true, prs: false, issues: true, agents: true, deploy: false, local: false, architecture: false };
    case "review": return { git: true, prs: true, issues: false, agents: false, deploy: true, local: false, architecture: false };
    case "architecture": return { git: false, prs: false, issues: false, agents: false, deploy: false, local: false, architecture: true };
    case "deploy": return { git: false, prs: false, issues: false, agents: false, deploy: true, local: false, architecture: false };
    case "local": return { git: true, prs: false, issues: false, agents: false, deploy: false, local: true, architecture: false };
    case "project":
    default: return { git: true, prs: true, issues: true, agents: true, deploy: true, local: true, architecture: false };
  }
}

// ---------------------------------------------------------------------------
// Visão Timeline (§34 + linha do tempo): TUDO ordenado cronologicamente,
// do mais antigo (esquerda) ao mais recente (direita), em lanes por
// categoria — commits/semanais na mesma vertical = mesmo momento.
// ---------------------------------------------------------------------------

const TL_ROOT_X = 60;
const TL_FIRST_X = 340;
const TL_DX = 230;
const TL_LANES: { id: string; label: string; y: number }[] = [
  { id: "commits", label: "Commits", y: 0 },
  { id: "prs", label: "PRs", y: 165 },
  { id: "issues", label: "Issues", y: 325 },
  { id: "agents", label: "Agentes", y: 485 },
  { id: "workflows", label: "CI/CD", y: 645 },
  { id: "deploys", label: "Deploys", y: 805 },
  { id: "releases", label: "Releases", y: 965 },
];

function laneY(id: string): number {
  return TL_LANES.find((l) => l.id === id)?.y ?? 1100;
}

/** Data curta determinística (dd/mm em UTC — estável em todos os fusos). */
export function shortDate(iso?: string): string | undefined {
  if (!iso) return undefined;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return undefined;
  const d = new Date(ms);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

interface TimelineItem {
  lane: string;
  id: string;
  date?: string;
  make(x: number, y: number): GitCanvasNode;
}

function buildTimelineGraph(map: ProjectMap): CanvasGraph {
  const items: TimelineItem[] = [];
  const seen = new Set<string>();

  // --- commits (dedup por sha — o mesmo sha pode aparecer em 2 branches) ---
  for (const c of map.commits) {
    const id = `commit:${c.sha}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const msg = c.message.length > 42 ? `${c.message.slice(0, 42)}…` : c.message;
    const date = c.date;
    items.push({
      lane: "commits", id, date,
      make: (x, y) => node(id, "commit", x, y, {
        label: msg,
        sub: [c.sha.slice(0, 7), c.author, shortDate(date)].filter(Boolean).join(" · "),
        status: "ok",
        badges: [`+${c.additions}`, `-${c.deletions}`, `${c.filesChanged} arq.`],
        meta: { ...c },
      }),
    });
  }

  for (const p of map.pullRequests) {
    const id = `pr:${p.number}`;
    const date = p.updatedAt;
    items.push({
      lane: "prs", id, date,
      make: (x, y) => node(id, "pull-request", x, y, {
        label: `PR #${p.number} — ${p.title.length > 34 ? `${p.title.slice(0, 34)}…` : p.title}`,
        sub: [`${p.sourceBranch} → ${p.targetBranch}`, shortDate(date)].filter(Boolean).join(" · "),
        status: prStatus(p),
        badges: [p.state, `${p.reviews.length} reviews`],
        meta: { ...p },
      }),
    });
  }

  for (const iss of map.issues) {
    const id = `issue:${iss.number}`;
    const date = iss.updatedAt;
    items.push({
      lane: "issues", id, date,
      make: (x, y) => node(id, "issue", x, y, {
        label: `#${iss.number} — ${iss.title.length > 36 ? `${iss.title.slice(0, 36)}…` : iss.title}`,
        sub: [iss.state, shortDate(date)].filter(Boolean).join(" · "),
        status: iss.state === "open" ? "pending" : "ok",
        badges: iss.labels,
        meta: { ...iss },
      }),
    });
  }

  for (const a of map.agents) {
    const id = `agent:${a.id}`;
    const date = a.startedAt;
    items.push({
      lane: "agents", id, date,
      make: (x, y) => node(id, "agent", x, y, {
        label: `✦ ${a.provider}`,
        sub: [a.task.length > 40 ? `${a.task.slice(0, 40)}…` : a.task, shortDate(date)].filter(Boolean).join(" · "),
        status: agentStatus(a),
        badges: [a.status === "working" ? "● trabalhando" : a.status, `+${a.additions} -${a.deletions}`],
        connection: map.connections.agents,
        meta: { ...a },
      }),
    });
  }

  for (const w of map.workflows) {
    const id = `workflow:${w.id}`;
    const date = w.updatedAt;
    items.push({
      lane: "workflows", id, date,
      make: (x, y) => node(id, "workflow", x, y, {
        label: `CI ${w.name}`,
        sub: [w.status, shortDate(date)].filter(Boolean).join(" · "),
        status: workflowStatus(w),
        badges: w.jobs.length ? [`${w.jobs.filter((j) => j.status === "success").length}/${w.jobs.length} jobs`] : [],
        meta: { ...w },
      }),
    });
  }

  for (const d of map.deployments) {
    const id = `deploy:${d.id}`;
    const date = d.date;
    items.push({
      lane: "deploys", id, date,
      make: (x, y) => node(id, "deployment", x, y, {
        label: `deploy → ${d.environment}`,
        sub: [d.status, shortDate(date)].filter(Boolean).join(" · "),
        status: d.status === "success" ? "ok" : d.status === "failure" ? "error" : "running",
        badges: [d.version ?? "", d.url ? "abrir" : ""].filter(Boolean),
        meta: { ...d },
      }),
    });
  }

  for (const r of map.releases) {
    const id = `release:${r.tag}`;
    const date = r.date;
    items.push({
      lane: "releases", id, date,
      make: (x, y) => node(id, "release", x, y, {
        label: `${r.tag} — ${r.name.length > 30 ? `${r.name.slice(0, 30)}…` : r.name}`,
        sub: [`${r.commits} commits · ${r.prs} PRs`, shortDate(date)].filter(Boolean).join(" · "),
        status: "ok",
        badges: ["release"],
        meta: { ...r },
      }),
    });
  }

  // Ordena cronologicamente (mais antigo → mais recente); sem data vai ao fim,
  // nunca é descartado (o canvas nunca perde um objeto por falta de data).
  items.sort((a, b) => {
    const da = a.date ? Date.parse(a.date) : Number.POSITIVE_INFINITY;
    const db = b.date ? Date.parse(b.date) : Number.POSITIVE_INFINITY;
    const fa = Number.isFinite(da) ? da : Number.POSITIVE_INFINITY;
    const fb = Number.isFinite(db) ? db : Number.POSITIVE_INFINITY;
    if (fa !== fb) return fa - fb;
    const la = laneY(a.lane);
    const lb = laneY(b.lane);
    return la !== lb ? la - lb : a.id.localeCompare(b.id);
  });

  const nodes: GitCanvasNode[] = [
    node("project:root", "project", TL_ROOT_X, 480, {
      label: map.project.name,
      sub: map.repository ? `${map.repository.provider} · ${map.repository.defaultBranch}` : undefined,
      status: "ok",
      connection: map.connections.git,
      meta: { description: map.project.description, url: map.repository?.url },
    }),
  ];
  const edges: GitCanvasEdge[] = [];
  const nodeIds = new Set(nodes.map((n) => n.id));

  const positions = new Map<string, { x: number; y: number }>();
  items.forEach((item, i) => {
    const x = TL_FIRST_X + i * TL_DX;
    const y = laneY(item.lane);
    positions.set(item.id, { x, y });
    const n = item.make(x, y);
    nodes.push(n);
    nodeIds.add(n.id);
  });

  // Ligamentos cronológicos: cadeia por branch + relações declaradas
  // (issue→PR, issue→agente, commit→workflow, commit→deploy).
  for (const b of map.branches) {
    const chain = map.commits
      .filter((c) => c.branch === b.name)
      .sort((a, c) => Date.parse(a.date) - Date.parse(c.date));
    for (let i = 1; i < chain.length; i++) {
      const src = `commit:${chain[i - 1].sha}`;
      const tgt = `commit:${chain[i].sha}`;
      if (nodeIds.has(src) && nodeIds.has(tgt))
        edges.push(edge(`e:chain-${chain[i - 1].sha}-${chain[i].sha}`, src, tgt));
    }
  }
  for (const iss of map.issues) {
    if (iss.linkedPR && map.pullRequests.some((p) => p.number === iss.linkedPR))
      edges.push(edge(`e:issue-pr-${iss.number}`, `issue:${iss.number}`, `pr:${iss.linkedPR}`, { dashed: true }));
    if (iss.linkedAgent && map.agents.some((a) => a.id === iss.linkedAgent))
      edges.push(edge(`e:issue-agent-${iss.number}`, `issue:${iss.number}`, `agent:${iss.linkedAgent}`, { dashed: true }));
  }
  for (const w of map.workflows) {
    if (w.commitSha && seen.has(`commit:${w.commitSha}`))
      edges.push(edge(`e:wf-${w.id}`, `commit:${w.commitSha}`, `workflow:${w.id}`, { dashed: true }));
  }
  for (const d of map.deployments) {
    if (d.commitSha && seen.has(`commit:${d.commitSha}`))
      edges.push(edge(`e:dep-${d.id}`, `commit:${d.commitSha}`, `deploy:${d.id}`, { dashed: true }));
  }

  // O projeto aponta para o PRIMEIRO evento da linha do tempo (o início).
  if (items.length > 0) {
    const first = items[0];
    edges.push(edge("e:root-timeline-start", "project:root", first.id, { dashed: true }));
  }

  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// Construtor principal
// ---------------------------------------------------------------------------

export function buildCanvasGraph(map: ProjectMap, view: GitCanvasView = "project"): CanvasGraph {
  if (view === "timeline") return buildTimelineGraph(map);
  const g = groupsFor(view);
  const nodes: GitCanvasNode[] = [];
  const edges: GitCanvasEdge[] = [];

  // --- Projeto (raiz do mapa vivo) ---
  nodes.push(
    node("project:root", "project", COL_PROJECT_X, 0, {
      label: map.project.name,
      sub: map.repository ? `${map.repository.provider} · ${map.repository.defaultBranch}` : undefined,
      status: "ok",
      connection: map.connections.git,
      meta: { description: map.project.description, url: map.repository?.url },
    }),
  );

  // --- Remoto (GitHub) + Local (§12) ---
  const showRemote = g.git || g.prs || g.deploy || g.local;
  if (showRemote) {
    nodes.push(
      node("remote:github", "remote", COL_REMOTE_X, ROW_TOP_Y, {
        label: map.repository ? `☁ ${map.repository.owner}/${map.repository.name}` : "☁ Remoto",
        sub: map.connections.git === "connected" ? "conectado" : map.connections.git === "demo" ? "demo" : "conexão necessária",
        status: map.connections.git === "connected" || map.connections.git === "demo" ? "ok" : "warning",
        connection: map.connections.git,
        meta: { url: map.repository?.url },
      }),
    );
    edges.push(edge("e:project-remote", "project:root", "remote:github"));
  }

  if (g.local) {
    const loc = map.local;
    nodes.push(
      node("local:machine", "local-repository", COL_LOCAL_X, ROW_TOP_Y, {
        label: "💻 Minha máquina",
        sub: loc.connected
          ? `${loc.branch ?? "?"} · ${loc.headSha?.slice(0, 7) ?? "?"}`
          : "repositório local não conectado",
        status: loc.connected ? (loc.behind > 0 || loc.modifiedFiles > 0 ? "warning" : "ok") : "offline",
        connection: map.connections.local,
        meta: { ...loc },
      }),
    );
    edges.push(edge("e:project-local", "project:root", "local:machine"));

    if (showRemote) {
      const syncLabel = loc.connected && (loc.ahead > 0 || loc.behind > 0)
        ? `${loc.behind > 0 ? `↓${loc.behind}` : ""}${loc.ahead > 0 ? ` ↑${loc.ahead}` : ""}`.trim()
        : "sincronizado";
      edges.push(edge("e:sync", "remote:github", "local:machine", { dashed: true, label: syncLabel }));
    }

    if (loc.connected && (loc.modifiedFiles > 0 || loc.untrackedFiles > 0 || loc.stagedFiles > 0)) {
      nodes.push(
        node("local:changes", "diff", COL_LOCAL_X, ROW_TOP_Y + 130, {
          label: "⚠ Alterações locais",
          sub: `${loc.modifiedFiles} modificados · ${loc.stagedFiles} staged · ${loc.untrackedFiles} não rastreados`,
          status: "warning",
          badges: ["Revisar", "Commitar", "Descartar"],
          meta: { ...loc },
        }),
      );
      edges.push(edge("e:local-changes", "local:machine", "local:changes"));
    }
  }

  // --- Lanes de Git: branch → cadeia de commits (§8/§9) ---
  let laneY = ROW_TOP_Y + (g.local ? 280 : 160);
  if (g.git) {
    map.branches.forEach((b, i) => {
      const y = laneY + i * LANE_H;
      const branchId = `branch:${b.name}`;
      nodes.push(
        node(branchId, "branch", LANE_LABEL_X, y, {
          label: b.name,
          sub: `${b.headSha.slice(0, 7)}${b.ahead || b.behind ? ` · ↑${b.ahead} ↓${b.behind}` : ""}`,
          status: b.behind > 0 ? "warning" : "ok",
          badges: [b.isDefault ? "default" : "", b.local ? "local" : "", b.remote ? "remoto" : ""].filter(Boolean),
          meta: { ...b },
        }),
      );
      if (showRemote && b.remote) edges.push(edge(`e:remote-${b.name}`, "remote:github", branchId));
      if (g.local && b.local && map.local.connected) edges.push(edge(`e:local-${b.name}`, "local:machine", branchId, { dashed: true }));

      const commits = map.commits
        .filter((c) => c.branch === b.name)
        .sort((a, c2) => Date.parse(a.date) - Date.parse(c2.date));
      commits.forEach((c, j) => {
        const commitId = `commit:${c.sha}`;
        nodes.push(
          node(commitId, "commit", LANE_FIRST_COMMIT_X + j * COMMIT_DX, y + 8, {
            label: c.message.length > 42 ? `${c.message.slice(0, 42)}…` : c.message,
            sub: `${c.sha.slice(0, 7)} · ${c.author}`,
            status: "ok",
            badges: [`+${c.additions}`, `-${c.deletions}`, `${c.filesChanged} arq.`],
            meta: { ...c },
          }),
        );
        edges.push(
          j === 0
            ? edge(`e:${branchId}-${c.sha}`, branchId, commitId)
            : edge(`e:c-${commits[j - 1].sha}-${c.sha}`, `commit:${commits[j - 1].sha}`, commitId),
        );
      });

      // agentes conectados à branch (§13)
      if (g.agents) {
        map.agents.filter((a) => a.branch === b.name).forEach((a) => {
          const ax = LANE_FIRST_COMMIT_X + Math.max(commits.length, 1) * COMMIT_DX + 40;
          nodes.push(
            node(`agent:${a.id}`, "agent", ax, y + 4, {
              label: `✦ ${a.provider}`,
              sub: a.task.length > 40 ? `${a.task.slice(0, 40)}…` : a.task,
              status: agentStatus(a),
              badges: [
                a.status === "working" ? "● trabalhando" : a.status,
                `+${a.additions} -${a.deletions}`,
                a.testsTotal ? `testes ${a.testsPassed ?? 0}/${a.testsTotal}` : "",
              ].filter(Boolean),
              connection: map.connections.agents,
              meta: { ...a },
            }),
          );
          edges.push(edge(`e:agent-${a.id}`, branchId, `agent:${a.id}`, { animated: a.status === "working" }));
        });
      }
    });
    laneY += map.branches.length * LANE_H;
  }

  // --- PRs (§15) ---
  if (g.prs) {
    map.pullRequests.forEach((p, i) => {
      const y = ROW_TOP_Y + 280 + i * 170;
      const prId = `pr:${p.number}`;
      nodes.push(
        node(prId, "pull-request", PR_COL_X, y, {
          label: `PR #${p.number} — ${p.title.length > 34 ? `${p.title.slice(0, 34)}…` : p.title}`,
          sub: `${p.sourceBranch} → ${p.targetBranch}`,
          status: prStatus(p),
          badges: [
            p.state,
            `+${p.additions} -${p.deletions}`,
            `${p.reviews.length} reviews`,
            `${p.checks.filter((c) => c.status === "success").length}/${p.checks.length} checks`,
          ],
          meta: { ...p },
        }),
      );
      if (g.git && map.branches.some((b) => b.name === p.sourceBranch))
        edges.push(edge(`e:pr-src-${p.number}`, `branch:${p.sourceBranch}`, prId));
      if (g.git && map.branches.some((b) => b.name === p.targetBranch))
        edges.push(edge(`e:pr-tgt-${p.number}`, prId, `branch:${p.targetBranch}`, { dashed: true }));
    });
  }

  // --- Issues (§16) ---
  if (g.issues) {
    map.issues.forEach((iss, i) => {
      const y = ROW_TOP_Y + 280 + i * 140;
      const issueId = `issue:${iss.number}`;
      nodes.push(
        node(issueId, "issue", ISSUE_COL_X, y, {
          label: `#${iss.number} — ${iss.title.length > 36 ? `${iss.title.slice(0, 36)}…` : iss.title}`,
          sub: iss.state,
          status: iss.state === "open" ? "pending" : "ok",
          badges: iss.labels,
          meta: { ...iss },
        }),
      );
      if (iss.linkedBranch && map.branches.some((b) => b.name === iss.linkedBranch))
        edges.push(edge(`e:issue-branch-${iss.number}`, issueId, `branch:${iss.linkedBranch}`, { dashed: true }));
      if (iss.linkedPR && map.pullRequests.some((p) => p.number === iss.linkedPR))
        edges.push(edge(`e:issue-pr-${iss.number}`, issueId, `pr:${iss.linkedPR}`, { dashed: true }));
      if (iss.linkedAgent && map.agents.some((a) => a.id === iss.linkedAgent))
        edges.push(edge(`e:issue-agent-${iss.number}`, issueId, `agent:${iss.linkedAgent}`, { dashed: true }));
    });
  }

  // --- Deploy lane: CI → Deploy → Release (§17/§18/§19) ---
  if (g.deploy) {
    const y = laneY + 80;
    map.workflows.forEach((w, i) => {
      const x = LANE_FIRST_COMMIT_X + i * DEPLOY_DX;
      nodes.push(
        node(`workflow:${w.id}`, "workflow", x, y, {
          label: `CI · ${w.name}`,
          sub: `${w.branch ?? ""} · ${w.jobs.filter((j) => j.status === "success").length}/${w.jobs.length} jobs`,
          status: workflowStatus(w),
          badges: w.jobs.map((j) => `${j.name}: ${j.status}`),
          connection: map.connections.ci,
          meta: { ...w },
        }),
      );
      if (w.commitSha && map.commits.some((c) => c.sha === w.commitSha))
        edges.push(edge(`e:wf-${w.id}`, `commit:${w.commitSha}`, `workflow:${w.id}`));
      else if (showRemote) edges.push(edge(`e:wf-remote-${w.id}`, "remote:github", `workflow:${w.id}`, { dashed: true }));
    });
    map.deployments.forEach((d, i) => {
      const x = LANE_FIRST_COMMIT_X + (map.workflows.length + i) * DEPLOY_DX;
      nodes.push(
        node(`deploy:${d.id}`, "deployment", x, y, {
          label: `🚀 ${d.environment}`,
          sub: `${d.version ?? ""} ${d.status}`.trim(),
          status: d.status === "success" ? "ok" : d.status === "failure" ? "error" : "running",
          badges: [d.url ?? "", d.commitSha?.slice(0, 7) ?? ""].filter(Boolean),
          meta: { ...d },
        }),
      );
      const lastWf = map.workflows[map.workflows.length - 1];
      if (lastWf) edges.push(edge(`e:wf-dep-${d.id}`, `workflow:${lastWf.id}`, `deploy:${d.id}`));
    });
    map.releases.forEach((r, i) => {
      const x = LANE_FIRST_COMMIT_X + (map.workflows.length + map.deployments.length + i) * DEPLOY_DX;
      nodes.push(
        node(`release:${r.tag}`, "release", x, y, {
          label: `🏷 ${r.tag}`,
          sub: r.name,
          status: "ok",
          badges: [`${r.commits} commits`, `${r.prs} PRs`],
          meta: { ...r },
        }),
      );
      const lastDep = map.deployments[map.deployments.length - 1];
      if (lastDep) edges.push(edge(`e:rel-dep-${r.tag}`, `release:${r.tag}`, `deploy:${lastDep.id}`, { dashed: true }));
    });
  }

  // --- Arquitetura (§11/§21): árvore de código derivada do repositório ---
  if (g.architecture && map.codeTree) {
    let rowCounter = 0;
    const walk = (t: CodeTreeNode, depth: number, parentId?: string) => {
      const y = ROW_TOP_Y + rowCounter * 64;
      rowCounter += 1;
      const id = `${t.kind}:${t.id}`;
      nodes.push(
        node(id, t.kind, 80 + depth * 230, y, {
          label: t.name,
          sub: t.kind === "folder" ? `${t.children?.length ?? 0} itens` : "arquivo",
          status: "unknown",
          meta: { path: t.id },
        }),
      );
      if (parentId) edges.push(edge(`e:tree-${t.id}`, parentId, id));
      else edges.push(edge("e:project-tree", "project:root", id));
      for (const c of t.children ?? []) walk(c, depth + 1, id);
    };
    walk(map.codeTree, 0);
  }

  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// Busca global (§35) — índice pesquisável dos objetos do canvas
// ---------------------------------------------------------------------------

export interface SearchEntry {
  nodeId: string;
  kind: GitNodeKind;
  label: string;
  sub?: string;
}

export function buildSearchIndex(graph: CanvasGraph): SearchEntry[] {
  return graph.nodes.map((n) => ({
    nodeId: n.id,
    kind: n.data.kind,
    label: n.data.label,
    sub: n.data.sub,
  }));
}

/** Normaliza separadores (hífen/underscore/barra) para casar "visual git" com "visual-git". */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function searchGraph(index: SearchEntry[], query: string): SearchEntry[] {
  const q = norm(query);
  if (q.length < 2) return [];
  return index
    .filter((e) => norm(e.label).includes(q) || norm(e.sub ?? "").includes(q) || norm(e.nodeId).includes(q))
    .slice(0, 20);
}
