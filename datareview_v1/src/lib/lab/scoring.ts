/**
 * Opportunity Score (experimental) — média ponderada de dimensões explícitas.
 *
 * NÃO usa IA para inventar a pontuação. Cada dimensão é 0–100, definida pelo
 * usuário com base nos experimentos/findings. Os pesos ficam centralizados
 * aqui para permitir experimentação futura.
 *
 * O score é deliberadamente apresentado como "experimental", nunca como
 * verdade objetiva.
 */

import type { ProductScores } from "./types";

export interface ScoreDimension {
  key: keyof ProductScores;
  label: string;
  weight: number;
  hint: string;
}

/** Pesos centralizados — soma 1.0. Ajustar aqui para experimentar. */
export const SCORE_DIMENSIONS: ScoreDimension[] = [
  { key: "demand", label: "Sinal de demanda", weight: 0.2, hint: "Volume de menções/pedidos nos reviews" },
  { key: "pain", label: "Intensidade da dor", weight: 0.2, hint: "Severidade e frequência da reclamação" },
  { key: "competitiveGap", label: "Gap competitivo", weight: 0.15, hint: "Nenhum app resolve bem hoje" },
  { key: "dataAvailability", label: "Disponibilidade de dados", weight: 0.15, hint: "Reviews suficientes para validar" },
  { key: "technicalFeasibility", label: "Viabilidade técnica", weight: 0.15, hint: "Esforço de implementação (invertido)" },
  { key: "willingnessToPay", label: "Disposição a pagar", weight: 0.15, hint: "Sinais de valor monetário nos reviews" },
];

export const SCORE_WEIGHT_SUM = SCORE_DIMENSIONS.reduce(
  (s, d) => s + d.weight,
  0,
);

/**
 * Calcula o Opportunity Score (0–100) como média ponderada das dimensões
 * definidas. Dimensões ausentes contribuem com 0 (e reduzem o score).
 */
export function computeOpportunityScore(scores?: ProductScores): number | undefined {
  if (!scores) return undefined;
  const present = SCORE_DIMENSIONS.filter((d) => typeof scores[d.key] === "number");
  if (present.length === 0) return undefined;
  // Re-normaliza pesos das dimensões presentes para que ausência não zere
  // injustamente o score, mas ainda penalize dados faltantes.
  const totalWeight = present.reduce((s, d) => s + d.weight, 0);
  const sum = present.reduce(
    (s, d) => s + (scores[d.key] as number) * d.weight,
    0,
  );
  // Penalidade leve por dimensões faltantes (cada uma ausente reduz ~3 pts).
  const missing = SCORE_DIMENSIONS.length - present.length;
  const penalty = missing * 3;
  const raw = sum / totalWeight - penalty;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

export function scoreLabel(score?: number): string {
  if (typeof score !== "number") return "—";
  if (score >= 80) return "Muito promissor";
  if (score >= 60) return "Promissor";
  if (score >= 40) return "Moderado";
  if (score >= 20) return "Baixo";
  return "Muito baixo";
}

/** Valores 0–100 coerentes (undefined → não definido). */
export function parseScore(v: unknown): number | undefined {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  if (typeof n !== "number" || Number.isNaN(n)) return undefined;
  return Math.max(0, Math.min(100, Math.round(n)));
}
