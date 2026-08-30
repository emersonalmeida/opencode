import { describe, it, expect, beforeEach } from "vitest";
import {
  isValidTokenValue, getDesignTokens, setDesignToken, clearDesignToken,
  applyTokenPreset, applyTokenPresetBothModes, resetDesignTokens,
  countTokenOverrides, applyDesignTokens, effectiveTokenValue, setDesignTokens,
  TOKEN_PRESETS, tokenDefault,
} from "@/lib/designTokens";

beforeEach(() => {
  localStorage.clear();
  document.getElementById("design-token-overrides")?.remove();
  resetDesignTokens();
});

describe("designTokens — validação", () => {
  it("aceita HSL triple", () => {
    expect(isValidTokenValue("primary", "262 83% 58%")).toBe(true);
    expect(isValidTokenValue("background", "0 0% 100%")).toBe(true);
  });
  it("aceita HSL triple com alpha (transparência)", () => {
    expect(isValidTokenValue("primary", "262 83% 58% / 0.5")).toBe(true);
    expect(isValidTokenValue("card", "0 0% 100% / 0.75")).toBe(true);
    expect(isValidTokenValue("border", "240 5.9% 90% / 0")).toBe(true);
    expect(isValidTokenValue("primary", "262 83% 58% / 1")).toBe(true);
  });
  it("rejeita alpha fora da faixa 0–1", () => {
    expect(isValidTokenValue("primary", "262 83% 58% / 1.5")).toBe(false);
    expect(isValidTokenValue("primary", "262 83% 58% / -0.2")).toBe(false);
  });
  it("rejeita formatos inválidos", () => {
    expect(isValidTokenValue("primary", "red")).toBe(false);
    expect(isValidTokenValue("primary", "#fff")).toBe(false);
    expect(isValidTokenValue("primary", "")).toBe(false);
    expect(isValidTokenValue("primary", "262 83 58")).toBe(false);
  });
  it("raio usa rem", () => {
    expect(isValidTokenValue("radius", "0.5rem")).toBe(true);
    expect(isValidTokenValue("radius", "1rem")).toBe(true);
    expect(isValidTokenValue("radius", "10px")).toBe(false);
  });
});

describe("designTokens — overrides", () => {
  it("set/clear/count por modo", () => {
    expect(countTokenOverrides()).toBe(0);
    setDesignToken("light", "primary", "262 83% 58%");
    setDesignToken("dark", "primary", "262 83% 62%");
    expect(countTokenOverrides()).toBe(2);
    expect(getDesignTokens().light.primary).toBe("262 83% 58%");
    clearDesignToken("light", "primary");
    expect(countTokenOverrides()).toBe(1);
    expect(getDesignTokens().light.primary).toBeUndefined();
  });

  it("preset aplica tokens ao modo escolhido", () => {
    const p = TOKEN_PRESETS[0];
    applyTokenPreset(p.id, "light");
    const s = getDesignTokens();
    for (const [k, v] of Object.entries(p.tokens)) expect(s.light[k]).toBe(v);
  });

  it("reset limpa tudo", () => {
    setDesignToken("light", "primary", "262 83% 58%");
    resetDesignTokens();
    expect(countTokenOverrides()).toBe(0);
  });

  it("persiste em localStorage", () => {
    setDesignToken("light", "primary", "262 83% 58%");
    const raw = JSON.parse(localStorage.getItem("aso:design-tokens:v1")!);
    expect(raw.light.primary).toBe("262 83% 58%");
  });
});

describe("designTokens — apply (DOM)", () => {
  it("injeta <style> com overrides por modo", () => {
    setDesignToken("light", "primary", "262 83% 58%");
    setDesignToken("dark", "primary", "262 83% 62%");
    applyDesignTokens();
    const el = document.getElementById("design-token-overrides");
    expect(el).not.toBeNull();
    expect(el!.textContent).toContain(":root");
    expect(el!.textContent).toContain("--primary: 262 83% 58%");
    expect(el!.textContent).toContain(".dark");
    expect(el!.textContent).toContain("--primary: 262 83% 62%");
  });

  it("remove o <style> quando não há overrides", () => {
    setDesignToken("light", "primary", "262 83% 58%");
    applyDesignTokens();
    resetDesignTokens();
    applyDesignTokens();
    expect(document.getElementById("design-token-overrides")).toBeNull();
  });
});

describe("designTokens — valor efetivo e bulk", () => {
  it("effectiveTokenValue cai no padrão do catálogo sem override", () => {
    expect(effectiveTokenValue("light", "background")).toBe(tokenDefault("light", "background"));
    expect(effectiveTokenValue("dark", "background")).toBe(tokenDefault("dark", "background"));
  });

  it("effectiveTokenValue prefere o override do usuário", () => {
    setDesignToken("light", "primary", "262 83% 58%");
    expect(effectiveTokenValue("light", "primary")).toBe("262 83% 58%");
  });

  it("setDesignTokens aplica vários tokens de uma vez", () => {
    setDesignTokens("dark", { primary: "262 83% 68%", ring: "262 83% 68%" });
    const s = getDesignTokens();
    expect(s.dark.primary).toBe("262 83% 68%");
    expect(s.dark.ring).toBe("262 83% 68%");
    expect(countTokenOverrides()).toBe(2);
  });
});

describe("designTokens — presets nos dois modos", () => {
  it("todo preset tem darkTokens coesos", () => {
    for (const p of TOKEN_PRESETS) {
      expect(p.darkTokens, `preset ${p.id} sem darkTokens`).toBeDefined();
      expect(Object.keys(p.darkTokens!).length).toBeGreaterThan(0);
    }
  });

  it("applyTokenPreset no modo escuro usa darkTokens", () => {
    const p = TOKEN_PRESETS[0];
    applyTokenPreset(p.id, "dark");
    const s = getDesignTokens();
    for (const [k, v] of Object.entries(p.darkTokens!)) expect(s.dark[k]).toBe(v);
  });

  it("applyTokenPresetBothModes aplica claro e escuro de uma vez", () => {
    const p = TOKEN_PRESETS[1];
    applyTokenPresetBothModes(p.id);
    const s = getDesignTokens();
    for (const [k, v] of Object.entries(p.tokens)) expect(s.light[k]).toBe(v);
    for (const [k, v] of Object.entries(p.darkTokens!)) expect(s.dark[k]).toBe(v);
  });
});

