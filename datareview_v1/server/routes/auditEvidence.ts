/**
 * auditEvidence — rota de PROVENANCE da auditoria (briefing §8).
 *
 * Responde "de onde veio este dado?" devolvendo a cadeia de evidência de uma
 * fonte (ou de todas): observações (engine) + runs (coletas) + artifacts
 * (raw imutável, com hash/bytes — payload só em preview truncado para não
 * estourar a resposta).
 *
 * GET /functions/v1/audit-evidence?source=<id>&limit=<n>&raw=1
 *   source: filtra por fonte (default: todas)
 *   limit:  máximo de itens por lista (default 20, teto 100)
 *   raw=1:  inclui preview do payload bruto (primeiros 400 chars por artifact)
 */
import type { Request, Response } from "express";
import {
  listArtifacts,
  listObservations,
  listRunEvents,
  type CollectionRun,
  type Observation,
  type RawArtifact,
} from "../lib/rawStore.js";

interface ArtifactView {
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

function artifactView(a: RawArtifact, includeRaw: boolean): ArtifactView {
  const view: ArtifactView = {
    id: a.id,
    runId: a.runId,
    endpoint: a.endpoint,
    url: a.url,
    hash: a.hash,
    bytes: a.bytes,
    collectedAt: a.collectedAt,
    collector: a.collector,
    collectorVersion: a.collectorVersion,
  };
  if (includeRaw) {
    try {
      view.payloadPreview = JSON.stringify(a.payload)?.slice(0, 400) ?? "";
    } catch {
      view.payloadPreview = "";
    }
  }
  return view;
}

export function auditEvidence(req: Request, res: Response): void {
  const source = String(req.query.source ?? req.body?.source ?? "").trim() || undefined;
  const limit = Math.max(1, Math.min(100, Number(req.query.limit ?? req.body?.limit) || 20));
  const includeRaw = String(req.query.raw ?? req.body?.raw ?? "") === "1";

  const observations: Observation[] = listObservations(source).slice(-limit).reverse();
  const runs: CollectionRun[] = listRunEvents(400)
    .map((e) => e.run)
    .filter((r) => r && (source ? r.sourceId === source : true))
    // Dedup por id (o log de eventos repete o run a cada transição) — fica o
    // estado mais recente (o log é lido newest-first).
    .filter((r, i, arr) => arr.findIndex((x) => x.id === r.id) === i)
    .slice(0, limit);
  const artifacts = listArtifacts(400)
    .filter((a) => (source ? a.sourceId === source : true))
    .slice(0, limit);

  res.json({
    source: source ?? null,
    observations,
    runs,
    artifacts: artifacts.map((a) => artifactView(a, includeRaw)),
  });
}
