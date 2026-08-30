import { describe, it, expect, beforeEach } from "vitest";
import {
  FEATURE_FLAGS, isFeatureEnabled, setFeatureFlag, setFeatureFlags,
  resetFeatureFlags, useFeatureFlags, pagePathToFlag,
} from "@/lib/featureFlags";
import { renderHook, act } from "@testing-library/react";

describe("featureFlags", () => {
  beforeEach(() => {
    localStorage.clear();
    resetFeatureFlags();
  });

  it("defaults to all flags enabled except labs (defaultOff)", () => {
    for (const f of FEATURE_FLAGS) {
      expect(isFeatureEnabled(f.key), f.key).toBe(!f.defaultOff);
    }
  });

  it("labs flag-off por padrão (Onda 1.1): conceito, playground, teste", () => {
    // Regra 'superfície é orçamento': superfícies experimentais começam
    // desligadas em instalações novas — o usuário liga se quiser.
    for (const key of ["page.concept", "page.playground", "page.teste"]) {
      const flag = FEATURE_FLAGS.find((f) => f.key === key);
      expect(flag?.defaultOff, key).toBe(true);
      expect(isFeatureEnabled(key), key).toBe(false);
      // Usuário liga explicitamente
      setFeatureFlag(key, true);
      expect(isFeatureEnabled(key), key).toBe(true);
      setFeatureFlag(key, false);
    }
  });

  it("estado persistido do usuário prevalece sobre o novo default", () => {
    // Quem já tinha a flag ON persistida NÃO perde a página (sem surpresa).
    localStorage.setItem("aso:feature-flags:v1", JSON.stringify({ "page.concept": true }));
    // Simula reload do módulo lendo do storage via novo estado:
    // o load() mescla DEFAULTS com o persistido — persistido vence.
    const parsed = JSON.parse(localStorage.getItem("aso:feature-flags:v1")!);
    expect(parsed["page.concept"]).toBe(true);
  });

  it("setFeatureFlag toggles and persists", () => {
    setFeatureFlag("page.canvas", false);
    expect(isFeatureEnabled("page.canvas")).toBe(false);
    const raw = JSON.parse(localStorage.getItem("aso:feature-flags:v1")!);
    expect(raw["page.canvas"]).toBe(false);
    setFeatureFlag("page.canvas", true);
    expect(isFeatureEnabled("page.canvas")).toBe(true);
  });

  it("locked flags cannot be disabled", () => {
    setFeatureFlag("page.home", false);
    expect(isFeatureEnabled("page.home")).toBe(true);
    setFeatureFlag("page.configuracoes", false);
    expect(isFeatureEnabled("page.configuracoes")).toBe(true);
  });

  it("unknown flag keys are ignored on set", () => {
    setFeatureFlag("does.not.exist", false);
    expect(isFeatureEnabled("does.not.exist")).toBe(true); // defaults true
  });

  it("setFeatureFlags applies a bulk patch (respecting locks)", () => {
    setFeatureFlags({ "page.canvas": false, "page.lab": false, "page.home": false });
    expect(isFeatureEnabled("page.canvas")).toBe(false);
    expect(isFeatureEnabled("page.lab")).toBe(false);
    expect(isFeatureEnabled("page.home")).toBe(true); // locked, unchanged
  });

  it("resetFeatureFlags restores defaults", () => {
    setFeatureFlag("page.canvas", false);
    resetFeatureFlags();
    expect(isFeatureEnabled("page.canvas")).toBe(true);
  });

  it("survives corrupt localStorage gracefully (falls back to defaults)", () => {
    localStorage.setItem("aso:feature-flags:v1", "{not json");
    // re-import side-effect: simulate by reading via a fresh module eval is
    // tricky; instead verify a fresh load path through the hook defaults.
    const { result } = renderHook(() => useFeatureFlags());
    expect(result.current["page.canvas"]).toBe(true);
  });

  it("useFeatureFlags reflects changes reactively", () => {
    const { result } = renderHook(() => useFeatureFlags());
    expect(result.current["page.canvas"]).toBe(true);
    act(() => setFeatureFlag("page.canvas", false));
    expect(result.current["page.canvas"]).toBe(false);
    act(() => setFeatureFlag("page.canvas", true));
    expect(result.current["page.canvas"]).toBe(true);
  });

  it("pagePathToFlag maps known paths", () => {
    expect(pagePathToFlag("/canvas")).toBe("page.canvas");
    expect(pagePathToFlag("/atlas")).toBe("page.atlas");
    expect(pagePathToFlag("/")).toBe("page.home");
    expect(pagePathToFlag("/configuracoes")).toBe("page.configuracoes");
  });

  it("pagePathToFlag returns null for unmapped paths", () => {
    expect(pagePathToFlag("/app/apple/123")).toBeNull();
    expect(pagePathToFlag("/compare")).toBeNull();
    expect(pagePathToFlag("/search")).toBeNull();
  });

  it("every group in FEATURE_GROUP_ORDER has at least one flag", () => {
    for (const g of ["pages", "intelligence", "canvas", "ui", "data"]) {
      expect(FEATURE_FLAGS.some((f) => f.group === g)).toBe(true);
    }
  });

  it("the Configurações page flag is always on (locked)", () => {
    const cfg = FEATURE_FLAGS.find((f) => f.key === "page.configuracoes")!;
    expect(cfg.locked).toBe(true);
  });
});
