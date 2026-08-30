import { describe, it, expect } from "vitest";
import {
  parseHslTriple, hslToHex, hexToHsl, hslTripleToHex, hexToHslTriple,
  parseHsla, parseAlpha, formatHsl, withAlpha, valueToCss,
  parseColor, normalizeColor, contrastRatio, contrastForeground, ensureContrast,
} from "@/lib/colorUtils";

describe("colorUtils — parseHslTriple", () => {
  it("aceita triples válidos", () => {
    expect(parseHslTriple("0 0% 100%")).toEqual({ h: 0, s: 0, l: 100 });
    expect(parseHslTriple("262 83% 58%")).toEqual({ h: 262, s: 83, l: 58 });
    expect(parseHslTriple("217.2 91.2% 59.8%")).toEqual({ h: 217.2, s: 91.2, l: 59.8 });
  });
  it("rejeita formatos inválidos", () => {
    expect(parseHslTriple("red")).toBeNull();
    expect(parseHslTriple("#fff")).toBeNull();
    expect(parseHslTriple("262 83 58")).toBeNull();
    expect(parseHslTriple("")).toBeNull();
    expect(parseHslTriple("400 50% 50%")).toBeNull();
    expect(parseHslTriple("120 120% 50%")).toBeNull();
  });
});

describe("colorUtils — hslToHex", () => {
  it("converte cores conhecidas", () => {
    expect(hslToHex(0, 0, 100)).toBe("#ffffff");
    expect(hslToHex(0, 0, 0)).toBe("#000000");
    expect(hslToHex(0, 100, 50)).toBe("#ff0000");
    expect(hslToHex(120, 100, 50)).toBe("#00ff00");
    expect(hslToHex(240, 100, 50)).toBe("#0000ff");
  });
  it("clampa saturação/luminosidade fora da faixa", () => {
    expect(hslToHex(0, 150, 50)).toBe(hslToHex(0, 100, 50));
    expect(hslToHex(0, 50, -10)).toBe(hslToHex(0, 50, 0));
  });
});

describe("colorUtils — hexToHsl", () => {
  it("converte hex de 6 dígitos", () => {
    expect(hexToHsl("#ffffff")).toEqual({ h: 0, s: 0, l: 100 });
    expect(hexToHsl("#000000")).toEqual({ h: 0, s: 0, l: 0 });
    expect(hexToHsl("#ff0000")).toEqual({ h: 0, s: 100, l: 50 });
  });
  it("aceita hex curto de 3 dígitos", () => {
    expect(hexToHsl("#f00")).toEqual({ h: 0, s: 100, l: 50 });
  });
  it("rejeita hex inválido", () => {
    expect(hexToHsl("fff")).toBeNull();
    expect(hexToHsl("#ff00")).toBeNull();
    expect(hexToHsl("red")).toBeNull();
  });
});

describe("colorUtils — round-trips", () => {
  it("triple → hex → triple preserva a cor (±1 de precisão)", () => {
    const samples = ["262 83% 58%", "0 0% 100%", "240 10% 3.9%", "45 100% 51%", "142 71% 45%"];
    for (const s of samples) {
      const hex = hslTripleToHex(s);
      const back = hexToHslTriple(hex);
      const a = parseHslTriple(s)!;
      const b = parseHslTriple(back!)!;
      expect(Math.abs(a.h - b.h)).toBeLessThanOrEqual(1);
      expect(Math.abs(a.s - b.s)).toBeLessThanOrEqual(1);
      expect(Math.abs(a.l - b.l)).toBeLessThanOrEqual(1);
    }
  });
  it("hslTripleToHex usa fallback em valor inválido", () => {
    expect(hslTripleToHex("lixo")).toBe("#808080");
    expect(hslTripleToHex("lixo", "#123456")).toBe("#123456");
  });
  it("hexToHslTriple retorna null em inválido", () => {
    expect(hexToHslTriple("nope")).toBeNull();
  });
});

describe("colorUtils — transparência (alpha)", () => {
  it("parseHsla aceita triple com e sem alpha", () => {
    expect(parseHsla("262 83% 58%")).toEqual({ h: 262, s: 83, l: 58, a: 1 });
    expect(parseHsla("262 83% 58% / 0.5")).toEqual({ h: 262, s: 83, l: 58, a: 0.5 });
    expect(parseHsla("0 0% 100% / 0.75")).toEqual({ h: 0, s: 0, l: 100, a: 0.75 });
    expect(parseHsla("262 83% 58% / 0")).toEqual({ h: 262, s: 83, l: 58, a: 0 });
  });
  it("parseHsla rejeita inválidos", () => {
    expect(parseHsla("262 83% 58% / 1.5")).toBeNull();
    expect(parseHsla("262 83% 58% / -0.2")).toBeNull();
    expect(parseHsla("red")).toBeNull();
    expect(parseHsla("")).toBeNull();
    expect(parseHsla("262 83 58")).toBeNull();
  });
  it("parseAlpha extrai porcentagem inteira", () => {
    expect(parseAlpha("262 83% 58%")).toBe(100);
    expect(parseAlpha("262 83% 58% / 0.5")).toBe(50);
    expect(parseAlpha("262 83% 58% / 0.75")).toBe(75);
    expect(parseAlpha("lixo")).toBe(100);
  });
  it("formatHsl emite com e sem alpha", () => {
    expect(formatHsl(262, 83, 58)).toBe("262 83% 58%");
    expect(formatHsl(262, 83, 58, 100)).toBe("262 83% 58%");
    expect(formatHsl(262, 83, 58, 50)).toBe("262 83% 58% / 0.5");
    expect(formatHsl(262, 83, 58, 75)).toBe("262 83% 58% / 0.75");
    expect(formatHsl(262, 83, 58, 0)).toBe("262 83% 58% / 0");
    expect(formatHsl(262, 83, 58, 150)).toBe("262 83% 58%");
  });
  it("withAlpha troca só o alpha, preservando H/S/L", () => {
    expect(withAlpha("262 83% 58%", 50)).toBe("262 83% 58% / 0.5");
    expect(withAlpha("262 83% 58% / 0.3", 80)).toBe("262 83% 58% / 0.8");
    expect(withAlpha("262 83% 58% / 0.5", 100)).toBe("262 83% 58%");
    expect(withAlpha("lixo", 50)).toBeNull();
  });
  it("valueToCss gera CSS válido", () => {
    expect(valueToCss("262 83% 58%")).toBe("hsl(262 83% 58%)");
    expect(valueToCss("262 83% 58% / 0.5")).toBe("hsl(262 83% 58% / 0.5)");
    expect(valueToCss("lixo")).toBe("transparent");
  });
});



describe("colorUtils — parseColor (universal: hsl triple / hsl() / rgb() / hex)", () => {
  it("aceita triple de token com e sem alpha", () => {
    expect(parseColor("262 83% 58%")).toMatchObject({ h: 262, s: 83, l: 58, a: 1 });
    expect(parseColor("262 83% 58% / 0.5")!.a).toBe(0.5);
  });

  it("aceita hsl()/hsla() com vírgula ou espaço", () => {
    expect(parseColor("hsl(262, 83%, 58%)")).toMatchObject({ h: 262, s: 83, l: 58 });
    expect(parseColor("hsl(262 83% 58%)")).toMatchObject({ h: 262 });
    expect(parseColor("hsla(262, 83%, 58%, 0.5)")!.a).toBe(0.5);
    expect(parseColor("hsl(262deg 83% 58% / 50%)")!.a).toBe(0.5);
  });

  it("aceita rgb()/rgba() e converte para HSL", () => {
    const c = parseColor("rgb(139, 92, 246)")!;
    expect(c.h).toBeGreaterThan(250);
    expect(c.h).toBeLessThan(265);
    expect(c.s).toBeGreaterThan(80);
    expect(c.l).toBeGreaterThan(60);
    expect(parseColor("rgba(255, 255, 255, 0.5)")!.a).toBe(0.5);
  });

  it("aceita hex (#rgb, #rrggbb, #rrggbbaa)", () => {
    expect(parseColor("#fff")).toMatchObject({ h: 0, s: 0, l: 100 });
    expect(parseColor("#000000")).toMatchObject({ l: 0 });
    const c = parseColor("#8b5cf6")!;
    expect(c.h).toBeGreaterThan(250);
    expect(parseColor("#ffffff80")!.a).toBeCloseTo(0.5, 1);
  });

  it("rejeita entradas inválidas", () => {
    expect(parseColor("")).toBeNull();
    expect(parseColor("roxo bonito")).toBeNull();
    expect(parseColor("hsl(400, 120%, 50%)")).toBeNull();
    expect(parseColor("rgb(300, 0, 0)")).toBeNull();
    expect(parseColor("#12")).toBeNull();
  });

  it("normalizeColor converte tudo para triple de token", () => {
    expect(normalizeColor("#ffffff")).toBe("0 0% 100%");
    expect(normalizeColor("hsl(262, 83%, 58%)")).toBe("262 83% 58%");
    expect(normalizeColor("rgba(255,255,255,0.5)")).toBe("0 0% 100% / 0.5");
    expect(normalizeColor("lixo")).toBeNull();
  });
});

describe("colorUtils — contraste WCAG + foreground inteligente", () => {
  it("contrastRatio: branco × preto = 21, mesma cor = 1", () => {
    const white = { h: 0, s: 0, l: 100 };
    const black = { h: 0, s: 0, l: 0 };
    expect(contrastRatio(white, black)).toBeCloseTo(21, 0);
    expect(contrastRatio(white, white)).toBeCloseTo(1, 2);
  });

  it("contrastForeground: fundo escuro → texto claro; fundo claro → texto escuro", () => {
    expect(contrastForeground("240 10% 10%")).toBe("0 0% 98%");
    expect(contrastForeground("0 0% 100%")).toBe("240 10% 3.9%");
    expect(contrastForeground("#000000")).toBe("0 0% 98%");
    expect(contrastForeground("rgb(255, 255, 255)")).toBe("240 10% 3.9%");
  });

  it("contrastForeground atinge contraste ≥ 4.5 sobre cores de ação típicas", () => {
    for (const bg of ["220 90% 56%", "262 80% 60%", "160 70% 45%", "0 75% 55%", "25 95% 55%"]) {
      const fg = parseColor(contrastForeground(bg))!;
      expect(contrastRatio(fg, parseColor(bg)!), bg).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("ensureContrast ajusta só a luminosidade até o alvo", () => {
    const bg = parseColor("0 0% 50%")!;
    const fg = parseColor("0 0% 50%")!;
    const fixed = ensureContrast(fg, bg, 4.5);
    expect(fixed.h).toBe(fg.h);
    expect(contrastRatio(fixed, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it("ensureContrast não muda quando o contraste já é suficiente", () => {
    const bg = parseColor("0 0% 100%")!;
    const fg = parseColor("240 10% 3.9%")!;
    expect(ensureContrast(fg, bg)).toMatchObject({ h: fg.h, l: fg.l });
  });
});
