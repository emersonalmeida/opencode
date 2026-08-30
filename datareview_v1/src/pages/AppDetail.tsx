import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo, useRef } from "react";
import { RefreshCw, Link2, Download, MessageSquare, SearchX, AlertCircle } from "lucide-react";
import type { AppInfo, ReviewEntry } from "@/lib/appStoreApi";
import { collectApp } from "@/lib/collect";
import { ComparisonView, type ComparisonColumn } from "@/components/shared/ComparisonView";
import { AppHeader } from "@/components/AppHeader";
import { PageLoader } from "@/components/shared/PageLoader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { useCollectionSettings } from "@/components/CollectionSettingsProvider";
import { exportToJSON, exportToCSV, exportToMarkdown, exportToXLSX, exportToPDF } from "@/lib/exportUtils";
import { getUserRegion } from "@/lib/region";
import { pushHistory } from "@/lib/history";
import { useSetAIContext } from "@/context/AIContext";
import { useCompare } from "@/context/CompareContext";
import { useCopy, StarRating, downloadFile, useHotkey } from "@/lib/pageFeatures";

export default function AppDetail() {
  const { store, id } = useParams<{ store: string; id: string }>();
  const { settings } = useCollectionSettings();
  const navigate = useNavigate();
  const { entries: compareEntries, remove: removeCompare, setPickerOpen } = useCompare();
  const [app, setApp] = useState<AppInfo | null>(null);
  const [reviews, setReviews] = useState<ReviewEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const region = useMemo(() => getUserRegion(), []);

  const { copiedKey, copy } = useCopy();

  // F1: Refresh / re-collect button
  const handleRefresh = async () => {
    if (!app) return;
    setRefreshing(true);
    try {
      const shell: AppInfo = { ...app };
      const { entry } = await collectApp(shell, region, settings.reviewLimit, settings.reviewSort);
      setApp(entry.app);
      setReviews(entry.reviews);
    } finally {
      setRefreshing(false);
    }
  };

  // F2: Copy app link
  const appLink = app ? `${window.location.origin}/app/${app.store}/${app.id}` : "";
  const handleCopyLink = () => copy("link", appLink);

  // F10: Keyboard navigation between compared apps (←/→)
  useHotkey("ArrowLeft", () => {
    if (compareEntries.length > 0) {
      const prev = compareEntries[compareEntries.length - 1];
      navigate(`/app/${prev.app.store}/${prev.app.id}`);
    }
  }, [compareEntries]);
  useHotkey("ArrowRight", () => {
    if (compareEntries.length > 0) {
      const next = compareEntries[0];
      navigate(`/app/${next.app.store}/${next.app.id}`);
    }
  }, [compareEntries]);

  useEffect(() => {
    if (!store || !id) return;
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        // collectApp is the unified entry point: it dedups against the dataset,
        // REFETCHES (and merges) when the configured review limit grows beyond
        // what is already stored, and persists — so visiting a previously
        // collected app at a higher limit actually grows the review set instead
        // of silently showing the old, smaller cache.
        const shell: AppInfo = {
          id,
          store: store as "apple" | "google",
          name: store === "apple" ? `apple:${id}` : id,
          icon: "",
          developer: "",
          rating: 0,
          ratingCount: 0,
          price: "",
          url: "",
          genre: "",
          version: "",
          size: "",
          contentRating: "",
          description: "",
          screenshots: [],
          releaseDate: "",
          currentVersionReleaseDate: "",
        };
        const { entry } = await collectApp(shell, region, settings.reviewLimit, settings.reviewSort);
        if (!alive) return;
        setApp(entry.app);
        setReviews(entry.reviews);
      } catch (err) {
        console.error(err);
        if (alive) setError("Não foi possível carregar este app. Verifique a conexão e tente novamente.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [store, id, settings.reviewLimit, region, refreshTick]);

  useSetAIContext(
    { scope: "app", title: app?.name || "Detalhes", apps: app ? [{ app, reviews }] : [] },
    [app, reviews]
  );

  // Monta o array unificado de colunas: app principal + demais apps do tray de comparação.
  const columns: ComparisonColumn[] = useMemo(() => {
    if (!app) return [];
    const others = compareEntries.filter(
      e => !(e.app.id === app.id && e.app.store === app.store)
    );
    return [
      { key: `${app.store}:${app.id}`, store: app.store as "apple" | "google", id: app.id, app, reviews, loading: false, isPrimary: true },
      ...others.map(e => ({
        key: `${e.app.store}:${e.app.id}`,
        store: e.app.store as "apple" | "google",
        id: e.app.id,
        app: e.app,
        reviews: e.reviews,
        loading: e.loading,
      })),
    ];
  }, [app, reviews, compareEntries]);

  const compareCount = columns.length;

  // Quando a página de detalhe mostra 2+ apps lado a lado, registra o grupo na
  // sidebar de histórico à esquerda como uma única entrada "compare" (agrupada).
  // Debounce via ref para não inundar o histórico ao alternar o tray rapidamente.
  const lastGroupKeyRef = useRef<string>("");
  useEffect(() => {
    if (compareCount < 2) { lastGroupKeyRef.current = ""; return; }
    const key = columns
      .map((c) => `${c.store}:${c.id}`)
      .sort()
      .join(",");
    if (key === lastGroupKeyRef.current) return;
    lastGroupKeyRef.current = key;
    pushHistory({
      type: "compare",
      apps: columns.map((c) => ({
        store: c.store,
        id: c.id,
        name: c.app.name,
        icon: c.app.icon,
      })),
      ts: Date.now(),
    });
  }, [columns, compareCount]);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        backTo={-1}
        title="Detalhes"
        crumb={app?.name}
        compare={{ count: compareCount, onOpen: () => setPickerOpen(true) }}
        onExportJSON={app ? () => exportToJSON(app, reviews) : undefined}
        onExportCSV={app ? () => exportToCSV(reviews) : undefined}
        onExportMD={app ? () => exportToMarkdown(app, reviews) : undefined}
        onExportXLSX={reviews.length ? () => exportToXLSX(reviews) : undefined}
        onExportPDF={app && reviews.length ? () => exportToPDF(app, reviews) : undefined}
      />

      {loading ? (
        <PageLoader label="Carregando app…" />
      ) : error ? (
        <EmptyState
          icon={AlertCircle}
          title="Falha ao carregar"
          description={error}
          action={
            <div className="flex gap-2">
              <Button onClick={() => setRefreshTick((t) => t + 1)} className="gap-1.5">
                <RefreshCw className="h-4 w-4" aria-hidden="true" /> Tentar novamente
              </Button>
              <Button variant="outline" onClick={() => navigate("/")}>Voltar ao início</Button>
            </div>
          }
        />
      ) : !app ? (
        <EmptyState
          icon={SearchX}
          title="App não encontrado"
          description="O app pode ter sido removido da loja ou o identificador está incorreto."
          action={<Button variant="outline" onClick={() => navigate("/")}>Voltar ao início</Button>}
        />
      ) : (
        <main className="px-6 py-8 space-y-4">
          {/* Action bar: refresh, copy link, rating, review count, exports */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 bg-card/60 hover:border-primary/50 text-xs transition-colors disabled:opacity-50"
              aria-label="Recolher reviews"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Recolhendo…" : "Recolher"}
            </button>

            <button
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 bg-card/60 hover:border-primary/50 text-xs transition-colors"
              aria-label="Copiar link do app"
            >
              {copiedKey === "link" ? <span className="text-emerald-500">✓ Copiado</span> : <><Link2 className="h-3.5 w-3.5" /> Copiar link</>}
            </button>

            {app.rating > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/60 text-xs">
                <StarRating rating={app.rating} />
                <span className="font-semibold">{app.rating.toFixed(1)}</span>
                <span className="text-muted-foreground">({(app.ratingCount || 0).toLocaleString("pt-BR")})</span>
              </span>
            )}

            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/60 text-xs">
              <MessageSquare className="h-3 w-3 text-muted-foreground" />
              <span className="font-semibold">{reviews.length}</span>
              <span className="text-muted-foreground">reviews coletados</span>
            </span>

            <div className="ml-auto flex items-center gap-1.5">
              <button onClick={() => exportToJSON(app, reviews)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border/60 hover:border-primary/50 text-xs transition-colors" aria-label="Exportar JSON">
                <Download className="h-3 w-3" /> JSON
              </button>
              <button onClick={() => exportToCSV(reviews)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border/60 hover:border-primary/50 text-xs transition-colors" aria-label="Exportar CSV">
                <Download className="h-3 w-3" /> CSV
              </button>
              <button onClick={() => exportToMarkdown(app, reviews)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border/60 hover:border-primary/50 text-xs transition-colors" aria-label="Exportar Markdown">
                <Download className="h-3 w-3" /> MD
              </button>
            </div>
          </div>

          {/* Keyboard nav hint — only relevant in side-by-side comparison mode */}
          {compareCount > 1 && (
            <p className="text-[10px] text-muted-foreground/70 flex items-center gap-2 anim-fade-in">
              <kbd className="px-1 py-0.5 rounded bg-muted font-mono">←</kbd>
              <kbd className="px-1 py-0.5 rounded bg-muted font-mono">→</kbd>
              navegue entre os apps comparados pelo teclado
            </p>
          )}

          <ComparisonView
            columns={columns}
            onRemove={(key) => {
              const [s, ...rest] = key.split(":");
              removeCompare(rest.join(":"), s);
            }}
          />
        </main>
      )}
    </div>
  );
}
