/**
 * Testes do modelo puro da página Fluxo (`/fluxo`) — catálogo de seções,
 * derivação de status a partir do snapshot, progresso, próximo passo e o
 * store da missão. Nenhuma chamada de rede/IA.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  FLOW_SECTIONS, FLOW_STATUS_META, sectionState, allSectionStates, flowProgress,
  nextSuggestedSection, emptySnapshot, getMission, saveMission, missionIAContext,
  sectionForTask,
  type FlowSnapshot, type FlowSectionId, type FlowStatus,
} from "@/lib/flow/flowModel";
import { getFocusedSection, setFocusedSection, subscribeFlowFocus } from "@/lib/flow/flowFocus";
import { PAGES } from "@/lib/pages";

function snap(patch: Partial<FlowSnapshot> = {}): FlowSnapshot {
  return { ...emptySnapshot(), ...patch };
}

/** Simula um snapshot "maduro" com dados + conhecimento + artefatos. */
function mature(): FlowSnapshot {
  return {
    apps: 3, reviews: 1500, selected: 2, insights: 5, artifacts: 4, findings: 2,
    candidates: 1, decks: 2, outputs: 7, generations: 9, canvasNodes: 12, designPages: 3,
  };
}

describe("catálogo de seções", () => {
  it("tem 16 seções numeradas em sequência", () => {
    expect(FLOW_SECTIONS).toHaveLength(16);
    FLOW_SECTIONS.forEach((s, i) => {
      expect(s.num).toBe(String(i).padStart(2, "0"));
    });
  });

  it("ids únicos", () => {
    expect(new Set(FLOW_SECTIONS.map((s) => s.id)).size).toBe(FLOW_SECTIONS.length);
  });

  it("cada seção declara título, subtítulo, ícone e deep links válidos", () => {
    for (const s of FLOW_SECTIONS) {
      expect(s.title).toBeTruthy();
      expect(s.subtitle).toBeTruthy();
      expect(s.icon).toBeDefined();
      expect(s.deepLinks.length).toBeGreaterThan(0);
      for (const l of s.deepLinks) {
        expect(l.path.startsWith("/")).toBe(true);
        expect(l.label).toBeTruthy();
      }
    }
  });

  it("deep links cobrem TODAS as páginas do registry (exceto a própria /fluxo)", () => {
    const covered = new Set(FLOW_SECTIONS.flatMap((s) => s.deepLinks.map((l) => l.path)));
    for (const page of PAGES) {
      if (page.path === "/fluxo" || page.external) continue;
      expect(covered.has(page.path), `página ${page.path} deveria estar em um deep link`).toBe(true);
    }
  });
});

describe("derivação de status por seção", () => {
  it("dataset vazio → descobrir/selecionar/coletar/dados/visualizar = idle", () => {
    const s = emptySnapshot();
    for (const id of ["descobrir", "selecionar", "coletar", "dados", "visualizar"] as FlowSectionId[]) {
      expect(sectionState(id, s).status).toBe("idle");
    }
  });

  it("dataset com apps → etapas de dados = done com detalhes", () => {
    const s = snap({ apps: 2, reviews: 500 });
    for (const id of ["descobrir", "selecionar", "coletar", "dados", "visualizar"] as FlowSectionId[]) {
      const st = sectionState(id, s);
      expect(st.status).toBe("done");
    }
  });

  it("seleção vazia significa 'todos os apps'", () => {
    const st = sectionState("selecionar", snap({ apps: 1, selected: 0 }));
    expect(st.status).toBe("done");
    expect(st.detail).toContain("todos");
  });

  it("sinais: ready com dataset, done com artefatos", () => {
    expect(sectionState("sinais", snap({ apps: 1 })).status).toBe("ready");
    expect(sectionState("sinais", snap({ artifacts: 3 })).status).toBe("done");
  });

  it("investigar: done quando há outputs/insights", () => {
    expect(sectionState("investigar", snap({ outputs: 4 })).status).toBe("done");
    expect(sectionState("investigar", snap({ insights: 1 })).status).toBe("done");
    expect(sectionState("investigar", snap({ apps: 1 })).status).toBe("ready");
  });

  it("conhecimento junta insights + artefatos + findings", () => {
    expect(sectionState("conhecimento", snap({ findings: 1 })).status).toBe("done");
    expect(sectionState("conhecimento", snap({})).status).toBe("idle");
  });

  it("oportunidades: done com candidatos; ready com conhecimento; idle sem nada", () => {
    expect(sectionState("oportunidades", snap({ candidates: 2 })).status).toBe("done");
    expect(sectionState("oportunidades", snap({ insights: 1 })).status).toBe("ready");
    expect(sectionState("oportunidades", snap({})).status).toBe("idle");
  });

  it("experimentar: done com nós de canvas ou páginas de design", () => {
    expect(sectionState("experimentar", snap({ canvasNodes: 3 })).status).toBe("done");
    expect(sectionState("experimentar", snap({ designPages: 1 })).status).toBe("done");
  });

  it("artefatos: done com gerações; apresentar: done com decks", () => {
    expect(sectionState("artefatos", snap({ generations: 5 })).status).toBe("done");
    expect(sectionState("apresentar", snap({ decks: 1 })).status).toBe("done");
    expect(sectionState("apresentar", snap({})).status).toBe("ready");
  });

  it("monitorar está sempre pronta", () => {
    expect(sectionState("monitorar", emptySnapshot()).status).toBe("ready");
  });
});

describe("progresso e próximo passo", () => {
  it("snapshot vazio → 0 etapas concluídas", () => {
    const states = allSectionStates(emptySnapshot());
    expect(flowProgress(states).done).toBe(0);
    expect(flowProgress(states).pct).toBe(0);
  });

  it("snapshot maduro → máximo de concluídas (missao/monitorar são contínuas)", () => {
    const states = allSectionStates(mature());
    const p = flowProgress(states);
    expect(p.done).toBe(14);
    expect(p.pct).toBe(Math.round((14 / 16) * 100));
  });

  it("próximo passo aponta a primeira etapa não concluída", () => {
    const states = allSectionStates(snap({ apps: 1, reviews: 100 }));
    const next = nextSuggestedSection(states);
    // Com dataset, descobrir..visualizar ficam done; a próxima bloqueada é sinais.
    expect(next?.id).toBe("sinais");
  });

  it("tudo concluído → sem próximo passo", () => {
    const states = allSectionStates(mature());
    expect(nextSuggestedSection(states)).toBeNull();
  });
});

describe("estados canônicos (FLOW_STATUS_META)", () => {
  it("cobre os 12 estados com label + tokens", () => {
    const all: FlowStatus[] = [
      "idle", "ready", "needs-config", "running", "processing", "paused",
      "done", "done-warning", "error", "blocked", "skipped", "attention",
    ];
    for (const s of all) {
      const meta = FLOW_STATUS_META[s];
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.dot.startsWith("bg-status-")).toBe(true);
      expect(meta.chip).toContain("text-");
    }
  });

  it("estado nunca depende só de cor — label e ícone sempre definidos", () => {
    for (const meta of Object.values(FLOW_STATUS_META)) {
      expect(meta.icon).toBeDefined();
      expect(typeof meta.label).toBe("string");
    }
  });
});

describe("sectionForTask — ponte tarefas → seções", () => {
  it("mapeia coleta", () => {
    expect(sectionForTask({ label: "Coletar Nubank", source: "coleta" })).toBe("coletar");
  });

  it("mapeia canvas", () => {
    expect(sectionForTask({ label: "Canvas: executar 5 nós", source: "canvas" })).toBe("experimentar");
  });

  it("mapeia agentes", () => {
    expect(sectionForTask({ label: "Agente Produto", source: "agente" })).toBe("agentes");
  });

  it("mapeia pipeline de fatos/anomalias", () => {
    expect(sectionForTask({ label: "Pipeline: anomalias", source: "pipeline" })).toBe("sinais");
  });

  it("desconhecido retorna null (seção mantém status do snapshot)", () => {
    expect(sectionForTask({ label: "qualquer outra", source: "x" })).toBeNull();
  });
});

describe("foco do System Flow", () => {
  it("set/get/subscribe", () => {
    setFocusedSection(null);
    expect(getFocusedSection()).toBeNull();
    let hits = 0;
    const off = subscribeFlowFocus(() => hits++);
    setFocusedSection("coletar");
    expect(getFocusedSection()).toBe("coletar");
    expect(hits).toBe(1);
    setFocusedSection("coletar"); // idempotente
    expect(hits).toBe(1);
    off();
    setFocusedSection(null);
  });
});

describe("missão persistida", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("get/save/subscribe ciclo", () => {
    expect(getMission()).toBe("");
    saveMission("descobrir oportunidades no onboarding");
    expect(getMission()).toBe("descobrir oportunidades no onboarding");
  });

  it("missionIAContext retorna undefined sem missão e sem base", () => {
    expect(missionIAContext()).toBeUndefined();
  });

  it("missionIAContext injeta o objetivo no início do extraContext", () => {
    saveMission("reduzir churn pós-onboarding");
    const ctx = missionIAContext();
    expect(ctx).toContain("OBJETIVO DA INVESTIGAÇÃO");
    expect(ctx).toContain("reduzir churn pós-onboarding");
  });

  it("missionIAContext concatena base (knowledge digest) após a missão", () => {
    saveMission("benchmark de ASO vs concorrentes");
    const ctx = missionIAContext("DIGEST-TESTE");
    expect(ctx).toContain("DIGEST-TESTE");
    expect(ctx!.indexOf("OBJETIVO")).toBeLessThan(ctx!.indexOf("DIGEST-TESTE"));
  });

  it("missionIAContext com base mas sem missão retorna a base", () => {
    expect(missionIAContext("somente-digest")).toBe("somente-digest");
  });
});
