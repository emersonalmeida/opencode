/**
 * Evolution Explorer — scrub/click through product versions V0→V3.
 */
import { useState } from "react";
import { Check, X, ArrowRight } from "lucide-react";
import { PRODUCT_EVOLUTION } from "@/lib/case/caseContent";
import { cn } from "@/lib/utils";
import { CaseCard, CaseLabel } from "./CaseShell";

export function EvolutionExplorer() {
  const [version, setVersion] = useState(0);
  const v = PRODUCT_EVOLUTION[version];

  return (
    <div className="space-y-4">
      {/* Version scrubber */}
      <div className="flex gap-1.5 flex-wrap" role="tablist" aria-label="Versões do produto">
        {PRODUCT_EVOLUTION.map((pv, i) => (
          <button
            key={pv.version}
            role="tab"
            aria-selected={i === version}
            onClick={() => setVersion(i)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all",
              i === version ? "border-primary bg-primary/5 text-foreground" : "border-border/60 text-muted-foreground hover:border-border",
            )}
          >
            <span className="font-mono font-semibold">{pv.version}</span>
            <span className="hidden sm:inline">{pv.label}</span>
          </button>
        ))}
      </div>

      <CaseCard className="p-5 sm:p-6">
        {/* Flow diagram (reconstructed, no fake screenshots) */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          {v.flow.map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground text-[11px] font-medium">{step}</span>
              {i < v.flow.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground/50" aria-hidden />}
            </div>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <CaseLabel>Hipótese</CaseLabel>
            <p className="text-sm text-foreground/90 mt-1 leading-relaxed">{v.hypothesis}</p>
          </div>
          <div>
            <CaseLabel>Resultado</CaseLabel>
            <ul className="mt-1 space-y-2">
              <li className="flex items-start gap-2 text-xs">
                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-foreground/90"><span className="font-medium text-emerald-600 dark:text-emerald-400">Funcionou: </span>{v.worked}</span>
              </li>
              <li className="flex items-start gap-2 text-xs">
                <X className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                <span className="text-foreground/90"><span className="font-medium text-destructive">Não funcionou: </span>{v.didNot}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border/40">
          <CaseLabel>Próxima mudança</CaseLabel>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{v.changedNext}</p>
        </div>
      </CaseCard>

      {/* Navigation between versions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setVersion((v) => Math.max(0, v - 1))}
          disabled={version === 0}
          className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
        >
          ← {PRODUCT_EVOLUTION[Math.max(0, version - 1)]?.version}
        </button>
        <span className="text-[10px] text-muted-foreground font-mono">{version + 1} / {PRODUCT_EVOLUTION.length}</span>
        <button
          onClick={() => setVersion((v) => Math.min(PRODUCT_EVOLUTION.length - 1, v + 1))}
          disabled={version === PRODUCT_EVOLUTION.length - 1}
          className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
        >
          {PRODUCT_EVOLUTION[Math.min(PRODUCT_EVOLUTION.length - 1, version + 1)]?.version} →
        </button>
      </div>
    </div>
  );
}
