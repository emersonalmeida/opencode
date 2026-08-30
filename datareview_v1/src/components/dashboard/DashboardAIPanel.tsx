/**
 * Painel de análises por IA para o Dashboard.
 * Reutiliza o endpoint experiment-analyze com as seções existentes e renderiza
 * o resultado via MarkdownRenderer com suporte a gráficos embutidos.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles, Loader2, AlertCircle, RefreshCw, Play, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AIOutputCard } from "@/components/shared/AIOutputCard";

import { EXPERIMENT_SECTIONS, type SectionDef } from "@/lib/experimentSections";
import { streamExperiment } from "@/lib/experimentApi";
import { getAIOutputFor } from "@/lib/aiOutputStore";
import type { DatasetEntry } from "@/lib/datasetStore";

interface SectionState {
  loading: boolean;
  content: string;
  error: string;
}

const EMPTY: SectionState = { loading: false, content: "", error: "" };

const DASHBOARD_SECTIONS = EXPERIMENT_SECTIONS.filter((s) => s.kind === "ai");

interface Props {
  dataset: DatasetEntry[];
}

export function DashboardAIPanel({ dataset }: Props) {
  const [sections, setSections] = useState<Record<string, SectionState>>({});
  const [activeTab, setActiveTab] = useState<string>(DASHBOARD_SECTIONS[0]?.id ?? "quantitative");
  const abortRef = useRef<Record<string, AbortController | null>>({});
  const [runningAll, setRunningAll] = useState(false);

  // Reidrata outputs persistidos deste escopo (sobrevivem a reload/restart).
  const scopeKey = dataset.map((e) => `${e.app.store}:${e.app.id}`).sort().join(",");
  useEffect(() => {
    if (dataset.length === 0) return;
    const appKeys = dataset.map((e) => `${e.app.store}:${e.app.id}`);
    setSections((prev) => {
      const next = { ...prev };
      for (const s of DASHBOARD_SECTIONS) {
        if (next[s.id]?.content || next[s.id]?.loading) continue;
        const rec = getAIOutputFor(s.id, appKeys);
        if (rec) next[s.id] = { loading: false, content: rec.markdown, error: "" };
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);

  const runSection = useCallback(
    async (section: SectionDef) => {
      if (dataset.length === 0) return;
      abortRef.current[section.id]?.abort();
      const controller = new AbortController();
      abortRef.current[section.id] = controller;
      setSections((prev) => ({
        ...prev,
        [section.id]: { loading: true, content: "", error: "" },
      }));
      await streamExperiment(
        section.id,
        dataset,
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
        controller.signal,
      );
    },
    [dataset],
  );

  const runAll = useCallback(async () => {
    setRunningAll(true);
    for (const section of DASHBOARD_SECTIONS) {
      await runSection(section);
    }
    setRunningAll(false);
  }, [runSection]);

  const completedCount = DASHBOARD_SECTIONS.filter(
    (s) => sections[s.id]?.content,
  ).length;
  const activeSection = DASHBOARD_SECTIONS.find((s) => s.id === activeTab);
  const state = sections[activeTab] || EMPTY;

  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 p-4 border-b border-border/40 bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              Análises com IA
              {completedCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-success/10 text-success font-medium">
                  {completedCount}/{DASHBOARD_SECTIONS.length}
                </span>
              )}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Gere insights profundos a partir de {dataset.length} app(s) com {dataset.reduce((s, e) => s + e.reviews.length, 0)} reviews
            </p>
          </div>
        </div>
        <Button
          onClick={runAll}
          disabled={runningAll || dataset.length === 0}
          className="gap-1.5 text-xs shrink-0"
          size="sm"
        >
          {runningAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          {runningAll ? "Gerando..." : "Gerar todas"}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border/40 overflow-x-auto">
        {DASHBOARD_SECTIONS.map((s) => {
          const st = sections[s.id];
          const isActive = s.id === activeTab;
          const isDone = st?.content;
          const isLoading = st?.loading;
          return (
            <button
              key={s.id}
              onClick={() => setActiveTab(s.id)}
              className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <s.icon className="h-3 w-3" />
              {s.label}
              {isDone && !isLoading && <CheckCircle2 className="h-3 w-3 opacity-70" />}
              {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {activeSection && (
        <div className="p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <p className="text-xs text-muted-foreground">{activeSection.description}</p>
            <Button
              size="sm"
              variant={state.content ? "outline" : "default"}
              disabled={state.loading}
              onClick={() => runSection(activeSection)}
              className="gap-1.5 text-xs shrink-0"
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

          {state.error ? (
            <div className="flex items-center gap-2 text-sm text-destructive p-3 rounded-lg bg-destructive/5">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {state.error}
            </div>
          ) : state.content ? (
            <AIOutputCard
              bare
              title={activeSection?.label ?? "Análise"}
              content={state.content}
              streaming={state.loading}
              filename={`dashboard-${activeTab}`}
              storageKey={`dashboard:${activeTab}`}
              onRegenerate={() => runSection(activeSection)}
            />
          ) : state.loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              Processando dados com IA local...
            </div>
          ) : (
            <div className="text-center py-8">
              <Sparkles className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Clique em "Gerar" para produzir esta análise com a IA.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
