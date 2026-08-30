// @vitest-environment jsdom
/**
 * Testes da página Metodologias: integridade do catálogo (ids únicos,
 * categorias válidas, contrato goal/deliverable), busca, geração de jobs da
 * fila de IA e persistência de pipelines customizados.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  METHODOLOGIES, METHOD_CATEGORY_ORDER, METHOD_CATEGORY_LABELS,
  getMethodology, searchMethodologies, buildMethodPrompt, methodologyJobs,
  saveMethodPipeline, listMethodPipelines, deleteMethodPipeline, PRESET_PIPELINES,
} from "@/lib/methodologies";

beforeEach(() => localStorage.clear());

describe("metodologias — catálogo", () => {
  it("ids únicos e campos obrigatórios preenchidos", () => {
    const ids = METHODOLOGIES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of METHODOLOGIES) {
      expect(m.name.length).toBeGreaterThan(0);
      expect(m.goal.length).toBeGreaterThan(0);
      expect(m.deliverable.length).toBeGreaterThan(0);
      expect(METHOD_CATEGORY_ORDER).toContain(m.category);
    }
  });

  it("todas as 8 áreas têm pelo menos 1 metodologia", () => {
    for (const cat of METHOD_CATEGORY_ORDER) {
      expect(METHODOLOGIES.some((m) => m.category === cat)).toBe(true);
      expect(METHOD_CATEGORY_LABELS[cat]).toBeTruthy();
    }
  });

  it("busca por nome, objetivo e categoria", () => {
    expect(searchMethodologies("kano").some((m) => m.id === "kano")).toBe(true);
    expect(searchMethodologies("causa-raiz").some((m) => m.id === "5-porques")).toBe(true);
    expect(searchMethodologies("marketing").some((m) => m.category === "marketing")).toBe(true);
    expect(searchMethodologies("")).toHaveLength(METHODOLOGIES.length);
  });

  it("prompt da metodologia inclui objetivo + entregável + regra de evidência", () => {
    const m = getMethodology("jtbd")!;
    const p = buildMethodPrompt(m);
    expect(p).toContain(m.goal);
    expect(p).toContain(m.deliverable);
    expect(p).toContain("evidência");
  });
});

describe("metodologias — jobs da fila de IA", () => {
  it("methodologyJobs gera jobs chat com saveAs estável e origem correta", () => {
    const jobs = methodologyJobs("p1", ["kano", "rice"]);
    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({
      id: "met:p1:kano",
      kind: "chat",
      origin: "metodologias",
      saveAs: { section: "metodologia", key: "met:p1:kano" },
    });
    expect(jobs[0].prompt).toContain("Kano");
  });

  it("ignora ids de metodologia inexistentes", () => {
    expect(methodologyJobs("p1", ["nao-existe"])).toHaveLength(0);
  });

  it("todos os presets referenciam metodologias válidas", () => {
    for (const preset of PRESET_PIPELINES) {
      expect(preset.methodIds.length).toBeGreaterThan(1);
      for (const id of preset.methodIds) {
        expect(getMethodology(id)).toBeTruthy();
      }
    }
  });
});

describe("metodologias — pipelines salvos", () => {
  it("salva, lista (newest first) e exclui pipelines", () => {
    const a = saveMethodPipeline("Alpha", ["kano"]);
    const b = saveMethodPipeline("Beta", ["rice"]);
    const list = listMethodPipelines();
    expect(list[0].id).toBe(b.id);
    expect(list[1].id).toBe(a.id);
    deleteMethodPipeline(a.id);
    expect(listMethodPipelines().map((p) => p.id)).toEqual([b.id]);
  });

  it("nome vazio ganha fallback com data", () => {
    const p = saveMethodPipeline("   ", ["swot"]);
    expect(p.name.startsWith("Pipeline")).toBe(true);
  });

  it("storage corrompido → lista vazia (nunca quebra)", () => {
    localStorage.setItem("aso:method-pipelines:v1", "{quebrado");
    expect(listMethodPipelines()).toEqual([]);
  });
});
