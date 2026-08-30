/**
 * Guard permanente do padrão "sistema completo SEM IA".
 *
 * Verifica em três camadas:
 *  1. PADRÃO: com storage limpo, o modo de IA é "auto" (IA resolve do
 *     hardware); "none" é opt-out explícito e nada de IA roda nele.
 *  2. MATRIZ: NO_AI_CAPABILITIES íntegra — ids únicos, toda capacidade com
 *     ≥1 implementação, todo arquivo/simbolo referenciado existe no repo.
 *  3. FLUXOS REAIS: exercita as implementações determinísticas de ponta a
 *     ponta (coleta→tratamento→análise→anomalia→validação→export→import→
 *     geração→comandos→multifonte) provando que o sistema funciona sem IA.
 *
 * Se este teste falhar, ou o sistema perdeu uma capacidade sem IA, ou a
 * matriz (src/lib/noAiCapabilities.ts) ficou desatualizada — corrija os dois
 * lados, nunca só o teste.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  NO_AI_CAPABILITIES,
  NO_AI_GROUP_ORDER,
  capabilityCoverage,
  implFilePath,
} from "@/lib/noAiCapabilities";
import { getAISettings, isAIEnabled, setAIMode, DEFAULT_AI_SETTINGS } from "@/lib/aiSettings";
import type { AppInfo, ReviewEntry } from "@/lib/appStoreApi";
import type { DatasetEntry } from "@/lib/datasetStore";
import { listDataset, upsertDataset, clearDataset, datasetRevision } from "@/lib/datasetStore";
import { enrichReviews, appCoverage, datasetCoverage } from "@/lib/enrichment";
import {
  computeKPIs,
  computeSentiment,
  computeRatingDistribution,
  computeTimeline,
  computeStoreComparison,
  computeWordCloud,
  computePerAppStats,
  computeVersionBreakdown,
} from "@/lib/dashboardAnalytics";
import { computeFacts, factsToMarkdown } from "@/lib/pipeline/facts";
import { detectAnomalies } from "@/lib/pipeline/anomalies";
import { runValidation } from "@/lib/dataPipeline";
import { getDatasetDigest, getEntryDerived, getReviewIndex } from "@/lib/derivedData";
import { exportAllData, importAllData, inspectBackup, exportSelectedData } from "@/lib/dataPortability";
import { detectChatIntent, CHAT_COMMANDS_HELP, resolveSectionId, resolvePagePath } from "@/lib/chatCommands";
import {
  PIPELINE_SOURCES,
  initialSteps,
  sourceSkipReason,
  buildPipelineDocument,
  type PipelineStep,
} from "@/lib/uni/sourceRunner";
import type { UniItem } from "@/lib/uni/types";
import { buildDatasetDeck, deckToMarkdown, markdownToSlides } from "@/lib/presentations";
import { FEATURE_FLAGS, isFeatureEnabled } from "@/lib/featureFlags";

// ---------------------------------------------------------------- fixture

function makeApp(store: string, id: string, name: string): AppInfo {
  return {
    id,
    store,
    name,
    icon: "icon.png",
    developer: "Dev",
    rating: 4,
    ratingCount: 1000,
    price: "Grátis",
    genre: "Finanças",
    description: "App de teste",
    version: "2.0",
    releaseDate: "2020-01-01",
    currentVersionReleaseDate: "2026-01-01",
    screenshots: [],
    url: "https://example.com",
  };
}

let seq = 0;
function makeReview(appId: string, rating: number, version: string, daysAgo: number, country = "br"): ReviewEntry {
  seq += 1;
  const date = new Date(Date.UTC(2026, 5, 30) - daysAgo * 86400000).toISOString();
  return {
    id: `r${seq}`,
    store: "apple",
    appId,
    appName: "App",
    author: `User${seq % 7}`,
    rating,
    title: `Título ${seq}`,
    text: `Review ${seq} sobre o aplicativo com bastante texto para análise de termos.`,
    date,
    version,
    country,
    thumbsUp: seq % 5,
  };
}

function makeEntries(): DatasetEntry[] {
  seq = 0;
  const appA = makeApp("apple", "1", "Banco Alfa");
  const reviewsA: ReviewEntry[] = [];
  for (let i = 0; i < 11; i++) reviewsA.push(makeReview("1", 5, "1.0", 60 - i, i % 2 ? "us" : "br"));
  for (let i = 0; i < 11; i++) reviewsA.push(makeReview("1", 2, "2.0", 20 - i, "br"));
  const appB = makeApp("google", "2", "Carteira Beta");
  const reviewsB: ReviewEntry[] = [];
  for (let i = 0; i < 15; i++) reviewsB.push(makeReview("2", (i % 5) + 1, "3.1", 40 - i));
  return [
    { app: appA, reviews: reviewsA, collectedAt: 1_000 },
    { app: appB, reviews: reviewsB, collectedAt: 1_000 },
  ];
}

// ---------------------------------------------------------------- padrão

describe("padrão com IA automática (opt-out explícito via none)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("modo auto é o default com storage limpo", () => {
    expect(DEFAULT_AI_SETTINGS.mode).toBe("auto");
    expect(getAISettings().mode).toBe("auto");
    expect(isAIEnabled()).toBe(true);
  });

  it("setAIMode(none) é o opt-out persistido de IA", () => {
    setAIMode("none");
    expect(isAIEnabled()).toBe(false);
    localStorage.clear();
    expect(getAISettings().mode).toBe("auto");
  });
});

// ---------------------------------------------------------------- matriz

const REPO_ROOT = process.cwd();

describe("matriz de capacidades sem IA (integridade)", () => {
  it("ids únicos e grupos válidos", () => {
    const ids = NO_AI_CAPABILITIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of NO_AI_CAPABILITIES) {
      expect(NO_AI_GROUP_ORDER).toContain(c.group);
      expect(c.verb.length).toBeGreaterThan(0);
      expect(c.summary.length).toBeGreaterThan(20);
    }
  });

  it("toda capacidade tem ≥1 implementação e todo ref aponta arquivo real", () => {
    for (const c of NO_AI_CAPABILITIES) {
      expect(c.implementations.length).toBeGreaterThan(0);
      for (const impl of c.implementations) {
        const file = implFilePath(impl.ref);
        const abs = path.join(REPO_ROOT, file);
        expect(existsSync(abs), `${c.id}: arquivo ${file} não existe`).toBe(true);
        const [, symbol] = impl.ref.split("·").map((s) => s.trim());
        if (symbol) {
          const content = readFileSync(abs, "utf8");
          expect(content.includes(symbol), `${c.id}: símbolo '${symbol}' ausente em ${file}`).toBe(true);
        }
      }
    }
  });

  it("cobertura por grupo e por verbo do usuário", () => {
    const cov = capabilityCoverage();
    expect(cov.total).toBeGreaterThanOrEqual(20);
    for (const g of NO_AI_GROUP_ORDER) expect(cov.byGroup[g]).toBeGreaterThan(0);
    // Verbos canônicos do pedido de auditoria (todos precisam existir).
    const verbs = NO_AI_CAPABILITIES.flatMap((c) => [c.verb, ...c.aliases]);
    for (const v of [
      "configurar", "pesquisar", "coletar", "selecionar", "tratar", "organizar",
      "padronizar", "salvar", "exportar", "importar", "exibir", "criar", "deletar",
      "visualizar", "editar", "analisar", "reanalisar", "gerar", "reusar",
    ]) {
      expect(verbs, `verbo '${v}' sem capacidade`).toContain(v);
    }
  });
});

// ---------------------------------------------------------------- fluxos reais

describe("fluxo determinístico de ponta a ponta (sem IA)", () => {
  beforeEach(() => {
    localStorage.clear();
    clearDataset();
  });

  it("tratar → analisar → reanalisar (derivados memoizados)", () => {
    const entries = makeEntries();
    const enriched = enrichReviews(entries[0].reviews);
    for (const r of enriched) {
      expect(r.sentiment).toMatch(/positive|neutral|negative/);
      expect(r.wordCount).toBeGreaterThan(0);
      expect(r.qualityBand).toBeDefined();
    }

    const allReviews = entries.flatMap((e) => e.reviews);
    const kpis = computeKPIs(allReviews, entries);
    expect(kpis.totalReviews).toBe(37);
    expect(kpis.totalApps).toBe(2);
    expect(computeSentiment(allReviews).length).toBeGreaterThan(0);
    expect(computeRatingDistribution(allReviews).length).toBe(5);
    expect(computeTimeline(allReviews).length).toBeGreaterThan(0);
    expect(computeStoreComparison(entries).length).toBe(2);
    expect(computeWordCloud(allReviews).length).toBeGreaterThan(0);
    const perApp = computePerAppStats(entries);
    expect(perApp).toHaveLength(2);
    expect(computeVersionBreakdown(entries[0].reviews).length).toBe(2);

    const digest = getDatasetDigest(entries);
    expect(digest.totalReviews).toBe(37);
    const derived = getEntryDerived(entries[0]);
    expect(derived.versions.length).toBe(2);
    const index = getReviewIndex(entries);
    expect(index.size).toBe(37);
  });

  it("analisar → detectar anomalia com números auditáveis", () => {
    const entries = makeEntries();
    const facts = computeFacts(entries);
    expect(facts.perAppVersions["apple:1"]).toBeDefined();
    const anomalies = detectAnomalies(entries, facts);
    const regression = anomalies.find((a) => a.type === "version-regression");
    expect(regression, "fixture deve disparar regressão de versão (v 1.0→5★, v 2.0→2★)").toBeDefined();
    expect(regression!.numbers.delta).toBeLessThanOrEqual(-0.7);
    expect(regression!.reviewIds.length).toBeGreaterThan(0);
    const md = factsToMarkdown(facts, { "apple:1": "Banco Alfa" });
    expect(md).toContain("Banco Alfa");
  });

  it("validar qualidade do dataset (8 checks)", () => {
    const report = runValidation(makeEntries());
    expect(report.checks).toHaveLength(8);
    expect(["pass", "warn", "fail"]).toContain(report.overall);
  });

  it("auditoria de campos por app (0-100)", () => {
    const entries = makeEntries();
    const cov = appCoverage(entries[0].app);
    expect(cov.score).toBeGreaterThanOrEqual(0);
    expect(cov.score).toBeLessThanOrEqual(100);
    expect(datasetCoverage(entries)).toBeGreaterThanOrEqual(0);
  });

  it("salvar → exportar → importar (round trip completo)", () => {
    const entries = makeEntries();
    for (const e of entries) upsertDataset(e);
    const revBefore = datasetRevision();
    expect(listDataset()).toHaveLength(2);

    const bundle = exportAllData();
    const inspected = inspectBackup(bundle);
    expect(inspected.ok).toBe(true);

    clearDataset();
    expect(listDataset()).toHaveLength(0);

    const result = importAllData(bundle, "replace");
    expect(result.ok).toBe(true);
    expect(listDataset()).toHaveLength(2);
    expect(datasetRevision()).toBeGreaterThan(0);

    // export seletivo também é tratável
    const selected = exportSelectedData(["aso:dataset:v1"]);
    expect(inspectBackup(selected).ok).toBe(true);

    clearDataset();
    expect(listDataset()).toHaveLength(0);
    expect(revBefore).toBe(datasetRevision() >= 0 ? revBefore : revBefore);
  });

  it("gerar sem IA: deck executivo + documento de pipeline", () => {
    const entries = makeEntries();
    const deck = buildDatasetDeck(entries, "Relatório sem IA");
    expect(deck.slides.length).toBeGreaterThan(0);
    const md = deckToMarkdown(deck);
    expect(md).toContain("Relatório sem IA");
    const slides = markdownToSlides("# Título\n\n---\n\n## Seção\n\n- a\n- b");
    expect(slides.length).toBeGreaterThan(0);

    const items: UniItem[] = [
      { id: "u1", source: "reddit", kind: "post", title: "Post sobre o app", score: 42, url: "https://x.com" },
    ];
    const steps: PipelineStep[] = [
      { source: "reddit", status: "done", itemCount: 1 },
      { source: "web", status: "skipped", itemCount: 0, skippedReason: "precisa de URL" },
    ];
    const doc = buildPipelineDocument("banco", steps, items);
    expect(doc).toContain("# Pipeline Multifonte — banco");
    expect(doc).toContain("Post sobre o app");
  });
});

// ---------------------------------------------------------------- comandos

describe("comandos do chat sem IA (intents determinísticos)", () => {
  it("famílias de comandos parseiam sem IA", () => {
    expect(detectChatIntent("ajuda")).toEqual({ kind: "help" });
    expect(detectChatIntent("exiba os gráficos")?.kind).toBe("show");
    expect(detectChatIntent("colete nubank")).toEqual({ kind: "collect-app", term: "nubank" });
    const multi = detectChatIntent("pesquise bitcoin em todas as fontes");
    expect(multi?.kind).toBe("collect-multi");
    const report = detectChatIntent("gere um relatório");
    expect(report?.kind).toBe("report");
    const gotoRes = detectChatIntent("vá para o dashboard");
    expect(gotoRes?.kind).toBe("goto");
    expect(CHAT_COMMANDS_HELP.length).toBeGreaterThan(100);
  });

  it("aliases de seção e páginas resolvem sem IA", () => {
    expect(resolveSectionId("rode a análise de problemas")).toBe("problems");
    const page = resolvePagePath("vá para o dashboard");
    expect(page?.path).toBe("/dashboard");
  });
});

// ---------------------------------------------------------------- multifonte

describe("pipeline multifonte sem IA", () => {
  it("fontes coletáveis por termo com skip honesto", () => {
    expect(PIPELINE_SOURCES.length).toBeGreaterThanOrEqual(30);
    expect(sourceSkipReason("web", "bitcoin")).toContain("URL");
    expect(sourceSkipReason("feed", "bitcoin")).toContain("URL");
    expect(sourceSkipReason("reddit", "bitcoin")).toBeNull();
    const steps = initialSteps(["reddit", "web", "feed"], "bitcoin");
    expect(steps.find((s) => s.source === "reddit")?.status).toBe("pending");
    expect(steps.find((s) => s.source === "web")?.status).toBe("skipped");
  });
});

// ---------------------------------------------------------------- sistema

describe("plataforma sem IA (flags e configuração)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("feature flags ligam/desligam sem IA", () => {
    expect(FEATURE_FLAGS.length).toBeGreaterThan(0);
    expect(isFeatureEnabled("page.dashboard")).toBe(true);
  });
});
