/**
 * Guarda de documentação de fontes — garante que TODA fonte do sistema tem
 * doc completa em docs/fontes/ e que o catálogo-mestre a referencia.
 *
 * Cobertura exigida: 2 lojas canônicas (apple, google) + todos os
 * UniSourceId builtin (33) + a fonte custom = 36 docs.
 * Se uma fonte nova for adicionada sem doc, este teste falha.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { UNI_SOURCE_META } from "@/lib/uni/types";

const FONTES_DIR = join(__dirname, "..", "..", "docs", "fontes");
const DATE = "2026-08-25";

/** fonte id → slug do arquivo de doc. */
const DOC_SLUG: Record<string, string> = {
  apple: "apple-app-store",
  google: "google-play",
  suggest: "google-suggest",
  trends: "google-trends",
  serp: "serp-multi-engine",
  web: "web-extractor",
  feed: "rss-feed",
  archive: "internet-archive",
  custom: "fontes-customizadas",
};

function docFile(sourceId: string): string {
  const slug = DOC_SLUG[sourceId] ?? sourceId;
  return `${slug}-${DATE}.md`;
}

const EXPECTED_SOURCES = ["apple", "google", ...Object.keys(UNI_SOURCE_META)];

const REQUIRED_SECTIONS = ["## O que é", "## Entradas", "## Saídas", "## Fluxo", "## Valor"];

describe("documentação de fontes", () => {
  it("toda fonte tem doc completa em docs/fontes/", () => {
    const files = new Set(readdirSync(FONTES_DIR));
    const missing: string[] = [];
    for (const src of EXPECTED_SOURCES) {
      if (!files.has(docFile(src))) missing.push(`${src} → ${docFile(src)}`);
    }
    expect(missing, `fontes sem doc:\n${missing.join("\n")}`).toEqual([]);
  });

  it("toda doc tem as seções canônicas", () => {
    const problems: string[] = [];
    for (const src of EXPECTED_SOURCES) {
      const content = readFileSync(join(FONTES_DIR, docFile(src)), "utf-8");
      for (const section of REQUIRED_SECTIONS) {
        if (!content.includes(section)) problems.push(`${docFile(src)}: falta "${section}"`);
      }
    }
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("catalogo-fontes.md existe e referencia todas as docs", () => {
    const catalog = readFileSync(join(FONTES_DIR, "catalogo-fontes.md"), "utf-8");
    const missing: string[] = [];
    for (const src of EXPECTED_SOURCES) {
      if (!catalog.includes(docFile(src))) missing.push(docFile(src));
    }
    expect(missing, `catálogo não referencia:\n${missing.join("\n")}`).toEqual([]);
  });

  it("catálogo documenta o fluxo ponta a ponta", () => {
    const catalog = readFileSync(join(FONTES_DIR, "catalogo-fontes.md"), "utf-8");
    for (const section of ["## 3. Como coletar", "## 4. Como receber e guardar", "## 5. Como exibir", "## 6. Como analisar"]) {
      expect(catalog.includes(section), `falta seção "${section}"`).toBe(true);
    }
  });
});
