import { ShieldCheck, ShieldAlert, ShieldX, ExternalLink } from "lucide-react";
import { FINDING_TYPES, FINDING_STATUS } from "@/lib/lab/constants";
import type { LabFinding } from "@/lib/lab/types";

interface Props {
  finding: LabFinding;
  onOpenExperiment?: (experimentId: string) => void;
}

export function FindingCard({ finding, onOpenExperiment }: Props) {
  const typeMeta = FINDING_TYPES[finding.type];
  const statusMeta = FINDING_STATUS[finding.status];
  const validation = finding.evidence?.validation;

  return (
    <div className="rounded-xl border border-border bg-card p-3 hover:border-primary/30 transition-colors">
      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
        <span className={`text-[9px] uppercase font-medium px-1.5 py-0.5 rounded border ${typeMeta.color}`}>
          {typeMeta.label}
        </span>
        <span className={`text-[9px] uppercase font-medium px-1.5 py-0.5 rounded border ${statusMeta.color}`}>
          {statusMeta.label}
        </span>
        {typeof finding.confidence === "number" && (
          <span className="text-[10px] text-muted-foreground">
            confiança {Math.round(finding.confidence * 100)}%
          </span>
        )}
      </div>
      <h4 className="text-sm font-semibold text-foreground">{finding.title}</h4>
      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-3">{finding.description}</p>

      {validation && (
        <div className={`mt-2 flex items-center gap-1.5 text-[10px] ${
          validation.status === "valid"
            ? "text-emerald-600 dark:text-emerald-400"
            : validation.status === "failed"
            ? "text-destructive"
            : "text-muted-foreground"
        }`}>
          {validation.status === "valid" ? <ShieldCheck className="h-3 w-3" /> : validation.status === "failed" ? <ShieldAlert className="h-3 w-3" /> : <ShieldX className="h-3 w-3" />}
          {validation.status === "valid"
            ? "Evidência validada"
            : validation.status === "failed"
            ? "Evidence validation failed"
            : "Não verificada"}
        </div>
      )}

      {finding.evidence?.quotes && finding.evidence.quotes.length > 0 && (
        <blockquote className="mt-2 text-[11px] italic text-muted-foreground border-l-2 border-border pl-2">
          {finding.evidence.quotes[0]}
        </blockquote>
      )}

      {onOpenExperiment && finding.experimentId && (
        <button
          onClick={() => onOpenExperiment(finding.experimentId)}
          className="mt-2 flex items-center gap-1 text-[10px] text-primary hover:underline"
        >
          Ver experimento <ExternalLink className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
}
