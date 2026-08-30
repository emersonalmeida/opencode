import { useState } from "react";
import { cn } from "@/lib/utils";
import { SCORE_DIMENSIONS, scoreLabel, computeOpportunityScore } from "@/lib/lab/scoring";
import type { ProductScores } from "@/lib/lab/types";

interface Props {
  scores?: ProductScores;
  value?: number;
  onChange?: (scores: ProductScores) => void;
  readOnly?: boolean;
}

/**
 * Opportunity Score (experimental) — média ponderada de dimensões 0–100.
 * Os pesos ficam centralizados em scoring.ts. Apresentado como experimental,
 * nunca como verdade objetiva.
 */
export function OpportunityScore({ scores, value, onChange, readOnly }: Props) {
  const [open, setOpen] = useState(false);
  const score = value ?? computeFromScores(scores);
  const label = scoreLabel(typeof score === "number" ? score : undefined);

  const update = (key: keyof ProductScores, n: number) => {
    onChange?.({ ...(scores || {}), [key]: n });
  };

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Opportunity Score
            </span>
            <span className="text-[9px] uppercase tracking-wide rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1 py-0.5">
              experimental
            </span>
          </div>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-2xl font-bold tabular-nums text-foreground">
              {typeof score === "number" ? score : "—"}
            </span>
            {typeof score === "number" && (
              <span className="text-xs text-muted-foreground">/100</span>
            )}
            <span className="text-xs text-muted-foreground">· {label}</span>
          </div>
        </div>
        {!readOnly && onChange && (
          <button
            onClick={() => setOpen((o) => !o)}
            className="text-[10px] px-2 py-1 rounded-md border border-border hover:bg-secondary transition-colors"
            aria-label="Ajustar dimensões do score"
          >
            {open ? "Fechar" : "Ajustar"}
          </button>
        )}
      </div>
      {open && !readOnly && (
        <div className="mt-3 space-y-2.5 border-t border-border/50 pt-3">
          {SCORE_DIMENSIONS.map((dim) => {
            const v = scores?.[dim.key];
            return (
              <div key={dim.key}>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-medium text-foreground">
                    {dim.label}
                    <span className="text-muted-foreground ml-1">· {Math.round(dim.weight * 100)}%</span>
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {typeof v === "number" ? v : "—"}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={typeof v === "number" ? v : 0}
                  onChange={(e) => update(dim.key, parseInt(e.target.value, 10))}
                  className="w-full h-1 accent-primary"
                  aria-label={dim.label}
                />
                <p className="text-[9px] text-muted-foreground">{dim.hint}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function computeFromScores(scores?: ProductScores): number | undefined {
  if (!scores) return undefined;
  return computeOpportunityScore(scores);
}

export function ScoreBar({ value, className }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  const color =
    pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-violet-500" : pct >= 40 ? "bg-amber-500" : "bg-destructive";
  return (
    <div className={cn("h-1.5 w-full rounded-full bg-secondary overflow-hidden", className)}>
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}
