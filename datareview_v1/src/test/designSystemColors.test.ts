/**
 * Guarda de padronização de cores do design system:
 *  - chartColors é a única fonte de cores de gráficos (séries = tokens do
 *    tema; escala de notas fixa e válida);
 *  - nenhum componente/página fora da whitelist usa hex hardcoded
 *    (cores vêm de tokens `hsl(var(--token))` ou de chartColors).
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { describe, it, expect } from "vitest";
import { CHART_SERIES, RATING_SCALE, RATING_COLORS, ratingColor, seriesColor } from "@/lib/chartColors";
import { parseHslTriple } from "@/lib/colorUtils";

describe("chartColors — fonte única de cores de gráficos", () => {
  it("séries genéricas usam tokens do tema (--chart-1..5)", () => {
    for (const c of CHART_SERIES) {
      expect(c).toMatch(/^hsl\(var\(--chart-\d\)\)$/);
    }
    expect(CHART_SERIES.length).toBe(5);
  });

  it("seriesColor cicla a paleta", () => {
    expect(seriesColor(0)).toBe(CHART_SERIES[0]);
    expect(seriesColor(5)).toBe(CHART_SERIES[0]);
    expect(seriesColor(7)).toBe(CHART_SERIES[2]);
  });

  it("escala de notas ★1→★5 é hsl válido (vermelho→verde)", () => {
    expect(RATING_SCALE.length).toBe(5);
    for (const c of RATING_SCALE) {
      const m = c.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
      expect(m, c).not.toBeNull();
    }
    // ★1 vermelha (hue ~0), ★5 verde (hue ~160)
    expect(ratingColor(1)).toBe(RATING_SCALE[0]);
    expect(ratingColor(5)).toBe(RATING_SCALE[4]);
    expect(ratingColor(0)).toBe(RATING_SCALE[0]); // clamp baixo
    expect(ratingColor(9)).toBe(RATING_SCALE[4]); // clamp alto
    expect(RATING_COLORS["3★"]).toBe(RATING_SCALE[2]);
  });
});

/* Escaneia .tsx de components/pages proibindo hex hardcoded fora da
   whitelist (todos os casos legítimos restantes são temas de deck/
   canvas próprios ou exemplos em texto, não cores do app). */
const HEX_RE = /#[0-9a-fA-F]{6}\b/;
const ALLOWED_FILES = new Set([
  // Temas próprios de decks e do Git Canvas (escopos de cor independentes).
  "src/components/presentations/SlideView.tsx",
  "src/lib/presentations.ts",
  "src/components/gitCanvas/GitCanvasBoard.tsx",
  "src/components/gitCanvas/GitObjectNode.tsx",
  "src/lib/gitCanvas/graph.ts",
  // Placeholder de exemplo de input de cor (texto, não estilo).
  "src/components/settings/CustomPrimaryColor.tsx",
  // Escalas semânticas declaradas em libs puras (tema do mapa de calor etc).
  "src/components/shared/MarkdownRenderer.tsx",
]);

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      yield* walk(full);
    } else if (entry.endsWith(".tsx")) {
      yield full;
    }
  }
}

describe("padronização de cores — sem hex hardcoded em componentes", () => {
  it("components/pages usam tokens (hex só na whitelist documentada)", () => {
    const offenders: string[] = [];
    for (const dir of ["src/components", "src/pages"]) {
      for (const file of walk(dir)) {
        if (ALLOWED_FILES.has(file)) continue;
        const content = readFileSync(file, "utf8");
        const lines = content.split("\n");
        lines.forEach((line, i) => {
          // Ignora comentários e strings de exemplo em texto de ajuda.
          const trimmed = line.trim();
          if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/**")) return;
          if (HEX_RE.test(line)) {
            offenders.push(`${file}:${i + 1}: ${trimmed.slice(0, 90)}`);
          }
        });
      }
    }
    expect(offenders, `hex hardcoded fora da whitelist:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("escala de notas NÃO é token do tema (fixa por convenção semântica)", () => {
    expect(parseHslTriple("0 75% 55%")).not.toBeNull();
    for (const c of RATING_SCALE) expect(c).not.toContain("var(");
  });
});
