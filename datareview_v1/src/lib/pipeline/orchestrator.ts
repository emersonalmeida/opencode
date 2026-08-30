/**
 * ORCHESTRATOR — o "sexto tipo de nó" do briefing.
 *
 * Ele não analisa dados: decide QUAL análise deveria acontecer agora,
 * pontuando cada candidata do catálogo em 3 dimensões:
 *
 *   Potencial  — quanta informação NOVA ela tende a gerar (base ± boosts)
 *   Evidência  — quanto dado útil existe para ela trabalhar
 *   Custo      — determinístico é barato; IA de raciocínio é cara
 *
 *   Prioridade = 0.5·potencial + 0.35·evidência + 0.15·(100 - custo)
 *
 * Regras (todas explicáveis na UI via `reasons`):
 *  - Análise já executada → potencial cai 75% (retorno decrescente).
 *  - Anomalias detectadas → impulsionam análises relacionadas (regressão de
 *    versão ↑ version-impact / what-changed / root-cause…).
 *  - Artefatos upstream presentes → bônus (input mais rico).
 *  - Artefatos upstream ausentes (para IA de estágio avançado) → penalidade
 *    leve de evidência ("depende de X").
 *
 * O loop termina quando não há mais análise "quente" (🔥) — nenhuma gera
 * informação suficiente para justificar o custo.
 */
import type { DatasetEntry } from "@/lib/datasetStore";
import type { Anomaly } from "./anomalies";
import type { PipelineArtifact } from "./types";
import { ANALYSES, type AnalysisSpec } from "./analyses";

export interface OrchestratorScore {
  analysis: AnalysisSpec;
  potential: number;   // 0-100
  evidence: number;    // 0-100
  costScore: number;   // 0-100 (100 = barato)
  priority: number;    // 0-100 ponderado
  hot: boolean;        // 🔥 — vale o custo agora
  alreadyRun: boolean;
  reasons: string[];
}

const COST_SCORE: Record<AnalysisSpec["cost"], number> = { baixo: 100, "médio": 70, alto: 40 };

const clamp100 = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Boosts de potencial disparados por anomalias (análise → [tipo, boost]). */
const ANOMALY_BOOSTS: Record<string, Partial<Record<Anomaly["type"], number>>> = {
  "version-impact": { "version-regression": 20 },
  "what-changed": { "version-regression": 25, "negativity-spike": 20, "volume-spike": 15 },
  "root-cause": { "version-regression": 30, "negativity-spike": 25, "volume-spike": 15 },
  "problem-clustering": { "negativity-spike": 20, "version-regression": 15 },
  "temporal-trends": { "volume-spike": 25, "negativity-spike": 15 },
  "competitive-gap": { "app-rating-outlier": 20 },
  "hypothesis-generation": { "version-regression": 15, "negativity-spike": 15 },
  "sentiment-by-topic": { "negativity-spike": 15 },
};

export function scoreOne(
  spec: AnalysisSpec,
  entries: DatasetEntry[],
  artifacts: PipelineArtifact[],
  anomalies: Anomaly[],
): OrchestratorScore {
  const reasons: string[] = [];
  let potential = spec.basePotential;
  let evidence = spec.evidence(entries);

  const alreadyRun = artifacts.some((a) => a.methodology === `${spec.engine}:${spec.id}`);
  if (alreadyRun) {
    potential = Math.round(potential * 0.25);
    reasons.push("já executada — retorno decrescente");
  }

  // Boost de anomalias
  const boosts = ANOMALY_BOOSTS[spec.id];
  if (boosts) {
    for (const an of anomalies) {
      const b = boosts[an.type];
      if (b) {
        potential += b;
        reasons.push(`anomalia: ${an.title}`);
      }
    }
  }

  // Upstream presente/ausente
  if (spec.consumes.length > 0) {
    const presentKinds = new Set(artifacts.map((a) => a.kind));
    const missing = spec.consumes.filter((k) => !presentKinds.has(k));
    const present = spec.consumes.filter((k) => presentKinds.has(k));
    if (present.length > 0 && !alreadyRun) {
      potential += 4 * present.length;
      reasons.push(`upstream rico: ${present.length} camada(s) disponíveis`);
    }
    // Penaliza só estágios avançados de IA que dependem de camadas anteriores
    if (spec.engine === "ai" && (spec.stage === "reason" || spec.stage === "strategy") && missing.length > 0) {
      const penalty = Math.min(30, 10 * missing.length);
      evidence -= penalty;
      reasons.push(`depende de camadas ausentes (-${penalty} evidência)`);
    }
  }

  potential = clamp100(potential);
  evidence = clamp100(evidence);
  const costScore = COST_SCORE[spec.cost];
  const priority = clamp100(0.5 * potential + 0.35 * evidence + 0.15 * costScore);

  return {
    analysis: spec,
    potential,
    evidence,
    costScore,
    priority,
    hot: priority >= 75 && !alreadyRun,
    alreadyRun,
    reasons,
  };
}

/** Pontua TODO o catálogo, ordenado por prioridade (maior primeiro). */
export function scoreAnalyses(
  entries: DatasetEntry[],
  artifacts: PipelineArtifact[],
  anomalies: Anomaly[],
): OrchestratorScore[] {
  return ANALYSES
    .map((spec) => scoreOne(spec, entries, artifacts, anomalies))
    .sort((a, b) => b.priority - a.priority);
}

/**
 * Escolhe a próxima análise para o loop de descoberta:
 * a de maior prioridade entre as "quentes" (não executadas), ou null quando
 * nenhuma análise justifica seu custo — o critério de parada do briefing.
 */
export function pickNext(scores: OrchestratorScore[]): OrchestratorScore | null {
  return scores.find((s) => s.hot) ?? null;
}
