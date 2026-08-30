/**
 * Seção 11 — Oportunidades: o Lab em miniatura — experimentos recentes e
 * candidatos a produto com Opportunity Score, criação de candidato inline
 * e link para o Discovery Board (Kanban) completo.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { FlaskRound, Plus, ArrowRight, Trash2 } from "lucide-react";
import { Panel } from "@/components/Panel";
import { FlowEmbed } from "@/components/flow/FlowEmbed";
import { useLabExperiments, useLabProductCandidates } from "@/lib/lab/hooks";
import { deleteProductCandidate } from "@/lib/lab/repository";
import { ProductCandidateDialog } from "@/components/lab/ProductCandidateDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { scoreLabel } from "@/lib/lab/scoring";

export function SectionOpportunities() {
  const experiments = useLabExperiments();
  const candidates = useLabProductCandidates();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Novo candidato a produto
        </button>
        <Link to="/lab" className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-3 py-1.5 text-xs hover:bg-secondary">
          Discovery Board <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
      </div>

      {candidates.length === 0 && experiments.length === 0 ? (
        <EmptyState
          icon={FlaskRound}
          title="Nenhuma oportunidade ainda"
          description="Promova findings do Lab ou crie um candidato a produto diretamente — a jornada de descoberta começa nas etapas anteriores."
        />
      ) : (
        <>
          {candidates.length > 0 && (
            <ul className="space-y-2" aria-label="Candidatos a produto">
              {candidates.map((c) => (
                <li key={c.id} className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/60 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-semibold">{c.name}</p>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">{c.status}</span>
                      {c.opportunityScore !== undefined && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          score {c.opportunityScore} · {scoreLabel(c.opportunityScore)}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">{c.problem}</p>
                    {c.vertical && <p className="text-[10px] text-muted-foreground/70">Vertical: {c.vertical}</p>}
                  </div>
                  <button
                    onClick={() => {
                      if (window.confirm(`Excluir o candidato "${c.name}"?`)) deleteProductCandidate(c.id);
                    }}
                    aria-label={`Excluir ${c.name}`}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-muted-foreground">
            {experiments.length} experimento(s) no Lab · {candidates.length} candidato(s).
            Os experimentos completos vivem no <Link to="/lab" className="text-primary hover:underline">Lab</Link>.
          </p>
        </>
      )}

      <ProductCandidateDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      <Panel
        title="Lab completo"
        subtitle="A página Lab inteira: experimentos, findings validados, Discovery Board (Kanban), Knowledge e Opportunity Score — sem sair do Fluxo."
        icon={<FlaskRound className="h-4 w-4 text-primary" />}
        defaultOpen={false}
        storageKey="aso:flow-lab"
      >
        <FlowEmbed page="lab" />
        <Link to="/lab" className="mt-2 inline-block text-[11px] text-primary hover:underline">
          Abrir página dedicada ↗
        </Link>
      </Panel>
    </div>
  );
}
