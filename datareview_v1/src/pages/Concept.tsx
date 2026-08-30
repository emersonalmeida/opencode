import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles, TrendingUp,
  BrainCircuit, BarChart3, MessageSquare, Search,
  Loader2, Crown, Target, Database, Download, Send,
  CheckCircle2, AlertTriangle, Layers, Wand2, FileText, Star, Lightbulb,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { AIOutputCard } from "@/components/shared/AIOutputCard";
import { PageSidebar } from "@/context/PageSidebarsContext";
import { SidebarToolTabs } from "@/components/shared/SidebarToolTabs";
import type { DatasetEntry } from "@/lib/datasetStore";
import { useCompare } from "@/context/CompareContext";
import { useSelection } from "@/context/SelectionContext";
import { useAISettings, isAIEnabled } from "@/lib/aiSettings";
import { streamExperimentChat, type ChatMessage } from "@/lib/experimentChatApi";
import { streamExperiment } from "@/lib/experimentApi";
import { getAIOutputFor } from "@/lib/aiOutputStore";
import {
  computeKPIs, computePerAppStats, computeSentiment, computeRatingDistribution,
} from "@/lib/dashboardAnalytics";
import { useDataset as useDatasetEntries } from "@/hooks/useDataset";
import { useCollectionSettings } from "@/components/CollectionSettingsProvider";
import { getUserRegion } from "@/lib/region";
import { searchApps, type AppInfo } from "@/lib/appStoreApi";
import { searchGooglePlayApps } from "@/lib/googlePlayApi";
import { collectApp } from "@/lib/collect";
import { exportAppMetaCSV, exportToMarkdown } from "@/lib/exportUtils";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { downloadFile, useHotkey } from "@/lib/pageFeatures";
import { AIDisabledNotice } from "@/components/shared/AIDisabledNotice";
import {
  AggregateRatingChart, AggregateSentimentChart, PerAppRow,
} from "@/components/dashboard/DashboardCharts";
import {
  PieChart, Pie, Cell, ResponsiveContainer,
} from "recharts";

/* --------------------------------------------------------------- helpers --- */
function useDataset(): DatasetEntry[] {
  return useDatasetEntries().entries;
}

const SENT_COLORS = ["hsl(var(--status-success))", "hsl(var(--muted-foreground))", "hsl(var(--status-error))"];

function SectionTag({ icon: Icon, kicker }: { icon: typeof Sparkles; kicker: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-3">
      <Icon className="h-3.5 w-3.5 text-primary" />
      <span className="text-[10px] uppercase tracking-widest font-semibold text-primary">{kicker}</span>
    </div>
  );
}


/* ----------------------------------------------------------- analysis sections --- */
const ANALYSIS_SECTIONS = [
  { id: "problems", label: "Problemas", icon: AlertTriangle, hint: "Bugs, crashes, UX, performance" },
  { id: "requests", label: "Solicitações", icon: MessageSquare, hint: "Pedidos de funcionalidades" },
  { id: "suggestions", label: "Sugestões", icon: Lightbulb, hint: "Melhorias implícitas e explícitas" },
  { id: "opportunities", label: "Oportunidades", icon: Target, hint: "Produto e negócio por impacto" },
  { id: "qualitative", label: "Padrões qualitativos", icon: Layers, hint: "Temas e sentimento" },
  { id: "quantitative", label: "Padrões quantitativos", icon: BarChart3, hint: "Distribuição e correlações" },
  { id: "strategy", label: "Estratégias", icon: Target, hint: "Produto e mercado" },
  { id: "business", label: "Negócios", icon: TrendingUp, hint: "Monetização e churn" },
  { id: "roi", label: "ROI", icon: TrendingUp, hint: "Priorização de iniciativas" },
  { id: "evidence", label: "Evidências", icon: FileText, hint: "Catálogo de citações reais" },
  { id: "summary", label: "Resumo executivo", icon: FileText, hint: "Consolidado de tudo" },
] as const;

const RATING_FILTERS = [0, 1, 2, 3, 4, 5] as const;

/* ---------------------------------------------------------------- empty states --- */
function EmptyHint({ icon: Icon = AlertTriangle, children }: { icon?: typeof AlertTriangle; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <Icon className="h-6 w-6 text-muted-foreground/50" />
      <p className="text-xs text-muted-foreground max-w-xs">{children}</p>
    </div>
  );
}

/* ====================================================================== */
/* LEFT SIDEBAR — search + collect + select (functional)                   */
/* ====================================================================== */
function ConceptLeftSidebar() {
  const dataset = useDataset();
  const { settings, searchOptions, reviewOptions } = useCollectionSettings();
  const { selected, toggle, selectAll, selectNone, isSelected } = useSelection();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<AppInfo[]>([]);
  const [collecting, setCollecting] = useState<string | null>(null);
  const [error, setError] = useState("");

  const region = getUserRegion();

  const doSearch = useCallback(async () => {
    const term = query.trim();
    if (term.length < 2) return;
    setSearching(true); setError(""); setResults([]);
    try {
      const [apple, google] = await Promise.allSettled([
        searchApps(term, region, settings.searchLimit),
        searchGooglePlayApps(term, region, settings.searchLimit),
      ]);
      const out: AppInfo[] = [];
      if (apple.status === "fulfilled") out.push(...apple.value);
      if (google.status === "fulfilled") out.push(...google.value);
      setResults(out);
      if (out.length === 0) setError("Nenhum app encontrado. Tente outro termo.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha na busca");
    } finally {
      setSearching(false);
    }
  }, [query, region, settings.searchLimit]);

  const doCollect = useCallback(async (app: AppInfo) => {
    setCollecting(`${app.store}:${app.id}`); setError("");
    try {
      await collectApp(app, region, settings.reviewLimit, settings.reviewSort);
      setResults((prev) => prev.filter((a) => `${a.store}:${a.id}` !== `${app.store}:${app.id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao coletar");
    } finally {
      setCollecting(null);
    }
  }, [region, settings.reviewLimit, settings.reviewSort]);

  const allKeys = useMemo(() => dataset.map((e) => `${e.app.store}:${e.app.id}`), [dataset]);
  const allSelected = allKeys.length > 0 && allKeys.every((k) => selected.has(k));

  return (
    <div className="flex flex-col h-full text-xs">
      <div className="p-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/60 text-primary-foreground">
            <Crown className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="text-sm font-bold leading-tight">Review Intelligence</p>
            <p className="text-[10px] text-muted-foreground">workspace funcional</p>
          </div>
        </div>
      </div>

      {/* search */}
      <div className="p-3 border-b border-border/50 space-y-2">
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Buscar apps para coletar</label>
        <div className="flex gap-1.5">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doSearch()}
            placeholder="nome, categoria, URL ou ID…"
            className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
          />
          <Button size="sm" variant="default" className="h-7 w-7 p-0" onClick={doSearch} disabled={searching} title="Buscar">
            {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          </Button>
        </div>
        {error && <p className="text-[10px] text-destructive">{error}</p>}

        {results.length > 0 && (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {results.map((app) => {
              const key = `${app.store}:${app.id}`;
              const isCollected = dataset.some((e) => `${e.app.store}:${e.app.id}` === key);
              return (
                <div key={key} className="flex items-center gap-2 rounded-md border border-border/40 p-1.5">
                  {app.icon && <img src={app.icon} alt="" className="h-6 w-6 rounded" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium truncate">{app.name}</p>
                    <p className="text-[9px] text-muted-foreground uppercase">{app.store}</p>
                  </div>
                  {isCollected ? (
                    <span className="text-[9px] text-emerald-500 flex items-center gap-0.5"><CheckCircle2 className="h-3 w-3" /> coletado</span>
                  ) : (
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] gap-1" disabled={collecting === key} onClick={() => doCollect(app)}>
                      {collecting === key ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                      {collecting === key ? "..." : "Coletar"}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* dataset list with selection */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-between px-3 py-2 sticky top-0 bg-card/95 backdrop-blur">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Coletados · {selected.size}/{dataset.length}</span>
          <div className="flex gap-1">
            <button onClick={() => selectAll(allKeys)} disabled={dataset.length === 0 || allSelected} className="text-[9px] text-primary hover:underline disabled:opacity-40">Todos</button>
            <span className="text-muted-foreground">·</span>
            <button onClick={selectNone} disabled={selected.size === 0} className="text-[9px] text-primary hover:underline disabled:opacity-40">Nenhum</button>
          </div>
        </div>

        {dataset.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <Database className="h-5 w-5 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-[11px] text-muted-foreground">Busque acima para coletar apps. Os coletados aparecem aqui e podem ser selecionados para a IA.</p>
          </div>
        ) : (
          <div className="space-y-0.5 px-2">
            {dataset.map((e) => {
              const key = `${e.app.store}:${e.app.id}`;
              const isSel = isSelected(key);
              return (
                <button
                  key={key}
                  role="checkbox"
                  aria-checked={isSel}
                  onClick={() => toggle(key)}
                  className={cn(
                    "w-full flex items-center gap-2 rounded-md p-1.5 text-left transition-colors",
                    isSel ? "bg-primary/10" : "hover:bg-secondary",
                  )}
                >
                  {e.app.icon && <img src={e.app.icon} alt="" className="h-7 w-7 rounded shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-[11px] font-medium truncate", isSel && "text-primary")}>{e.app.name}</p>
                    <p className="text-[9px] text-muted-foreground">{e.reviews.length} reviews · {e.app.store}</p>
                  </div>
                  {isSel && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* quick settings summary */}
      <div className="p-3 border-t border-border/50 text-[10px] text-muted-foreground space-y-0.5">
        <div className="flex justify-between"><span>Região</span><span className="font-medium uppercase">{region}</span></div>
        <div className="flex justify-between"><span>Reviews/app</span><span className="font-medium">{settings.reviewLimit}</span></div>
        <div className="flex justify-between"><span>Ordenação</span><span className="font-medium">{settings.reviewSort}</span></div>
        <p className="text-[9px] italic pt-1 text-muted-foreground/70">Ajuste em Config (sidebar esquerda).</p>
      </div>
    </div>
  );
}

/* ====================================================================== */
/* CENTER — tabbed workspace: overview / analyses / decisions / artifacts  */
/* ====================================================================== */
type CenterTab = "overview" | "analyses" | "decisions" | "artifacts";

function CenterWorkspace({
  activeApps, reviews,
}: {
  activeApps: DatasetEntry[];
  reviews: import("@/lib/appStoreApi").ReviewEntry[];
}) {
  const [tab, setTab] = useState<CenterTab>("overview");
  const ai = useAISettings();
  const aiOn = isAIEnabled(ai);

  const tabs: { id: CenterTab; label: string; icon: typeof BarChart3 }[] = [
    { id: "overview", label: "Visão geral", icon: BarChart3 },
    { id: "analyses", label: "Análises IA", icon: BrainCircuit },
    { id: "decisions", label: "Decisões", icon: Target },
    { id: "artifacts", label: "Artefatos", icon: Download },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-0.5 border-b border-border/50 px-3 shrink-0">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors",
                tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === "overview" && <OverviewPanel apps={activeApps} reviews={reviews} />}
        {tab === "analyses" && <AnalysesPanel apps={activeApps} aiOn={aiOn} ai={ai} />}
        {tab === "decisions" && <DecisionsPanel apps={activeApps} aiOn={aiOn} ai={ai} />}
        {tab === "artifacts" && <ArtifactsPanel apps={activeApps} reviews={reviews} />}
      </div>
    </div>
  );
}

/* --- overview: KPIs + charts + per-app stats --- */
function OverviewPanel({ apps, reviews }: { apps: DatasetEntry[]; reviews: import("@/lib/appStoreApi").ReviewEntry[] }) {
  const kpis = useMemo(() => computeKPIs(reviews, apps), [reviews, apps]);
  const stats = useMemo(() => computePerAppStats(apps), [apps]);
  const ratingDist = useMemo(() => computeRatingDistribution(reviews), [reviews]);
  const sentiment = useMemo(() => computeSentiment(reviews), [reviews]);

  if (apps.length === 0)
    return <EmptyHint icon={Database}>Colete e selecione apps na barra à esquerda para ver a visão geral, gráficos e estatísticas.</EmptyHint>;

  return (
    <div className="p-4 space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: "Apps", value: kpis.totalApps, icon: Database },
          { label: "Reviews", value: kpis.totalReviews, icon: MessageSquare },
          { label: "Nota média", value: kpis.avgRating.toFixed(2), icon: Star },
          { label: "% positivo", value: `${kpis.positivePct}%`, icon: TrendingUp },
        ].map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="rounded-lg border border-border/60 bg-card p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Icon className="h-3 w-3" />
                <span className="text-[10px] uppercase tracking-wider">{k.label}</span>
              </div>
              <p className="text-xl font-bold">{k.value}</p>
            </div>
          );
        })}
      </div>

      {/* charts */}
      <div className="grid md:grid-cols-2 gap-3">
        <div className="rounded-lg border border-border/60 bg-card p-3 h-60">
          <p className="text-xs font-semibold mb-2">Distribuição de notas</p>
          <div className="h-[calc(100%-1.75rem)]">
            <AggregateRatingChart data={ratingDist} />
          </div>
        </div>
        <div className="rounded-lg border border-border/60 bg-card p-3 h-60">
          <p className="text-xs font-semibold mb-2">Sentimento</p>
          <div className="h-[calc(100%-1.75rem)]">
            <AggregateSentimentChart data={sentiment} />
          </div>
        </div>
      </div>

      {/* per-app table */}
      <div className="rounded-lg border border-border/60 bg-card">
        <div className="px-3 py-2 border-b border-border/40">
          <p className="text-xs font-semibold">Estatísticas por app</p>
        </div>
        <div className="divide-y divide-border/30">
          {stats.map((s) => <PerAppRow key={s.key} stat={s} />)}
        </div>
      </div>
    </div>
  );
}

/* --- analyses: generate 13 sections with real IA --- */
function AnalysesPanel({
  apps, aiOn, ai,
}: {
  apps: DatasetEntry[]; aiOn: boolean; ai: ReturnType<typeof useAISettings>;
}) {
  const [active, setActive] = useState<string>("summary");
  const [outputs, setOutputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  // Reidrata outputs persistidos deste escopo (sobrevivem a reload/restart).
  const scopeKey = apps.map((e) => `${e.app.store}:${e.app.id}`).sort().join(",");
  useEffect(() => {
    if (apps.length === 0) return;
    const appKeys = apps.map((e) => `${e.app.store}:${e.app.id}`);
    setOutputs((prev) => {
      const next = { ...prev };
      for (const s of ANALYSIS_SECTIONS) {
        if (next[s.id]) continue;
        const rec = getAIOutputFor(s.id, appKeys);
        if (rec) next[s.id] = rec.markdown;
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);

  const run = useCallback(async (sectionId: string) => {
    if (!aiOn || apps.length === 0) return;
    setLoading(sectionId); setError("");
    const ac = new AbortController(); abortRef.current = ac;
    setOutputs((prev) => ({ ...prev, [sectionId]: "" }));
    await streamExperiment(
      sectionId, apps,
      {
        onToken: (full) => setOutputs((prev) => ({ ...prev, [sectionId]: full })),
        onDone: (full) => setOutputs((prev) => ({ ...prev, [sectionId]: full })),
        onError: (e) => setError(e),
      },
      ac.signal, ai,
    );
    setLoading(null);
  }, [apps, aiOn, ai]);

  if (apps.length === 0)
    return <EmptyHint icon={Database}>Selecione apps à esquerda, depois gere análises de IA sobre os reviews coletados.</EmptyHint>;

  return (
    <div className="flex h-full">
      {/* section list */}
      <div className="w-52 shrink-0 border-r border-border/50 overflow-y-auto p-2 space-y-0.5">
        {ANALYSIS_SECTIONS.map((s) => {
          const Icon = s.icon;
          const has = !!outputs[s.id];
          const isLoading = loading === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={cn(
                "w-full flex items-start gap-2 rounded-md p-2 text-left transition-colors",
                active === s.id ? "bg-primary/10 text-primary" : "hover:bg-secondary text-muted-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium truncate">{s.label}</p>
                <p className="text-[9px] text-muted-foreground line-clamp-1">{s.hint}</p>
              </div>
              {isLoading ? <Loader2 className="h-3 w-3 animate-spin shrink-0 mt-0.5" /> : has ? <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" /> : null}
            </button>
          );
        })}
      </div>

      {/* output */}
      <div className="flex-1 min-w-0 flex flex-col">
        {(() => {
          const sec = ANALYSIS_SECTIONS.find((s) => s.id === active);
          if (!sec) return null;
          const out = outputs[active] ?? "";
          const isLoading = loading === active;
          return (
            <>
              <div className="flex items-center justify-between p-3 border-b border-border/40 shrink-0">
                <div>
                  <p className="text-sm font-semibold flex items-center gap-1.5"><sec.icon className="h-4 w-4 text-primary" /> {sec.label}</p>
                  <p className="text-[11px] text-muted-foreground">{sec.hint}</p>
                </div>
                <Button size="sm" onClick={() => run(active)} disabled={isLoading || !aiOn} className="gap-1.5">
                  {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {isLoading ? "Gerando…" : out ? "Regenerar" : "Gerar análise"}
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 relative">
                {out ? (
                  <AIOutputCard bare title={sec.label} content={out} streaming={isLoading} filename="concept-analise" storageKey={`concept:${sec.id}`} onRegenerate={isLoading || !aiOn ? undefined : () => run(active)} />
                ) : isLoading ? (
                  <p className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> A IA está lendo os reviews e gerando a análise…</p>
                ) : error ? (
                  <p className="text-xs text-destructive">{error}</p>
                ) : !aiOn ? (
                  <AIDisabledNotice compact />
                ) : (
                  <EmptyHint icon={Wand2}>{`Clique em "Gerar análise" para a IA produzir ${sec.label} com base nos ${apps.length} app(s) selecionado(s).`}</EmptyHint>
                )}
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}

/* --- decisions: consolidate suggestions/opportunities/roi --- */
function DecisionsPanel({
  apps, aiOn, ai,
}: {
  apps: DatasetEntry[]; aiOn: boolean; ai: ReturnType<typeof useAISettings>;
}) {
  const [out, setOut] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async () => {
    if (!aiOn || apps.length === 0) return;
    setLoading(true); setError(""); setOut("");
    const ac = new AbortController(); abortRef.current = ac;
    const msgs: ChatMessage[] = [{
      role: "user",
      content: `Com base nos reviews destes ${apps.length} app(s), produza um PAINEL DE DECISÕES executivo. Estruture em 4 seções marcadas com ##:\n1. ## Top 3 problemas para resolver agora (com severidade Alta/Média/Baixa e evidência)\n2. ## Top 3 oportunidades de produto (impacto x esforço)\n3. ## Decisões recomendadas (3 bullets acionáveis, cada um com prazo sugerido: curto/médio/longo prazo)\n4. ## Métricas a monitorar (3 KPIs derivados dos reviews)\nUse blockquotes com citações reais. Seja específico e priorize por evidência.`,
    }];
    await streamExperimentChat(apps, msgs, { onToken: setOut, onDone: setOut, onError: setError }, ac.signal, ai);
    setLoading(false);
  }, [apps, aiOn, ai]);

  if (apps.length === 0)
    return <EmptyHint icon={Database}>Selecione apps à esquerda para gerar um painel de decisões consolidado.</EmptyHint>;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-border/40 shrink-0">
        <div>
          <p className="text-sm font-semibold flex items-center gap-1.5"><Target className="h-4 w-4 text-primary" /> Painel de decisões</p>
          <p className="text-[11px] text-muted-foreground">Consolida problemas, oportunidades e recomendações priorizadas.</p>
        </div>
        <Button size="sm" onClick={run} disabled={loading || !aiOn} className="gap-1.5">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {loading ? "Gerando…" : "Gerar painel"}
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 relative">
        {out ? (
          <AIOutputCard bare title="Painel de decisões" content={out} streaming={loading} filename="concept-decisoes" storageKey="concept:decisions" onRegenerate={loading || !aiOn ? undefined : run} />
        ) : loading ? (
          <p className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Consolidando decisões…</p>
        ) : error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : !aiOn ? (
          <AIDisabledNotice compact />
        ) : (
          <EmptyHint icon={Target}>{"Clique em \"Gerar painel\" para a IA consolidar problemas, oportunidades e decisões priorizadas."}</EmptyHint>
        )}
      </div>
    </div>
  );
}

/* --- artifacts: export data + IA outputs --- */
function ArtifactsPanel({
  apps, reviews,
}: {
  apps: DatasetEntry[]; reviews: import("@/lib/appStoreApi").ReviewEntry[];
}) {
  if (apps.length === 0)
    return <EmptyHint icon={Database}>Colete e selecione apps à esquerda para exportar artefatos (JSON, CSV, Markdown).</EmptyHint>;

  return (
    <div className="p-4 space-y-4">
      <SectionTag icon={Download} kicker="Exportar" />
      <div className="grid sm:grid-cols-2 gap-3">
        {apps.map((e) => (
          <div key={`${e.app.store}:${e.app.id}`} className="rounded-lg border border-border/60 bg-card p-3 space-y-2">
            <div className="flex items-center gap-2">
              {e.app.icon && <img src={e.app.icon} alt="" className="h-7 w-7 rounded" />}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">{e.app.name}</p>
                <p className="text-[10px] text-muted-foreground">{e.reviews.length} reviews · {e.app.store}</p>
              </div>
            </div>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 flex-1" onClick={() => exportToMarkdown(e.app, e.reviews)}>
                <FileText className="h-3 w-3" /> Markdown
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 flex-1" onClick={() => exportAppMetaCSV([e.app])}>
                <Download className="h-3 w-3" /> CSV meta
              </Button>
            </div>
          </div>
        ))}
      </div>

      {apps.length > 1 && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
          <p className="text-xs font-semibold mb-1">Dataset completo ({apps.length} apps, {reviews.length} reviews)</p>
          <p className="text-[11px] text-muted-foreground mb-2">Exporte todos os apps selecionados como CSV de metadados.</p>
          <Button size="sm" variant="default" className="gap-1.5" onClick={() => exportAppMetaCSV(apps.map((e) => e.app))}>
            <Download className="h-3.5 w-3.5" /> Exportar metadados ({apps.length} apps)
          </Button>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground italic">
        Dica: gere análises na aba "Análises IA" e copie o conteúdo (Markdown) para seus relatórios. As citações da IA são reais.
      </p>
    </div>
  );
}

/* ====================================================================== */
/* RIGHT SIDEBAR — AI assistant + live proof                               */
/* ====================================================================== */
function ConceptRightSidebar({ apps }: { apps: DatasetEntry[] }) {
  const reviews = useMemo(() => apps.flatMap((e) => e.reviews), [apps]);
  const ai = useAISettings();
  const aiOn = isAIEnabled(ai);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sentiment = useMemo(() => computeSentiment(reviews), [reviews]);
  const pieData = useMemo(() => {
    const byName = Object.fromEntries(sentiment.map((d) => [d.name, d.value]));
    return [
      { name: "Positivo", value: byName["Positivo (★4-5)"] ?? 0, color: SENT_COLORS[0] },
      { name: "Neutro", value: byName["Neutro (★3)"] ?? 0, color: SENT_COLORS[1] },
      { name: "Negativo", value: byName["Negativo (★1-2)"] ?? 0, color: SENT_COLORS[2] },
    ].filter((d) => d.value > 0);
  }, [sentiment]);
  const stats = useMemo(() => computePerAppStats(apps), [apps]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading || apps.length === 0 || !aiOn) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput(""); setLoading(true);
    const ac = new AbortController(); abortRef.current = ac;
    await streamExperimentChat(
      apps, next,
      {
        onToken: (full) => setMessages((prev) => { const c = [...prev]; c[c.length - 1] = { role: "assistant", content: full }; return c; }),
        onDone: (full) => setMessages((prev) => { const c = [...prev]; c[c.length - 1] = { role: "assistant", content: full }; return c; }),
        onError: (e) => setMessages((prev) => { const c = [...prev]; c[c.length - 1] = { role: "assistant", content: `⚠️ ${e}` }; return c; }),
      },
      ac.signal, ai,
    );
    setLoading(false);
  }, [input, loading, apps, aiOn, ai, messages]);

  const sendSuggestion = useCallback((prompt: string) => {
    if (loading || apps.length === 0 || !aiOn) return;
    setInput(prompt);
    setTimeout(() => {
      const next: ChatMessage[] = [...messages, { role: "user", content: prompt }];
      setMessages([...next, { role: "assistant", content: "" }]);
      setLoading(true);
      const ac = new AbortController(); abortRef.current = ac;
      streamExperimentChat(apps, next, {
        onToken: (full) => setMessages((prev) => { const c = [...prev]; c[c.length - 1] = { role: "assistant", content: full }; return c; }),
        onDone: (full) => setMessages((prev) => { const c = [...prev]; c[c.length - 1] = { role: "assistant", content: full }; return c; }),
        onError: (e) => setMessages((prev) => { const c = [...prev]; c[c.length - 1] = { role: "assistant", content: `⚠️ ${e}` }; return c; }),
      }, ac.signal, ai).finally(() => setLoading(false));
    }, 50);
  }, [loading, apps, aiOn, ai, messages]);

  const SUGGESTIONS = [
    "Quais são os 3 maiores problemas relatados?",
    "Qual a principal oportunidade de produto?",
    "Compare o sentimento entre os apps selecionados",
    "Quais funcionalidades os usuários mais pedem?",
  ];

  return (
    <div className="flex flex-col h-full">
      {/* live proof */}
      <div className="p-3 border-b border-border/50 space-y-2">
        <p className="text-xs font-semibold">Prova de valor ao vivo</p>
        {apps.length === 0 ? (
          <p className="text-[10px] text-muted-foreground">Colete e selecione apps para ver dados reais.</p>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <div className="h-16 w-16">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={14} outerRadius={28} paddingAngle={2}>
                      {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-0.5">
                {pieData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between text-[10px]">
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: d.color }} />{d.name}</span>
                    <span className="font-medium">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
            {stats.length > 0 && (
              <div className="space-y-0.5">
                {[...stats].sort((a, b) => b.positivePct - a.positivePct).slice(0, 3).map((s, i) => (
                  <div key={s.key} className="flex items-center gap-2 text-[10px]">
                    <span className="text-muted-foreground w-3">{i + 1}.</span>
                    <span className="truncate flex-1">{s.name}</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">{s.positivePct}%</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* AI assistant */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-3 py-2 border-b border-border/40 flex items-center gap-1.5">
          <BrainCircuit className="h-3.5 w-3.5 text-primary" />
          <p className="text-xs font-semibold">Assistente de IA</p>
          <span className="ml-auto text-[9px] text-muted-foreground">{apps.length} app(s) · {reviews.length} reviews</span>
        </div>

        {/* messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
          {messages.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <Wand2 className="h-6 w-6 text-muted-foreground/40 mx-auto" />
              <p className="text-[11px] text-muted-foreground">
                {apps.length === 0 ? "Selecione apps à esquerda para conversar com a IA." : !aiOn ? "Ative a IA em Configurações para conversar." : "Pergunte algo aos seus reviews, ou use uma sugestão abaixo."}
              </p>
              {aiOn && apps.length > 0 && (
                <div className="space-y-1.5 text-left">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => sendSuggestion(s)} disabled={loading} className="w-full text-left text-[10px] rounded-md border border-border/40 p-2 hover:bg-secondary transition-colors disabled:opacity-50">
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={cn("rounded-lg p-2.5 text-[11px] leading-relaxed", m.role === "user" ? "bg-primary/10 ml-4" : "bg-muted/40 mr-4")}>
                {m.role === "assistant" && m.content ? (
                  <AIOutputCard bare content={m.content} filename={`concept-chat-${i}`} storageKey={`concept-chat-${i}`} />
                ) : m.role === "assistant" && loading && i === messages.length - 1 ? (
                  <span className="flex items-center gap-1.5 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> pensando…</span>
                ) : (
                  m.content
                )}
              </div>
            ))
          )}
        </div>

        {/* composer */}
        <div className="p-2 border-t border-border/40">
          <div className="flex gap-1.5">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
              placeholder={aiOn ? apps.length > 0 ? "Pergunte aos reviews…" : "Selecione apps primeiro" : "IA desativada"}
              disabled={!aiOn || apps.length === 0 || loading}
              className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] disabled:opacity-50"
            />
            <Button size="sm" className="h-7 w-7 p-0" onClick={send} disabled={!aiOn || apps.length === 0 || loading || !input.trim()}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </Button>
          </div>
          {!aiOn && <p className="text-[9px] text-muted-foreground mt-1">Ative a IA em Configurações → Inteligência Artificial.</p>}
        </div>
      </div>
    </div>
  );
}

/* ====================================================================== */
/* PAGE — full functional workspace (3 columns)                           */
/* ====================================================================== */
export default function Concept() {
  const { setPickerOpen } = useCompare();
  const dataset = useDataset();
  const { selected } = useSelection();

  const activeApps = useMemo(() => {
    if (dataset.length === 0) return [];
    if (selected.size === 0) return dataset;
    return dataset.filter((e) => selected.has(`${e.app.store}:${e.app.id}`));
  }, [dataset, selected]);

  const reviews = useMemo(() => activeApps.flatMap((e) => e.reviews), [activeApps]);

  // F1: Keyboard shortcut — export all data with "e"
  useHotkey("e", () => {
    if (activeApps.length === 0) return;
    const data = JSON.stringify({ apps: activeApps.map((e) => e.app), exportedAt: new Date().toISOString() }, null, 2);
    downloadFile("concept-apps.json", data, "application/json");
  }, [activeApps.length]);

  return (
    <div className="h-full flex bg-background">
      {/* LEFT — coleta & seleção (sidebar interna da página) */}
      <PageSidebar
        meta={{
          id: "concept-collect", side: "left",
          title: "Coleta", subtitle: "buscar · coletar · selecionar",
          icon: <Database className="h-4 w-4" />,
          storageKey: "aso:concept-left-w", defaultWidth: 256,
          railIcons: <Database className="h-4 w-4" aria-hidden />,
        }}
      >
        <ConceptLeftSidebar />
      </PageSidebar>

      {/* CENTER — workspace tabs */}
      <div className="flex-1 min-w-0 flex flex-col">
        <AppHeader
          title="Review Intelligence"
          crumb={`${activeApps.length} app(s) · ${reviews.length} reviews`}
          compare={{ count: 0, onOpen: () => setPickerOpen(true) }}
        />
        <div className="flex-1 min-h-0">
          <CenterWorkspace activeApps={activeApps} reviews={reviews} />
        </div>
      </div>

      {/* RIGHT — assistente/prova (sidebar interna da página) */}
      <PageSidebar
        meta={{
          id: "concept-assistant", side: "right",
          title: "Assistente", subtitle: "prova de valor + copiloto",
          icon: <BrainCircuit className="h-4 w-4" />,
          storageKey: "aso:concept-right-w", defaultWidth: 320,
          railIcons: <BrainCircuit className="h-4 w-4" aria-hidden />,
        }}
      >
        <SidebarToolTabs
          toolLabel="Assistente"
          toolIcon={<BrainCircuit className="h-3 w-3" />}
          help={{
            description: "O Conceito é o workspace funcional de ponta a ponta: configure, colete, visualize, analise com IA, gere artefatos e decida — tudo numa página só.",
            tips: ["Colete apps na coluna esquerda (busca + coleta inline).", "As abas do centro cobrem visão geral, análises de IA, decisões e artefatos.", "A seleção global define o escopo de tudo."],
          }}
        >
          <ConceptRightSidebar apps={activeApps} />
        </SidebarToolTabs>
      </PageSidebar>
    </div>
  );
}
