import { useState } from "react";
import { Search, Download, Check, Loader2 } from "lucide-react";
import { searchApps } from "@/lib/appStoreApi";
import { searchGooglePlayApps } from "@/lib/googlePlayApi";
import { collectApp } from "@/lib/collect";
import { hasDataset } from "@/lib/datasetStore";
import { getUserRegion } from "@/lib/region";
import { useCollectionSettings } from "@/components/CollectionSettingsProvider";
import { useSelection, entryKey } from "@/context/SelectionContext";
import { useDataset } from "@/hooks/useDataset";
import type { AppInfo } from "@/lib/appStoreApi";

/**
 * Etapa 1 — Descobrir: busca Apple + Google em paralelo e coleta inline.
 * Apps já no dataset aparecem como "Coletado".
 */
export function StageDiscover() {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<AppInfo[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [collecting, setCollecting] = useState<string | null>(null);
  const { settings } = useCollectionSettings();
  const { toggle, selected } = useSelection();
  const { entries } = useDataset();
  const region = getUserRegion();

  const search = async () => {
    const q = term.trim();
    if (!q) return;
    setSearching(true);
    setSearched(false);
    try {
      const [apple, google] = await Promise.all([
        searchApps(q, region, 6).catch(() => []),
        searchGooglePlayApps(q, region, 6).catch(() => []),
      ]);
      setResults([...apple, ...google]);
    } finally {
      setSearching(false);
      setSearched(true);
    }
  };

  const collect = async (app: AppInfo) => {
    const k = entryKey(app.store, app.id);
    setCollecting(k);
    try {
      await collectApp(app, region, settings.reviewLimit, settings.reviewSort);
      if (!selected.has(k)) toggle(k);
    } finally {
      setCollecting(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">O que você quer analisar?</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Busque um app nas duas lojas ao mesmo tempo. Clique em
          {" "}<strong>Coletar</strong> para baixar os reviews para o seu dataset local.
        </p>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); search(); }}
        className="flex gap-2"
        role="search"
      >
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Ex.: nubank, spotify, whatsapp…"
          aria-label="Termo de busca"
          className="flex-1 text-sm px-3 py-2.5 rounded-lg bg-secondary border border-border/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          type="submit"
          disabled={searching || !term.trim()}
          className="inline-flex items-center gap-1.5 text-sm px-4 py-2.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {searching ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Search className="h-4 w-4" aria-hidden />}
          Buscar
        </button>
      </form>

      {searching && <p className="text-xs text-muted-foreground" role="status">Buscando na Apple App Store e no Google Play…</p>}

      {searched && !searching && results.length === 0 && (
        <p className="text-sm text-muted-foreground" role="status">Nenhum app encontrado para “{term}”. Tente outro termo.</p>
      )}

      {results.length > 0 && (
        <ul className="grid sm:grid-cols-2 gap-2" aria-label="Resultados da busca">
          {results.map((app) => {
            const k = entryKey(app.store, app.id);
            const collected = hasDataset(app.store, app.id);
            return (
              <li key={k} className="flex items-center gap-3 rounded-lg border border-border/60 bg-background p-3">
                {app.icon ? (
                  <img src={app.icon} alt="" className="w-10 h-10 rounded-lg shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-secondary shrink-0" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{app.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {app.store === "apple" ? "App Store" : "Google Play"} · ★{app.rating.toFixed(1)} · {app.developer}
                  </p>
                </div>
                <button
                  onClick={() => collect(app)}
                  disabled={collecting === k}
                  className={`shrink-0 inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-md transition-colors ${
                    collected ? "bg-success/10 text-success" : "bg-primary text-primary-foreground hover:opacity-90"
                  } disabled:opacity-50`}
                  aria-label={collected ? `${app.name} já coletado — coletar novamente` : `Coletar ${app.name}`}
                >
                  {collecting === k
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    : collected
                      ? <Check className="h-3.5 w-3.5" aria-hidden />
                      : <Download className="h-3.5 w-3.5" aria-hidden />}
                  {collecting === k ? "Coletando" : collected ? "Coletado" : "Coletar"}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {entries.length > 0 && (
        <p className="text-xs text-muted-foreground" role="status">
          Seu dataset já tem <strong>{entries.length} app(s)</strong> — avance para Coletar para revisar a seleção.
        </p>
      )}
    </div>
  );
}
