import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Search, Loader2, Plus, Check, GitCompareArrows, AlertTriangle, RefreshCw, Apple, ShoppingBag, ArrowUpDown, History, X } from "lucide-react";
import { searchApps, lookupApp, type AppInfo } from "@/lib/appStoreApi";
import { searchGooglePlayApps, fetchGooglePlayAppDetails, parseMultiInput } from "@/lib/googlePlayApi";
import { getUserRegion } from "@/lib/region";
import { useCompare } from "@/context/CompareContext";
import { useSetAIContext } from "@/context/AIContext";
import { collectAndSelectInBackground } from "@/lib/collectAndSelect";
import { AppCard } from "@/components/AppCard";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/AppHeader";
import { SectionHeader } from "@/components/SectionHeader";
import { clearCache } from "@/lib/cache";
import { useRecentItems, Skeleton } from "@/lib/pageFeatures";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorBox } from "@/components/ux/UxPrimitives";

type SortKey = "name" | "rating" | "reviews";
type StoreFilter = "all" | "apple" | "google";

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export default function SearchResults() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const region = getUserRegion();
  const { toggle, isSelected, entries: compareEntries, setPickerOpen } = useCompare();
  const query = params.get("q")?.trim() || "";

  const tokens = useMemo(() => parseMultiInput(query), [query]);
  const isMulti = tokens.length > 1;

  const [loading, setLoading] = useState(false);
  const [apple, setApple] = useState<AppInfo[]>([]);
  const [google, setGoogle] = useState<AppInfo[]>([]);
  const [failedTokens, setFailedTokens] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);

  // F1: Sort results; F2: Filter by store; F3: Search history
  const [sortKey, setSortKey] = useState<SortKey>("rating");
  const [storeFilter, setStoreFilter] = useState<StoreFilter>("all");
  const { items: recentSearches, add: addRecentSearch, clear: clearRecentSearches } = useRecentItems("aso:recent-searches:v1", 8);

  // F3: Record search in history
  useEffect(() => {
    if (query) addRecentSearch(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const allResults = useMemo(() => {
    let combined = [...google, ...apple];
    if (storeFilter === "apple") combined = combined.filter((a) => a.store === "apple");
    if (storeFilter === "google") combined = combined.filter((a) => a.store === "google");
    combined.sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name);
      if (sortKey === "rating") return (b.rating || 0) - (a.rating || 0);
      return (b.ratingCount || 0) - (a.ratingCount || 0);
    });
    return combined;
  }, [google, apple, sortKey, storeFilter]);

  const selectedCount = allResults.filter(isSelected).length;
  const allSelected = selectedCount === allResults.length && allResults.length > 0;

  const toggleSelectAll = () => {
    if (allSelected) {
      allResults.forEach((app) => { if (isSelected(app)) toggle(app); });
    } else {
      allResults.forEach((app) => { if (!isSelected(app)) toggle(app); });
      // Auto-coleta: ao selecionar todos, cada app entra na base de dados e na
      // seleção global — disponível para IA/dashboards sem outro gesto.
      allResults.forEach((app) => collectAndSelectInBackground(app));
    }
  };

  /**
   * Toggle de seleção na busca: além de marcar para comparar, inicia a coleta
   * do app em background e o SELECIONA globalmente — o app vira base de dados
   * de todo o sistema imediatamente (sem precisar coletar/selecionar de novo).
   * Desmarcar remove apenas da comparação; para tirar do escopo da IA, use a
   * aba Apps da sidebar direita.
   */
  const toggleWithAutoCollect = (app: AppInfo) => {
    const wasSelected = isSelected(app);
    toggle(app);
    if (!wasSelected) collectAndSelectInBackground(app);
  };

  useSetAIContext(
    {
      scope: "search",
      title: query ? `Busca · ${query}` : "Busca",
      apps: allResults.slice(0, 5).map(app => ({ app, reviews: [] })),
    },
    [query, allResults.length]
  );

  const runSearch = useCallback(() => {
    if (!query) return;
    setLoading(true);
    setError("");
    setFailedTokens([]);

    const run = async () => {
      const appleAcc = new Map<string, AppInfo>();
      const googleAcc = new Map<string, AppInfo>();
      const failed: string[] = [];

      const jobs: Promise<void>[] = [];

      // Direct id/url resolutions
      for (const t of tokens.filter(t => t.type === "id" || t.type === "url")) {
        jobs.push((async () => {
          try {
            if (t.store === "apple") {
              const app = await lookupApp(t.value, t.country ?? region);
              if (app) appleAcc.set(app.id, app); else failed.push(t.value);
            } else if (t.store === "google") {
              const app = await fetchGooglePlayAppDetails(t.value, region);
              if (app) googleAcc.set(app.id, app); else failed.push(t.value);
            }
          } catch { failed.push(t.value); }
        })());
      }

      // Term searches — always run in BOTH stores for every term token.
      const terms = tokens.filter(t => t.type === "term").map(t => t.value);
      const termsToSearch = terms.length > 0 ? terms : (!isMulti && tokens[0]?.type === "term" ? [tokens[0].value] : []);
      for (const term of termsToSearch) {
        jobs.push((async () => {
          const [a, g] = await Promise.allSettled([
            searchApps(term, region, isMulti ? 8 : 20),
            searchGooglePlayApps(term, region, isMulti ? 8 : 20),
          ]);
          if (a.status === "fulfilled") a.value.forEach(app => appleAcc.set(app.id, app));
          else failed.push(term);
          if (g.status === "fulfilled") g.value.forEach(app => googleAcc.set(app.id, app));
          else failed.push(term);
        })());
      }

      // Em buscas de termo único, tenta também resolução por id/url como rede
      // de segurança — URLs coladas com query strings estranhas ainda hidratam
      // o app correto.
      if (!isMulti && termsToSearch.length === 1) {
        const t = termsToSearch[0];
        // Nothing more to do — searches above already cover both stores.
      }

      await Promise.all(jobs);

      setApple(Array.from(appleAcc.values()));
      setGoogle(Array.from(googleAcc.values()));
      setFailedTokens(failed);
      if (failed.length > 0 && appleAcc.size + googleAcc.size > 0) {
        setError(`Não foi possível carregar ${failed.length} item(ns). Exibindo o restante.`);
      } else if (failed.length > 0) {
        setError(`Nenhum resultado retornado. Tente refinar o termo ou limpe o cache e tente novamente.`);
      }
      setLoading(false);
    };

    run().catch(err => {
      setError(err?.message || "Erro ao buscar.");
      setLoading(false);
    });
  }, [query, region, tokens, isMulti, refreshTick]);

  useEffect(() => {
    runSearch();
  }, [runSearch]);

  const addAllToCompare = () => {
    allResults.forEach(app => { if (!isSelected(app)) toggle(app); });
    allResults.forEach((app) => collectAndSelectInBackground(app));
  };

  const forceRefresh = () => {
    // Wipe cached responses for this query so a bad/empty cache can't lock us out.
    tokens.forEach(t => {
      clearCache(`apple:search|${t.value.toLowerCase()}`);
      clearCache(`gp:search|${t.value.toLowerCase()}`);
      clearCache(`apple:lookup|${t.value}`);
      clearCache(`gp:app|${t.value}`);
    });
    setRefreshTick(x => x + 1);
  };

  return (
    <div className="min-h-full flex flex-col">
      <AppHeader
        backTo="/"
        title="Busca"
        crumb={query || undefined}
        compare={{ count: compareEntries.length, onOpen: () => setPickerOpen(true) }}
        extraMenu={
          <button
            onClick={forceRefresh}
            className="w-full flex items-center gap-1.5 justify-center py-2 rounded-lg text-xs bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Ignorar cache e buscar novamente
          </button>
        }
      />

      <div className="flex-1 py-8 px-8">
        {/* F3: Recent searches strip */}
        {recentSearches.length > 0 && !query && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <History className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Buscas recentes</span>
              <button onClick={clearRecentSearches} className="ml-auto text-xs text-muted-foreground hover:text-foreground" aria-label="Limpar histórico de buscas">
                <X className="h-3 w-3" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {recentSearches.map((s) => (
                <button key={s} onClick={() => navigate(`/search?q=${encodeURIComponent(s)}`)} className="px-2.5 py-1 rounded-full bg-secondary/60 hover:bg-secondary text-xs transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <SectionHeader
          eyebrow="Resultados"
          title={isMulti ? "Busca em lote" : query ? `Resultados para “${query}”` : "Resultados da busca"}
          description={
            isMulti
              ? `${tokens.length} itens informados · resolvendo em ambas as lojas em paralelo.`
              : query
                ? `${google.length} no Google Play · ${apple.length} na App Store. Selecione um app para ver detalhes ou marque vários para comparar lado a lado.`
                : "Digite um termo, ID, URL ou lista separada por vírgula na busca acima."
          }
          actions={
            !loading && allResults.length > 0 ? (
              <Button variant="default" size="sm" onClick={addAllToCompare} className="gap-2">
                <GitCompareArrows className="h-4 w-4" />
                Adicionar {allResults.length} ao comparativo
              </Button>
            ) : undefined
          }
          className="mb-6"
        />


        {isMulti && !loading && (
          <div className="mb-6 flex flex-wrap gap-1.5">
            {tokens.map((t, i) => {
              const wasFailed = failedTokens.includes(t.value);
              return (
                <span
                  key={i}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border ${
                    wasFailed
                      ? "border-destructive/40 bg-destructive/10 text-destructive"
                      : "border-border/60 bg-secondary/60 text-foreground/80"
                  }`}
                  title={`${t.type}${t.store ? ` · ${t.store}` : ""}`}
                >
                  {wasFailed && <AlertTriangle className="h-2.5 w-2.5" />}
                  {t.country ? `${t.value} · ${t.country.toUpperCase()}` : (t.value.length > 32 ? t.value.slice(0, 30) + "…" : t.value)}
                </span>
              );
            })}
          </div>
        )}

        {loading && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[0, 1].map((col) => (
              <section key={col} className="rounded-2xl border border-border/60 bg-card/40 overflow-hidden">
                <header className="flex items-center gap-2 px-4 py-3 border-b border-border/60">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-10 rounded-full" />
                </header>
                <div className="p-3 space-y-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex gap-3 p-3">
                      <Skeleton className="h-12 w-12 rounded-xl" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-3 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {!loading && query && allResults.length === 0 && (
          <div className="border border-dashed border-border/60 rounded-2xl bg-card/30">
            <EmptyState
              icon={Search}
              title="Nenhum app encontrado"
              description="Tente outro nome, ID (ex: com.app.id ou 123456789) ou URL da loja. Ou busque novamente ignorando o cache."
              action={
                <Button variant="outline" size="sm" onClick={forceRefresh} className="gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Buscar novamente sem cache
                </Button>
              }
            />
          </div>
        )}

        {error && !loading && (
          <ErrorBox message={error} onRetry={runSearch} className="mb-6" />
        )}

        {!loading && allResults.length > 0 && (
          <>
            {/* Toolbar: store filter, sort, select all, result count */}
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <div className="inline-flex rounded-lg border border-border/60 overflow-hidden" role="group" aria-label="Filtrar por loja">
                {([["all", "Todas"], ["apple", "App Store"], ["google", "Google Play"]] as [StoreFilter, string][]).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setStoreFilter(val)}
                    className={`px-3 py-1 text-xs font-medium transition-colors ${
                      storeFilter === val ? "bg-primary text-primary-foreground" : "bg-card/60 hover:bg-secondary text-muted-foreground"
                    }`}
                    aria-pressed={storeFilter === val}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setSortKey((k) => k === "rating" ? "reviews" : k === "reviews" ? "name" : "rating")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 bg-card/60 hover:border-primary/50 text-xs transition-colors"
                aria-label="Ordenar resultados"
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
                {sortKey === "rating" ? "Por nota" : sortKey === "reviews" ? "Por reviews" : "A-Z"}
              </button>

              <button
                onClick={toggleSelectAll}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 bg-card/60 hover:border-primary/50 text-xs transition-colors"
                aria-label={allSelected ? "Desmarcar todos" : "Selecionar todos"}
              >
                {allSelected ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                {allSelected ? "Desmarcar todos" : "Selecionar todos"}
              </button>

              <span className="text-xs text-muted-foreground px-2" role="status">
                {selectedCount > 0
                  ? `${selectedCount} selecionado${selectedCount > 1 ? "s" : ""}`
                  : `${allResults.length} resultado${allResults.length > 1 ? "s" : ""}`}
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Google Play column */}
            <StoreColumn
              title="Google Play"
              icon={<ShoppingBag className="h-4 w-4 text-emerald-500" />}
              apps={google}
              emptyLabel="Nenhum resultado no Google Play"
              onNavigate={(id) => navigate(`/app/google/${encodeURIComponent(id)}`)}
              isSelected={isSelected}
              onToggle={toggleWithAutoCollect}
              totalReviews={google.reduce((s, a) => s + (a.ratingCount || 0), 0)}
            />
            {/* App Store column */}
            <StoreColumn
              title="App Store"
              icon={<Apple className="h-4 w-4" />}
              apps={apple}
              emptyLabel="Nenhum resultado na App Store"
              onNavigate={(id) => navigate(`/app/apple/${encodeURIComponent(id)}`)}
              isSelected={isSelected}
              onToggle={toggleWithAutoCollect}
              totalReviews={apple.reduce((s, a) => s + (a.ratingCount || 0), 0)}
            />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface StoreColumnProps {
  title: string;
  icon: React.ReactNode;
  apps: AppInfo[];
  emptyLabel: string;
  totalReviews: number;
  onNavigate: (id: string) => void;
  isSelected: (app: AppInfo) => boolean;
  onToggle: (app: AppInfo) => void;
}

function StoreColumn({ title, icon, apps, emptyLabel, totalReviews, onNavigate, isSelected, onToggle }: StoreColumnProps) {
  return (
    <section className="flex flex-col rounded-2xl border border-border/60 bg-card/40 overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-card/60 backdrop-blur">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <span className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full bg-secondary text-[11px] font-medium text-foreground/80">
            {apps.length}
          </span>
        </div>
        {apps.length > 0 && (
          <span className="text-[11px] text-muted-foreground">
            {formatCount(totalReviews)} reviews
          </span>
        )}
      </header>
      <div className="p-3 space-y-3 min-h-[160px]">
        {apps.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground/70 py-10">{emptyLabel}</div>
        ) : (
          apps.map(app => (
            <ResultCard
              key={`${app.store}-${app.id}`}
              app={app}
              selected={isSelected(app)}
              onToggle={() => onToggle(app)}
              onClick={() => onNavigate(app.id)}
            />
          ))
        )}
      </div>
    </section>
  );
}

interface ResultCardProps {
  app: AppInfo;
  selected: boolean;
  onToggle: () => void;
  onClick: () => void;
}

function ResultCard({ app, selected, onToggle, onClick }: ResultCardProps) {
  return (
    <div className="relative group anim-fade-in">
      <AppCard app={app} isSelected={selected} onClick={onClick} />
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        title={selected ? "Remover do painel" : "Adicionar ao painel de comparação"}
        aria-label={selected ? `Remover ${app.name} do painel de comparação` : `Adicionar ${app.name} ao painel de comparação`}
        aria-pressed={selected}
        className={`absolute top-3 right-3 flex items-center justify-center w-7 h-7 rounded-md border transition-all ${
          selected
            ? "bg-primary border-primary text-primary-foreground"
            : "bg-card/80 border-border/70 text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:border-primary/60"
        }`}
      >
        {selected ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
