/**
 * indice-de-documentos.md — guarda de consistência: o consolidado existe, lista os docs
 * canônicos (README, AGENTS, documentacao/, inventario/, DESIGN_SYSTEM,
 * GUIA-DE-INSTALACAO) cita os números canônicos (não os "37/42/55/1035"
 * obsoletos), documenta a prática de manutenção. Roda no commit para
 * pegar desalinhamento cedo.
 */
import { readFileSync, existsSync } from "fs";
import { describe, it, expect } from "vitest";

const DOC = "docs/guias/indice-de-documentos.md";
const ROOT_DOCS = [
  "README.md",
  "AGENTS.md",
  "docs/guias/documentacao/README.md",
  "docs/guias/inventario/README.md",
  "docs/guias/design-system.md",
  "docs/guias/guia-de-instalacao.md",
  "docs/guias/relatorio-multifontes/README.md",
];
const STALE_PATTERNS = [/37 páginas/, /42 rotas/, /55 flags/, /1035 testes/, /90 arquivos/];

describe("indice-de-documentos.md consolidado", () => {
  it("existe no caminho agrupado", () => {
    expect(existsSync(DOC)).toBe(true);
  });

  const content = readFileSync(DOC, "utf8");

  it("lista todos os docs canônicos", () => {
    for (const doc of ROOT_DOCS) {
      expect(content, `falta referência a ${doc}`).toContain(doc);
    }
  });

  it("cita os números canônicos atuais (não '37/42/55/1035/90')", () => {
    expect(content).toContain("48 páginas");
    expect(content).toContain("51 rotas");
    expect(content).toContain("63 feature flags");
    expect(content).not.toMatch(STALE_PATTERNS[0]);
    expect(content).not.toMatch(STALE_PATTERNS[1]);
    expect(content).not.toMatch(STALE_PATTERNS[2]);
  });

  it("documenta a prática de manutenção (seção 4)", () => {
    expect(content).toContain("## 4. Como manter esta documentação");
  });
});