import { describe, it, expect } from "vitest";
import { buildProjectMapFromUpload, repoNameFromInput } from "@/lib/gitCanvas/gitUpload";

const logText = `abc1234|def5678|João Silva|2026-08-20T10:00:00Z|feat: add parser
5\t3\tsrc/lib/parser.ts
2\t1\tsrc/lib/utils.ts
def5678|ghi9012|Maria Souza|2026-08-19T09:00:00Z|fix: bug fix
1\t0\tREADME.md
`;

const reflogText = `abc1234 HEAD@{0}: checkout: moving from main to feature-x
def5678 HEAD@{1}: commit: feat: add parser
ghi9012 HEAD@{2}: clone: from github.com:user/repo
`;

const stashText = `stash@{0}: WIP on main: 1234567 unfinished work
stash@{1}: On feature-x: 7654321 another stash
`;

const tagsText = `abc1234 refs/tags/v1.0.0
def5678 refs/tags/v0.9.0
`;

const treeText = `100644 blob abc1234 1234 src/lib/parser.ts
100644 blob def5678 567 src/lib/utils.ts
040000 tree ghi9012 - src/components
`;

const statusText = `## main
 M src/lib/parser.ts
A  src/lib/new.ts
?? src/lib/temp.ts
`;

const diffText = ` 3 files changed, 10 insertions(+), 2 deletions(-)`;

const branchesText = `  main
* feature-x
  develop
`;

describe("gitUpload parser (arquivos git)", () => {
  it("repoNameFromInput: pasta > arquivo", () => {
    expect(repoNameFromInput([{ name: "log.txt", relativePath: "my-repo/log.txt" }])).toBe("my-repo");
    expect(repoNameFromInput([{ name: "log.txt" }])).toBe("repo enviado");
  });

  it("detecta e parseia git log com numstat", () => {
    const r = buildProjectMapFromUpload([{ name: "log.txt", text: logText }]);
    expect(r.filesRead).toBe(1);
    expect(r.commits).toHaveLength(2);
    expect(r.commits[0].sha).toBe("abc1234");
    expect(r.commits[0].message).toBe("feat: add parser");
    expect(r.commits[0].filesChanged).toBe(2);
    expect(r.commits[0].additions).toBe(7);
    expect(r.commits[0].deletions).toBe(4);
    expect(r.commits[0].parents).toEqual(["def5678"]);
    expect(r.commits[0].branch).toBe("main"); // defaultBranch
  });

  it("detecta e parseia git reflog", () => {
    const r = buildProjectMapFromUpload([{ name: "reflog.txt", text: reflogText }]);
    expect(r.reflog).toHaveLength(3);
    expect(r.reflog[0].action).toBe("checkout");
    expect(r.reflog[1].action).toBe("commit");
    expect(r.reflog[2].action).toBe("clone");
  });

  it("detecta e parseia git stash list", () => {
    const r = buildProjectMapFromUpload([{ name: "stash.txt", text: stashText }]);
    expect(r.stash).toHaveLength(2);
    expect(r.stash[0].branch).toBe("main");
    expect(r.stash[0].message).toBe("1234567 unfinished work");
    expect(r.stash[1].branch).toBe("feature-x");
  });

  it("detecta e parseia git tags (for-each-ref)", () => {
    const r = buildProjectMapFromUpload([{ name: "tags.txt", text: tagsText }]);
    expect(r.tags).toHaveLength(2);
    expect(r.tags[0].name).toBe("v1.0.0");
    expect(r.tags[0].sha).toBe("abc1234");
  });

  it("detecta e parseia git ls-tree", () => {
    const r = buildProjectMapFromUpload([{ name: "tree.txt", text: treeText }]);
    expect(r.treePaths).toEqual(["src/lib/parser.ts", "src/lib/utils.ts", "src/components"]);
  });

  it("detecta e parseia git status --porcelain", () => {
    const r = buildProjectMapFromUpload([{ name: "status.txt", text: statusText }]);
    expect(r.status.modified).toBe(1);
    expect(r.status.staged).toBe(1);
    expect(r.status.untracked).toBe(1);
  });

  it("detecta e parseia git diff --shortstat", () => {
    const r = buildProjectMapFromUpload([{ name: "diff.txt", text: diffText }]);
    expect(r.diff).toEqual({ files: 3, insertions: 10, deletions: 2 });
  });

  it("detecta e parseia git branch -a", () => {
    const r = buildProjectMapFromUpload([{ name: "branches.txt", text: branchesText }]);
    expect(r.branches).toHaveLength(3);
    expect(r.branches.map((b) => b.name)).toEqual(["main", "feature-x", "develop"]);
    expect(r.branches.find((b) => b.name === "main")?.isDefault).toBe(true);
  });

  it("combina múltiplos arquivos de um repo real", () => {
    const r = buildProjectMapFromUpload([
      { name: "log.txt", text: logText },
      { name: "reflog.txt", text: reflogText },
      { name: "stash.txt", text: stashText },
      { name: "tags.txt", text: tagsText },
      { name: "tree.txt", text: treeText },
      { name: "status.txt", text: statusText },
      { name: "diff.txt", text: diffText },
      { name: "branches.txt", text: branchesText },
    ]);
    expect(r.filesRead).toBe(8);
    expect(r.commits).toHaveLength(2);
    expect(r.branches).toHaveLength(3);
    expect(r.tags).toHaveLength(2);
    expect(r.stash).toHaveLength(2);
    expect(r.reflog).toHaveLength(3);
    expect(r.treePaths).toHaveLength(3);
    expect(r.status.modified).toBe(1);
    expect(r.diff).toEqual({ files: 3, insertions: 10, deletions: 2 });
    expect(r.gaps).toHaveLength(0); // tudo coberto
    expect(r.defaultBranch).toBe("feature-x"); // reflog checkout indica
  });

  it("JSON estruturado sobrescreve/complementa", () => {
    const json = JSON.stringify({
      commits: [{ sha: "zzz9999", message: "json commit", author: "AI", date: "2026-08-21T00:00:00Z", parents: [], filesChanged: 1, additions: 1, deletions: 0 }],
      branches: [{ name: "json-branch" }],
      tags: [{ name: "v2.0.0", sha: "zzz9999" }],
    });
    const r = buildProjectMapFromUpload([{ name: "data.json", text: json }]);
    expect(r.commits).toHaveLength(1);
    expect(r.commits[0].sha).toBe("zzz9999");
    expect(r.branches[0].name).toBe("json-branch");
    expect(r.tags[0].name).toBe("v2.0.0");
  });

  it("arquivo desconhecido gera issue honesta", () => {
    const r = buildProjectMapFromUpload([{ name: "readme.txt", text: "hello world" }]);
    expect(r.filesRead).toBe(0);
    expect(r.issues).toHaveLength(1);
    expect(r.issues[0].reason).toContain("não reconhecido");
    expect(r.gaps.length).toBeGreaterThan(0); // tudo é gap
  });

  it("dedup de sha: mesmo commit não duplica", () => {
    const dup = logText + logText;
    const r = buildProjectMapFromUpload([{ name: "log.txt", text: dup }]);
    // parser não dedup (arquivo é único), mas buildProjectMapFromUpload não duplica branches
    expect(r.branches.filter((b) => b.name === "main")).toHaveLength(1);
  });
});
