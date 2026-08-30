import { describe, it, expect, beforeEach } from "vitest";
import { useGitCanvas } from "@/lib/gitCanvas/store";

describe("gitCanvas store (§27: UI separada dos providers)", () => {
  beforeEach(() => {
    localStorage.clear();
    useGitCanvas.getState().unload();
  });

  it("inicia sem mapa e sem onboarding", () => {
    const s = useGitCanvas.getState();
    expect(s.map).toBeNull();
    expect(s.onboarded).toBe(false);
    expect(s.nodes).toEqual([]);
  });

  it("loadDemo monta o grafo da visão projeto e marca demo", () => {
    useGitCanvas.getState().loadDemo();
    const s = useGitCanvas.getState();
    expect(s.onboarded).toBe(true);
    expect(s.mode).toBe("demo");
    expect(s.map?.demo).toBe(true);
    expect(s.nodes.length).toBeGreaterThan(10);
    expect(s.edges.length).toBeGreaterThan(10);
  });

  it("setView reprojeta o mesmo modelo sem recarregar dados (§34)", () => {
    useGitCanvas.getState().loadDemo();
    const total = useGitCanvas.getState().nodes.length;
    useGitCanvas.getState().setView("git");
    const s = useGitCanvas.getState();
    expect(s.nodes.length).toBeLessThan(total);
    expect(s.nodes.every((n) => ["project", "remote", "branch", "commit"].includes(n.data.kind))).toBe(true);
    expect(s.map?.branches.length).toBeGreaterThan(0); // modelo intacto
  });

  it("select guarda anti-loop: mesmo id não gera novo estado", () => {
    useGitCanvas.getState().loadDemo();
    useGitCanvas.getState().select("branch:main");
    const ref = useGitCanvas.getState();
    useGitCanvas.getState().select("branch:main");
    expect(useGitCanvas.getState()).toBe(ref);
    useGitCanvas.getState().select("commit:8a91bc42");
    expect(useGitCanvas.getState().selectedId).toBe("commit:8a91bc42");
  });

  it("persiste onboarding/demo e reidrata demo na próxima sessão", async () => {
    useGitCanvas.getState().loadDemo();
    expect(JSON.parse(localStorage.getItem("aso:git-canvas:v1")!)).toMatchObject({ onboarded: true, mode: "demo" });
    // reimporta o módulo → store reidrata do storage
    const mod = await import("@/lib/gitCanvas/store?reload=" + Date.now());
    // módulos com query são instâncias novas no vitest
    expect(mod.useGitCanvas.getState().onboarded).toBe(true);
  });

  it("unload limpa tudo e volta ao onboarding", () => {
    useGitCanvas.getState().loadDemo();
    useGitCanvas.getState().unload();
    const s = useGitCanvas.getState();
    expect(s.map).toBeNull();
    expect(s.onboarded).toBe(false);
    expect(JSON.parse(localStorage.getItem("aso:git-canvas:v1")!)).toMatchObject({ onboarded: false, mode: null });
  });
});
