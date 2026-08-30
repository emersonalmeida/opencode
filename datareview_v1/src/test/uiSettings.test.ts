import { describe, it, expect, beforeEach } from "vitest";
import {
  getUISettings, setUISettings, resetUISettings, applyUISettings, DEFAULT_UI,
} from "@/lib/uiSettings";

describe("uiSettings — opacidade/raio/fonte/densidade/motion", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    document.documentElement.removeAttribute("style");
    resetUISettings();
  });

  it("default quando nada persistido", () => {
    expect(getUISettings()).toEqual(DEFAULT_UI);
  });

  it("set persiste e mescla parciais", () => {
    setUISettings({ panelOpacity: 70 });
    expect(getUISettings().panelOpacity).toBe(70);
    expect(getUISettings().density).toBe("normal");
    expect(JSON.parse(localStorage.getItem("aso:ui-settings:v1")!).panelOpacity).toBe(70);
  });

  it("applyUISettings seta variáveis CSS e classes", () => {
    setUISettings({ panelOpacity: 50, radiusScale: 150, fontScale: 110, density: "spacious", motion: "slow" });
    const el = document.documentElement;
    expect(el.style.getPropertyValue("--ui-panel-opacity")).toBe("0.5");
    expect(el.style.getPropertyValue("--ui-radius-scale")).toBe("1.5");
    expect(el.style.getPropertyValue("--ui-font-scale")).toBe("1.1");
    expect(el.classList.contains("density-spacious")).toBe(true);
    expect(el.classList.contains("density-compact")).toBe(false);
    expect(el.classList.contains("motion-slow")).toBe(true);
  });

  it("applyUISettings é idempotente", () => {
    applyUISettings();
    const first = document.documentElement.getAttribute("style");
    applyUISettings();
    expect(document.documentElement.getAttribute("style")).toBe(first);
  });

  it("reset volta aos defaults", () => {
    setUISettings({ panelOpacity: 20, motion: "fast" });
    resetUISettings();
    expect(getUISettings()).toEqual(DEFAULT_UI);
    expect(document.documentElement.classList.contains("motion-fast")).toBe(false);
  });

  it("localStorage corrompido → default", () => {
    localStorage.setItem("aso:ui-settings:v1", "{invalid json");
    // força reload do cache
    resetUISettings();
    expect(getUISettings().panelOpacity).toBe(100);
  });
});
