import { describe, it, expect, beforeEach } from "vitest";
import {
  getAIOutputSettings, setAIOutputSettings, resetAIOutputSettings,
  getCardScaleOverride, setCardScaleOverride, effectiveScale,
  clampScale, generationStats, formatDuration,
  DEFAULT_AI_OUTPUT, SCALE_MIN, SCALE_MAX,
} from "@/lib/aiOutputSettings";

beforeEach(() => {
  localStorage.clear();
  resetAIOutputSettings();
});

describe("aiOutputSettings — store global", () => {
  it("default: escala 125% + barra de status ligada", () => {
    const s = getAIOutputSettings();
    expect(s.fontScale).toBe(125);
    expect(s.showStatusBar).toBe(true);
  });

  it("persiste escala customizada", () => {
    setAIOutputSettings({ fontScale: 150 });
    expect(getAIOutputSettings().fontScale).toBe(150);
    expect(localStorage.getItem("aso:ai-output-settings:v1")).toContain("150");
  });

  it("persiste toggle da barra de status", () => {
    setAIOutputSettings({ showStatusBar: false });
    expect(getAIOutputSettings().showStatusBar).toBe(false);
  });

  it("clampa fora dos limites", () => {
    setAIOutputSettings({ fontScale: 999 });
    expect(getAIOutputSettings().fontScale).toBe(SCALE_MAX);
    setAIOutputSettings({ fontScale: 1 });
    expect(getAIOutputSettings().fontScale).toBe(SCALE_MIN);
  });

  it("reset volta ao default e limpa o storage", () => {
    setAIOutputSettings({ fontScale: 200, showStatusBar: false });
    resetAIOutputSettings();
    expect(getAIOutputSettings()).toEqual(DEFAULT_AI_OUTPUT);
    expect(localStorage.getItem("aso:ai-output-settings:v1")).toBeNull();
  });

  it("storage corrompido cai no default", () => {
    localStorage.setItem("aso:ai-output-settings:v1", "{quebrado");
    // força re-leitura
    resetAIOutputSettings();
    localStorage.setItem("aso:ai-output-settings:v1", "{quebrado");
    const s = getAIOutputSettings();
    expect(s.fontScale).toBe(125);
  });
});

describe("clampScale", () => {
  it("respeita min/max e arredonda", () => {
    expect(clampScale(50)).toBe(SCALE_MIN);
    expect(clampScale(500)).toBe(SCALE_MAX);
    expect(clampScale(137.6)).toBe(138);
    expect(clampScale(Number.NaN)).toBe(125);
  });
});

describe("override por card", () => {
  it("sem override retorna null", () => {
    expect(getCardScaleOverride("chat:summary")).toBeNull();
  });

  it("set/get/clear do override", () => {
    setCardScaleOverride("chat:summary", 175);
    expect(getCardScaleOverride("chat:summary")).toBe(175);
    setCardScaleOverride("chat:summary", null);
    expect(getCardScaleOverride("chat:summary")).toBeNull();
  });

  it("override é clampado", () => {
    setCardScaleOverride("x", 9999);
    expect(getCardScaleOverride("x")).toBe(SCALE_MAX);
  });

  it("effectiveScale: override vence o global; sem override usa o global", () => {
    setAIOutputSettings({ fontScale: 150 });
    expect(effectiveScale("card-a")).toBe(150);
    setCardScaleOverride("card-a", 100);
    expect(effectiveScale("card-a")).toBe(100);
    expect(effectiveScale("card-b")).toBe(150);
    expect(effectiveScale()).toBe(150);
  });
});

describe("generationStats", () => {
  it("calcula palavras, chars, tokens estimados e velocidade", () => {
    const text = "palavra ".repeat(200); // 200 palavras
    const s = generationStats(text, 10);
    expect(s.words).toBe(200);
    expect(s.chars).toBe(text.length);
    expect(s.tokensEst).toBe(Math.round(text.length / 4));
    expect(s.tokensPerSec).toBe(Math.round(s.tokensEst / 10));
    expect(s.readingMin).toBe(1);
  });

  it("sem duração: velocidade 0, sem divisão por zero", () => {
    const s = generationStats("texto curto", 0);
    expect(s.tokensPerSec).toBe(0);
    expect(s.seconds).toBe(0);
  });

  it("tempo de leitura escala com o volume (~200 palavras/min)", () => {
    const s = generationStats("w ".repeat(800), 0);
    expect(s.readingMin).toBe(4);
  });
});

describe("formatDuration", () => {
  it("formata ms, segundos e minutos", () => {
    expect(formatDuration(0.4)).toBe("400ms");
    expect(formatDuration(4.2)).toBe("4.2s");
    expect(formatDuration(8)).toBe("8s");
    expect(formatDuration(75)).toBe("1min 15s");
  });
});
