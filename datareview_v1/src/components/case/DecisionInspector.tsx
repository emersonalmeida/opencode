/**
 * Decision Inspector — compact decision cards; click to inspect context/options/tradeoff.
 */
import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { DESIGN_DECISIONS } from "@/lib/case/caseDecisions";
import { cn } from "@/lib/utils";
import { CaseCard, CaseLabel } from "./CaseShell";

export function DecisionInspector() {
  const [openId, setOpenId] = useState<string | null>(DESIGN_DECISIONS[0].id);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {DESIGN_DECISIONS.map((d) => {
        const open = openId === d.id;
        return (
          <CaseCard key={d.id} interactive className="overflow-hidden">
            <button
              onClick={() => setOpenId(open ? null : d.id)}
              aria-expanded={open}
              className="w-full text-left p-4 flex items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">Decisão</p>
                <h3 className="text-sm font-semibold text-foreground leading-snug">{d.question}</h3>
              </div>
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform", open && "rotate-180")} />
            </button>

            {open && (
              <div className="px-4 pb-4 space-y-3 animate-fade-in-up border-t border-border/40 pt-4">
                <div>
                  <CaseLabel>Contexto</CaseLabel>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{d.context}</p>
                </div>
                <div>
                  <CaseLabel>Opções</CaseLabel>
                  <ul className="mt-1.5 space-y-1.5">
                    {d.options.map((o) => (
                      <li key={o.label} className={cn("flex items-start gap-2 text-xs", o.chosen ? "text-foreground" : "text-muted-foreground")}>
                        {o.chosen ? <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" /> : <span className="w-3.5 shrink-0" />}
                        <span>
                          <span className="font-medium">{o.label}</span> — {o.description}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <CaseLabel tone="primary">Decisão</CaseLabel>
                    <p className="text-xs text-foreground mt-1 leading-relaxed font-medium">{d.decision}</p>
                  </div>
                  <div>
                    <CaseLabel tone="warn">Tradeoff</CaseLabel>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{d.tradeoff}</p>
                  </div>
                </div>
                <div>
                  <CaseLabel>Resultado</CaseLabel>
                  <p className="text-xs text-foreground/80 mt-1 leading-relaxed">{d.result}</p>
                </div>
              </div>
            )}
          </CaseCard>
        );
      })}
    </div>
  );
}
