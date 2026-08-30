import { describe, it, expect, beforeEach } from "vitest";
import {
  listGroups, createGroup, renameGroup, setGroupPaths, toggleGroupPath,
  toggleGroupCollapsed, deleteGroup, moveGroup, resetGroups, groupPages,
  backupGroup, topLevelPages, BACKUP_GROUP_ID,
  TOP_LEVEL_PATHS,
} from "@/lib/pageGroups";
import { PAGES } from "@/lib/pages";
import { setFeatureFlag } from "@/lib/featureFlags";

const KEY = "aso:page-groups:v1";

describe("pageGroups — workspaces do menu", () => {
  beforeEach(() => {
    localStorage.clear();
    resetGroups();
    // Labs são flag-off por padrão (Onda 1.1) — os testes de paridade com o
    // registry ligam as labs explicitamente para comparar com o PAGES inteiro.
    for (const k of ["page.concept", "page.playground", "page.teste", "page.01", "page.nucleo", "page.conversa"]) setFeatureFlag(k, true);
  });

  it("sempre começa com o grupo builtin único 'Backup', imutável", () => {
    const groups = listGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe(BACKUP_GROUP_ID);
    expect(groups[0].label).toBe("Backup");
    expect(groups[0].builtin).toBe(true);
    expect(renameGroup(BACKUP_GROUP_ID, "x")).toBe(false);
    expect(deleteGroup(BACKUP_GROUP_ID)).toBe(false);
    expect(setGroupPaths(BACKUP_GROUP_ID, ["/dashboard"])).toBe(false);
  });

  it("'Backup' agrupa todas as páginas EXCETO as de nível topo", () => {
    const pages = groupPages(backupGroup());
    expect(pages.map((p) => p.path)).toEqual(
      PAGES.map((p) => p.path).filter((p) => !TOP_LEVEL_PATHS.includes(p)),
    );
    expect(pages.some((p) => p.path === "/")).toBe(false);
  });

  it("páginas de nível topo ficam fora dos grupos (a página inicial UI)", () => {
    const top = topLevelPages();
    expect(top.map((p) => p.path)).toEqual(TOP_LEVEL_PATHS);

  });
it("página inicial `/` é a única de nível topo; todas as demais (Auditoria, Home) vivem no Backup", () => {
    expect(TOP_LEVEL_PATHS).toEqual(["/"]);
    const top = topLevelPages();
    expect(top.map((p) => p.path)).toEqual(["/"]);
    // Desde 2026-08-29, TODAS as páginas (incluindo Auditoria e Home) vivem no Backup.

    expect(groupPages(backupGroup()).some((p) => p.path === "/auditoria")).toBe(true);
    expect(groupPages(backupGroup()).some((p) => p.path === "/home")).toBe(true);
  });

  it("cria grupo com nome + páginas, persiste e aparece após os builtins", () => {
    const g = createGroup("Trabalho", ["/dashboard", "/chat"])!;
    expect(g).not.toBeNull();
    const groups = listGroups();
    expect(groups).toHaveLength(2);
    expect(groups[1].id).toBe(g.id);
    expect(groups[1].label).toBe("Trabalho");
    expect(JSON.parse(localStorage.getItem(KEY)!)).toHaveLength(1);
    // Páginas na ordem salva
    expect(groupPages(groups[1]).map((p) => p.path)).toEqual(["/dashboard", "/chat"]);
  });

  it("rejeita nome vazio e respeita o limite de 12 grupos", () => {
    expect(createGroup("   ")).toBeNull();
    for (let i = 0; i < 12; i++) createGroup(`g${i}`);
    expect(createGroup("décimo-terceiro")).toBeNull();
    expect(listGroups()).toHaveLength(13); // 12 custom + 1 builtin
  });

  it("dedup de páginas e poda de paths inexistentes", () => {
    const g = createGroup("Dedup", ["/chat", "/chat", "/rota-inexistente", "/dashboard"])!;
    expect(g.paths).toEqual(["/chat", "/dashboard"]);
  });

  it("renomeia e edita seleção de páginas de grupo custom", () => {
    const g = createGroup("Antes", ["/chat"])!;
    expect(renameGroup(g.id, "Depois")).toBe(true);
    expect(setGroupPaths(g.id, ["/canvas", "/atlas"])).toBe(true);
    const updated = listGroups().find((x) => x.id === g.id)!;
    expect(updated.label).toBe("Depois");
    expect(updated.paths).toEqual(["/canvas", "/atlas"]);
  });

  it("toggleGroupPath adiciona/remove página", () => {
    const g = createGroup("Toggle", [])!;
    toggleGroupPath(g.id, "/pipeline");
    expect(listGroups().find((x) => x.id === g.id)!.paths).toContain("/pipeline");
    toggleGroupPath(g.id, "/pipeline");
    expect(listGroups().find((x) => x.id === g.id)!.paths).not.toContain("/pipeline");
  });

  it("expande/recolhe grupos (custom e builtins) e persiste", () => {
    const g = createGroup("Fecha", ["/chat"])!;
    expect(listGroups().find((x) => x.id === g.id)!.collapsed).toBe(false);
    toggleGroupCollapsed(g.id);
    expect(listGroups().find((x) => x.id === g.id)!.collapsed).toBe(true);
    // builtin também recolhe (override separado). Default de instalação
    // nova: aberto — o toggle inverte o atual.
    expect(listGroups()[0].collapsed).toBe(false);
    toggleGroupCollapsed(BACKUP_GROUP_ID);
    expect(listGroups()[0].collapsed).toBe(true);
    toggleGroupCollapsed(BACKUP_GROUP_ID);
    expect(listGroups()[0].collapsed).toBe(false);
  });

  it("exclui apenas grupos custom", () => {
    const g = createGroup("Morre", [])!;
    expect(deleteGroup(g.id)).toBe(true);
    expect(listGroups().find((x) => x.id === g.id)).toBeUndefined();
    expect(deleteGroup(g.id)).toBe(false);
  });

  it("reordena grupos custom com moveGroup", () => {
    const a = createGroup("A")!;
    const b = createGroup("B")!;
    expect(moveGroup(b.id, -1)).toBe(true);
    const customs = listGroups().slice(1);
    expect(customs.map((g) => g.id)).toEqual([b.id, a.id]);
    expect(moveGroup(a.id, 1)).toBe(false); // já é o último
    expect(moveGroup(a.id, -1)).toBe(true);
  });

  it("uma página pode estar em vários grupos (vistas, não pastas exclusivas)", () => {
    createGroup("G1", ["/dashboard"]);
    createGroup("G2", ["/dashboard"]);
    const customs = listGroups().slice(1);
    expect(customs.every((g) => g.paths.includes("/dashboard"))).toBe(true);
  });

  it("storage corrompido cai no default (só builtins), sem quebrar", () => {
    localStorage.setItem(KEY, "{invalid json");
    resetGroups(); // força reload limpo
    expect(listGroups()).toHaveLength(1);
    localStorage.setItem(KEY, JSON.stringify([{ id: "all", label: "fake" }, { label: 42 }, { id: "ok", label: "OK", paths: ["/chat"] }]));
    // sanitize: descarta builtin falsificado e entrada sem label string
    resetGroups();
    expect(listGroups()).toHaveLength(1);
  });

  it("resetGroups remove customs e mantém o builtin", () => {
    createGroup("X", ["/chat"]);
    createGroup("Y", ["/dashboard"]);
    resetGroups();
    expect(listGroups()).toHaveLength(1);
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
