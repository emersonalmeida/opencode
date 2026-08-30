import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  TOKEN_CATALOG, TOKEN_GROUP_ORDER, TOKEN_GROUP_META, tokensByGroup,
  getTokenSpec, tokenDefault,
} from "@/lib/tokenDefaults";
import { parseHsla } from "@/lib/colorUtils";

/** Extrai `--var: valor;` de um bloco CSS. */
function parseBlock(css: string, selector: ":root" | ".dark"): Record<string, string> {
  const re = new RegExp(`${selector.replace(/[.*:]/g, (c) => `\\${c}`)}\\s*\\{([^}]*)\\}`, "m");
  const match = css.match(re);
  const out: Record<string, string> = {};
  if (!match) return out;
  for (const decl of match[1].split(";")) {
    const m = decl.match(/--([a-z0-9-]+)\s*:\s*(.+)/i);
    if (m) out[m[1].trim()] = m[2].trim();
  }
  return out;
}

const css = readFileSync(path.resolve(__dirname, "../index.css"), "utf-8");
const lightCss = parseBlock(css, ":root");
const darkCss = parseBlock(css, ".dark");

describe("tokenDefaults — cobertura do CSS real", () => {
  it("TODA variável de tema do :root está no catálogo com o mesmo valor", () => {
    for (const [cssVar, value] of Object.entries(lightCss)) {
      if (cssVar.startsWith("ui-")) continue; // vars de uiSettings, não tokens de tema
      const spec = getTokenSpec(cssVar);
      expect(spec, `--${cssVar} ausente no TOKEN_CATALOG`).toBeDefined();
      expect(spec!.light, `--${cssVar} light diverge do index.css`).toBe(value);
    }
  });

  it("TODA variável de tema do .dark está no catálogo com o mesmo valor", () => {
    for (const [cssVar, value] of Object.entries(darkCss)) {
      const spec = getTokenSpec(cssVar);
      expect(spec, `--${cssVar} (dark) ausente no TOKEN_CATALOG`).toBeDefined();
      expect(spec!.dark, `--${cssVar} dark diverge do index.css`).toBe(value);
    }
  });

  it("catálogo não tem tokens órfãos (toda entrada existe no CSS)", () => {
    for (const t of TOKEN_CATALOG) {
      expect(lightCss[t.cssVar], `--${t.cssVar} não existe no :root`).toBeDefined();
      // Vars ausentes no .dark herdam o :root — o padrão dark deve ser igual ao light.
      if (darkCss[t.cssVar] === undefined) {
        expect(t.dark, `--${t.cssVar} sem valor .dark deve ter dark === light`).toBe(t.light);
      }
    }
  });
});

describe("tokenDefaults — integridade do catálogo", () => {
  it("cssVars são únicos", () => {
    const vars = TOKEN_CATALOG.map((t) => t.cssVar);
    expect(new Set(vars).size).toBe(vars.length);
  });

  it("cores têm triples HSL(A) válidos nos dois modos (alpha opcional)", () => {
    for (const t of TOKEN_CATALOG) {
      if (t.kind !== "color") continue;
      expect(parseHsla(t.light), `${t.cssVar} light inválido`).not.toBeNull();
      expect(parseHsla(t.dark), `${t.cssVar} dark inválido`).not.toBeNull();
    }
  });

  it("tamanhos usam rem", () => {
    for (const t of TOKEN_CATALOG) {
      if (t.kind !== "size") continue;
      expect(t.light).toMatch(/^\d*\.?\d+rem$/);
      expect(t.dark).toMatch(/^\d*\.?\d+rem$/);
    }
  });

  it("todo grupo tem meta e pelo menos 1 token", () => {
    for (const g of TOKEN_GROUP_ORDER) {
      expect(TOKEN_GROUP_META[g]).toBeDefined();
      expect(tokensByGroup(g).length).toBeGreaterThan(0);
    }
  });

  it("todo token pertence a um grupo conhecido", () => {
    for (const t of TOKEN_CATALOG) {
      expect(TOKEN_GROUP_ORDER).toContain(t.group);
    }
  });

  it("tokenDefault resolve por modo", () => {
    expect(tokenDefault("light", "background")).toBe("0 0% 100%");
    expect(tokenDefault("dark", "background")).toBe("240 10% 10%");
    expect(tokenDefault("light", "inexistente")).toBeUndefined();
  });
});
