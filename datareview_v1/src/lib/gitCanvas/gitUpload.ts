/**
 * Git Canvas — parser/normalizador de ARQUIVOS GIT enviados pelo usuário.
 *
 * Quando o usuário não consegue conectar o repo local no navegador nem o
 * GitHub, ele sobe arquivos com dados de verdade do Git e o sistema constrói
 * o ProjectMap a partir deles. A UI NUNCA inventa: o que um arquivo não
 * declara fica fora do mapa e é listado como "gap".
 */

export interface GitUploadParseIssue {
  file: string;
  reason: string;
}

export interface GitUploadResult {
  name: string;
  defaultBranch: string;
  commits: {
    sha: string; message: string; author: string; date: string;
    parents: string[]; branch?: string; filesChanged: number; additions: number; deletions: number;
  }[];
  branches: {
    name: string; headSha: string; ahead: number; behind: number;
    isDefault: boolean; local: boolean; remote: boolean;
    lastCommitMessage?: string; lastCommitDate?: string;
  }[];
  tags: { name: string; sha: string; message?: string; date?: string }[];
  stash: { message: string; branch?: string; date?: string; author?: string }[];
  reflog: { sha: string; action: string; message?: string; author?: string; date?: string }[];
  treePaths: string[];
  status: { modified: number; staged: number; untracked: number };
  diff: { files: number; insertions: number; deletions: number } | null;
  gaps: string[];
  issues: GitUploadParseIssue[];
  filesRead: number;
}

const SEP = "\u001F";
const ISO = (s: string): string | undefined => {
  const m = Date.parse(s);
  return Number.isFinite(m) ? new Date(m).toISOString() : undefined;
};
const trimSha = (s: string) => s.trim().toLowerCase().slice(0, 40);

export function repoNameFromInput(files: { name: string; relativePath?: string }[]): string {
  for (const f of files) {
    const rel = f.relativePath || f.name;
    const parts = rel.split(/[\\/]/).filter(Boolean);
    if (parts.length > 1) return parts[0].replace(/\.git$/i, "") || "repo";
  }
  return "repo enviado";
}

interface FileInput { name: string; relativePath?: string; text: string }

function emptyAcc() {
  return {
    commits: [] as GitUploadResult["commits"],
    branchNames: [] as string[],
    tags: [] as GitUploadResult["tags"],
    stash: [] as GitUploadResult["stash"],
    reflog: [] as GitUploadResult["reflog"],
    treePaths: [] as string[],
    status: { modified: 0, staged: 0, untracked: 0 },
    diff: null as GitUploadResult["diff"],
    diffObj: null as { files?: number; insertions?: number; deletions?: number } | null,
    json: [] as [string, unknown[]][],
  };
}

function detectAndParse(f: FileInput, acc: ReturnType<typeof emptyAcc>) {
  const name = f.name.toLowerCase();
  const text = f.text;

  // 1) JSON estruturado
  if (name.endsWith(".json")) {
    try {
      const j = JSON.parse(text);
      if (j && typeof j === "object") {
        for (const [k, v] of Object.entries(j)) {
          if (Array.isArray(v)) acc.json.push([k, v]);
          else if (k === "diff" && v && typeof v === "object") acc.diffObj = v as { files?: number; insertions?: number; deletions?: number };
        }
        return true;
      }
    } catch { /* cai nos detectores textuais */ }
  }

  // 2) git log com %H|%P|%an|%aI|%s + --numstat
  if (/^[0-9a-z]{7,40}\|/.test(text.trim()) || text.includes(SEP) || /\|\d{4}-\d{2}-\d{2}T/.test(text)) {
    parseLog(text, acc);
    return true;
  }
  // 3) git reflog
  if (/^[0-9a-z]{7,40} HEAD@\{/.test(text.trim()) || /HEAD@\{\d+\}/.test(text)) {
    parseReflog(text, acc);
    return true;
  }
  // 4) git stash list
  if (/^stash@\{\d+\}:/.test(text.trim())) {
    parseStash(text, acc);
    return true;
  }
  // 5) tags / for-each-ref refs/tags
  if (/^refs\/tags\//.test(text.trim()) || /^\s*v?\d+\.\d+\.\d+/.test(text.trim()) || /^[0-9a-z]{7,40}\s+refs\/tags\//.test(text.trim())) {
    parseTags(text, acc);
    return true;
  }
  // 6) git ls-tree -r --long
  if (/^\d{6} (blob|tree|commit) [0-9a-z]{7,40}/.test(text.trim())) {
    parseTree(text, acc);
    return true;
  }
  // 7) git status --porcelain
  if (/^([ MADRCU?!]{2} |## )/.test(text)) {
    parseStatus(text, acc);
    return true;
  }
  // 8) git diff --shortstat
  const shortstat = text.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/);
  if (shortstat) {
    acc.diff = {
      files: Number(shortstat[1]),
      insertions: Number(shortstat[2] ?? 0),
      deletions: Number(shortstat[3] ?? 0),
    };
    return true;
  }
  // 9) git branch -a (só branches)
  if (/^[\s*]*[\w\-./]+$/.test(text.trim().split("\n")[0] || "") && !text.includes("|") && !text.includes("HEAD@{") && !text.includes("refs/tags/") && !text.includes("blob")) {
    parseBranches(text, acc);
    return true;
  }
  return false;
}

function parseLog(text: string, acc: ReturnType<typeof emptyAcc>) {
  const lines = text.split("\n");
  let cur: ReturnType<typeof emptyAcc>["commits"][number] | null = null;
  for (const raw of lines) {
    const line = raw.replace(/\r$/, "");
    // eslint-disable-next-line no-control-regex -- separador de campos do git log
    const header = line.match(/^([0-9a-z]{7,40})[|\u001F]([^|\u001F]*)[|\u001F]([^|\u001F]*)[|\u001F]([0-9T:\-+Z ]+)[|\u001F](.*)$/i);
    if (header) {
      cur = {
        sha: trimSha(header[1]),
        parents: header[2] ? header[2].trim().split(/\s+/).filter(Boolean).map(trimSha) : [],
        author: header[3].trim(),
        date: ISO(header[4]) ?? header[4].trim(),
        message: header[5].trim(),
        filesChanged: 0, additions: 0, deletions: 0,
      };
      acc.commits.push(cur);
      continue;
    }
    if (cur) {
      const num = line.match(/^(\d+|-)\s+(\d+|-)\s+(.+)$/);
      if (num) {
        cur.additions += num[1] === "-" ? 0 : Number(num[1]);
        cur.deletions += num[2] === "-" ? 0 : Number(num[2]);
        cur.filesChanged += 1;
      }
    }
  }
}

function parseReflog(text: string, acc: ReturnType<typeof emptyAcc>) {
  for (const line of text.split("\n")) {
    const m = line.match(/^([0-9a-z]{7,40})\s+HEAD@\{\d+\}:\s*([^:]+):\s*(.*)$/i);
    if (m) {
      acc.reflog.push({ sha: trimSha(m[1]), action: m[2].trim(), message: m[3].trim() });
      continue;
    }
    const alt = line.match(/^([0-9a-z]{7,40})\s+(\w+(?::)?)\s*(.*)$/i);
    if (alt) acc.reflog.push({ sha: trimSha(alt[1]), action: alt[2].replace(/:$/, ""), message: alt[3].trim() });
  }
}

function parseStash(text: string, acc: ReturnType<typeof emptyAcc>) {
  for (const line of text.split("\n")) {
    const m = line.match(/^stash@\{\d+\}:\s*(?:WIP on ([^:]+)|On ([^:]+))?:\s*(.*)$/i);
    if (m) {
      acc.stash.push({
        branch: (m[1] || m[2])?.trim(),
        message: m[3].trim(),
      });
    }
  }
}

function parseTags(text: string, acc: ReturnType<typeof emptyAcc>) {
  for (const line of text.split("\n")) {
    const fr = line.match(/^([0-9a-z]{7,40})\s+refs\/tags\/(.+)$/i);
    if (fr) {
      acc.tags.push({ sha: trimSha(fr[1]), name: fr[2].trim() });
      continue;
    }
    const t = line.match(/^\s*(v?\d+\.\d+\.\d+[^\s]*)\s*$/);
    if (t) acc.tags.push({ name: t[1].trim(), sha: "" });
  }
}

function parseTree(text: string, acc: ReturnType<typeof emptyAcc>) {
  for (const line of text.split("\n")) {
    const m = line.match(/^\d{6} (blob|tree|commit) [0-9a-z]{7,40}\s+(?:\d+|-)\s+(.+)$/i)
      || line.match(/^\d{6} (blob|tree|commit) [0-9a-z]{7,40}\s+(.+)$/i);
    if (m) acc.treePaths.push(m[2].trim());
  }
}

function parseStatus(text: string, acc: ReturnType<typeof emptyAcc>) {
  for (const line of text.split("\n")) {
    if (!line.trim() || line.startsWith("##")) continue;
    const xy = line.slice(0, 2);
    if (xy.includes("?")) acc.status.untracked += 1;
    else if (xy[0] !== " " && xy[0] !== "?") acc.status.staged += 1;
    else if (xy[1] !== " " && xy[1] !== "?") acc.status.modified += 1;
  }
}

function parseBranches(text: string, acc: ReturnType<typeof emptyAcc>) {
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*(\*?\s*)([\w\-./]+)\s*$/);
    if (m) acc.branchNames.push(m[2]);
  }
}

export function buildProjectMapFromUpload(files: FileInput[]): GitUploadResult {
  const acc = emptyAcc();
  const issues: GitUploadParseIssue[] = [];
  let filesRead = 0;

  for (const f of files) {
    const ok = detectAndParse(f, acc);
    if (ok) filesRead += 1;
    else issues.push({ file: f.name, reason: "formato não reconhecido (nenhum detector de git bateu)" });
  }

  // JSON estruturado (override/complemento)
  for (const [k, v] of acc.json) {
    if (k === "commits") acc.commits = v as GitUploadResult["commits"];
    if (k === "branches") acc.branchNames = (v as { name?: string }[]).map((b) => b.name ?? String(b));
    if (k === "tags") acc.tags = v as GitUploadResult["tags"];
    if (k === "stash") acc.stash = v as GitUploadResult["stash"];
    if (k === "reflog") acc.reflog = v as GitUploadResult["reflog"];
    if (k === "tree" || k === "treePaths") acc.treePaths = v as string[];
    if (k === "status" && v && typeof v === "object" && !Array.isArray(v)) {
      const s = v as { modified?: number; staged?: number; untracked?: number };
      acc.status = { modified: s.modified ?? 0, staged: s.staged ?? 0, untracked: s.untracked ?? 0 };
    }
  }
  if (acc.diffObj) acc.diff = { files: acc.diffObj.files ?? 0, insertions: acc.diffObj.insertions ?? 0, deletions: acc.diffObj.deletions ?? 0 };

  const name = repoNameFromInput(files);
  const headCommit = acc.reflog.find((r) => /checkout/.test(r.action) && /moving from/.test(r.message ?? ""));
  const checkoutTo = headCommit?.message?.match(/to ([\w\-./]+)/)?.[1];
  const defaultBranch = checkoutTo
    ?? acc.branchNames.find((b) => b === "main") ?? acc.branchNames[0] ?? "main";

  const branchSet = new Set(acc.branchNames);
  if (branchSet.size === 0 && acc.commits.length) branchSet.add(defaultBranch);
  const branches: GitUploadResult["branches"] = [...branchSet].map((b) => {
    const head = acc.commits.find((c) => c.branch === b) ?? acc.commits[0];
    return {
      name: b,
      headSha: head?.sha ?? "",
      ahead: 0, behind: 0,
      isDefault: b === defaultBranch,
      local: true, remote: false,
      lastCommitMessage: head?.message,
      lastCommitDate: head?.date,
    };
  });

  const branchHeads = new Map<string, string>();
  for (const b of branches) if (b.headSha) branchHeads.set(b.headSha, b.name);
  const visited = new Set<string>();
  for (const c of acc.commits) {
    if (!c.branch) {
      const head = branchHeads.get(c.sha);
      if (head) c.branch = head;
      else if (!visited.has(c.sha)) c.branch = defaultBranch;
    }
    visited.add(c.sha);
  }

  const gaps: string[] = [];
  if (acc.commits.length === 0) gaps.push("commits");
  if (branches.length === 0) gaps.push("branches");
  if (acc.tags.length === 0) gaps.push("tags");
  if (acc.stash.length === 0) gaps.push("stash");
  if (acc.reflog.length === 0) gaps.push("reflog");
  if (acc.treePaths.length === 0) gaps.push("árvore de arquivos");
  if (acc.diff === null && (acc.status.modified + acc.status.staged + acc.status.untracked) === 0)
    gaps.push("mudanças locais (status/diff)");

  return {
    name,
    defaultBranch,
    commits: acc.commits,
    branches,
    tags: acc.tags,
    stash: acc.stash,
    reflog: acc.reflog,
    treePaths: acc.treePaths,
    status: acc.status,
    diff: acc.diff,
    gaps,
    issues,
    filesRead,
  };
}

// ---------------------------------------------------------------------------
// Conversão para ProjectMap — ÚNICA implementação (antes duplicada em
// GitCanvas.connectUpload e gitCanvasBridge.tryLocalFolder).
// ---------------------------------------------------------------------------

import type { ProjectMap } from "./types";

/**
 * Converte um GitUploadResult para ProjectMap. `sourceLabel` descreve a
 * origem ("upload", "snapshot do servidor", "pasta local") para a descrição;
 * `source` marca a origem estruturada (auto-refresh do snapshot local).
 */
export function uploadResultToMap(
  result: GitUploadResult,
  sourceLabel = "upload",
  source: "upload" | "local-snapshot" | "local-folder" = "upload",
): ProjectMap {
  return {
    project: { name: result.name, description: `Repositório via ${sourceLabel} (${result.filesRead} arquivos)` },
    repository:
      result.branches.length || result.commits.length
        ? {
            id: result.name,
            owner: "local",
            name: result.name,
            defaultBranch: result.defaultBranch,
            provider: "upload",
            description: `Fonte: ${sourceLabel}`,
          }
        : undefined,
    branches: result.branches,
    commits: result.commits,
    pullRequests: [],
    issues: [],
    agents: [],
    workflows: [],
    deployments: [],
    releases: result.tags.map((t) => ({
      tag: t.name,
      name: t.name,
      date: t.date ?? new Date().toISOString(),
      commits: 0,
      prs: 0,
      notes: t.message,
    })),
    local: {
      connected: true,
      branch: result.defaultBranch,
      headSha: result.branches.find((b) => b.isDefault)?.headSha ?? result.branches[0]?.headSha ?? "",
      ahead: 0,
      behind: 0,
      modifiedFiles: result.status.modified,
      stagedFiles: result.status.staged,
      untrackedFiles: result.status.untracked,
    },
    refs: { reflog: result.reflog, stash: result.stash, tags: result.tags },
    connections: { git: "connected", agents: "disconnected", ci: "disconnected", local: "connected" },
    demo: false,
    upload: true,
    uploadMeta: { name: result.name, filesRead: result.filesRead, gaps: result.gaps, source },
  };
}
