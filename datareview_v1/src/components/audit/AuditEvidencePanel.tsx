/**
 * AuditEvidencePanel — provenance viewer (briefing §8) por fonte.
 *
 * Mostra a cadeia observação → run → artifact (raw com hash/bytes + preview)
 * para responder "de onde veio este dado?". Fetch preguiçoso: só quando o
 * usuário abre o bloco (a rota existe mesmo sem evidência — estado honesto).
 */
import { useEffect, useState } from "react";
import {
  fetchAuditEvidence,
  type AuditEvidence,
} from "@/lib/audit/auditEngine";
import { Badge } from "@/components/ui/badge";
import { FileSearch } from "lucide-react";

function fmtTime(at: number): string {
  return new Date(at).toLocaleString("pt-BR");
}

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AuditEvidencePanel({ sourceId }: { sourceId: string }) {
  const [evidence, setEvidence] = useState<AuditEvidence | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchAuditEvidence(sourceId, 6)
      .then((ev) => { if (alive) setEvidence(ev); })
      .catch(() => { if (alive) setEvidence({ source: sourceId, observations: [], runs: [], artifacts: [] }); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [sourceId]);

  return (
    <details className="rounded-md border border-border/50 bg-muted/20 p-3">
      <summary className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <FileSearch className="h-3.5 w-3.5" />
        Provenance — de onde veio este dado? (cadeia de evidência)
      </summary>

      {loading ? (
        <p className="mt-2 text-xs text-muted-foreground" role="status">Carregando evidências…</p>
      ) : !evidence || (evidence.observations.length === 0 && evidence.runs.length === 0 && evidence.artifacts.length === 0) ? (
        <p className="mt-2 text-xs text-muted-foreground" role="status">
          Nenhuma evidência bruta preservada para esta fonte ainda. Rode uma coleta
          ou as sondas — a cadeia aparece aqui (observação → run → artifact → raw).
        </p>
      ) : (
        <div className="mt-3 space-y-3 text-xs">
          {evidence.observations.length > 0 && (
            <section>
              <div className="mb-1 font-medium text-foreground">Observações ({evidence.observations.length})</div>
              <ol className="space-y-1">
                {evidence.observations.map((o, i) => (
                  <li key={`${o.runId}-${i}`} className="rounded border border-border/40 bg-background/60 p-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{o.endpoint}</Badge>
                      {o.durationMs != null && <span>{o.durationMs}ms</span>}
                      {o.confidence != null && <span>confiança {Math.round(o.confidence * 100)}%</span>}
                      <span className="text-muted-foreground">{fmtTime(o.at)}</span>
                    </div>
                    {o.schema && o.schema.length > 0 && (
                      <div className="mt-1 text-muted-foreground">
                        schema: <code className="break-all">{o.schema.join(", ")}</code>
                      </div>
                    )}
                    <div className="mt-1 font-mono text-[10px] text-muted-foreground">run {o.runId}</div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {evidence.runs.length > 0 && (
            <section>
              <div className="mb-1 font-medium text-foreground">Coletas (runs) ({evidence.runs.length})</div>
              <ol className="space-y-1">
                {evidence.runs.map((r) => (
                  <li key={r.id} className="rounded border border-border/40 bg-background/60 p-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={r.status === "finished" ? "outline" : "secondary"}>{r.status}</Badge>
                      <span>{r.collector} v{r.collectorVersion}</span>
                      {r.yielded != null && <span>{r.yielded} itens</span>}
                      <span className="text-muted-foreground">{fmtTime(r.startedAt)}</span>
                    </div>
                    {r.errors.length > 0 && (
                      <div className="mt-1 text-destructive">
                        {r.errors.length} erro(s): {r.errors[0].message}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {evidence.artifacts.length > 0 && (
            <section>
              <div className="mb-1 font-medium text-foreground">Raw preservado ({evidence.artifacts.length})</div>
              <ol className="space-y-1">
                {evidence.artifacts.map((a) => (
                  <li key={a.id} className="rounded border border-border/40 bg-background/60 p-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{a.endpoint}</Badge>
                      <span>{fmtBytes(a.bytes)}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">hash {a.hash.slice(0, 10)}</span>
                      <span className="text-muted-foreground">{fmtTime(a.collectedAt)}</span>
                    </div>
                    {a.payloadPreview && (
                      <pre className="mt-1 max-h-20 overflow-y-auto whitespace-pre-wrap break-all rounded bg-muted/40 p-1.5 font-mono text-[10px] text-muted-foreground">
                        {a.payloadPreview}
                      </pre>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      )}
    </details>
  );
}
