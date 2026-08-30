/**
 * Runner — executa análises (determinísticas e IA) e o LOOP DE DESCOBERTA.
 *
 * Determinístico: computa fatos/anomalias e grava artefato (síncrono).
 * IA: monta o contexto em camadas (FATOS + digest dos artefatos upstream +
 * parâmetros do next_analysis), streama via experiment-analyze, faz parse do
 * protocolo (findings + next_analysis) e grava o artefato com lineage.
 *
 * Loop de descoberta (runDiscoveryLoop):
 *   orquestrador escolhe a análise mais quente → executa → se a IA pedir
 *   `next_analysis`, o orquestrador resolve e executa → re-pontua → repete.
 *   Para quando nenhuma análise justifica o custo (ou no limite de iterações).
 */
import type { DatasetEntry } from "@/lib/datasetStore";
import { entryKey } from "@/lib/dashboardAnalytics";
import { getAISettings, isAIEnabled } from "@/lib/aiSettings";
import { streamExperimentChat } from "@/lib/experimentChatApi";
import { recordGeneration } from "@/lib/sessionStore";
import { computeFacts, factsToMarkdown, type ComputedFacts } from "./facts";
import { detectAnomalies } from "./anomalies";
import { getAnalysis, resolveAnalysisId, type AnalysisSpec } from "./analyses";
import { parseAIResult } from "./aiProtocol";
import { pickNext, scoreAnalyses } from "./orchestrator";
import { saveArtifact, listArtifacts } from "./artifactStore";
import type { NextAnalysisRequest, PipelineArtifact } from "./types";

/* ----------------------------------------------------------------- eventos */

export type LoopEvent =
  | { type: "pick"; analysisId: string; label: string; priority: number }
  | { type: "start"; analysisId: string; label: string; engine: string }
  | { type: "artifact"; artifact: PipelineArtifact }
  | { type: "next-request"; from: string; request: NextAnalysisRequest; resolved: string | null }
  | { type: "skip"; reason: string }
  | { type: "error"; analysisId: string; message: string }
  | { type: "done"; iterations: number; reason: string };

export interface RunHandlers {
  onToken?: (full: string) => void;
  onEvent?: (e: LoopEvent) => void;
  signal?: AbortSignal;
  parameters?: Record<string, unknown>;
}

/* ------------------------------------------------------------ contexto IA */

function latestByKind(artifacts: PipelineArtifact[], kind: string): PipelineArtifact | undefined {
  return artifacts.find((a) => a.kind === kind); // listArtifacts já vem newest-first
}

function appNameMap(entries: DatasetEntry[]): Record<string, string> {
  return Object.fromEntries(entries.map((e) => [entryKey(e.app.store, e.app.id), e.app.name]));
}

/** Markdown dos fatos: reusa o artefato "facts" mais recente se existir,
 *  senão computa na hora (barato, determinístico). */
function factsContext(entries: DatasetEntry[], artifacts: PipelineArtifact[]): { facts: ComputedFacts; markdown: string } {
  const facts = computeFacts(entries);
  const existing = latestByKind(artifacts, "facts");
  return { facts, markdown: existing?.markdown ?? factsToMarkdown(facts, appNameMap(entries)) };
}

/** Digest dos artefatos upstream: lista do que JÁ FOI FEITO (para a IA não
 *  pedir repetição) + resumos das camadas consumidas por esta análise. */
function upstreamDigest(spec: AnalysisSpec, artifacts: PipelineArtifact[]): { digest: string; inputIds: string[] } {
  const done = artifacts.map((a) => `- ${a.methodology.replace(":", " · ")} — "${a.title}"`);
  const sections: string[] = [];
  if (done.length > 0) {
    sections.push(`ANÁLISES JÁ REALIZADAS (não peça repetição):\n${done.slice(0, 15).join("\n")}`);
  }
  const inputIds: string[] = [];
  for (const kind of spec.consumes) {
    const art = latestByKind(artifacts, kind);
    if (!art) continue;
    inputIds.push(art.id);
    const body = (art.markdown ?? "").slice(0, 1500);
    if (body) sections.push(`### Camada "${art.title}" (${art.methodology})\n${body}`);
    if (art.data?.anomalies?.length) {
      sections.push(
        `### Anomalias detectadas (determinísticas)\n` +
        art.data.anomalies.map((an) => `- [${an.severity}] ${an.title} — ${an.detail}`).join("\n"),
      );
    }
  }
  return { digest: sections.join("\n\n"), inputIds };
}

/* ---------------------------------------------------------- determinístico */

function factsDetailMarkdown(specId: string, facts: ComputedFacts, names: Record<string, string>): string {
  if (specId === "version-impact") {
    const lines = ["## Impacto por versão (determinístico)", ""];
    for (const [appKey, vs] of Object.entries(facts.perAppVersions)) {
      if (vs.length === 0) continue;
      lines.push(`### ${names[appKey] ?? appKey}`);
      lines.push("");
      lines.push("| Versão | Reviews | Nota média | % Negativo |");
      lines.push("|---|---|---|---|");
      for (const v of vs) lines.push(`| v${v.version} | ${v.count} | ${v.avgRating} | ${v.negativePct}% |`);
      lines.push("");
    }
    if (lines.length <= 2) lines.push("Nenhum review com campo de versão no escopo.");
    return lines.join("\n");
  }
  if (specId === "temporal-trends") {
    const lines = ["## Tendências temporais (determinístico)", ""];
    if (facts.timeline.length === 0) return lines.join("\n") + "Dados insuficientes com data.";
    lines.push("| Mês | Reviews | Nota média |");
    lines.push("|---|---|---|");
    for (const m of facts.timeline) lines.push(`| ${m.month} | ${m.count} | ${m.avgRating} |`);
    const counts = facts.timeline.map((m) => m.count);
    const first = counts[0], last = counts[counts.length - 1];
    if (counts.length > 1 && first > 0) {
      lines.push("");
      lines.push(`Crescimento do volume: ${first} → ${last} reviews/mês (${Math.round(((last - first) / first) * 100)}%).`);
    }
    return lines.join("\n");
  }
  if (specId === "geo-split") {
    const lines = ["## Segmentação geográfica (determinístico)", ""];
    if (facts.countries.length === 0) return lines.join("\n") + "Nenhum review com país no escopo.";
    lines.push("| País | Reviews | Nota média | % Negativo |");
    lines.push("|---|---|---|---|");
    for (const c of facts.countries) lines.push(`| ${c.country} | ${c.count} | ${c.avgRating} | ${c.negativePct}% |`);
    return lines.join("\n");
  }
  if (specId === "term-frequency") {
    const lines = ["## Frequência de termos (determinístico)", ""];
    if (facts.topTerms.length === 0) return lines.join("\n") + "Sem termos suficientes.";
    lines.push("| Termo | Menções |");
    lines.push("|---|---|");
    for (const [t, n] of facts.topTerms) lines.push(`| ${t} | ${n} |`);
    return lines.join("\n");
  }
  return factsToMarkdown(facts, names);
}

/** Executa uma análise determinística (síncrona) e grava o artefato. */
export function runDeterministic(
  spec: AnalysisSpec,
  entries: DatasetEntry[],
  artifacts: PipelineArtifact[],
): PipelineArtifact {
  const facts = computeFacts(entries);
  const names = appNameMap(entries);
  const inputIds = spec.consumes
    .map((k) => latestByKind(artifacts, k)?.id)
    .filter((x): x is string => !!x);

  if (spec.id === "anomaly-scan") {
    const anomalies = detectAnomalies(entries, facts);
    const md = ["## Varredura de anomalias (determinístico)", ""];
    if (anomalies.length === 0) {
      md.push("Nenhuma anomalia detectada com os limiares atuais — o conjunto está estável.");
    } else {
      for (const an of anomalies) {
        md.push(`### [${an.severity.toUpperCase()}] ${an.title}`);
        md.push(an.detail);
        if (an.reviewIds.length > 0) md.push(`Evidência: ${an.reviewIds.length} reviews vinculados (lineage).`);
        md.push("");
      }
    }
    return saveArtifact({
      kind: "anomaly",
      stage: "compute",
      title: anomalies.length > 0 ? `${anomalies.length} anomalia(s) detectada(s)` : "Varredura de anomalias",
      methodology: `deterministic:${spec.id}`,
      engine: "deterministic",
      inputIds,
      appKeys: facts.scope.appKeys,
      data: { anomalies },
      markdown: md.join("\n"),
      confidence: "alta",
    });
  }

  const md = spec.id === "facts-overview"
    ? factsToMarkdown(facts, names)
    : factsDetailMarkdown(spec.id, facts, names);
  return saveArtifact({
    kind: "facts",
    stage: "compute",
    title: spec.label,
    methodology: `deterministic:${spec.id}`,
    engine: "deterministic",
    inputIds,
    appKeys: facts.scope.appKeys,
    data: { facts: spec.id === "facts-overview" ? facts : undefined },
    markdown: md,
    confidence: "alta",
  });
}

/* -------------------------------------------------------------------- IA */

/** Executa uma análise de IA (stream) e grava o artefato com findings +
 *  next_analysis parseados do protocolo. Retorna null em erro/abort. */
export async function runAIAnalysis(
  spec: AnalysisSpec,
  entries: DatasetEntry[],
  handlers: RunHandlers = {},
): Promise<PipelineArtifact | null> {
  const ai = getAISettings();
  if (!isAIEnabled(ai)) {
    handlers.onEvent?.({ type: "error", analysisId: spec.id, message: "IA desativada — ative em Configurações." });
    return null;
  }
  if (!spec.buildPrompt) return null;

  const artifacts = listArtifacts();
  const { markdown: factsMd } = factsContext(entries, artifacts);
  const { digest, inputIds } = upstreamDigest(spec, artifacts);
  const paramsBlock = handlers.parameters && Object.keys(handlers.parameters).length > 0
    ? `\n\nPARÂMETROS DESTA EXECUÇÃO (pedidos pelo estágio anterior):\n${JSON.stringify(handlers.parameters)}`
    : "";
  const prompt = spec.buildPrompt({ factsMarkdown: factsMd, upstreamDigest: digest, parameters: handlers.parameters }) + paramsBlock;

  const result = await new Promise<string | null>((resolve) => {
    let full = "";
    streamExperimentChat(
      entries,
      [{ role: "user", content: prompt }],
      {
        onToken: (t) => { full = t; handlers.onToken?.(t); },
        onDone: (t) => resolve(t),
        onError: (err) => {
          handlers.onEvent?.({ type: "error", analysisId: spec.id, message: err });
          resolve(null);
        },
      },
      handlers.signal,
      ai,
      "custom",
    );
  });
  if (result === null) return null;

  const parsed = parseAIResult(result);
  const model = ai.mode === "local" || ai.mode === "auto" ? ai.local.model : ai.cloud.model;
  const artifact = saveArtifact({
    kind: spec.kind,
    stage: spec.stage,
    title: spec.label,
    methodology: `ai:${spec.id}`,
    engine: "ai",
    model,
    inputIds,
    appKeys: entries.map((e) => entryKey(e.app.store, e.app.id)),
    data: { findings: parsed.findings, nextAnalysis: parsed.nextAnalysis },
    markdown: parsed.markdown,
    confidence: parsed.findings.length > 0
      ? (parsed.findings[0].confidence >= 0.75 ? "alta" : parsed.findings[0].confidence >= 0.5 ? "média" : "baixa")
      : undefined,
  });

  recordGeneration({
    type: "ai-section",
    title: `Pipeline · ${spec.label}`,
    appKeys: artifact.appKeys,
    markdown: parsed.markdown,
    summary: parsed.findings[0]?.title ?? spec.description,
    source: "pipeline",
  });

  return artifact;
}

/** Despacha pelo motor certo. */
export async function runAnalysis(
  spec: AnalysisSpec,
  entries: DatasetEntry[],
  handlers: RunHandlers = {},
): Promise<PipelineArtifact | null> {
  if (spec.engine === "deterministic") {
    return runDeterministic(spec, entries, listArtifacts());
  }
  return runAIAnalysis(spec, entries, handlers);
}

/**
 * Reanálise de um artefato (o "reanalisar/regenerar" do ciclo de uso):
 * descobre a análise de origem pela methodology (`deterministic:<id>` ou
 * `ai:<id>`) e reexecuta sobre os dados ATUAIS — com os mesmos inputs do
 * artefato original (lineage preservada). Retorna o novo artefato ou null
 * se a análise de origem não existe mais (removida do catálogo).
 */
export async function reanalyzeArtifact(
  artifact: PipelineArtifact,
  entries: DatasetEntry[],
  handlers: RunHandlers = {},
): Promise<PipelineArtifact | null> {
  const analysisId = artifact.methodology.split(":").pop() ?? "";
  const spec = getAnalysis(analysisId) ?? getAnalysis(resolveAnalysisId(analysisId) ?? "");
  if (!spec) return null;
  return runAnalysis(spec, entries, handlers);
}

/* ------------------------------------------------------- loop de descoberta */

export interface LoopOptions extends RunHandlers {
  maxIterations?: number;
  /** Análise inicial forçada (quando o usuário manda começar por uma). */
  seedAnalysisId?: string;
}

/**
 * Loop de descoberta autônomo:
 *   1. Orquestrador pontua o catálogo → escolhe a análise mais quente.
 *   2. Executa (determinística ou IA).
 *   3. Se a IA pedir `next_analysis` e ela existir e ainda não rodou → executa.
 *   4. Re-pontua (artefatos novos mudam os scores) e repete.
 *   5. Para quando nada mais justifica o custo, ou no limite de iterações.
 */
export async function runDiscoveryLoop(
  entries: DatasetEntry[],
  opts: LoopOptions = {},
): Promise<{ iterations: number; reason: string }> {
  const max = opts.maxIterations ?? 6;
  const emit = opts.onEvent ?? (() => {});
  let iterations = 0;
  let queuedFromAI: { id: string; parameters?: Record<string, unknown> } | null = null;
  if (opts.seedAnalysisId) queuedFromAI = { id: opts.seedAnalysisId };

  while (iterations < max) {
    if (opts.signal?.aborted) {
      const reason = "interrompido pelo usuário";
      emit({ type: "done", iterations, reason });
      return { iterations, reason };
    }

    const artifacts = listArtifacts();
    const facts = computeFacts(entries);
    const anomalies = detectAnomalies(entries, facts);

    // Escolha da próxima análise: pedido da IA tem precedência, senão o score.
    let spec: AnalysisSpec | undefined;
    let parameters: Record<string, unknown> | undefined;
    if (queuedFromAI) {
      spec = getAnalysis(queuedFromAI.id);
      parameters = queuedFromAI.parameters;
      queuedFromAI = null;
      if (spec && artifacts.some((a) => a.methodology === `${spec!.engine}:${spec!.id}`)) {
        emit({ type: "skip", reason: `"${spec.label}" já foi executada — pedido da IA ignorado` });
        spec = undefined;
      }
    }
    if (!spec) {
      const scores = scoreAnalyses(entries, artifacts, anomalies);
      const next = pickNext(scores);
      if (!next) {
        const reason = "nenhuma análise restante gera informação suficiente para justificar o custo";
        emit({ type: "done", iterations, reason });
        return { iterations, reason };
      }
      emit({ type: "pick", analysisId: next.analysis.id, label: next.analysis.label, priority: next.priority });
      spec = next.analysis;
    }

    emit({ type: "start", analysisId: spec.id, label: spec.label, engine: spec.engine });
    const artifact = await runAnalysis(spec, entries, { ...opts, parameters });
    if (!artifact) {
      const reason = `falha ao executar "${spec.label}"`;
      emit({ type: "done", iterations, reason });
      return { iterations, reason };
    }
    iterations++;
    emit({ type: "artifact", artifact });

    // A IA pediu uma nova análise? (o pipeline "volta" — grafo, não linha)
    const nextReq = artifact.data?.nextAnalysis;
    if (nextReq) {
      const resolved = resolveAnalysisId(nextReq.type);
      emit({ type: "next-request", from: spec.label, request: nextReq, resolved });
      if (resolved) queuedFromAI = { id: resolved, parameters: nextReq.parameters };
    }
  }

  const reason = `limite de ${max} iterações atingido`;
  emit({ type: "done", iterations, reason });
  return { iterations, reason };
}
