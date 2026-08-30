/**
 * Pipeline Multifonte (/pipeline-multifonte) — automatiza de ponta a ponta:
 * seleção de fontes → coleta (com modo rápida/normal/max/custom) → análise
 * determinística → análise com IA → documento markdown gerado.
 *
 * Referências: página Pipeline (etapas com status) e Analysis Atlas (executar
 * por categoria). A coleta usa o sourceRunner (despachante uniforme); a IA
 * usa o prompt compartilhado buildUniSystemPrompt (mesma regra de evidência
 * da página Uni).
 */
import { useMemo, useRef, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { AIOutputCard } from "@/components/shared/AIOutputCard";
import { CopyDownloadButtons } from "@/components/shared/CopyDownloadButtons";
import { AIDisabledNotice } from "@/components/shared/AIDisabledNotice";
import { FeatureModal, useFeatureModal } from "@/components/shared/FeatureModal";
import { AISettingsPanel } from "@/components/AISettingsPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CollectModeBar, useCollectMode } from "@/components/uni/UniSourcePanel";
import {
  PIPELINE_SOURCES,
  buildPipelineDocument,
  collectFromCustomSource,
  collectFromSource,
  initialSteps,
  type PipelineStep,
} from "@/lib/uni/sourceRunner";
import { getCustomSource, useCustomSources } from "@/lib/uni/customSources";
import { UNI_SOURCE_META, type UniItem, type UniSourceId } from "@/lib/uni/types";
import { uniKindDist, uniSourceDist, uniWordFreq } from "@/lib/uni/uniAnalytics";
import { buildUniSystemPrompt, uniScopeLabel } from "@/lib/uni/uniAiPrompt";
import { toggleInList } from "@/lib/uni/collectModes";
import { streamExperimentChat } from "@/lib/experimentChatApi";
import { getAISettings, isAIEnabled } from "@/lib/aiSettings";
import { saveAIOutput, getAIOutput } from "@/lib/aiOutputStore";
import { toastError } from "@/lib/ux";
import {
  CheckCircle2, CircleDashed, FileText, Loader2, Play, SkipForward, Sparkles, Square, XCircle,
} from "lucide-react";

const AI_KEY = "multipipeline:analysis";

function StepIcon({ status }: { status: PipelineStep["status"] }) {
  switch (status) {
    case "running":
      return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    case "done":
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case "error":
      return <XCircle className="h-4 w-4 text-destructive" />;
    case "skipped":
      return <SkipForward className="h-4 w-4 text-amber-500" />;
    default:
      return <CircleDashed className="text-muted-foreground h-4 w-4" />;
  }
}

export default function MultiPipeline() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<UniSourceId[]>(["suggest", "serp", "reddit", "hackernews"]);
  const [selectedCustom, setSelectedCustom] = useState<string[]>([]);
  const customDefs = useCustomSources();
  const modeState = useCollectMode();
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const [items, setItems] = useState<UniItem[]>([]);
  const [running, setRunning] = useState(false);
  const [aiMarkdown, setAiMarkdown] = useState(() => getAIOutput(AI_KEY)?.markdown ?? "");
  const [aiStreaming, setAiStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const aiAbortRef = useRef<AbortController | null>(null);

  const ai = getAISettings();
  const aiEnabled = isAIEnabled(ai);
  // Modal de configuração de IA (o usuário ajusta sem sair do pipeline).
  const aiModal = useFeatureModal();

  const runnableCount = useMemo(
    () => steps.filter((s) => s.status === "done" || s.status === "running").length,
    [steps],
  );

  const runPipeline = async () => {
    const q = query.trim();
    if (!q || running || (!selected.length && !selectedCustom.length)) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setRunning(true);
    setItems([]);
    const ordered = selected.slice();
    // Etapas: builtin + defs customizadas selecionadas (cada def com seu id).
    const customSteps: PipelineStep[] = selectedCustom
      .map((id) => getCustomSource(id))
      .filter((d): d is NonNullable<typeof d> => !!d)
      .map((d) => ({ source: "custom" as UniSourceId, customId: d.id, status: "pending" as const, itemCount: 0 }));
    setSteps([...initialSteps(ordered, q), ...customSteps]);
    const collected: UniItem[] = [];
    for (const source of ordered) {
      if (ctrl.signal.aborted) break;
      setSteps((prev) => prev.map((s) => (s.source === source && s.status === "pending" ? { ...s, status: "running" } : s)));
      const outcome = await collectFromSource(source, q, modeState.mode, modeState.customLimit, ctrl.signal);
      if (ctrl.signal.aborted) break;
      collected.push(...outcome.items);
      setItems([...collected]);
      setSteps((prev) =>
        prev.map((s) =>
          s.source === source && !s.customId
            ? {
                ...s,
                status: outcome.skippedReason ? "skipped" : outcome.ok ? "done" : "error",
                itemCount: outcome.items.length,
                error: outcome.error,
                skippedReason: outcome.skippedReason,
              }
            : s,
        ),
      );
    }
    for (const defId of selectedCustom) {
      if (ctrl.signal.aborted) break;
      const def = getCustomSource(defId);
      if (!def) continue;
      setSteps((prev) => prev.map((s) => (s.customId === defId && s.status === "pending" ? { ...s, status: "running" } : s)));
      const outcome = await collectFromCustomSource(def, q, modeState.mode, modeState.customLimit, ctrl.signal);
      if (ctrl.signal.aborted) break;
      collected.push(...outcome.items);
      setItems([...collected]);
      setSteps((prev) =>
        prev.map((s) =>
          s.customId === defId
            ? {
                ...s,
                status: outcome.skippedReason ? "skipped" : outcome.ok ? "done" : "error",
                itemCount: outcome.items.length,
                error: outcome.error,
                skippedReason: outcome.skippedReason,
              }
            : s,
        ),
      );
    }
    setRunning(false);
  };

  const runAI = () => {
    if (!items.length || aiStreaming || !aiEnabled) return;
    aiAbortRef.current?.abort();
    const ctrl = new AbortController();
    aiAbortRef.current = ctrl;
    setAiStreaming(true);
    const scope = uniScopeLabel(items, (s) => UNI_SOURCE_META[s as UniSourceId]?.label ?? s);
    streamExperimentChat(
      [],
      [{ role: "user", content: "Analise os dados coletados no pipeline multifonte: principais temas, sentimento, padrões entre fontes, divergências e oportunidades. Cite a evidência (título do item) em cada afirmação." }],
      {
        onToken: () => setAiStreaming(true),
        onDone: (text) => {
          setAiStreaming(false);
          setAiMarkdown(text);
          if (text) saveAIOutput("multipipeline", [], text, `pipeline multifonte · ${query}`, AI_KEY);
        },
        onError: (msg) => {
          setAiStreaming(false);
          toastError(msg);
        },
      },
      ctrl.signal,
      ai,
      "os",
      undefined,
      buildUniSystemPrompt(items, scope),
    );
  };

  const document = useMemo(
    () => (steps.length ? buildPipelineDocument(query, steps, items, aiMarkdown || undefined) : ""),
    [steps, items, query, aiMarkdown],
  );

  const wordFreq = useMemo(() => uniWordFreq(items, 20), [items]);
  const sourceDist = useMemo(() => uniSourceDist(items), [items]);
  const kindDist = useMemo(() => uniKindDist(items), [items]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <AppHeader title="Pipeline Multifonte" crumb="colete → analise → documento" />
      <div className="content-fluid min-h-0 flex-1 overflow-y-auto py-4">
        <div className="flex flex-col gap-4">
          {/* Controles */}
          <div className="flex flex-wrap items-end gap-2" role="region" aria-label="Controles do pipeline">
            <label className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs">Termo ou URL</span>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runPipeline()}
                placeholder="ex.: banco digital ou https://…"
                className="w-72"
              />
            </label>
            <CollectModeBar state={modeState} />
            {running ? (
              <Button variant="destructive" onClick={() => abortRef.current?.abort()} className="self-end">
                <Square className="mr-1.5 h-4 w-4" /> Parar
              </Button>
            ) : (
              <Button onClick={runPipeline} disabled={!query.trim() || (!selected.length && !selectedCustom.length)} className="self-end">
                <Play className="mr-1.5 h-4 w-4" /> Rodar pipeline ({selected.length + selectedCustom.length} fontes)
              </Button>
            )}
          </div>

          {/* Seleção de fontes */}
                      <div role="region" aria-label="Fontes do pipeline">
            <div className="mb-1.5 flex items-center gap-2">
              <p className="text-muted-foreground text-xs">Fontes ({selected.length + selectedCustom.length} selecionadas)</p>
              <button className="text-primary text-xs hover:underline" onClick={() => { setSelected([...PIPELINE_SOURCES]); setSelectedCustom(customDefs.map((d) => d.id)); }}>Todas</button>
              <button className="text-primary text-xs hover:underline" onClick={() => { setSelected([]); setSelectedCustom([]); }}>Nenhuma</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PIPELINE_SOURCES.map((s) => (
                <button
                  key={s}
                  role="checkbox"
                  aria-checked={selected.includes(s)}
                  onClick={() => setSelected(toggleInList(selected, s))}
                  className={cn(
                    "rounded-md border px-2 py-1 text-xs transition-colors",
                    selected.includes(s) ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted",
                  )}
                >
                  {UNI_SOURCE_META[s]?.label ?? s}
                </button>
              ))}
              {customDefs.map((d) => (
                <button
                  key={d.id}
                  role="checkbox"
                  aria-checked={selectedCustom.includes(d.id)}
                  onClick={() => setSelectedCustom(toggleInList(selectedCustom, d.id))}
                  title={d.urlTemplate}
                  className={cn(
                    "rounded-md border border-dashed px-2 py-1 text-xs transition-colors",
                    selectedCustom.includes(d.id) ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted",
                  )}
                >
                  ✏️ {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Etapas */}
          {steps.length > 0 && (
            <div role="region" aria-label="Etapas do pipeline">
              <p className="text-muted-foreground mb-1.5 text-xs">
                Etapas — {steps.filter((s) => s.status === "done").length} concluídas ·{" "}
                {steps.filter((s) => s.status === "error").length} com erro ·{" "}
                {steps.filter((s) => s.status === "skipped").length} puladas
              </p>
              <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {steps.map((s) => (
                  <div key={s.customId ?? s.source} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                    <StepIcon status={s.status} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {s.customId ? (getCustomSource(s.customId)?.label ?? "Fonte customizada") : (UNI_SOURCE_META[s.source]?.label ?? s.source)}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {s.status === "skipped"
                          ? s.skippedReason
                          : s.status === "error"
                            ? s.error
                            : s.status === "done"
                              ? `${s.itemCount} itens`
                              : s.status === "running"
                                ? "coletando…"
                                : "aguardando"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Análise determinística */}
          {items.length > 0 && (
            <div className="grid gap-3 md:grid-cols-3" role="region" aria-label="Resumo determinístico">
              <div className="rounded-lg border p-3">
                <p className="mb-2 text-sm font-medium">Por fonte</p>
                {sourceDist.map((d) => (
                  <p key={d.label} className="text-muted-foreground flex justify-between text-xs">
                    <span>{d.label}</span>
                    <span className="font-mono">{d.value}</span>
                  </p>
                ))}
              </div>
              <div className="rounded-lg border p-3">
                <p className="mb-2 text-sm font-medium">Por tipo</p>
                {kindDist.map((d) => (
                  <p key={d.label} className="text-muted-foreground flex justify-between text-xs">
                    <span>{d.label}</span>
                    <span className="font-mono">{d.value}</span>
                  </p>
                ))}
              </div>
              <div className="rounded-lg border p-3">
                <p className="mb-2 text-sm font-medium">Termos frequentes</p>
                <div className="flex flex-wrap gap-1">
                  {wordFreq.map((w) => (
                    <span key={w.text} className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      {w.text} <span className="text-muted-foreground font-mono">{w.value}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* IA */}
          {items.length > 0 && (
            <div role="region" aria-label="Análise com IA">
              {aiEnabled ? (
                aiMarkdown || aiStreaming ? (
                  <AIOutputCard
                    title="Análise do pipeline"
                    content={aiMarkdown}
                    streaming={aiStreaming}
                    storageKey="multipipeline:ai"
                    filename="pipeline-multifonte"
                    onRegenerate={runAI}
                  />
                ) : (
                  <Button variant="outline" onClick={runAI}>
                    <Sparkles className="mr-1.5 h-4 w-4" /> Gerar análise com IA ({items.length} itens)
                  </Button>
                )
              ) : (
                <div className="space-y-2">
                  <AIDisabledNotice inlineConfigure={aiModal.openModal} />
                  <FeatureModal
                    open={aiModal.open}
                    onOpenChange={aiModal.setOpen}
                    title="Inteligência Artificial"
                    description="Configure o modo de IA (auto/local/cloud) sem sair do pipeline."
                    size="lg"
                  >
                    <AISettingsPanel />
                  </FeatureModal>
                </div>
              )}
            </div>
          )}

          {/* Documento */}
          {document && (
            <div className="relative rounded-lg border" role="region" aria-label="Documento gerado">
              <div className="flex items-center justify-between border-b px-3 py-2">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <FileText className="h-4 w-4" /> Documento ({runnableCount} fontes · {items.length} itens)
                </p>
                <CopyDownloadButtons content={document} filename="pipeline-multifonte" />
              </div>
              <pre className="max-h-96 overflow-auto p-3 font-mono text-xs whitespace-pre-wrap">{document}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
