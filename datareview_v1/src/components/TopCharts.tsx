import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Apple, ShoppingBag, Loader2, TrendingUp, Star, Download, Plus, Check, ArrowUpRight, LayoutGrid, List, Rows3, Search, SlidersHorizontal, X, Globe } from "lucide-react";
import { fetchAppleTopList, lookupApp, type TopChartEntry, type AppInfo } from "@/lib/appStoreApi";
import { fetchGooglePlayTopList, fetchGooglePlayAppDetails } from "@/lib/googlePlayApi";
import { getUserRegion, REGION_OPTIONS } from "@/lib/region";
import { useNavigate } from "react-router-dom";
import { useCompare } from "@/context/CompareContext";
import { collectAndSelectInBackground } from "@/lib/collectAndSelect";
import { cn } from "@/lib/utils";

interface CategoryDef {
  key: string;
  label: string;
  appleGenreId?: number;
  googleCategory?: string;
}

// Categorias das duas lojas. Cada aba filtra as duas colunas simultaneamente.
const CATEGORIES: CategoryDef[] = [
  { key: "productivity", label: "Produtividade", appleGenreId: 6007, googleCategory: "PRODUCTIVITY" },
  { key: "games", label: "Jogos", appleGenreId: 6014, googleCategory: "GAME" },
  { key: "social", label: "Social", appleGenreId: 6005, googleCategory: "SOCIAL" },
  { key: "finance", label: "Finanças", appleGenreId: 6015, googleCategory: "FINANCE" },
  { key: "health", label: "Saúde e Fitness", appleGenreId: 6013, googleCategory: "HEALTH_AND_FITNESS" },
  { key: "entertainment", label: "Entretenimento", appleGenreId: 6016, googleCategory: "ENTERTAINMENT" },
  { key: "shopping", label: "Compras", appleGenreId: 6024, googleCategory: "SHOPPING" },
  { key: "education", label: "Educação", appleGenreId: 6017, googleCategory: "EDUCATION" },
  { key: "business", label: "Negócios", appleGenreId: 6000, googleCategory: "BUSINESS" },
  { key: "lifestyle", label: "Estilo de Vida", appleGenreId: 6012, googleCategory: "LIFESTYLE" },
  { key: "travel", label: "Viagens", appleGenreId: 6003, googleCategory: "TRAVEL_AND_LOCAL" },
  { key: "food", label: "Comida e Bebida", appleGenreId: 6023, googleCategory: "FOOD_AND_DRINK" },
  { key: "sports", label: "Esportes", appleGenreId: 6004, googleCategory: "SPORTS" },
  { key: "music", label: "Música", appleGenreId: 6011, googleCategory: "MUSIC_AND_AUDIO" },
  { key: "photo", label: "Foto e Vídeo", appleGenreId: 6008, googleCategory: "PHOTOGRAPHY" },
  { key: "news", label: "Notícias", appleGenreId: 6009, googleCategory: "NEWS_AND_MAGAZINES" },
  { key: "books", label: "Livros", appleGenreId: 6018, googleCategory: "BOOKS_AND_REFERENCE" },
  { key: "reference", label: "Referência", appleGenreId: 6006, googleCategory: "BOOKS_AND_REFERENCE" },
  { key: "utilities", label: "Utilitários", appleGenreId: 6002, googleCategory: "TOOLS" },
  { key: "weather", label: "Clima", appleGenreId: 6001, googleCategory: "WEATHER" },
  { key: "navigation", label: "Navegação", appleGenreId: 6010, googleCategory: "MAPS_AND_NAVIGATION" },
  { key: "medical", label: "Médico", appleGenreId: 6020, googleCategory: "MEDICAL" },
  { key: "kids", label: "Crianças", appleGenreId: 6027, googleCategory: "FAMILY" },
  { key: "magazines", label: "Revistas e Jornais", appleGenreId: 6021, googleCategory: "NEWS_AND_MAGAZINES" },
  { key: "developer", label: "Desenvolvedor", appleGenreId: 6026 },
  { key: "graphics", label: "Design", appleGenreId: 6027 },
  { key: "communication", label: "Comunicação", googleCategory: "COMMUNICATION" },
  { key: "dating", label: "Namoro", googleCategory: "DATING" },
  { key: "personalization", label: "Personalização", googleCategory: "PERSONALIZATION" },
  { key: "parenting", label: "Paternidade", googleCategory: "PARENTING" },
  { key: "auto", label: "Automóveis", googleCategory: "AUTO_AND_VEHICLES" },
  { key: "beauty", label: "Beleza", googleCategory: "BEAUTY" },
  { key: "art", label: "Arte e Design", googleCategory: "ART_AND_DESIGN" },
  { key: "events", label: "Eventos", googleCategory: "EVENTS" },
  { key: "house", label: "Casa e Decoração", googleCategory: "HOUSE_AND_HOME" },
  { key: "library", label: "Bibliotecas", googleCategory: "LIBRARIES_AND_DEMO" },
  { key: "video_players", label: "Players e Editores", googleCategory: "VIDEO_PLAYERS" },
];

type FeedType = "top-free" | "top-paid" | "top-grossing";
type StoreFilter = "all" | "apple" | "google";
type ViewMode = "grid" | "list" | "compact";
type SortKey = "rank" | "rating" | "reviews" | "name";

const FEED_OPTIONS: { key: FeedType; label: string }[] = [
  { key: "top-free", label: "Grátis" },
  { key: "top-paid", label: "Pagos" },
  { key: "top-grossing", label: "Top arrecadação" },
];

const COUNT_OPTIONS = [10, 25, 50, 100, 200];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "rank", label: "Ranking" },
  { key: "rating", label: "Nota" },
  { key: "reviews", label: "Nº de reviews" },
  { key: "name", label: "Nome (A–Z)" },
];

export function TopCharts() {
  const [category, setCategory] = useState<string>("productivity");
  const [feed, setFeed] = useState<FeedType>("top-free");
  const [count, setCount] = useState<number>(50);
  const [storeFilter, setStoreFilter] = useState<StoreFilter>("all");
  const [view, setView] = useState<ViewMode>("grid");
  const [sort, setSort] = useState<SortKey>("rank");
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState<string>(() => getUserRegion());
  const [showFilters, setShowFilters] = useState(true);
  const [apple, setApple] = useState<TopChartEntry[]>([]);
  const [google, setGoogle] = useState<TopChartEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cat = CATEGORIES.find(c => c.key === category)!;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const gpCollection = feed === "top-paid" ? "TOP_PAID" : feed === "top-grossing" ? "GROSSING" : "TOP_FREE";
      const [a, g] = await Promise.allSettled([
        fetchAppleTopList(region, feed, count, cat.appleGenreId),
        fetchGooglePlayTopList(region, cat.googleCategory, gpCollection, count),
      ]);
      if (cancelled) return;
      const [ea, eg] = await Promise.allSettled([
        enrichTopEntries(a.status === "fulfilled" ? a.value : [], region),
        enrichTopEntries(g.status === "fulfilled" ? g.value : [], region),
      ]);
      if (cancelled) return;
      setApple(ea.status === "fulfilled" ? ea.value : (a.status === "fulfilled" ? a.value : []));
      setGoogle(eg.status === "fulfilled" ? eg.value : (g.status === "fulfilled" ? g.value : []));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [category, region, feed, count]);

  const activeCat = CATEGORIES.find(c => c.key === category)!;
  const regionLabel = REGION_OPTIONS.find(r => r.code === region)?.label ?? region.toUpperCase();

  // Merge + filter + search + sort
  const merged = useMemo(() => {
    let list: (TopChartEntry & { rank: number })[] = [];
    if (storeFilter !== "google") list.push(...apple.map((e, i) => ({ ...e, rank: i + 1 })));
    if (storeFilter !== "apple") list.push(...google.map((e, i) => ({ ...e, rank: i + 1 })));
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(e => e.name.toLowerCase().includes(q) || e.developer.toLowerCase().includes(q));
    }
    if (sort === "rating") list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    else if (sort === "reviews") list.sort((a, b) => (b.ratingCount ?? 0) - (a.ratingCount ?? 0));
    else if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    return list;
  }, [apple, google, storeFilter, query, sort]);

  const hasAny = apple.length > 0 || google.length > 0;

  return (
    <section className="space-y-4 animate-fade-in" aria-labelledby="top-charts-title">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h3 id="top-charts-title" className="text-sm font-semibold text-foreground">Top charts por categoria</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Ao vivo · região <button onClick={() => setShowFilters(true)} className="uppercase font-medium text-foreground hover:text-primary underline-offset-2 hover:underline" title="Mudar região">{regionLabel}</button> · {merged.length} app(s)
            <span className="hidden sm:inline"> · toque em <Plus className="inline h-3 w-3 -mt-0.5" /> para adicionar ao painel</span>
          </p>
        </div>
        <div className="flex items-center gap-1">
          {/* View mode toggle */}
          <div className="flex rounded-lg border border-border/60 overflow-hidden" role="group" aria-label="Modo de visualização">
            {([
              { key: "grid" as const, icon: LayoutGrid, label: "Grade" },
              { key: "list" as const, icon: List, label: "Lista" },
              { key: "compact" as const, icon: Rows3, label: "Compacto" },
            ]).map((m) => (
              <button
                key={m.key}
                onClick={() => setView(m.key)}
                aria-pressed={view === m.key}
                title={m.label}
                className={cn("p-1.5 transition-colors", view === m.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary")}
              >
                <m.icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
          {/* Filters toggle */}
          <button
            onClick={() => setShowFilters(s => !s)}
            aria-expanded={showFilters}
            aria-label="Filtros e opções"
            title="Filtros e opções"
            className={cn("p-1.5 rounded-lg border transition-colors", showFilters ? "border-primary bg-primary/5 text-primary" : "border-border/60 text-muted-foreground hover:bg-secondary")}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Categorias (scroll horizontal) */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin" role="tablist" aria-label="Categorias">
        {CATEGORIES.map(c => (
          <button
            key={c.key}
            role="tab"
            aria-selected={category === c.key}
            onClick={() => setCategory(c.key)}
            className={`text-xs px-3 py-1.5 rounded-full transition-all whitespace-nowrap flex-shrink-0 ${
              category === c.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Collapsible filter bar */}
      {showFilters && (
        <div className="rounded-xl border border-border/60 bg-card/60 p-3 space-y-3 animate-fade-in-up">
          <div className="flex flex-wrap items-end gap-4">
            {/* Region */}
            <fieldset>
              <legend className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 flex items-center gap-1"><Globe className="h-3 w-3" /> Região</legend>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                aria-label="Região da loja"
                className="text-[11px] px-2 py-1 rounded-md bg-secondary text-secondary-foreground border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary/40 max-w-[140px]"
              >
                {REGION_OPTIONS.map(r => (
                  <option key={r.code} value={r.code}>{r.flag} {r.label}</option>
                ))}
              </select>
            </fieldset>

            {/* Feed/collection */}
            <fieldset>
              <legend className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Tipo</legend>
              <div className="flex gap-1" role="group">
                {FEED_OPTIONS.map(f => (
                  <button
                    key={f.key}
                    onClick={() => setFeed(f.key)}
                    aria-pressed={feed === f.key}
                    className={cn("text-[11px] px-2.5 py-1 rounded-md transition-colors", feed === f.key ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/70")}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Count */}
            <fieldset>
              <legend className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Quantidade</legend>
              <div className="flex gap-1" role="group">
                {COUNT_OPTIONS.map(n => (
                  <button
                    key={n}
                    onClick={() => setCount(n)}
                    aria-pressed={count === n}
                    className={cn("text-[11px] px-2.5 py-1 rounded-md tabular-nums transition-colors", count === n ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/70")}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Store filter */}
            <fieldset>
              <legend className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Loja</legend>
              <div className="flex gap-1" role="group">
                {([
                  { key: "all" as const, label: "Ambas" },
                  { key: "apple" as const, label: "Apple" },
                  { key: "google" as const, label: "Google" },
                ]).map(s => (
                  <button
                    key={s.key}
                    onClick={() => setStoreFilter(s.key)}
                    aria-pressed={storeFilter === s.key}
                    className={cn("text-[11px] px-2.5 py-1 rounded-md transition-colors", storeFilter === s.key ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/70")}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Sort */}
            <fieldset>
              <legend className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Ordenar por</legend>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="text-[11px] px-2 py-1 rounded-md bg-secondary text-secondary-foreground border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
              >
                {SORT_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </fieldset>
          </div>

          {/* Search within results */}
          <div className="relative max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtrar por nome ou dev…"
              aria-label="Filtrar resultados por nome ou desenvolvedor"
              className="w-full text-xs pl-8 pr-7 py-1.5 rounded-md bg-secondary text-foreground border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="Limpar filtro" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !hasAny ? (
        <div className="text-center py-12 text-xs text-muted-foreground">
          Sem dados para esta categoria/tipo. Tente outra combinação.
        </div>
      ) : merged.length === 0 ? (
        <div className="text-center py-12 text-xs text-muted-foreground">
          Nenhum app corresponde a "{query}".
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {storeFilter !== "google" && <ChartColumn title={`App Store · ${activeCat.label}`} Icon={Apple} entries={apple} region={region} />}
          {storeFilter !== "apple" && <ChartColumn title={`Google Play · ${activeCat.label}`} Icon={ShoppingBag} entries={google} region={region} />}
        </div>
      ) : view === "list" ? (
        <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur p-2">
          <ol className="space-y-0.5">
            {merged.slice(0, count * 2).map((e, i) => <TopRow key={`${e.store}-${e.id}-${i}`} entry={e} rank={i + 1} region={region} />)}
          </ol>
        </div>
      ) : (
        <CompactTable entries={merged} region={region} />
      )}
    </section>
  );
}

function CompactTable({ entries, region }: { entries: (TopChartEntry & { rank: number })[]; region: string }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur overflow-x-auto">
      <table className="w-full text-xs">
        <caption className="sr-only">Top charts — visualização compacta</caption>
        <thead className="bg-secondary/50 text-muted-foreground">
          <tr className="text-left">
            <th scope="col" className="px-2 py-1.5 font-medium w-10">#</th>
            <th scope="col" className="px-2 py-1.5 font-medium">App</th>
            <th scope="col" className="px-2 py-1.5 font-medium hidden sm:table-cell">Desenvolvedor</th>
            <th scope="col" className="px-2 py-1.5 font-medium text-right hidden md:table-cell">Downloads</th>
            <th scope="col" className="px-2 py-1.5 font-medium text-right hidden sm:table-cell">Reviews</th>
            <th scope="col" className="px-2 py-1.5 font-medium text-right">Nota</th>
            <th scope="col" className="px-2 py-1.5 font-medium w-10"></th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <CompactRow key={`${e.store}-${e.id}-${i}`} entry={e} rank={i + 1} region={region} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompactRow({ entry, rank, region }: { entry: TopChartEntry; rank: number; region: string }) {
  const navigate = useNavigate();
  const { toggle, isSelected } = useCompare();
  const [busy, setBusy] = useState(false);
  const asAppInfo: AppInfo = {
    id: entry.id, store: entry.store, name: entry.name, icon: entry.icon, developer: entry.developer,
    rating: entry.rating ?? 0, ratingCount: entry.ratingCount ?? 0, price: entry.price ?? (entry.free === false ? "Pago" : "Grátis"),
    genre: entry.genre ?? "", description: "", version: "", releaseDate: "", currentVersionReleaseDate: "",
    screenshots: [], url: entry.url, downloads: entry.installs,
  };
  const selected = isSelected(asAppInfo);
  const handleAdd = async (ev: React.MouseEvent) => {
    ev.stopPropagation();
    if (selected) { toggle(asAppInfo); return; }
    setBusy(true);
    try {
      const full = entry.store === "google" ? await fetchGooglePlayAppDetails(entry.id, region) : await lookupApp(entry.id, region);
      toggle(full ?? asAppInfo);
      // Auto-coleta + auto-seleção global: o app vira base de dados do sistema
      collectAndSelectInBackground(full ?? asAppInfo);
    } finally { setBusy(false); }
  };
  const StoreIcon = entry.store === "apple" ? Apple : ShoppingBag;
  return (
    <tr className="border-t border-border/40 hover:bg-secondary/30 transition-colors">
      <td className="px-2 py-1.5 text-muted-foreground tabular-nums">{rank}</td>
      <td className="px-2 py-1.5">
        <button onClick={() => navigate(`/app/${entry.store}/${entry.id}`)} className="flex items-center gap-2 text-left min-w-0">
          {entry.icon ? <img src={entry.icon} alt="" className="w-6 h-6 rounded flex-shrink-0" loading="lazy" /> : <div className="w-6 h-6 rounded bg-secondary flex-shrink-0" />}
          <span className="font-medium text-foreground truncate flex items-center gap-1">
            <StoreIcon className="h-2.5 w-2.5 text-muted-foreground flex-shrink-0" />
            {entry.name}
          </span>
        </button>
      </td>
      <td className="px-2 py-1.5 text-muted-foreground truncate hidden sm:table-cell max-w-[180px]">{entry.developer}</td>
      <td className="px-2 py-1.5 text-right text-muted-foreground hidden md:table-cell">{entry.installs ?? "—"}</td>
      <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground hidden sm:table-cell">
        {typeof entry.ratingCount === "number" && entry.ratingCount > 0 ? formatCount(entry.ratingCount) : "—"}
      </td>
      <td className="px-2 py-1.5 text-right tabular-nums">
        {typeof entry.rating === "number" && entry.rating > 0 ? (
          <span className="inline-flex items-center gap-0.5 justify-end"><Star className="h-2.5 w-2.5 fill-star text-star" />{entry.rating.toFixed(1)}</span>
        ) : "—"}
      </td>
      <td className="px-2 py-1.5">
        <button
          onClick={handleAdd}
          disabled={busy}
          aria-label={selected ? "Remover do painel" : "Adicionar ao painel"}
          title={selected ? "Remover do painel" : "Adicionar ao painel"}
          className={cn("flex items-center justify-center w-6 h-6 rounded-md border transition-all", selected ? "bg-primary border-primary text-primary-foreground" : "border-border/60 text-muted-foreground hover:border-primary/60 hover:text-primary")}
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : selected ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
        </button>
      </td>
    </tr>
  );
}

function ChartColumn({
  title, Icon, entries, region,
}: { title: string; Icon: typeof Apple; entries: TopChartEntry[]; region: string }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur p-4">
      <h4 className="flex items-center gap-2 text-xs font-semibold text-foreground mb-3">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" /> {title}
      </h4>
      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground py-8 text-center">Sem dados para esta categoria.</p>
      ) : (
        <ol className="space-y-0.5">
          {entries.map((e, i) => <TopRow key={`${e.store}-${e.id}-${i}`} entry={e} rank={i + 1} region={region} />)}
        </ol>
      )}
    </div>
  );
}

function TopRow({ entry, rank, region }: { entry: TopChartEntry; rank: number; region: string }) {
  const navigate = useNavigate();
  const { toggle, isSelected } = useCompare();
  const [busy, setBusy] = useState(false);

  const asAppInfo: AppInfo = {
    id: entry.id, store: entry.store, name: entry.name, icon: entry.icon, developer: entry.developer,
    rating: entry.rating ?? 0, ratingCount: entry.ratingCount ?? 0, price: entry.price ?? (entry.free === false ? "Pago" : "Grátis"),
    genre: entry.genre ?? "", description: "", version: "", releaseDate: "", currentVersionReleaseDate: "",
    screenshots: [], url: entry.url, downloads: entry.installs,
  };
  const selected = isSelected(asAppInfo);

  const handleAdd = async (ev: React.MouseEvent) => {
    ev.stopPropagation();
    if (selected) { toggle(asAppInfo); return; }
    setBusy(true);
    try {
      const full = entry.store === "google"
        ? await fetchGooglePlayAppDetails(entry.id, region)
        : await lookupApp(entry.id, region);
      toggle(full ?? asAppInfo);
      // Auto-coleta + auto-seleção global: o app vira base de dados do sistema
      collectAndSelectInBackground(full ?? asAppInfo);
    } finally {
      setBusy(false);
    }
  };

  const StoreIcon = entry.store === "apple" ? Apple : ShoppingBag;

  const metricNodes: ReactNode[] = [];
  if (entry.installs) metricNodes.push(<><Download className="h-2.5 w-2.5" />{entry.installs}</>);
  if (typeof entry.ratingCount === "number" && entry.ratingCount > 0) metricNodes.push(<span>{formatCount(entry.ratingCount)} reviews</span>);
  if (typeof entry.rating === "number" && entry.rating > 0) metricNodes.push(<><Star className="h-2.5 w-2.5 fill-star text-star" />{entry.rating.toFixed(1)}</>);

  return (
    <li className="group">
      <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-secondary/50 transition-colors">
        <span className="text-[11px] font-bold text-muted-foreground w-5 text-center tabular-nums">{rank}</span>
        {entry.icon
          ? <img src={entry.icon} alt="" className="w-10 h-10 rounded-lg flex-shrink-0" loading="lazy" />
          : <div className="w-10 h-10 rounded-lg bg-secondary flex-shrink-0" />}
        <button onClick={() => navigate(`/app/${entry.store}/${entry.id}`)} className="flex-1 min-w-0 text-left">
          <p className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors flex items-center gap-1.5">
            <StoreIcon className="h-2.5 w-2.5 text-muted-foreground flex-shrink-0" />
            {entry.name}
          </p>
          <p className="text-[10px] text-muted-foreground truncate">{entry.developer}</p>
          {metricNodes.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[10px] text-muted-foreground">
              {metricNodes.map((m, i) => (
                <span key={i} className="inline-flex items-center gap-0.5">
                  {i >   0 && <span className="text-muted-foreground/60">·</span>}
                  {m}
                </span>
              ))}
            </div>
          )}
        </button>
        <button
          onClick={handleAdd}
          disabled={busy}
          title={selected ? "Remover do painel" : "Adicionar ao painel de comparação"}
          className={`flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg border transition-all ${
            selected
              ? "bg-primary border-primary text-primary-foreground"
              : "border-border/60 text-muted-foreground hover:border-primary/60 hover:text-primary"
          }`}
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : selected ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
        </button>
        <button
          onClick={() => navigate(`/app/${entry.store}/${entry.id}`)}
          title="Ver detalhes"
          className="flex-shrink-0 hidden sm:flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/** Completa métricas ausentes das listas com detalhes do app em lotes pequenos. */
async function enrichTopEntries(entries: TopChartEntry[], region: string): Promise<TopChartEntry[]> {
  const CHUNK =6;
  const out = [...entries];
  for (let i =0; i < out.length; i += CHUNK) {
    const chunk = out.slice(i, i + CHUNK);
    await Promise.allSettled(chunk.map(async (e, j) => {
      const idx = i + j;
      if (out[idx].rating && out[idx].ratingCount) return;
      try {
        const full = out[idx].store === "apple"
          ? await lookupApp(out[idx].id, region)
          : await fetchGooglePlayAppDetails(out[idx].id, region);
        if (full) out[idx] = {
          ...out[idx],
          rating: full.rating ?? out[idx].rating,
          ratingCount: full.ratingCount ?? out[idx].ratingCount,
          releaseDate: full.releaseDate ?? out[idx].releaseDate,
        };
      } catch (err) { /* mantém o dado parcial da lista */ }
    }));
  }
  return out;
}
