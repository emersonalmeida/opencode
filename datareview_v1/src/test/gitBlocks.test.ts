import { describe, expect, it } from "vitest";
import { buildBlocksData, buildBlocksTreeData } from "@/lib/gitCanvas/blocksData";
import { GIT_CANVAS_VIEWS } from "@/lib/gitCanvas/types";
import { VIEW_SHORTCUTS } from "@/lib/gitCanvas/commands";
import type { ProjectMap } from "@/lib/gitCanvas/types";

function baseMap(overrides: Partial<ProjectMap> = {}): ProjectMap {
  return {
    project: { name: "repo-x" },
    branches: [
      { name: "main", headSha: "abc12345", ahead: 0, behind: 0, isDefault: true, local: true, remote: true },
      { name: "feature-x", headSha: "def56789", ahead: 2, behind: 1, isDefault: false, local: true, remote: false },
    ],
    commits: [
      { sha: "abc12345", message: "feat: um", author: "Dev", date: "2026-08-01T10:00:00Z", parents: [], filesChanged: 3, additions: 10, deletions: 2 },
    ],
    pullRequests: [],
    issues: [],
    agents: [],
    workflows: [],
    deployments: [],
    releases: [],
    local: { connected: true, branch: "main", headSha: "abc12345", ahead: 0, behind: 0, modifiedFiles: 1, stagedFiles: 0, untrackedFiles: 2 },
    refs: {
      reflog: [{ sha: "abc12345", action: "commit", message: "feat: um", date: "2026-08-01T10:00:00Z" }],
      stash: [{ message: "wip", branch: "main" }],
      tags: [{ name: "v1.0.0", sha: "abc12345", message: "release", date: "2026-08-01T10:00:00Z" }],
    },
    connections: { git: "connected", agents: "disconnected", ci: "disconnected", local: "connected" },
    demo: false,
    upload: true,
    uploadMeta: { name: "repo-x", filesRead: 6, gaps: ["Sem arquivo de PRs."] },
    ...overrides,
  };
}

describe("buildBlocksData", () => {
  it("monta seções de branches/commits/tags/reflog/stash/gaps com dados reais", () => {
    const sections = buildBlocksData(baseMap());
    const ids = sections.map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining(["branches", "commits", "tags", "reflog", "stash", "gaps"]));
    const branches = sections.find((s) => s.id === "branches")!;
    expect(branches.items).toHaveLength(2);
    expect(branches.items[0].badges).toContain("padrão");
    const commits = sections.find((s) => s.id === "commits")!;
    expect(commits.items[0].label).toBe("feat: um");
    expect(commits.items[0].sub).toContain("abc12345");
    expect(commits.items[0].badges).toContain("+10");
  });

  it("omite seções vazias (nunca finge dados)", () => {
    const map = baseMap({ refs: { reflog: [], stash: [], tags: [] }, uploadMeta: { name: "x", filesRead: 2, gaps: [] } });
    const ids = buildBlocksData(map).map((s) => s.id);
    expect(ids).not.toContain("tags");
    expect(ids).not.toContain("reflog");
    expect(ids).not.toContain("stash");
    expect(ids).not.toContain("gaps");
    expect(ids).toContain("branches");
  });

  it("retorna [] para mapa totalmente vazio", () => {
    const map = baseMap({
      branches: [], commits: [],
      refs: { reflog: [], stash: [], tags: [] },
      uploadMeta: { name: "x", filesRead: 0, gaps: [] },
    });
    expect(buildBlocksData(map)).toEqual([]);
  });

  it("visão 'blocks' está registrada em GIT_CANVAS_VIEWS e VIEW_SHORTCUTS", () => {
    expect(GIT_CANVAS_VIEWS.some((v) => v.id === "blocks")).toBe(true);
    expect(VIEW_SHORTCUTS.b).toBe("blocks");
  });
});

describe("buildBlocksTreeData (layout Árvore)", () => {
  it("aninha commits sob as branches declaradas", () => {
    const map = baseMap({
      commits: [
        { sha: "abc12345", message: "c1", author: "D", date: "2026-08-01T10:00:00Z", parents: [], branch: "main", filesChanged: 1, additions: 1, deletions: 0 },
        { sha: "def56789", message: "c2", author: "D", date: "2026-08-02T10:00:00Z", parents: ["abc12345"], branch: "feature-x", filesChanged: 2, additions: 5, deletions: 1 },
      ],
    });
    const roots = buildBlocksTreeData(map);
    const repo = roots.find((r) => r.id === "repo")!;
    const main = repo.children.find((b) => b.id === "branch:main")!;
    const feat = repo.children.find((b) => b.id === "branch:feature-x")!;
    expect(main.children.map((c) => c.label)).toEqual(["c1"]);
    expect(feat.children.map((c) => c.label)).toEqual(["c2"]);
    // tags e stash viram ramos raiz
    expect(roots.some((r) => r.id === "tags")).toBe(true);
    expect(roots.some((r) => r.id === "stash")).toBe(true);
  });

  it("commits sem branch vão para seção honesta de órfãos", () => {
    const map = baseMap({
      commits: [
        { sha: "abc12345", message: "sem branch", author: "D", date: "2026-08-01T10:00:00Z", parents: [], filesChanged: 0, additions: 0, deletions: 0 },
      ],
    });
    const repo = buildBlocksTreeData(map).find((r) => r.id === "repo")!;
    const orphans = repo.children.find((c) => c.id === "orphans")!;
    expect(orphans.label).toContain("sem branch");
    expect(orphans.children).toHaveLength(1);
  });

  it("mapa vazio não gera raiz de repo", () => {
    const map = baseMap({ branches: [], commits: [], refs: { reflog: [], stash: [], tags: [] } });
    expect(buildBlocksTreeData(map)).toEqual([]);
  });
});
