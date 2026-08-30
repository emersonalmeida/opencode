/**
 * Interactive opening system diagram: DATA → AI → PRODUCT → DECISION.
 * Hover/focus a stage to reveal a short explanation. No over-animation.
 */
import { useState } from "react";
import { Database, BrainCircuit, LayoutGrid, Crosshair, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Stage {
  id: string;
  label: string;
  icon: typeof Database;
  desc: string;
}

const STAGES: Stage[] = [
  { id: "data", label: "Reviews", icon: Database, desc: "Coleta de fontes reais da App Store e Google Play, dedup por id, persistência local." },
  { id: "ai", label: "Análise de IA", icon: BrainCircuit, desc: "IA local ou cloud, streaming, evidência estruturada em cada afirmação." },
  { id: "product", label: "Produto", icon: LayoutGrid, desc: "Um dataset alimenta muitas superfícies: dashboard, chat, canvas, compare." },
  { id: "decision", label: "Decisão", icon: Crosshair, desc: "Insights auditáveis viram decisões de produto com persona e ROI." },
];

export function SystemDiagram() {
  const [active, setActive] = useState<string>("data");
  const current = STAGES.find((s) => s.id === active) ?? STAGES[0];

  return (
    <div className="space-y-4">
      {/* Horizontal flow (desktop) / vertical (mobile) */}
      <div className="flex flex-col md:flex-row md:items-stretch gap-2 md:gap-1">
        {STAGES.map((s, i) => {
          const Icon = s.icon;
          const isActive = active === s.id;
          return (
            <div key={s.id} className="flex items-center gap-1 flex-1">
              <button
                onMouseEnter={() => setActive(s.id)}
                onFocus={() => setActive(s.id)}
                onClick={() => setActive(s.id)}
                aria-expanded={isActive}
                className={cn(
                  "flex-1 group rounded-xl border px-3 py-3 text-left transition-all",
                  isActive
                    ? "border-primary/50 bg-primary/5 shadow-sm"
                    : "border-border/60 bg-card/40 hover:border-border",
                )}
              >
                <span className="flex items-center gap-2">
                  <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg transition-colors", isActive ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground")}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className={cn("text-xs font-medium", isActive ? "text-foreground" : "text-muted-foreground")}>{s.label}</span>
                </span>
              </button>
              {i < STAGES.length - 1 && (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40 rotate-90 md:rotate-0 shrink-0" aria-hidden />
              )}
            </div>
          );
        })}
      </div>

      {/* Active explanation */}
      <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 min-h-[3.5rem] flex items-center">
        <p className="text-sm text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground">{current.label}: </span>
          {current.desc}
        </p>
      </div>
    </div>
  );
}
