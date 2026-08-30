import { useMemo } from "react";
import { Star, MessageSquare, ThumbsUp, ThumbsDown, BarChart3 } from "lucide-react";
import {
  computeKPIs, computeRatingDistribution, computeSentiment,
  computeTimeline, computeStoreComparison, computePerAppStats,
} from "@/lib/dashboardAnalytics";
import {
  KpiCard, AggregateRatingChart, AggregateSentimentChart,
  AggregateTimelineChart, StoreComparisonChart, PerAppRow,
} from "@/components/dashboard/DashboardCharts";
import { EmptyState } from "@/components/shared/EmptyState";
import type { DatasetEntry } from "@/lib/datasetStore";

/**
 * Etapa 4 — Visualizar: gráficos determinísticos (zero IA) sobre o escopo.
 */
export function StageVisualize({ scoped }: { scoped: DatasetEntry[] }) {
  const reviews = useMemo(() => scoped.flatMap((e) => e.reviews), [scoped]);
  const kpis = useMemo(() => computeKPIs(reviews, scoped), [reviews, scoped]);
  const dist = useMemo(() => computeRatingDistribution(reviews), [reviews]);
  const sentiment = useMemo(() => computeSentiment(reviews), [reviews]);
  const timeline = useMemo(() => computeTimeline(reviews), [reviews]);
  const stores = useMemo(() => computeStoreComparison(scoped), [scoped]);
  const perApp = useMemo(() => computePerAppStats(scoped), [scoped]);

  if (scoped.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Sem dados para visualizar"
        description="Colete apps nas etapas anteriores para ver os gráficos."
      />
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">O que os dados mostram</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Cálculos determinísticos sobre {reviews.length.toLocaleString("pt-BR")} reviews — sem IA, sem amostragem.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Reviews" value={kpis.totalReviews.toLocaleString("pt-BR")} icon={MessageSquare} sub={`${kpis.totalApps} app(s)`} />
        <KpiCard label="Nota média" value={kpis.avgRating.toFixed(2)} icon={Star} sub="sobre as coletadas" />
        <KpiCard label="Positivas" value={`${kpis.positivePct}%`} icon={ThumbsUp} accent="success" sub={`${kpis.positiveCount.toLocaleString("pt-BR")} reviews`} />
        <KpiCard label="Negativas" value={`${kpis.negativePct}%`} icon={ThumbsDown} accent="destructive" sub={`${kpis.negativeCount.toLocaleString("pt-BR")} reviews`} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border/60 bg-background p-4">
          <h3 className="text-sm font-semibold mb-2">Distribuição de notas</h3>
          <div className="h-52"><AggregateRatingChart data={dist} /></div>
        </div>
        <div className="rounded-lg border border-border/60 bg-background p-4">
          <h3 className="text-sm font-semibold mb-2">Sentimento</h3>
          <div className="h-52"><AggregateSentimentChart data={sentiment} /></div>
        </div>
        {timeline.length > 1 && (
          <div className="rounded-lg border border-border/60 bg-background p-4">
            <h3 className="text-sm font-semibold mb-2">Evolução temporal</h3>
            <div className="h-52"><AggregateTimelineChart data={timeline} /></div>
          </div>
        )}
        {stores.length > 1 && (
          <div className="rounded-lg border border-border/60 bg-background p-4">
            <h3 className="text-sm font-semibold mb-2">Cobertura por loja</h3>
            <div className="h-52"><StoreComparisonChart data={stores} /></div>
          </div>
        )}
      </div>

      {perApp.length > 0 && (
        <div className="rounded-lg border border-border/60 bg-background overflow-hidden">
          <h3 className="text-sm font-semibold px-4 py-3 border-b border-border/60">Por app</h3>
          <div role="table" aria-label="Estatísticas por app">
            {perApp.map((st) => <PerAppRow key={st.key} stat={st} />)}
          </div>
        </div>
      )}
    </div>
  );
}
