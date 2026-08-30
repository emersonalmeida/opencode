#!/usr/bin/env node
/**
 * Git Canvas — gerador de snapshot do repositório (auto-regeneração).
 *
 * Gera os arquivos `.git-canvas/*.txt` + `.git-canvas/snapshot.json` com os
 * MESMOS conteúdos que a rota /functions/v1/git-local/snapshot devolve e que
 * o parser de upload da página Git consome. Nada é inventado: comando que
 * falha é omitido e listado em `failed`.
 *
 * Uso:
 *   node scripts/git-canvas-snapshot.mjs            # gera uma vez
 *   node scripts/git-canvas-snapshot.mjs --watch    # regenera a cada mudança (poll 2s)
 *   node scripts/git-canvas-snapshot.mjs --hooks    # instala hooks git (post-commit etc.)
 *   node scripts/git-canvas-snapshot.mjs --quiet    # sem saída (uso interno dos hooks)
 *
 * Os hooks instalados (post-commit, post-merge, post-checkout, post-rewrite)
 * chamam este script em background após CADA operação git — os arquivos
 * ficam sempre atualizados para upload/inspeção na página Git.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdirSync, writeFileSync, existsSync, readFileSync, chmodSync } from "node:fs";
import { join } from "node:path";

const execFileP = promisify(execFile);
const OUT_DIR = ".git-canvas";
const HOOKS = ["post-commit", "post-merge", "post-checkout", "post-rewrite"];

const COMMANDS = [
  { name: "git-log.txt", args: ["log", "--format=%H\u001FP\u001F%an\u001FaI\u001F%s", "--numstat", "--all", "-n", "500"] },
  { name: "git-reflog.txt", args: ["reflog", "--date=iso", "-n", "200"] },
  { name: "git-stash.txt", args: ["stash", "list", "--date=iso"] },
  { name: "git-tags.txt", args: ["for-each-ref", "refs/tags", "--format=%(objectname:short) %(refname) %(creatordate:iso)"] },
  { name: "git-branches.txt", args: ["branch", "-a"] },
  { name: "git-status.txt", args: ["status", "--porcelain"] },
  { name: "git-diff.txt", args: ["diff", "--shortstat", "HEAD"] },
  { name: "git-tree.txt", args: ["ls-tree", "-r", "HEAD", "--long"] },
];

async function git(args) {
  const { stdout } = await execFileP("git", args, { timeout: 10000, maxBuffer: 8 * 1024 * 1024 });
  return stdout;
}

async function generate(quiet) {
  const inside = (await git(["rev-parse", "--is-inside-work-tree"])).trim();
  if (inside !== "true") {
    if (!quiet) console.error("✗ não é um repositório git");
    process.exitCode = 1;
    return false;
  }
  const top = (await git(["rev-parse", "--show-toplevel"])).trim();
  const repoName = top.split("/").filter(Boolean).pop();
  const outDir = join(top, OUT_DIR);
  mkdirSync(outDir, { recursive: true });

  const files = [];
  const failed = [];
  for (const cmd of COMMANDS) {
    try {
      const text = await git(cmd.args);
      files.push({ name: cmd.name, text });
      writeFileSync(join(outDir, cmd.name), text, "utf8");
    } catch {
      failed.push(cmd.name);
    }
  }
  const snapshot = { ok: true, repoName, files, failed, generatedAt: new Date().toISOString() };
  writeFileSync(join(outDir, "snapshot.json"), JSON.stringify(snapshot, null, 2), "utf8");
  if (!quiet) {
    console.log(`✓ snapshot de "${repoName}" → ${OUT_DIR}/ (${files.length} arquivos${failed.length ? `, ${failed.length} falharam: ${failed.join(", ")}` : ""})`);
  }
  return true;
}

/** fingerprint barato: HEAD + índice + refs — muda em commit/checkout/status. */
async function fingerprint() {
  try {
    const [head, status] = await Promise.all([
      git(["rev-parse", "HEAD"]).catch(() => "none"),
      git(["status", "--porcelain"]).catch(() => ""),
    ]);
    return `${head.trim()}|${status.length}|${status.split("\n").length}`;
  } catch {
    return "err";
  }
}

async function watch() {
  console.log("Observando o repositório (Ctrl+C para parar)…");
  let last = await fingerprint();
  await generate(true);
  console.log("✓ snapshot inicial gerado");
  setInterval(async () => {
    const fp = await fingerprint();
    if (fp !== last) {
      last = fp;
      const ok = await generate(true);
      if (ok) console.log(`✓ regenerado em ${new Date().toLocaleTimeString("pt-BR")}`);
    }
  }, 2000);
}

async function installHooks() {
  const top = (await git(["rev-parse", "--show-toplevel"])).trim();
  const hooksDir = join(top, ".git", "hooks");
  const marker = "# git-canvas-snapshot";
  const line = `${marker}\n(node "${join(top, "scripts", "git-canvas-snapshot.mjs")}" --quiet >/dev/null 2>&1 &)`;
  for (const hook of HOOKS) {
    const path = join(hooksDir, hook);
    let content = existsSync(path) ? readFileSync(path, "utf8") : "#!/bin/sh\n";
    if (content.includes(marker)) {
      console.log(`· ${hook}: já instalado`);
      continue;
    }
    if (!content.endsWith("\n")) content += "\n";
    content += line + "\n";
    writeFileSync(path, content, "utf8");
    chmodSync(path, 0o755);
    console.log(`✓ ${hook}: instalado`);
  }
  console.log("Hooks ativos: o snapshot regenera sozinho após commit/merge/checkout/rewrite.");
}

const mode = process.argv[2];
if (mode === "--watch") {
  watch();
} else if (mode === "--hooks") {
  installHooks().catch((e) => { console.error("✗", e.message); process.exitCode = 1; });
} else {
  generate(mode === "--quiet").then((ok) => { if (!ok) process.exitCode = 1; });
}
