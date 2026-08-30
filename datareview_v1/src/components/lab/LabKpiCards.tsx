import { FlaskConical, CheckCircle2, Brain, Sparkles, Package, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { LabExperiment, LabFinding, ProductCandidate } from "@/lib/lab/types";

interface Props {
  experiments: LabExperiment[];
  findings: LabFinding[];
  products: ProductCandidate[];
}

/** KPIs do Lab — experimentos, concluídos, findings, candidatos, promovidos. */
export function LabKpiCards({ experiments, findings, products }: Props) {
  const completed = experiments.filter((e) => e.status === "completed" || e.status === "promote").length;
  const validatedFindings = findings.filter((f) => f.status === "validated").length;
  const promoted = products.filter((p) => p.status === "promoted").length;
  const running = experiments.filter((e) => e.status === "running").length;
  const iterate = experiments.filter((e) => e.status === "iterate").length;
  const totalExps = experiments.length;
  const validationRate = totalExps > 0 ? Math.round((validatedFindings / totalExps) * 100) : 0;
  const promotionRate = completed > 0 ? Math.round((promoted / completed) * 100) : 0;

  const cards: { label: string; value: number | string; icon: LucideIcon; sub?: string; color: string }[] = [
    { label: "Experimentos", value: totalExps, icon: FlaskConical, color: "text-blue-500", sub: `${running} em andamento` },
    { label: "Concluídos", value: completed, icon: CheckCircle2, color: "text-emerald-500", sub: `${iterate} p/ iterar` },
    { label: "Findings", value: findings.length, icon: Brain, color: "text-violet-500", sub: `${validatedFindings} validadas` },
    { label: "Candidatos", value: products.length, icon: Package, color: "text-amber-500", sub: `${promotionRate}% promovidos` },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-xl border border-border bg-card p-3 hover:border-primary/30 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {c.label}
            </span>
            <c.icon className={`h-4 w-4 ${c.color}`} />
          </div>
          <div className="mt-1.5 text-2xl font-bold tabular-nums text-foreground">{c.value}</div>
          {c.sub && <div className="text-[10px] text-muted-foreground">{c.sub}</div>}
        </div>
      ))}
      <div className="col-span-2 lg:col-span-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
          <TrendingUp className="h-4 w-4 text-violet-500" />
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Taxa de validação</div>
            <div className="text-sm font-semibold text-foreground tabular-nums">{validationRate}%</div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Taxa de promoção</div>
            <div className="text-sm font-semibold text-foreground tabular-nums">{promotionRate}%</div>
          </div>
        </div>
      </div>
    </div>
  );
}
