import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import {
  BarChart3, PieChart as PieIcon, Activity, Sparkles, Loader2,
  AlertCircle, MessageSquare,
} from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { useDataset } from "@/hooks/useDataset";
import { Button } from "@/components/ui/button";
import {
  computeKPIs, computeRatingDistribution, computeSentiment,
  computeTimeline, computePerAppStats, computeWordCloud, filterDataset, DEFAULT_FILTERS,
} from "@/lib/dashboardAnalytics";
import { streamExperiment } from "@/lib/experimentApi";
import { getAIOutputFor } from "@/lib/aiOutputStore";
import { EXPERIMENT_SECTIONS } from "@/lib/experimentSections";
import { AIOutputCard } from "@/components/shared/AIOutputCard";


const TOOLTIP_STYLE = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  color: "hsl(var(--card-foreground))",
  fontSize: "11px",
} as const;

const AXIS_STYLE = { stroke: "hsl(var(--muted-foreground))", fontSize: 10 } as const;

const SENTIMENT_COLORS = ["hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--destructive))"];

const AI_SECTIONS = EXPERIMENT_SECTIONS.filter((s) => s.kind === "ai");

interface InsightState {
  loading: boolean;
  content: string;
  error: string;
}

/* Compact chart card wrapper for the narrow sidebar */
function MiniChartCard({
  title, icon: Icon, children, height = 160,
}: {
  title: string;
  icon: typeof BarChart3;
  children: React.ReactNode;
  height?: number;
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-card/60 p-2.5 space-y-2">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3 w-3 text-primary" />
        <span className="text-[10px] font-semibold text-foreground uppercase tracking-wider">{title}</span>
      </div>
      <div style={{ height }}>
        {children}
      </div>
    </div>
  );
}

export function SidebarChartsPanel() {
  const { entries } = useDataset();
  const [aiSection, setAiSection] = useState<string>("quantitative");
  const [insight, setInsight] = useState<InsightState>({ loading: false, content: "", error: "" });
  const abortRef = useRef<AbortController | null>(null);

  const { filteredEntries, filteredReviews } = useMemo(
    () => filterDataset(entries, DEFAULT_FILTERS),
    [entries],
  );

  const kpis = useMemo(() => computeKPIs(filteredReviews, filteredEntries), [filteredReviews, filteredEntries]);
  const ratingDist = useMemo(() => computeRatingDistribution(filteredReviews), [filteredReviews]);
  const timeline = useMemo(() => computeTimeline(filteredReviews), [filteredReviews]);
  const perApp = useMemo(() => computePerAppStats(filteredEntries), [filteredEntries]);
  const wordCloud = useMemo(() => computeWordCloud(filteredReviews, 15), [filteredReviews]);

  const topApps = useMemo(
    () => [...perApp].sort((a, b) => b.reviewCount - a.reviewCount).slice(0, 6),
    [perApp],
  );

  const runAI = useCallback(async (section: string) => {
    if (filteredEntries.length === 0) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setInsight({ loading: true, content: "", error: "" });
    await streamExperiment(
      section,
      filteredEntries,
      {
        onToken: (full) => setInsight({ loading: true, content: full, error: "" }),
        onDone: (full) => setInsight({ loading: false, content: full, error: "" }),
        onError: (err) => setInsight({ loading: false, content: "", error: err }),
      },
      ac.signal,
    );
  }, [filteredEntries]);

  // Reidrata o output persistido da seção ativa (sobrevive a reload/restart).
  const appKeys = useMemo(
    () => filteredEntries.map((e) => `${e.app.store}:${e.app.id}`),
    [filteredEntries],
  );
  const appKeysKey = appKeys.join(",");
  useEffect(() => {
    if (appKeys.length === 0) return;
    setInsight((prev) => {
      if (prev.content || prev.loading) return prev;
      const rec = getAIOutputFor(aiSection, appKeys);
      return rec ? { loading: false, content: rec.markdown, error: "" } : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiSection, appKeysKey]);

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
        <BarChart3 className="h-8 w-8 text-muted-foreground/40 mb-2" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Nenhum dado coletado ainda.
          <br />
          Busque e adicione apps para ver gráficos e análises.
        </p>
      </div>
    );
  }

  const sentimentData = [
    { name: "Positivo", value: kpis.positiveCount },
    { name: "Neutro", value: kpis.neutralCount },
    { name: "Negativo", value: kpis.negativeCount },
  ].filter((d) => d.value > 0);

  return (
    <div className="flex flex-col w-full">
      {/* Scrollable charts area */}
      <div className="space-y-2.5">

        {/* KPI strip */}
        <div className="grid grid-cols-3 gap-1.5">
          <div className="rounded-lg border border-border/50 bg-card/60 p-2 text-center">
            <p className="text-base font-bold text-foreground leading-none">{kpis.totalApps}</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">Apps</p>
          </div>
          <div className="rounded-lg border border-border/50 bg-card/60 p-2 text-center">
            <p className="text-base font-bold text-foreground leading-none">{kpis.totalReviews}</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">Reviews</p>
          </div>
          <div className="rounded-lg border border-border/50 bg-card/60 p-2 text-center">
            <p className={`text-base font-bold leading-none ${kpis.avgRating >= 3.5 ? "text-success" : kpis.avgRating >= 2.5 ? "text-warning" : "text-destructive"}`}>
              {kpis.avgRating.toFixed(1)}
            </p>
            <p className="text-[9px] text-muted-foreground mt-0.5">Nota média</p>
          </div>
        </div>

        {/* Sentiment mini-row */}
        <div className="grid grid-cols-3 gap-1.5">
          <div className="rounded-lg border border-border/50 bg-success/5 p-2 text-center">
            <p className="text-sm font-bold text-success leading-none">{kpis.positivePct}%</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">Positivos</p>
          </div>
          <div className="rounded-lg border border-border/50 bg-warning/5 p-2 text-center">
            <p className="text-sm font-bold text-warning leading-none">{kpis.neutralPct}%</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">Neutros</p>
          </div>
          <div className="rounded-lg border border-border/50 bg-destructive/5 p-2 text-center">
            <p className="text-sm font-bold text-destructive leading-none">{kpis.negativePct}%</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">Negativos</p>
          </div>
        </div>

        {/* Rating distribution */}
        <MiniChartCard title="Distribuição de Notas" icon={BarChart3} height={130}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ratingDist} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
              <XAxis dataKey="star" {...AXIS_STYLE} tickLine={false} axisLine={false} />
              <YAxis {...AXIS_STYLE} tickLine={false} axisLine={false} width={28} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "hsl(var(--primary) / 0.05)" }} />
              <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                {ratingDist.map((_, i) => (
                  <Cell key={i} fill={["hsl(0,75%,55%)", "hsl(25,90%,55%)", "hsl(36,95%,55%)", "hsl(80,60%,45%)", "hsl(160,70%,45%)"][i]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </MiniChartCard>

        {/* Sentiment pie */}
        {sentimentData.length > 0 && (
          <MiniChartCard title="Sentimento" icon={PieIcon} height={140}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sentimentData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={50}
                  innerRadius={28}
                  paddingAngle={3}
                  label={({ percent }: { percent?: number }) => (percent ? `${(percent * 100).toFixed(0)}%` : "")}
                  labelLine={false}
                  fontSize={10}
                >
                  {sentimentData.map((_, i) => (
                    <Cell key={i} fill={SENTIMENT_COLORS[i % SENTIMENT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: number) => [`${value} reviews`, ""]} />
              </PieChart>
            </ResponsiveContainer>
          </MiniChartCard>
        )}

        {/* Timeline */}
        {timeline.length > 0 && (
          <MiniChartCard title="Evolução Temporal" icon={Activity} height={130}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeline} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="sbColorRating" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
                <XAxis dataKey="month" {...AXIS_STYLE} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 5]} {...AXIS_STYLE} tickLine={false} axisLine={false} width={28} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Area
                  type="monotone"
                  dataKey="avgRating"
                  name="Nota média"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  fill="url(#sbColorRating)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </MiniChartCard>
        )}

        {/* Top apps bar */}
        {topApps.length > 0 && (
          <MiniChartCard title="Reviews por App" icon={BarChart3} height={Math.max(120, topApps.length * 24)}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={topApps} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} horizontal={false} />
                <XAxis type="number" {...AXIS_STYLE} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" {...AXIS_STYLE} tickLine={false} axisLine={false} width={60} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "hsl(var(--primary) / 0.05)" }} />
                <Bar dataKey="reviewCount" name="Reviews" fill="hsl(var(--chart-2))" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </MiniChartCard>
        )}

        {/* Word cloud (simple tag cloud) */}
        {wordCloud.length > 0 && (
          <div className="rounded-lg border border-border/50 bg-card/60 p-2.5 space-y-2">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="h-3 w-3 text-primary" />
              <span className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Termos Frequentes</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {wordCloud.map(([word, count]) => {
                const max = wordCloud[0]?.[1] ?? 1;
                const ratio = count / max;
                return (
                  <span
                    key={word}
                    className="rounded-full bg-primary/10 text-primary"
                    style={{ fontSize: `${9 + ratio * 5}px`, padding: "1px 6px" }}
                    title={`${count} menções`}
                  >
                    {word}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* AI analysis divider */}
        <div className="pt-1 pb-0.5 flex items-center gap-2">
          <div className="flex-1 h-px bg-border/50" />
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1">
            <Sparkles className="h-2.5 w-2.5" /> Análises com IA
          </span>
          <div className="flex-1 h-px bg-border/50" />
        </div>

        {/* AI section selector */}
        <div className="flex flex-wrap gap-1">
          {AI_SECTIONS.map((s) => {
            const Icon = s.icon;
            const active = aiSection === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setAiSection(s.id)}
                title={s.label}
                className={`flex items-center gap-1 text-[10px] px-1.5 py-1 rounded-md transition-colors ${active ? "bg-primary/15 text-primary font-medium" : "text-muted-foreground hover:bg-secondary"}`}
              >
                {Icon && <Icon className="h-2.5 w-2.5" />}
                <span className="truncate max-w-[70px]">{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* AI generate button */}
        <Button
          size="sm"
          onClick={() => runAI(aiSection)}
          disabled={insight.loading}
          className="w-full h-8 text-[11px]"
        >
          {insight.loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
          {insight.loading ? "Gerando…" : "Gerar análise"}
        </Button>

        {/* AI result */}
        {insight.error && (
          <div className="flex items-start gap-1.5 rounded-lg border border-destructive/40 bg-destructive/5 p-2 text-[11px] text-destructive">
            <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
            <span>{insight.error}</span>
          </div>
        )}

        {insight.content && (
          <div className="rounded-lg border border-border/50 bg-card/60 p-2.5">
            <AIOutputCard
              bare
              title="Insight"
              content={insight.content}
              filename={`grafico-${aiSection}`}
              storageKey={`charts:${aiSection}`}
              onRegenerate={insight.error !== "IA desativada" ? () => runAI(aiSection) : undefined}
            />
          </div>
        )}

        {!insight.content && !insight.error && !insight.loading && (
          <p className="text-[10px] text-muted-foreground/70 text-center py-2">
            Selecione um tipo de análise e clique em "Gerar" para criar insights com IA.
          </p>
        )}
      </div>
    </div>
  );
}
