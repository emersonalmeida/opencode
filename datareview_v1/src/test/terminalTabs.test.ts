import { describe, it, expect, beforeEach } from "vitest";
import {
  allTerminalTabs, createTerminalTab, deleteTerminalTab,
  filterLogEvents, logToText, BUILTIN_TERMINAL_TABS,
} from "@/lib/terminalTabs";

describe("terminal vivo — abas", () => {
  beforeEach(() => {
    localStorage.clear();
    // Limpa o estado em memória do módulo (abas custom de testes anteriores).
    for (const t of allTerminalTabs()) if (!t.builtin) deleteTerminalTab(t.id);
  });

  it("builtin tabs: log, monitor, tasks e ia sempre presentes", () => {
    const ids = allTerminalTabs().map((t) => t.id);
    for (const b of ["log", "monitor", "tasks", "ai"]) expect(ids).toContain(b);
    expect(allTerminalTabs().every((t) => t.builtin)).toBe(true);
    expect(BUILTIN_TERMINAL_TABS.length).toBe(4);
  });

  it("cria aba custom com filtro, persiste e lista após builtins", () => {
    const tab = createTerminalTab("Coletas", "coleta");
    expect(tab).not.toBeNull();
    const all = allTerminalTabs();
    expect(all[all.length - 1].id).toBe(tab!.id);
    expect(all[all.length - 1].filter).toBe("coleta");
    expect(JSON.parse(localStorage.getItem("aso:terminal-tabs:v1")!)).toHaveLength(1);
  });

  it("rejeita aba sem nome e respeita o limite de 8 custom", () => {
    expect(createTerminalTab("   ")).toBeNull();
    for (let i = 0; i < 8; i++) createTerminalTab(`aba ${i}`);
    expect(createTerminalTab("nono")).toBeNull();
  });

  it("deleta apenas abas custom", () => {
    const tab = createTerminalTab("Erros", "error")!;
    expect(deleteTerminalTab(tab.id)).toBe(true);
    expect(allTerminalTabs().find((t) => t.id === tab.id)).toBeUndefined();
    expect(deleteTerminalTab("log")).toBe(false); // builtin intocável
  });

  it("filterLogEvents filtra por mensagem, origem e detalhe (case-insensitive)", () => {
    const events = [
      { message: "Coleta concluída: Nubank", source: "coleta" },
      { message: "Análise gerada", source: "ia", detail: "seção summary" },
      { message: "Erro na coleta", source: "coleta", detail: "timeout" },
    ];
    expect(filterLogEvents(events, undefined)).toHaveLength(3);
    expect(filterLogEvents(events, "COLETA")).toHaveLength(2);
    expect(filterLogEvents(events, "ia")).toHaveLength(1);
    expect(filterLogEvents(events, "timeout")).toHaveLength(1);
    expect(filterLogEvents(events, "inexistente")).toHaveLength(0);
  });

  it("logToText serializa eventos com timestamp, origem e fase", () => {
    const text = logToText([
      { ts: 0, source: "coleta", phase: "done", message: "ok", detail: "100 reviews" },
    ]);
    expect(text).toContain("[coleta] [done] ok");
    expect(text).toContain("100 reviews");
  });
});
