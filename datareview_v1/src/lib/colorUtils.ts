/**
 * Utilitários de cor puros — conversão HSL (triple "H S% L%", formato dos
 * tokens CSS do sistema) ↔ HEX (#rrggbb), usados pelo editor visual de
 * design tokens (color picker nativo + input HSL).
 *
 * TRANSPARÊNCIA (alpha): tokens de cor aceitam um 4º componente opcional —
 * "H S% L% / A" (alpha 0–1). Internamente guardamos a porcentagem 0–100;
 * `formatHsl()` emite o triple alpha-aware que vai para a variável CSS
 * (`hsl(var(--cor) / <alpha>)` no shorthand Tailwind).
 */

export interface Hsla { h: number; s: number; l: number; a?: number }

/** Parse "H S% L%" → {h,s,l} (0-360, 0-100, 0-100) ou null se inválido. */
export function parseHslTriple(value: string): { h: number; s: number; l: number } | null {
  const m = value.trim().match(/^(\d{1,3}(?:\.\d+)?)\s+(\d{1,3}(?:\.\d+)?)%\s+(\d{1,3}(?:\.\d+)?)%$/);
  if (!m) return null;
  const h = Number(m[1]);
  const s = Number(m[2]);
  const l = Number(m[3]);
  if (h > 360 || s > 100 || l > 100) return null;
  return { h, s, l };
}

/** Parse "H S% L% / A" (A = alpha 0–1) → {h,s,l,a} ou null. Triple sem alpha → a=1. */
export function parseHsla(value: string): { h: number; s: number; l: number; a: number } | null {
  const m = value.trim().match(/^(\d{1,3}(?:\.\d+)?)\s+(\d{1,3}(?:\.\d+)?)%\s+(\d{1,3}(?:\.\d+)?)%(?:\s+\/\s+(\d*\.?\d+))?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const s = Number(m[2]);
  const l = Number(m[3]);
  if (h > 360 || s > 100 || l > 100) return null;
  let a = 1;
  if (m[4] !== undefined) {
    a = Number(m[4]);
    if (a < 0 || a > 1) return null;
  }
  return { h, s, l, a };
}

/** Extrai o alpha (0–100, inteiro) de um valor possivelmente com alpha. 100 se opaco. */
export function parseAlpha(value: string): number {
  const p = parseHsla(value);
  return p ? Math.round(p.a * 100) : 100;
}

/** Formata {h,s,l,a} → "H S% L%" (opaco) ou "H S% L% / A" (com alpha). */
export function formatHsl(h: number, s: number, l: number, alpha = 100): string {
  const base = `${round1(h)} ${round1(s)}% ${round1(l)}%`;
  const a = Math.min(100, Math.max(0, Math.round(alpha)));
  return a >= 100 ? base : `${base} / ${(a / 100).toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}`;
}

/** Troca apenas o alpha de um valor "H S% L%[/ A]", preservando H/S/L. Inválido → null. */
export function withAlpha(value: string, alphaPercent: number): string | null {
  const p = parseHsla(value);
  if (!p) return null;
  return formatHsl(p.h, p.s, p.l, alphaPercent);
}

/** HSL (0-360, 0-100, 0-100) → HEX "#rrggbb". */
export function hslToHex(h: number, s: number, l: number): string {
  const sn = Math.min(100, Math.max(0, s)) / 100;
  const ln = Math.min(100, Math.max(0, l)) / 100;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = ln - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** HEX "#rgb" | "#rrggbb" → {h,s,l} ou null se inválido. */
export function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const m = hex.trim().match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!m) return null;
  let r: number, g: number, b: number;
  if (m[1].length === 3) {
    r = parseInt(m[1][0] + m[1][0], 16);
    g = parseInt(m[1][1] + m[1][1], 16);
    b = parseInt(m[1][2] + m[1][2], 16);
  } else {
    r = parseInt(m[1].slice(0, 2), 16);
    g = parseInt(m[1].slice(2, 4), 16);
    b = parseInt(m[1].slice(4, 6), 16);
  }
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case rn: h = 60 * (((gn - bn) / d) % 6); break;
      case gn: h = 60 * ((bn - rn) / d + 2); break;
      default: h = 60 * ((rn - gn) / d + 4); break;
    }
    if (h < 0) h += 360;
  }
  return {
    h: Math.round(h * 10) / 10,
    s: Math.round(s * 1000) / 10,
    l: Math.round(l * 1000) / 10,
  };
}

/** Triple "H S% L%" → HEX (para o <input type="color">). Fallback cinza. */
export function hslTripleToHex(value: string, fallback = "#808080"): string {
  const parsed = parseHslTriple(value);
  if (!parsed) return fallback;
  return hslToHex(parsed.h, parsed.s, parsed.l);
}

/** HEX → triple "H S% L%" (formato dos tokens). Null se inválido. */
export function hexToHslTriple(hex: string): string | null {
  const parsed = hexToHsl(hex);
  if (!parsed) return null;
  return `${round1(parsed.h)} ${round1(parsed.s)}% ${round1(parsed.l)}%`;
}

function round1(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/** Valor de token "H S% L%[/ A]" → CSS `hsl(...)` (para preview/swatch). */
export function valueToCss(value: string): string {
  if (parseHsla(value)) {
    const p = parseHsla(value)!;
    const alpha = parseAlpha(value);
    return alpha >= 100 ? `hsl(${p.h} ${p.s}% ${p.l}%)` : `hsl(${p.h} ${p.s}% ${p.l}% / ${alpha / 100})`;
  }
  return "transparent";
}

/* ------------------------------------------------------------------ */
/* Parse universal: aceita hsl triple, hex, rgb()/rgba(), hsl()/hsla() */
/* ------------------------------------------------------------------ */

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case rn: h = 60 * (((gn - bn) / d) % 6); break;
      case gn: h = 60 * ((bn - rn) / d + 2); break;
      default: h = 60 * ((rn - gn) / d + 4); break;
    }
    if (h < 0) h += 360;
  }
  return {
    h: Math.round(h * 10) / 10,
    s: Math.round(s * 1000) / 10,
    l: Math.round(l * 1000) / 10,
  };
}

/**
 * Parse de cor em QUALQUER formato aceito pelo sistema:
 *  - triple de token: "H S% L%" ou "H S% L% / A"
 *  - funções CSS: "hsl(H S% L%)" / "hsl(H, S%, L%)" / "hsla(...)"
 *  - "rgb(r, g, b)" / "rgba(r, g, b, a)"
 *  - hex: "#rgb" | "#rrggbb" | "#rrggbbaa"
 * Retorna {h,s,l,a} (a 0–1) ou null se inválido.
 */
export function parseColor(input: string): Hsla & { a: number } | null {
  const v = input.trim();
  if (!v) return null;
  // Triple de token ("H S% L% [/ A]")
  const triple = parseHsla(v);
  if (triple) return triple;
  // hsl()/hsla() — separadores por espaço ou vírgula
  let m = v.match(/^hsla?\(\s*(\d{1,3}(?:\.\d+)?)(?:deg)?[\s,]+(\d{1,3}(?:\.\d+)?)%[\s,]+(\d{1,3}(?:\.\d+)?)%\s*(?:[,/]\s*(\d*\.?\d+)%?\s*)?\)$/i);
  if (m) {
    const h = Number(m[1]), s = Number(m[2]), l = Number(m[3]);
    if (h > 360 || s > 100 || l > 100) return null;
    let a = 1;
    if (m[4] !== undefined) {
      a = Number(m[4]);
      if (a > 1 && a <= 100) a = a / 100;
      if (a < 0 || a > 1) return null;
    }
    return { h, s, l, a };
  }
  // rgb()/rgba()
  m = v.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(\d*\.?\d+)%?\s*)?\)$/i);
  if (m) {
    const r = Number(m[1]), g = Number(m[2]), b = Number(m[3]);
    if (r > 255 || g > 255 || b > 255) return null;
    let a = 1;
    if (m[4] !== undefined) {
      a = Number(m[4]);
      if (a > 1 && a <= 100) a = a / 100;
      if (a < 0 || a > 1) return null;
    }
    return { ...rgbToHsl(r, g, b), a };
  }
  // Hex (#rgb, #rrggbb, #rrggbbaa)
  const hex = v.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
  if (hex) {
    const h8 = hex[1];
    let r: number, g: number, b: number, a = 1;
    if (h8.length === 3) {
      r = parseInt(h8[0] + h8[0], 16); g = parseInt(h8[1] + h8[1], 16); b = parseInt(h8[2] + h8[2], 16);
    } else {
      r = parseInt(h8.slice(0, 2), 16); g = parseInt(h8.slice(2, 4), 16); b = parseInt(h8.slice(4, 6), 16);
      if (h8.length === 8) a = Math.round((parseInt(h8.slice(6, 8), 16) / 255) * 100) / 100;
    }
    return { ...rgbToHsl(r, g, b), a };
  }
  return null;
}

/** Normaliza QUALQUER cor aceita para o triple de token "H S% L%[/ A]". Null se inválida. */
export function normalizeColor(input: string): string | null {
  const p = parseColor(input);
  if (!p) return null;
  return formatHsl(p.h, p.s, p.l, Math.round(p.a * 100));
}

/* ------------------------------------------------------------------ */
/* Contraste WCAG + foreground inteligente                             */
/* ------------------------------------------------------------------ */

function channelLuminance(c: number): number {
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Luminância relativa WCAG (0–1) de uma cor HSL. */
export function relativeLuminance(h: number, s: number, l: number): number {
  const hex = hslToHex(h, s, l);
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

/** Razão de contraste WCAG (1–21) entre duas cores HSL. */
export function contrastRatio(a: { h: number; s: number; l: number }, b: { h: number; s: number; l: number }): number {
  const la = relativeLuminance(a.h, a.s, a.l);
  const lb = relativeLuminance(b.h, b.s, b.l);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** Candidatos fixos de foreground (claro/escuro do sistema). */
export const FOREGROUND_LIGHT: Hsla = { h: 0, s: 0, l: 98 };
export const FOREGROUND_DARK: Hsla = { h: 240, s: 10, l: 3.9 };

/**
 * Foreground inteligente: dado um fundo (qualquer formato aceito), retorna o
 * triple de token de texto com MELHOR contraste (claro ou escuro). Se nenhum
 * atinge o alvo (4.5 por padrão), devolve o melhor mesmo assim.
 */
export function contrastForeground(background: string, target = 4.5): string {
  const bg = parseColor(background) ?? { h: 0, s: 0, l: 100, a: 1 };
  const candidates = [FOREGROUND_LIGHT, FOREGROUND_DARK];
  let best = candidates[0];
  let bestRatio = 0;
  for (const c of candidates) {
    const r = contrastRatio(c, bg);
    if (r > bestRatio) { bestRatio = r; best = c; }
  }
  // Se o melhor não atinge o alvo, escurece/clareia o fundo NÃO é opção aqui —
  // ajustamos o próprio foreground na direção vencedora até atingir o alvo.
  if (bestRatio < target) {
    const dir = best === FOREGROUND_LIGHT ? 1 : -1;
    let l = best.l;
    let guard = 0;
    while (guard < 60) {
      l = Math.min(100, Math.max(0, l + dir * 2));
      const r = contrastRatio({ ...best, l }, bg);
      if (r >= target) { best = { ...best, l }; bestRatio = r; break; }
      if (l === 0 || l === 100) { best = { ...best, l }; break; }
      guard += 1;
    }
  }
  return `${round1(best.h)} ${round1(best.s)}% ${round1(best.l)}%`;
}

/**
 * Garante contraste mínimo entre foreground e background ajustando SOMENTE a
 * luminosidade do foreground (preserva hue/saturação do texto). Usado para
 * pares customizados (ex.: cor principal definida pelo usuário).
 */
export function ensureContrast(fg: Hsla, bg: Hsla, target = 4.5): Hsla {
  const start = { h: fg.h, s: fg.s, l: fg.l };
  if (contrastRatio(start, bg) >= target) return start;
  // Escolhe a direção com mais "espaço" para ganhar contraste.
  const darker = { ...start, l: Math.max(0, start.l - 4) };
  const lighter = { ...start, l: Math.min(100, start.l + 4) };
  const dir = contrastRatio(lighter, bg) >= contrastRatio(darker, bg) ? 1 : -1;
  let l = start.l;
  let guard = 0;
  while (guard < 60) {
    l = Math.min(100, Math.max(0, l + dir * 2));
    const r = contrastRatio({ ...start, l }, bg);
    if (r >= target) return { ...start, l };
    if (l === 0 || l === 100) return { ...start, l };
    guard += 1;
  }
  return { ...start, l };
}
