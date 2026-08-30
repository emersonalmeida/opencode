#!/usr/bin/env node
/**
 * Diagnóstico do ambiente de testes — roda na máquina do usuário.
 * Uso: node scripts/diagnose-tests.mjs
 */
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const results = [];

function check(name, fn) {
  try {
    const value = fn();
    results.push({ name, ok: true, value });
  } catch (err) {
    results.push({ name, ok: false, value: err.message?.slice(0, 120) });
  }
}

check("Node.js", () => process.version);
check("@swc/core (transform)", () => typeof require("@swc/core").transform);
check("@swc/core-linux (binding nativo)", () => {
  const pkg = require("@swc/core/package.json");
  const dir = join(process.cwd(), "node_modules", "@swc");
  const files = readdirSync(dir).filter((f) => f.startsWith("core-"));
  return files.length ? files.join(", ") : "NENHUM binding nativo encontrado";
});
check("jsdom (JSDOM)", () => typeof require("jsdom").JSDOM);
check("vitest", () => require("vitest/package.json").version);
check("@vitejs/plugin-react-swc", () => {
  const pkg = JSON.parse(readFileSync(join(process.cwd(), "node_modules/@vitejs/plugin-react-swc/package.json"), "utf-8"));
  return pkg.version;
});
check("vite", () => require("vite/package.json").version);

// Verifica se o postinstall do SWC rodou (binding existe)
check("SWC postinstall rodou?", () => {
  const swcDir = join(process.cwd(), "node_modules", "@swc");
  if (!existsSync(swcDir)) return "diretório @swc não existe";
  const files = readdirSync(swcDir);
  const hasBinding = files.some((f) => f.includes("linux") || f.includes("darwin") || f.includes("win32"));
  return hasBinding ? "sim" : "NÃO — rode: npm rebuild @swc/core";
});

console.log("\n=== DIAGNÓSTICO DO AMBIENTE DE TESTES ===\n");
for (const r of results) {
  const icon = r.ok ? "✅" : "❌";
  console.log(`${icon} ${r.name}: ${r.value}`);
}

const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.log(`\n⚠️  ${failed.length} problema(s) encontrado(s).`);
  console.log("\nSolução provável:");
  console.log("  npm rebuild @swc/core esbuild");
  console.log("  # ou, se persistir:");
  console.log("  rm -rf node_modules package-lock.json && npm install");
} else {
  console.log("\n✅ Ambiente OK — se os testes ainda falharem, o problema é outro.");
}

function readdirSync(dir) {
  try {
    return execSync(`ls "${dir}"`, { encoding: "utf-8" }).trim().split("\n");
  } catch {
    return [];
  }
}
