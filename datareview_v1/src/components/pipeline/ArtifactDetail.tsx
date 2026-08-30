/**
 * ArtifactDetail — inspeção completa do artefato selecionado.
 *
 * Mostra: cabeçalho com metodologia/motor/confiança, findings estruturados
 * (com confiança), anomalias (com os números), o pedido de next_analysis da
 * IA (com botão para EXECUTAR — o loop manual), e o output markdown com
 * copiar/baixar. Durante uma execução de IA, mostra o streaming ao vivo.
 */
import { ArrowDownRight, Loader2, Play, RefreshCw } from "lucide-react";
import { KIND_LABEL, STAGE_META, type PipelineArtifact } from "@/lib/pipeline/types";
import { ANOMALY_TYPE_LABEL } from "@/lib/pipeline/anomalies";
import { resolveAnalysisId, getAnalysis } from "@/lib/pipeline/analyses";
import { AIOutputCard } from "@/components/shared/AIOutputCard";
import { CopyDownloadButtons } from "@/components/shared/CopyDownloadButtons";
import { artifactToHTML } from "@/lib/shareArtifact";
import { cn } from "@/lib/utils";

interface Props {
  artifact: PipelineArtifact | null;
  /** Texto de streaming enquanto uma análise de IA está rodando. */
  liveText: string | null;
  liveLabel: string | null;
  onRunAnalysis: (analysisId: string, parameters?: Record<string, unknown>) => void;
  /** Reexecuta a análise de origem do artefato sobre os dados atuais. */
  onReanalyze?: (artifact: PipelineArtifact) => void;
  /** True enquanto uma reanálise está em andamento. */
  reanalyzing?: boolean;
}

const SEV_STYLE: Record<string, string> = {
  alta: "border-red-500/40 bg-red-500/5 text-red-600 dark:text-red-400",
  "média": "border-amber-500/40 bg-amber-500/5 text-amber-600 dark:text-amber-400",
  baixa: "border-border bg-secondary/30 text-muted-foreground",
};

export function ArtifactDetail({ artifact, liveText, liveLabel, onRunAnalysis, onReanalyze, reanalyzing }: Props) {
  // Streaming ao vivo tem precedência na área de output.
  if (liveText !== null) {
    return (
      <div className="flex flex-col min-h-0 h-full">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 flex-shrink-0">
          <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
          <h3 className="text-xs font-bold text-foreground">Gerando: {liveLabel}</h3>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-3">
          <AIOutputCard bare content={liveText} filename={`pipeline-live`} streaming />
        </div>
      </div>
    );
  }

  if (!artifact) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <ArrowDownRight className="h-8 w-8 text-muted-foreground/30 mb-2" />
        <p className="text-sm font-medium text-foreground">Nenhum artefato selecionado</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
          Execute análises na tabela do orquestrador (ou rode o loop de descoberta)
          e selecione um artefato no vault para inspecionar — incluindo o lineage
          até os reviews originais.
        </p>
      </div>
    );
  }

  const meta = STAGE_META[artifact.stage];
  const anomalies = artifact.data?.anomalies ?? [];
  const findings = artifact.data?.findings ?? [];
  const nextReq = artifact.data?.nextAnalysis;
  const nextId = nextReq ? resolveAnalysisId(nextReq.type) : null;
  const nextSpec = nextId ? getAnalysis(nextId) : undefined;

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="px-3 py-2 border-b border-border/50 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-sm font-bold text-foreground truncate">{artifact.title}</h3>
          <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full border flex-shrink-0", meta.color, meta.textColor)}>
            {meta.label}
          </span>
          {onReanalyze && (
            <button
              onClick={() => onReanalyze(artifact)}
              disabled={reanalyzing}
              aria-label={`Reanalisar ${artifact.title} com os dados atuais`}
              title="Reanalisar: reexecuta esta análise sobre os dados atuais (novo artefato, lineage preservada)"
              className="ml-auto shrink-0 inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground hover:border-primary/50 disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3 w-3", reanalyzing && "animate-spin")} aria-hidden />
              Reanalisar
            </button>
          )}
          <span className={cn("shrink-0", !onReanalyze && "ml-auto")} title="Exportar como HTML autocontido (Onda 4.4)">
            <CopyDownloadButtons
              content={artifactToHTML(artifact)}
              filename={`analise-${artifact.id}`}
              extension="html"
            />
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {KIND_LABEL[artifact.kind]} · {artifact.methodology}
          {artifact.model && ` · ${artifact.model}`}
          {artifact.confidence && ` · confiança ${artifact.confidence}`}
          {" · "}{new Date(artifact.createdAt).toLocaleString("pt-BR")}
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-4">
        {/* Findings estruturados (IA) */}
        {findings.length > 0 && (
          <section>
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Findings ({findings.length})
            </h4>
            <div className="space-y-1.5">
              {findings.map((f, i) => (
                <div key={i} className="rounded-md border border-border/50 bg-secondary/20 px-2.5 py-1.5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0 text-xs font-medium text-foreground">{f.title}</div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <div className="w-12 h-1 rounded-full bg-secondary overflow-hidden">
                        <div
                          className={cn("h-full rounded-full", f.confidence >= 0.75 ? "bg-emerald-500" : f.confidence >= 0.5 ? "bg-amber-500" : "bg-muted-foreground")}
                          style={{ width: `${Math.round(f.confidence * 100)}%` }}
                        />
                      </div>
                      <span className="text-[9px] tabular-nums text-muted-foreground">{Math.round(f.confidence * 100)}%</span>
                    </div>
                  </div>
                  {f.evidence && <p className="text-[10px] text-muted-foreground mt-0.5">{f.evidence}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Anomalias (determinístico) */}
        {anomalies.length > 0 && (
          <section>
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Anomalias ({anomalies.length})
            </h4>
            <div className="space-y-1.5">
              {anomalies.map((an) => (
                <div key={an.id} className={cn("rounded-md border px-2.5 py-1.5", SEV_STYLE[an.severity])}>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold uppercase">{an.severity}</span>
                    <span className="text-[9px] text-muted-foreground">{ANOMALY_TYPE_LABEL[an.type]}</span>
                    {an.reviewIds.length > 0 && (
                      <span className="text-[9px] text-muted-foreground ml-auto">{an.reviewIds.length} reviews vinculados</span>
                    )}
                  </div>
                  <p className="text-xs font-medium mt-0.5">{an.title}</p>
                  <p className="text-[10px] opacity-80 mt-0.5">{an.detail}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Pedido de próxima análise da IA — o loop, manual */}
        {nextReq && (
          <section className="rounded-md border border-violet-500/40 bg-violet-500/5 px-2.5 py-2">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
              A IA pediu uma nova análise
            </h4>
            <p className="text-xs text-foreground mt-1">
              <strong>{nextReq.type}</strong>
              {nextSpec && nextSpec.label !== nextReq.type && <span className="text-muted-foreground"> → {nextSpec.label}</span>}
            </p>
            {nextReq.rationale && <p className="text-[10px] text-muted-foreground italic mt-0.5">“{nextReq.rationale}”</p>}
            {nextReq.parameters && Object.keys(nextReq.parameters).length > 0 && (
              <p className="text-[9px] text-muted-foreground/70 mt-0.5 font-mono">{JSON.stringify(nextReq.parameters)}</p>
            )}
            {nextId && (
              <button
                onClick={() => onRunAnalysis(nextId, nextReq.parameters)}
                className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium text-violet-600 dark:text-violet-400 hover:underline"
              >
                <Play className="h-3 w-3" /> Executar esta análise agora
              </button>
            )}
          </section>
        )}

        {/* Output markdown — componente padrão de saída IA */}
        {artifact.markdown && (
          <AIOutputCard bare content={artifact.markdown} filename={`pipeline-${artifact.methodology.replace(":", "-")}`} storageKey={`pipeline-${artifact.id}`} />
        )}
      </div>
    </div>
  );
}
