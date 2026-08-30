import { describe, it, expect } from "vitest";
import { artifactToHTML } from "@/lib/shareArtifact";
import type { PipelineArtifact } from "@/lib/pipeline/types";

function mkArtifact(partial: Partial<PipelineArtifact> = {}): PipelineArtifact {
  return {
    id: "art-1",
    kind: "finding",
    stage: "reason",
    title: "Análise de sentimento",
    methodology: "ai:topic-extraction",
    engine: "ai",
    inputIds: [],
    appKeys: ["apple:123"],
    createdAt: 1_720_000_000_000,
    ...partial,
  };
}

describe("shareArtifact — exportar análise como HTML autocontido (Onda 4.4)", () => {
  it("gera HTML válido autocontido com metadados", () => {
    const html = artifactToHTML(mkArtifact({ markdown: "# Resumo\n\nTudo certo." }));
    expect(html).toContain("<!doctype html>");
    expect(html).toContain('lang="pt-BR"');
    expect(html).toContain("Análise de sentimento");
    expect(html).toContain("ai:topic-extraction");
    expect(html).toContain("Descobertas &amp; hipóteses"); // label do stage
  });

  it("escapa XSS em título e markdown", () => {
    const html = artifactToHTML(
      mkArtifact({
        title: '<script>alert("x")</script>',
        markdown: '**negrito** e <img src=x onerror=alert(1)>',
      }),
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("<strong>negrito</strong>");
  });

  it("renderiza findings com evidência e confiança", () => {
    const html = artifactToHTML(
      mkArtifact({
        data: {
          findings: [
            { title: "Travamento no login", confidence: 0.9, evidence: "> trava sempre" },
          ],
        },
      }),
    );
    expect(html).toContain("Achados (1)");
    expect(html).toContain("Travamento no login");
    expect(html).toContain("confiança 90%");
  });

  it("renderiza anomalias com título e detalhe", () => {
    const html = artifactToHTML(
      mkArtifact({
        stage: "extract",
        data: {
          anomalies: [
            {
              id: "a1",
              type: "version-regression",
              severity: "alta",
              title: "Regressão na 2.0",
              detail: "nota caiu 1.2 estrelas",
              numbers: {},
              reviewIds: [],
            },
          ],
        },
      }),
    );
    expect(html).toContain("Anomalias (1)");
    expect(html).toContain("Regressão na 2.0");
    expect(html).toContain("nota caiu 1.2 estrelas");
  });

  it("markdown mínimo: headings, listas, código e blockquote", () => {
    const html = artifactToHTML(
      mkArtifact({ markdown: "## Título\n- item 1\n- item 2\n> citação\n```js\nconst x = 1;\n```" }),
    );
    expect(html).toContain("<h2>Título</h2>");
    expect(html).toContain("<li>item 1</li>");
    expect(html).toContain("<blockquote>citação</blockquote>");
    expect(html).toContain("const x = 1;");
  });

  it("sem markdown/findings/anomalias = só o cabeçalho (honesto)", () => {
    const html = artifactToHTML(mkArtifact());
    expect(html).toContain("Análise de sentimento");
    expect(html).not.toContain("Achados (");
    expect(html).not.toContain("Anomalias (");
  });
});
