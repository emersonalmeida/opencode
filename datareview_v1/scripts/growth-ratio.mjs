#!/usr/bin/env node
/**
 * Mede a razão de crescimento do código (inserções × deleções) — governança
 * "superfície é orçamento" (Onda 1.2 do docs/proxima-versao.md).
 *
 * Uso:
 *   npm run governance:growth                 # desde a última tag (ou 200 commits)
 *   node scripts/growth-ratio.mjs v1.0.0      # desde uma ref específica
 *   node scripts/growth-ratio.mjs --last 50   # últimos N commits
 *
 * Alvo: ~3:1 (3 linhas adicionadas por 1 removida). Acima de ~10:1 o sistema
 * está só crescendo — sinal para podar/flag-off superfícies antes de criar
 * novas (regra one-in-one-out).
 *
 * Ignora arquivos gerados/travados (lockfiles, catálogos gerados, dist) para
 * a razão refletir trabalho real de código.
 */
import { execSync } from "node:child_process";

const args = process.argv.slice(2);
const IGNORE = [
  ":(exclude)package-lock.json",
  ":(exclude)bun.lockb",
  ":(exclude)*.generated.ts",
  ":(exclude)dist/*",
  ":(exclude)public/versions/*",
  ":(exclude)*.md",
];

function run(cmd) {
  return execSync(cmd, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function range() {
  const lastIdx = args.indexOf("--last");
  if (lastIdx >= 0) return `-n ${Number(args[lastIdx + 1]) || 200}`;
  const ref = args.find((a) => !a.startsWith("--"));
  if (ref) return `${ref}..HEAD`;
  try {
    const tag = run("git describe --tags --abbrev=0").trim();
    return `${tag}..HEAD`;
  } catch {
    return "-n 200";
  }
}

const RANGE = range();
const numstat = run(`git log ${RANGE} --numstat --format="" -- ${IGNORE.map((p) => `"${p}"`).join(" ")} src server scripts`)
  .split("\n")
  .map((l) => l.trim().split(/\s+/))
  .filter((parts) => parts.length >= 2 && /^\d+$/.test(parts[0]));

const added = numstat.reduce((sum, p) => sum + Number(p[0]), 0);
const deleted = numstat.reduce((sum, p) => sum + Number(p[1]), 0);
const commits = run(`git log ${RANGE} --format="%h"`).split("\n").filter(Boolean).length;
const ratio = deleted === 0 ? Infinity : added / deleted;

console.log(`Razão de crescimento (${RANGE}, ${commits} commits, src/server/scripts):`);
console.log(`  inserções: ${added.toLocaleString("pt-BR")}`);
console.log(`  deleções:  ${deleted.toLocaleString("pt-BR")}`);
console.log(`  razão:     ${deleted === 0 ? "∞ (nenhuma deleção)" : `${ratio.toFixed(1)}:1`}`);
console.log(`  alvo:      ~3:1`);
if (deleted === 0 || ratio > 6) {
  console.log("  veredito:  ⚠ crescendo sem podar — aplique one-in-one-out (flag-off/deprecar uma superfície por superfície nova).");
} else {
  console.log("  veredito:  ✓ razão saudável.");
}
