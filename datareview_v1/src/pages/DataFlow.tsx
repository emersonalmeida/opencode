/**
 * Pipeline Fluxo de Dados (/fluxo-dados) — mapa MICRO e MACRO de tudo o que
 * acontece com os dados do sistema, do zero ao artefato final:
 * busca → requisição → resposta bruta → normalização → tratamento →
 * armazenamento → derivação → visualização → preparação p/ IA → análise IA →
 * IA sobre IA → saídas/artefatos → exportação.
 *
 * Cada estágio é um ExpandableBlock com micro-etapas, entradas/saídas,
 * chaves de storage e referências de código. O conteúdo vem da lib pura
 * src/lib/dataFlowMap.ts (testável); os contadores de storage são ao vivo.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";
import { ExpandableBlock } from "@/components/shared/ExpandableBlock";
import { cn } from "@/lib/utils";
import {
  AI_MODE_META,
  FLOW_STAGES,
  filterStages,
  stageCountByMode,
  type FlowAIMode,
} from "@/lib/dataFlowMap";
import { useDataset } from "@/hooks/useDataset";
import { useGenerations } from "@/hooks/useSessions";
import { useInsights } from "@/lib/insightStore";
import { listAIOutputs } from "@/lib/aiOutputStore";
import {
  ArrowDown, ArrowRight, BrainCircuit, Cog, Database, FileText, GitBranch, SlidersHorizontal,
} from "lucide-react";

const AI_MODE_ICON: Record<FlowAIMode, typeof Cog> = {
  "sem-ia": Cog,
  "para-ia": SlidersHorizontal,
  "com-ia": BrainCircuit,
  hibrido: GitBranch,
};

const AI_MODE_CLASS: Record<FlowAIMode, string> = {
  "sem-ia": "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  "para-ia": "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  "com-ia": "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  hibrido: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
};

export default function DataFlow() {
  const [modeFilter, setModeFilter] = useState<FlowAIMode | "todas">("todas");
  const dataset = useDataset();
  const generations = useGenerations();
  const insights = useInsights();
  const aiOutputs = listAIOutputs();

  const stages = useMemo(() => filterStages(modeFilter), [modeFilter]);
  const counts = useMemo(() => stageCountByMode(), []);
  const reviewCount = useMemo(
    () => dataset.entries.reduce((acc, e) => acc + e.reviews.length, 0),
    [dataset.entries],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <AppHeader title="Pipeline Fluxo de Dados" crumb="micro e macro, ponta a ponta" />
      <div className="content-fluid min-h-0 flex-1 overflow-y-auto py-4">
        <div className="flex flex-col gap-4">
          {/* Estado ao vivo do storage */}
          <div className="flex flex-wrap gap-2" role="status" aria-label="Estado atual do storage">
            {[
              { label: "apps no dataset", value: dataset.entries.length },
              { label: "reviews coletados", value: reviewCount },
              { label: "saídas de IA", value: aiOutputs.length },
              { label: "insights", value: insights.length },
              { label: "gerações", value: generations.length },
            ].map((c) => (
              <span key={c.label} className="rounded-md border px-2 py-1 text-xs">
                <span className="font-mono font-semibold">{c.value}</span>{" "}
                <span className="text-muted-foreground">{c.label}</span>
              </span>
            ))}
          </div>

          {/* Diagrama macro (cadeia de estágios) */}
          <div className="rounded-lg border p-3" role="region" aria-label="Mapa macro do fluxo">
            <div className="flex flex-wrap items-center gap-1">
              {FLOW_STAGES.map((s, i) => {
                const Icon = AI_MODE_ICON[s.aiMode];
                return (
                  <span key={s.id} className="flex items-center gap-1">
                    {i > 0 && <ArrowRight className="text-muted-foreground h-3 w-3" aria-hidden />}
                    <a
                      href={`#flow-${s.id}`}
                      title={s.subtitle}
                      className={cn("flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium hover:underline", AI_MODE_CLASS[s.aiMode])}
                    >
                      <Icon className="h-3 w-3" aria-hidden />
                      {s.num} {s.title}
                    </a>
                  </span>
                );
              })}
            </div>
          </div>

          {/* Filtro por modo de IA */}
          <div className="flex flex-wrap gap-1" role="group" aria-label="Filtrar por modo de IA">
            {(["todas", "sem-ia", "para-ia", "com-ia", "hibrido"] as const).map((m) => (
              <button
                key={m}
                aria-pressed={modeFilter === m}
                onClick={() => setModeFilter(m)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs",
                  modeFilter === m ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted",
                )}
              >
                {m === "todas" ? `Todas (${FLOW_STAGES.length})` : `${AI_MODE_META[m].label} (${counts[m]})`}
              </button>
            ))}
          </div>

          {/* Estágios detalhados */}
          {stages.map((s) => {
            const Icon = AI_MODE_ICON[s.aiMode];
            return (
              <ExpandableBlock
                key={s.id}
                id={`flow-${s.id}`}
                storageKey={`fluxo-dados:${s.id}`}
                title={`${s.num}. ${s.title}`}
                subtitle={s.subtitle}
                icon={<Icon className="h-4 w-4" />}
                headerRight={
                  <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", AI_MODE_CLASS[s.aiMode])}>
                    {AI_MODE_META[s.aiMode].label}
                  </span>
                }
                exportData={() => s}
                exportName={`fluxo-${s.id}`}
              >
                <div className="flex flex-col gap-3">
                  {/* Entradas / Saídas / Storage */}
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div>
                      <p className="text-muted-foreground mb-1 text-xs font-medium">Entrada</p>
                      {s.inputs.map((i) => (
                        <p key={i} className="flex items-center gap-1 text-xs">
                          <ArrowDown className="h-3 w-3 text-emerald-500" aria-hidden /> {i}
                        </p>
                      ))}
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1 text-xs font-medium">Saída</p>
                      {s.outputs.map((o) => (
                        <p key={o} className="flex items-center gap-1 text-xs">
                          <ArrowRight className="h-3 w-3 text-primary" aria-hidden /> {o}
                        </p>
                      ))}
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1 text-xs font-medium">Storage</p>
                      {s.storage?.length ? (
                        s.storage.map((k) => (
                          <p key={k} className="flex items-center gap-1 font-mono text-xs">
                            <Database className="h-3 w-3 text-amber-500" aria-hidden /> {k}
                          </p>
                        ))
                      ) : (
                        <p className="text-muted-foreground text-xs">— (transitório)</p>
                      )}
                    </div>
                  </div>

                  {/* Micro-etapas */}
                  <ol className="flex flex-col gap-2" aria-label={`Micro-etapas de ${s.title}`}>
                    {s.microSteps.map((m, i) => (
                      <li key={m.id} className="rounded-md border p-2">
                        <p className="text-xs font-medium">
                          <span className="text-muted-foreground font-mono">{s.num}.{i + 1}</span> {m.title}
                        </p>
                        <p className="text-muted-foreground mt-0.5 text-xs">{m.detail}</p>
                        {m.codeRef && (
                          <p className="mt-0.5 font-mono text-[10px] text-primary/70">{m.codeRef}</p>
                        )}
                      </li>
                    ))}
                  </ol>

                  {/* Deep links */}
                  {s.deepLinks?.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {s.deepLinks.map((l) => (
                        <Link
                          key={l.path}
                          to={l.path}
                          className="text-primary flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:underline"
                        >
                          <FileText className="h-3 w-3" aria-hidden /> {l.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              </ExpandableBlock>
            );
          })}
        </div>
      </div>
    </div>
  );
}
