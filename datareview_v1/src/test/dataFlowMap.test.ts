/**
 * Testes do dataFlowMap — o mapa micro/macro do pipeline de dados de ponta a
 * ponta (página /fluxo-dados). Garante integridade do modelo e coerência com
 * o registry de páginas (deep links reais).
 */
import { describe, expect, it } from "vitest";
import {
  AI_MODE_META,
  FLOW_STAGES,
  filterStages,
  stageCountByMode,
} from "@/lib/dataFlowMap";
import { PAGES } from "@/lib/pages";

describe("dataFlowMap — estágios", () => {
  it("cobre a jornada completa: busca → … → exportação", () => {
    expect(FLOW_STAGES[0].id).toBe("busca");
    expect(FLOW_STAGES[FLOW_STAGES.length - 1].id).toBe("exportacao");
    expect(FLOW_STAGES.length).toBeGreaterThanOrEqual(13);
  });

  it("ids e números são únicos e ordenados", () => {
    const ids = FLOW_STAGES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const nums = FLOW_STAGES.map((s) => Number(s.num));
    for (let i = 1; i < nums.length; i++) expect(nums[i]).toBe(nums[i - 1] + 1);
  });

  it("todo estágio tem micro-etapas com ids únicos, entradas e saídas", () => {
    for (const s of FLOW_STAGES) {
      expect(s.title).toBeTruthy();
      expect(s.subtitle).toBeTruthy();
      expect(s.inputs.length).toBeGreaterThan(0);
      expect(s.outputs.length).toBeGreaterThan(0);
      expect(s.microSteps.length).toBeGreaterThanOrEqual(3);
      const microIds = s.microSteps.map((m) => m.id);
      expect(new Set(microIds).size).toBe(microIds.length);
      for (const m of s.microSteps) {
        expect(m.title).toBeTruthy();
        expect(m.detail.length).toBeGreaterThan(20);
      }
    }
  });

  it("cobre os 4 modos de IA (sem IA, para IA, com IA, híbrido)", () => {
    const counts = stageCountByMode();
    expect(counts["sem-ia"]).toBeGreaterThan(0);
    expect(counts["para-ia"]).toBeGreaterThan(0);
    expect(counts["com-ia"]).toBeGreaterThan(0);
    expect(counts.hibrido).toBeGreaterThan(0);
    const total = counts["sem-ia"] + counts["para-ia"] + counts["com-ia"] + counts.hibrido;
    expect(total).toBe(FLOW_STAGES.length);
    for (const mode of Object.keys(AI_MODE_META)) {
      expect(AI_MODE_META[mode as keyof typeof AI_MODE_META].label).toBeTruthy();
    }
  });

  it("deep links apontam para páginas reais do registry", () => {
    const paths = new Set(PAGES.map((p) => p.path));
    for (const s of FLOW_STAGES) {
      for (const l of s.deepLinks ?? []) {
        expect(paths.has(l.path), `deep link quebrado em ${s.id}: ${l.path}`).toBe(true);
      }
    }
  });

  it("estágios de IA vêm depois dos determinísticos (dado existe antes da IA)", () => {
    const firstAI = FLOW_STAGES.findIndex((s) => s.aiMode === "com-ia");
    const lastDeterministic = FLOW_STAGES.map((s, i) => (s.aiMode === "sem-ia" ? i : -1)).filter((i) => i >= 0).pop()!;
    expect(firstAI).toBeGreaterThan(0);
    expect(lastDeterministic).toBeGreaterThan(firstAI); // exportação é sem IA
  });

  it("filterStages filtra por modo e 'todas' retorna tudo", () => {
    expect(filterStages("todas")).toHaveLength(FLOW_STAGES.length);
    const semIa = filterStages("sem-ia");
    expect(semIa.every((s) => s.aiMode === "sem-ia")).toBe(true);
    expect(semIa.length).toBe(stageCountByMode()["sem-ia"]);
  });

  it("a cadeia cobre os dois eixos do briefing: apps-reviews e Uni multi-fonte", () => {
    const allText = FLOW_STAGES.flatMap((s) => s.microSteps.map((m) => `${m.title} ${m.detail} ${m.codeRef ?? ""}`)).join(" ");
    expect(allText).toMatch(/UniItem/);
    expect(allText).toMatch(/dataset/i);
    expect(allText).toMatch(/AIOutputCard/);
    expect(allText).toMatch(/rawStore/);
  });
});
