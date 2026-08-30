/**
 * Painéis de coleta por fonte da Uni (/00). Cada fonte tem seus próprios
 * parâmetros; todas emitem UniItem[] via onResult.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  fetchSuggestMulti, fetchTrendsMulti, fetchSerp, fetchYoutubeVideos, fetchRedditPosts,
  fetchWikipediaSearch, fetchHnStories, fetchGdeltNews, fetchArxivPapers, fetchSeQuestions, fetchGithubRepos, fetchGithubIssues, fetchS2Papers, fetchSteamGames, fetchSteamReviews, fetchReclameAquiCompanies, fetchReclameAquiComplaints, fetchReclameAquiTerm, fetchWebPage, fetchPdfText, fetchFeedItems, fetchProductHuntPosts, pasteTextItems, fetchConnector, fetchCustomSource, type ConnectorSourceId, type SuggestVertical, type TrendsData, type TrendsComboResult, type GdeltSort, type ArxivSort, type SeSite, type SeSort, type GhRepoSort, type GhIssueState, type S2Sort, type SteamLang, type RaCompanyLite,
} from "@/lib/uni/uniApi";
import { COLLECT_MODES, cartesianCap, modeExpand, modeLimit, toggleInList, type CollectMode } from "@/lib/uni/collectModes";
import type { UniItem, UniSourceId } from "@/lib/uni/types";
import { Loader2, Search, Layers, Gauge } from "lucide-react";

export interface UniRunOutcome {
  items: UniItem[];
  params: Record<string, unknown>;
  /** Dados estruturados extras (ex.: timeline do Trends) para visualização. */
  trends?: TrendsData;
  /** Múltiplas combinações período × vertical (modo multi do Trends). */
  trendsList?: TrendsComboResult[];
}

interface PanelProps {
  query: string;
  onQueryChange: (q: string) => void;
  onResult: (outcome: UniRunOutcome) => void;
  onError: (message: string) => void;
}

const VERTICALS: { id: SuggestVertical; label: string }[] = [
  { id: "web", label: "Web" },
  { id: "youtube", label: "YouTube" },
  { id: "news", label: "News" },
  { id: "shopping", label: "Shopping" },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      {children}
    </label>
  );
}

function RunButton({ loading, disabled, onClick, label = "Coletar" }: { loading: boolean; disabled?: boolean; onClick: () => void; label?: string }) {
  return (
    <Button onClick={onClick} disabled={disabled || loading} className="self-end">
      {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Search className="mr-1.5 h-4 w-4" />}
      {label}
    </Button>
  );
}

// ---------- Modo de coleta (compartilhado entre painéis) ----------

export interface CollectModeState {
  mode: CollectMode;
  customLimit: number;
  /** Limite efetivo por recurso (já com clamp do custom). */
  limit: number;
  /** Expansão profunda ligada (max = sempre; custom = toggle do usuário). */
  expand: boolean;
  setMode: (m: CollectMode) => void;
  setCustomLimit: (n: number) => void;
  setExpand: (b: boolean) => void;
}

export function useCollectMode(): CollectModeState {
  const [mode, setMode] = useState<CollectMode>("normal");
  const [customLimit, setCustomLimit] = useState(25);
  const [customExpand, setCustomExpand] = useState(false);
  return {
    mode,
    customLimit,
    limit: modeLimit(mode, customLimit),
    expand: mode === "custom" ? customExpand : modeExpand(mode),
    setMode,
    setCustomLimit,
    setExpand: setCustomExpand,
  };
}

/** Seletor de modo de coleta (rápida/normal/max/custom) — reutilizável. */
export function CollectModeBar({ state }: { state: CollectModeState }) {
  return (
    <Field label="Modo de coleta">
      <div className="flex items-center gap-1">
        <div className="flex rounded-lg border" role="group" aria-label="Modo de coleta">
          {COLLECT_MODES.map((m) => (
            <button
              key={m.id}
              aria-pressed={state.mode === m.id}
              title={m.description}
              onClick={() => state.setMode(m.id)}
              className={cn("px-3 py-2 text-xs", state.mode === m.id ? "bg-primary/10 text-primary" : "hover:bg-muted")}
            >
              {m.id === "custom" && <Gauge className="mr-1 inline h-3 w-3" />}
              {m.label}
            </button>
          ))}
        </div>
        {state.mode === "custom" && (
          <>
            <Input
              type="number"
              min={1}
              max={500}
              value={state.customLimit}
              onChange={(e) => state.setCustomLimit(Number(e.target.value))}
              aria-label="Limite customizado por recurso"
              className="h-8 w-20"
            />
            <Button
              variant={state.expand ? "default" : "outline"}
              size="sm"
              aria-pressed={state.expand}
              onClick={() => state.setExpand(!state.expand)}
            >
              <Layers className="mr-1.5 h-4 w-4" /> Expandir
            </Button>
          </>
        )}
      </div>
    </Field>
  );
}

// ---------- Suggest ----------
export function SuggestPanel(props: PanelProps) {
  const [verticals, setVerticals] = useState<SuggestVertical[]>(["web"]);
  const modeState = useCollectMode();
  const [loading, setLoading] = useState(false);

  const run = async () => {
    const q = props.query.trim();
    if (!q || loading || !verticals.length) return;
    setLoading(true);
    try {
      const res = await fetchSuggestMulti(q, verticals, {
        expand: modeState.expand,
        limit: modeState.limit,
      });
      if (!res.ok) throw new Error(res.error);
      props.onResult({
        items: res.items,
        params: { verticals, expand: modeState.expand, mode: modeState.mode, limit: modeState.limit },
      });
    } catch (e) {
      props.onError(e instanceof Error ? e.message : "Falha na coleta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label="Termo">
        <Input value={props.query} onChange={(e) => props.onQueryChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()} placeholder="ex.: banco digital" className="w-64" />
      </Field>
      <Field label={`Verticais (${verticals.length} selecionada${verticals.length === 1 ? "" : "s"})`}>
        <div className="flex rounded-lg border" role="group" aria-label="Verticais (multi-seleção)">
          {VERTICALS.map((v) => (
            <button key={v.id} aria-pressed={verticals.includes(v.id)} onClick={() => setVerticals(toggleInList(verticals, v.id))}
              className={cn("px-3 py-2 text-xs", verticals.includes(v.id) ? "bg-primary/10 text-primary" : "hover:bg-muted")}>
              {v.label}
            </button>
          ))}
        </div>
      </Field>
      <CollectModeBar state={modeState} />
      <RunButton loading={loading} disabled={!props.query.trim() || !verticals.length} onClick={run}
        label={verticals.length > 1 ? `Coletar (${verticals.length} verticais)` : "Coletar"} />
    </div>
  );
}

// ---------- Trends ----------
const TIMEFRAMES = [
  { id: "now 7-d", label: "7 dias" },
  { id: "today 1-m", label: "30 dias" },
  { id: "today 3-m", label: "90 dias" },
  { id: "today 12-m", label: "12 meses" },
  { id: "today 5-y", label: "5 anos" },
  { id: "all", label: "Desde 2004" },
];

const TRENDS_GPROPS = [
  { id: "", label: "Web" },
  { id: "images", label: "Imagens" },
  { id: "news", label: "News" },
  { id: "youtube", label: "YouTube" },
  { id: "froogle", label: "Shopping" },
];

/** Teto de combinações período × vertical por execução (rate-limit do Trends). */
const TRENDS_MAX_COMBOS = 12;

export function TrendsPanel(props: PanelProps) {
  const [timeframes, setTimeframes] = useState<string[]>(["today 3-m"]);
  const [gprops, setGprops] = useState<string[]>([""]);
  const modeState = useCollectMode();
  const [loading, setLoading] = useState(false);

  const combos = cartesianCap(timeframes, gprops, TRENDS_MAX_COMBOS).map(([timeframe, gprop]) => ({ timeframe, gprop }));

  const run = async () => {
    const terms = props.query.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 5);
    if (!terms.length || loading || !combos.length) return;
    setLoading(true);
    try {
      const res = await fetchTrendsMulti(terms, combos, { topn: modeState.limit });
      if (!res.ok) throw new Error(res.error);
      const first = res.trendsList?.find((t) => t.data)?.data;
      const errs = first?.errors ?? [];
      if (errs.length && !res.items.length && !first?.timeline.length) {
        props.onError(`Google Trends não respondeu: ${errs[0]}`);
      }
      props.onResult({
        items: res.items,
        params: { terms, combos: combos.map((c) => `${c.timeframe}${c.gprop ? `+${c.gprop}` : ""}`), mode: modeState.mode },
        trends: first,
        trendsList: res.trendsList,
      });
    } catch (e) {
      props.onError(e instanceof Error ? e.message : "Falha na coleta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label="Termos (até 5, separados por vírgula)">
        <Input value={props.query} onChange={(e) => props.onQueryChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()} placeholder="ex.: nubank, inter, c6 bank" className="w-72" />
      </Field>
      <Field label={`Períodos (${timeframes.length})`}>
        <div className="flex rounded-lg border" role="group" aria-label="Períodos (multi-seleção)">
          {TIMEFRAMES.map((t) => (
            <button key={t.id} aria-pressed={timeframes.includes(t.id)} onClick={() => setTimeframes(toggleInList(timeframes, t.id))}
              className={cn("px-3 py-2 text-xs", timeframes.includes(t.id) ? "bg-primary/10 text-primary" : "hover:bg-muted")}>
              {t.label}
            </button>
          ))}
        </div>
      </Field>
      <Field label={`Verticais (${gprops.length})`}>
        <div className="flex rounded-lg border" role="group" aria-label="Verticais do Trends (multi-seleção)">
          {TRENDS_GPROPS.map((v) => (
            <button key={v.id} aria-pressed={gprops.includes(v.id)} onClick={() => setGprops(toggleInList(gprops, v.id))}
              className={cn("px-3 py-2 text-xs", gprops.includes(v.id) ? "bg-primary/10 text-primary" : "hover:bg-muted")}>
              {v.label}
            </button>
          ))}
        </div>
      </Field>
      <CollectModeBar state={modeState} />
      <RunButton loading={loading} disabled={!props.query.trim() || !combos.length} onClick={run}
        label={combos.length > 1 ? `Coletar (${combos.length} combos)` : "Coletar"} />
    </div>
  );
}

// ---------- SERP ----------
const SERP_ENGINES = [
  { id: "bing", label: "Bing" },
  { id: "duckduckgo", label: "DuckDuckGo" },
  { id: "brave", label: "Brave (key)" },
  { id: "google", label: "Google CSE (key)" },
];

export function SerpPanel(props: PanelProps) {
  const [engines, setEngines] = useState<string[]>(["bing", "duckduckgo"]);
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(false);

  const toggle = (id: string) =>
    setEngines((prev) => (prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]));

  const run = async () => {
    const q = props.query.trim();
    if (!q || loading || !engines.length) return;
    setLoading(true);
    try {
      const res = await fetchSerp(q, { limit, engines });
      if (!res.ok) throw new Error(res.error);
      if (!res.items.length) props.onError("Nenhum resultado — verifique os engines (DDG pode bloquear datacenters).");
      props.onResult({ items: res.items, params: { engines, limit } });
    } catch (e) {
      props.onError(e instanceof Error ? e.message : "Falha na coleta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label="Termo de busca">
        <Input value={props.query} onChange={(e) => props.onQueryChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()} placeholder="ex.: melhor banco digital 2026" className="w-72" />
      </Field>
      <Field label="Engines">
        <div className="flex rounded-lg border" role="group" aria-label="Engines">
          {SERP_ENGINES.map((e) => (
            <button key={e.id} aria-pressed={engines.includes(e.id)} onClick={() => toggle(e.id)}
              className={cn("px-3 py-2 text-xs", engines.includes(e.id) ? "bg-primary/10 text-primary" : "hover:bg-muted")}>
              {e.label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Resultados/engine">
        <Input type="number" min={1} max={50} value={limit} onChange={(e) => setLimit(Number(e.target.value) || 10)} className="w-20" />
      </Field>
      <RunButton loading={loading} disabled={!props.query.trim() || !engines.length} onClick={run} />
    </div>
  );
}

// ---------- YouTube ----------
const YT_ORDERS = [
  { id: "relevance", label: "Relevância" },
  { id: "date", label: "Recentes" },
  { id: "views", label: "Mais vistos" },
  { id: "rating", label: "Melhor avaliados" },
];

export function YoutubePanel(props: PanelProps) {
  const [order, setOrder] = useState("relevance");
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    const q = props.query.trim();
    if (!q || loading) return;
    setLoading(true);
    try {
      const res = await fetchYoutubeVideos(q, { order, limit });
      if (!res.ok) throw new Error(res.error);
      if (!res.items.length) props.onError("Nenhum vídeo encontrado.");
      props.onResult({ items: res.items, params: { order, limit } });
    } catch (e) {
      props.onError(e instanceof Error ? e.message : "Falha na coleta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label="Termo de busca">
        <Input value={props.query} onChange={(e) => props.onQueryChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()} placeholder="ex.: nubank review" className="w-72" />
      </Field>
      <Field label="Ordenar por">
        <div className="flex rounded-lg border" role="group" aria-label="Ordenação">
          {YT_ORDERS.map((o) => (
            <button key={o.id} aria-pressed={order === o.id} onClick={() => setOrder(o.id)}
              className={cn("px-3 py-2 text-xs", order === o.id ? "bg-primary/10 text-primary" : "hover:bg-muted")}>
              {o.label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Vídeos">
        <Input type="number" min={1} max={50} value={limit} onChange={(e) => setLimit(Number(e.target.value) || 10)} className="w-20" />
      </Field>
      <RunButton loading={loading} disabled={!props.query.trim()} onClick={run} />
    </div>
  );
}

// ---------- Reddit ----------
const REDDIT_SORTS = [
  { id: "top", label: "Top" },
  { id: "hot", label: "Hot" },
  { id: "new", label: "Novos" },
  { id: "relevance", label: "Relevância" },
];

export function RedditPanel(props: PanelProps) {
  const [subreddit, setSubreddit] = useState("");
  const [sort, setSort] = useState("top");
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    const q = props.query.trim();
    if (!q || loading) return;
    setLoading(true);
    try {
      const res = await fetchRedditPosts(q, { subreddit: subreddit || "all", sort, limit });
      if (!res.ok) throw new Error(res.error);
      if (!res.items.length) props.onError("Nenhum post encontrado.");
      props.onResult({ items: res.items, params: { subreddit: subreddit || "all", sort, limit } });
    } catch (e) {
      props.onError(e instanceof Error ? e.message : "Falha na coleta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label="Termo de busca">
        <Input value={props.query} onChange={(e) => props.onQueryChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()} placeholder="ex.: nubank" className="w-64" />
      </Field>
      <Field label="Subreddit (vazio = todos)">
        <Input value={subreddit} onChange={(e) => setSubreddit(e.target.value)} placeholder="ex.: brasil" className="w-36" />
      </Field>
      <Field label="Ordenar por">
        <div className="flex rounded-lg border" role="group" aria-label="Ordenação">
          {REDDIT_SORTS.map((s) => (
            <button key={s.id} aria-pressed={sort === s.id} onClick={() => setSort(s.id)}
              className={cn("px-3 py-2 text-xs", sort === s.id ? "bg-primary/10 text-primary" : "hover:bg-muted")}>
              {s.label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Posts">
        <Input type="number" min={1} max={100} value={limit} onChange={(e) => setLimit(Number(e.target.value) || 10)} className="w-20" />
      </Field>
      <RunButton loading={loading} disabled={!props.query.trim()} onClick={run} />
    </div>
  );
}

// ---------- Wikipedia ----------
const WIKI_LANGS = [
  { id: "pt", label: "PT" },
  { id: "en", label: "EN" },
  { id: "es", label: "ES" },
];

export function WikipediaPanel(props: PanelProps) {
  const [lang, setLang] = useState("pt");
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    const q = props.query.trim();
    if (!q || loading) return;
    setLoading(true);
    try {
      const res = await fetchWikipediaSearch(q, lang, limit);
      if (!res.ok) throw new Error(res.error);
      if (!res.items.length) props.onError("Nenhum artigo encontrado na Wikipédia.");
      props.onResult({ items: res.items, params: { lang, limit } });
    } catch (e) {
      props.onError(e instanceof Error ? e.message : "Falha na coleta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label="Termo de busca">
        <Input value={props.query} onChange={(e) => props.onQueryChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()} placeholder="ex.: banco digital" className="w-72" />
      </Field>
      <Field label="Idioma">
        <div className="flex rounded-lg border" role="group" aria-label="Idioma">
          {WIKI_LANGS.map((l) => (
            <button key={l.id} aria-pressed={lang === l.id} onClick={() => setLang(l.id)}
              className={cn("px-3 py-2 text-xs", lang === l.id ? "bg-primary/10 text-primary" : "hover:bg-muted")}>
              {l.label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Artigos">
        <Input type="number" min={1} max={50} value={limit} onChange={(e) => setLimit(Number(e.target.value) || 10)} className="w-20" />
      </Field>
      <RunButton loading={loading} disabled={!props.query.trim()} onClick={run} />
    </div>
  );
}

// ---------- Hacker News ----------
const HN_SORTS = [
  { id: "relevance", label: "Relevância" },
  { id: "date", label: "Recentes" },
];

export function HackerNewsPanel(props: PanelProps) {
  const [sort, setSort] = useState<"relevance" | "date">("relevance");
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    const q = props.query.trim();
    if (!q || loading) return;
    setLoading(true);
    try {
      const res = await fetchHnStories(q, sort, limit);
      if (!res.ok) throw new Error(res.error);
      if (!res.items.length) props.onError("Nenhuma story encontrada no Hacker News.");
      props.onResult({ items: res.items, params: { sort, limit } });
    } catch (e) {
      props.onError(e instanceof Error ? e.message : "Falha na coleta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label="Termo de busca">
        <Input value={props.query} onChange={(e) => props.onQueryChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()} placeholder="ex.: nubank, fintech" className="w-72" />
      </Field>
      <Field label="Ordenar por">
        <div className="flex rounded-lg border" role="group" aria-label="Ordenação">
          {HN_SORTS.map((o) => (
            <button key={o.id} aria-pressed={sort === o.id} onClick={() => setSort(o.id as "relevance" | "date")}
              className={cn("px-3 py-2 text-xs", sort === o.id ? "bg-primary/10 text-primary" : "hover:bg-muted")}>
              {o.label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Stories">
        <Input type="number" min={1} max={100} value={limit} onChange={(e) => setLimit(Number(e.target.value) || 20)} className="w-20" />
      </Field>
      <RunButton loading={loading} disabled={!props.query.trim()} onClick={run} />
    </div>
  );
}

// ---------- GDELT (notícias) ----------
const GDELT_LANGS = [
  { id: "auto", label: "Todos" },
  { id: "pt", label: "PT" },
  { id: "en", label: "EN" },
  { id: "es", label: "ES" },
];
const GDELT_SORTS = [
  { id: "date", label: "Recentes" },
  { id: "relevance", label: "Relevância" },
];

export function GdeltPanel(props: PanelProps) {
  const [lang, setLang] = useState("auto");
  const [sort, setSort] = useState<GdeltSort>("date");
  const [limit, setLimit] = useState(25);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);

  const run = async () => {
    const q = props.query.trim();
    if (!q || loading) return;
    setLoading(true);
    try {
      const res = await fetchGdeltNews(q, { sort, lang, limit, startDate: startDate || undefined, endDate: endDate || undefined });
      if (!res.ok) throw new Error(res.error);
      if (!res.items.length) props.onError("Nenhuma notícia encontrada no GDELT.");
      props.onResult({ items: res.items, params: { lang, sort, limit, startDate, endDate } });
    } catch (e) {
      props.onError(e instanceof Error ? e.message : "Falha na coleta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label="Termo de busca">
        <Input value={props.query} onChange={(e) => props.onQueryChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()} placeholder="ex.: nubank, pix, fintech" className="w-64" />
      </Field>
      <Field label="Idioma">
        <div className="flex rounded-lg border" role="group" aria-label="Idioma">
          {GDELT_LANGS.map((l) => (
            <button key={l.id} aria-pressed={lang === l.id} onClick={() => setLang(l.id)}
              className={cn("px-2.5 py-2 text-xs", lang === l.id ? "bg-primary/10 text-primary" : "hover:bg-muted")}>
              {l.label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Ordenar por">
        <div className="flex rounded-lg border" role="group" aria-label="Ordenação">
          {GDELT_SORTS.map((o) => (
            <button key={o.id} aria-pressed={sort === o.id} onClick={() => setSort(o.id as GdeltSort)}
              className={cn("px-3 py-2 text-xs", sort === o.id ? "bg-primary/10 text-primary" : "hover:bg-muted")}>
              {o.label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Notícias">
        <Input type="number" min={1} max={250} value={limit} onChange={(e) => setLimit(Number(e.target.value) || 25)} className="w-20" />
      </Field>
      <Field label="De (AAAAMMDD, opcional)">
        <Input value={startDate} onChange={(e) => setStartDate(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="20240101" className="w-28" />
      </Field>
      <Field label="Até (AAAAMMDD, opcional)">
        <Input value={endDate} onChange={(e) => setEndDate(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="20241231" className="w-28" />
      </Field>
      <RunButton loading={loading} disabled={!props.query.trim()} onClick={run} />
    </div>
  );
}

// ---------- arXiv ----------
const ARXIV_SORTS = [
  { id: "relevance", label: "Relevância" },
  { id: "submittedDate", label: "Recentes" },
  { id: "lastUpdatedDate", label: "Atualizados" },
];

export function ArxivPanel(props: PanelProps) {
  const [sort, setSort] = useState<ArxivSort>("relevance");
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    const q = props.query.trim();
    if (!q || loading) return;
    setLoading(true);
    try {
      const res = await fetchArxivPapers(q, sort, limit);
      if (!res.ok) throw new Error(res.error);
      if (!res.items.length) props.onError("Nenhum artigo encontrado no arXiv.");
      props.onResult({ items: res.items, params: { sort, limit } });
    } catch (e) {
      props.onError(e instanceof Error ? e.message : "Falha na coleta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label="Termo de busca">
        <Input value={props.query} onChange={(e) => props.onQueryChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()} placeholder="ex.: mobile app reviews, LLM sentiment" className="w-72" />
      </Field>
      <Field label="Ordenar por">
        <div className="flex rounded-lg border" role="group" aria-label="Ordenação">
          {ARXIV_SORTS.map((o) => (
            <button key={o.id} aria-pressed={sort === o.id} onClick={() => setSort(o.id as ArxivSort)}
              className={cn("px-3 py-2 text-xs", sort === o.id ? "bg-primary/10 text-primary" : "hover:bg-muted")}>
              {o.label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Artigos">
        <Input type="number" min={1} max={100} value={limit} onChange={(e) => setLimit(Number(e.target.value) || 20)} className="w-20" />
      </Field>
      <RunButton loading={loading} disabled={!props.query.trim()} onClick={run} />
    </div>
  );
}

// ---------- StackExchange ----------
const SE_SITES_UI = [
  { id: "stackoverflow", label: "SO (EN)" },
  { id: "pt.stackoverflow", label: "SO (PT)" },
  { id: "android", label: "Android" },
  { id: "apple", label: "Apple" },
  { id: "webapps", label: "Web Apps" },
];
const SE_SORTS_UI = [
  { id: "relevance", label: "Relevância" },
  { id: "votes", label: "Votos" },
  { id: "creation", label: "Recentes" },
  { id: "activity", label: "Atividade" },
];

export function StackExchangePanel(props: PanelProps) {
  const [site, setSite] = useState<SeSite>("stackoverflow");
  const [sort, setSort] = useState<SeSort>("relevance");
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    const q = props.query.trim();
    if (!q || loading) return;
    setLoading(true);
    try {
      const res = await fetchSeQuestions(q, site, sort, limit);
      if (!res.ok) throw new Error(res.error);
      if (!res.items.length) props.onError("Nenhuma pergunta encontrada no StackExchange.");
      props.onResult({ items: res.items, params: { site, sort, limit } });
    } catch (e) {
      props.onError(e instanceof Error ? e.message : "Falha na coleta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label="Termo de busca">
        <Input value={props.query} onChange={(e) => props.onQueryChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()} placeholder="ex.: android webview, react native" className="w-64" />
      </Field>
      <Field label="Site">
        <div className="flex flex-wrap rounded-lg border" role="group" aria-label="Site da rede">
          {SE_SITES_UI.map((s) => (
            <button key={s.id} aria-pressed={site === s.id} onClick={() => setSite(s.id as SeSite)}
              className={cn("px-2.5 py-2 text-xs", site === s.id ? "bg-primary/10 text-primary" : "hover:bg-muted")}>
              {s.label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Ordenar por">
        <div className="flex rounded-lg border" role="group" aria-label="Ordenação">
          {SE_SORTS_UI.map((o) => (
            <button key={o.id} aria-pressed={sort === o.id} onClick={() => setSort(o.id as SeSort)}
              className={cn("px-2.5 py-2 text-xs", sort === o.id ? "bg-primary/10 text-primary" : "hover:bg-muted")}>
              {o.label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Perguntas">
        <Input type="number" min={1} max={100} value={limit} onChange={(e) => setLimit(Number(e.target.value) || 20)} className="w-20" />
      </Field>
      <RunButton loading={loading} disabled={!props.query.trim()} onClick={run} />
    </div>
  );
}

// ---------- GitHub ----------
const GH_MODES = [
  { id: "repos", label: "Repositórios" },
  { id: "issues", label: "Issues" },
];
const GH_SORTS = [
  { id: "stars", label: "Estrelas" },
  { id: "updated", label: "Atualizados" },
  { id: "forks", label: "Forks" },
];
const GH_STATES = [
  { id: "open", label: "Abertas" },
  { id: "closed", label: "Fechadas" },
  { id: "all", label: "Todas" },
];

export function GithubPanel(props: PanelProps) {
  const [mode, setMode] = useState<"repos" | "issues">("repos");
  const [sort, setSort] = useState<GhRepoSort>("stars");
  const [state, setState] = useState<GhIssueState>("open");
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    const q = props.query.trim();
    if (!q || loading) return;
    setLoading(true);
    try {
      const res = mode === "repos"
        ? await fetchGithubRepos(q, sort, limit)
        : await fetchGithubIssues(q, state, limit);
      if (!res.ok) throw new Error(res.error);
      if (!res.items.length) props.onError(mode === "repos" ? "Nenhum repositório encontrado." : "Nenhuma issue encontrada.");
      props.onResult({ items: res.items, params: { mode, sort, state, limit } });
    } catch (e) {
      props.onError(e instanceof Error ? e.message : "Falha na coleta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label="Termo de busca">
        <Input value={props.query} onChange={(e) => props.onQueryChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()} placeholder="ex.: aso tools, app store reviews" className="w-64" />
      </Field>
      <Field label="Buscar">
        <div className="flex rounded-lg border" role="group" aria-label="Tipo">
          {GH_MODES.map((m) => (
            <button key={m.id} aria-pressed={mode === m.id} onClick={() => setMode(m.id as "repos" | "issues")}
              className={cn("px-3 py-2 text-xs", mode === m.id ? "bg-primary/10 text-primary" : "hover:bg-muted")}>
              {m.label}
            </button>
          ))}
        </div>
      </Field>
      {mode === "repos" ? (
        <Field label="Ordenar por">
          <div className="flex rounded-lg border" role="group" aria-label="Ordenação">
            {GH_SORTS.map((o) => (
              <button key={o.id} aria-pressed={sort === o.id} onClick={() => setSort(o.id as GhRepoSort)}
                className={cn("px-2.5 py-2 text-xs", sort === o.id ? "bg-primary/10 text-primary" : "hover:bg-muted")}>
                {o.label}
              </button>
            ))}
          </div>
        </Field>
      ) : (
        <Field label="Estado">
          <div className="flex rounded-lg border" role="group" aria-label="Estado">
            {GH_STATES.map((o) => (
              <button key={o.id} aria-pressed={state === o.id} onClick={() => setState(o.id as GhIssueState)}
                className={cn("px-2.5 py-2 text-xs", state === o.id ? "bg-primary/10 text-primary" : "hover:bg-muted")}>
                {o.label}
              </button>
            ))}
          </div>
        </Field>
      )}
      <Field label="Resultados">
        <Input type="number" min={1} max={100} value={limit} onChange={(e) => setLimit(Number(e.target.value) || 20)} className="w-20" />
      </Field>
      <RunButton loading={loading} disabled={!props.query.trim()} onClick={run} />
    </div>
  );
}

// ---------- Semantic Scholar ----------
const S2_SORTS = [
  { id: "relevance", label: "Relevância" },
  { id: "citationCount", label: "Citações" },
];

export function SemanticScholarPanel(props: PanelProps) {
  const [sort, setSort] = useState<S2Sort>("relevance");
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    const q = props.query.trim();
    if (!q || loading) return;
    setLoading(true);
    try {
      const res = await fetchS2Papers(q, sort, limit);
      if (!res.ok) throw new Error(res.error);
      if (!res.items.length) props.onError("Nenhum artigo encontrado no Semantic Scholar.");
      props.onResult({ items: res.items, params: { sort, limit } });
    } catch (e) {
      props.onError(e instanceof Error ? e.message : "Falha na coleta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label="Termo de busca">
        <Input value={props.query} onChange={(e) => props.onQueryChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()} placeholder="ex.: app store optimization, sentiment analysis" className="w-72" />
      </Field>
      <Field label="Ordenar por">
        <div className="flex rounded-lg border" role="group" aria-label="Ordenação">
          {S2_SORTS.map((o) => (
            <button key={o.id} aria-pressed={sort === o.id} onClick={() => setSort(o.id as S2Sort)}
              className={cn("px-3 py-2 text-xs", sort === o.id ? "bg-primary/10 text-primary" : "hover:bg-muted")}>
              {o.label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Artigos">
        <Input type="number" min={1} max={100} value={limit} onChange={(e) => setLimit(Number(e.target.value) || 20)} className="w-20" />
      </Field>
      <RunButton loading={loading} disabled={!props.query.trim()} onClick={run} />
    </div>
  );
}

// ---------- Steam ----------
const STEAM_LANGS = [
  { id: "all", label: "Todos" },
  { id: "portuguese", label: "PT" },
  { id: "english", label: "EN" },
  { id: "spanish", label: "ES" },
];

export function SteamPanel(props: PanelProps) {
  const [games, setGames] = useState<{ appId: string; title: string }[]>([]);
  const [appId, setAppId] = useState("");
  const [language, setLanguage] = useState<SteamLang>("all");
  const [limit, setLimit] = useState(30);
  const [loading, setLoading] = useState<"search" | "reviews" | null>(null);

  const search = async () => {
    const q = props.query.trim();
    if (!q || loading) return;
    setLoading("search");
    try {
      const res = await fetchSteamGames(q, 10);
      if (!res.ok) throw new Error(res.error);
      const found = res.items.map((i) => ({ appId: String(i.meta?.appId), title: i.title }));
      setGames(found);
      if (found.length) setAppId(found[0].appId);
      else props.onError("Nenhum jogo encontrado na Steam.");
    } catch (e) {
      props.onError(e instanceof Error ? e.message : "Falha na busca");
    } finally {
      setLoading(null);
    }
  };

  const collect = async () => {
    if (!appId || loading) return;
    setLoading("reviews");
    try {
      const res = await fetchSteamReviews(appId, language, limit);
      if (!res.ok) throw new Error(res.error);
      const game = games.find((g) => g.appId === appId)?.title ?? appId;
      if (!res.items.length) props.onError("Nenhum review retornado para este jogo.");
      props.onResult({ items: res.items, params: { appId, game, language, limit } });
    } catch (e) {
      props.onError(e instanceof Error ? e.message : "Falha na coleta");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Jogo">
          <Input value={props.query} onChange={(e) => props.onQueryChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()} placeholder="ex.: balatro, hades, stardew" className="w-56" />
        </Field>
        <button onClick={search} disabled={loading !== null || !props.query.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border hover:bg-muted transition-colors disabled:opacity-50">
          {loading === "search" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Buscar jogo
        </button>
        {games.length > 0 && (
          <>
            <Field label="Título">
              <div className="flex flex-wrap rounded-lg border max-w-md" role="listbox" aria-label="Jogos encontrados">
                {games.slice(0, 5).map((g) => (
                  <button key={g.appId} role="option" aria-selected={appId === g.appId} onClick={() => setAppId(g.appId)}
                    className={cn("px-2.5 py-2 text-xs truncate max-w-40", appId === g.appId ? "bg-primary/10 text-primary" : "hover:bg-muted")}>
                    {g.title}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Idioma">
              <div className="flex rounded-lg border" role="group" aria-label="Idioma dos reviews">
                {STEAM_LANGS.map((l) => (
                  <button key={l.id} aria-pressed={language === l.id} onClick={() => setLanguage(l.id as SteamLang)}
                    className={cn("px-2.5 py-2 text-xs", language === l.id ? "bg-primary/10 text-primary" : "hover:bg-muted")}>
                    {l.label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Reviews">
              <Input type="number" min={1} max={100} value={limit} onChange={(e) => setLimit(Number(e.target.value) || 30)} className="w-20" />
            </Field>
            <RunButton loading={loading === "reviews"} disabled={!appId} onClick={collect} label="Coletar reviews" />
          </>
        )}
      </div>
    </div>
  );
}

// ---------- ReclameAqui (empresas + reclamações) ----------

export function ReclameAquiPanel(props: PanelProps) {
  const [mode, setMode] = useState<"company" | "term">("company");
  const [companies, setCompanies] = useState<RaCompanyLite[]>([]);
  const [picked, setPicked] = useState<RaCompanyLite | null>(null);
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState<"search" | "collect" | null>(null);

  const searchCompanies = async () => {
    const q = props.query.trim();
    if (!q || loading) return;
    setLoading("search");
    try {
      const res = await fetchReclameAquiCompanies(q);
      if (!res.ok) throw new Error(res.error);
      const found = res.items.map((i) => ({
        id: String(i.meta?.companyId ?? ""), name: i.title,
        shortname: String(i.meta?.shortname ?? ""), city: i.meta?.city as string | undefined, state: i.meta?.state as string | undefined,
      }));
      setCompanies(found);
      setPicked(found[0] ?? null);
      if (!found.length) props.onError("Nenhuma empresa encontrada no ReclameAqui.");
    } catch (e) {
      props.onError(e instanceof Error ? e.message : "Falha na busca");
    } finally {
      setLoading(null);
    }
  };

  const collect = async () => {
    if (loading) return;
    const q = props.query.trim();
    if (mode === "company" && !picked) return;
    if (mode === "term" && !q) return;
    setLoading("collect");
    try {
      const res = mode === "company"
        ? await fetchReclameAquiComplaints({ companyId: picked!.id || undefined, shortname: picked!.shortname || undefined, limit })
        : await fetchReclameAquiTerm(q, limit);
      if (!res.ok) throw new Error(res.error);
      if (!res.items.length) props.onError("Nenhuma reclamação retornada.");
      props.onResult({
        items: res.items,
        params: mode === "company"
          ? { mode, company: picked!.name, shortname: picked!.shortname, limit }
          : { mode, query: q, limit },
      });
    } catch (e) {
      props.onError(e instanceof Error ? e.message : "Falha na coleta");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Modo">
          <div className="flex rounded-lg border" role="group" aria-label="Modo de coleta">
            {([["company", "Por empresa"], ["term", "Por termo"]] as const).map(([id, label]) => (
              <button key={id} aria-pressed={mode === id} onClick={() => setMode(id)}
                className={cn("px-2.5 py-2 text-xs", mode === id ? "bg-primary/10 text-primary" : "hover:bg-muted")}>
                {label}
              </button>
            ))}
          </div>
        </Field>
        <Field label={mode === "company" ? "Empresa" : "Termo"}>
          <Input value={props.query} onChange={(e) => props.onQueryChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (mode === "company" ? searchCompanies() : collect())}
            placeholder={mode === "company" ? "ex.: nubank, latam, bipa" : "ex.: cobrança indevida"} className="w-56" />
        </Field>
        {mode === "company" && (
          <button onClick={searchCompanies} disabled={loading !== null || !props.query.trim()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border hover:bg-muted transition-colors disabled:opacity-50">
            {loading === "search" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            Buscar empresa
          </button>
        )}
        <Field label="Reclamações">
          <Input type="number" min={1} max={100} value={limit} onChange={(e) => setLimit(Number(e.target.value) || 25)} className="w-20" />
        </Field>
        {companies.length > 0 && mode === "company" && (
          <Field label="Resultado">
            <div className="flex flex-wrap rounded-lg border max-w-md" role="listbox" aria-label="Empresas encontradas">
              {companies.slice(0, 5).map((c) => (
                <button key={c.id || c.shortname} role="option" aria-selected={picked?.shortname === c.shortname} onClick={() => setPicked(c)}
                  className={cn("px-2.5 py-2 text-xs truncate max-w-40", picked?.shortname === c.shortname ? "bg-primary/10 text-primary" : "hover:bg-muted")}>
                  {c.name}{c.state ? ` (${c.state})` : ""}
                </button>
              ))}
            </div>
          </Field>
        )}
        <RunButton loading={loading === "collect"} disabled={mode === "company" ? !picked : !props.query.trim()} onClick={collect} label="Coletar reclamações" />
      </div>
    </div>
  );
}

// ---------- Coletores universais (Web/PDF/Feed/Texto) ----------

export function WebPanel(props: PanelProps) {
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<"page" | "pdf">("page");
  const [loading, setLoading] = useState(false);

  const run = async () => {
    const u = url.trim();
    if (!u || loading) return;
    setLoading(true);
    try {
      const res = mode === "page" ? await fetchWebPage(u) : await fetchPdfText(u);
      if (!res.ok) throw new Error(res.error);
      props.onResult({ items: res.items, params: { url: u, mode } });
    } catch (e) {
      props.onError(e instanceof Error ? e.message : "Falha na coleta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label="URL da página ou PDF">
        <Input value={url} onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder="https://exemplo.com/artigo ou …/paper.pdf" className="w-80" type="url" />
      </Field>
      <Field label="Tipo">
        <div className="flex rounded-lg border" role="group" aria-label="Tipo de coleta">
          {([["page", "Página"], ["pdf", "PDF"]] as const).map(([id, label]) => (
            <button key={id} aria-pressed={mode === id} onClick={() => setMode(id)}
              className={cn("px-2.5 py-2 text-xs", mode === id ? "bg-primary/10 text-primary" : "hover:bg-muted")}>
              {label}
            </button>
          ))}
        </div>
      </Field>
      <RunButton loading={loading} disabled={!url.trim()} onClick={run} label="Extrair" />
    </div>
  );
}

export function FeedPanel(props: PanelProps) {
  const [url, setUrl] = useState("");
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    const u = url.trim();
    if (!u || loading) return;
    setLoading(true);
    try {
      const res = await fetchFeedItems(u, limit);
      if (!res.ok) throw new Error(res.error);
      props.onResult({ items: res.items, params: { url: u, limit } });
    } catch (e) {
      props.onError(e instanceof Error ? e.message : "Falha na coleta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label="URL do feed RSS/Atom">
        <Input value={url} onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder="https://blog.exemplo.com/feed.xml" className="w-80" type="url" />
      </Field>
      <Field label="Itens">
        <Input type="number" min={1} max={100} value={limit} onChange={(e) => setLimit(Number(e.target.value) || 50)} className="w-20" />
      </Field>
      <RunButton loading={loading} disabled={!url.trim()} onClick={run} />
    </div>
  );
}

const PASTE_FORMATS = [
  { id: "auto", label: "Auto" },
  { id: "md", label: "Markdown" },
  { id: "txt", label: "Texto" },
  { id: "json", label: "JSON" },
  { id: "csv", label: "CSV" },
] as const;

export function ProductHuntPanel(props: PanelProps) {
  const [topic, setTopic] = useState("");
  const [via, setVia] = useState<"feed" | "graphql">("feed");
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetchProductHuntPosts({ topic: topic.trim(), via, limit });
      if (!res.ok) throw new Error(res.error);
      props.onResult({ items: res.items, params: { topic: topic.trim() || "geral", via, limit } });
    } catch (e) {
      props.onError(e instanceof Error ? e.message : "Falha na coleta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label="Caminho">
        <select
          aria-label="Caminho do Product Hunt"
          className="h-9 rounded-md border bg-background px-2 text-sm"
          value={via}
          onChange={(e) => setVia(e.target.value as "feed" | "graphql")}
        >
          <option value="feed">Feed público (sem token)</option>
          <option value="graphql">GraphQL oficial (com token)</option>
        </select>
      </Field>
      <Field label="Tópico (opcional, só no feed)">
        <Input value={topic} onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder="ex.: artificial-intelligence" className="w-52" disabled={via !== "feed"} />
      </Field>
      <Field label="Itens">
        <Input type="number" min={1} max={100} value={limit} onChange={(e) => setLimit(Number(e.target.value) || 20)} className="w-20" />
      </Field>
      <RunButton loading={loading} onClick={run} />
      <p className="text-[11px] text-muted-foreground w-full">
        Lançamentos do dia. O feed público traz título/tagline/link (sem votos);
        votos, comentários e tópicos exigem PRODUCT_HUNT_TOKEN no servidor.
      </p>
    </div>
  );
}

export function PastePanel(props: PanelProps) {
  const [text, setText] = useState("");
  const [format, setFormat] = useState<"auto" | "md" | "txt" | "json" | "csv">("auto");
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (!text.trim() || loading) return;
    setLoading(true);
    try {
      const res = await pasteTextItems(text, format);
      if (!res.ok) throw new Error(res.error);
      props.onResult({ items: res.items, params: { format, chars: text.length } });
    } catch (e) {
      props.onError(e instanceof Error ? e.message : "Falha ao processar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Formato">
          <div className="flex rounded-lg border" role="group" aria-label="Formato do texto">
            {PASTE_FORMATS.map((f) => (
              <button key={f.id} aria-pressed={format === f.id} onClick={() => setFormat(f.id)}
                className={cn("px-2.5 py-2 text-xs", format === f.id ? "bg-primary/10 text-primary" : "hover:bg-muted")}>
                {f.label}
              </button>
            ))}
          </div>
        </Field>
        <RunButton loading={loading} disabled={!text.trim()} onClick={run} label="Processar" />
      </div>
      <textarea
        value={text} onChange={(e) => setText(e.target.value)}
        placeholder="Cole aqui markdown, texto, JSON ou CSV…"
        aria-label="Texto para processar"
        className="w-full min-h-32 rounded-lg border bg-transparent px-3 py-2 text-xs font-mono resize-y"
      />
    </div>
  );
}

// ---------- Motor de conectores declarativos (painel genérico) ----------

/** Painel de coleta de uma fonte customizada (def passada em props). */
export function CustomConnectorPanel(props: PanelProps & { def: import("@/lib/uni/customSources").CustomSourceDef }) {
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    const q = props.query.trim();
    if (!q || loading) return;
    setLoading(true);
    try {
      const res = await fetchCustomSource(props.def, q, limit);
      if (!res.ok) throw new Error(res.error);
      props.onResult({ items: res.items, params: { source: `custom:${props.def.id}`, query: q, limit } });
    } catch (e) {
      props.onError(e instanceof Error ? e.message : "Falha na coleta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label="Termo de busca">
        <Input value={props.query} onChange={(e) => props.onQueryChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()} placeholder="ex.: tema, produto, termo" className="w-64" />
      </Field>
      <Field label="Itens">
        <Input type="number" min={1} max={100} value={limit} onChange={(e) => setLimit(Number(e.target.value) || 20)} className="w-20" />
      </Field>
      <RunButton loading={loading} disabled={!props.query.trim()} onClick={run} />
    </div>
  );
}

export function ConnectorPanel(props: PanelProps & { connectorId: ConnectorSourceId; lookup?: boolean }) {
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    const q = props.query.trim();
    if (!q || loading) return;
    setLoading(true);
    try {
      const res = await fetchConnector(props.connectorId, q, limit);
      if (!res.ok) throw new Error(res.error);
      props.onResult({ items: res.items, params: { source: props.connectorId, query: q, limit } });
    } catch (e) {
      props.onError(e instanceof Error ? e.message : "Falha na coleta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label={props.lookup ? "Nome exato" : "Termo de busca"}>
        <Input value={props.query} onChange={(e) => props.onQueryChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder={props.lookup ? "ex.: requests, fastapi" : "ex.: fintech, mobile app"} className="w-64" />
      </Field>
      {!props.lookup && (
        <Field label="Itens">
          <Input type="number" min={1} max={100} value={limit} onChange={(e) => setLimit(Number(e.target.value) || 20)} className="w-20" />
        </Field>
      )}
      <RunButton loading={loading} disabled={!props.query.trim()} onClick={run} />
    </div>
  );
}

const CONNECTOR_SOURCES: { id: ConnectorSourceId; lookup?: boolean }[] = [
  { id: "devto" }, { id: "lobsters" }, { id: "mastodon" }, { id: "bluesky" },
  { id: "wikidata" }, { id: "openalex" }, { id: "crossref" }, { id: "openlibrary" },
  { id: "npm" }, { id: "pypi", lookup: true }, { id: "itchio" },
  { id: "rubygems" }, { id: "cratesio" }, { id: "doaj" }, { id: "openfoodfacts" },
  { id: "archive" }, { id: "tvmaze" },
];

/** Dispatcher por fonte. */
export function UniSourcePanel({ source, ...props }: PanelProps & { source: UniSourceId }) {
  switch (source) {
    case "suggest": return <SuggestPanel {...props} />;
    case "trends": return <TrendsPanel {...props} />;
    case "serp": return <SerpPanel {...props} />;
    case "youtube": return <YoutubePanel {...props} />;
    case "reddit": return <RedditPanel {...props} />;
    case "wikipedia": return <WikipediaPanel {...props} />;
    case "hackernews": return <HackerNewsPanel {...props} />;
    case "gdelt": return <GdeltPanel {...props} />;
    case "arxiv": return <ArxivPanel {...props} />;
    case "stackexchange": return <StackExchangePanel {...props} />;
    case "github": return <GithubPanel {...props} />;
    case "semanticscholar": return <SemanticScholarPanel {...props} />;
    case "steam": return <SteamPanel {...props} />;
    case "reclameaqui": return <ReclameAquiPanel {...props} />;
    case "producthunt": return <ProductHuntPanel {...props} />;
    case "web": return <WebPanel {...props} />;
    case "feed": return <FeedPanel {...props} />;
    case "paste": return <PastePanel {...props} />;
    default: {
      const conn = CONNECTOR_SOURCES.find((c) => c.id === source);
      if (conn) return <ConnectorPanel {...props} connectorId={conn.id} lookup={conn.lookup} />;
    }
      return <p className="text-muted-foreground text-sm">Fonte em implementação.</p>;
  }
}
