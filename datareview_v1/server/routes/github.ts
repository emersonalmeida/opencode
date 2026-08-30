/* eslint-disable @typescript-eslint/no-explicit-any */
// Fronteira JSON não tipada: a API do GitHub retorna JSON arbitrário que
// normalizamos para o shape ProjectMap na entrada.
/**
 * Provider GitHub + ponte Git local (spec §12/§25/§26).
 *
 * - O GITHUB_TOKEN vive SOMENTE aqui (servidor local, env). O frontend chama
 *   estas rotas; o token nunca vai para o browser.
 * - A "ponte local" é o próprio servidor: ele roda na máquina do usuário, no
 *   diretório do repositório, então comandos git SOMENTE-LEITURA
 *   (status/rev-parse/rev-list) descrevem o estado local de verdade.
 * - Nada é inventado: qualquer falha vira estado honesto na resposta
 *   (connections.* = "disconnected" + message explicando o que fazer).
 */
import type { Request, Response } from "express";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const GH_API = "https://api.github.com";

function token(): string | undefined {
  return process.env.GITHUB_TOKEN;
}

async function gh(path: string): Promise<any> {
  const r = await fetch(`${GH_API}${path}`, {
    headers: {
      Authorization: `Bearer ${token()}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`GitHub ${r.status} em ${path}: ${body.slice(0, 200)}`);
  }
  return r.json();
}

// ---------------------------------------------------------------------------
// Ponte local (§12): git somente-leitura no cwd do servidor
// ---------------------------------------------------------------------------

async function git(args: string[]): Promise<string> {
  const { stdout } = await execFileP("git", args, {
    cwd: process.cwd(),
    timeout: 8000,
    maxBuffer: 4 * 1024 * 1024,
  });
  return stdout.trim();
}

async function localRepoState(): Promise<{ state: any; connected: boolean; message?: string }> {
  try {
    const inside = await git(["rev-parse", "--is-inside-work-tree"]);
    if (inside !== "true") throw new Error("não é um repositório git");
    const [branch, headSha, porcelain] = await Promise.all([
      git(["rev-parse", "--abbrev-ref", "HEAD"]),
      git(["rev-parse", "--short=7", "HEAD"]),
      git(["status", "--porcelain"]),
    ]);
    let ahead = 0;
    let behind = 0;
    try {
      const counts = await git(["rev-list", "--left-right", "--count", "@{upstream}...HEAD"]);
      const [b, a] = counts.split(/\s+/).map(Number);
      ahead = a || 0;
      behind = b || 0;
    } catch { /* sem upstream configurado — honesto: 0/0 */ }
    const lines = porcelain ? porcelain.split("\n") : [];
    const stagedFiles = lines.filter((l) => l[0] !== " " && l[0] !== "?").length;
    const modifiedFiles = lines.filter((l) => l[1] === "M" || (l[0] === " " && l[1] !== " ")).length;
    const untrackedFiles = lines.filter((l) => l.startsWith("??")).length;
    return {
      connected: true,
      state: { connected: true, branch, headSha, ahead, behind, modifiedFiles, stagedFiles, untrackedFiles },
    };
  } catch (e) {
    return {
      connected: false,
      state: { connected: false, ahead: 0, behind: 0, modifiedFiles: 0, stagedFiles: 0, untrackedFiles: 0 },
      message: `Repositório local não conectado (${e instanceof Error ? e.message : "erro"}). Rode o servidor dentro do checkout do repositório.`,
    };
  }
}

// ---------------------------------------------------------------------------
// GET /functions/v1/github/status
// ---------------------------------------------------------------------------

export async function githubStatus(_req: Request, res: Response) {
  if (!token()) {
    res.json({
      connected: false,
      message: "GITHUB_TOKEN não configurado no servidor. Adicione ao .env e reinicie `npm run dev:server`.",
    });
    return;
  }
  try {
    const rl = await gh("/rate_limit");
    res.json({
      connected: true,
      message: `GitHub conectado (${rl?.rate?.remaining ?? "?"} requisições restantes nesta hora).`,
    });
  } catch (e) {
    res.json({
      connected: false,
      message: `Token presente, mas a API recusou: ${e instanceof Error ? e.message.slice(0, 140) : "erro"}. Verifique permissões (repo, actions, contents).`,
    });
  }
}

// ---------------------------------------------------------------------------
// POST /functions/v1/github/project-map  { owner, name }
// ---------------------------------------------------------------------------

const MAX_BRANCHES = 6;
const COMMITS_PER_BRANCH = 8;
const COMMIT_DETAIL_COUNT = 5;
const PRS = 15;
const ISSUES = 15;
const TREE_DEPTH = 3;
const TREE_CAP = 80;
const TREE_NOISE = new Set(["node_modules", "dist", ".git", "coverage", ".next", "build"]);

function buildCodeTree(paths: { path: string; type: string }[]): any {
  const root: any = { id: "root", name: "root", kind: "folder", children: [] };
  let count = 0;
  for (const { path, type } of paths) {
    if (count >= TREE_CAP) break;
    const parts = path.split("/");
    if (parts.length > TREE_DEPTH) continue;
    if (parts.some((p) => TREE_NOISE.has(p))) continue;
    let cur = root;
    let curId = "";
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      curId = curId ? `${curId}/${part}` : part;
      const isLeaf = i === parts.length - 1;
      const kind = isLeaf && type === "blob" ? "file" : "folder";
      let child = cur.children.find((c: any) => c.id === curId);
      if (!child) {
        if (count >= TREE_CAP) break;
        child = { id: curId, name: part, kind };
        if (kind === "folder") child.children = [];
        cur.children.push(child);
        count++;
      }
      cur = child;
      if (!cur.children) break;
    }
  }
  root.name = "";
  return root;
}

export async function githubProjectMap(req: Request, res: Response) {
  if (!token()) {
    res.status(503).json({
      error: "GITHUB_TOKEN não configurado no servidor (.env). Nada foi inventado — configure e tente de novo.",
    });
    return;
  }
  const { owner, name } = (req.body ?? {}) as { owner?: string; name?: string };
  const SAFE = /^[a-zA-Z0-9._-]+$/;
  if (!owner || !name || !SAFE.test(owner) || !SAFE.test(name)) {
    res.status(400).json({ error: "owner e name são obrigatórios e devem ser nomes válidos de repositório." });
    return;
  }
  const base = `/repos/${owner}/${name}`;
  try {
    const [repo, branchesRaw, local] = await Promise.all([
      gh(base),
      gh(`${base}/branches?per_page=100`),
      localRepoState(),
    ]);

    const defaultBranch: string = repo.default_branch ?? "main";
    const branches = (branchesRaw as any[]).slice(0, MAX_BRANCHES);

    // commits por branch (default completo, demais resumido) + ahead/behind
    const commits: any[] = [];
    const branchModels: any[] = [];
    await Promise.all(
      branches.map(async (b: any, i: number) => {
        const per = b.name === defaultBranch ? COMMITS_PER_BRANCH : 5;
        try {
          const list = await gh(`${base}/commits?sha=${encodeURIComponent(b.name)}&per_page=${per}`);
          for (const c of list as any[]) {
            if (commits.some((x) => x.sha === c.sha)) continue;
            commits.push({
              sha: c.sha,
              message: String(c.commit?.message ?? "").split("\n")[0],
              author: c.commit?.author?.name ?? c.author?.login ?? "?",
              date: c.commit?.author?.date ?? "",
              parents: (c.parents ?? []).map((p: any) => p.sha),
              branch: b.name,
              filesChanged: 0,
              additions: 0,
              deletions: 0,
            });
          }
        } catch { /* branch sem permissão — pula honestamente */ }
        let ahead = 0;
        let behind = 0;
        if (b.name !== defaultBranch) {
          try {
            const cmp = await gh(`${base}/compare/${encodeURIComponent(defaultBranch)}...${encodeURIComponent(b.name)}`);
            ahead = cmp.ahead_by ?? 0;
            behind = cmp.behind_by ?? 0;
          } catch { /* compare indisponível */ }
        }
        branchModels.push({
          name: b.name,
          headSha: b.commit?.sha ?? "",
          upstream: `origin/${b.name}`,
          ahead,
          behind,
          isDefault: b.name === defaultBranch,
          local: local.connected,
          remote: true,
          _order: i,
        });
      }),
    );
    branchModels.sort((a, b) => a._order - b._order).forEach((b) => delete b._order);

    // detalhes (arquivos/+/−) dos commits mais recentes
    const detailTargets = commits.slice(0, COMMIT_DETAIL_COUNT);
    await Promise.all(
      detailTargets.map(async (c) => {
        try {
          const d = await gh(`${base}/commits/${c.sha}`);
          c.filesChanged = d.files?.length ?? 0;
          c.additions = d.stats?.additions ?? 0;
          c.deletions = d.stats?.deletions ?? 0;
        } catch { /* mantém zeros — honesto */ }
      }),
    );
    for (const b of branchModels) {
      const head = commits.find((c) => c.branch === b.name);
      if (head) {
        b.lastCommitMessage = head.message;
        b.lastCommitDate = head.date;
      }
    }

    // PRs (+ reviews dos abertos), issues, actions, deployments, releases, tree
    const [prsRaw, issuesRaw, runsRaw, deploymentsRaw, releasesRaw, treeRaw] = await Promise.all([
      gh(`${base}/pulls?state=all&per_page=${PRS}`).catch(() => []),
      gh(`${base}/issues?state=all&per_page=${ISSUES}`).catch(() => []),
      gh(`${base}/actions/runs?per_page=8`).catch(() => ({ workflow_runs: [] })),
      gh(`${base}/deployments?per_page=5`).catch(() => []),
      gh(`${base}/releases?per_page=5`).catch(() => []),
      gh(`${base}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`).catch(() => null),
    ]);

    const pullRequests = await Promise.all(
      (prsRaw as any[]).map(async (p: any) => {
        let reviews: any[] = [];
        if (p.state === "open") {
          try {
            const rv = await gh(`${base}/pulls/${p.number}/reviews`);
            reviews = (rv as any[]).map((r: any) => ({
              id: String(r.id),
              author: r.user?.login ?? "?",
              state: r.state === "APPROVED" ? "approved" : r.state === "CHANGES_REQUESTED" ? "changes-requested" : "commented",
              date: r.submitted_at ?? "",
            }));
          } catch { /* reviews indisponíveis */ }
        }
        return {
          number: p.number,
          title: p.title ?? "",
          state: p.draft ? "draft" : p.merged_at ? "merged" : p.state,
          sourceBranch: p.head?.ref ?? "?",
          targetBranch: p.base?.ref ?? "?",
          filesChanged: 0,
          additions: p.additions ?? 0,
          deletions: p.deletions ?? 0,
          reviews,
          checks: [] as any[],
          comments: (p.comments ?? 0) + (p.review_comments ?? 0),
          url: p.html_url,
          updatedAt: p.updated_at ?? "",
        };
      }),
    );

    const issues = (issuesRaw as any[])
      .filter((i: any) => !i.pull_request)
      .map((i: any) => ({
        number: i.number,
        title: i.title ?? "",
        state: i.state,
        labels: (i.labels ?? []).map((l: any) => (typeof l === "string" ? l : l.name)),
        assignee: i.assignee?.login,
        milestone: i.milestone?.title,
        url: i.html_url,
        updatedAt: i.updated_at ?? "",
      }));

    const workflows = ((runsRaw as any).workflow_runs ?? []).map((w: any) => ({
      id: String(w.id),
      name: w.name ?? "workflow",
      status:
        w.status === "completed"
          ? w.conclusion === "success" ? "success" : w.conclusion === "cancelled" ? "cancelled" : "failure"
          : w.status === "queued" ? "queued" : "running",
      commitSha: w.head_sha,
      branch: w.head_branch,
      jobs: [] as any[],
      url: w.html_url,
      updatedAt: w.updated_at ?? "",
    }));
    // jobs do run mais recente (detalhe de 1 run para não estourar a API)
    if (workflows.length && (runsRaw as any).workflow_runs?.[0]?.id) {
      try {
        const jobsRaw = await gh(`${base}/actions/runs/${(runsRaw as any).workflow_runs[0].id}/jobs?per_page=20`);
        workflows[0].jobs = ((jobsRaw as any).jobs ?? []).map((j: any) => ({
          name: j.name,
          status:
            j.status === "completed"
              ? j.conclusion === "success" ? "success" : j.conclusion === "cancelled" ? "cancelled" : "failure"
              : j.status === "queued" ? "queued" : "running",
        }));
      } catch { /* sem jobs */ }
    }

    const deployments = (deploymentsRaw as any[]).map((d: any) => ({
      id: String(d.id),
      environment: (d.environment ?? "production") as string,
      status: "success" as const,
      url: undefined,
      version: d.ref,
      commitSha: d.sha,
      date: d.created_at ?? "",
    }));

    const releases = (releasesRaw as any[]).map((r: any) => ({
      tag: r.tag_name ?? "",
      name: r.name ?? r.tag_name ?? "",
      date: r.published_at ?? r.created_at ?? "",
      commits: 0,
      prs: 0,
      notes: String(r.body ?? "").slice(0, 400),
      url: r.html_url,
    }));

    const codeTree = treeRaw?.tree ? buildCodeTree(treeRaw.tree) : undefined;

    const map = {
      demo: false,
      project: { name: (repo.full_name ?? `${owner}/${name}`).toUpperCase(), description: repo.description ?? undefined },
      repository: {
        id: repo.full_name,
        owner,
        name,
        defaultBranch,
        url: repo.html_url,
        provider: "github",
        description: repo.description ?? undefined,
      },
      branches: branchModels,
      commits,
      pullRequests,
      issues,
      agents: [],
      workflows,
      deployments,
      releases,
      local: local.state,
      codeTree,
      connections: {
        git: "connected",
        agents: "disconnected",
        ci: workflows.length ? "connected" : "disconnected",
        local: local.connected ? "connected" : "disconnected",
      },
    };
    res.json({ map, localMessage: local.connected ? undefined : local.message });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro desconhecido";
    const status = msg.includes("404") ? 404 : msg.includes("403") ? 403 : 502;
    res.status(status).json({
      error: `Falha ao montar o mapa do GitHub: ${msg.slice(0, 200)}. Verifique o repositório e as permissões do token.`,
    });
  }
}
