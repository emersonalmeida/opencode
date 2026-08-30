/**
 * Testes do sourceRunner — despachante uniforme de coleta por fonte e o
 * documento determinístico do Pipeline Multifonte.
 */
import { describe, expect, it } from "vitest";
import {
  PIPELINE_SOURCES,
  buildPipelineDocument,
  initialSteps,
  sourceSkipReason,
  type PipelineStep,
} from "@/lib/uni/sourceRunner";
import type { UniItem, UniSourceId } from "@/lib/uni/types";

function item(source: UniSourceId, title: string, score?: number): UniItem {
  return { id: `${source}:${title}`, source, kind: "post", title, score };
}

describe("sourceSkipReason", () => {
  it("paste nunca roda por termo", () => {
    expect(sourceSkipReason("paste", "bitcoin")).toMatch(/texto colado/);
  });

  it("web/feed exigem URL", () => {
    expect(sourceSkipReason("web", "bitcoin")).toMatch(/URL/);
    expect(sourceSkipReason("feed", "bitcoin")).toMatch(/URL/);
    expect(sourceSkipReason("web", "https://exemplo.com")).toBeNull();
    expect(sourceSkipReason("feed", "https://exemplo.com/rss")).toBeNull();
  });

  it("termo vazio é rejeitado", () => {
    expect(sourceSkipReason("serp", "  ")).toMatch(/termo/);
  });

  it("fontes por termo rodam normalmente", () => {
    expect(sourceSkipReason("suggest", "bitcoin")).toBeNull();
    expect(sourceSkipReason("reddit", "bitcoin")).toBeNull();
    expect(sourceSkipReason("github", "react")).toBeNull();
  });

  it("todas as fontes do pipeline têm metadados conhecidos", () => {
    expect(PIPELINE_SOURCES.length).toBeGreaterThan(20);
    expect(PIPELINE_SOURCES).toContain("suggest");
    expect(PIPELINE_SOURCES).toContain("steam");
    expect(PIPELINE_SOURCES).not.toContain("paste");
  });
});

describe("initialSteps", () => {
  it("marca fontes não-URL como skipped quando o termo não é URL", () => {
    const steps = initialSteps(["serp", "web", "feed"], "bitcoin");
    expect(steps.find((s) => s.source === "serp")?.status).toBe("pending");
    expect(steps.find((s) => s.source === "web")?.status).toBe("skipped");
    expect(steps.find((s) => s.source === "feed")?.status).toBe("skipped");
  });

  it("com URL, web e feed ficam pendentes", () => {
    const steps = initialSteps(["web", "feed"], "https://exemplo.com");
    expect(steps.every((s) => s.status === "pending")).toBe(true);
  });
});

describe("buildPipelineDocument", () => {
  const steps: PipelineStep[] = [
    { source: "serp", status: "done", itemCount: 2 },
    { source: "web", status: "skipped", itemCount: 0, skippedReason: "precisa de URL" },
    { source: "reddit", status: "error", itemCount: 0, error: "HTTP 403" },
  ];

  it("gera cabeçalho, tabela de resumo e seções por fonte", () => {
    const doc = buildPipelineDocument("bitcoin", steps, [
      item("serp", "Preço do bitcoin hoje", 42),
      item("serp", "Bitcoin é seguro?"),
      item("reddit", "Discussão removida"),
    ]);
    expect(doc).toContain("# Pipeline Multifonte — bitcoin");
    expect(doc).toContain("| serp | done | 2 |");
    expect(doc).toContain("| web | skipped | 0 | precisa de URL |");
    expect(doc).toContain("| reddit | error | 0 | HTTP 403 |");
    expect(doc).toContain("## serp (2 itens)");
    expect(doc).toContain("**Preço do bitcoin hoje** (▲ 42)");
    // Fonte com erro não gera seção de itens.
    expect(doc).not.toContain("## reddit");
    // Sem IA, não há seção de análise.
    expect(doc).not.toContain("## Análise de IA");
  });

  it("anexa a análise de IA quando presente", () => {
    const doc = buildPipelineDocument("bitcoin", steps, [item("serp", "A")], "## Achados\n\nIA diz…");
    expect(doc).toContain("## Análise de IA");
    expect(doc).toContain("IA diz…");
  });
});
