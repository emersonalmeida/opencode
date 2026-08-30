import { beforeEach, describe, expect, it } from "vitest";
import {
  aiOutputKey, saveAIOutput, getAIOutput, getAIOutputFor, listAIOutputs,
  removeAIOutput, clearAIOutputs,
} from "@/lib/aiOutputStore";

describe("aiOutputStore", () => {
  beforeEach(() => {
    localStorage.clear();
    clearAIOutputs();
  });

  it("gera chave determinística independente da ordem dos apps", () => {
    expect(aiOutputKey("summary", ["apple:1", "google:2"]))
      .toBe(aiOutputKey("summary", ["google:2", "apple:1"]));
  });

  it("salva e recupera por (seção, appKeys)", () => {
    saveAIOutput("summary", ["apple:1"], "# Análise\n\nConteúdo gerado.");
    const rec = getAIOutputFor("summary", ["apple:1"]);
    expect(rec?.markdown).toContain("Conteúdo gerado");
  });

  it("regenerar sobrescreve a MESMA chave (sem duplicar)", () => {
    saveAIOutput("summary", ["apple:1"], "v1");
    saveAIOutput("summary", ["apple:1"], "v2");
    expect(listAIOutputs()).toHaveLength(1);
    expect(getAIOutputFor("summary", ["apple:1"])?.markdown).toBe("v2");
  });

  it("escopos diferentes coexistem", () => {
    saveAIOutput("summary", ["apple:1"], "A");
    saveAIOutput("problems", ["apple:1"], "B");
    saveAIOutput("summary", ["apple:1", "apple:2"], "C");
    expect(listAIOutputs()).toHaveLength(3);
  });

  it("persiste em localStorage (sobrevive a reload)", () => {
    saveAIOutput("compare", ["apple:1", "google:2"], "persistido");
    const raw = localStorage.getItem("aso:ai-outputs:v1");
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!)[0].markdown).toBe("persistido");
  });

  it("ignora markdown vazio", () => {
    expect(saveAIOutput("summary", ["apple:1"], "   ")).toBeNull();
    expect(listAIOutputs()).toHaveLength(0);
  });

  it("suporta chave custom (DecisionCenter)", () => {
    saveAIOutput("dc", ["apple:1"], "decisão", undefined, "dc:ceo:briefing|apple:1");
    expect(getAIOutput("dc:ceo:briefing|apple:1")?.markdown).toBe("decisão");
  });

  it("remove e limpa", () => {
    saveAIOutput("a", ["apple:1"], "x");
    saveAIOutput("b", ["apple:1"], "y");
    removeAIOutput(aiOutputKey("a", ["apple:1"]));
    expect(listAIOutputs()).toHaveLength(1);
    clearAIOutputs();
    expect(listAIOutputs()).toHaveLength(0);
  });

  it("lista newest first e registra updatedAt", () => {
    saveAIOutput("a", ["apple:1"], "primeiro");
    saveAIOutput("b", ["apple:1"], "segundo");
    const list = listAIOutputs();
    expect(list[0].markdown).toBe("segundo");
    expect(list.every((r) => r.updatedAt > 0)).toBe(true);
  });
});
