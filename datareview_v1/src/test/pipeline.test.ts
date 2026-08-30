/**
 * Testes do Motor de Conhecimento (Pipeline):
 *  - facts: camada determinística (fatos computados, sem IA)
 *  - anomalies: detecção determinística (regressão de versão, picos, outliers)
 *  - orchestrator: scoring potencial × evidência × custo, boosts e penalidades
 *  - artifactStore: vault + data lineage (árvore, ciclos, descendentes)
 *  - aiProtocol: parsing do bloco findings/next_analysis (loop de descoberta)
 *  - analyses: catálogo + resolução de aliases de next_analysis
 */
import { beforeEach, describe, expect, it } from "vitest";
import type { DatasetEntry } from "@/lib/datasetStore";
import type { ReviewEntry } from "@/lib/appStoreApi";
import { computeFacts, factsToMarkdown } from "@/lib/pipeline/facts";
import { detectAnomalies } from "@/lib/pipeline/anomalies";
import { scoreAnalyses, pickNext } from "@/lib/pipeline/orchestrator";
import { getAnalysis, resolveAnalysisId, ANALYSES } from "@/lib/pipeline/analyses";
import { parseAIResult, extractProtocolJson } from "@/lib/pipeline/aiProtocol";
import {
  saveArtifact, listArtifacts, getArtifact, removeArtifact, clearArtifacts,
  buildLineage, getDescendants, ancestorIds,
} from "@/lib/pipeline/artifactStore";
import type { PipelineArtifact } from "@/lib/pipeline/types";

/* ---------------------------------------------------------------- helpers */

let rid = 0;
function review(partial: Partial<ReviewEntry> = {}): ReviewEntry {
  rid++;
  return {
    id: `r${rid}`,
    store: "apple",
    appId: "app1",
    appName: "App1",
    author: `User${rid}`,
    rating: 5,
    title: "ótimo",
    text: "muito bom, recomendo",
    date: "2026-01-15",
    ...partial,
  };
}

function makeEntry(id: string, name: string, reviews: ReviewEntry[]): DatasetEntry {
  return {
    app: {
      id, store: "apple", name, icon: "", developer: "Dev", rating: 4.5,
      ratingCount: 1000, price: "0", genre: "Finance", description: "",
      version: "1.0", releaseDate: "", currentVersionReleaseDate: "",
      screenshots: [], url: "",
    },
    reviews,
    collectedAt: Date.now(),
  };
}

/** App com regressão clara: 30 reviews v8.1 (média ~5) + 10 reviews v8.2 (★1-2). */
function regressionEntry(): DatasetEntry {
  const good = Array.from({ length: 30 }, () => review({ rating: 5, version: "8.1" }));
  const bad = Array.from({ length: 10 }, (_, i) =>
    review({ rating: i % 2 === 0 ? 1 : 2, version: "8.2", text: "não consigo fazer login depois da atualização" }));
  return makeEntry("app1", "BankApp", [...good, ...bad]);
}

function makeArtifact(partial: Partial<PipelineArtifact> = {}): PipelineArtifact {
  return saveArtifact({
    kind: "facts",
    stage: "compute",
    title: "artifact",
    methodology: "deterministic:facts-overview",
    engine: "deterministic",
    inputIds: [],
    appKeys: ["apple:app1"],
    ...partial,
  });
}

beforeEach(() => {
  localStorage.clear();
});

/* ------------------------------------------------------------------ facts */

describe("computeFacts (camada determinística)", () => {
  it("computa KPIs, distribuição e qualidade dos dados", () => {
    const e = makeEntry("app1", "App1", [
      review({ rating: 5, version: "1.0", country: "br" }),
      review({ rating: 1, version: "1.0", country: "us", thumbsUp: 12 }),
      review({ rating: 3, version: "2.0" }),
    ]);
    const f = computeFacts([e]);
    expect(f.scope.apps).toBe(1);
    expect(f.scope.reviews).toBe(3);
    expect(f.kpis.avgRating).toBe(3);
    expect(f.kpis.positiveCount).toBe(1);
    expect(f.kpis.negativeCount).toBe(1);
    expect(f.ratingDistribution.find((d) => d.rating === 5)?.count).toBe(1);
    expect(f.countries.length).toBe(2);
    expect(f.countries[0].country).toBe("BR"); // ordenado por volume
    expect(f.dataQuality.versionPct).toBe(100);
    expect(f.dataQuality.countryPct).toBe(67);
    expect(f.helpful[0].thumbsUp).toBe(12);
    expect(f.perAppVersions["apple:app1"].length).toBe(2);
  });

  it("lida com dataset vazio sem quebrar", () => {
    const f = computeFacts([]);
    expect(f.scope.reviews).toBe(0);
    expect(f.kpis.avgRating).toBe(0);
    expect(f.timeline).toEqual([]);
  });

  it("factsToMarkdown inclui escopo e números", () => {
    const e = regressionEntry();
    const f = computeFacts([e]);
    const md = factsToMarkdown(f, { "apple:app1": "BankApp" });
    expect(md).toContain("40 reviews");
    expect(md).toContain("BankApp");
    expect(md).toContain("v8.2");
  });
});

/* -------------------------------------------------------------- anomalies */

describe("detectAnomalies", () => {
  it("detecta regressão de versão com números e reviewIds (lineage)", () => {
    const e = regressionEntry();
    const f = computeFacts([e]);
    const anomalies = detectAnomalies([e], f);
    const reg = anomalies.find((a) => a.type === "version-regression");
    expect(reg).toBeDefined();
    expect(reg!.numbers.delta).toBeLessThanOrEqual(-0.7);
    expect(reg!.numbers.versionAvg).toBeLessThan(reg!.numbers.appAvg);
    expect(reg!.reviewIds.length).toBeGreaterThan(0);
    expect(reg!.detail).toContain("v8.2");
  });

  it("NÃO detecta regressão com amostra pequena (guard de falso positivo)", () => {
    const e = makeEntry("app1", "App1", [
      ...Array.from({ length: 4 }, () => review({ rating: 5, version: "1.0" })),
      ...Array.from({ length: 3 }, () => review({ rating: 1, version: "2.0" })),
    ]);
    const f = computeFacts([e]);
    expect(detectAnomalies([e], f).filter((a) => a.type === "version-regression")).toEqual([]);
  });

  it("detecta pico de negatividade recente (14d vs baseline)", () => {
    const now = Date.now();
    const iso = (daysAgo: number) => new Date(now - daysAgo * 86400000).toISOString();
    const baseline = Array.from({ length: 30 }, () =>
      review({ rating: 5, date: iso(40 + Math.random() * 10) }));
    const recent = Array.from({ length: 15 }, () =>
      review({ rating: 1, date: iso(Math.random() * 10) }));
    const e = makeEntry("app1", "App1", [...baseline, ...recent]);
    const f = computeFacts([e]);
    const spike = detectAnomalies([e], f).find((a) => a.type === "negativity-spike");
    expect(spike).toBeDefined();
    expect(spike!.numbers.deltaPp).toBeGreaterThanOrEqual(15);
  });

  it("detecta pico de volume (último mês ≥ 2× mediana)", () => {
    const rs: ReviewEntry[] = [];
    for (const [month, n] of [["2026-01", 10], ["2026-02", 10], ["2026-03", 12], ["2026-04", 40]] as const) {
      for (let i = 0; i < n; i++) rs.push(review({ date: `${month}-15` }));
    }
    const e = makeEntry("app1", "App1", rs);
    const f = computeFacts([e]);
    const spike = detectAnomalies([e], f).find((a) => a.type === "volume-spike");
    expect(spike).toBeDefined();
    expect(spike!.numbers.ratio).toBeGreaterThanOrEqual(2);
  });

  it("detecta app fora da curva (outlier de nota, ambas as direções)", () => {
    const good = makeEntry("g", "Good", Array.from({ length: 40 }, () => review({ rating: 5 })));
    const bad = makeEntry("b", "Bad", Array.from({ length: 40 }, () => review({ rating: 1, store: "apple", appId: "b" })));
    const f = computeFacts([good, bad]);
    const outliers = detectAnomalies([good, bad], f).filter((a) => a.type === "app-rating-outlier");
    // média global = 3; Good (+2) e Bad (-2) estão ambos fora da curva
    expect(outliers.map((o) => o.appName).sort()).toEqual(["Bad", "Good"]);
    const badOutlier = outliers.find((o) => o.appName === "Bad")!;
    expect(badOutlier.numbers.delta).toBeLessThan(0);
  });

  it("dataset uniforme não gera anomalias", () => {
    const e = makeEntry("app1", "App1", Array.from({ length: 50 }, () => review({ rating: 4, version: "1.0" })));
    const f = computeFacts([e]);
    expect(detectAnomalies([e], f)).toEqual([]);
  });
});

/* ------------------------------------------------------------ orchestrator */

describe("orchestrator (scoring)", () => {
  it("pontua todo o catálogo e ordena por prioridade", () => {
    const e = regressionEntry();
    const scores = scoreAnalyses([e], [], []);
    expect(scores.length).toBe(ANALYSES.length);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1].priority).toBeGreaterThanOrEqual(scores[i].priority);
    }
  });

  it("anomalias impulsionam análises relacionadas (boost de potencial)", () => {
    const e = regressionEntry();
    const f = computeFacts([e]);
    const anomalies = detectAnomalies([e], f);
    const withBoost = scoreAnalyses([e], [], anomalies);
    const without = scoreAnalyses([e], [], []);
    const boosted = withBoost.find((s) => s.analysis.id === "version-impact")!;
    const plain = without.find((s) => s.analysis.id === "version-impact")!;
    expect(boosted.potential).toBeGreaterThan(plain.potential);
    expect(boosted.reasons.some((r) => r.includes("anomalia"))).toBe(true);
  });

  it("análise já executada perde 75% do potencial (retorno decrescente)", () => {
    const e = regressionEntry();
    const before = scoreAnalyses([e], [], []).find((s) => s.analysis.id === "facts-overview")!;
    const ran = makeArtifact({ methodology: "deterministic:facts-overview" });
    const after = scoreAnalyses([e], [ran], []).find((s) => s.analysis.id === "facts-overview")!;
    expect(after.alreadyRun).toBe(true);
    expect(after.potential).toBeLessThan(before.potential);
    expect(after.hot).toBe(false);
  });

  it("raciocínio sem camadas de extração perde evidência (dependência)", () => {
    const e = regressionEntry();
    const withoutUpstream = scoreAnalyses([e], [], []).find((s) => s.analysis.id === "what-changed")!;
    const topics = makeArtifact({ kind: "topics", stage: "extract", engine: "ai", methodology: "ai:topic-extraction" });
    const sentiment = makeArtifact({ kind: "sentiment", stage: "extract", engine: "ai", methodology: "ai:sentiment-by-topic" });
    const withUpstream = scoreAnalyses([e], [topics, sentiment], []).find((s) => s.analysis.id === "what-changed")!;
    expect(withUpstream.evidence).toBeGreaterThan(withoutUpstream.evidence);
  });

  it("pickNext retorna a mais quente e null quando nada justifica o custo", () => {
    const e = regressionEntry();
    const scores = scoreAnalyses([e], [], []);
    const next = pickNext(scores);
    expect(next).not.toBeNull();
    expect(next!.hot).toBe(true);
    // tudo já executado → loop termina
    const allRan = ANALYSES.map((a) =>
      makeArtifact({ methodology: `${a.engine}:${a.id}`, kind: a.kind, stage: a.stage, engine: a.engine }));
    expect(pickNext(scoreAnalyses([e], allRan, []))).toBeNull();
  });
});

/* ----------------------------------------------------------- artifactStore */

describe("artifactStore + data lineage", () => {
  it("salva, lista (newest-first), busca e remove", () => {
    const a = makeArtifact({ title: "A" });
    const b = makeArtifact({ title: "B" });
    const list = listArtifacts();
    expect(list.length).toBe(2);
    expect(list[0].id).toBe(b.id); // newest first (timestamps estritamente crescentes)
    expect(getArtifact(a.id)?.title).toBe("A");
    removeArtifact(a.id);
    expect(listArtifacts().length).toBe(1);
  });

  it("buildLineage sobe a cadeia até as raízes", () => {
    const facts = makeArtifact({ title: "Fatos" });
    const topics = makeArtifact({ title: "Temas", kind: "topics", stage: "extract", engine: "ai", inputIds: [facts.id] });
    const finding = makeArtifact({ title: "Descoberta", kind: "finding", stage: "reason", engine: "ai", inputIds: [topics.id] });
    const tree = buildLineage(finding.id)!;
    expect(tree.artifact.title).toBe("Descoberta");
    expect(tree.inputs[0].artifact.title).toBe("Temas");
    expect(tree.inputs[0].inputs[0].artifact.title).toBe("Fatos");
    expect(tree.inputs[0].inputs[0].inputs).toEqual([]); // raiz = dataset
  });

  it("buildLineage sobrevive a ciclos sem loop infinito", () => {
    const a = makeArtifact({ title: "A" });
    const b = makeArtifact({ title: "B", inputIds: [a.id] });
    // cria ciclo manualmente: a passa a depender de b
    const list = listArtifacts().map((x) => (x.id === a.id ? { ...x, inputIds: [b.id] } : x));
    localStorage.setItem("aso:pipeline-artifacts:v1", JSON.stringify(list));
    const tree = buildLineage(a.id);
    expect(tree).not.toBeNull(); // não trava
  });

  it("getDescendants + ancestorIds", () => {
    const facts = makeArtifact({ title: "Fatos" });
    const topics = makeArtifact({ title: "Temas", inputIds: [facts.id] });
    const finding = makeArtifact({ title: "Descoberta", inputIds: [topics.id] });
    expect(getDescendants(facts.id).map((d) => d.id)).toEqual([topics.id]);
    expect(ancestorIds(finding.id)).toContain(topics.id);
    expect(ancestorIds(finding.id)).toContain(facts.id);
  });

  it("clearArtifacts esvazia o vault", () => {
    makeArtifact();
    clearArtifacts();
    expect(listArtifacts()).toEqual([]);
  });
});

/* -------------------------------------------------------------- aiProtocol */

describe("aiProtocol (loop de descoberta)", () => {
  it("extrai findings + next_analysis de bloco fenced json", () => {
    const text = `## Análise\n\nResultado aqui.\n\n\`\`\`json\n{"findings":[{"title":"queda em login","confidence":0.87,"evidence":"61% negativo"}],"next_analysis":{"type":"version_comparison","rationale":"isolar a versão","parameters":{"versions":["8.1","8.2"]}}}\n\`\`\``;
    const p = parseAIResult(text);
    expect(p.findings.length).toBe(1);
    expect(p.findings[0].confidence).toBe(0.87);
    expect(p.nextAnalysis?.type).toBe("version_comparison");
    expect(p.nextAnalysis?.parameters?.versions).toEqual(["8.1", "8.2"]);
    expect(p.markdown).not.toContain("findings"); // bloco removido do markdown
    expect(p.markdown).toContain("Resultado aqui");
  });

  it("extrai JSON balanceado mesmo sem fence", () => {
    const text = `Texto antes. {"findings": [{"title": "t", "confidence": 1.4}], "next_analysis": null} texto depois`;
    const p = parseAIResult(text);
    expect(p.findings[0].confidence).toBe(1); // clamp 0..1
    expect(p.nextAnalysis).toBeNull();
  });

  it("markdown malformado/sem protocolo → resultado vazio, sem lançar", () => {
    const p = parseAIResult("## Só markdown\nsem protocolo nenhum");
    expect(p.findings).toEqual([]);
    expect(p.nextAnalysis).toBeNull();
    expect(p.markdown).toContain("Só markdown");
    expect(parseAIResult('```json\n{"quebrado": \n```').findings).toEqual([]);
    expect(extractProtocolJson("nada aqui")).toBeNull();
  });

  it("descarta findings sem título e limita a 8", () => {
    const findings = Array.from({ length: 12 }, (_, i) => ({ title: i === 3 ? "" : `f${i}`, confidence: 0.5 }));
    const p = parseAIResult(`\`\`\`json\n${JSON.stringify({ findings, next_analysis: null })}\n\`\`\``);
    expect(p.findings.length).toBeLessThanOrEqual(8);
    expect(p.findings.every((f) => f.title.length > 0)).toBe(true);
  });
});

/* ---------------------------------------------------------------- analyses */

describe("analyses catalog", () => {
  it("toda análise de IA tem buildPrompt; determinísticas não precisam", () => {
    for (const a of ANALYSES) {
      if (a.engine === "ai") expect(typeof a.buildPrompt).toBe("function");
      expect(a.basePotential).toBeGreaterThan(0);
      expect(a.basePotential).toBeLessThanOrEqual(100);
    }
  });

  it("resolveAnalysisId mapeia aliases do briefing (version_comparison etc.)", () => {
    expect(resolveAnalysisId("version_comparison")).toBe("version-impact");
    expect(resolveAnalysisId("geographic")).toBe("geo-split");
    expect(resolveAnalysisId("topic-extraction")).toBe("topic-extraction");
    expect(resolveAnalysisId("análise inexistente xyz")).toBeNull();
  });

  it("prompts de IA incluem fatos, digest upstream e o protocolo", () => {
    const spec = getAnalysis("what-changed")!;
    const prompt = spec.buildPrompt!({ factsMarkdown: "FATOS AQUI", upstreamDigest: "DIGEST AQUI" });
    expect(prompt).toContain("FATOS AQUI");
    expect(prompt).toContain("DIGEST AQUI");
    expect(prompt).toContain("next_analysis");
  });

  it("evidence reflete disponibilidade de dados (versões, datas, países)", () => {
    const withVersion = [makeEntry("a", "A", Array.from({ length: 10 }, () => review({ version: "1.0" })))];
    const withoutVersion = [makeEntry("a", "A", Array.from({ length: 10 }, () => review({ version: undefined })))];
    const vi = getAnalysis("version-impact")!;
    expect(vi.evidence(withVersion)).toBe(100);
    expect(vi.evidence(withoutVersion)).toBe(0);
  });
});
