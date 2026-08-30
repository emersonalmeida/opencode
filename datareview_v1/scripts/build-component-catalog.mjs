#!/usr/bin/env node
/**
 * Gera `src/lib/componentInventory.generated.ts` — inventário estático de
 * componentes React do sistema (src/components + src/pages) e o grafo de
 * "qual página importa qual componente". Usado pela página /componentes para
 * descobrir repetições, compartilhados e componentes específicos.
 *
 * Determinístico: ordenação estável, sem rede. Rode com:
 *   node scripts/build-component-catalog.mjs
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const COMPONENTS_DIR = join(SRC, "components");
const PAGES_DIR = join(SRC, "pages");

function walk(dir, out = []) {
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx|ts)$/.test(name) && !name.endsWith(".test.tsx") && !name.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

/** Exportados com nome capitalizado (componentes) de um arquivo .tsx. */
function exportedComponents(source) {
  const names = new Set();
  const patterns = [
    /export\s+(?:async\s+)?function\s+([A-Z][A-Za-z0-9]*)\s*\(/g,
    /export\s+const\s+([A-Z][A-Za-z0-9]*)\s*[=:]/g,
    /export\s+class\s+([A-Z][A-Za-z0-9]*)\s/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(source))) names.add(m[1]);
  }
  // export default function Nome / export { A, B }
  let m;
  const def = /export\s+default\s+function\s+([A-Z][A-Za-z0-9]*)/g;
  while ((m = def.exec(source))) names.add(m[1]);
  const braces = /export\s*\{([^}]+)\}/g;
  while ((m = braces.exec(source))) {
    for (const part of m[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/).pop().trim();
      if (/^[A-Z]/.test(name)) names.add(name);
    }
  }
  return [...names].sort();
}

/** Imports "@/components/..." e relativos de um arquivo. */
function importedComponentFiles(source, fromFile) {
  const files = new Set();
  const re = /import\s+(?:type\s+)?(?:[\w*{}\s,]+)\s+from\s+["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(source))) {
    const spec = m[1];
    if (spec.startsWith("@/components/")) files.add(join(SRC, spec.slice(2)) + guessExt(join(SRC, spec.slice(2))));
    else if (spec.startsWith(".")) {
      const base = join(dirname(fromFile), spec);
      if (base.includes("/components")) files.add(base + guessExt(base));
    }
  }
  return [...files];
}

function guessExt(baseNoExt) {
  if (/\.(tsx|ts)$/.test(baseNoExt)) return "";
  try { statSync(baseNoExt + ".tsx"); return ".tsx"; } catch { /* */ }
  try { statSync(baseNoExt + ".ts"); return ".ts"; } catch { /* */ }
  try { statSync(join(baseNoExt, "index.tsx")); return "/index.tsx"; } catch { /* */ }
  return ".tsx";
}

const componentFiles = walk(COMPONENTS_DIR);
const pageFiles = walk(PAGES_DIR);

/** Hooks React usados no arquivo (useState, useMemo, useDataset…). */
function extractHooks(source) {
  const re = /(?<![\w.])use[A-Z][A-Za-z0-9]*/g;
  const found = new Set();
  let m;
  while ((m = re.exec(source))) found.add(m[0]);
  return [...found].sort();
}

/** Heurística Atomic Design do sistema (simples e explicável):
 *  - atom: não importa outros componentes do sistema;
 *  - molecule: ≤2 deps locais e <160 linhas;
 *  - organism: mais deps/tamanho;
 *  - page: arquivo em src/pages. */
function classifyAtomic(isPage, depCount, lines) {
  if (isPage) return "page";
  if (depCount === 0) return "atom";
  if (depCount <= 2 && lines < 160) return "molecule";
  return "organism";
}

const components = [];
const byFile = new Map();
for (const file of componentFiles) {
  const source = readFileSync(file, "utf8");
  const rel = relative(SRC, file).replace(/\\/g, "/");
  const entry = {
    file: rel,
    dir: relative(SRC, dirname(file)).replace(/\\/g, "/"),
    exports: exportedComponents(source),
    lines: source.split("\n").length,
    deps: [],
    hooks: extractHooks(source),
    atomic: "atom", // refinado na 2ª passada
  };
  components.push(entry);
  byFile.set(file, entry);
}
// 2ª passada: deps resolvidas (agora todos os arquivos já existem no mapa).
for (const file of componentFiles) {
  const entry = byFile.get(file);
  const source = readFileSync(file, "utf8");
  const deps = importedComponentFiles(source, file)
    .map((f) => byFile.get(f))
    .filter(Boolean)
    .map((c) => c.file);
  entry.deps = [...new Set(deps)].sort();
  entry.atomic = classifyAtomic(false, entry.deps.length, entry.lines);
}

// Grafo página → componentes (diretos).
const pageUsage = [];
for (const page of pageFiles) {
  const source = readFileSync(page, "utf8");
  const rel = relative(SRC, page).replace(/\\/g, "/");
  const used = importedComponentFiles(source, page)
    .map((f) => byFile.get(f))
    .filter(Boolean)
    .map((c) => c.file);
  pageUsage.push({ page: rel, components: [...new Set(used)].sort() });
}

// Uso por outros componentes (compartilhamento interno).
const compToComp = new Map(); // file -> Set(used files)
for (const file of componentFiles) {
  const source = readFileSync(file, "utf8");
  const used = importedComponentFiles(source, file)
    .map((f) => byFile.get(f))
    .filter(Boolean)
    .map((c) => c.file);
  compToComp.set(byFile.get(file).file, new Set(used));
}

// Contagem de consumidores por componente (páginas + componentes).
const consumerCount = new Map();
const bump = (f) => consumerCount.set(f, (consumerCount.get(f) ?? 0) + 1);
for (const pu of pageUsage) for (const c of pu.components) bump(c);
for (const used of compToComp.values()) for (const c of used) bump(c);

const inventory = components
  .map((c) => ({ ...c, consumers: consumerCount.get(c.file) ?? 0 }))
  .sort((a, b) => a.file.localeCompare(b.file));

// Duplicados por nome de símbolo exportado em arquivos diferentes.
const byExport = new Map();
for (const c of inventory) for (const e of c.exports) {
  if (!byExport.has(e)) byExport.set(e, []);
  byExport.get(e).push(c.file);
}
const duplicates = [...byExport.entries()]
  .filter(([, files]) => files.length > 1)
  .map(([name, files]) => ({ name, files: files.sort() }))
  .sort((a, b) => a.name.localeCompare(b.name));

const header = `/** GENERATED — rode \`node scripts/build-component-catalog.mjs\`.
 * Inventário de componentes (${inventory.length} arquivos, ${pageUsage.length} páginas). */
export type AtomicLevel = "atom" | "molecule" | "organism" | "template" | "page";
export interface ComponentInventoryEntry {
  file: string;
  dir: string;
  exports: string[];
  lines: number;
  /** Imports locais de componentes (Atomic Design: do que é feito). */
  deps: string[];
  /** Hooks React usados no arquivo. */
  hooks: string[];
  /** Classificação Atomic Design (heurística do gerador). */
  atomic: AtomicLevel;
  consumers: number;
}
export interface PageUsageEntry { page: string; components: string[]; }
export interface DuplicateEntry { name: string; files: string[]; }
`;

const out = `${header}
export const COMPONENT_INVENTORY: ComponentInventoryEntry[] = ${JSON.stringify(inventory, null, 1)};

export const PAGE_USAGE: PageUsageEntry[] = ${JSON.stringify(pageUsage, null, 1)};

export const DUPLICATE_EXPORTS: DuplicateEntry[] = ${JSON.stringify(duplicates, null, 1)};
`;

writeFileSync(join(SRC, "lib", "componentInventory.generated.ts"), out);

// Mapa de módulos lazy: qualquer componente do inventário pode ser
// importado dinamicamente para renderização ao vivo (catálogo, layouts,
// design canvas, páginas customizadas).
const modulesEntries = inventory
  .map((c) => `  ${JSON.stringify(c.file)}: () => import(${JSON.stringify("@/" + c.file.replace(/\.(tsx|ts)$/, ""))}),`)
  .join("\n");
const modulesOut = `/** GENERATED — rode \`node scripts/build-component-catalog.mjs\`.
 * Mapa de módulos lazy por arquivo de componente (render genérico). */
export interface ComponentModule { default?: unknown; [key: string]: unknown }
export const COMPONENT_MODULES: Record<string, () => Promise<ComponentModule>> = {
${modulesEntries}
};
`;
writeFileSync(join(SRC, "lib", "componentModules.generated.ts"), modulesOut);

console.log(`componentInventory: ${inventory.length} componentes, ${pageUsage.length} páginas, ${duplicates.length} exports duplicados.`);
