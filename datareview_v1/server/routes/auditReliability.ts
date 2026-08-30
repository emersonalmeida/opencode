/**
 * auditReliability — rota do servidor que deriva métricas objetivas por
 * fonte a partir das observações auditáveis gravadas no rawStore (A3).
 *
 * GET|POST /functions/v1/audit-reliability
 *   → { sources: { id, observations, successRate, errorRate, avgDurationMs,
 *                 avgConfidence }[], generatedAt }
 *
 * Sem rawStore (dev fresh) retorna lista vazia — a página mostra ausência
 * honesta ("ainda não observado"), nunca score mágico.
 */
import { listObservations, type Observation } from "../lib/rawStore";

export interface SourceReliability {
  id: string;
  observations: number;
  successRate: number;
  errorRate: number;
  avgDurationMs: number;
  avgConfidence: number;
}

/** Agrupa observações por sourceId. Best-effort (rawStore failure-safe). */
export function computeBySource(observations: Observation[]): SourceReliability[] {
  const bySource = new Map<string, Observation[]>();
  for (const o of observations) {
    const arr = bySource.get(o.sourceId) ?? [];
    arr.push(o);
    bySource.set(o.sourceId, arr);
  }
  const out: SourceReliability[] = [];
  for (const [id, list] of bySource) {
    const total = list.length || 1;
    const errors = list.filter((o) => o.confidence === 0).length;
    out.push({
      id,
      observations: list.length,
      successRate: (total - errors) / total,
      errorRate: errors / total,
      avgDurationMs: list.reduce((a, o) => a + (o.durationMs ?? 0), 0) / total,
      avgConfidence: list.reduce((a, o) => a + (o.confidence ?? 0.5), 0) / total,
    });
  }
  return out.sort((a, b) => b.observations - a.observations);
}

export function handler() {
  const observations = listObservations();
  return {
    sources: computeBySource(observations),
    generatedAt: Date.now(),
  };
}
