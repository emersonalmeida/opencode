import { DISCOVERY_COLUMNS, PRODUCT_STATUS } from "@/lib/lab/constants";
import { ProductCandidateCard } from "./ProductCandidateCard";
import { LabEmptyState } from "./LabEmptyState";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { ProductCandidate } from "@/lib/lab/types";

interface Props {
  products: ProductCandidate[];
  onCreate: () => void;
}

/**
 * Discovery Board — Kanban de Product Candidates. Cards podem ser movidos entre
 * estados via os botões ‹ › (persiste status).
 */
export function DiscoveryBoard({ products, onCreate }: Props) {
  if (products.length === 0) {
    return (
      <LabEmptyState
        title="Nenhum produto em incubação"
        description="Quando um experimento demonstrar potencial, promova-o para Product Candidate."
        action={<Button size="sm" onClick={onCreate}><Plus className="h-3.5 w-3.5" /> Criar Product Candidate</Button>}
      />
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
      {DISCOVERY_COLUMNS.map((col) => {
        const meta = PRODUCT_STATUS[col];
        const items = products.filter((p) => p.status === col);
        return (
          <div key={col} className="rounded-xl border border-border bg-secondary/20 p-2.5 flex flex-col gap-2 min-h-[200px]">
            <div className="flex items-center justify-between px-1">
              <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <span className={`h-2 w-2 rounded-full ${meta.dot}`} /> {meta.label}
              </span>
              <span className="text-[10px] text-muted-foreground tabular-nums">{items.length}</span>
            </div>
            {items.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <span className="text-[10px] text-muted-foreground/50">vazio</span>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {items.map((p) => (
                  <ProductCandidateCard key={p.id} product={p} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
