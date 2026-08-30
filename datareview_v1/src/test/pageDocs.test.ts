/** Guarda: toda página do registry PAGES tem doc na pasta docs/pages e está
 * ligada no índice docs/README.md. Sem isso, a documentação das rotas não
 * cresce com o registry (o desvio padrão de docs/pages pode esquecer páginas). */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { PAGES } from "@/lib/pages";

const README_PATH = path.resolve(__dirname, "../../docs/README.md");

describe("documentação de páginas (docs/pages)", () => {
  it("cada PAGES.path tem doc correspondente", () => {
    const readme = fs.readFileSync(README_PATH, "utf8");
    for (const p of PAGES) {
      if (p.external) continue; // links externos não têm doc de página
      expect(readme, `falta doc no índice para rota '${p.path}'`).toContain(
        `\`${p.path}\``,
      );
    }
  });

  it("o índice linka arquivos exatamente com sufixo date-stamp", () => {
    const readme = fs.readFileSync(README_PATH, "utf8");
    const links = readme.match(/pages\/[a-z0-9-]+-\d{4}-\d{2}-\d{2}\.md/g) ?? [];
    expect(links.length).toBeGreaterThanOrEqual(PAGES.length);
    for (const link of links) {
      const full = path.resolve(__dirname, "../../docs", link);
      expect(fs.existsSync(full), `link quebrado no índice: ${link}`).toBe(true);
    }
  });
});
