import { useMemo, useState } from "react";
import type { DatasetEntry } from "@/lib/datasetStore";
import { evaluateAIOutput, type Evaluation, type EvaluationDimension } from "@/lib/aiEvaluation";
import { ChevronDown } from "lucide-react";

/**
 * Chip honesto de avaliação de IA: pontua 0-100 (média das 6 dimensões do
 * evaluateAIOutput) e abre uma banda com dimensões + issues. Estrutura
 * framework — sem prometer métrica de negócio.
 */
export function AIEvaluationChip({ content, entries, className }: { content?: string; entries: DatasetEntry[]; className?: string }) {
  const [open, setOpen] = useState(false);
  const evaluation: Evaluation = useMemo(
    () => (content ? evaluateAIOutput(content, entries) : { dimensions: [], issues: [], overall: undefined }),
    [content, entries],
  );
  if (evaluation.overall === undefined) return null;
  const score = evaluation.overall;
  const band = score >= 75 ? "ok" : score >= 50 ? "warn" : "bad";
  return (
    <div className={`text-[10px] ${className ?? ""}`} data-testid="ai-eval-chip">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium hover:bg-muted/40"
        aria-expanded={open}
        aria-label="Avaliação da saída de IA (estrutura framework)"
        title="Score honesto da avaliação — sem métrica de negócio."
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            band === "ok" ? "bg-status-success" : band === "warn" ? "bg-status-warning" : "bg-status-error"
          }`}
          aria-hidden="true"
        />
        Avaliação {score}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul className="mt-1 space-y-0.5 max-w-xs list-none p-0">
          {evaluation.dimensions.map((d: EvaluationDimension) => (
            <li key={d.id} className="flex items-baseline justify-between gap-2 text-[10px]">
              <span className="text-muted-foreground">{d.label}</span>
              <span className="font-medium tabular-nums">{d.score ?? "—"}</span>
            </li>
          ))}
          {evaluation.issues.length > 0 && (
            <li className="text-status-warning">⚠ {evaluation.issues.join(" · ")}</li>
          )}
        </ul>
      )}
    </div>
  );
}
