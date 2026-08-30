/**
 * Architecture Map — one dataset → many product surfaces.
 * Hover/click a surface node to see how information flows.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Database } from "lucide-react";
import { ARCHITECTURE } from "@/lib/case/caseContent";
import { cn } from "@/lib/utils";
import { CaseCard, CaseLabel } from "./CaseShell";

export function ArchitectureMap() {
  const [hovered, setHovered] = useState<string | null>(null);
  const navigate = useNavigate();
  const core = ARCHITECTURE.find((a) => a.type === "core")!;
  const surfaces = ARCHITECTURE.filter((a) => a.type === "surface");
  const active = surfaces.find((s) => s.id === hovered) ?? surfaces[0];

  return (
    <div className="space-y-4">
      <CaseCard className="p-5 sm:p-6">
        {/* Core node */}
        <div className="flex justify-center mb-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Database className="h-4 w-4" />
            <span className="text-sm font-semibold">{core.label}</span>
          </div>
        </div>

        {/* Connector lines (decorative) */}
        <div className="flex justify-center mb-2" aria-hidden>
          <div className="w-px h-4 bg-border/60" />
        </div>

        {/* Surface nodes grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
          {surfaces.map((s) => {
            const isActive = active?.id === s.id;
            return (
              <button
                key={s.id}
                onMouseEnter={() => setHovered(s.id)}
                onFocus={() => setHovered(s.id)}
                onClick={() => s.to && navigate(s.to)}
                className={cn(
                  "rounded-lg border px-2 py-2.5 text-center transition-all",
                  isActive ? "border-primary/50 bg-primary/5" : "border-border/60 bg-card/40 hover:border-border",
                )}
              >
                <span className={cn("text-xs font-medium", isActive ? "text-primary" : "text-muted-foreground")}>{s.label}</span>
              </button>
            );
          })}
        </div>
      </CaseCard>

      {/* Active surface description */}
      {active && (
        <CaseCard className="p-4 animate-fade-in-up">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CaseLabel hint="superfície do produto">{active.label}</CaseLabel>
              <p className="text-sm text-foreground/90 mt-1.5 leading-relaxed">{active.desc}</p>
            </div>
            {active.to && (
              <button
                onClick={() => navigate(active.to!)}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
              >
                Abrir <ArrowUpRight className="h-3 w-3" />
              </button>
            )}
          </div>
        </CaseCard>
      )}

      <p className="text-xs text-muted-foreground italic px-1">"Colete uma vez, reutilize em todo lugar."</p>
    </div>
  );
}
