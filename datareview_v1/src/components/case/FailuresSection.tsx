/**
 * What changed my mind — failures/iterations with assumption → observation → change → current.
 */
import { FAILURES } from "@/lib/case/caseContent";
import { CaseCard, CaseLabel } from "./CaseShell";

export function FailuresSection() {
  return (
    <div className="space-y-3">
      {FAILURES.map((f, i) => (
        <CaseCard key={f.id} className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="font-mono text-[11px] text-muted-foreground/50 mt-0.5">{String(i + 1).padStart(2, "0")}</span>
            <div className="flex-1 min-w-0 space-y-3">
              <div>
                <CaseLabel tone="warn">Suposição inicial</CaseLabel>
                <p className="text-sm text-foreground/90 mt-1 leading-relaxed">{f.assumption}</p>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <CaseLabel>Observação</CaseLabel>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{f.observation}</p>
                </div>
                <div>
                  <CaseLabel>Mudança</CaseLabel>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{f.change}</p>
                </div>
                <div>
                  <CaseLabel tone="primary">Estado atual</CaseLabel>
                  <p className="text-xs text-foreground/80 mt-1 leading-relaxed">{f.current}</p>
                </div>
              </div>
            </div>
          </div>
        </CaseCard>
      ))}
    </div>
  );
}
