#!/usr/bin/env node
/**
 * Gera docs/COMPILADO.md — um único arquivo com TODO o conteúdo da
 * documentação (guias, fontes, páginas, histórico, arquitetura, progresso,
 * referências, relatórios, testing), concatenado na ordem canônica.
 *
 * Regras:
 * - Ordem fixa de seções (GUIAS_ORDER) e alfabética dentro de cada pasta;
 *   README.md de cada subpasta entra primeiro (é o índice/introdução).
 * - Excluídos: fontes/notebooks/ (outputs brutos históricos, até 7k linhas),
 *   o próprio COMPILADO.md e arquivos fora de docs/.
 * - Cada documento vira uma seção "## ‹caminho›" com âncora — o sumário no
 *   topo linka todas.
 *
 * Rodar: npm run docs:compilado
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "docs");
const OUT = join(ROOT, "COMPILADO.md");

const SECTION_ORDER = [
  "README.md",
  "guias",
  "fontes",
  "pages",
  "historico",
  "arquitetura",
  "progresso",
  "referencias",
  "relatorios",
  "testing",
];
const EXCLUDE_DIRS = new Set([join(ROOT, "fontes", "notebooks")]);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (!EXCLUDE_DIRS.has(full)) out.push(...walk(full));
    } else if (name.endsWith(".md") && full !== OUT) {
      out.push(full);
    }
  }
  return out;
}

function orderKey(path) {
  const rel = relative(ROOT, path);
  const parts = rel.split("/");
  const top = parts.length > 1 ? parts[0] : parts[0];
  const topIdx = SECTION_ORDER.indexOf(top);
  const isReadme = parts[parts.length - 1] === "README.md" ? "0" : "1";
  return `${String(topIdx === -1 ? 99 : topIdx).padStart(2, "0")}/${rel
    .replace(/README\.md$/, "00-README.md")
    .toLowerCase()}|${isReadme}`;
}

/** Monta o conteúdo completo do COMPILADO.md em memória (puro, sem escrever). */
export function buildCompilado() {
  const files = walk(ROOT)
    .filter((f) => relative(ROOT, f) !== "README.md")
    .sort((a, b) => orderKey(a).localeCompare(orderKey(b)));

  // README.md do docs/ vai primeiro, como capa.
  const cover = readFileSync(join(ROOT, "README.md"), "utf8");

  const toc = [];
  const body = [];
  let totalLines = 0;
  for (const file of files) {
    const rel = relative(ROOT, file);
    const anchor = rel.replace(/[^\w/-]+/g, "").replace(/[/.]/g, "-").toLowerCase();
    toc.push(`- [\`${rel}\`](#doc-${anchor})`);
    const content = readFileSync(file, "utf8").trimEnd();
    totalLines += content.split("\n").length;
    body.push(`<a id="doc-${anchor}"></a>\n\n## 📄 \`${rel}\`\n\n${content}\n`);
  }

  const header = `# COMPILADO — documentação completa em um único arquivo

> **Gerado automaticamente** por \`scripts/build-docs-compilado.mjs\`
> (\`npm run docs:compilado\`). **NÃO EDITAR À MÃO** — edite os arquivos
> individuais e regenere. A guarda \`src/test/docsCompilado.test.ts\` falha
> no CI se o compilado estiver desatualizado.
>
> ${files.length} documentos · ${totalLines.toLocaleString("pt-BR")} linhas de
> conteúdo. Os notebooks históricos brutos (\`fontes/notebooks/\`) ficam fora
> de propósito — são artefatos de saída, não leitura.

---

# Índice dos documentos

${toc.join("\n")}

---

# Capa (docs/README.md)

${cover.trimEnd()}

---

# Documentos

`;

  return header + body.join("\n---\n\n") + "\n";
}

// Executa só quando chamado como script (npm run docs:compilado).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(OUT, buildCompilado());
  console.log(`OK: ${OUT} gerado`);
}
