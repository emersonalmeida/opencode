// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  JOURNEY_STEPS, loadJourney, saveJourney, resetJourney, subscribeJourney,
  stepIndex, nextStep, prevStep, advanceTo, goTo, journeyProgress, stepStatus,
} from "@/lib/journey";

beforeEach(() => localStorage.clear());

describe("journey — definição das etapas", () => {
  it("6 etapas na ordem lógica descobrir→apresentar", () => {
    expect(JOURNEY_STEPS.map((s) => s.id)).toEqual([
      "descobrir", "coletar", "analisar", "visualizar", "decidir", "apresentar",
    ]);
  });

  it("cada etapa tem label, descrição e deep link para página especializada", () => {
    for (const s of JOURNEY_STEPS) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.desc.length).toBeGreaterThan(0);
      expect(s.deepLink.startsWith("/")).toBe(true);
      expect(s.deepLinkLabel.length).toBeGreaterThan(0);
    }
  });
});

describe("journey — navegação pura", () => {
  it("stepIndex/nextStep/prevStep", () => {
    expect(stepIndex("descobrir")).toBe(0);
    expect(nextStep("descobrir")).toBe("coletar");
    expect(prevStep("descobrir")).toBeNull();
    expect(nextStep("apresentar")).toBeNull();
    expect(prevStep("apresentar")).toBe("decidir");
  });

  it("advanceTo marca a etapa atual como concluída", () => {
    const s = loadJourney();
    const s2 = advanceTo(s, "coletar");
    expect(s2.currentStep).toBe("coletar");
    expect(s2.completed).toContain("descobrir");
    // Não duplica
    const s3 = advanceTo(goTo(s2, "descobrir"), "coletar");
    expect(s3.completed.filter((c) => c === "descobrir")).toHaveLength(1);
  });

  it("goTo não marca conclusão", () => {
    const s = goTo(loadJourney(), "visualizar");
    expect(s.currentStep).toBe("visualizar");
    expect(s.completed).toHaveLength(0);
  });

  it("journeyProgress reflete etapas concluídas", () => {
    expect(journeyProgress(loadJourney())).toBe(0);
    const s = advanceTo(loadJourney(), "coletar");
    expect(journeyProgress(s)).toBe(17); // 1/6
  });

  it("stepStatus: done/current/todo", () => {
    const s = advanceTo(loadJourney(), "coletar");
    expect(stepStatus(s, "descobrir")).toBe("done");
    expect(stepStatus(s, "coletar")).toBe("current");
    expect(stepStatus(s, "analisar")).toBe("todo");
  });
});

describe("journey — persistência", () => {
  it("save/load round-trip", () => {
    const s = advanceTo(loadJourney(), "analisar");
    saveJourney(s);
    const loaded = loadJourney();
    expect(loaded.currentStep).toBe("analisar");
    expect(loaded.completed).toContain("descobrir");
    expect(loaded.updatedAt).toBeGreaterThan(0);
  });

  it("load tolera storage corrompido e etapas inválidas", () => {
    localStorage.setItem("aso:journey:v1", "{quebrado");
    expect(loadJourney().currentStep).toBe("descobrir");
    localStorage.setItem("aso:journey:v1", JSON.stringify({ currentStep: "nope", completed: ["nope", "coletar"] }));
    const s = loadJourney();
    expect(s.currentStep).toBe("descobrir");
    expect(s.completed).toEqual(["coletar"]);
  });

  it("resetJourney volta ao início e notifica subscribers", () => {
    let fired = 0;
    const unsub = subscribeJourney(() => fired++);
    saveJourney(advanceTo(loadJourney(), "coletar"));
    resetJourney();
    unsub();
    expect(loadJourney().currentStep).toBe("descobrir");
    expect(loadJourney().completed).toEqual([]);
    expect(fired).toBe(2);
  });
});
