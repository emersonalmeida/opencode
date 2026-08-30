import { describe, it, expect } from "vitest";
import { createTab, bootLines } from "@/lib/terminal/model";

describe("terminal model — tabs/panes", () => {
  it("createTab gera aba com 1 pane ativo", () => {
    const t = createTab(1);
    expect(t.panes).toHaveLength(1);
    expect(t.activePaneId).toBe(t.panes[0].id);
    expect(t.label).toBe("aba 1");
    expect(t.direction).toBe("h");
  });

  it("ids únicos por chamada", () => {
    const t1 = createTab(1);
    const t2 = createTab(2);
    expect(t1.id).not.toBe(t2.id);
    expect(t1.panes[0].id).not.toBe(t2.panes[0].id);
  });

  it("bootLines = banner inaugurai + instruções de atalhos", () => {
    const l = bootLines("sessão", "IA: local gemma3:12b");
    expect(l[0].text).toContain("nexterm");
    expect(l.some((x) => x.text.includes("IA: local"))).toBe(true);
    expect(l.some((x) => x.text.includes("/help"))).toBe(true);
    expect(l.length).toBeGreaterThanOrEqual(5);
  });
});
