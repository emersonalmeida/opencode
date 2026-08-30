/**
 * Card de snapshots versionados (§7): congela o estado atual da auditoria
 * (catálogo + confiabilidade + sondas) numa versão nova — nunca sobrescreve.
 */
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { downloadFile } from "@/lib/pageFeatures";
import {
  createAuditSnapshot,
  deleteAuditSnapshot,
  snapshotToJson,
  useAuditSnapshots,
} from "@/lib/audit/auditSnapshots";
import { fetchReliability } from "@/lib/audit/auditEngine";
import { auditStats } from "@/lib/audit/auditModel";
import { auditSourcesOrdered } from "@/lib/audit/auditSources";
import { getSchedulerState } from "@/lib/audit/auditScheduler";
import { Camera, Download, Trash2 } from "lucide-react";

export function AuditSnapshotsCard() {
  const snapshots = useAuditSnapshots();
  const [creating, setCreating] = useState(false);

  const create = async () => {
    setCreating(true);
    try {
      const reliability = await fetchReliability().catch(() => []);
      const stats = auditStats(auditSourcesOrdered());
      createAuditSnapshot({
        catalog: {
          sources: stats.sources,
          endpoints: stats.endpoints,
          parameters: stats.parameters,
          capabilities: stats.capabilities,
          fields: stats.fields,
        },
        reliability,
        runs: getSchedulerState().runs,
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <section
      aria-label="Snapshots versionados da auditoria"
      className="rounded-lg border border-border/60 bg-card/40 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Snapshots da auditoria (datasets versionados)</div>
          <p className="text-xs text-muted-foreground">
            Cada snapshot congela o estado da auditoria (catálogo + confiabilidade + sondas)
            numa versão nova — nada é sobrescrito (§7).
          </p>
        </div>
        <Button size="sm" onClick={() => void create()} disabled={creating}>
          <Camera className="h-3.5 w-3.5" /> {creating ? "Gerando…" : "Gerar snapshot"}
        </Button>
      </div>

      {snapshots.length === 0 ? (
        <p className="mt-3 rounded-md border border-dashed p-3 text-xs text-muted-foreground" role="status">
          Nenhum snapshot ainda. Gere um para congelar o estado atual — depois compare
          com futuras coletas.
        </p>
      ) : (
        <ol className="mt-3 space-y-1.5">
          {snapshots.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/50 px-3 py-2 text-xs"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">v{s.version}</Badge>
                <span className="font-medium">{s.label}</span>
                <span className="text-muted-foreground">
                  {new Date(s.createdAt).toLocaleString("pt-BR")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">
                  {s.summary.sourcesObserved} fontes · {s.summary.runsDone} ok · {s.summary.runsError} erro
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  aria-label={`Baixar snapshot v${s.version}`}
                  onClick={() =>
                    downloadFile(
                      `auditoria-snapshot-v${s.version}.json`,
                      snapshotToJson(s),
                      "application/json",
                    )
                  }
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-destructive"
                  aria-label={`Excluir snapshot v${s.version}`}
                  onClick={() => deleteAuditSnapshot(s.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
