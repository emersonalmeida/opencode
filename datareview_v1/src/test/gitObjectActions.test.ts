import { describe, it, expect, vi } from "vitest";
import { actionsForNode, runBuiltinAction } from "@/lib/gitCanvas/objectActions";
import { buildCanvasGraph, type GitCanvasNode } from "@/lib/gitCanvas/graph";
import { buildDemoProjectMap } from "@/lib/gitCanvas/demoData";
import type { ProjectMap } from "@/lib/gitCanvas/types";

const demo = buildDemoProjectMap();
const graph = buildCanvasGraph(demo, "project");

function getNode(id: string): GitCanvasNode {
  const n = graph.nodes.find((x) => x.id === id);
  if (!n) throw new Error(`node ${id} ausente`);
  return n;
}

const realMap: ProjectMap = {
  ...demo,
  demo: false,
  connections: { git: "connected", agents: "connected", ci: "connected", local: "connected" },
};

describe("gitCanvas objectActions — menus contextuais (§32)", () => {
  it("branch tem as ações do spec", () => {
    const labels = actionsForNode(getNode("branch:main"), demo).map((a) => a.label);
    for (const l of ["Checkout", "Comparar", "Merge", "Rebase", "Renomear", "Excluir", "Push", "Pull"])
      expect(labels).toContain(l);
  });

  it("commit tem Inspecionar/Ver diff/Cherry-pick/Reverter/Criar branch/Copiar SHA", () => {
    const labels = actionsForNode(getNode("commit:8a91bc42"), demo).map((a) => a.label);
    for (const l of ["Ver diff", "Cherry-pick", "Reverter", "Criar branch", "Copiar SHA"])
      expect(labels).toContain(l);
  });

  it("PR tem Revisar/Aprovar/Solicitar alterações/Merge/Fechar/Copiar link", () => {
    const labels = actionsForNode(getNode("pr:42"), demo).map((a) => a.label);
    for (const l of ["Revisar", "Aprovar", "Solicitar alterações", "Merge", "Fechar", "Copiar link"])
      expect(labels).toContain(l);
  });

  it("issue conecta branch/PR/agente relacionados + abrir no GitHub", () => {
    const actions = actionsForNode(getNode("issue:16"), demo);
    const ids = actions.map((a) => a.focusNodeId ?? a.id);
    expect(ids).toContain("branch:feature/visual-git-canvas");
    expect(ids).toContain("pr:42");
    expect(ids).toContain("agent:openhands-1");
    expect(actions.some((a) => a.builtin === "open-url")).toBe(true);
  });

  it("modo demo: ações git indisponíveis com razão honesta; builtins disponíveis", () => {
    const actions = actionsForNode(getNode("branch:main"), demo);
    const checkout = actions.find((a) => a.id === "checkout")!;
    expect(checkout.available).toBe(false);
    expect(checkout.reason).toContain("Modo demo");
    const commitActions = actionsForNode(getNode("commit:8a91bc42"), demo);
    expect(commitActions.find((a) => a.id === "copy-sha")!.available).toBe(true);
  });

  it("mapa real conectado: ações git ficam disponíveis", () => {
    const checkout = actionsForNode(getNode("branch:main"), realMap).find((a) => a.id === "checkout")!;
    expect(checkout.available).toBe(true);
  });

  it("camada educacional (§46) + equivalente Git (§43) vêm do registry", () => {
    const rebase = actionsForNode(getNode("branch:main"), demo).find((a) => a.id === "rebase")!;
    expect(rebase.description).toContain("versão mais recente de main");
    expect(rebase.gitEquivalent).toBe("git rebase main");
  });
});

describe("gitCanvas objectActions — builtins executam de verdade", () => {
  it("copy-sha copia o SHA real para o clipboard", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: write } });
    const node = getNode("commit:8a91bc42");
    const action = actionsForNode(node, demo).find((a) => a.builtin === "copy-sha")!;
    expect(runBuiltinAction(action, node, () => {})).toBe(true);
    expect(write).toHaveBeenCalledWith("8a91bc42");
  });

  it("copy-link copia a URL do PR", () => {
    const write = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: write } });
    const node = getNode("pr:42");
    const action = actionsForNode(node, demo).find((a) => a.builtin === "copy-link")!;
    expect(runBuiltinAction(action, node, () => {})).toBe(true);
    expect(write).toHaveBeenCalledWith("https://github.com/emersonalmeida/appdatareview/pull/42");
  });

  it("focus chama o callback com o node alvo", () => {
    const focus = vi.fn();
    const node = getNode("issue:16");
    const action = actionsForNode(node, demo).find((a) => a.focusNodeId === "pr:42")!;
    runBuiltinAction(action, node, focus);
    expect(focus).toHaveBeenCalledWith("pr:42");
  });

  it("open-url abre janela noopener", () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);
    const node = getNode("issue:16");
    const action = actionsForNode(node, demo).find((a) => a.builtin === "open-url")!;
    expect(runBuiltinAction(action, node, () => {})).toBe(true);
    expect(open).toHaveBeenCalledWith(expect.stringContaining("github.com"), "_blank", "noopener,noreferrer");
    vi.unstubAllGlobals();
  });
});
