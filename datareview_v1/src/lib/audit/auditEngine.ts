/**
 * auditEngine — cliente do Audit Engine (ponta do briefing §10/§5): mescla o
 * catálogo documentado (capability registry) com a evidência observada
 * (reliability) para a página /auditoria. Nunca "score mágico": ausência de
 * observação é estado honesto.
 */
import { supabase } from "@/integrations/supabase/client";
import type { AuditSource } from "./auditModel";

/** Métricas objetivas por fonte (da rota server, espelhada no modelo). */
export interface SourceReliability {
  id: string;
  observations: number;
  successRate: number;
  errorRate: number;
  avgDurationMs: number;
  avgConfidence: number;
}

/** Observação é a evidência; o número de observações anota "já testamos". */
export interface EnrichedSource extends AuditSource {
  observed?: SourceReliability;
}

/** Enriquece o catálogo documentado com evidence do Engine. */
export function enrichWithReliability(
  sources: AuditSource[],
  reliability: SourceReliability[],
): EnrichedSource[] {
  const byId = new Map(reliability.map((r) => [r.id, r] as const));
  return sources.map((s) => ({ ...s, observed: byId.get(s.id ?? s.sourceId ?? "") }));
}

/** Busca a reliability atual do servidor (best-effort; falha → catálogo). */
export async function fetchReliability(): Promise<SourceReliability[]> {
  const res = await supabase.functions.invoke("audit-reliability", {
    method: "GET",
  });
  const data = (res?.data as { sources?: SourceReliability[] } | undefined)?.sources;
  return Array.isArray(data) ? data : [];
}

/** Para mostrar em % (0–1 → "93%"); esconde ruído com minObs. */
export function formatRate(rate: number | undefined, observations = 0): string | null {
  if (rate == null || observations < 1) return null;
  return `${Math.round(rate * 100)}%`;
}

// ---------------------------------------------------------------------------
// Provenance (§8) — cadeia observação → run → artifact → raw.
// ---------------------------------------------------------------------------

export interface AuditObservation {
  runId: string;
  sourceId: string;
  endpoint: string;
  url?: string;
  params: Record<string, unknown>;
  durationMs?: number;
  schema?: string[];
  confidence?: number;
  at: number;
}

export interface AuditRun {
  id: string;
  sourceId: string;
  collector: string;
  collectorVersion: string;
  params: Record<string, unknown>;
  startedAt: number;
  finishedAt?: number;
  status: string;
  requested?: number;
  yielded?: number;
  errors: { endpoint: string; message: string; at: number }[];
}

export interface AuditArtifactView {
  id: string;
  runId: string;
  endpoint: string;
  url?: string;
  hash: string;
  bytes: number;
  collectedAt: number;
  collector: string;
  collectorVersion: string;
  payloadPreview?: string;
}

export interface AuditEvidence {
  source: string | null;
  observations: AuditObservation[];
  runs: AuditRun[];
  artifacts: AuditArtifactView[];
}

/** Busca a cadeia de provenance de uma fonte (best-effort). */
export async function fetchAuditEvidence(sourceId: string, limit = 10): Promise<AuditEvidence> {
  const res = await supabase.functions.invoke(
    `audit-evidence?source=${encodeURIComponent(sourceId)}&limit=${limit}&raw=1`,
    { method: "GET" },
  );
  const data = res?.data as AuditEvidence | undefined;
  return {
    source: data?.source ?? sourceId,
    observations: Array.isArray(data?.observations) ? data.observations : [],
    runs: Array.isArray(data?.runs) ? data.runs : [],
    artifacts: Array.isArray(data?.artifacts) ? data.artifacts : [],
  };
}
