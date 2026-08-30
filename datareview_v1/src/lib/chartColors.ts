/**
 * chartColors — fonte ÚNICA das cores de gráficos do design system.
 *
 * Regras:
 *  - séries genéricas usam os tokens `--chart-1..5` do tema (editáveis pelo
 *    usuário no Design System) via `hsl(var(--chart-N))` — o gráfico reflete
 *    overrides de token automaticamente;
 *  - escala semântica de notas (1★→5★) é FIXA (vermelho→verde) — convenção
 *    universal, NÃO muda com o tema (antes era hex hardcoded em 2 lugares).
 *
 * NUNCA hardcodar hex de série em componentes — importar daqui.
 */

/** Paleta de séries genéricas — tokens do tema (--chart-1..5). */
export const CHART_SERIES: readonly string[] = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

/** Série genérica por índice (cicla a paleta). */
export function seriesColor(index: number): string {
  return CHART_SERIES[((index % CHART_SERIES.length) + CHART_SERIES.length) % CHART_SERIES.length];
}

/** Escala semântica de notas ★1 (ruim) → ★5 (bom) — fixa por convenção. */
export const RATING_SCALE: readonly string[] = [
  "hsl(0, 75%, 55%)",   // 1★ vermelho
  "hsl(25, 90%, 55%)",  // 2★ laranja
  "hsl(36, 95%, 55%)",  // 3★ âmbar
  "hsl(80, 60%, 45%)",  // 4★ lima
  "hsl(160, 70%, 45%)", // 5★ verde
];

/** Cor da nota (1–5, clampado). */
export function ratingColor(rating: number): string {
  const r = Math.min(5, Math.max(1, Math.round(rating)));
  return RATING_SCALE[r - 1];
}

/** Mapa "N★" → cor (compat com componentes que chaveiam por label). */
export const RATING_COLORS: Readonly<Record<string, string>> = {
  "1★": RATING_SCALE[0],
  "2★": RATING_SCALE[1],
  "3★": RATING_SCALE[2],
  "4★": RATING_SCALE[3],
  "5★": RATING_SCALE[4],
};
