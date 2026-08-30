import { describe, it, expect } from "vitest";
import { suggestQuickReplies } from "@/lib/quickReplies";

describe("suggestQuickReplies — quick replies contextuais do chat", () => {
  it("vazio/curto não sugere nada (não polui a UI)", () => {
    expect(suggestQuickReplies("")).toEqual([]);
    expect(suggestQuickReplies("ok")).toEqual([]);
    expect(suggestQuickReplies("   ")).toEqual([]);
  });

  it("resposta sobre problemas/bugs sugere aprofundar problemas", () => {
    const chips = suggestQuickReplies(
      "Os principais problemas relatados são bugs no login e falhas de sincronização que geram travamento constante do app.",
    );
    expect(chips.length).toBeGreaterThan(0);
    expect(chips[0]).toMatch(/problemas|corrigir/i);
  });

  it("resposta sobre oportunidades sugere roadmap/impacto", () => {
    const chips = suggestQuickReplies(
      "Há uma oportunidade clara de melhoria: os usuários pedem modo offline e relatam potencial de expansão para o desktop.",
    );
    expect(chips[0]).toMatch(/oportunidades|roadmap|esforço/i);
  });

  it("resposta sobre versões sugere comparação de versões", () => {
    const chips = suggestQuickReplies(
      "Após a atualização 5.2 houve regressão na nota média: a versão anterior tinha 4.4 e a atual caiu para 3.9.",
    );
    expect(chips[0]).toMatch(/vers/i);
  });

  it("resposta genérica cai nos fallbacks úteis (resumo/evidências/ação)", () => {
    const chips = suggestQuickReplies(
      "Análise concluída com base nos reviews coletados do período, cobrindo os principais temas levantados pelos usuários.",
    );
    expect(chips).toContain("Resuma em 3 pontos");
    expect(chips).toContain("Quais as evidências disso?");
    expect(chips).toContain("O que fazer em seguida?");
  });

  it("nunca repete sugestões e respeita o máximo", () => {
    const chips = suggestQuickReplies(
      "Problemas de bugs e falhas com oportunidades de melhoria e comparativo com concorrentes em várias versões.",
      3,
    );
    expect(chips.length).toBeLessThanOrEqual(3);
    expect(new Set(chips).size).toBe(chips.length);
  });

  it("sem match de regra mas com conteúdo longo retorna fallbacks", () => {
    const chips = suggestQuickReplies("x".repeat(200));
    expect(chips).toEqual(["Resuma em 3 pontos", "Quais as evidências disso?", "O que fazer em seguida?"]);
  });
});
