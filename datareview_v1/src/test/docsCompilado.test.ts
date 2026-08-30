/**
 * Guarda do compilado — `docs/COMPILADO.md` é gerado por
 * `scripts/build-docs-compilado.mjs` (`npm run docs:compilado`) a partir de
 * TODOS os .md de docs/ (exceto notebooks históricos brutos). Este teste
 * regenera o compilado em memória e compara com o arquivo em disco: se
 * alguém editou/criou/removeu um doc sem regenerar, o CI falha.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
// (script .mjs sem tipos — import intencional cross-package)
import { buildCompilado } from "../../scripts/build-docs-compilado.mjs";

describe("docs/COMPILADO.md", () => {
  it("está sincronizado com os documentos individuais", () => {
    const onDisk = readFileSync("docs/COMPILADO.md", "utf8");
    const regenerated = buildCompilado();
    expect(
      onDisk,
      "docs/COMPILADO.md desatualizado — rode `npm run docs:compilado` e commite o resultado",
    ).toBe(regenerated);
  });

  it("contém as seções estruturais (índice, capa, documentos)", () => {
    const onDisk = readFileSync("docs/COMPILADO.md", "utf8");
    expect(onDisk).toContain("# Índice dos documentos");
    expect(onDisk).toContain("# Capa (docs/README.md)");
    expect(onDisk).toContain("# Documentos");
  });

  it("não inclui os notebooks históricos brutos", () => {
    const onDisk = readFileSync("docs/COMPILADO.md", "utf8");
    expect(onDisk).not.toMatch(/## 📄 `fontes\/notebooks\//);
  });
});
