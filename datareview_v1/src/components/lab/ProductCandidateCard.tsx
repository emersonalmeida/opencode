import { useState } from "react";
import { Package, ChevronRight, Edit2, FlaskConical, Database, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PRODUCT_STATUS } from "@/lib/lab/constants";
import { ScoreBar } from "./OpportunityScore";
import { ProductCandidateDialog } from "./ProductCandidateDialog";
import { useLabExperiments, useLabFindings, useLabDatasets } from "@/lib/lab/hooks";
import { saveProductCandidate } from "@/lib/lab/repository";
import type { ProductCandidate, ProductStatus } from "@/lib/lab/types";

interface Props {
  product: ProductCandidate;
  onNavigate?: (path: string) => void;
}

const COLUMN_ORDER: ProductStatus[] = ["idea", "validating", "prototype", "business-test", "promoted"];

export function ProductCandidateCard({ product }: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const meta = PRODUCT_STATUS[product.status];
  const score = product.opportunityScore;
  const experiments = useLabExperiments();
  const findings = useLabFindings();
  const datasets = useLabDatasets();
  const expCount = product.evidence.experimentIds.length;
  const findingCount = product.evidence.findingIds.length;
  const dsCount = product.evidence.datasetIds.length;
  const reviewCount = datasets
    .filter((d) => product.evidence.datasetIds.includes(d.id))
    .reduce((s, d) => s + d.reviewCount, 0);

  const cycleStatus = (dir: 1 | -1) => {
    const idx = COLUMN_ORDER.indexOf(product.status);
    if (idx < 0) return;
    const next = Math.max(0, Math.min(COLUMN_ORDER.length - 1, idx + dir));
    saveProductCandidate({ ...product, status: COLUMN_ORDER[next], promotedAt: COLUMN_ORDER[next] === "promoted" ? new Date().toISOString() : product.promotedAt });
  };

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-3 hover:border-primary/30 transition-colors">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-1">
              <Package className="h-3.5 w-3.5 text-primary flex-shrink-0" />
              <span className="text-[9px] uppercase tracking-wide font-medium text-muted-foreground">
                {product.vertical || "Sem nicho"}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-foreground truncate">{product.name}</h3>
          </div>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditOpen(true)} aria-label="Editar candidato">
            <Edit2 className="h-3 w-3" />
          </Button>
        </div>

        {product.problem && (
          <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">{product.problem}</p>
        )}

        <div className="mt-2.5">
          <div className="flex items-center justify-between text-[10px] mb-1">
            <span className="text-muted-foreground">Opportunity Score (experimental)</span>
            <span className="font-semibold tabular-nums text-foreground">{typeof score === "number" ? score : "—"}/100</span>
          </div>
          {typeof score === "number" && <ScoreBar value={score} />}
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
          {expCount > 0 && <span className="flex items-center gap-1"><FlaskConical className="h-2.5 w-2.5" />{expCount} exp.</span>}
          {dsCount > 0 && <span className="flex items-center gap-1"><Database className="h-2.5 w-2.5" />{reviewCount.toLocaleString("pt-BR")} reviews</span>}
          {findingCount > 0 && <span className="flex items-center gap-1"><FileText className="h-2.5 w-2.5" />{findingCount} findings</span>}
        </div>

        <div className="mt-2.5 flex items-center justify-between border-t border-border/50 pt-2">
          <span className={`flex items-center gap-1 text-[10px]`}>
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} /> {meta.label}
          </span>
          <div className="flex items-center gap-0.5">
            <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]" onClick={() => cycleStatus(-1)} aria-label="Mover para trás">‹</Button>
            <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]" onClick={() => cycleStatus(1)} aria-label="Avançar">›</Button>
          </div>
        </div>
      </div>
      <ProductCandidateDialog open={editOpen} onOpenChange={setEditOpen} productId={product.id} />
    </>
  );
}
