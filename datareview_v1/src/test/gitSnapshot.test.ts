import { describe, expect, it } from "vitest";
import { collectGitSnapshot, SNAPSHOT_COMMANDS, type GitExecFn } from "../../server/lib/gitSnapshot";
import { buildProjectMapFromUpload } from "@/lib/gitCanvas/gitUpload";

/** exec mockado que responde comandos git por assinatura de args. */
function mockExec(responses: Record<string, string | Error>): GitExecFn {
  return async (args) => {
    const key = args.join(" ");
    for (const [k, v] of Object.entries(responses)) {
      if (key.startsWith(k)) {
        if (v instanceof Error) throw v;
        return v;
      }
    }
    throw new Error(`comando não mockado: ${key}`);
  };
}

const BASE = {
  "rev-parse --is-inside-work-tree": "true",
  "rev-parse --show-toplevel": "/home/user/meu-repo",
};

describe("collectGitSnapshot", () => {
  it("coleta todos os arquivos quando os comandos respondem", async () => {
    const snap = await collectGitSnapshot(mockExec({
      ...BASE,
      "log --format": "abc1234| |Dev|2026-08-01T10:00:00Z|feat: inicial\n\n1\t0\tsrc/index.ts\n",
      "reflog": "abc1234 HEAD@{0}: commit: feat: inicial",
      "stash list": "stash@{0}: WIP on main: abc1234 feat",
      "for-each-ref": "abc1234 refs/tags/v1.0.0 2026-08-01 10:00:00 +0000",
      "branch -a": "* main\n  feature-x\n",
      "status --porcelain": " M src/index.ts\n?? novo.ts\n",
      "diff --shortstat": " 3 files changed, 10 insertions(+), 2 deletions(-)",
      "ls-tree -r HEAD --long": "100644 blob abc1234     100 src/index.ts\n",
    }));
    expect(snap.ok).toBe(true);
    expect(snap.repoName).toBe("meu-repo");
    expect(snap.failed).toHaveLength(0);
    expect(snap.files.map((f) => f.name)).toEqual(SNAPSHOT_COMMANDS.map((c) => c.name));
  });

  it("ok=false quando não é repositório git", async () => {
    const snap = await collectGitSnapshot(mockExec({
      "rev-parse --is-inside-work-tree": new Error("not a git repository"),
    }));
    expect(snap.ok).toBe(false);
    expect(snap.message).toContain("git");
    expect(snap.files).toHaveLength(0);
  });

  it("ok=false quando rev-parse diz false", async () => {
    const snap = await collectGitSnapshot(mockExec({
      "rev-parse --is-inside-work-tree": "false",
    }));
    expect(snap.ok).toBe(false);
    expect(snap.message).toContain("não é um repositório");
  });

  it("omite arquivos cujos comandos falham e lista em failed", async () => {
    const snap = await collectGitSnapshot(mockExec({
      ...BASE,
      "log --format": "abc1234||Dev|2026-08-01T10:00:00Z|init\n",
      "reflog": new Error("no reflog"),
      "stash list": "",
      "for-each-ref": "",
      "branch -a": "* main\n",
      "status --porcelain": "",
      "diff --shortstat": "",
      "ls-tree -r HEAD --long": "",
    }));
    expect(snap.ok).toBe(true);
    expect(snap.failed).toEqual(["git-reflog.txt"]);
    expect(snap.files.some((f) => f.name === "git-log.txt")).toBe(true);
    expect(snap.files.some((f) => f.name === "git-reflog.txt")).toBe(false);
  });

  it("working tree limpo (status vazio) é válido, não falha", async () => {
    const snap = await collectGitSnapshot(mockExec({
      ...BASE,
      "log --format": "abc1234||Dev|2026-08-01T10:00:00Z|init\n",
      "reflog": "",
      "stash list": "",
      "for-each-ref": "",
      "branch -a": "* main\n",
      "status --porcelain": "",
      "diff --shortstat": "",
      "ls-tree -r HEAD --long": "",
    }));
    expect(snap.ok).toBe(true);
    expect(snap.failed).toHaveLength(0);
  });

  it("snapshot alimenta o parser de upload de ponta a ponta", async () => {
    const snap = await collectGitSnapshot(mockExec({
      ...BASE,
      "log --format": [
        "def5678|abc1234|Dev|2026-08-02T10:00:00Z|feat: dois",
        "",
        "2\t1\tsrc/index.ts",
        "",
        "abc1234||Dev|2026-08-01T10:00:00Z|feat: inicial",
        "",
        "1\t0\tsrc/index.ts",
        "",
      ].join("\n"),
      "reflog": "def5678 HEAD@{0}: commit: feat: dois\nabc1234 HEAD@{1}: clone: from origin",
      "stash list": "",
      "for-each-ref": "def5678 refs/tags/v1.0.0 2026-08-02 10:00:00 +0000",
      "branch -a": "* main\n  feature-x\n",
      "status --porcelain": " M src/index.ts\n",
      "diff --shortstat": " 1 file changed, 2 insertions(+)",
      "ls-tree -r HEAD --long": "100644 blob abc1234     100 src/index.ts\n",
    }));
    expect(snap.ok).toBe(true);
    const result = buildProjectMapFromUpload(
      snap.files.map((f) => ({ name: f.name, relativePath: f.name, text: f.text })),
    );
    expect(result.commits.length).toBeGreaterThanOrEqual(2);
    expect(result.branches.length).toBeGreaterThanOrEqual(2);
    expect(result.tags).toHaveLength(1);
    expect(result.status.modified).toBe(1);
    // filesRead conta só arquivos cujo formato foi reconhecido (≥ 7 dos 8)
    expect(result.filesRead).toBeGreaterThanOrEqual(7);
    expect(result.filesRead).toBeLessThanOrEqual(snap.files.length);
  });

  it("generatedAt é ISO válido", async () => {
    const snap = await collectGitSnapshot(mockExec(BASE));
    expect(Number.isNaN(Date.parse(snap.generatedAt))).toBe(false);
  });
});
