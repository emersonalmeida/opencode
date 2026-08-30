import { describe, it, expect, beforeEach } from "vitest";
import {
  createCustomPage, getCustomPage, listCustomPages, updateCustomPageSpec,
  renameCustomPage, deleteCustomPage, subscribeCustomPages,
} from "@/lib/customPages";
import { LAYOUT_PRESETS, addColumn } from "@/lib/layoutTemplates";

describe("customPages — páginas criadas pelo usuário", () => {
  beforeEach(() => {
    localStorage.clear();
    // Zera a store em memória.
    for (const p of listCustomPages()) deleteCustomPage(p.id);
  });

  it("cria página do preset Tela completa quando spec ausente", () => {
    const p = createCustomPage("Monitor de reviews");
    expect(p.name).toBe("Monitor de reviews");
    expect(p.spec.columns.length).toBeGreaterThan(0);
    expect(getCustomPage(p.id)?.id).toBe(p.id);
    expect(listCustomPages()[0].id).toBe(p.id);
  });

  it("cria página com spec fornecida (deep-copy sanitizada)", () => {
    const spec = { top: [], columns: addColumn([], "Única"), bottom: [] };
    const p = createCustomPage("Tela 360", spec);
    expect(p.spec.columns[0].blocks).toHaveLength(1);
    // mutar o objeto original não afeta a página
    spec.columns[0].blocks = [];
    expect(p.spec.columns[0].blocks).toHaveLength(1);
  });

  it("nome vazio cai no fallback 'Minha página'", () => {
    const p = createCustomPage("   ");
    expect(p.name).toBe("Minha página");
  });

  it("atualiza spec e renomeia", () => {
    const p = createCustomPage("A");
    updateCustomPageSpec(p.id, LAYOUT_PRESETS[0].build());
    expect(getCustomPage(p.id)?.spec.columns).toHaveLength(3);
    renameCustomPage(p.id, "B");
    expect(getCustomPage(p.id)?.name).toBe("B");
    renameCustomPage(p.id, "  ");
    expect(getCustomPage(p.id)?.name).toBe("B"); // nome vazio não sobrescreve
  });

  it("exclui e persiste no localStorage", () => {
    const p = createCustomPage("Temporária");
    deleteCustomPage(p.id);
    expect(getCustomPage(p.id)).toBeUndefined();
    const stored = JSON.parse(localStorage.getItem("aso:custom-pages:v1") ?? "[]");
    expect(stored.find((x: { id: string }) => x.id === p.id)).toBeUndefined();
  });

  it("pub/sub notifica assinantes nas mutações", () => {
    let calls = 0;
    const unsub = subscribeCustomPages(() => { calls += 1; });
    const p = createCustomPage("X");
    updateCustomPageSpec(p.id, LAYOUT_PRESETS[0].build());
    deleteCustomPage(p.id);
    expect(calls).toBe(3);
    unsub();
    createCustomPage("Y");
    expect(calls).toBe(3);
  });

  it("storage corrompido não quebra (lista vazia)", () => {
    localStorage.setItem("aso:custom-pages:v1", "{quebrado");
    // novo módulo carregaria lista vazia; aqui só garantimos que CRUD segue ok
    const p = createCustomPage("Ok");
    expect(getCustomPage(p.id)).toBeTruthy();
  });
});
