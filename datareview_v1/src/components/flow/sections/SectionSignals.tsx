/**
 * Seção 06 — Sinais: a camada determinística do Pipeline — fatos computados
 * + anomalias detectadas (regressão de versão, picos de negatividade/volume,
 * outlier de app). Zero IA, instantâneo, com os números do cálculo visíveis.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Activity, AlertTriangle, Zap } from "lucide-react";
import { useFlowScope } from "@/components/flow/useFlowScope";
import { computeFacts, type ComputedFacts } from "@/lib/pipeline/facts";
import { detectAnomalies, ANOMALY_TYPE_LABEL, type Anomaly } from "@/lib/pipeline/anomalies";
import { EmptyState } from "@/components/shared/EmptyState";
import { Panel } from "@/components/Panel";
import { FlowEmbed } from "@/components/flow/FlowEmbed";
import { Network } from "lucide-react";

const SEVERITY_CLASS: Record<Anomaly["severity"], string> = {
  alta: "border-status-error/40 bg-status-error/5 text-status-error",
  média: "border-status-warning/40 bg-status-warning/5 text-status-warning",
  baixa: "border-status-info/40 bg-status-info/5 text-status-info",
};

export function SectionSignals() {
  const { scoped } = useFlowScope();
  const [facts, setFacts] = useState<ComputedFacts | null>(null);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [running, setRunning] = useState(false);

  if (scoped.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="Sem dados para extrair sinais"
        description="Colete apps para computar fatos e detectar anomalias deterministicamente."
      />
    );
  }

  const compute = () => {
    setRunning(true);
    setTimeout(() => {
      const f = computeFacts(scoped);
      setFacts(f);
      setAnomalies(detectAnomalies(scoped, f));
      setRunning(false);
    }, 0);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={compute}
          disabled={running}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Zap className="h-3.5 w-3.5" aria-hidden />}
          {facts ? "Recomputar fatos e sinais" : "Computar fatos e sinais"}
        </button>
        {anomalies.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-status-warning/10 px-2 py-0.5 text-[11px] font-medium text-status-warning" role="status">
            <AlertTriangle className="h-3 w-3" aria-hidden />
            {anomalies.length} anomalia(s)
          </span>
        )}
        <Link to="/pipeline" className="text-xs text-primary hover:underline">
          Loop de descoberta com IA →
        </Link>
      </div>

      {anomalies.length > 0 && (
        <ul className="space-y-2" aria-label="Anomalias detectadas">
          {anomalies.map((a) => (
            <li key={a.id} className={`rounded-lg border p-3 ${SEVERITY_CLASS[a.severity]}`}>
              <p className="text-xs font-semibold">
                {a.title}
                <span className="ml-2 font-normal opacity-70">
                  {ANOMALY_TYPE_LABEL[a.type]} · {a.severity}
                </span>
              </p>
              <p className="mt-0.5 text-[11px] opacity-80">{a.detail}</p>
              {a.reviewIds.length > 0 && (
                <p className="mt-1 text-[10px] opacity-60">
                  Evidência: {a.reviewIds.length} review(s) rastreada(s)
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {facts && anomalies.length === 0 && (
        <p className="rounded-lg border border-status-success/30 bg-status-success/5 p-3 text-xs text-status-success" role="status">
          ✓ Nenhuma anomalia — os indicadores estão dentro dos padrões esperados.
        </p>
      )}

      {facts && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-xs">
          <div className="rounded-lg border border-border/40 bg-background/60 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Versões</p>
            <p className="mt-0.5 font-semibold">{facts.versions.length} distintas</p>
          </div>
          <div className="rounded-lg border border-border/40 bg-background/60 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Países</p>
            <p className="mt-0.5 font-semibold">{facts.countries.length} storefronts</p>
          </div>
          <div className="rounded-lg border border-border/40 bg-background/60 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Termos</p>
            <p className="mt-0.5 font-semibold">{facts.topTerms.length} relevantes</p>
          </div>
          <div className="rounded-lg border border-border/40 bg-background/60 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Qualidade</p>
            <p className="mt-0.5 font-semibold">
              {facts.scope.reviews > 0 ? `${facts.dataQuality.datePct}% com data` : "—"}
            </p>
          </div>
        </div>
      )}

      <Panel
        title="Pipeline completo (motor de conhecimento)"
        subtitle="A página Pipeline inteira: orquestrador com scoring explicável, loop de descoberta autônomo, vault de artefatos e lineage — sem sair do Fluxo."
        icon={<Network className="h-4 w-4 text-primary" />}
        defaultOpen={false}
        storageKey="aso:flow-pipeline"
      >
        <div className="h-[640px]">
          <FlowEmbed page="pipeline" />
        </div>
        <Link to="/pipeline" className="mt-2 inline-block text-[11px] text-primary hover:underline">
          Abrir página dedicada ↗
        </Link>
      </Panel>
    </div>
  );
}
