// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  SIDEBARS, clampSidebarWidth, getSidebarWidth, setSidebarWidth,
  resetSidebarWidth, activePreset, sidebarMax, COLUMN_SIZE_EVENT,
} from "@/lib/sidebarSizing";

beforeEach(() => localStorage.clear());

describe("sidebarSizing — padronização de larguras", () => {
  it("defaults padronizados: esquerda 280, direita 400, min 220/320, rail 56", () => {
    expect(SIDEBARS.left.defaultWidth).toBe(280);
    expect(SIDEBARS.right.defaultWidth).toBe(400);
    expect(SIDEBARS.left.minWidth).toBe(220);
    expect(SIDEBARS.right.minWidth).toBe(320);
    expect(SIDEBARS.left.railWidth).toBe(56);
    expect(SIDEBARS.right.railWidth).toBe(56);
  });

  it("max = 25% do viewport (nunca abaixo do min)", () => {
    expect(sidebarMax("left", 2000)).toBe(500);
    expect(sidebarMax("right", 2000)).toBe(500);
    expect(sidebarMax("left", 600)).toBe(220); // 25% = 150 < min
    expect(sidebarMax("right", 600)).toBe(320);
  });

  it("clamp respeita min e max", () => {
    expect(clampSidebarWidth("left", 100, 2000)).toBe(220);
    expect(clampSidebarWidth("left", 9999, 2000)).toBe(500);
    expect(clampSidebarWidth("left", 300, 2000)).toBe(300);
  });

  it("getSidebarWidth cai no default sem storage e clampeia valor salvo", () => {
    expect(getSidebarWidth("left", 2000)).toBe(280);
    localStorage.setItem(SIDEBARS.left.storageKey, "9999");
    expect(getSidebarWidth("left", 2000)).toBe(500);
    localStorage.setItem(SIDEBARS.left.storageKey, "abc");
    expect(getSidebarWidth("left", 2000)).toBe(280);
  });

  it("setSidebarWidth persiste clampeado e dispara evento", () => {
    let fired = 0;
    const on = () => fired++;
    window.addEventListener(COLUMN_SIZE_EVENT, on);
    const applied = setSidebarWidth("right", 2000, 1600); // max = 400
    window.removeEventListener(COLUMN_SIZE_EVENT, on);
    expect(applied).toBe(400);
    expect(localStorage.getItem(SIDEBARS.right.storageKey)).toBe("400");
    expect(fired).toBe(1);
    expect(getSidebarWidth("right", 1600)).toBe(400);
  });

  it("resetSidebarWidth volta ao default", () => {
    setSidebarWidth("left", 240, 2000);
    expect(getSidebarWidth("left", 2000)).toBe(240);
    resetSidebarWidth("left", 2000);
    expect(getSidebarWidth("left", 2000)).toBe(280);
  });

  it("activePreset identifica Estreita/Padrão/Larga ou null", () => {
    expect(activePreset("left", 220)).toBe("narrow");
    expect(activePreset("left", 280)).toBe("default");
    expect(activePreset("left", 440)).toBe("wide");
    expect(activePreset("left", 300)).toBeNull();
    expect(activePreset("right", 320)).toBe("narrow");
    expect(activePreset("right", 400)).toBe("default");
    expect(activePreset("right", 560)).toBe("wide");
  });
});
