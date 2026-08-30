/**
 * LayoutComponents — renderiza os componentes REAIS do sistema vinculados a
 * blocos de layout (registry em `src/lib/layoutComponents.ts`). Cada renderer
 * usa dados de verdade (dataset/seleção global/atividade/IA) — a tela
 * customizada é funcional, não mockup.
 *
 * Contrato: `LayoutComponentBody({ component, blockId })` devolve o conteúdo
 * do bloco; id desconhecido/ausente cai no placeholder estrutural.
 *
 * DENSIDADE: o body mede a própria largura (ResizeObserver) e expõe
 * `DenseContext` — componentes internos se ajustam ao tamanho do BLOCO
 * (não do viewport): menos colunas, menos campos, layouts empilhados.
 */
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity, AlertCircle, Bot, CheckCircle2, Cpu, Layers, Loader2, MessageSquare,
  Play, Presentation, Search, Send, Star, ThumbsUp, LayoutTemplate, ShieldAlert,
  Vault,
} from "lucide-react";
import { QuickCollect } from "@/components/shared/QuickCollect";
import {
  SearchFieldPanel, SearchResultsPanel, AppSelectionPanel,
} from "@/components/search/AppSearchPanels";
import { AIOutputCard } from "@/components/shared/AIOutputCard";
import { AIDisabledNotice } from "@/components/shared/AIDisabledNotice";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { useDataset } from "@/hooks/useDataset";
import { useSelection, entryKey } from "@/context/SelectionContext";
import { useGenerations } from "@/hooks/useSessions";
import { useAISettings, isAIEnabled, aiProvenance } from "@/lib/aiSettings";
import { useActiveTaskCount, listTasks } from "@/lib/activityStore";
import {
  computeKPIs, computeRatingDistribution, computeSentiment, computePerAppStats,
  computeWordCloud, computeTimeline, computeStoreComparison,
} from "@/lib/dashboardAnalytics";
import {
  KpiCard, AggregateRatingChart, AggregateSentimentChart,
  AggregateTimelineChart, StoreComparisonChart,
} from "@/components/dashboard/DashboardCharts";
import { streamExperimentChat, type ChatMessage } from "@/lib/experimentChatApi";
import { streamExperiment } from "@/lib/experimentApi";
import { EXPERIMENT_SECTIONS } from "@/lib/experimentSections";
import { layoutComponentMeta, publicComponentFile } from "@/lib/layoutComponents";
import { ComponentLiveRender } from "@/components/catalog/ComponentLiveRender";
import { TopCharts } from "@/components/TopCharts";
import { SessionsPanel } from "@/components/SessionsPanel";
import {
  CollectedListPanel, CollectionConfigPanel, DataQualityPanel,
} from "@/components/page01/panels";
import { computeFacts } from "@/lib/pipeline/facts";
import { detectAnomalies } from "@/lib/pipeline/anomalies";
import { useArtifacts } from "@/lib/pipeline/artifactStore";
import { STAGE_META } from "@/lib/pipeline/types";
import { listAllAgents } from "@/lib/agents";
import { runAgent } from "@/lib/agentRunner";
import { listDecks } from "@/lib/presentations";
import { semanticSearchReviews } from "@/lib/embedSearch";
import { saveAIOutput, getAIOutputFor } from "@/lib/aiOutputStore";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------ densidade --- */

/** true quando o BLOCO (não o viewport) é estreito — componentes se adaptam. */
const DenseContext = createContext(false);
function useDense(): boolean {
  return useContext(DenseContext);
}

/* ------------------------------------------------------------ escopo --- */

/** Apps do escopo = seleção global; vazio = dataset inteiro (padrão do sistema). */
function useScopedEntries() {
  const { entries } = useDataset();
  const { selected } = useSelection();
  return useMemo(
    () => (selected.size > 0
      ? entries.filter((e) => selected.has(entryKey(e.app.store, e.app.id)))
      : entries),
    [entries, selected],
  );
}

/* ------------------------------------------------- componentes reais --- */

function AppsHistory() {
  const { entries } = useDataset();
  const { selected, toggle, selectAll, selectNone } = useSelection();
  const generations = useGenerations();
  const [tab, setTab] = useState<"apps" | "history">("apps");
  return (
    <div className="flex h-full flex-col">
      <div role="tablist" aria-label="Apps e histórico" className="flex gap-1 border-b border-border/50 px-2 pt-1">
        {([["apps", `Apps (${entries.length})`], ["history", `Histórico (${generations.length})`]] as const).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "rounded-t px-2 py-1 text-[11px] font-medium focus-visible:ring-2 focus-visible:ring-primary/60",
              tab === id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {tab === "apps" ? (
          entries.length === 0 ? (
            <p className="p-2 text-[11px] text-muted-foreground">Nenhum app coletado ainda — use o bloco “Buscar & coletar”.</p>
          ) : (
            <div className="space-y-1">
              <div className="flex gap-1 px-1 pb-1">
                <button onClick={() => selectAll(entries.map((e) => entryKey(e.app.store, e.app.id)))} className="rounded border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/60">Todos</button>
                <button onClick={selectNone} className="rounded border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/60">Nenhum</button>
              </div>
              {entries.map((e) => {
                const key = entryKey(e.app.store, e.app.id);
                const on = selected.has(key);
                return (
                  <button
                    key={key}
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(key)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs focus-visible:ring-2 focus-visible:ring-primary/60",
                      on ? "border-primary/50 bg-primary/5" : "border-border/60 hover:border-primary/40",
                    )}
                  >
                    <span className={cn("h-3.5 w-3.5 rounded-sm border flex items-center justify-center", on ? "bg-primary border-primary text-primary-foreground" : "border-border")}>
                      {on && <CheckCircle2 className="h-3 w-3" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium text-foreground">{e.app.name}</span>
                    <span className="text-[10px] text-muted-foreground">{e.app.store === "apple" ? "Apple" : "Google"}</span>
                    <span className="text-[10px] text-muted-foreground">{e.reviews.length} rev</span>
                  </button>
                );
              })}
            </div>
          )
        ) : (
          generations.length === 0 ? (
            <p className="p-2 text-[11px] text-muted-foreground">Nenhuma coleta/geração registrada ainda.</p>
          ) : (
            <ul className="space-y-1" role="list">
              {generations.slice(0, 20).map((g) => (
                <li key={g.id} className="rounded-lg border border-border/60 px-2 py-1.5">
                  <p className="truncate text-xs font-medium text-foreground">{g.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {g.type} · {new Date(g.createdAt).toLocaleString("pt-BR")}{g.summary ? ` · ${g.summary}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )
        )}
      </div>
    </div>
  );
}

function MiniAIChat() {
  const scoped = useScopedEntries();
  const ai = useAISettings();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const send = (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    if (!isAIEnabled(ai)) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const next: ChatMessage[] = [...messages, { role: "user", content: q }, { role: "assistant", content: "" }];
    setMessages(next);
    setInput("");
    setBusy(true);
    const idx = next.length - 1;
    streamExperimentChat(
      scoped,
      next.slice(0, -1),
      {
        onToken: (full) => setMessages((m) => m.map((msg, i) => (i === idx ? { ...msg, content: full } : msg))),
        onDone: (full) => { setMessages((m) => m.map((msg, i) => (i === idx ? { ...msg, content: full } : msg))); setBusy(false); },
        onError: () => { setMessages((m) => m.slice(0, -1)); setBusy(false); },
      },
      ctrl.signal,
      ai,
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-2 overflow-y-auto p-2" role="log" aria-label="Conversa com IA">
        {messages.length === 0 && (
          <p className="p-2 text-[11px] text-muted-foreground">
            Converse com a IA sobre {scoped.length > 0 ? `${scoped.length} app(s) no escopo` : "o sistema"}.
            {!isAIEnabled(ai) && " Ative a IA em Configurações para começar."}
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : ""}>
            {m.role === "user" ? (
              <span className="inline-block max-w-[85%] rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs text-foreground">{m.content}</span>
            ) : (
              <AIOutputCard
                bare
                content={m.content}
                streaming={busy && i === messages.length - 1}
                filename="chat-layout"
                storageKey={`layout-chat-${i}`}
              />
            )}
          </div>
        ))}
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="flex shrink-0 gap-1.5 border-t border-border/50 p-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isAIEnabled(ai) ? "Pergunte sobre os apps…" : "Ative a IA em Configurações…"}
          aria-label="Mensagem para a IA"
          disabled={!isAIEnabled(ai)}
          className="min-w-0 flex-1 rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={busy || !input.trim() || !isAIEnabled(ai)}
          aria-label="Enviar mensagem"
          className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        </button>
      </form>
    </div>
  );
}

function ChartsBody() {
  const scoped = useScopedEntries();
  const reviews = useMemo(() => scoped.flatMap((e) => e.reviews), [scoped]);
  const kpis = useMemo(() => computeKPIs(reviews, scoped), [reviews, scoped]);
  const dist = useMemo(() => computeRatingDistribution(reviews), [reviews]);
  const sentiment = useMemo(() => computeSentiment(reviews), [reviews]);
  if (scoped.length === 0) {
    return <p className="p-2 text-[11px] text-muted-foreground">Colete apps para ver gráficos aqui.</p>;
  }
  return (
    <div className="space-y-3 p-2">
      <div className="grid grid-cols-2 gap-2">
        <KpiCard label="Reviews" value={kpis.totalReviews} icon={Star} />
        <KpiCard label="Nota média" value={kpis.avgRating.toFixed(1)} icon={ThumbsUp} accent="success" />
      </div>
      <div className="h-[160px]"><AggregateRatingChart data={dist} /></div>
      <div className="h-[160px]"><AggregateSentimentChart data={sentiment} /></div>
    </div>
  );
}

function KpisBody() {
  const scoped = useScopedEntries();
  const dense = useDense();
  const reviews = useMemo(() => scoped.flatMap((e) => e.reviews), [scoped]);
  const kpis = useMemo(() => computeKPIs(reviews, scoped), [reviews, scoped]);
  if (scoped.length === 0) {
    return <p className="p-2 text-[11px] text-muted-foreground">Colete apps para ver KPIs aqui.</p>;
  }
  return (
    <div className={cn("grid grid-cols-2 gap-2 p-2", !dense && "lg:grid-cols-4")}>
      <KpiCard label="Apps" value={kpis.totalApps} icon={Layers} />
      <KpiCard label="Reviews" value={kpis.totalReviews} icon={Star} />
      <KpiCard label="Nota média" value={kpis.avgRating.toFixed(1)} icon={ThumbsUp} accent="success" />
      <KpiCard label="% positivas" value={`${kpis.positivePct.toFixed(0)}%`} icon={Activity} accent="warning" />
    </div>
  );
}

function DatasetBody() {
  const scoped = useScopedEntries();
  const dense = useDense();
  const stats = useMemo(() => computePerAppStats(scoped), [scoped]);
  if (stats.length === 0) {
    return <p className="p-2 text-[11px] text-muted-foreground">Colete apps para ver a tabela aqui.</p>;
  }
  return (
    <div className="overflow-x-auto p-2">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
            <th className="px-1 py-1">App</th><th className="px-1 py-1">Loja</th>
            <th className="px-1 py-1 text-right">Reviews</th><th className="px-1 py-1 text-right">Nota</th>
            {!dense && <th className="px-1 py-1 text-right">% pos</th>}
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => (
            <tr key={s.key} className="border-t border-border/40">
              <td className="max-w-0 truncate px-1 py-1 font-medium text-foreground" style={{ maxWidth: 140 }}>{s.name}</td>
              <td className="px-1 py-1 text-muted-foreground">{s.store === "apple" ? "Apple" : "Google"}</td>
              <td className="px-1 py-1 text-right">{s.reviewCount}</td>
              <td className="px-1 py-1 text-right">{s.avgCollected.toFixed(1)}</td>
              {!dense && <td className="px-1 py-1 text-right">{s.positivePct.toFixed(0)}%</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Reviews recentes do escopo com filtro por nota. */
function ReviewsFeedBody() {
  const scoped = useScopedEntries();
  const [star, setStar] = useState<number | null>(null);
  const reviews = useMemo(() => {
    const all = scoped.flatMap((e) => e.reviews.map((r) => ({ ...r, appName: e.app.name })));
    all.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
    return star == null ? all : all.filter((r) => r.rating === star);
  }, [scoped, star]);
  if (scoped.length === 0) {
    return <p className="p-2 text-[11px] text-muted-foreground">Colete apps para ver reviews aqui.</p>;
  }
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-1 px-2 pt-1.5" role="group" aria-label="Filtrar por nota">
        <button
          onClick={() => setStar(null)}
          aria-pressed={star == null}
          className={cn("rounded px-1.5 py-0.5 text-[10px]", star == null ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}
        >
          Todas
        </button>
        {[5, 4, 3, 2, 1].map((s) => (
          <button
            key={s}
            onClick={() => setStar(s)}
            aria-pressed={star === s}
            className={cn("rounded px-1.5 py-0.5 text-[10px]", star === s ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}
          >
            ★{s}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-muted-foreground" role="status">{reviews.length} reviews</span>
      </div>
      <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2" role="list">
        {reviews.slice(0, 40).map((r) => (
          <li key={r.id} className="rounded-lg border border-border/50 px-2 py-1.5">
            <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className="text-warning">{"★".repeat(r.rating)}</span>
              <span className="truncate font-medium text-foreground">{r.appName}</span>
              {r.author && <span className="truncate">· {r.author}</span>}
              <span className="ml-auto shrink-0">{r.date}</span>
            </p>
            {r.title && <p className="mt-0.5 text-[11px] font-medium text-foreground">{r.title}</p>}
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{r.text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Nuvem de termos dos reviews do escopo. */
function WordCloudBody() {
  const scoped = useScopedEntries();
  const reviews = useMemo(() => scoped.flatMap((e) => e.reviews), [scoped]);
  const words = useMemo(() => computeWordCloud(reviews, 30), [reviews]);
  if (scoped.length === 0) {
    return <p className="p-2 text-[11px] text-muted-foreground">Colete apps para ver a nuvem de termos aqui.</p>;
  }
  if (words.length === 0) {
    return <p className="p-2 text-[11px] text-muted-foreground">Sem termos suficientes nos reviews do escopo.</p>;
  }
  const max = words[0]?.[1] ?? 1;
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 p-2" role="img" aria-label="Nuvem dos termos mais frequentes nos reviews">
      {words.map(([word, count]) => (
        <span
          key={word}
          title={`${count} ocorrências`}
          className="text-primary/80"
          style={{ fontSize: `${Math.round(10 + (count / max) * 14)}px` }}
        >
          {word}
        </span>
      ))}
    </div>
  );
}

/** Timeline de reviews (volume + nota média). */
function TimelineBody() {
  const scoped = useScopedEntries();
  const reviews = useMemo(() => scoped.flatMap((e) => e.reviews), [scoped]);
  const data = useMemo(() => computeTimeline(reviews), [reviews]);
  if (scoped.length === 0) {
    return <p className="p-2 text-[11px] text-muted-foreground">Colete apps para ver a timeline aqui.</p>;
  }
  return <div className="h-full min-h-[160px] p-1"><AggregateTimelineChart data={data} /></div>;
}

/** Comparativo Apple × Google do escopo. */
function StoreCompareBody() {
  const scoped = useScopedEntries();
  const data = useMemo(() => computeStoreComparison(scoped), [scoped]);
  if (scoped.length === 0) {
    return <p className="p-2 text-[11px] text-muted-foreground">Colete apps das duas lojas para comparar aqui.</p>;
  }
  return <div className="h-full min-h-[160px] p-1"><StoreComparisonChart data={data} /></div>;
}

/** Tabela comparativa por app (completa). */
function PerAppBody() {
  const scoped = useScopedEntries();
  const dense = useDense();
  const stats = useMemo(() => computePerAppStats(scoped), [scoped]);
  if (stats.length === 0) {
    return <p className="p-2 text-[11px] text-muted-foreground">Colete apps para comparar aqui.</p>;
  }
  return (
    <div className="overflow-x-auto p-2">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
            <th className="px-1 py-1">App</th>
            <th className="px-1 py-1 text-right">Reviews</th>
            <th className="px-1 py-1 text-right">Nota</th>
            <th className="px-1 py-1 text-right">% pos</th>
            {!dense && <th className="px-1 py-1 text-right">% neg</th>}
            {!dense && <th className="px-1 py-1">Período</th>}
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => (
            <tr key={s.key} className="border-t border-border/40">
              <td className="max-w-0 truncate px-1 py-1 font-medium text-foreground" style={{ maxWidth: 160 }}>{s.name}</td>
              <td className="px-1 py-1 text-right">{s.reviewCount}</td>
              <td className="px-1 py-1 text-right">{s.avgCollected.toFixed(1)}</td>
              <td className="px-1 py-1 text-right text-success">{s.positivePct.toFixed(0)}%</td>
              {!dense && <td className="px-1 py-1 text-right text-destructive">{s.negativePct.toFixed(0)}%</td>}
              {!dense && <td className="px-1 py-1 text-[10px] text-muted-foreground">{s.oldestDate ?? "—"} → {s.newestDate ?? "—"}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Anomalias determinísticas (Pipeline). */
function AnomaliesBody() {
  const scoped = useScopedEntries();
  const anomalies = useMemo(() => {
    if (scoped.length === 0) return [];
    try {
      return detectAnomalies(scoped, computeFacts(scoped));
    } catch {
      return [];
    }
  }, [scoped]);
  if (scoped.length === 0) {
    return <p className="p-2 text-[11px] text-muted-foreground">Colete apps para detectar anomalias aqui.</p>;
  }
  if (anomalies.length === 0) {
    return (
      <p className="flex items-center gap-1.5 p-2 text-[11px] text-muted-foreground">
        <CheckCircle2 className="h-3.5 w-3.5 text-success" /> Nenhuma anomalia detectada no escopo — o volume atual não indica regressões nem picos.
      </p>
    );
  }
  return (
    <ul className="space-y-1.5 p-2" role="list" aria-label="Anomalias detectadas">
      {anomalies.slice(0, 12).map((a) => (
        <li key={a.id} className="rounded-lg border border-border/50 px-2 py-1.5">
          <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <ShieldAlert className={cn("h-3.5 w-3.5 shrink-0", a.severity === "alta" ? "text-destructive" : a.severity === "média" ? "text-warning" : "text-muted-foreground")} />
            {a.title}
            <span className="ml-auto rounded bg-secondary px-1 py-px text-[9px] uppercase">{a.severity}</span>
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{a.detail}</p>
        </li>
      ))}
    </ul>
  );
}

/** Vault de artefatos do Pipeline. */
function ArtifactsBody() {
  const artifacts = useArtifacts();
  if (artifacts.length === 0) {
    return (
      <p className="p-2 text-[11px] text-muted-foreground">
        Nenhum artefato de conhecimento ainda — rode análises na página{" "}
        <Link to="/pipeline" className="text-primary underline">Pipeline</Link>.
      </p>
    );
  }
  return (
    <ul className="space-y-1.5 p-2" role="list" aria-label="Artefatos do pipeline">
      {artifacts.slice(0, 10).map((a) => (
        <li key={a.id} className="rounded-lg border border-border/50 px-2 py-1.5">
          <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <Vault className="h-3.5 w-3.5 shrink-0 text-primary/70" />
            <span className="truncate">{a.title}</span>
            <span className="ml-auto shrink-0 rounded bg-secondary px-1 py-px text-[9px]">{STAGE_META[a.stage]?.label ?? a.stage}</span>
          </p>
          {a.markdown && (
            <details className="mt-1">
              <summary className="cursor-pointer text-[10px] text-muted-foreground">Ver conteúdo</summary>
              <div className="mt-1 max-h-40 overflow-y-auto text-[11px]">
                <MarkdownRenderer content={a.markdown.slice(0, 3000)} />
              </div>
            </details>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Análise de IA por seção (Experimentos) sobre o escopo. */
function AISectionBody() {
  const scoped = useScopedEntries();
  const ai = useAISettings();
  const sections = useMemo(() => EXPERIMENT_SECTIONS.filter((s) => s.kind === "ai"), []);
  const [section, setSection] = useState(sections[0]?.id ?? "summary");
  const [state, setState] = useState<{ loading: boolean; content: string; error: string }>({ loading: false, content: "", error: "" });
  const abortRef = useRef<AbortController | null>(null);

  const appKeys = useMemo(() => scoped.map((e) => entryKey(e.app.store, e.app.id)), [scoped]);
  const appKeysKey = appKeys.join(",");
  // Reidrata a última saída persistida da seção para este escopo.
  useEffect(() => {
    const rec = getAIOutputFor(section, appKeys);
    setState((prev) => (prev.content || prev.loading ? prev : { loading: false, content: rec?.markdown ?? "", error: "" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, appKeysKey]);

  const run = () => {
    if (scoped.length === 0 || !isAIEnabled(ai)) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setState({ loading: true, content: "", error: "" });
    void streamExperiment(
      section,
      scoped,
      {
        onToken: (full) => setState({ loading: true, content: full, error: "" }),
        onDone: (full) => {
          setState({ loading: false, content: full, error: "" });
          saveAIOutput(section, appKeys, full, "layouts");
        },
        onError: (err) => setState({ loading: false, content: "", error: err }),
      },
      ctrl.signal,
      ai,
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 p-2">
        <select
          value={section}
          onChange={(e) => setSection(e.target.value)}
          aria-label="Seção de análise de IA"
          className="min-w-0 flex-1 rounded-lg border border-border/60 bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          {sections.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        <button
          onClick={run}
          disabled={state.loading || scoped.length === 0 || !isAIEnabled(ai)}
          className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {state.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          {state.loading ? "Gerando…" : state.content ? "Regerar" : "Gerar"}
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {state.error ? (
          <p role="alert" className="flex items-center gap-1.5 text-[11px] text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {state.error}
          </p>
        ) : state.content || state.loading ? (
          <AIOutputCard
            bare
            content={state.content}
            streaming={state.loading}
            filename={`analise-${section}`}
            storageKey={`layout-ai-${section}`}
            onRegenerate={state.loading ? undefined : run}
          />
        ) : (
          <p className="p-1 text-[11px] text-muted-foreground">
            {scoped.length === 0
              ? "Colete apps para gerar análises de IA aqui."
              : !isAIEnabled(ai)
                ? "Ative a IA em Configurações para gerar análises."
                : "Escolha uma seção e gere a análise sobre o escopo."}
          </p>
        )}
      </div>
    </div>
  );
}

/** Executa um agente do sistema (pipeline de etapas) sobre o escopo. */
function AgentsBody() {
  const scoped = useScopedEntries();
  const ai = useAISettings();
  const agents = useMemo(() => listAllAgents(), []);
  const [agentId, setAgentId] = useState(agents[0]?.id ?? "");
  const agent = agents.find((a) => a.id === agentId) ?? agents[0];
  const [steps, setSteps] = useState<{ label: string; status: string; output: string }[]>([]);
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const run = () => {
    if (!agent || scoped.length === 0 || !isAIEnabled(ai)) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setRunning(true);
    setSteps(agent.pipeline.map((s) => ({ label: s.label, status: "idle", output: "" })));
    void runAgent(agent, scoped, {
      onStep: (idx, st) => {
        setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, status: st.status, output: st.output } : s)));
      },
      onDone: () => setRunning(false),
      onError: () => setRunning(false),
    }, { signal: ctrl.signal, ai });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 p-2">
        <select
          value={agent?.id ?? ""}
          onChange={(e) => setAgentId(e.target.value)}
          aria-label="Agente"
          className="min-w-0 flex-1 rounded-lg border border-border/60 bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          {agents.map((a) => (
            <option key={a.id} value={a.id}>{a.label}</option>
          ))}
        </select>
        <button
          onClick={run}
          disabled={running || scoped.length === 0 || !isAIEnabled(ai) || !agent}
          className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5" />}
          {running ? "Executando…" : "Executar"}
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
        {steps.length === 0 ? (
          <p className="p-1 text-[11px] text-muted-foreground">
            {scoped.length === 0
              ? "Colete apps para executar agentes aqui."
              : !isAIEnabled(ai)
                ? "Ative a IA em Configurações para executar agentes."
                : `${agent?.label ?? "Agente"}: ${agent?.pipeline.map((s) => s.label).join(" → ") ?? ""}`}
          </p>
        ) : (
          steps.map((s, i) => (
            <div key={i} className="rounded-lg border border-border/50 px-2 py-1.5">
              <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                {s.status === "running"
                  ? <Loader2 className="h-3 w-3 animate-spin text-primary" />
                  : s.status === "done"
                    ? <CheckCircle2 className="h-3 w-3 text-success" />
                    : <span className="h-3 w-3 rounded-full border border-border" />}
                {s.label}
              </p>
              {s.output && (
                <div className="mt-1">
                  <AIOutputCard bare content={s.output} streaming={s.status === "running"} filename={`agente-${i}`} storageKey={`layout-agent-${agent?.id}-${i}`} />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/** Tarefas do sistema (processos em andamento e recentes). */
function TasksBody() {
  const tasks = listTasks();
  if (tasks.length === 0) {
    return <p className="p-2 text-[11px] text-muted-foreground">Nenhuma tarefa registrada nesta sessão.</p>;
  }
  return (
    <ul className="space-y-1 p-2" role="list" aria-label="Tarefas do sistema">
      {tasks.slice(0, 20).map((t) => (
        <li key={t.id} className="flex items-center gap-2 rounded-lg border border-border/60 px-2 py-1 text-xs">
          {t.status === "running"
            ? <Loader2 className="h-3 w-3 animate-spin text-primary" />
            : t.status === "error"
              ? <AlertCircle className="h-3 w-3 text-destructive" />
              : <CheckCircle2 className="h-3 w-3 text-success" />}
          <span className="min-w-0 flex-1 truncate text-foreground">{t.label}</span>
          <span className="text-[10px] text-muted-foreground">{t.status}</span>
        </li>
      ))}
    </ul>
  );
}

/** Decks de apresentação salvos. */
function DecksBody() {
  const decks = listDecks();
  if (decks.length === 0) {
    return (
      <p className="p-2 text-[11px] text-muted-foreground">
        Nenhum deck salvo — crie em{" "}
        <Link to="/apresentacoes" className="text-primary underline">Apresentações</Link>.
      </p>
    );
  }
  return (
    <ul className="space-y-1.5 p-2" role="list" aria-label="Apresentações salvas">
      {decks.slice(0, 10).map((d) => (
        <li key={d.id}>
          <Link
            to="/apresentacoes"
            className="flex items-center gap-2 rounded-lg border border-border/60 px-2 py-1.5 hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <Presentation className="h-3.5 w-3.5 shrink-0 text-primary/70" />
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{d.title}</span>
            <span className="text-[10px] text-muted-foreground">{d.slides.length} slides</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Nota livre (markdown) editável — persistida por bloco. */
function NoteBody({ noteId }: { noteId: string }) {
  const key = `aso:layout-note:${noteId}`;
  const [text, setText] = useState(() => {
    try { return localStorage.getItem(key) ?? ""; } catch { return ""; }
  });
  const [editing, setEditing] = useState(false);
  const save = (v: string) => {
    setText(v);
    try { localStorage.setItem(key, v); } catch { /* quota */ }
  };
  if (editing || !text) {
    return (
      <textarea
        value={text}
        onChange={(e) => save(e.target.value)}
        onBlur={() => text.trim() && setEditing(false)}
        onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
        autoFocus={editing}
        placeholder="Escreva uma nota em markdown… (clique fora para renderizar)"
        aria-label="Nota em markdown"
        className="h-full min-h-[80px] w-full resize-none rounded-md border border-border/50 bg-background p-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
    );
  }
  return (
    <button onClick={() => setEditing(true)} className="block h-full w-full cursor-text p-2 text-left" title="Clique para editar a nota">
      <MarkdownRenderer content={text} />
    </button>
  );
}

/** Busca semântica nos reviews do escopo (embeddings locais). */
function SemanticSearchBody() {
  const scoped = useScopedEntries();
  const reviews = useMemo(() => scoped.flatMap((e) => e.reviews), [scoped]);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<{ loading: boolean; hits: { index: number; score: number }[]; error: string }>({ loading: false, hits: [], error: "" });
  const abortRef = useRef<AbortController | null>(null);

  const run = async () => {
    const q = query.trim();
    if (!q || reviews.length === 0) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setState({ loading: true, hits: [], error: "" });
    const res = await semanticSearchReviews(q, reviews.slice(0, 500), 20, ctrl.signal);
    setState(res.ok
      ? { loading: false, hits: res.hits, error: "" }
      : { loading: false, hits: [], error: res.error ?? "Busca semântica indisponível (instale um modelo de embeddings, ex.: nomic-embed-text)." });
  };

  return (
    <div className="flex h-full flex-col">
      <form
        onSubmit={(e) => { e.preventDefault(); void run(); }}
        role="search"
        className="flex shrink-0 gap-1.5 p-2"
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por significado nos reviews…"
          aria-label="Busca semântica nos reviews"
          className="min-w-0 flex-1 rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          type="submit"
          disabled={state.loading || !query.trim() || reviews.length === 0}
          aria-label="Buscar"
          className="inline-flex items-center rounded-lg bg-primary px-2.5 py-1.5 text-xs text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {state.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
        </button>
      </form>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {state.error ? (
          <p role="alert" className="flex items-start gap-1.5 text-[11px] text-destructive">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {state.error}
          </p>
        ) : state.hits.length > 0 ? (
          <ul className="space-y-1.5" role="list">
            {state.hits.map((h) => {
              const r = reviews[h.index];
              if (!r) return null;
              return (
                <li key={h.index} className="rounded-lg border border-border/50 px-2 py-1.5">
                  <p className="text-[10px] text-muted-foreground">
                    <span className="text-warning">{"★".repeat(r.rating)}</span> · relevância {(h.score * 100).toFixed(0)}%
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-foreground">{r.text}</p>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            {reviews.length === 0 ? "Colete apps para buscar nos reviews." : "Os reviews mais relevantes aparecem aqui."}
          </p>
        )}
      </div>
    </div>
  );
}

function HeaderBody() {
  const scoped = useScopedEntries();
  const reviews = useMemo(() => scoped.reduce((s, e) => s + e.reviews.length, 0), [scoped]);
  return (
    <div className="flex h-full flex-wrap items-center gap-2 px-3">
      <LayoutTemplate className="h-4 w-4 text-primary" />
      <p className="text-sm font-semibold text-foreground">Tela customizada</p>
      <span className="text-[11px] text-muted-foreground">{scoped.length} app(s) · {reviews} reviews no escopo</span>
      <span className="flex-1" />
      <Link to="/search" className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-2 py-1 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/60">
        <Search className="h-3 w-3" /> Buscar
      </Link>
      <Link to="/dashboard" className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-2 py-1 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/60">
        Dashboard
      </Link>
    </div>
  );
}

function StatusBody() {
  const scoped = useScopedEntries();
  const reviews = useMemo(() => scoped.reduce((s, e) => s + e.reviews.length, 0), [scoped]);
  const ai = useAISettings();
  const tasks = useActiveTaskCount();
  const running = listTasks().filter((t) => t.status === "running").length;
  return (
    <div className="flex h-full flex-wrap items-center gap-x-4 gap-y-1 px-3 text-[11px]">
      <span className="inline-flex items-center gap-1 text-muted-foreground"><Layers className="h-3 w-3" /> {scoped.length} app(s)</span>
      <span className="inline-flex items-center gap-1 text-muted-foreground"><Star className="h-3 w-3" /> {reviews} reviews</span>
      <span className="inline-flex items-center gap-1 text-muted-foreground"><Cpu className="h-3 w-3" /> IA: {isAIEnabled(ai) ? aiProvenance(ai) : "desativada"}</span>
      <span className={cn("inline-flex items-center gap-1", tasks > 0 ? "text-primary" : "text-muted-foreground")}>
        {tasks > 0 ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
        {tasks > 0 ? `${running || tasks} tarefa(s) em andamento` : "Sistema ocioso"}
      </span>
    </div>
  );
}

function InsightsBody() {
  const generations = useGenerations();
  const withMd = generations.filter((g) => g.markdown);
  if (withMd.length === 0) {
    return <p className="p-2 text-[11px] text-muted-foreground">Nenhuma geração de IA registrada ainda — gere análises em Experimentos/Dashboard.</p>;
  }
  return (
    <div className="space-y-1 p-2">
      {withMd.slice(0, 8).map((g) => (
        <details key={g.id} className="rounded-lg border border-border/60 px-2 py-1.5">
          <summary className="cursor-pointer text-xs font-medium text-foreground">{g.title}</summary>
          <div className="mt-1 max-h-48 overflow-y-auto text-xs">
            <MarkdownRenderer content={(g.markdown ?? "").slice(0, 4000)} />
          </div>
        </details>
      ))}
    </div>
  );
}

function ActivityBody() {
  const tasks = listTasks();
  if (tasks.length === 0) {
    return <p className="p-2 text-[11px] text-muted-foreground">Nenhuma atividade registrada nesta sessão.</p>;
  }
  return (
    <ul className="space-y-1 p-2" role="log" aria-label="Atividade do sistema">
      {tasks.slice(0, 20).map((t) => (
        <li key={t.id} className="flex items-center gap-2 rounded-lg border border-border/60 px-2 py-1 text-xs">
          {t.status === "running"
            ? <Loader2 className="h-3 w-3 animate-spin text-primary" />
            : t.status === "error"
              ? <AlertCircle className="h-3 w-3 text-destructive" />
              : <CheckCircle2 className="h-3 w-3 text-success" />}
          <span className="min-w-0 flex-1 truncate text-foreground">{t.label}</span>
          <span className="text-[10px] text-muted-foreground">{t.status}</span>
        </li>
      ))}
    </ul>
  );
}

/** Placeholder estrutural (bloco sem componente vinculado). */
export function BlockPlaceholder() {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-md border border-dashed border-primary/40 bg-primary/[0.04]">
      <div className="pointer-events-none px-2 text-center">
        <LayoutTemplate className="mx-auto mb-1 h-4 w-4 text-primary/70" />
        <p className="text-[11px] font-medium leading-tight text-primary/80">Componente expansível</p>
        <p className="text-[10px] leading-tight text-muted-foreground">vazio — escolha um componente no modo Editar</p>
      </div>
    </div>
  );
}

/** Mede a própria largura e expõe `DenseContext` (componentes se ajustam ao
 *  tamanho do bloco, não do viewport). */
export function LayoutComponentBody({ component, blockId }: { component?: string; blockId?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [dense, setDense] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setDense(w > 0 && w < 460);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const catFile = publicComponentFile(component);
  const meta = catFile ? null : layoutComponentMeta(component);
  let body: React.ReactNode;
  if (catFile) {
    body = (
      <div className="p-2">
        <ComponentLiveRender file={catFile} />
      </div>
    );
  } else if (!meta) {
    body = <BlockPlaceholder />;
  } else {
    switch (meta.id) {
      // Busca & coleta (separados — campo / resultados / seleção / config)
      case "search-field": body = <div className="p-2"><SearchFieldPanel /></div>; break;
      case "search-results": body = <div className="h-full overflow-y-auto p-2"><SearchResultsPanel /></div>; break;
      case "app-selection": body = <div className="p-2"><AppSelectionPanel /></div>; break;
      case "search-collect": body = <div className="p-1"><QuickCollect /></div>; break;
      case "apps-history": body = <AppsHistory />; break;
      case "collected-list": body = <div className="p-1"><CollectedListPanel /></div>; break;
      case "top-charts": body = <div className="p-1"><TopCharts /></div>; break;
      // Dados
      case "dataset": body = <DatasetBody />; break;
      case "kpis": body = <KpisBody />; break;
      case "charts": body = <ChartsBody />; break;
      case "reviews-feed": body = <ReviewsFeedBody />; break;
      case "wordcloud": body = <WordCloudBody />; break;
      case "timeline": body = <TimelineBody />; break;
      case "store-compare": body = <StoreCompareBody />; break;
      case "per-app": body = <PerAppBody />; break;
      case "anomalies": body = <AnomaliesBody />; break;
      case "artifacts": body = <ArtifactsBody />; break;
      // IA
      case "ai-chat": body = <MiniAIChat />; break;
      case "ai-section": body = <AISectionBody />; break;
      case "agents": body = <AgentsBody />; break;
      case "insights": body = <InsightsBody />; break;
      case "search-lab": body = <SemanticSearchBody />; break;
      // Sistema
      case "activity": body = <ActivityBody />; break;
      case "tasks": body = <TasksBody />; break;
      case "data-quality": body = <div className="p-1"><DataQualityPanel /></div>; break;
      case "collection-config": body = <div className="p-1"><CollectionConfigPanel /></div>; break;
      case "generations": body = <div className="p-1"><SessionsPanel embedded /></div>; break;
      case "decks": body = <DecksBody />; break;
      case "header": body = <HeaderBody />; break;
      case "status": body = <StatusBody />; break;
      // Conteúdo
      case "note": body = <NoteBody noteId={blockId ?? meta.id} />; break;
      default: body = <BlockPlaceholder />;
    }
  }

  return (
    <div ref={ref} className="h-full min-h-0">
      <DenseContext.Provider value={dense}>{body}</DenseContext.Provider>
    </div>
  );
}

/** Mensagem de IA desativada — delega ao aviso compartilhado padronizado. */
export function AIDisabledHint() {
  return <AIDisabledNotice compact />;
}
