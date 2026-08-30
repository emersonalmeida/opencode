import { describe, it, expect, beforeEach } from "vitest";
import {
  sanitizeLayout, moveWidget, isDefaultLayout, getLayout, setLayout,
  move, resetLayout, DEFAULT_LAYOUT, SLOT_ORDER,
} from "@/lib/layoutComposer";

beforeEach(() => {
  localStorage.clear();
  resetLayout();
});

describe("layoutComposer — sanitize", () => {
  it("default passa intacto", () => {
    expect(sanitizeLayout(DEFAULT_LAYOUT)).toEqual(DEFAULT_LAYOUT);
    expect(isDefaultLayout(sanitizeLayout(DEFAULT_LAYOUT))).toBe(true);
  });

  it("remove widgets duplicados (primeira ocorrência vence)", () => {
    const s = sanitizeLayout({
      leftExt: ["nav", "nav"],
      leftInt: [],
      rightInt: [],
      rightExt: ["ai", "nav"],
    });
    expect(s.leftExt).toEqual(["nav"]);
    expect(s.rightExt).toEqual(["ai"]);
    // os demais widgets voltam ao slot padrão (nunca somem)
    expect(s.leftInt).toContain("page-left");
    expect(s.rightInt).toContain("page-right");
  });

  it("ignores ids desconhecidos e repõe faltantes", () => {
    const s = sanitizeLayout({ leftExt: ["hacker"], leftInt: [], rightInt: [], rightExt: [] });
    expect(s.leftExt).toEqual(["nav"]);
    expect(s.rightExt).toEqual(["ai"]);
  });

  it("storage corrompido → default", () => {
    localStorage.setItem("aso:layout-composer:v1", "{nope");
    expect(isDefaultLayout(getLayout())).toBe(true);
  });
});

describe("layoutComposer — moveWidget", () => {
  it("move widget entre slots", () => {
    const next = moveWidget(DEFAULT_LAYOUT, "nav", "rightExt");
    expect(next.leftExt).toEqual([]);
    expect(next.rightExt).toEqual(["ai", "nav"]);
    expect(isDefaultLayout(next)).toBe(false);
  });

  it("reordena dentro do mesmo slot com index", () => {
    const stacked = moveWidget(DEFAULT_LAYOUT, "page-right", "rightExt");
    expect(stacked.rightExt).toEqual(["ai", "page-right"]);
    const reordered = moveWidget(stacked, "page-right", "rightExt", 0);
    expect(reordered.rightExt).toEqual(["page-right", "ai"]);
  });

  it("clamp de index", () => {
    const next = moveWidget(DEFAULT_LAYOUT, "nav", "rightExt", 99);
    expect(next.rightExt[next.rightExt.length - 1]).toBe("nav");
  });

  it("mover para o slot onde já está não duplica", () => {
    const next = moveWidget(DEFAULT_LAYOUT, "nav", "leftExt");
    expect(next.leftExt).toEqual(["nav"]);
  });
});

describe("layoutComposer — persistência", () => {
  it("setLayout persiste e getLayout lê", () => {
    const custom = moveWidget(DEFAULT_LAYOUT, "ai", "leftExt");
    setLayout(custom);
    expect(getLayout().leftExt).toEqual(["nav", "ai"]);
    const raw = JSON.parse(localStorage.getItem("aso:layout-composer:v1")!);
    expect(raw.leftExt).toEqual(["nav", "ai"]);
  });

  it("move() + resetLayout()", () => {
    move("nav", "rightInt");
    expect(getLayout().rightInt).toContain("nav");
    resetLayout();
    expect(isDefaultLayout(getLayout())).toBe(true);
  });

  it("todo slot é um array válido", () => {
    const s = getLayout();
    for (const slot of SLOT_ORDER) expect(Array.isArray(s[slot])).toBe(true);
  });
});
