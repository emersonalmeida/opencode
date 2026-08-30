/**
 * Seção 05 — Visualizar: KPIs + gráficos determinísticos (sem IA) do escopo,
 * reusando a biblioteca de analytics do Dashboard. Tudo é computado localmente.
 */
import { useMemo } from "react";
import { useFlowScope } from "@/components/flow/useFlowScope";
import {
  computeKPIs, computeRatingDistribution, computeSentiment,
  computeTimeline, computeStoreComparison, computeWordCloud, computePerAppStats,
} from "@/lib/dashboardAnalytics";
import {
  AggregateRatingChart, AggregateSentimentChart, AggregateTimelineChart,
  StoreComparisonChart, KpiCard,
} from "@/components/dashboard/DashboardCharts";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  BarChart3, Star, TrendingUp, ThumbsUp, ThumbsDown, Store, LayoutDashboard,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Panel } from "@/components/Panel";
import { FlowEmbed } from "@/components/flow/FlowEmbed";

export function SectionVisualize() {
  const { scoped, totalReviews } = useFlowScope();
  const reviews = useMemo(() => scoped.flatMap((e) => e.reviews), [scoped]);

  const kpis = useMemo(() => computeKPIs(reviews, scoped), [reviews, scoped]);
  const ratingDist = useMemo(() => computeRatingDistribution(reviews), [reviews]);
  const sentiment = useMemo(() => computeSentiment(reviews), [reviews]);
  const timeline = useMemo(() => computeTimeline(reviews), [reviews]);
  const store = useMemo(() => computeStoreComparison(scoped), [scoped]);
  const words = useMemo(() => computeWordCloud(reviews, 24), [reviews]);
  const perApp = useMemo(() => computePerAppStats(scoped), [scoped]);

  if (scoped.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Sem dados para visualizar"
        description="Colete apps para gerar KPIs e gráficos determinísticos aqui — sem IA, instantâneo."
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Apps" value={kpis.totalApps} icon={Store} />
        <KpiCard label="Reviews" value={kpis.totalReviews.toLocaleString("pt-BR")} icon={BarChart3} />
        <KpiCard label="Nota média" value={kpis.avgRating.toFixed(2)} sub="reviews coletados" icon={Star} />
        <KpiCard label="Positivas" value={`${kpis.positivePct}%`} sub={`${kpis.positiveCount.toLocaleString("pt-BR")} reviews`} icon={ThumbsUp} />
        <KpiCard label="Negativas" value={`${kpis.negativePct}%`} sub={`${kpis.negativeCount.toLocaleString("pt-BR")} reviews`} icon={ThumbsDown} />
        <KpiCard label="Lojas" value={kpis.storeCount} icon={TrendingUp} />
      </div>

      {/* Gráficos principais */}
      <div className="grid gap-4 lg:grid-cols-3">
        <AggregateRatingChart data={ratingDist} />
        <AggregateSentimentChart data={sentiment} />
        <AggregateTimelineChart data={timeline} />
      </div>

      <StoreComparisonChart data={store} />

      {/* Nuvem de termos */}
      {words.length > 0 && (
        <div className="rounded-lg border border-border/60 bg-background/60 p-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Termos mais frequentes ({totalReviews.toLocaleString("pt-BR")} reviews)</p>
          <div className="flex flex-wrap gap-1.5" role="list">
            {words.map(([text, value]) => (
              <span
                key={text}
                role="listitem"
                className="rounded-full bg-secondary px-2 py-0.5"
                style={{ fontSize: `${Math.min(20, 10 + value * 1.5)}px` }}
                title={`${value} ocorrências`}
              >
                {text}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Por app */}
      {perApp.length > 1 && (
        <div className="rounded-lg border border-border/60 bg-background/60 p-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Comparativo por app</p>
          <div className="space-y-1.5">
            {perApp.map((s) => (
              <div key={s.key} className="flex items-center gap-2 text-xs">
                <span className="w-40 truncate font-medium">{s.name}</span>
                <div className="h-2 flex-1 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full bg-status-success"
                    style={{ width: `${s.positivePct}%` }}
                  />
                </div>
                <span className="w-24 text-right text-[10px] text-muted-foreground tabular-nums">
                  ★{s.avgCollected.toFixed(2)} · {s.positivePct}% pos
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Panel
        title="Dashboard completo"
        subtitle="A página Dashboard inteira: tabela por app ordenável, feed de reviews filtrável, busca semântica e painel de IA — sem sair do Fluxo."
        icon={<LayoutDashboard className="h-4 w-4 text-primary" />}
        defaultOpen={false}
        storageKey="aso:flow-dashboard"
      >
        <FlowEmbed page="dashboard" />
        <Link to="/dashboard" className="mt-2 inline-block text-[11px] text-primary hover:underline">
          Abrir página dedicada ↗
        </Link>
      </Panel>
    </div>
  );
}
