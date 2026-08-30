import { describe, it, expect } from "vitest";
import {
  COMMAND_GROUPS, GIT_COMMANDS, VIEW_SHORTCUTS, filterCommands, resolveCommand,
} from "@/lib/gitCanvas/commands";
import { GIT_CANVAS_VIEWS, type ProjectMap } from "@/lib/gitCanvas/types";
import { buildDemoProjectMap } from "@/lib/gitCanvas/demoData";

const realMap: ProjectMap = {
  ...buildDemoProjectMap(),
  demo: false,
  connections: { git: "connected", agents: "connected", ci: "connected", local: "connected" },
};

describe("gitCanvas commands — cobertura do spec §5", () => {
  it("todos os 6 grupos têm comandos", () => {
    for (const g of COMMAND_GROUPS)
      expect(GIT_COMMANDS.some((c) => c.group === g.id), `grupo ${g.id}`).toBe(true);
  });

  it("ações Git/GitHub declaram needs e equivalente/explicação quando faz sentido", () => {
    const pull = GIT_COMMANDS.find((c) => c.id === "git.pull")!;
    expect(pull.needs).toEqual(["local", "git"]);
    expect(pull.gitEquivalent).toContain("git pull");
    expect(pull.description).toBeTruthy();
    const createPr = GIT_COMMANDS.find((c) => c.id === "gh.pr.create")!;
    expect(createPr.needs).toEqual(["git"]);
  });

  it("ids únicos", () => {
    const ids = GIT_COMMANDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("gitCanvas commands — disponibilidade honesta (§51)", () => {
  it("sem projeto aberto: tudo indisponível", () => {
    const r = resolveCommand(GIT_COMMANDS.find((c) => c.id === "git.pull")!, null);
    expect(r.available).toBe(false);
    expect(r.reason).toContain("Nenhum projeto aberto");
  });

  it("modo demo: ações reais NUNCA executam (sem efeito real)", () => {
    const demo = buildDemoProjectMap();
    const r = resolveCommand(GIT_COMMANDS.find((c) => c.id === "git.push")!, demo);
    expect(r.available).toBe(false);
    expect(r.reason).toContain("Modo demo");
  });

  it("modo demo: ações de UI (visão/foco) continuam disponíveis", () => {
    const demo = buildDemoProjectMap();
    const r = resolveCommand(GIT_COMMANDS.find((c) => c.id === "proj.history")!, demo);
    expect(r.available).toBe(true);
  });

  it("mapa real sem ponte local: pull explica exatamente o que falta", () => {
    const m: ProjectMap = { ...realMap, connections: { ...realMap.connections, local: "disconnected" } };
    const r = resolveCommand(GIT_COMMANDS.find((c) => c.id === "local.pull")!, m);
    expect(r.available).toBe(false);
    expect(r.reason).toContain("ponte local");
  });

  it("mapa real sem agentes: iniciar agente diz que OpenHands não está conectado", () => {
    const m: ProjectMap = { ...realMap, connections: { ...realMap.connections, agents: "disconnected" } };
    const r = resolveCommand(GIT_COMMANDS.find((c) => c.id === "agent.start")!, m);
    expect(r.available).toBe(false);
    expect(r.reason).toContain("OpenHands");
  });

  it("mapa real totalmente conectado: ações ficam disponíveis", () => {
    const r = resolveCommand(GIT_COMMANDS.find((c) => c.id === "git.rebase")!, realMap);
    expect(r.available).toBe(true);
  });

  it("comandos planejados dizem 'Disponível em breve'", () => {
    const r = resolveCommand(GIT_COMMANDS.find((c) => c.id === "proj.deps")!, realMap);
    expect(r.available).toBe(false);
    expect(r.reason).toBe("Disponível em breve.");
  });
});

describe("gitCanvas commands — busca e atalhos", () => {
  it("filtro normaliza acentos e separadores", () => {
    expect(filterCommands(GIT_COMMANDS, "rebase").some((c) => c.id === "git.rebase")).toBe(true);
    expect(filterCommands(GIT_COMMANDS, "criar branch").some((c) => c.id === "git.branch.create")).toBe(true);
    expect(filterCommands(GIT_COMMANDS, "arquitetura").some((c) => c.id === "proj.files")).toBe(true);
    expect(filterCommands(GIT_COMMANDS, "git pull").length).toBeGreaterThan(0);
  });

  it("query vazia retorna o registry completo", () => {
    expect(filterCommands(GIT_COMMANDS, "")).toHaveLength(GIT_COMMANDS.length);
  });

  it("atalhos de visão apontam para visões válidas", () => {
    const views = GIT_CANVAS_VIEWS.map((v) => v.id);
    for (const v of Object.values(VIEW_SHORTCUTS)) expect(views).toContain(v);
    expect(Object.keys(VIEW_SHORTCUTS)).toContain("g"); // G = Git view (§33)
    expect(VIEW_SHORTCUTS.h).toBe("timeline"); // H = histórico (linha do tempo)
  });

  it("palette tem comando para a visão Timeline (proj.timeline)", () => {
    const cmd = GIT_COMMANDS.find((c) => c.id === "proj.timeline")!;
    expect(cmd.uiAction).toEqual({ type: "view", view: "timeline" });
    expect(filterCommands(GIT_COMMANDS, "linha do tempo").some((c) => c.id === "proj.timeline")).toBe(true);
  });
});
