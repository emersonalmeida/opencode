import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Apple, ShoppingBag, GitCompare, Loader2, Plus, Check, Search, X, Database } from "lucide-react";
import type { AppInfo, SourceId } from "@/lib/appStoreApi";
import { searchApps } from "@/lib/appStoreApi";
import { searchGooglePlayApps } from "@/lib/googlePlayApi";
import { useDataset } from "@/hooks/useDataset";
import { useCollectionSettings } from "@/components/CollectionSettingsProvider";
import { getUserRegion } from "@/lib/region";
import { useCompare } from "@/context/CompareContext";
import { selectKeysGlobally } from "@/context/SelectionContext";
import { collectApp } from "@/lib/collect";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

type Candidate = {
  store: SourceId;
  id: string;
  name: string;
  icon?: string;
  developer?: string;
  reviewCount?: number;
};

/**
 * Global app-selection picker for the comparison feature. Lists every app
 * already collected in the local dataset (so the user reuses them — no
 * re-collection), lets them search/collect new ones, and opens the comparison
 * view for the chosen set. Replaces the "Comparar" no-op that happened when the
 * compare tray was empty.
 */
export function ComparePickerDialog({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const region = useMemo(() => getUserRegion(), []);
  const { settings } = useCollectionSettings();
  const { entries: dataset } = useDataset();
  const { entries: tray, toggle, remove, clear } = useCompare();

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<AppInfo[]>([]);
  const [collecting, setCollecting] = useState<string | null>(null);

  // Collected apps become selectable candidates (these need NO re-collection).
  const collectedCandidates = useMemo<Candidate[]>(() => {
    return dataset.map((d) => ({
      store: d.app.store,
      id: d.app.id,
      name: d.app.name,
      icon: d.app.icon,
      developer: d.app.developer,
      reviewCount: d.reviews.length,
    }));
  }, [dataset]);

  // Debounced search across both stores (only when the user types a query).
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) { setSearchResults([]); return; }
    let alive = true;
    setSearching(true);
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
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [query, region, settings.searchLimit]);

  useEffect(() => {
    if (!open) { setQuery(""); setSearchResults([]); setCollecting(null); }
  }, [open]);

  const inTray = (c: { store: string; id: string }) =>
    tray.some((e) => e.app.store === c.store && e.app.id === c.id);

  const inDataset = (c: { store: string; id: string }) =>
    dataset.some((d) => d.app.store === c.store && d.app.id === c.id);

  const addCollected = (c: Candidate) => {
    const cached = dataset.find((d) => d.app.store === c.store && d.app.id === c.id);
    if (!cached) return;
    // Toggle the cached AppInfo into the compare tray — no network, reviews
    // come straight from the dataset.
    toggle(cached.app);
  };

  const addFromSearch = async (app: AppInfo) => {
    const ck = `${app.store}:${app.id}`;
    if (inTray({ store: app.store, id: app.id })) return;
    // Se já foi coletado, reutiliza (sem recoletar); senão, coleta agora.
    if (inDataset({ store: app.store, id: app.id })) {
      const cached = dataset.find((d) => d.app.store === app.store && d.app.id === app.id)!;
      toggle(cached.app);
      // Já coletado → garante que também entra na seleção global (base de IA).
      selectKeysGlobally([ck]);
      return;
    }
    setCollecting(ck);
    try {
      const { entry } = await collectApp(app, region, settings.reviewLimit, settings.reviewSort);
      toggle(entry.app);
      // Auto-seleção global: o app coletado já fica ativo para todo o sistema.
      selectKeysGlobally([ck]);
    } catch (e) {
      console.error("collect error", e);
    } finally {
      setCollecting(null);
    }
  };

  const goCompare = () => {
    if (tray.length === 0) return;
    const qs = tray.map((e) => `${e.app.store}:${e.app.id}`).join(",");
    onOpenChange(false);
    navigate(`/compare?apps=${qs}`);
  };

  const showSearch = query.trim().length >= 2;

  const renderCandidate = (c: Candidate, isSearchItem: boolean) => {
    const sel = inTray(c);
    const ck = `${c.store}:${c.id}`;
    const collected = inDataset(c);
    const busy = isSearchItem && !collected && collecting === ck;
    return (
      <li key={ck}>
        <button
          onClick={() => (isSearchItem ? addFromSearch(c as unknown as AppInfo) : addCollected(c))}
          className={`w-full flex items-center gap-3 rounded-lg p-2 text-left transition-colors ${sel ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-muted"}`}
        >
          {c.icon ? (
            <img src={c.icon} alt="" className="h-10 w-10 rounded-lg flex-shrink-0" />
          ) : (
            <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
              {c.store === "apple" ? <Apple className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
            <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
              {c.store === "apple" ? <Apple className="h-3 w-3" /> : <ShoppingBag className="h-3 w-3" />}
              {c.store === "apple" ? "App Store" : "Google Play"}
              {c.developer ? ` · ${c.developer}` : ""}
              {c.reviewCount !== undefined ? ` · ${c.reviewCount} reviews` : ""}
            </p>
          </div>
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />
          ) : (
            <div className={`h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 border ${sel ? "bg-primary border-primary text-primary-foreground" : "border-border text-muted-foreground"}`}>
              {sel ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            </div>
          )}
        </button>
      </li>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-primary" /> Comparar apps
          </DialogTitle>
          <DialogDescription>
            Selecione apps já coletados para comparar — eles são reutilizados, sem recolher reviews.
            Você também pode buscar e coletar novos abaixo.
          </DialogDescription>
        </DialogHeader>

        {/* Current compare tray */}
        {tray.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                No comparativo ({tray.length})
              </p>
              <button
                onClick={clear}
                className="text-[11px] text-muted-foreground hover:text-destructive"
              >
                Limpar seleção
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {tray.map((e) => (
                <span
                  key={`${e.app.store}:${e.app.id}`}
                  className="inline-flex items-center gap-1.5 text-xs bg-primary/10 text-primary rounded-full pl-2 pr-1 py-1"
                >
                  {e.app.store === "apple" ? <Apple className="h-3 w-3" /> : <ShoppingBag className="h-3 w-3" />}
                  <span className="max-w-[160px] truncate">{e.app.name}</span>
                  {e.loading && <Loader2 className="h-3 w-3 animate-spin" />}
                  <button
                    onClick={() => remove(e.app.id, e.app.store)}
                    className="hover:bg-primary/20 rounded-full p-0.5"
                    aria-label="Remover"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Search box */}
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar apps para coletar… (deixe vazio para ver os já coletados)"
            className="pl-9"
          />
          {searching && <Loader2 className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />}
        </div>

        {/* Candidate list */}
        <div className="flex-1 min-h-[220px] overflow-y-auto -mx-1 px-1">
          {showSearch ? (
            searchResults.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                {searching ? "Buscando…" : "Nenhum resultado encontrado."}
              </div>
            ) : (
              <ul className="space-y-1">
                {searchResults.map((a) => renderCandidate(
                  { store: a.store, id: a.id, name: a.name, icon: a.icon, developer: a.developer },
                  true,
                ))}
              </ul>
            )
          ) : collectedCandidates.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground flex flex-col items-center gap-2">
              <Database className="h-8 w-8 text-muted-foreground/40" />
              Nenhum app coletado ainda. Busque acima para coletar reviews.
            </div>
          ) : (
            <>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2 px-1">
                Apps coletados ({collectedCandidates.length})
              </p>
              <ul className="space-y-1">
                {collectedCandidates.map((c) => renderCandidate(c, false))}
              </ul>
            </>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border/50 pt-3 gap-2">
          <p className="text-xs text-muted-foreground">
            {tray.length === 0
              ? "Selecione ao menos 2 apps para comparar"
              : tray.length === 1
                ? "Adicione mais 1 app para comparar"
                : `${tray.length} apps serão comparados`}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Fechar</Button>
            <Button size="sm" onClick={goCompare} disabled={tray.length < 2} className="gap-1.5">
              <GitCompare className="h-3.5 w-3.5" /> Comparar {tray.length > 0 ? `(${tray.length})` : ""}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
