/**
 * AuditPlannerCard — Experiment Planner do Audit Engine na UI (briefing §5).
 *
 * Gera o plano de auditoria por fonte: baseline (defaults documentados) +
 * variações (combinação dos params enumerados) com budget anti-explosão.
 * O plano é preview + copiável — a execução fica no agendador de sondas.
 */
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyDownloadButtons } from "@/components/shared/CopyDownloadButtons";
import { auditSourcesOrdered } from "@/lib/audit/auditSources";
import {
  dimensionsForSource,
  planSourceBaseline,
  planSourceVariations,
  type AuditExperiment,
} from "@/lib/audit/experimentPlanner";
import { FlaskConical } from "lucide-react";

const BUDGET = { maxExperiments: 24 };

interface SourcePlan {
  sourceId: string;
  name: string;
  baseline: AuditExperiment[];
  variations: AuditExperiment[];
  dimensions: number;
}

function planAll(): SourcePlan[] {
  return auditSourcesOrdered()
    .filter((s) => s.implemented)
    .map((s) => ({
      sourceId: s.id,
      name: s.name,
      baseline: planSourceBaseline(s),
      variations: planSourceVariations(s, BUDGET),
      dimensions: dimensionsForSource(s).length,
    }));
}

export function AuditPlannerCard() {
  const plans = useMemo(planAll, []);
  const [expanded, setExpanded] = useState<string | null>(null);
  const total = plans.reduce((acc, p) => acc + p.baseline.length + p.variations.length, 0);
  const withVariations = plans.filter((p) => p.variations.length > 0);

  const json = JSON.stringify(
    plans.map((p) => ({
      fonte: p.sourceId,
      dimensoes: p.dimensions,
      baseline: p.baseline,
      variacoes: p.variations,
    })),
    null,
    2,
  );

  return (
    <section
      aria-label="Planejador de experimentos da auditoria"
      className="rounded-lg border border-border/60 bg-card/40 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <FlaskConical className="h-4 w-4 text-primary" />
            Planejador de experimentos
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            <strong className="text-foreground">{total} experimentos</strong> planejados em{" "}
            {plans.length} fontes implementadas — baseline (defaults documentados) + variações
            dos parâmetros enumerados (teto de {BUDGET.maxExperiments}/fonte, §5: "nunca
            desperdiçar requisições").
          </p>
        </div>
        <CopyDownloadButtons content={json} filename="plano-auditoria" extension="json" />
      </div>

      {withVariations.length === 0 ? (
        <p className="mt-3 rounded-md border border-dashed p-3 text-xs text-muted-foreground" role="status">
          Nenhuma fonte com parâmetros enumerados para variar — o baseline ainda é planejado.
        </p>
      ) : (
        <ol className="mt-3 space-y-1.5">
          {withVariations.map((p) => (
            <li key={p.sourceId} className="rounded-md border border-border/50 px-3 py-2 text-xs">
              <button
                type="button"
                className="flex w-full flex-wrap items-center gap-2 text-left"
                aria-expanded={expanded === p.sourceId}
                onClick={() => setExpanded(expanded === p.sourceId ? null : p.sourceId)}
              >
                <span className="font-medium">{p.name}</span>
                <Badge variant="outline">{p.dimensions} dimensões</Badge>
                <Badge variant="secondary">{p.variations.length} variações</Badge>
                <span className="text-muted-foreground">+ {p.baseline.length} baseline</span>
              </button>
              {expanded === p.sourceId && (
                <ol className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded bg-muted/30 p-2 font-mono text-[11px]">
                  {p.variations.map((v, i) => (
                    <li key={i} className="text-muted-foreground">
                      {v.label || "(defaults)"}
                    </li>
                  ))}
                </ol>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
