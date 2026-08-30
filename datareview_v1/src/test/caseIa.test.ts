import { describe, it, expect } from "vitest";
import { CASE_PROFILES, buildCasePrompt, caseTitle } from "@/lib/caseIa";

describe("caseIa — perfis e prompt de geração de case", () => {
  it("8 perfis cobrindo CEO→PM→UX→Dev→PO→Marketing→Pesquisa→Suporte→Competitiva", () => {
    const ids = CASE_PROFILES.map((p) => p.id);
    expect(ids).toEqual(["ceo", "product-manager", "ux-designer", "engineering", "product-owner", "marketing", "researcher", "customer-success", "competitive"]);
    for (const p of CASE_PROFILES) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.lens.length).toBeGreaterThan(0);
      expect(p.questions.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("prompt inclui estrutura do case, perfil e regra de evidência", () => {
    const profile = CASE_PROFILES.find((p) => p.id === "ceo")!;
    const prompt = buildCasePrompt(profile);
    expect(prompt).toContain("# Case:");
    expect(prompt).toContain("## Resumo executivo");
    expect(prompt).toContain("## Perguntas de pesquisa");
    expect(prompt).toContain("## Respostas com evidência");
    expect(prompt).toContain("## Plano de ação");
    expect(prompt).toContain("## Como este case foi gerado");
    expect(prompt).toContain("CEO");
    expect(prompt).toContain("NUNCA invente citações");
    expect(prompt).toContain(profile.questions[0]);
  });

  it("preparação determinística entra como contexto preparado (sem recalcular)", () => {
    const prompt = buildCasePrompt(CASE_PROFILES[0], "FATOS: 3 apps, 501 reviews");
    expect(prompt).toContain("## Preparação determinística");
    expect(prompt).toContain("FATOS: 3 apps, 501 reviews");
  });

  it("caseTitle extrai o h1 'Case' ou cai no perfil", () => {
    expect(caseTitle("# Case: Nubank — UX Research", "CEO")).toBe("Nubank — UX Research");
    expect(caseTitle("sem h1", "CEO")).toBe("Case de CEO");
  });
});
