import { ChevronRight, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EXPERIMENT_TYPES, EXPERIMENT_STATUS } from "@/lib/lab/constants";
import { describeDataset } from "@/lib/lab/datasets";
import type { LabExperiment, LabDataset } from "@/lib/lab/types";

interface Props {
  experiment: LabExperiment;
  datasets: LabDataset[];
  findingCount: number;
  onClick: () => void;
}

export function ExperimentCard({ experiment, datasets, findingCount, onClick }: Props) {
  const typeMeta = EXPERIMENT_TYPES[experiment.type];
  const statusMeta = EXPERIMENT_STATUS[experiment.status];
  const ds = experiment.datasetIds
    .map((id) => datasets.find((d) => d.id === id))
    .filter(Boolean) as LabDataset[];
  const datasetSummary =
    ds.length > 0 ? ds.map(describeDataset).join(", ") : "Dataset do Lab (todos os apps)";

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border border-border bg-card p-3.5 hover:border-primary/40 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-1">
            <span className={`inline-flex items-center gap-1 text-[9px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded border ${typeMeta.color}`}>
              <typeMeta.icon className="h-2.5 w-2.5" />
              {typeMeta.label}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`} />
              {statusMeta.label}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
            {experiment.name}
          </h3>
          {experiment.hypothesis && (
            <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">
              {experiment.hypothesis}
            </p>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground/50 flex-shrink-0 mt-0.5 group-hover:text-primary transition-colors" />
      </div>

      <div className="mt-2.5 space-y-1 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-foreground/70">Dataset:</span>
          <span className="truncate">{datasetSummary}</span>
        </div>
        {experiment.conclusion && (
          <div className="flex items-start gap-1.5">
            <span className="font-medium text-foreground/70 flex-shrink-0">Conclusão:</span>
            <span className="line-clamp-1">{experiment.conclusion}</span>
          </div>
        )}
      </div>

      <div className="mt-2.5 flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/50 pt-2">
        <div className="flex items-center gap-2">
          {findingCount > 0 && (
            <Badge variant="secondary" className="text-[9px] h-4 px-1">
              {findingCount} finding{findingCount > 1 ? "s" : ""}
            </Badge>
          )}
          {experiment.metrics && Object.keys(experiment.metrics).length > 0 && (
            <span className="text-[9px]">{Object.keys(experiment.metrics).length} métrica(s)</span>
          )}
        </div>
        <span className="flex items-center gap-1">
          <Clock className="h-2.5 w-2.5" />
          {new Date(experiment.updatedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
        </span>
      </div>
    </button>
  );
}
