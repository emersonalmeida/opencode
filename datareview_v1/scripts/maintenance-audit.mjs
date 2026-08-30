#!/usr/bin/env node
/**
 * Agente de manutenção do próprio projeto (Onda 4.5): roda as 3 auditorias
 * determinísticas (multifontAudit + flags órfãs + razão de crescimento) e
 * gera um relatório consolidado em Markdown, pronto para virar issue/PR.
 *
 * Uso: npm run maintenance:audit [-- --out=docs/relatorios/audit.md]
 *
 * Exit code 0 = tudo saudável; 1 = alguma auditoria reprovou (o relatório
 * detalha quais e por quê) — pronto para CI/agendamento.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6)
  ?? `docs/relatorios/maintenance-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}.md`;

function runVitest(file) {
  try {
    const out = execFileSync("npx", ["vitest", "run", file, "--reporter=dot"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120_000,
    });
    const summary = out.split("\n").find((l) => l.includes("Tests"))?.trim() ?? "ok";
    return { ok: true, summary, output: out };
  } catch (err) {
    const output = `${err.stdout ?? ""}${err.stderr ?? ""}`;
    const summary = output.split("\n").find((l) => l.includes("Tests"))?.trim() ?? "falhou";
    return { ok: false, summary, output };
  }
}

function runGrowth() {
  try {
    const out = execFileSync("node", ["scripts/growth-ratio.mjs"], { encoding: "utf8", timeout: 60_000 });
    return { ok: true, summary: out.trim().split("\n").pop() ?? "ok", output: out };
  } catch (err) {
    return { ok: false, summary: "falhou", output: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

const checks = [
  { id: "flags-órfãs", title: "Flags órfãs (Onda 1.4)", run: () => runVitest("src/test/flagAudit.test.ts") },
  { id: "multifont", title: "Auditoria multifonte", run: () => runVitest("src/test/multifontAudit.test.ts") },
  { id: "crescimento", title: "Razão de crescimento (one-in-one-out)", run: runGrowth },
];

const results = checks.map((c) => ({ ...c, result: c.run() }));
const healthy = results.every((r) => r.result.ok);

const now = new Date().toLocaleString("pt-BR");
const lines = [
  `# Relatório de manutenção — ${now}`,
  "",
  `Veredito geral: **${healthy ? "✅ SAUDÁVEL" : "⚠️ ATENÇÃO NECESSÁRIA"}**`,
  "",
  "| Auditoria | Status | Resumo |",
  "|---|---|---|",
  ...results.map(
    (r) => `| ${r.title} | ${r.result.ok ? "✅" : "❌"} | ${r.result.summary.replaceAll("|", "\\|")} |`,
  ),
  "",
  "---",
  "",
  ...results.flatMap((r) => [
    `## ${r.title}`,
    "",
    "```",
    r.result.output.trim().split("\n").slice(-25).join("\n"),
    "```",
    "",
  ]),
];

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, lines.join("\n"));
console.log(`Relatório: ${OUT}`);
console.log(healthy ? "✅ Todas as auditorias passaram" : "⚠️ Alguma auditoria reprovou — ver o relatório");
process.exit(healthy ? 0 : 1);
