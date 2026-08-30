/**
 * StageFlow — visualização do grafo de conhecimento do pipeline.
 *
 * Mostra os 5 estágios como uma cadeia DATASET → FATOS → EXTRAÇÃO IA →
 * RACIOCÍNIO → ESTRATÉGIA, com contagens ao vivo (reviews no dataset,
 * artefatos por estágio) e uma seta de retorno que representa o loop de
 * descoberta (a IA pedindo novas análises).
 */
import { MoveRight, RotateCcw } from "lucide-react";
import { STAGE_META, STAGE_ORDER, type PipelineArtifact } from "@/lib/pipeline/types";
import type { DatasetEntry } from "@/lib/datasetStore";
import { cn } from "@/lib/utils";

interface Props {
  entries: DatasetEntry[];
  artifacts: PipelineArtifact[];
  /** Estágio atualmente em execução (pulsa). */
  activeStage?: string | null;
}

export function StageFlow({ entries, artifacts, activeStage }: Props) {
  const totalReviews = entries.reduce((s, e) => s + e.reviews.length, 0);
  const countByStage = (stage: string) => artifacts.filter((a) => a.stage === stage).length;

  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-2">
      <div className="flex items-stretch gap-1">
        {STAGE_ORDER.map((stage, i) => {
          const meta = STAGE_META[stage];
          const Icon = meta.icon;
          const count = stage === "data" ? totalReviews : countByStage(stage);
          const sub = stage === "data" ? `${entries.length} app(s)` : `${count} artefato(s)`;
          const active = activeStage === stage;
          return (
            <div key={stage} className="flex items-center gap-1 flex-1 min-w-0">
              <div
                className={cn(
                  "flex-1 min-w-0 rounded-md border px-2 py-1.5 transition-all",
                  meta.color,
                  active && "ring-2 ring-primary/60 animate-pulse",
                )}
                title={meta.description}
              >
                <div className="flex items-center gap-1">
                  <Icon className={cn("h-3 w-3 flex-shrink-0", meta.textColor)} />
                  <span className="text-[10px] font-semibold text-foreground truncate">{meta.short}</span>
                </div>
                <p className="text-[10px] text-muted-foreground tabular-nums truncate">
                  <span className="font-bold text-foreground">{count}</span> · {sub}
                </p>
              </div>
              {i < STAGE_ORDER.length - 1 && (
                <MoveRight className="h-3 w-3 text-muted-foreground/50 flex-shrink-0" aria-hidden />
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-1 mt-1 px-1">
        <RotateCcw className="h-2.5 w-2.5 text-primary/70" aria-hidden />
        <p className="text-[9px] text-muted-foreground">
          fluxo não-linear: cada artefato alimenta os próximos estágios — e a IA pode pedir novas análises (loop de descoberta)
        </p>
      </div>
    </div>
  );
}
