import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, Plus, Trash2, Loader2, Sparkles, RefreshCw, Database,
  AlertCircle, FlaskConical, Apple, ShoppingBag, Check,
  Copy, Download, Filter, ListChecks, ChevronRight,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AIOutputCard } from "@/components/shared/AIOutputCard";
import { useDataset } from "@/hooks/useDataset";
import { useDestructiveAction } from "@/hooks/useUx";
import { listDataset, upsertDataset } from "@/lib/datasetStore";
import { useCompare } from "@/context/CompareContext";
import { useSelection, entryKey } from "@/context/SelectionContext";
import { useCollectionSettings } from "@/components/CollectionSettingsProvider";
import { searchApps } from "@/lib/appStoreApi";
import { searchGooglePlayApps } from "@/lib/googlePlayApi";
import { getUserRegion } from "@/lib/region";
import type { AppInfo } from "@/lib/appStoreApi";
import { collectApp as collectAppToDataset, collectCompareGroup } from "@/lib/collect";
import { EXPERIMENT_SECTIONS, type SectionDef } from "@/lib/experimentSections";
import { streamExperiment } from "@/lib/experimentApi";
import { getAIOutputFor } from "@/lib/aiOutputStore";
import { useCopy, downloadFile } from "@/lib/pageFeatures";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  enqueueJobs, startQueue, restartQueue, pauseQueue, useIAQueue,
  subscribeRunnerEvents, type IAJob,
} from "@/lib/iaRunner";
import { IAQueueBar } from "@/components/shared/IAQueueBar";

interface SectionState {
  loading: boolean;
  content: string;
  error: string;
}

const EMPTY_STATE: SectionState = { loading: false, content: "", error: "" };

export default function Experiments({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const { entries, remove, clear } = useDataset();
  const destroy = useDestructiveAction();
  const compare = useCompare();
  const { settings } = useCollectionSettings();
  const region = getUserRegion();
  const { selected, toggle, selectAll, selectNone, isSelected } = useSelection();

  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchResults, setSearchResults] = useState<AppInfo[]>([]);
  const [collecting, setCollecting] = useState<string | null>(null);
  const [sections, setSections] = useState<Record<string, SectionState>>({});
  const abortRef = useRef<Record<string, AbortController | null>>({});
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // F1: Section filter by kind; F2: Section search; F3: Export all
  const [kindFilter, setKindFilter] = useState<"all" | "ai" | "data">("all");
  const [sectionSearch, setSectionSearch] = useState("");
  const { copiedKey, copy } = useCopy();

  const filteredSections = useMemo(() => {
    return EXPERIMENT_SECTIONS.filter((s) => {
      if (kindFilter !== "all" && s.kind !== kindFilter) return false;
      if (sectionSearch.trim()) {
        const q = sectionSearch.toLowerCase();
        return s.label.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
      }
      return true;
    });
  }, [kindFilter, sectionSearch]);

  // F4: Progress tracker
  const completedCount = useMemo(
    () => EXPERIMENT_SECTIONS.filter((s) => s.kind === "ai" && sections[s.id]?.content && !sections[s.id]?.error).length,
    [sections],
  );
  const totalAiSections = EXPERIMENT_SECTIONS.filter((s) => s.kind === "ai").length;
  const progressPct = totalAiSections > 0 ? Math.round((completedCount / totalAiSections) * 100) : 0;

  const exportAllAnalyses = useCallback(() => {
    const parts: string[] = [`# Análises de Experimentos — ${new Date().toLocaleString("pt-BR")}`, ""];
    for (const s of EXPERIMENT_SECTIONS) {
      const state = sections[s.id];
      if (state?.content) {
        parts.push(`## ${s.label}`, "", state.content, "");
      }
    }
    if (parts.length <= 2) return;
    downloadFile("analises-experimentos.md", parts.join("\n"), "text/markdown");
  }, [sections]);

  const datasetCount = entries.length;
  const totalReviews = useMemo(
    () => entries.reduce((s, e) => s + e.reviews.length, 0),
    [entries]
  );

  const selectedEntries = useMemo(
    () => entries.filter((e) => selected.has(entryKey(e.app.store, e.app.id))),
    [entries, selected]
  );
  const selectedReviews = useMemo(
    () => selectedEntries.reduce((s, e) => s + e.reviews.length, 0),
    [selectedEntries]
  );

  // Reidrata outputs de IA persistidos para o escopo selecionado — o que a IA
  // gerou sobrevive a reload/restart/pull (antes vivia só em memória).
  const scopeKey = selectedEntries.map((e) => entryKey(e.app.store, e.app.id)).sort().join(",");
  useEffect(() => {
    if (selectedEntries.length === 0) return;
    const appKeys = selectedEntries.map((e) => entryKey(e.app.store, e.app.id));
    setSections((prev) => {
      const next = { ...prev };
      for (const s of EXPERIMENT_SECTIONS) {
        if (s.kind !== "ai") continue;
        if (next[s.id]?.content || next[s.id]?.loading) continue;
        const rec = getAIOutputFor(s.id, appKeys);
        if (rec) next[s.id] = { loading: false, content: rec.markdown, error: "" };
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);

  const runSearch = useCallback(async () => {
    const term = searchTerm.trim();
    if (!term) return;
    setSearching(true);
    setSearched(false);
    setSearchResults([]);
    try {
      const [apple, google] = await Promise.allSettled([
        searchApps(term, region, 5),
        searchGooglePlayApps(term, region, 5),
      ]);
      const results: AppInfo[] = [];
      if (apple.status === "fulfilled") results.push(...apple.value);
      if (google.status === "fulfilled") results.push(...google.value);
      setSearchResults(results);
    } catch (e) {
      setSearchResults([]);
    } finally {
      setSearching(false);
      setSearched(true);
    }
  }, [searchTerm, region]);

  const collectApp = useCallback(
    async (app: AppInfo) => {
      const ck = entryKey(app.store, app.id);
      setCollecting(ck);
      try {
        await collectAppToDataset(app, region, settings.reviewLimit, settings.reviewSort);
        // Auto-select the newly collected app so it's immediately usable by
        // the AI here and on every other page (shared selection).
        if (!isSelected(ck)) toggle(ck);
        setSearchResults((prev) => prev.filter((a) => !(a.store === app.store && a.id === app.id)));
      } catch (e) {
        console.error("collect error", e);
      } finally {
        setCollecting(null);
      }
    },
    [region, settings.reviewLimit, settings.reviewSort, isSelected, toggle]
  );

  const collectAllCompare = useCallback(async () => {
    const compareApps = compare.entries.map((e) => e.app);
    await collectCompareGroup(compareApps, region, settings.reviewLimit, settings.reviewSort);
    compare.clear();
  }, [compare, region, settings.reviewLimit, settings.reviewSort]);

  const runSection = useCallback(
    async (section: SectionDef) => {
      if (selectedEntries.length === 0) return;
      abortRef.current[section.id]?.abort();
      const controller = new AbortController();
      abortRef.current[section.id] = controller;
      setSections((prev) => ({
        ...prev,
        [section.id]: { loading: true, content: "", error: "" },
      }));
      await streamExperiment(
        section.id,
        selectedEntries,
        {
          onToken: (full) =>
            setSections((prev) => ({
              ...prev,
              [section.id]: { loading: true, content: full, error: "" },
            })),
          onDone: (full) =>
            setSections((prev) => ({
              ...prev,
              [section.id]: { loading: false, content: full, error: "" },
            })),
          onError: (err) =>
            setSections((prev) => ({
              ...prev,
              [section.id]: { loading: false, content: "", error: err },
            })),
        },
        controller.signal
      );
    },
    [selectedEntries]
  );

  const scrollToSection = (id: string) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /**
   * Pipeline completo via fila global de IA (iaRunner): continua rodando ao
   * navegar, pausa/retoma/recomeça pela IAQueueBar. streamExperiment já
   * persiste cada saída (saveAIOutput) — reidratação ao voltar à página.
   */
  const queue = useIAQueue();

  /** backgroundRuns OFF → pausa a fila ao sair da página (default ON: continua). */
  useEffect(() => {
    return () => {
      try {
        const raw = localStorage.getItem("aso:ai-settings:v1");
        if (raw && JSON.parse(raw).backgroundRuns === false) pauseQueue();
      } catch { /* default ON */ }
    };
  }, []);

  const runAll = useCallback(() => {
    const aiSections = EXPERIMENT_SECTIONS.filter((s) => s.kind === "ai");
    const jobs: IAJob[] = aiSections.map((section) => ({
      id: `exp:${section.id}`,
      label: `Análise: ${section.label}`,
      kind: "section",
      section: section.id,
      origin: "experiments",
    }));
    if (jobs.length === 0) return;
    const allDone = jobs.every((j) => queue.results[j.id] === "done");
    enqueueJobs(jobs, "replace");
    if (allDone) restartQueue(); else void startQueue();
  }, [queue.results]);

  /** Streaming da fila → estados das seções. */
  useEffect(() => {
    return subscribeRunnerEvents((ev) => {
      const id = ev.jobId ?? "";
      if (!id.startsWith("exp:")) return;
      const secId = id.slice(4);
      if (ev.type === "token" && ev.text != null) {
        setSections((prev) => ({ ...prev, [secId]: { loading: true, content: ev.text!, error: "" } }));
      } else if (ev.type === "done") {
        setSections((prev) => ({ ...prev, [secId]: { loading: false, content: prev[secId]?.content ?? "", error: "" } }));
      } else if (ev.type === "error") {
        setSections((prev) => ({ ...prev, [secId]: { loading: false, content: prev[secId]?.content ?? "", error: "Erro na geração" } }));
      }
    });
  }, []);

  const anyLoading = useMemo(
    () => Object.values(sections).some((s) => s.loading),
    [sections],
  );
  const stopAll = useCallback(() => {
    for (const c of Object.values(abortRef.current)) c?.abort();
    pauseQueue();
  }, []);

  return (
    <div className={embedded ? "bg-background" : "min-h-screen bg-background"}>
      {!embedded && (
        <AppHeader
          backTo="/"
          title="Experimentos"
          crumb="Experimentos"
          compare={{ count: compare.entries.length, onOpen: () => compare.setPickerOpen(true) }}
        />
      )}

      <main className="content-fluid py-8 space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FlaskConical className="h-6 w-6 text-primary" />
              Experimentos
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Colete dados de apps de múltiplas lojas e gere análises com IA local (Ollama). Selecione quais apps
              analisar — os reviews já coletados são reutilizados, sem recolher.
            </p>
          </div>
          {datasetCount > 0 && (
            <div className="flex items-center gap-2">
              {/* F3: Export all analyses */}
              {completedCount > 0 && (
                <Button variant="outline" size="sm" onClick={exportAllAnalyses} className="gap-1.5 text-xs" aria-label="Exportar todas as análises">
                  <Download className="h-3.5 w-3.5" /> Exportar
                </Button>
              )}
              {anyLoading && (
                <Button variant="outline" size="sm" onClick={stopAll} className="gap-1.5 text-xs text-destructive border-destructive/40 hover:bg-destructive/10" aria-label="Interromper todas as gerações em andamento">
                  <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" /> Parar
                </Button>
              )}
              <Button onClick={runAll} disabled={selectedEntries.length === 0} className="gap-1.5" title="Executa todas as seções em sequência (fila global — continua mesmo se você sair da página)">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Gerar todas as análises
              </Button>
            </div>
          )}
        </div>

        {/* Controles da fila global: pausar / retomar de onde parou / recomeçar */}
        <IAQueueBar origin="experiments" />

        {/* F4: Progress tracker */}
        {totalAiSections > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground inline-flex items-center gap-1.5">
                <ListChecks className="h-3.5 w-3.5" />
                Progresso das análises
              </span>
              <span className="font-semibold">{completedCount}/{totalAiSections} ({progressPct}%)</span>
            </div>
            <div className="h-1.5 rounded-full bg-secondary overflow-hidden" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )}

        {/* F1+F2: Section filter + search */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-border/60 overflow-hidden" role="group" aria-label="Filtrar seções por tipo">
            {([["all", "Todas"], ["ai", "IA"], ["data", "Dados"]] as const).map(([val, label]) => (
              <button key={val} onClick={() => setKindFilter(val)} className={`px-3 py-1 text-xs font-medium transition-colors ${kindFilter === val ? "bg-primary text-primary-foreground" : "bg-card/60 hover:bg-secondary text-muted-foreground"}`} aria-pressed={kindFilter === val}>
                {label}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[180px]">
            <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input type="search" value={sectionSearch} onChange={(e) => setSectionSearch(e.target.value)} placeholder="Filtrar seções…" className="pl-8 pr-3 py-1.5 rounded-lg border border-border/60 bg-card/60 text-xs w-full focus:outline-none focus:ring-2 focus:ring-primary/40" aria-label="Filtrar seções por nome" />
          </div>
        </div>

        {/* Dataset stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Apps no dataset" value={datasetCount} icon={Database} />
          <StatCard label="Apps selecionados" value={selectedEntries.length} icon={Check} highlight />
          <StatCard label="Reviews coletados" value={totalReviews} icon={FlaskConical} />
          <StatCard
            label="Lojas"
            value={new Set(entries.map((e) => e.app.store)).size}
            icon={Apple}
          />
        </div>

        {/* Collector */}
        <div className="rounded-xl border border-border/60 bg-card p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-sm font-semibold">Coletar dados de apps</h2>
            {compare.entries.length > 0 && (
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={collectAllCompare}>
                <Plus className="h-3.5 w-3.5" />
                Coletar {compare.entries.length} da lista de comparação
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder="Buscar apps (nome, bundle ID)..."
              className="flex-1"
            />
            <Button onClick={runSearch} disabled={searching} className="gap-1.5">
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Buscar
            </Button>
          </div>

          {searched && !searching && searchResults.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2 anim-fade-in" role="status">
              Nenhum app encontrado para "{searchTerm}". Tente outro nome ou o bundle ID.
            </p>
          )}
          {searchResults.length > 0 && (
            <div className="space-y-2" role="list" aria-label="Resultados da busca">
              {searchResults.map((app) => {
                const already = entries.some(
                  (e) => e.app.store === app.store && e.app.id === app.id
                );
                const isCollecting = collecting === `${app.store}:${app.id}`;
                return (
                  <div
                    key={`${app.store}:${app.id}`}
                    className="flex items-center gap-3 p-2 rounded-lg border border-border/40 hover:bg-secondary/40 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg overflow-hidden bg-secondary shrink-0">
                      {app.icon && <img src={app.icon} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{app.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {app.store === "apple" ? <Apple className="inline h-3 w-3" /> : <ShoppingBag className="inline h-3 w-3" />}{" "}
                        {app.developer} · ★{app.rating} · {app.genre}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={already ? "secondary" : "default"}
                      disabled={already || isCollecting}
                      onClick={() => collectApp(app)}
                      className="gap-1.5 text-xs shrink-0"
                    >
                      {isCollecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                      {already ? "Coletado" : "Coletar"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Collected apps — selectable subset for analysis */}
        {entries.length > 0 && (
          <div className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-sm font-semibold">
                Apps coletados ({datasetCount}) · {selectedEntries.length} selecionados · {selectedReviews} reviews
              </h2>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => selectAll(entries.map((e) => entryKey(e.app.store, e.app.id)))} disabled={selected.size === entries.length}>
                  <Check className="h-3.5 w-3.5" />
                  Selecionar todos
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={selectNone} disabled={selected.size === 0}>
                  Limpar seleção
                </Button>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {entries.map((entry) => {
                const k = entryKey(entry.app.store, entry.app.id);
                const isSel = isSelected(k);
                return (
                  <div
                    key={k}
                    role="checkbox"
                    aria-checked={isSel}
                    aria-label={`Selecionar ${entry.app.name}`}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggle(k);
                      }
                    }}
                    className={`group flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-primary/60 focus:outline-none ${
                      isSel ? "border-primary bg-primary/10" : "border-border/40 hover:bg-secondary/40"
                    }`}
                    onClick={() => toggle(k)}
                  >
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                        isSel ? "bg-primary border-primary text-primary-foreground" : "border-border"
                      }`}
                    >
                      {isSel && <Check className="h-3 w-3" />}
                    </div>
                    <div className="w-8 h-8 rounded-lg overflow-hidden bg-secondary shrink-0">
                      {entry.app.icon && <img src={entry.app.icon} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{entry.app.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {entry.app.store === "apple" ? <Apple className="inline h-3 w-3" /> : <ShoppingBag className="inline h-3 w-3" />}{" "}
                        {entry.reviews.length} reviews{entry.app.store === "apple" && entry.reviews.length === 0 ? " (Apple não expõe reviews via API pública)" : ""}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        destroy({
                          toast: `${entry.app.name} removido`,
                          toastDescription: `${entry.reviews.length} reviews`,
                          action: () => {
                            const backup = entry;
                            remove(entry.app.store, entry.app.id);
                            return () => upsertDataset(backup);
                          },
                        });
                      }}
                      className="p-1 rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity shrink-0"
                      title="Remover do dataset"
                      aria-label={`Remover ${entry.app.name} do dataset`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick nav */}
        {selectedEntries.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {filteredSections.map((s) => (
              <button
                key={s.id}
                onClick={() => scrollToSection(s.id)}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                <s.icon className="h-3 w-3" />
                {s.label}
              </button>
            ))}
          </div>
        )}

        {/* Sections */}
        {selectedEntries.length > 0 ? (
          <div className="space-y-4">
            {filteredSections.map((section) => {
              const state = sections[section.id] || EMPTY_STATE;
              return (
                <div
                  key={section.id}
                  ref={(el) => { sectionRefs.current[section.id] = el; }}
                  className="rounded-xl border border-border/60 bg-card overflow-hidden scroll-mt-20"
                >
                  <div className="flex items-start justify-between gap-3 p-4 border-b border-border/40">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <section.icon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold">{section.label}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{section.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Copy section result */}
                      {state.content && (
                        <button
                          onClick={() => copy(section.id, state.content)}
                          className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-border/60 bg-card/60 hover:border-primary/50 text-muted-foreground hover:text-foreground transition-colors"
                          aria-label="Copiar resultado"
                          title="Copiar"
                        >
                          {copiedKey === section.id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      )}
                      <Button
                        size="sm"
                        variant={state.content ? "outline" : "default"}
                        disabled={state.loading}
                        onClick={() => runSection(section)}
                        className="gap-1.5 text-xs"
                      >
                        {state.loading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : state.content ? (
                          <RefreshCw className="h-3.5 w-3.5" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                        {state.content ? "Regenerar" : "Gerar"}
                      </Button>
                    </div>
                  </div>

                  <div className="p-4">
                    {state.error ? (
                      <div className="flex items-center gap-2 text-sm text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        {state.error}
                      </div>
                    ) : state.content ? (
                      <AIOutputCard
                        bare
                        title={section.label}
                        description={section.description}
                        content={state.content}
                        filename={`experimentos-${section.id}`}
                        storageKey={`experiments:${section.id}`}
                        onRegenerate={() => runSection(section)}
                      />
                    ) : state.loading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Gerando análise...
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Clique em "Gerar" para produzir esta análise com a IA local.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : datasetCount > 0 ? (
          <div className="rounded-xl border border-dashed border-border/60">
            <EmptyState
              icon={Check}
              title="Nenhum app selecionado"
              description="Marque os apps acima para gerar análises sobre eles — os reviews já coletados são reutilizados."
            />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border/60">
            <EmptyState
              icon={Database}
              title="Dataset vazio"
              description="Colete apps aqui mesmo para começar a gerar análises."
              collect
            />
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, highlight }: { label: string; value: number; icon: typeof Database; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border bg-card p-4 flex items-center gap-3 ${highlight ? "border-primary/50 ring-1 ring-primary/20" : "border-border/60"}`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${highlight ? "bg-primary text-primary-foreground" : "bg-primary/10"}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xl font-bold leading-none">{value.toLocaleString("pt-BR")}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </div>
    </div>
  );
}
