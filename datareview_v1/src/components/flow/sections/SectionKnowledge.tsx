/**
 * Seção 09 — Conhecimento: o que o sistema já acumulou — insights de IA
 * (insightStore), artefatos do Pipeline (artifactStore) e findings do Lab,
 * com links para as superfícies completas.
 */
import { Link } from "react-router-dom";
import { Lightbulb, ScrollText, FlaskRound, ArrowRight } from "lucide-react";
import { useInsights } from "@/lib/insightStore";
import { useArtifacts, removeArtifact, clearArtifacts } from "@/lib/pipeline/artifactStore";
import { useLabFindings } from "@/lib/lab/hooks";
import { EmptyState } from "@/components/shared/EmptyState";
import { Panel } from "@/components/Panel";
import { Trash2 } from "lucide-react";

export function SectionKnowledge() {
  const insights = useInsights();
  const artifacts = useArtifacts();
  const findings = useLabFindings();

  const total = insights.length + artifacts.length + findings.length;

  if (total === 0) {
    return (
      <EmptyState
        icon={Lightbulb}
        title="Nenhum conhecimento acumulado ainda"
        description="Execute investigações (etapa 07), agentes (08) ou o Pipeline para o sistema acumular insights, artefatos e findings aqui."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-border/40 bg-background/60 px-3 py-2">
          <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            <Lightbulb className="h-3 w-3 text-primary" aria-hidden /> Insights de IA
          </p>
          <p className="mt-0.5 text-sm font-semibold">{insights.length}</p>
        </div>
        <div className="rounded-lg border border-border/40 bg-background/60 px-3 py-2">
          <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            <ScrollText className="h-3 w-3 text-primary" aria-hidden /> Artefatos do Pipeline
          </p>
          <p className="mt-0.5 text-sm font-semibold">{artifacts.length}</p>
        </div>
        <div className="rounded-lg border border-border/40 bg-background/60 px-3 py-2">
          <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            <FlaskRound className="h-3 w-3 text-primary" aria-hidden /> Findings do Lab
          </p>
          <p className="mt-0.5 text-sm font-semibold">{findings.length}</p>
        </div>
      </div>

      <ul className="space-y-1.5" aria-label="Conhecimento mais recente">
        {insights.slice(0, 4).map((i) => (
          <li key={i.id} className="flex items-start gap-2 rounded-md border border-border/40 bg-background/60 px-2.5 py-2 text-xs">
            <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0">
              <p className="font-medium">{i.section}</p>
              <p className="truncate text-[11px] text-muted-foreground">{i.summary || i.markdown.slice(0, 120)}</p>
            </div>
          </li>
        ))}
        {artifacts.slice(0, 3).map((a) => (
          <li key={a.id} className="flex items-start gap-2 rounded-md border border-border/40 bg-background/60 px-2.5 py-2 text-xs">
            <ScrollText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0">
              <p className="font-medium">{a.methodology}</p>
              <p className="truncate text-[11px] text-muted-foreground">{a.markdown.slice(0, 120)}</p>
            </div>
          </li>
        ))}
      </ul>

      <Panel
        title="Vault de artefatos completo"
        subtitle="Toda a lista de artefatos do Pipeline — markdown completo por artefato, com exclusão individual/limpar — gerenciado aqui dentro."
        icon={<ScrollText className="h-4 w-4 text-primary" />}
        defaultOpen={false}
        storageKey="aso:flow-vault"
        actions={
          <button
            onClick={() => {
              if (window.confirm(`Limpar todos os ${artifacts.length} artefatos do vault?`)) clearArtifacts();
            }}
            aria-label="Limpar vault de artefatos"
            title="Limpar vault"
            className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </button>
        }
      >
        {artifacts.length === 0 ? (
          <p className="text-xs text-muted-foreground">Vault vazio.</p>
        ) : (
          <ul className="space-y-1.5 max-h-72 overflow-y-auto" aria-label="Artefatos do Pipeline">
            {artifacts.map((a) => (
              <li key={a.id} className="flex items-start gap-2 rounded-md border border-border/40 bg-background/60 px-2.5 py-2 text-xs">
                <ScrollText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{a.methodology}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{a.markdown.slice(0, 140)}</p>
                </div>
                <button
                  onClick={() => removeArtifact(a.id)}
                  aria-label={`Remover artefato ${a.methodology}`}
                  className="p-1 rounded text-muted-foreground hover:bg-secondary hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="flex flex-wrap gap-3 text-xs">
        <Link to="/pipeline" className="inline-flex items-center gap-1 text-primary hover:underline">
          Vault do Pipeline <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
        <Link to="/lab" className="inline-flex items-center gap-1 text-primary hover:underline">
          Knowledge do Lab <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
