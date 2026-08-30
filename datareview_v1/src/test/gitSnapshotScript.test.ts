import { describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const execFileP = promisify(execFile);
const ROOT = process.cwd();
const SCRIPT = join(ROOT, "scripts", "git-canvas-snapshot.mjs");
const OUT = join(ROOT, ".git-canvas");

describe("scripts/git-canvas-snapshot.mjs", () => {
  it("gera snapshot.json válido no repositório atual", async () => {
    const { stdout } = await execFileP("node", [SCRIPT], { cwd: ROOT, timeout: 30000 });
    expect(stdout).toContain("snapshot");
    const path = join(OUT, "snapshot.json");
    expect(existsSync(path)).toBe(true);
    const snap = JSON.parse(readFileSync(path, "utf8"));
    expect(snap.ok).toBe(true);
    expect(snap.repoName).toBeTruthy();
    expect(snap.files.length).toBeGreaterThanOrEqual(5);
    expect(snap.files.some((f: { name: string }) => f.name === "git-log.txt")).toBe(true);
    expect(Number.isNaN(Date.parse(snap.generatedAt))).toBe(false);
  }, 40_000);

  it("escreve os arquivos .txt individuais", async () => {
    expect(existsSync(join(OUT, "git-log.txt"))).toBe(true);
    expect(existsSync(join(OUT, "git-branches.txt"))).toBe(true);
    const log = readFileSync(join(OUT, "git-log.txt"), "utf8");
    // formato %H␟%P␟%an␟%aI␟%s — separador control imune a pipes no subject
    expect(log.split("\n")[0].split("\u001f").length).toBe(5);
  });

  it("--hooks instala hooks idempotentes com o marcador", async () => {
    const { stdout } = await execFileP("node", [SCRIPT, "--hooks"], { cwd: ROOT, timeout: 30000 });
    expect(stdout).toMatch(/instalado|já instalado/);
    const hook = join(ROOT, ".git", "hooks", "post-commit");
    expect(existsSync(hook)).toBe(true);
    const content = readFileSync(hook, "utf8");
    expect(content).toContain("# git-canvas-snapshot");
    // idempotente: rodar de novo não duplica
    await execFileP("node", [SCRIPT, "--hooks"], { cwd: ROOT, timeout: 30000 });
    const again = readFileSync(hook, "utf8");
    expect(again.split("# git-canvas-snapshot").length - 1).toBe(1);
  }, 40_000);
});
