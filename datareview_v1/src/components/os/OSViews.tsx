/**
 * Nexus OS — as 4 views da coluna central:
 *
 *  - OSOverview: KPIs + gráficos determinísticos do dataset (sem IA);
 *  - OSAnalises: grid das 12 seções de IA com execução sob demanda + output;
 *  - OSFluxos: agentes (pipelines executáveis) com status por etapa + output;
 *  - OSInsights: recomendações proativas do motor de aprendizado.
 */
import { useMemo, useState } from "react";
import {
  AlertTriangle, CheckCircle2, Circle, Database, FileText, Lightbulb,
  Loader2, MessageSquare, Play, Star, TrendingUp, XCircle,
} from "lucide-react";
import type { DatasetEntry } from "@/lib/datasetStore";
import {
  computeKPIs, computePerAppStats, computeRatingDistribution, computeSentiment,
  computeTimeline,
} from "@/lib/dashboardAnalytics";
import {
  AggregateRatingChart, AggregateSentimentChart, AggregateTimelineChart,
  KpiCard, PerAppRow,
} from "@/components/dashboard/DashboardCharts";
import { WordCloud } from "@/components/WordCloud";
import { AIOutputCard } from "@/components/shared/AIOutputCard";
import { AIDisabledNotice } from "@/components/shared/AIDisabledNotice";
import { EXPERIMENT_SECTIONS } from "@/lib/experimentSections";
import { BUILTIN_AGENTS, type GeneratorAgent } from "@/lib/agents";
import type { OSInsight } from "@/lib/os/memory";
import { cn } from "@/lib/utils";

/* ------------------------------------------------- tipos de execução ---- */

export interface SectionRun {
  status: "idle" | "running" | "done" | "error";
  text: string;
}

export interface AgentRun {
  running: boolean;
  /** status/output por etapa do pipeline do agente. */
  steps: Array<{ status: "pending" | "running" | "done" | "error"; output: string }>;
}

export const STATUS_BADGE: Record<SectionRun["status"], { label: string; className: string }> = {
  idle: { label: "não gerada", className: "text-muted-foreground" },
  running: { label: "gerando…", className: "text-primary" },
  done: { label: "pronta", className: "text-emerald-600 dark:text-emerald-400" },
  error: { label: "erro", className: "text-destructive" },
};

/* ------------------------------------------------------------ Overview --- */

export function OSOverview({ entries }: { entries: DatasetEntry[] }) {
  const reviews = useMemo(() => entries.flatMap((e) => e.reviews), [entries]);
  const kpis = useMemo(() => computeKPIs(reviews, entries), [reviews, entries]);
  const dist = useMemo(() => computeRatingDistribution(reviews), [reviews]);
  const sentiment = useMemo(() => computeSentiment(reviews), [reviews]);
  const timeline = useMemo(() => computeTimeline(reviews), [reviews]);
  const perApp = useMemo(() => computePerAppStats(entries), [entries]);

  if (entries.length === 0) {
    return <OSEmptyData />;
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
        <KpiCard label="Apps" value={kpis.totalApps} icon={Database} />
        <KpiCard label="Reviews" value={kpis.totalReviews.toLocaleString("pt-BR")} icon={MessageSquare} />
        <KpiCard label="Nota média" value={kpis.avgRating.toFixed(2)} icon={Star} />
        <KpiCard label="Positivo" value={`${kpis.positivePct}%`} icon={TrendingUp} accent="success" />
        <KpiCard label="Negativo" value={`${kpis.negativePct}%`} icon={AlertTriangle} accent={kpis.negativePct > 30 ? "destructive" : "warning"} />
        <KpiCard label="Lojas" value={kpis.storeCount} icon={FileText} sub={kpis.storeCount === 2 ? "Apple + Google" : "1 loja"} />
      </div>

      {/* Gráficos */}
      <div className="grid lg:grid-cols-2 gap-3">
        <ChartCard title="Distribuição de notas" height="h-52">
          <AggregateRatingChart data={dist} />
        </ChartCard>
        <ChartCard title="Sentimento" height="h-52">
          <AggregateSentimentChart data={sentiment} />
        </ChartCard>
      </div>

      {timeline.length > 0 && (
        <ChartCard title="Timeline (nota média + volume)" height="h-56">
          <AggregateTimelineChart data={timeline} />
        </ChartCard>
      )}

      {/* Tabela por app */}
      <section className="rounded-xl border border-border/60 bg-card/40 overflow-hidden">
        <header className="px-3 py-2 border-b border-border/50">
          <h3 className="text-xs font-semibold text-foreground">Apps no escopo</h3>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-secondary/30">
                {["App", "Loja", "Nota loja", "Nº reviews loja", "Média coletada", "% pos", "% neg", "Resp. dev", "Temas"].map((h) => (
                  <th key={h} className="px-3 py-2 text-[10px] font-medium text-muted-foreground text-center whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {perApp.map((stat) => <PerAppRow key={stat.key} stat={stat} />)}
            </tbody>
          </table>
        </div>
      </section>

      {/* Nuvem de termos */}
      <section className="rounded-xl border border-border/60 bg-card/40 p-3">
        <h3 className="text-xs font-semibold text-foreground mb-2">Termos mais frequentes</h3>
        <WordCloud reviews={reviews} />
      </section>
    </div>
  );
}

function ChartCard({ title, height, children }: { title: string; height: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border/60 bg-card/40 p-3">
      <h3 className="text-xs font-semibold text-foreground mb-2">{title}</h3>
      <div className={height}>{children}</div>
    </section>
  );
}

function OSEmptyData() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-6">
      <Database className="h-12 w-12 text-muted-foreground/30 mb-3" />
      <h2 className="text-base font-semibold text-foreground">O OS trabalha com dados reais</h2>
      <p className="text-sm text-muted-foreground mt-1 max-w-md">
        Colete um app na aba "Ações" (esquerda) ou pelo console com <code className="text-primary">/collect nubank</code>.
        KPIs, gráficos e todas as análises passam a ser computados sobre dados reais.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ Análises --- */

export function OSAnalises({
  entries, runs, aiOn, onRun,
}: {
  entries: DatasetEntry[];
  runs: Record<string, SectionRun | undefined>;
  aiOn: boolean;
  onRun: (id: string) => void;
}) {
  const [active, setActive] = useState<string | null>(null);
  const aiSections = EXPERIMENT_SECTIONS.filter((s) => s.kind === "ai");
  const activeRun = active ? runs[active] : undefined;

  if (entries.length === 0) return <OSEmptyData />;

  const handleRun = (id: string) => {
    setActive(id);
    onRun(id);
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Grid de seções */}
      <div className="p-3 grid sm:grid-cols-2 xl:grid-cols-3 gap-2 flex-shrink-0 max-h-[45%] overflow-y-auto">
        {aiSections.map((s) => {
          const run = runs[s.id];
          const status = run?.status ?? "idle";
          const badge = STATUS_BADGE[status];
          return (
            <button
              key={s.id}
              onClick={() => (status === "done" || status === "error" ? setActive(s.id) : handleRun(s.id))}
              disabled={!aiOn && status === "idle"}
              title={s.description}
              className={cn(
                "relative text-left rounded-lg border p-2.5 transition-all",
                active === s.id ? "border-primary bg-primary/5" : "border-border/60 bg-card/40 hover:border-primary/40",
                !aiOn && status === "idle" && "opacity-50",
              )}
            >
              <div className="flex items-center gap-1.5">
                <s.icon className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                <span className="text-[11px] font-semibold text-foreground truncate">{s.label}</span>
                {status === "running" && <Loader2 className="h-3 w-3 animate-spin text-primary ml-auto" />}
              </div>
              <p className="text-[9px] text-muted-foreground mt-0.5 line-clamp-2">{s.description}</p>
              <span className={cn("text-[8px] mt-1 inline-block", badge.className)}>{badge.label}</span>
            </button>
          );
        })}
      </div>

      {/* Output */}
      <div className="flex-1 min-h-0 border-t border-border/50 bg-background/40">
        {!active ? (
          <div className="h-full flex items-center justify-center p-6">
            {aiOn ? (
              <p className="text-xs text-muted-foreground text-center">Selecione uma seção para gerar ou visualizar.</p>
            ) : (
              <AIDisabledNotice className="max-w-sm" />
            )}
          </div>
        ) : (
          <div className="h-full overflow-y-auto p-4">
            <div className="relative rounded-lg border border-border/60 bg-card/60 p-4">
              <h3 className="text-sm font-semibold text-foreground mb-2">
                {EXPERIMENT_SECTIONS.find((s) => s.id === active)?.label}
                {activeRun?.status === "running" && <Loader2 className="inline h-3.5 w-3.5 animate-spin text-primary ml-2" />}
              </h3>
              {activeRun?.text ? (
                <AIOutputCard
                  bare
                  content={activeRun.text}
                  filename={`os-${active}`}
                  streaming={activeRun.status === "running"}
                  storageKey={`os-section-${active}`}
                  onRegenerate={activeRun.status === "running" || !aiOn ? undefined : () => onRun(active)}
                />
              ) : (
                <p className="text-xs text-muted-foreground">
                  {activeRun?.status === "running" ? "Streaming iniciado…" : "Sem conteúdo."}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- Fluxos --- */

export function OSFluxos({
  entries, runs, aiOn, onRun,
}: {
  entries: DatasetEntry[];
  runs: Record<string, AgentRun | undefined>;
  aiOn: boolean;
  onRun: (agent: GeneratorAgent) => void;
}) {
  const [showOutput, setShowOutput] = useState<string | null>(null);

  if (entries.length === 0) return <OSEmptyData />;

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {BUILTIN_AGENTS.map((agent) => {
          const run = runs[agent.id];
          const lastOutput = [...(run?.steps ?? [])].reverse().find((s) => s.output);
          const expanded = showOutput === agent.id;
          return (
            <article key={agent.id} className="rounded-xl border border-border/60 bg-card/40 p-3 flex flex-col">
              <div className="flex items-start gap-2 mb-2">
                <agent.icon className="h-4 w-4 text-primary mt-0.5" />
                <div className="min-w-0 flex-1">
                  <h3 className="text-xs font-semibold text-foreground">{agent.label}</h3>
                  <p className="text-[9px] text-muted-foreground">{agent.tagline}</p>
                </div>
                <button
                  onClick={() => onRun(agent)}
                  disabled={!aiOn || run?.running}
                  aria-label={`Executar agente ${agent.label}`}
                  className="p-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {run?.running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                </button>
              </div>

              {/* Pipeline de etapas */}
              <ol className="space-y-1 flex-1">
                {agent.pipeline.map((step, i) => {
                  const st = run?.steps[i]?.status ?? "pending";
                  const Icon = st === "done" ? CheckCircle2 : st === "error" ? XCircle : st === "running" ? Loader2 : Circle;
                  const spinning = st === "running";
                  return (
                    <li key={i} className="flex items-center gap-1.5 text-[10px]">
                      <Icon className={cn("h-3 w-3 flex-shrink-0", spinning && "animate-spin text-primary", st === "done" && "text-emerald-500", st === "error" && "text-destructive", st === "pending" && "text-muted-foreground/40")} />
                      <span className={cn(st === "pending" ? "text-muted-foreground/60" : "text-foreground")}>{step.label}</span>
                    </li>
                  );
                })}
              </ol>

              {lastOutput && !run?.running && (
                <button
                  onClick={() => setShowOutput(expanded ? null : agent.id)}
                  aria-expanded={expanded}
                  className="mt-2 text-[10px] text-primary hover:underline text-left"
                >
                  {expanded ? "Ocultar resultado" : "Ver resultado do pipeline"}
                </button>
              )}
              {(expanded || run?.running) && (lastOutput || run?.steps.some((s) => s.output)) && (
                <div className="relative mt-2 rounded-lg border border-border/50 bg-background/60 p-3">
                  <AIOutputCard
                    bare
                    content={lastOutput?.output ?? ""}
                    filename={`agente-${agent.id}`}
                    streaming={run?.running}
                    storageKey={`os-agente-${agent.id}`}
                    onRegenerate={run?.running || !aiOn ? undefined : () => onRun(agent)}
                  />
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ Insights --- */

const TONE_META: Record<OSInsight["tone"], { icon: typeof Lightbulb; className: string; label: string }> = {
  warn: { icon: AlertTriangle, className: "border-warning/50 bg-warning/10", label: "alerta" },
  action: { icon: Play, className: "border-primary/50 bg-primary/10", label: "ação" },
  tip: { icon: Lightbulb, className: "border-border/60 bg-card/40", label: "dica" },
  info: { icon: CheckCircle2, className: "border-border/60 bg-card/40", label: "info" },
};

export function OSInsights({
  insights, onCommand,
}: {
  insights: OSInsight[];
  onCommand: (cmd: string) => void;
}) {
  if (insights.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6">
        <CheckCircle2 className="h-10 w-10 text-emerald-500/50 mb-2" />
        <p className="text-sm font-medium text-foreground">Tudo sob controle</p>
        <p className="text-xs text-muted-foreground mt-1">Sem alertas ou recomendações pendentes no momento.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="max-w-2xl mx-auto space-y-2.5">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">
          Recomendações proativas — o OS observa dados + uso para sugerir o próximo passo.
        </p>
        {insights.map((ins) => {
          const meta = TONE_META[ins.tone];
          return (
            <article key={ins.id} className={cn("rounded-xl border p-3.5", meta.className)}>
              <div className="flex items-start gap-2">
                <meta.icon className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-semibold text-foreground">{ins.title}</h3>
                    <span className="text-[8px] uppercase tracking-wider text-muted-foreground">{meta.label}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">{ins.detail}</p>
                  {ins.command && (
                    <button
                      onClick={() => onCommand(ins.command!)}
                      className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary text-primary-foreground text-[10px] font-medium hover:bg-primary/90 transition-colors"
                    >
                      <Play className="h-3 w-3" />
                      Executar <code className="font-mono">{ins.command}</code>
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
