import { ArrowRight } from "lucide-react";
import { PIPELINE_STAGES } from "@/lib/lab/constants";

interface Props {
  /** Contagens por etapa (para mostrar densidade). */
  counts?: Record<string, number>;
  onStageClick?: (stage: string) => void;
}

/**
 * Pipeline conceitual de descoberta — Dataset→Experimento→Finding→Validação→Produto.
 * Cada etapa é clicável e mostra a contagem (quando houver).
 */
export function LabPipeline({ counts = {}, onStageClick }: Props) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 overflow-x-auto">
      <div className="flex items-center gap-2 min-w-max">
        {PIPELINE_STAGES.map((stage, i) => {
          const c = counts[stage.key] ?? 0;
          const active = c > 0;
          return (
            <div key={stage.key} className="flex items-center gap-2">
              <button
                onClick={() => onStageClick?.(stage.key)}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg border transition-colors min-w-[88px] ${
                  active
                    ? "border-primary/30 bg-primary/5 hover:bg-primary/10"
                    : "border-border bg-secondary/30 hover:bg-secondary/60"
                }`}
                aria-label={`Etapa ${stage.label}`}
              >
                <stage.icon className={`h-4 w-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-[10px] font-medium text-foreground">{stage.label}</span>
                <span className="text-[9px] tabular-nums text-muted-foreground">{c}</span>
              </button>
              {i < PIPELINE_STAGES.length - 1 && (
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/60 flex-shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
