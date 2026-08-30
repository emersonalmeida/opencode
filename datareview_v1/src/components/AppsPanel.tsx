import { useEffect, useMemo, useState } from "react";
import { confirmDestructive } from "@/lib/ux";
import { useNavigate } from "react-router-dom";
import {
  Apple, ShoppingBag, Layers, Check, Search, Loader2, Plus,
  Trash2, X, Settings2,
} from "lucide-react";
import {
  getHistory, subscribeHistory, removeHistory, clearHistory, type HistoryEntry,
} from "@/lib/history";
import { useDataset } from "@/hooks/useDataset";
import { removeDataset } from "@/lib/datasetStore";
import { useCollectionSettings } from "@/components/CollectionSettingsProvider";
import { useSelection, entryKey } from "@/context/SelectionContext";
import { searchApps, type AppInfo } from "@/lib/appStoreApi";
import { searchGooglePlayApps } from "@/lib/googlePlayApi";
import { getUserRegion } from "@/lib/region";
import { collectApp } from "@/lib/collect";
import { OriginBadge } from "@/components/shared/OriginBadge";
import { useGenerations } from "@/hooks/useSessions";
import { FilesPanel } from "@/components/shared/FilesPanel";

/**
 * Painel "Apps" — busca + coleta + seleção global do dataset. Autônomo
 * (assina os stores diretamente); usado na sidebar direita (aba Apps).
 */
export function AppsPanel() {
  const { entries: dataset } = useDataset();
  const { settings, setSettings, searchOptions, reviewOptions, reviewSortOptions } = useCollectionSettings();
  const { selected, toggle, selectAll, selectNone, isSelected } = useSelection();
  const [historyItems, setHistoryItems] = useState<HistoryEntry[]>(() => getHistory());
  const region = getUserRegion();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<AppInfo[]>([]);
  const [collecting, setCollecting] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => subscribeHistory(() => setHistoryItems(getHistory())), []);

  const allKeys = useMemo(() => dataset.map((e) => entryKey(e.app.store, e.app.id)), [dataset]);
  const selectedCount = selected.size;

  const compareGroups = useMemo(
    () => historyItems.filter((h): h is Extract<HistoryEntry, { type: "compare" }> => h.type === "compare"),
    [historyItems],
  );

  // Debounced search across both stores.
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const [apple, google] = await Promise.allSettled([
          searchApps(term, region, settings.searchLimit),
          searchGooglePlayApps(term, region, settings.searchLimit),
        ]);
        if (!alive) return;
        const merged: AppInfo[] = [];
        if (apple.status === "fulfilled") merged.push(...apple.value);
        if (google.status === "fulfilled") merged.push(...google.value);
        setSearchResults(merged);
      } catch {
        setSearchResults([]);
      } finally {
        if (alive) setSearching(false);
      }
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query, region, settings.searchLimit]);

  const collect = async (app: AppInfo) => {
    const ck = entryKey(app.store, app.id);
    setCollecting(ck);
    try {
      await collectApp(app, region, settings.reviewLimit, settings.reviewSort);
      // Auto-select the newly collected app so it's immediately usable.
      if (!isSelected(ck)) toggle(ck);
    } catch (e) {
      console.error("collect error", e);
    } finally {
      setCollecting(null);
    }
  };

  const showSearch = query.trim().length >= 2;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Search + config */}
      <div className="p-2 space-y-2 flex-shrink-0 max-h-[45%] overflow-y-auto">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") setQuery(""); }}
            placeholder="Buscar apps para coletar…"
            aria-label="Buscar apps para coletar"
            className="w-full pl-8 pr-8 h-8 text-xs rounded-lg bg-background border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {searching && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          {!searching && query.length > 0 && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              title="Limpar busca e fechar resultados (Esc)"
              aria-label="Limpar busca e fechar resultados"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {!showSearch && query.length === 0 && (
            <button
              onClick={() => setShowConfig((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              title="Configurações de coleta"
              aria-label="Configurações de coleta"
              aria-expanded={showConfig}
            >
              <Settings2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {showConfig && (
          <div className="rounded-lg border border-border/50 bg-background p-2.5 space-y-2.5 animate-fade-in">
            <div>
              <p className="text-[9px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Resultados por loja</p>
              <div className="flex flex-wrap gap-1">
                {searchOptions.map((n) => (
                  <button
                    key={n}
                    onClick={() => setSettings({ ...settings, searchLimit: n })}
                    className={`text-[10px] px-2 py-0.5 rounded-md transition-colors ${settings.searchLimit === n ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[9px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Máx reviews/app</p>
              <div className="flex flex-wrap gap-1">
                {reviewOptions.map((n) => (
                  <button
                    key={n}
                    onClick={() => setSettings({ ...settings, reviewLimit: n })}
                    className={`text-[10px] px-2 py-0.5 rounded-md transition-colors ${settings.reviewLimit === n ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}
                  >
                    {n >= 1000 ? `${n / 1000}k` : n}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider shrink-0">Personalizado</span>
                <input
                  type="number"
                  min={1}
                  max={10000}
                  step={50}
                  value={settings.reviewLimit}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    if (!Number.isNaN(n)) setSettings({ ...settings, reviewLimit: Math.max(1, Math.min(n, 10000)) });
                  }}
                  className="flex-1 min-w-0 text-[10px] px-1.5 py-1 rounded-md bg-secondary text-secondary-foreground border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
              </div>
            </div>
            <div>
              <p className="text-[9px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Ordenação dos reviews</p>
              <div className="flex flex-wrap gap-1">
                {reviewSortOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSettings({ ...settings, reviewSort: opt.value })}
                    title={opt.hint}
                    className={`text-[10px] px-2 py-0.5 rounded-md transition-colors ${settings.reviewSort === opt.value ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[9px] text-muted-foreground leading-relaxed">
              Coleta o máximo possível até o limite. Google usa a ordenação escolhida; Apple é best-effort (APIs públicas não expõem sort). Selecionar um app já coletado reusa os reviews (sem recolher).
            </p>
          </div>
        )}

      </div>

      {/* Search results — seção própria que ocupa TODO o espaço restante
          (não é um dropdown cortado sobre a lista) e fecha por si só: X,
          Esc no input, ou apagar o texto. */}
      {showSearch && (
        <div className="flex-1 min-h-0 flex flex-col border-t border-border/40">
          <div className="px-3 pt-1.5 pb-1 flex items-center justify-between flex-shrink-0">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground" role="status">
              {searching ? "Buscando…" : `Resultados · ${searchResults.length}`}
            </p>
            <button
              onClick={() => setQuery("")}
              className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground transition-colors"
              title="Fechar resultados"
              aria-label="Fechar resultados da busca"
            >
              <X className="h-3 w-3" /> Fechar
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-1 px-2 pb-2" role="listbox" aria-label="Resultados da busca por apps">
            {searchResults.length === 0 && !searching && (
              <p className="text-[10px] text-muted-foreground text-center py-3" role="status">Nenhum app encontrado.</p>
            )}
            {searchResults.map((app) => {
              const ck = entryKey(app.store, app.id);
              const already = dataset.some((d) => d.app.store === app.store && d.app.id === app.id);
              const busy = collecting === ck;
              return (
                <div key={ck} className="flex items-center gap-2 p-1.5 rounded-lg border border-border/40 hover:bg-secondary/40 transition-colors">
                  <div className="w-6 h-6 rounded overflow-hidden bg-secondary shrink-0">
                    {app.icon && <img src={app.icon} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium truncate">{app.name}</p>
                    <p className="text-[9px] text-muted-foreground truncate">
                      {app.store === "apple" ? <Apple className="inline h-2.5 w-2.5" /> : <ShoppingBag className="inline h-2.5 w-2.5" />} {app.developer}
                    </p>
                  </div>
                  {already ? (
                    <span className="text-[9px] text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 shrink-0">
                      <Check className="h-3 w-3" /> coletado
                    </span>
                  ) : (
                    <button
                      onClick={() => collect(app)}
                      disabled={busy}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 shrink-0 flex items-center gap-1"
                    >
                      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                      Coletar
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Collected list header — badge "Coletado" marca explicitamente que
          esta lista é DADO DO USUÁRIO (fonte de verdade), separada da seção
          "Gerações de IA" mais abaixo. */}
      {!showSearch && (
        <div className="px-3 pt-1 pb-1 flex items-center justify-between flex-shrink-0">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1.5">
            Coletados · {selectedCount}/{dataset.length}
            <OriginBadge origin="user" short />
          </p>
          {dataset.length > 0 && (
            <div className="flex items-center gap-1">
              <button onClick={() => selectAll(allKeys)} disabled={selectedCount === dataset.length} className="text-[9px] text-muted-foreground hover:text-primary disabled:opacity-40">
                Todos
              </button>
              <span className="text-[9px] text-muted-foreground/50">·</span>
              <button onClick={selectNone} disabled={selectedCount === 0} className="text-[9px] text-muted-foreground hover:text-foreground disabled:opacity-40">
                Nenhum
              </button>
            </div>
          )}
        </div>
      )}

      {/* Collected list (selectable) */}
      {!showSearch && (
        <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2 space-y-0.5">
          {dataset.length === 0 ? (
            <p className="text-[10px] text-muted-foreground text-center py-6 px-2">
              Busque acima para coletar apps. Os coletados aparecem aqui e podem ser selecionados para a IA.
            </p>
          ) : (
            dataset.map((entry) => {
              const k = entryKey(entry.app.store, entry.app.id);
              const sel = isSelected(k);
              return (
                <div
                  key={k}
                  role="checkbox"
                  aria-checked={sel}
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(k); } }}
                  className={`group flex items-center gap-2 p-1.5 rounded-md cursor-pointer transition-colors ${sel ? "bg-primary/10" : "hover:bg-secondary/60"}`}
                  onClick={() => toggle(k)}
                >
                  <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${sel ? "bg-primary border-primary text-primary-foreground" : "border-border"}`}>
                    {sel && <Check className="h-2.5 w-2.5" />}
                  </div>
                  <div className="w-5 h-5 rounded overflow-hidden bg-secondary shrink-0">
                    {entry.app.icon && <img src={entry.app.icon} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium truncate">{entry.app.name}</p>
                    <p className="text-[9px] text-muted-foreground truncate flex items-center gap-0.5">
                      {entry.app.store === "apple" ? <Apple className="inline h-2.5 w-2.5" /> : <ShoppingBag className="inline h-2.5 w-2.5" />}
                      {" "}{entry.reviews.length} reviews
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/app/${entry.app.store}/${entry.app.id}`); }}
                    className="p-1 rounded text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    title="Abrir detalhe"
                    aria-label={`Abrir detalhe de ${entry.app.name}`}
                  >
                    <Layers className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeDataset(entry.app.store, entry.app.id); }}
                    className="p-1 rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    title="Remover do dataset"
                    aria-label={`Remover ${entry.app.name} do dataset`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })
          )}

          {/* Arquivos do usuário (contexto para a IA no /chat-arquivos) —
              dado do usuário, separado das gerações de IA. */}
          <div className="pt-3 border-t border-border/30 mt-3">
            <p className="px-1 text-[9px] uppercase tracking-wider font-semibold text-muted-foreground/70 flex items-center gap-1.5 mb-1">
              Arquivos do usuário
              <OriginBadge origin="user" short />
            </p>
            <FilesPanel />
          </div>

          {/* Gerações de IA ligadas aos apps coletados — listadas SEPARADAS
              dos dados coletados e marcadas com badge "IA" (regra do produto:
              dado do usuário por padrão; produção da IA identificada). */}
          <AIGenerationsSection datasetKeys={allKeys} />

          {/* Saved compare groups */}
          {compareGroups.length > 0 && (
            <div className="pt-3">
              <div className="flex items-center justify-between px-1">
                <p className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground/70">Comparações salvas</p>
                <button
                  onClick={() => { if (confirmDestructive("Limpar comparações do histórico?")) clearHistory(); }}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Limpar comparações do histórico"
                >
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              </div>
              <div className="mt-1 space-y-0.5">
                {compareGroups.map((g, i) => (
                  <div key={`cmp-${i}`} className="group flex items-center gap-1.5">
                    <button
                      onClick={() => navigate(`/compare?apps=${g.apps.map((a) => `${a.store}:${a.id}`).join(",")}`)}
                      className="flex-1 flex items-center gap-2 px-1.5 py-1 rounded-md text-left text-[11px] text-foreground hover:bg-secondary/60 transition-colors min-w-0"
                    >
                      <Layers className="h-3 w-3 text-primary shrink-0" />
                      <span className="truncate">{g.apps.length} apps</span>
                    </button>
                    <button
                      onClick={() => removeHistory(g)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all"
                      aria-label="Remover comparação"
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Seção "Gerações de IA" — lista as gerações (análises, chats, agentes,
 * canvas) ligadas aos apps coletados, sempre separadas dos dados coletados
 * e marcadas com badge "IA". Clique abre a página correspondente.
 */
function AIGenerationsSection({ datasetKeys }: { datasetKeys: string[] }) {
  const generations = useGenerations();
  const navigate = useNavigate();
  const relevant = useMemo(() => {
    // Só gerações de IA — coletas ("collect") são dado do usuário e já
    // aparecem na lista principal acima.
    const aiOnly = generations.filter((g) => g.type !== "collect");
    if (datasetKeys.length === 0) return aiOnly.slice(0, 5);
    const keys = new Set(datasetKeys);
    return aiOnly
      .filter((g) => g.appKeys?.some((k) => keys.has(k)) || g.appKeys?.length === 0)
      .slice(0, 5);
  }, [generations, datasetKeys]);

  if (relevant.length === 0) return null;
  return (
    <div className="pt-3 border-t border-dashed border-violet-500/30 mt-3">
      <p className="px-1 text-[9px] uppercase tracking-wider font-semibold text-muted-foreground/70 flex items-center gap-1.5">
        Gerações de IA · {relevant.length}
        <OriginBadge origin="ai" short />
      </p>
      <p className="px-1 mt-0.5 text-[9px] text-muted-foreground/60 leading-snug">
        Produzidas por IA — interpretações, não fonte primária. Os dados
        originais ficam na lista "Coletados" acima.
      </p>
      <div className="mt-1 space-y-0.5">
        {relevant.map((g) => (
          <button
            key={g.id}
            onClick={() => navigate("/sessions")}
            className="w-full flex items-center gap-2 px-1.5 py-1 rounded-md text-left hover:bg-violet-500/5 transition-colors"
            title="Abrir em Sessões"
          >
            <OriginBadge origin="ai" short />
            <span className="flex-1 min-w-0 truncate text-[11px]">{g.title || g.type}</span>
            <span className="text-[9px] text-muted-foreground/60 shrink-0">
              {new Date(g.createdAt).toLocaleDateString("pt-BR")}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

