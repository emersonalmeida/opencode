import { describe, it, expect } from "vitest";
import {
  buildRunSteps, buildRunStepsFor, totalOutputs, countCompleted,
  outputKey, stepProgress, buildCompendiumMarkdown, buildSynthesisPrompt,
  SYNTHESIS_KEY,
} from "@/lib/decisionPipeline";
import { PERSONAS } from "@/lib/decisionCenter";

const p = PERSONAS[0]; // CEO

describe("decisionPipeline — steps", () => {
  it("buildRunStepsFor returns persona.modules in order", () => {
    const steps = buildRunStepsFor(p);
    expect(steps.length).toBe(p.modules.length);
    expect(steps[0].persona.id).toBe(p.id);
    expect(steps[0].module.id).toBe(p.modules[0].id);
    expect(steps[steps.length - 1].module.id).toBe(p.modules[p.modules.length - 1].id);
  });

  it("buildRunSteps covers all personas × modules (7 × 10 = 70)", () => {
    const steps = buildRunSteps(PERSONAS);
    expect(steps.length).toBe(totalOutputs(PERSONAS));
    expect(totalOutputs(PERSONAS)).toBe(PERSONAS.length * PERSONAS[0].modules.length);
  });

  it("outputKey encodes persona:module; countCompleted skips synthesis", () => {
    const key = outputKey("ceo", "executive-briefing");
    expect(key).toBe("ceo:executive-briefing");
    const outputs = { [key]: "texto", "ceo:other": "outra", [SYNTHESIS_KEY]: "sum", "empty:one": "" };
    expect(countCompleted(outputs)).toBe(2); // synthesis + empty excluded
  });

  it("stepProgress labels like 'CEO · Executive Briefing (3/10)'", () => {
    const step = buildRunStepsFor(p)[2];
    expect(stepProgress(step, 2, 10)).toBe(`${p.label} · ${p.modules[2].label} (3/10)`);
  });
});

describe("decisionPipeline — compendium + synthesis prompt", () => {
  it("buildCompendiumMarkdown marks pending modules and stitches completed ones", () => {
    const outputs = {
      [outputKey(p.id, p.modules[0].id)]: "## Insight\nTop risco identificado.",
    };
    const md = buildCompendiumMarkdown(PERSONAS, outputs);
    expect(md).toContain("# Compêndio Executivo");
    expect(md).toContain(`## Persona: ${p.label}`);
    expect(md).toContain(p.centralQuestion);
    expect(md).toContain("### " + p.modules[0].label);
    expect(md).toContain("Top risco identificado.");
    expect(md).toContain("_Pendente: módulo não gerado._");
    expect(md).toContain(`1 geradas`); // countCompleted stitches as "N geradas"
  });

  it("buildSynthesisPrompt names the consolidation structure + mentions missing coverage", () => {
    const outputs = { [outputKey(p.id, p.modules[0].id)]: "conteúdo" };
    const prompt = buildSynthesisPrompt(PERSONAS, outputs);
    expect(prompt).toContain("SÍNTESE EXECUTIVA");
    expect(prompt).toContain("1/" + totalOutputs(PERSONAS));
    expect(prompt).toContain("Dados incompletos");
    expect(prompt).toContain("conteúdo");
  });
});
