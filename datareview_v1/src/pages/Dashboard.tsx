import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Database, Star, MessageSquare, ThumbsUp, Apple, ShoppingBag,
  TrendingUp, BarChart3, MessageSquareText,
  Filter, ChevronDown, ChevronUp, MessageCircle, ArrowRight,
  Layers, Users, ThumbsDown, Activity, PieChart as PieIcon, Clock,
  Download, Search, Printer, Maximize2, Wand2, Loader2,
  type LucideIcon,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { useDataset } from "@/hooks/useDataset";
import { useCompare } from "@/context/CompareContext";
import { Collapsible, downloadFile, useHotkey } from "@/lib/pageFeatures";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  DEFAULT_FILTERS, filterDataset, computeKPIs, computeRatingDistribution,
  computeSentiment, computeTimeline, computeStoreComparison, computeWordCloud,
  computePerAppStats, computeRecentReviews, computeVersionBreakdown,
  type DashboardFilters, type PerAppStat,
} from "@/lib/dashboardAnalytics";
import {
  AggregateRatingChart, AggregateSentimentChart, AggregateTimelineChart,
  StoreComparisonChart, VersionAnalysisChart, KpiCard, PerAppRow, RecentReviewItem,
} from "@/components/dashboard/DashboardCharts";
import { DashboardAIPanel } from "@/components/dashboard/DashboardAIPanel";
import { LinkedStoresCard } from "@/components/dashboard/LinkedStoresCard";
import { VersionDiffCard } from "@/components/dashboard/VersionDiffCard";
import { useSystemProfile } from "@/lib/systemProfile";
import { semanticSearchReviews } from "@/lib/embedSearch";
import { exportToXLSX, exportDatasetToPDF } from "@/lib/exportUtils";

type SortKey = "name" | "rating" | "reviewCount" | "avgCollected" | "positivePct" | "negativePct";

export default function Dashboard({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const { entries } = useDataset();
  const compare = useCompare();

  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS);
  const [sortKey, setSortKey] = useState<SortKey>("reviewCount");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [reviewSentiment, setReviewSentiment] = useState<"all" | "positive" | "neutral" | "negative">("all");
  const [showFilters, setShowFilters] = useState(true);
  const [reviewSearch, setReviewSearch] = useState("");
  const reviewSearchRef = useRef<HTMLInputElement>(null);
  const [semantic, setSemantic] = useState(false);
  const [semanticHits, setSemanticHits] = useState<Map<number, number> | null>(null);
  const [semanticLoading, setSemanticLoading] = useState(false);
  const [semanticError, setSemanticError] = useState("");
  const { profile } = useSystemProfile();
  const hasEmbedModel = !!profile?.embeddingModel;

  const { filteredEntries, filteredReviews } = useMemo(
    () => filterDataset(entries, filters),
    [entries, filters],
  );

  // Base do feed (filtro de sentimento) — a busca textual ou semântica é
  // aplicada sobre ela.
  const feedBase = useMemo(() => {
    if (reviewSentiment === "all") return filteredReviews;
    return filteredReviews.filter((r) => {
      if (reviewSentiment === "positive") return r.rating >= 4;
      if (reviewSentiment === "neutral") return r.rating === 3;
      return r.rating <= 2;
    });
  }, [filteredReviews, reviewSentiment]);

  // Busca semântica (embeddings locais): dispara com debounce quando ligada.
  useEffect(() => {
    if (!semantic || !reviewSearch.trim()) {
      setSemanticHits(null);
      setSemanticError("");
      return;
    }
    const ac = new AbortController();
    const t = setTimeout(async () => {
      setSemanticLoading(true);
      setSemanticError("");
      const res = await semanticSearchReviews(reviewSearch, feedBase, 30, ac.signal);
      setSemanticLoading(false);
      if (res.ok) {
        setSemanticHits(new Map(res.hits.map((h) => [h.index, h.score])));
      } else if (res.error !== "cancelado") {
        setSemanticHits(null);
        setSemanticError(res.error ?? "Busca semântica indisponível");
      }
    }, 500);
    return () => { clearTimeout(t); ac.abort(); };
  }, [semantic, reviewSearch, feedBase]);

  const reviewsForFeed = useMemo(() => {
    let list = feedBase;
    if (reviewSearch.trim()) {
      if (semantic) {
        if (semanticHits) {
          // Reordena pelos hits semânticos (índices da feedBase).
          const ranked = [...semanticHits.entries()].sort((a, b) => b[1] - a[1]);
          list = ranked.map(([i]) => feedBase[i]).filter(Boolean);
        } else if (semanticLoading) {
          list = []; // aguardando o embedding — mostra loading
        }
      } else {
        const q = reviewSearch.toLowerCase();
        list = list.filter((r) => (r.title || "").toLowerCase().includes(q) || (r.text || "").toLowerCase().includes(q) || (r.author || "").toLowerCase().includes(q));
      }
    }
    return list;
  }, [feedBase, reviewSentiment, reviewSearch, semantic, semanticHits, semanticLoading]);

  const kpis = useMemo(() => computeKPIs(filteredReviews, filteredEntries), [filteredReviews, filteredEntries]);
  const ratingDist = useMemo(() => computeRatingDistribution(filteredReviews), [filteredReviews]);
  const sentiment = useMemo(() => computeSentiment(filteredReviews), [filteredReviews]);
  const timeline = useMemo(() => computeTimeline(filteredReviews), [filteredReviews]);
  const storeComparison = useMemo(() => computeStoreComparison(filteredEntries), [filteredEntries]);
  const wordCloud = useMemo(() => computeWordCloud(filteredReviews), [filteredReviews]);
  const perApp = useMemo(() => computePerAppStats(filteredEntries), [filteredEntries]);
  const recentReviews = useMemo(() => computeRecentReviews(reviewsForFeed, 40), [reviewsForFeed]);
  const versionBreakdown = useMemo(() => computeVersionBreakdown(filteredReviews), [filteredReviews]);

  const sortedPerApp = useMemo(() => {
    const sorted = [...perApp];
    sorted.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else cmp = (a[sortKey] as number) - (b[sortKey] as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [perApp, sortKey, sortDir]);

  const toggleSort = useCallback((key: SortKey) => {
    setSortKey((prevKey) => {
      if (prevKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prevKey;
      }
      setSortDir("desc");
      return key;
    });
  }, []);

  const toggleAppFilter = (key: string) => {
    setFilters((prev) => {
      const next = { ...prev, appKeys: new Set(prev.appKeys) };
      if (next.appKeys.has(key)) next.appKeys.delete(key);
      else next.appKeys.add(key);
      return next;
    });
  };

  const hasData = entries.length > 0;
  const dateRangeStr = kpis.oldestDate && kpis.newestDate
    ? `${new Date(kpis.oldestDate).toLocaleDateString("pt-BR")} — ${new Date(kpis.newestDate).toLocaleDateString("pt-BR")}`
    : "—";

  // "/" focuses the review search from anywhere on the page.
  useHotkey("/", () => reviewSearchRef.current?.focus(), []);

  if (!hasData) {
    return (
      <div className={embedded ? "bg-background" : "min-h-screen bg-background"}>
        {!embedded && (
          <AppHeader
            backTo="/"
            title="Dashboard"
            crumb="Dashboard"
            compare={{ count: compare.entries.length, onOpen: () => compare.setPickerOpen(true) }}
          />
        )}
        <EmptyState
          icon={Database}
          title="Dashboard de dados"
          description="Colete apps e reviews para visualizar métricas agregadas, padrões, oportunidades e análises com IA."
          collect
        />
      </div>
    );
  }

  const maxWordFreq = wordCloud[0]?.[1] || 1;
  const minWordFreq = wordCloud[wordCloud.length - 1]?.[1] || 1;

  return (
    <div className={embedded ? "bg-background" : "min-h-screen bg-background"}>
      {!embedded && (
        <AppHeader
          backTo="/"
          title="Dashboard"
          crumb="Dashboard"
          compare={{ count: compare.entries.length, onOpen: () => compare.setPickerOpen(true) }}
          onExportXLSX={filteredReviews.length ? () => exportToXLSX(filteredReviews) : undefined}
          onExportPDF={filteredEntries.length ? () => exportDatasetToPDF(filteredEntries) : undefined}
        />
      )}

      <main className="content-fluid py-6 space-y-6">
        {/* Title + filter toggle */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Layers className="h-6 w-6 text-primary" />
              Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Painel de controle com dados de {kpis.totalApps} app(s), {kpis.totalReviews.toLocaleString("pt-BR")} reviews · {dateRangeStr}
            </p>
          </div>
          <div className="flex gap-2">
            {/* F3: Search within reviews */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                ref={reviewSearchRef}
                type="search"
                value={reviewSearch}
                onChange={(e) => setReviewSearch(e.target.value)}
                placeholder="Buscar nos reviews… ( / )"
                className="pl-8 pr-3 py-1.5 rounded-lg border border-border/60 bg-card/60 text-xs w-48 focus:outline-none focus:ring-2 focus:ring-primary/40"
                aria-label="Buscar nos reviews (atalho: barra)"
              />
            </div>
            {hasEmbedModel && (
              <Button
                variant={semantic ? "default" : "outline"}
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => setSemantic((s) => !s)}
                aria-pressed={semantic}
                title={`Busca semântica com embeddings locais (${profile?.embeddingModel}) — encontra reviews por significado, não só por palavras`}
              >
                <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
                Semântica
              </Button>
            )}
            {semanticLoading && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1" role="status">
                <Loader2 className="h-3 w-3 animate-spin" /> ranqueando…
              </span>
            )}
            {semanticError && (
              <span className="text-[10px] text-destructive flex items-center" role="alert" title={semanticError}>
                Busca semântica indisponível
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => setShowFilters((s) => !s)}
              aria-expanded={showFilters}
              aria-controls="dashboard-filters"
            >
              <Filter className="h-3.5 w-3.5" aria-hidden="true" />
              Filtros
              {(filters.store !== "all" || filters.appKeys.size > 0) && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden="true" />
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => navigate("/chat")}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Chat IA
            </Button>
            {/* F1: Export dashboard data */}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => {
                const data = JSON.stringify({ kpis, perApp, ratingDist, sentiment, storeComparison, exportedAt: new Date().toISOString() }, null, 2);
                downloadFile("dashboard-data.json", data, "application/json");
              }}
              aria-label="Exportar dados do dashboard"
            >
              <Download className="h-3.5 w-3.5" />
              Exportar
            </Button>
            {/* CSV export of the per-app metrics table */}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => {
                const header = "app;loja;nota_loja;avaliacoes;nota_coletada;positivo_pct;negativo_pct";
                const rows = sortedPerApp.map((s) =>
                  [s.name, s.store, s.rating ?? "", s.reviewCount, s.avgCollected?.toFixed(2) ?? "", s.positivePct, s.negativePct].join(";"),
                );
                downloadFile("dashboard-apps.csv", [header, ...rows].join("\n"), "text/csv");
              }}
              aria-label="Exportar métricas por app em CSV"
              title="Exportar métricas por app em CSV"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              CSV
            </Button>
            {/* F4: Print mode */}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => window.print()}
              aria-label="Imprimir dashboard"
              title="Imprimir dashboard"
            >
              <Printer className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>

        {/* Filter bar */}
        {showFilters && (
          <div id="dashboard-filters" className="rounded-xl border border-border/60 bg-card p-4 space-y-3 animate-fade-in-up">
            <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Filtrar por loja">
              <span className="text-xs font-semibold text-muted-foreground">Loja:</span>
              {(["all", "apple", "google"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilters((f) => ({ ...f, store: s }))}
                  aria-pressed={filters.store === s}
                  className={`text-[11px] px-2.5 py-1 rounded-lg transition-colors ${
                    filters.store === s
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
                  }`}
                >
                  {s === "all" ? "Todas" : s === "apple" ? "Apple" : "Google"}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Apps ({filters.appKeys.size} selecionados):</span>
                <button
                  onClick={() => setFilters((f) => ({ ...f, appKeys: new Set() }))}
                  className="text-[10px] text-muted-foreground hover:text-foreground hover:underline"
                >
                  Limpar seleção
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {entries.map((e) => {
                  const k = `${e.app.store}:${e.app.id}`;
                  const isSel = filters.appKeys.has(k);
                  return (
                    <button
                      key={k}
                      onClick={() => toggleAppFilter(k)}
                      aria-pressed={isSel}
                      className={`flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-lg border transition-colors ${
                        isSel
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border/40 hover:bg-secondary/40"
                      }`}
                    >
                      <img src={e.app.icon} alt="" className="w-4 h-4 rounded object-cover" />
                      <span className="truncate max-w-[100px]">{e.app.name}</span>
                      <span className="text-[9px] text-muted-foreground">
                        {e.app.store === "apple" ? <Apple className="inline h-2.5 w-2.5" /> : <ShoppingBag className="inline h-2.5 w-2.5" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label="Apps" value={kpis.totalApps} icon={Database} sub={`${kpis.storeCount} loja(s)`} delay={0} />
          <KpiCard label="Reviews" value={kpis.totalReviews.toLocaleString("pt-BR")} icon={MessageSquare} sub={`${kpis.avgTextLength} chars/review médio`} delay={60} />
          <KpiCard label="Nota média" value={kpis.avgRating ? kpis.avgRating.toFixed(2) : "—"} icon={Star} sub="★ dos coletados" accent="warning" delay={120} />
          <KpiCard label="Positivos" value={`${kpis.positivePct}%`} icon={ThumbsUp} sub={`${kpis.positiveCount} reviews`} accent="success" delay={180} />
          <KpiCard label="Negativos" value={`${kpis.negativePct}%`} icon={ThumbsDown} sub={`${kpis.negativeCount} reviews`} accent="destructive" delay={240} />
          <KpiCard label="Respostas dev" value={kpis.withDeveloperReply} icon={MessageCircle} sub="responderam ao usuário" delay={300} />
        </div>

        {/* Charts grid — row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Rating distribution */}
          <ChartCard title="Distribuição de Notas" icon={BarChart3} subtitle={`${kpis.totalReviews} reviews · ★${kpis.avgRating.toFixed(2)} média`}>
            <AggregateRatingChart data={ratingDist} />
          </ChartCard>

          {/* Sentiment */}
          <ChartCard title="Sentimento" icon={PieIcon} subtitle={`${kpis.positivePct}% positivo · ${kpis.negativePct}% negativo`}>
            <AggregateSentimentChart data={sentiment} />
          </ChartCard>
        </div>

        {/* Charts grid — row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Timeline */}
          <ChartCard title="Evolução Temporal" icon={Activity} subtitle="Nota média e volume de reviews por mês">
            {timeline.length > 0 ? (
              <AggregateTimelineChart data={timeline} />
            ) : (
              <EmptyChart msg="Dados insuficientes para timeline (mín. 2 meses)" />
            )}
          </ChartCard>

          {/* Store comparison */}
          <ChartCard title="Comparação por Loja" icon={Apple} subtitle="Reviews, nota média e % positivo por loja">
            {storeComparison.length > 1 ? (
              <StoreComparisonChart data={storeComparison} />
            ) : (
              <EmptyChart msg="Colete apps de ambas as lojas para comparar" />
            )}
          </ChartCard>
        </div>

        {/* Charts grid — row 3 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Word cloud */}
          <ChartCard title="Termos Mais Frequentes" icon={MessageSquareText} subtitle="Palavras mais citadas nos reviews">
            <div className="h-56 flex flex-wrap gap-2 justify-center items-center overflow-y-auto">
              {wordCloud.length > 0 ? (
                wordCloud.map(([word, count]) => {
                  const size = minWordFreq === maxWordFreq ? 1 : 0.65 + ((count - minWordFreq) / (maxWordFreq - minWordFreq)) * 1.3;
                  return (
                    <span
                      key={word}
                      className="px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium transition-transform hover:scale-110 cursor-default"
                      style={{ fontSize: `${size}rem` }}
                      title={`${count} ocorrências`}
                    >
                      {word}
                    </span>
                  );
                })
              ) : (
                <EmptyChart msg="Sem dados suficientes" />
              )}
            </div>
          </ChartCard>

          {/* Version analysis */}
          <ChartCard title="Análise por Versão" icon={TrendingUp} subtitle="Top 10 versões por volume de reviews">
            {versionBreakdown.length > 0 ? (
              <VersionAnalysisChart data={versionBreakdown} />
            ) : (
              <EmptyChart msg="Reviews sem informação de versão" />
            )}
          </ChartCard>

          {/* Diff de versões (Onda 4.2) — narrativa determinística do que mudou */}
          <VersionDiffCard reviews={filteredReviews} />
        </div>

        {/* Cross-store linking (todo.md P1): mesmo app em Apple+Google */}
        <LinkedStoresCard entries={filteredEntries} />

        {/* Per-app table */}
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border/40">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Métricas por App</h3>
            </div>
            <span className="text-xs text-muted-foreground">{sortedPerApp.length} app(s)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/40 bg-muted/30">
                  <SortHeader label="App" sortKey="name" current={sortKey} dir={sortDir} onClick={toggleSort} align="left" />
                  <th className="px-3 py-2 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Loja</th>
                  <SortHeader label="Nota loja" sortKey="rating" current={sortKey} dir={sortDir} onClick={toggleSort} />
                  <SortHeader label="Avaliações" sortKey="reviewCount" current={sortKey} dir={sortDir} onClick={toggleSort} />
                  <SortHeader label="Nota coletada" sortKey="avgCollected" current={sortKey} dir={sortDir} onClick={toggleSort} />
                  <SortHeader label="Positivo" sortKey="positivePct" current={sortKey} dir={sortDir} onClick={toggleSort} />
                  <SortHeader label="Negativo" sortKey="negativePct" current={sortKey} dir={sortDir} onClick={toggleSort} />
                  <th className="px-3 py-2 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Respostas</th>
                  <th className="px-3 py-2 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Temas</th>
                </tr>
              </thead>
              <tbody>
                {sortedPerApp.map((stat) => (
                  <PerAppRow key={stat.key} stat={stat} />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* AI Analysis Panel */}
        <DashboardAIPanel dataset={filteredEntries} />

        {/* Recent reviews feed */}
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border/40">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Reviews Recentes</h3>
            </div>
            <div className="flex items-center gap-1" role="group" aria-label="Filtrar reviews por sentimento">
              {(["all", "positive", "neutral", "negative"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setReviewSentiment(s)}
                  aria-pressed={reviewSentiment === s}
                  className={`text-[10px] px-2 py-1 rounded-lg transition-colors ${
                    reviewSentiment === s
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
                  }`}
                >
                  {s === "all" ? "Todos" : s === "positive" ? "Positivos" : s === "neutral" ? "Neutros" : "Negativos"}
                </button>
              ))}
            </div>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[600px] overflow-y-auto">
            {recentReviews.length > 0 ? (
              recentReviews.map((r, i) => <RecentReviewItem key={`${r.id}-${i}`} review={r} />)
            ) : (
              <div className="col-span-2 text-center py-8 text-sm text-muted-foreground">
                Nenhum review encontrado com este filtro.
              </div>
            )}
          </div>
        </div>

        {/* Footer CTA */}
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <MessageCircle className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Converse com a IA sobre esses dados</p>
              <p className="text-xs text-muted-foreground">Faça perguntas específicas e receba respostas com gráficos e evidências</p>
            </div>
          </div>
          <Button onClick={() => navigate("/chat")} className="gap-1.5 text-xs shrink-0" size="sm">
            Abrir Chat
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </main>
    </div>
  );
}

/* ---------------------------------------------------------- Sub-comp --- */

function ChartCard({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-card rounded-xl p-4 animate-fade-in-up">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
      </div>
      {subtitle && <p className="text-[11px] text-muted-foreground mb-3">{subtitle}</p>}
      <div className="h-56">{children}</div>
    </div>
  );
}

function EmptyChart({ msg }: { msg: string }) {
  return (
    <div className="h-full flex items-center justify-center text-center">
      <p className="text-xs text-muted-foreground">{msg}</p>
    </div>
  );
}

function SortHeader({
  label,
  sortKey: key,
  current,
  dir,
  onClick,
  align = "center",
}: {
  label: string;
  sortKey: SortKey | "";
  current: SortKey | "";
  dir: "asc" | "desc";
  onClick: (key: SortKey) => void;
  align?: "left" | "center";
}) {
  const isActive = key === current && key !== "";
  return (
    <th
      className={`px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider ${align === "center" ? "text-center" : "text-left"}`}
      aria-sort={isActive ? (dir === "asc" ? "ascending" : "descending") : undefined}
    >
      {key ? (
        <button
          onClick={() => onClick(key as SortKey)}
          aria-label={`Ordenar por ${label}${isActive ? (dir === "asc" ? " (crescente)" : " (decrescente)") : ""}`}
          className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${isActive ? "text-foreground" : ""}`}
        >
          {label}
          {isActive && (dir === "asc" ? <ChevronUp className="h-3 w-3" aria-hidden="true" /> : <ChevronDown className="h-3 w-3" aria-hidden="true" />)}
        </button>
      ) : (
        label
      )}
    </th>
  );
}
