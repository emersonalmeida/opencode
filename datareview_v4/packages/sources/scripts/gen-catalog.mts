/**
 * Gera docs/SOURCES.md a partir do catálogo machine-readable
 * (packages/sources/src/catalog/registry.ts) — garante que a documentação
 * nunca deriva do catálogo (fonte de verdade única).
 *
 * Uso: pnpm --filter @v4/sources gen:catalog
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  catalogByGroup,
  SOURCE_CATALOG,
} from "../src/catalog/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, "..", "..", "..", "docs", "SOURCES.md");

const GROUP_LABEL: Record<string, string> = {
  uni: "Uni — coleta direta (front /00)",
  connectors: "Conectores declarativos (uniConnectors)",
  discover: "Descoberta (sem chave)",
  stores: "Lojas e reviews",
  knowledge: "Conhecimento e infra",
};

function statusLabel(s: string): string {
  if (s === "implemented") return "PRONTO";
  if (s === "bridge") return "PONTE(v1)";
  return "PLANEJADO";
}

function renderRow(e: (typeof SOURCE_CATALOG)[number]): string {
  const keys = e.keys?.length ? e.keys.join(", ") : "—";
  const params = e.params.join(", ");
  const data = e.data.join(", ");
  const acumulado = [
    `| **${e.id}**`,
    e.label,
    e.method,
    e.auth,
    e.capabilities.join(", "),
    params,
    data,
    e.resource.replace(/\|/g, "\\|"),
    keys,
    statusLabel(e.status),
  ].join(" | ") + " |";
  const blocks: string[] = [];
  if (e.tosNote) blocks.push(`> **ToS/restrição:** ${e.tosNote}`);
  if (e.notes) blocks.push(`> **Operação:** ${e.notes}`);
  const extra = (blocks.length ? "\n\n" : "") + blocks.map((b) => b.replace(/\|/g, "\\|")).join("\n>\n");
  return acumulado + extra + "\n";
}

function build(): string {
  const lines: string[] = [];
  lines.push("# Catálogo de fontes de coleta");
  lines.push("");
  lines.push(
    `${SOURCE_CATALOG.length} fontes documentadas. Gerado de \`packages/sources/src/catalog/\` ` +
    "(fonte de verdade) — não editar à mão; regerar com `pnpm --filter @v4/sources gen:catalog`.",
  );
  lines.push("");
  lines.push("Legenda de status: **PRONTO** = coletor ativo no v4; **PONTE(v1)** = coletor funcional no legado v1, a ser embrulhado por um `SourcePort`; **PLANEJADO** = mapeado, sem coletor ainda.");
  lines.push("");
  lines.push("## Resumo por grupo");
  lines.push("");
  lines.push("| Grupo | Fontes |");
  lines.push("|-------|--------|");
  for (const g of ["uni", "connectors", "discover", "stores", "knowledge"] as const) {
    lines.push(`| ${GROUP_LABEL[g]} | ${catalogByGroup(g).length} |`);
  }
  lines.push("");
  for (const g of ["uni", "connectors", "discover", "stores", "knowledge"] as const) {
    const group = catalogByGroup(g);
    if (!group.length) continue;
    lines.push(`## ${GROUP_LABEL[g]} (${group.length})`);
    lines.push("");
    lines.push("| id | label | método | auth | capacidades | parâmetros | dados | recurso | chaves | status |");
    lines.push("|----|-------|--------|------|-------------|------------|-------|---------|--------|--------|");
    for (const e of group) lines.push(renderRow(e));
    lines.push("");
  }
  lines.push("---");
  lines.push("");
  lines.push("## Totais");
  lines.push("");
  lines.push("| Métrica | Valor |");
  lines.push("|---------|-------|");
  lines.push(`| Fontes documentadas | ${SOURCE_CATALOG.length} |`);
  lines.push(`| Prontas / ponte v1 | ${SOURCE_CATALOG.filter((e) => e.status === "implemented" || e.status === "bridge").length} |`);
  lines.push(`| Planejadas | ${SOURCE_CATALOG.filter((e) => e.status === "planned").length} |`);
  lines.push("");
  return lines.join("\n");
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, build());
console.log(`SOURCES.md gerado: ${outPath}`);