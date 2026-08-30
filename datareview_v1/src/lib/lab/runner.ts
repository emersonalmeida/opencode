/**
 * Lab runner — executa um experimento usando as capacidades de IA existentes
 * (experiment-analyze, seção "lab-structured") e processa o output estruturado:
 * parseia JSON, valida evidências contra o dataset, cria LabFindings e atualiza
 * o experimento com provenance.
 *
 * Não duplica o mecanismo de IA — apenas orquestra streamExperimentChat e pós-
 * processa o resultado estruturado.
 */

import type { DatasetEntry } from "@/lib/datasetStore";
import { entryKey } from "@/context/SelectionContext";
import { streamExperimentChat, type ChatMessage } from "@/lib/experimentChatApi";
import { getAISettings, isAIEnabled, type AISettings } from "@/lib/aiSettings";
import {
  getExperiment,
  saveExperiment,
  saveFinding,
  newFinding,
  deleteFinding,
  listFindingsByExperiment,
  listLabDatasets,
  newProductCandidate,
  saveProductCandidate,
} from "./repository";
import { annotateFinding, validateStructuredFindings } from "./validation";
import { computeOpportunityScore } from "./scoring";
import type {
  LabExperiment,
  LabFinding,
  LabFindingType,
  ExperimentStructuredResult,
  StructuredFinding,
  ProductCandidate,
  ProductScores,
} from "./types";

/** Extrai o primeiro bloco JSON da resposta (tolerante a markdown ao redor). */
export function parseStructuredResult(raw: string): ExperimentStructuredResult | null {
  if (!raw) return null;
  // Tenta JSON direto
  try {
    return normalizeResult(JSON.parse(raw));
  } catch {
    /* fall through */
  }
  // Tenta extrair bloco ```json ... ```
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      return normalizeResult(JSON.parse(fenceMatch[1].trim()));
    } catch {
      /* fall through */
    }
  }
  // Tenta encontrar o primeiro { ... } balanceado
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return normalizeResult(JSON.parse(raw.slice(start, end + 1)));
    } catch {
      /* give up */
    }
  }
  return null;
}

function normalizeResult(parsed: unknown): ExperimentStructuredResult {
  const p = (parsed || {}) as Record<string, unknown>;
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [];
  const metrics = (v: unknown): Record<string, number | string> => {
    if (v && typeof v === "object") {
      const m: Record<string, number | string> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        if (typeof val === "number" || typeof val === "string") m[k] = val;
      }
      return m;
    }
    return {};
  };
  return {
    summary: typeof p.summary === "string" ? p.summary : undefined,
    observed: arr(p.observed),
    inferred: arr(p.inferred),
    estimated: arr(p.estimated),
    metrics: metrics(p.metrics),
    findings: Array.isArray(p.findings)
      ? (p.findings as StructuredFinding[])
          .filter((f) => f && typeof f.title === "string" && f.title.trim().length > 0)
          .map((f) => ({
            title: String(f.title),
            description: String(f.description ?? ""),
            type: (f.type as LabFindingType) || "observation",
            confidence: typeof f.confidence === "number" ? f.confidence : undefined,
            evidence: Array.isArray(f.evidence) ? f.evidence : [],
          }))
      : [],
  };
}

export interface RunOptions {
  /** Hypothesis/question to send as the user message. */
  prompt?: string;
  ai?: AISettings;
  onToken?: (full: string) => void;
  signal?: AbortSignal;
}

/**
 * Executa um experimento do Lab:
 *  1. Resolve os appKeys do experimento (dos LabDatasets referenciados).
 *  2. Envia à IA (seção "lab-structured") com a hipótese como user message.
 *  3. Parseia o JSON estruturado.
 *  4. Valida evidências contra o dataset (reviewId/quote reais).
 *  5. Cria LabFindings a partir dos findings estruturados (com validação).
 *  6. Atualiza o experimento: status, result, structuredResult, provenance.
 *
 * Retorna o experimento atualizado. Lança erro se a IA falhar.
 */
export async function runExperiment(
  experimentId: string,
  dataset: DatasetEntry[],
  opts: RunOptions = {},
): Promise<LabExperiment> {
  const ai = opts.ai ?? getAISettings();
  if (!isAIEnabled(ai)) {
    throw new Error("IA não configurada. Ative em Configurações → Inteligência Artificial.");
  }
  const exp = getExperiment(experimentId);
  if (!exp) throw new Error("Experimento não encontrado");

  const appKeys = resolveAppKeys(exp, dataset);
  if (appKeys.length === 0) {
    throw new Error("Nenhum app no dataset do experimento. Selecione apps ou um dataset.");
  }

  // Filtra DatasetEntry pelos appKeys do experimento
  const scoped = dataset.filter((e) =>
    appKeys.includes(entryKey(e.app.store, e.app.id)),
  );

  // Hipótese/pergunta → user message
  const promptText = opts.prompt?.trim() || buildDefaultPrompt(exp);
  const messages: ChatMessage[] = [{ role: "user", content: promptText }];

  // Marca como running + registra provenance inicial
  saveExperiment({
    ...exp,
    status: "running",
    provenance: {
      datasetIds: exp.datasetIds,
      appKeys,
      ai: {
        provider: ai.mode === "cloud" ? ai.cloud.provider : "local",
        model: ai.mode === "cloud" ? ai.cloud.model : ai.local.model,
        promptVersion: "lab-structured-v1",
      },
      executedAt: new Date().toISOString(),
    },
  });

  let raw = "";
  let errMsg = "";
  await streamExperimentChat(scoped, messages, {
    onToken: (full) => {
      raw = full;
      opts.onToken?.(full);
    },
    onDone: (full) => {
      raw = full;
    },
    onError: (err) => {
      errMsg = err;
    },
  }, opts.signal, ai, "lab-structured");

  if (errMsg) throw new Error(errMsg);

  const structured = parseStructuredResult(raw);
  // Remove findings antigos deste experimento antes de recriar
  for (const old of listFindingsByExperiment(experimentId)) {
    deleteFinding(old.id);
  }
  const newFindingIds: string[] = [];
  if (structured?.findings?.length) {
    // Validação de evidências estruturadas (para reporting)
    validateStructuredFindings(structured.findings, scoped);
    for (const sf of structured.findings) {
      const finding = newFinding({
        title: sf.title,
        description: sf.description,
        experimentId,
        type: sf.type || "observation",
        confidence: sf.confidence,
        evidence: {
          reviewIds: sf.evidence?.map((e) => e.reviewId).filter(Boolean) as string[],
          appKeys: sf.evidence?.map((e) => e.appKey).filter(Boolean) as string[],
          quotes: sf.evidence?.map((e) => e.quote).filter(Boolean) as string[],
        },
      });
      // Anota validação (review existe? quote bate?)
      const annotated = annotateFinding(finding, scoped);
      const saved = saveFinding(annotated);
      newFindingIds.push(saved.id);
    }
  }

  const updated = saveExperiment({
    ...exp,
    status: "completed",
    result: raw,
    structuredResult: structured ?? undefined,
    findings: newFindingIds,
    metrics: structured?.metrics,
    conclusion: structured?.summary,
    provenance: {
      datasetIds: exp.datasetIds,
      appKeys,
      ai: {
        provider: ai.mode === "cloud" ? ai.cloud.provider : "local",
        model: ai.mode === "cloud" ? ai.cloud.model : ai.local.model,
        promptVersion: "lab-structured-v1",
      },
      executedAt: new Date().toISOString(),
    },
  });
  return updated;
}

/** Resolve appKeys: dos LabDatasets referenciados, ou fallback para todos. */
function resolveAppKeys(exp: LabExperiment, dataset: DatasetEntry[]): string[] {
  const labDatasets = listLabDatasets();
  const referenced = labDatasets.filter((d) => exp.datasetIds.includes(d.id));
  const keys = new Set<string>();
  for (const d of referenced) {
    for (const k of d.appKeys) keys.add(k);
  }
  // Se nenhum LabDataset referenciado, usa todos os apps do dataset principal
  if (keys.size === 0) {
    for (const e of dataset) keys.add(entryKey(e.app.store, e.app.id));
  }
  return [...keys];
}

function buildDefaultPrompt(exp: LabExperiment): string {
  const parts: string[] = [];
  if (exp.hypothesis) parts.push(`HIPÓTESE: ${exp.hypothesis}`);
  if (exp.question) parts.push(`PERGUNTA: ${exp.question}`);
  if (exp.description) parts.push(`CONTEXTO: ${exp.description}`);
  if (parts.length === 0) parts.push("Analise o dataset e reporte os findings principais com evidências.");
  parts.push(
    'Retorne SOMENTE o JSON estruturado conforme o schema (summary, observed, inferred, estimated, metrics, findings com evidence usando reviewId real).',
  );
  return parts.join("\n\n");
}

/** Promove um experimento validado para ProductCandidate. */
export function promoteExperiment(
  experimentId: string,
  partial: { name?: string; vertical?: string; problem?: string },
): ProductCandidate {
  const exp = getExperiment(experimentId);
  if (!exp) throw new Error("Experimento não encontrado");
  const findingIds = listFindingsByExperiment(experimentId).map((f) => f.id);
  const product = newProductCandidate({
    name: partial.name || exp.name,
    vertical: partial.vertical,
    problem:
      partial.problem ||
      exp.conclusion ||
      exp.hypothesis ||
      "Produto derivado de experimento validado.",
    evidence: {
      experimentIds: [experimentId],
      findingIds,
      datasetIds: exp.datasetIds,
    },
    status: "idea",
  });
  const saved = saveProductCandidate(product);
  // Marca o experimento como promovido (preserva histórico)
  saveExperiment({ ...exp, status: "promote" });
  return saved;
}

/** Recomputa o Opportunity Score a partir das dimensões. */
export function recomputeScore(scores?: ProductScores): number | undefined {
  return computeOpportunityScore(scores);
}
