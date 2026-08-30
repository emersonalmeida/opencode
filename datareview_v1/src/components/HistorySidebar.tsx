import { useEffect, useState } from "react";
import { confirmDestructive } from "@/lib/ux";
import { NavLink, useNavigate } from "react-router-dom";
import { History, Home, Trash2, Apple, ShoppingBag, Layers, PanelLeftClose, Sparkles, PanelLeftOpen, HelpCircle, Check } from "lucide-react";
import { getHistory, subscribeHistory, groupByDate, removeHistory, clearHistory, type HistoryEntry } from "@/lib/history";
import { listDataset, subscribeDataset, type DatasetEntry } from "@/lib/datasetStore";
import { resetOnboarding } from "@/components/OnboardingModal";

interface HistorySidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function HistorySidebar({ collapsed, onToggle }: HistorySidebarProps) {
  const [items, setItems] = useState<HistoryEntry[]>(() => getHistory());
  const [dataset, setDataset] = useState<DatasetEntry[]>(() => listDataset());
  const navigate = useNavigate();

  useEffect(() => subscribeHistory(() => setItems(getHistory())), []);
  useEffect(() => subscribeDataset(() => setDataset(listDataset())), []);

  // Lookup of "store:id" → review count from the collected dataset.
  const reviewCountByApp = new Map<string, number>();
  for (const e of dataset) reviewCountByApp.set(`${e.app.store}:${e.app.id}`, e.reviews.length);

  const groups = groupByDate(items);
  const openEntry = (e: HistoryEntry) => {
    if (e.type === "app") navigate(`/app/${e.store}/${e.id}`);
    else navigate(`/compare?apps=${e.apps.map(a => `${a.store}:${a.id}`).join(",")}`);
  };

  if (collapsed) {
    return (
      <aside className="hidden md:flex h-full flex-col items-center gap-2 py-3 w-full border-r border-border/50 bg-card/40 backdrop-blur-sm">
        <button onClick={onToggle} title="Expandir histórico" className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
          <PanelLeftOpen className="h-4 w-4" />
        </button>
        <button onClick={() => navigate("/")} title="Início" className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
          <Home className="h-4 w-4" />
        </button>
        <button title="Histórico" className="p-2 rounded-lg text-muted-foreground">
          <History className="h-4 w-4" />
        </button>
        <div className="flex-1" />
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary" title="App Intelligence">
          <Sparkles className="h-4 w-4" />
        </div>
      </aside>
    );
  }

  return (
    <aside className="hidden md:flex h-full flex-col w-full border-r border-border/50 bg-card/40 backdrop-blur-sm">
      <div className="p-3 flex items-center gap-2 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
          <Layers className="h-4 w-4 text-primary-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-foreground truncate">App Intelligence</p>
          <p className="text-[10px] text-muted-foreground truncate">Análise Apple + Google</p>
        </div>
        <button onClick={onToggle} title="Recolher" className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
          <PanelLeftClose className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="px-2 flex-shrink-0">
        <NavLink to="/" end className={({ isActive }) => `flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
          <Home className="h-3.5 w-3.5" /> Início
        </NavLink>
        <button onClick={resetOnboarding} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
          <HelpCircle className="h-3.5 w-3.5" /> Rever tour
        </button>
      </div>

      <div className="mt-3 px-3 flex items-center justify-between flex-shrink-0">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Histórico</p>
        {items.length > 0 && (
          <button onClick={() => { if (confirmDestructive("Limpar todo o histórico?")) clearHistory(); }} title="Limpar tudo" className="text-muted-foreground hover:text-destructive transition-colors">
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-3 mt-1 space-y-3">
        {items.length === 0 && (
          <p className="text-[11px] text-muted-foreground text-center py-6 px-2">
            Apps coletados e comparações aparecem aqui automaticamente.
          </p>
        )}
        {groups.map(g => (
          <div key={g.label}>
            <p className="text-[10px] text-muted-foreground/70 mb-1 px-2">{g.label}</p>
            <div className="space-y-0.5">
              {g.items.map((entry, i) => {
                const isApp = entry.type === "app";
                const key = isApp ? `app-${entry.store}-${entry.id}-${i}` : `cmp-${entry.apps.map(a => a.id).join("-")}-${i}`;
                const storeLabel = isApp ? (entry.store === "apple" ? "App Store" : "Google Play") : null;
                const reviewCount = isApp ? reviewCountByApp.get(`${entry.store}:${entry.id}`) : undefined;
                return (
                  <div key={key} className="group flex items-center gap-1.5">
                    <button
                      onClick={() => openEntry(entry)}
                      className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs text-foreground hover:bg-secondary transition-colors min-w-0"
                    >
                      {isApp ? (
                        <>
                          {entry.icon ? (
                            <img src={entry.icon} alt="" className="w-5 h-5 rounded flex-shrink-0" />
                          ) : entry.store === "apple" ? <Apple className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" /> : <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
                          <div className="min-w-0 flex-1">
                            <span className="block truncate">{entry.name}</span>
                            <span className="block text-[9px] text-muted-foreground/70 truncate flex items-center gap-1">
                              {storeLabel}
                              {reviewCount !== undefined && (
                                <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                                  · <Check className="h-2.5 w-2.5" /> {reviewCount} reviews
                                </span>
                              )}
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <Layers className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <span className="block truncate">Comparação · {entry.apps.length} apps</span>
                            <span className="block text-[9px] text-muted-foreground/70 truncate">
                              {Array.from(new Set(entry.apps.map(a => a.store === "apple" ? "App Store" : "Google Play"))).join(" + ")}
                            </span>
                          </div>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => removeHistory(entry)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all"
                      title="Remover"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
