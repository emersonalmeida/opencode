/**
 * Technical Discovery — inspect each data source (why/solves/tradeoffs/limitations).
 */
import { useState } from "react";
import { Apple, ShoppingBag, Database, ChevronDown } from "lucide-react";
import { DATA_SOURCES } from "@/lib/case/caseContent";
import { cn } from "@/lib/utils";
import { CaseCard, CaseLabel, CaseTag } from "./CaseShell";

export function TechnicalDiscovery() {
  const [activeId, setActiveId] = useState(DATA_SOURCES[0].id);
  const active = DATA_SOURCES.find((d) => d.id === activeId) ?? DATA_SOURCES[0];
  const StoreIcon = active.store === "apple" ? Apple : active.store === "google" ? ShoppingBag : Database;

  return (
    <div className="space-y-4">
      {/* Source tabs */}
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Fontes de dados">
        {DATA_SOURCES.map((d) => {
          const Icon = d.store === "apple" ? Apple : d.store === "google" ? ShoppingBag : Database;
          return (
            <button
              key={d.id}
              role="tab"
              aria-selected={d.id === activeId}
              onClick={() => setActiveId(d.id)}
              className={cn(
                "inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border transition-colors",
                d.id === activeId ? "border-primary/50 bg-primary/5 text-foreground" : "border-border/60 text-muted-foreground hover:border-border",
              )}
            >
              <Icon className="h-3 w-3" /> {d.name}
            </button>
          );
        })}
      </div>

      <CaseCard className="p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <StoreIcon className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{active.name}</h3>
            {active.yield && <p className="text-[10px] text-muted-foreground">{active.yield}</p>}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <CaseLabel>Por que existe</CaseLabel>
            <p className="text-xs text-foreground/80 mt-1 leading-relaxed">{active.why}</p>
          </div>
          <div>
            <CaseLabel>O que resolve</CaseLabel>
            <p className="text-xs text-foreground/80 mt-1 leading-relaxed">{active.solves}</p>
          </div>
          <div>
            <CaseLabel tone="warn">Tradeoffs</CaseLabel>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{active.tradeoffs}</p>
          </div>
          <div>
            <CaseLabel>Limitações</CaseLabel>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{active.limitations}</p>
          </div>
        </div>
      </CaseCard>
    </div>
  );
}
