import { describe, it, expect, beforeEach } from "vitest";
import {
  UI_COLUMNS, UI_RAIL_WIDTH, UI_CENTER_MIN, UI_OVERLAY_BREAKPOINT, UI_EXPAND_MARGIN,
  getColumnSpec, defaultShellState, clampWidth, sanitizeShellState,
  serializeShellState, parseShellState, shellMode, effectiveWidth,
  totalColumnsWidth, fitsIn, resolveAutoCollapsed, expandedCount,
  type UiShellState,
} from "@/lib/uiShell/layout";
import {
  getUiShellState, setColumnWidth, resizeColumn, setColumnCollapsed,
  toggleColumnCollapsed, resetColumn, resetShell,
} from "@/lib/uiShell/store";

const KEY = "aso:ui-shell:v1";

function expandedAll(): UiShellState {
  const s = defaultShellState();
  for (const c of UI_COLUMNS) s[c.id].collapsed = false;
  return s;
}

beforeEach(() => {
  localStorage.clear();
  resetShell();
});

describe("uiShell layout — specs e defaults", () => {
  it("4 colunas laterais: 2 esquerdas + 2 direitas, ids únicos", () => {
    expect(UI_COLUMNS).toHaveLength(4);
    expect(new Set(UI_COLUMNS.map((c) => c.id)).size).toBe(4);
    expect(UI_COLUMNS.filter((c) => c.side === "left")).toHaveLength(2);
    expect(UI_COLUMNS.filter((c) => c.side === "right")).toHaveLength(2);
  });

  it("default = layout dividido em 3 colunas (externas abertas, internas em rail)", () => {
    const s = defaultShellState();
    expect(s["left-outer"].collapsed).toBe(false);
    expect(s["right-outer"].collapsed).toBe(false);
    expect(s["left-inner"].collapsed).toBe(true);
    expect(s["right-inner"].collapsed).toBe(true);
    expect(expandedCount(s, new Set())).toBe(2); // 2 laterais + centro = 3 colunas
  });

  it("clampWidth respeita min/max do spec", () => {
    const spec = getColumnSpec("left-outer");
    expect(clampWidth(spec, 10)).toBe(spec.minWidth);
    expect(clampWidth(spec, 9999)).toBe(spec.maxWidth);
    expect(clampWidth(spec, 300)).toBe(300);
  });

  it("sanitize: storage parcial/inválido cai nos defaults sem quebrar", () => {
    const s = sanitizeShellState({ "left-outer": { width: 5000, collapsed: false }, junk: 1 });
    const spec = getColumnSpec("left-outer");
    expect(s["left-outer"].width).toBe(spec.maxWidth);
    expect(s["right-inner"].width).toBe(getColumnSpec("right-inner").defaultWidth);
    expect(sanitizeShellState(null)).toEqual(defaultShellState());
    expect(sanitizeShellState("x")).toEqual(defaultShellState());
  });

  it("serialize/parse round-trip + JSON corrompido → defaults", () => {
    const s = expandedAll();
    s["left-inner"].width = 333;
    expect(parseShellState(serializeShellState(s))).toEqual(s);
    expect(parseShellState("{quebrado")).toEqual(defaultShellState());
    expect(parseShellState(null)).toEqual(defaultShellState());
  });

  it("shellMode: abaixo do breakpoint vira overlay (mobile-first)", () => {
    expect(shellMode(UI_OVERLAY_BREAKPOINT - 1)).toBe("overlay");
    expect(shellMode(UI_OVERLAY_BREAKPOINT)).toBe("columns");
    expect(shellMode(1440)).toBe("columns");
  });
});

describe("uiShell layout — auto-collapse inteligente", () => {
  it("largura ampla → nenhuma coluna auto-fechada", () => {
    const s = expandedAll();
    expect(resolveAutoCollapsed(1920, s).size).toBe(0);
    expect(fitsIn(1920, s, new Set())).toBe(true);
  });

  it("estreito → fecha as MENOS importantes primeiro (internas, depois dir-externa, por último esq-externa)", () => {
    const s = expandedAll(); // 260+280+300+280 = 1120 + centro 320 = 1440
    // 1000: as duas INTERNAS fecham (rails 2×56); externas ficam:
    // 320 centro + 260 + 280 + 112 = 972 ≤ 1000
    let auto = resolveAutoCollapsed(1000, s);
    expect([...auto].sort()).toEqual(["left-inner", "right-inner"]);
    // 800: só a esq-externa (mais importante) fica aberta: 320+260+168 rails = 748
    auto = resolveAutoCollapsed(800, s);
    expect([...auto].sort()).toEqual(["left-inner", "right-inner", "right-outer"]);
    // 400: nem a esq-externa cabe → todas em rail
    auto = resolveAutoCollapsed(400, s);
    expect(auto.size).toBe(4);
  });

  it("colunas recolhidas pelo usuário nunca entram no conjunto auto", () => {
    const s = defaultShellState(); // internas já em rail
    const auto = resolveAutoCollapsed(500, s);
    expect(auto.has("left-inner")).toBe(false);
    expect(auto.has("right-inner")).toBe(false);
  });

  it("histerese: reabrir coluna auto-fechada exige margem extra (sem flap)", () => {
    const s = defaultShellState(); // base: centro 320 + 2 rails (112) = 432; expandidas: 260 + 280
    const edge = 432 + 260 + 280; // 972: cabe exatamente
    expect(resolveAutoCollapsed(edge, s).size).toBe(0);
    // Estreitou → dir-externa auto-fecha
    const auto = resolveAutoCollapsed(edge - 1, s);
    expect(auto.has("right-outer")).toBe(true);
    // Voltou à borda exata: COM histerese ela NÃO reabre (precisa de +UI_EXPAND_MARGIN)
    expect(resolveAutoCollapsed(edge, s, auto).has("right-outer")).toBe(true);
    expect(resolveAutoCollapsed(edge + UI_EXPAND_MARGIN, s, auto).size).toBe(0);
  });

  it("effectiveWidth: rail quando fechada (usuário ou auto), width quando aberta", () => {
    const spec = getColumnSpec("left-outer");
    const st = { width: 300, collapsed: false };
    expect(effectiveWidth(spec, st, false)).toBe(300);
    expect(effectiveWidth(spec, st, true)).toBe(UI_RAIL_WIDTH);
    expect(effectiveWidth(spec, { ...st, collapsed: true }, false)).toBe(UI_RAIL_WIDTH);
  });

  it("totalColumnsWidth soma larguras efetivas", () => {
    const s = defaultShellState();
    expect(totalColumnsWidth(s, new Set())).toBe(260 + 280 + UI_RAIL_WIDTH * 2);
  });
});

describe("uiShell store — persistência e ações", () => {
  it("setColumnWidth clampa e persiste; resizeColumn aplica delta", () => {
    setColumnWidth("left-outer", 300);
    expect(getUiShellState()["left-outer"].width).toBe(300);
    resizeColumn("left-outer", 24);
    expect(getUiShellState()["left-outer"].width).toBe(324);
    resizeColumn("left-outer", -9999);
    expect(getUiShellState()["left-outer"].width).toBe(getColumnSpec("left-outer").minWidth);
    const saved = parseShellState(localStorage.getItem(KEY));
    expect(saved["left-outer"].width).toBe(getColumnSpec("left-outer").minWidth);
  });

  it("toggle/setCollapsed persistem o recolhimento do USUÁRIO", () => {
    expect(getUiShellState()["left-outer"].collapsed).toBe(false);
    toggleColumnCollapsed("left-outer");
    expect(getUiShellState()["left-outer"].collapsed).toBe(true);
    setColumnCollapsed("left-outer", false);
    expect(getUiShellState()["left-outer"].collapsed).toBe(false);
  });

  it("resetColumn volta a largura padrão sem mexer no recolhimento", () => {
    setColumnWidth("right-inner", 480);
    setColumnCollapsed("right-inner", false);
    resetColumn("right-inner");
    const s = getUiShellState()["right-inner"];
    expect(s.width).toBe(getColumnSpec("right-inner").defaultWidth);
    expect(s.collapsed).toBe(false);
  });

  it("resetShell volta ao layout de 3 colunas e limpa o storage", () => {
    setColumnWidth("left-outer", 480);
    toggleColumnCollapsed("left-outer");
    resetShell();
    expect(getUiShellState()).toEqual(defaultShellState());
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
