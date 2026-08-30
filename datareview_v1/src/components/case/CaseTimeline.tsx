/**
 * Product journey timeline — click a stage to reveal explored/discovered/changed/why.
 */
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { CASE_TIMELINE } from "@/lib/case/caseTimeline";
import { cn } from "@/lib/utils";
import { CaseCard, CaseLabel } from "./CaseShell";

export function CaseTimeline() {
  const [activeId, setActiveId] = useState(CASE_TIMELINE[0].id);
  const navigate = useNavigate();
  const active = CASE_TIMELINE.find((s) => s.id === activeId) ?? CASE_TIMELINE[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
      {/* Stage rail */}
      <ol className="relative border-l border-border/60 space-y-1 pl-0">
        {CASE_TIMELINE.map((s) => {
          const isActive = s.id === activeId;
          return (
            <li key={s.id}>
              <button
                onClick={() => setActiveId(s.id)}
                className={cn(
                  "w-full text-left flex items-start gap-3 pl-4 pr-2 py-2 -ml-px border-l-2 transition-colors",
                  isActive ? "border-primary bg-primary/5" : "border-transparent hover:bg-secondary/40",
                )}
              >
                <span className={cn("font-mono text-[11px] tabular-nums", isActive ? "text-primary" : "text-muted-foreground/60")}>{s.index}</span>
                <span className={cn("text-xs font-medium leading-tight", isActive ? "text-foreground" : "text-muted-foreground")}>{s.title}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* Active stage detail */}
      <CaseCard className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <span className="font-mono text-[11px] text-primary/70 tracking-[0.2em]">{active.index}</span>
            <h3 className="text-lg font-bold text-foreground mt-0.5">{active.title}</h3>
          </div>
          {active.link && (
            <button
              onClick={() => navigate(active.link!.to)}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
            >
              {active.link.label} <ArrowUpRight className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <Field label="O que foi explorado">{active.explored}</Field>
          <Field label="O que descobri">{active.discovered}</Field>
          <Field label="O que mudou">{active.changed}</Field>
          <Field label="Por que mudou">{active.why}</Field>
        </div>

        <div className="mt-4 pt-4 border-t border-border/40">
          <CaseLabel hint="real">Artefato</CaseLabel>
          <p className="text-sm text-muted-foreground mt-1.5 font-mono text-xs leading-relaxed">{active.artifact}</p>
        </div>
      </CaseCard>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">{label}</p>
      <p className="text-sm text-foreground/90 leading-relaxed">{children}</p>
    </div>
  );
}
