import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles, Loader2, Database, BrainCircuit, Send, FlaskConical,
  HelpCircle, ShieldAlert, Wand2, Crown, ChevronRight, Search, Download,
  Printer, Copy, Check, MessageSquarePlus, Play, Square, FileText, Layers,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { AIOutputCard } from "@/components/shared/AIOutputCard";
import { AIEvaluationChip } from "@/components/shared/AIEvaluationChip";
import { PageSidebar } from "@/context/PageSidebarsContext";
import { SidebarToolTabs } from "@/components/shared/SidebarToolTabs";
import type { DatasetEntry } from "@/lib/datasetStore";
import { useCompare } from "@/context/CompareContext";
import { useSelection } from "@/context/SelectionContext";
import { useAISettings, isAIEnabled } from "@/lib/aiSettings";
import { streamExperimentChat, type ChatMessage } from "@/lib/experimentChatApi";
import { getAIOutput, saveAIOutput } from "@/lib/aiOutputStore";
import { useDataset as useDatasetEntries } from "@/hooks/useDataset";
import { computeKPIs, computeSentiment } from "@/lib/dashboardAnalytics";
import {
  PERSONAS, personaChatSuggestions,
  CHALLENGE_PROMPT, WHY_PROMPT, ACTION_PROMPT,
  type Persona, type DecisionModule,
} from "@/lib/decisionCenter";
import {
  buildRunSteps, buildRunStepsFor, buildCompendiumMarkdown, buildSynthesisPrompt,
  countCompleted, outputKey, stepProgress, SYNTHESIS_KEY, type PipelineStep,
} from "@/lib/decisionPipeline";
import {
  enqueueJobs, startQueue, restartQueue, pauseQueue, useIAQueue,
  subscribeRunnerEvents, type IAJob,
} from "@/lib/iaRunner";
import { IAQueueBar } from "@/components/shared/IAQueueBar";
import { exportDatasetToPDF } from "@/lib/exportUtils";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { downloadFile, useHotkey } from "@/lib/pageFeatures";
import { AIDisabledNotice } from "@/components/shared/AIDisabledNotice";

/* --------------------------------------------------------------- helpers --- */
function useDataset(): DatasetEntry[] {
  return useDatasetEntries().entries;
}

const SENT_COLORS = ["hsl(var(--status-success))", "hsl(var(--muted-foreground))", "hsl(var(--status-error))"];

function EmptyHint({ icon: Icon = Database, children }: { icon?: typeof Database; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <Icon className="h-7 w-7 text-muted-foreground/40" />
      <p className="text-xs text-muted-foreground max-w-xs">{children}</p>
    </div>
  );
}

/* ====================================================================== */
/* LEFT SIDEBAR — persona selector + KPIs + dataset summary               */
/* ====================================================================== */
function PersonaSelector({
  persona, onSelect, apps, reviews,
}: {
  persona: Persona; onSelect: (p: Persona) => void; apps: DatasetEntry[]; reviews: import("@/lib/appStoreApi").ReviewEntry[];
}) {
  const kpis = useMemo(() => computeKPIs(reviews, apps), [reviews, apps]);
  const sentiment = useMemo(() => computeSentiment(reviews), [reviews]);
  const byName = useMemo(() => Object.fromEntries(sentiment.map((d) => [d.name, d.value])), [sentiment]);
  const pieData = [
    { name: "Positivo", value: byName["Positivo (★4-5)"] ?? 0, color: SENT_COLORS[0] },
    { name: "Neutro", value: byName["Neutro (★3)"] ?? 0, color: SENT_COLORS[1] },
    { name: "Negativo", value: byName["Negativo (★1-2)"] ?? 0, color: SENT_COLORS[2] },
  ].filter((d) => d.value > 0);
  const maxSent = Math.max(1, ...pieData.map((d) => d.value));

  return (
    <div className="flex flex-col h-full text-xs">
      <div className="p-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/60 text-primary-foreground">
            <BrainCircuit className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="text-sm font-bold leading-tight">AI Decision Center</p>
            <p className="text-[10px] text-muted-foreground">Decision Intelligence</p>
          </div>
        </div>
      </div>

      {/* persona tabs */}
      <div className="p-3 border-b border-border/50">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Persona</p>
        <div className="grid grid-cols-2 gap-1">
          {PERSONAS.map((p) => {
            const Icon = p.icon;
            const active = p.id === persona.id;
            return (
              <button
                key={p.id}
                onClick={() => onSelect(p)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md p-2 transition-colors text-left",
                  active ? "bg-primary/10 text-primary" : "hover:bg-secondary text-muted-foreground",
                )}
                title={p.tagline}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="text-[11px] font-medium truncate">{p.label}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-2 rounded-md bg-muted/40 p-2">
          <p className="text-[10px] text-muted-foreground italic">{persona.tagline}</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="p-3 border-b border-border/50">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Escopo de dados</p>
        <div className="grid grid-cols-2 gap-1.5">
          <div className="rounded-md bg-muted/50 px-2 py-1.5">
            <p className="text-sm font-bold">{kpis.totalApps}</p>
            <p className="text-[9px] text-muted-foreground">apps</p>
          </div>
          <div className="rounded-md bg-muted/50 px-2 py-1.5">
            <p className="text-sm font-bold">{kpis.totalReviews.toLocaleString()}</p>
            <p className="text-[9px] text-muted-foreground">reviews</p>
          </div>
        </div>
        {pieData.length > 0 && (
          <div className="mt-2 space-y-1">
            {pieData.map((d) => (
              <div key={d.name} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                <span className="text-[10px] text-muted-foreground flex-1">{d.name}</span>
                <div className="w-12 h-1 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(d.value / maxSent) * 100}%`, background: d.color }} />
                </div>
                <span className="text-[10px] font-medium w-7 text-right">{d.value}</span>
              </div>
            ))}
          </div>
        )}
        {apps.length === 0 && (
          <p className="text-[10px] text-muted-foreground italic mt-1">Colete e selecione apps na sidebar do app.</p>
        )}
      </div>

      {/* central question */}
      <div className="p-3 border-b border-border/50">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Pergunta central</p>
        <p className="text-[11px] font-medium leading-relaxed">"{persona.centralQuestion}"</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Apps no escopo</p>
        {apps.length === 0 ? (
          <p className="text-[10px] text-muted-foreground italic">Nenhum app. Colete apps (aba Apps) e selecione.</p>
        ) : (
          <div className="space-y-1">
            {apps.map((e) => (
              <div key={`${e.app.store}:${e.app.id}`} className="flex items-center gap-2">
                {e.app.icon && <img src={e.app.icon} alt="" className="h-5 w-5 rounded" />}
                <span className="text-[11px] truncate flex-1">{e.app.name}</span>
                <span className="text-[9px] text-muted-foreground">{e.reviews.length}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ====================================================================== */
/* CENTER — module list + analysis output (DNA 6 layers + action buttons)  */
/* ====================================================================== */
function ModuleWorkspace({
  persona, apps,
}: {
  persona: Persona; apps: DatasetEntry[];
}) {
  const ai = useAISettings();
  const aiOn = isAIEnabled(ai);
  const [activeModuleId, setActiveModuleId] = useState<string>(persona.modules[0].id);
  const [outputs, setOutputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [followUp, setFollowUp] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  // Pipeline (run all) + synthesis compendium
  const [pipeline, setPipeline] = useState<{ label: string; done: number; total: number; running: boolean } | null>(null);
  const [view, setView] = useState<"modules" | "synthesis">("modules");

  // reset only the ACTIVE MODULE when persona changes — outputs persist per
  // persona key (${persona.id}:${module.id}) so cross-persona pipelines and the
  // compendium keep every generated decision cached.
  const personaId = persona.id;
  const [lastPersona, setLastPersona] = useState(personaId);
  if (lastPersona !== personaId) {
    setLastPersona(personaId);
    setActiveModuleId(persona.modules[0].id);
    setError("");
  }

  // Persistência: as decisões geradas por IA são salvas no aiOutputStore
  // (chave custom dc:<persona>:<modulo>|<escopo>) e reidratadas ao montar —
  // reload/restart/pull não apaga mais o que a IA gerou.
  const dcScope = apps.map((e) => `${e.app.store}:${e.app.id}`).sort().join(",");
  const dcKey = useCallback(
    (key: string) => `dc:${key}|${dcScope}`,
    [dcScope],
  );
  useEffect(() => {
    if (apps.length === 0) return;
    setOutputs((prev) => {
      const next = { ...prev };
      for (const p of PERSONAS) {
        for (const m of p.modules) {
          const key = outputKey(p.id, m.id);
          if (next[key]) continue;
          const rec = getAIOutput(dcKey(key));
          if (rec) next[key] = rec.markdown;
        }
      }
      if (!next[SYNTHESIS_KEY]) {
        const rec = getAIOutput(dcKey(SYNTHESIS_KEY));
        if (rec) next[SYNTHESIS_KEY] = rec.markdown;
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dcScope]);

  const activeModule = persona.modules.find((m) => m.id === activeModuleId) ?? persona.modules[0];
  const currentOutput = outputs[outputKey(persona.id, activeModule.id)] ?? "";
  const isLoading = loading === outputKey(persona.id, activeModule.id);
  const completedCount = useMemo(
    () => persona.modules.filter((m) => outputs[outputKey(persona.id, m.id)]?.trim()).length,
    [persona, outputs],
  );

  /** Runs ONE module for ANY persona (pipeline needs to iterate personas).
   *  `signal` lets the pipeline chain share an abortable controller. */
  const runModule = useCallback(async (targetPersona: Persona, mod: DecisionModule, extraPrompt?: string, opts?: { signal?: AbortSignal }) => {
    if (!aiOn || apps.length === 0) return;
    const key = outputKey(targetPersona.id, mod.id);
    setLoading(key); setError("");
    const ownAbort = opts?.signal ? null : new AbortController();
    if (ownAbort) abortRef.current = ownAbort;
    const signal = opts?.signal ?? ownAbort!.signal;
    setOutputs((prev) => ({ ...prev, [key]: "" }));
    const prior = outputs[key];
    const fullPrompt = extraPrompt ? `${mod.prompt}\n\n${extraPrompt}` : mod.prompt;
    const msgs: ChatMessage[] = [{ role: "user", content: fullPrompt }];
    // seed the conversation with prior analysis if challenging/why/action
    if (extraPrompt && prior) {
      msgs.unshift({ role: "assistant", content: prior });
    }
    await streamExperimentChat(apps, msgs, {
      onToken: (full) => setOutputs((prev) => ({ ...prev, [key]: full })),
      onDone: (full) => {
        setOutputs((prev) => ({ ...prev, [key]: full }));
        saveAIOutput("dc", apps.map((e) => `${e.app.store}:${e.app.id}`), full, undefined, dcKey(key));
      },
      onError: (e) => setError(e),
    }, signal, ai);
    setLoading(null);
  }, [aiOn, apps, ai, outputs, dcKey]);

  const runAction = useCallback((action: "why" | "challenge" | "action") => {
    const extra = action === "why" ? WHY_PROMPT : action === "challenge" ? CHALLENGE_PROMPT : ACTION_PROMPT;
    runModule(persona, activeModule, extra);
  }, [runModule, persona, activeModule]);

  /**
   * Pipeline sequencial via FILA GLOBAL de IA (iaRunner): continua rodando
   * mesmo se o usuário sair da página; recarregar a página pausa (a fila
   * persiste e pode ser retomada de onde parou ou recomeçada do zero pela
   * IAQueueBar). Um erro num módulo não derruba a fila. Cada decisão é
   * persistida via saveAIOutput (dcKey) — a página reidrata ao voltar.
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

  const runPipeline = useCallback((steps: PipelineStep[]) => {
    if (!aiOn || apps.length === 0 || steps.length === 0) return;
    const total = steps.length;
    const jobs: IAJob[] = steps.map((step, i) => ({
      id: `dc:${outputKey(step.persona.id, step.module.id)}`,
      label: stepProgress(step, i + 1, total),
      kind: "chat",
      prompt: step.module.prompt,
      saveAs: { section: "dc", key: dcKey(outputKey(step.persona.id, step.module.id)) },
      origin: "decision-center",
    }));
    const prevIds = new Set(jobs.map((j) => j.id));
    const allDone = jobs.length > 0 && jobs.every((j) => queue.results[j.id] === "done");
    const otherPending = queue.jobs.some(
      (j) => !prevIds.has(j.id) && queue.results[j.id] !== "done",
    );
    enqueueJobs(jobs, "replace");
    // Clique explícito com tudo concluído = recomeçar do zero; caso contrário
    // retoma de onde parou (resume). Outros jobs pendentes de outras páginas
    // não bloqueiam: enqueue "replace" substitui a fila (a fila é global e
    // mono-usuário — última intenção explícita vence).
    if (otherPending) {
      void startQueue();
    } else if (allDone) {
      restartQueue();
    } else {
      void startQueue();
    }
    setPipeline({ label: "Pipeline enfileirado…", done: 0, total, running: true });
  }, [aiOn, apps, queue.results, queue.jobs, dcKey]);

  /** Espelha o progresso da fila global no painel + outputs ao vivo. */
  useEffect(() => {
    const dcJobs = queue.jobs.filter((j) => j.origin === "decision-center");
    if (dcJobs.length === 0) return;
    const done = dcJobs.filter((j) => queue.results[j.id] === "done").length;
    const currentJob = queue.current >= 0 ? queue.jobs[queue.current] : undefined;
    const running = queue.status === "running" && !!currentJob && dcJobs.some((j) => j.id === currentJob.id);
    setPipeline({
      label: running && currentJob ? currentJob.label : queue.status === "done" ? `Pipeline concluído (${done}/${dcJobs.length}).` : queue.status === "paused" ? `Pausado (${done}/${dcJobs.length} geradas) — retome pela barra.` : `Fila pronta (${dcJobs.length} decisões).`,
      done,
      total: dcJobs.length,
      running: !!running,
    });
  }, [queue]);

  /** Streaming ao vivo dos jobs dc: → outputs do workspace. */
  useEffect(() => {
    return subscribeRunnerEvents((ev) => {
      const id = ev.jobId ?? "";
      if (!id.startsWith("dc:")) return;
      const key = id.slice(3);
      if (ev.type === "token" && ev.text != null) {
        setOutputs((prev) => ({ ...prev, [key]: ev.text! }));
      }
    });
  }, []);

  const cancelPipeline = useCallback(() => { pauseQueue(); abortRef.current?.abort(); }, []);

  /** Aggregates ALL personas × modules into a single markdown file (.md). */
  const exportCompendium = useCallback(() => {
    const md = buildCompendiumMarkdown(PERSONAS, outputs);
    downloadFile("compendio-decisao.md", md, "text/markdown");
  }, [outputs]);

  /* PDF do dataset de reviews (rota global de exportação). */
  const exportDatasetPDF = useCallback(() => {
    exportDatasetToPDF(apps);
  }, [apps]);

  /** Cross-persona executive synthesis: asks the IA to consolidate ALL
   *  generated decisions into a board-level summary. Stored under a special
   *  key (not counted in progress totals). */
  const runSynthesis = useCallback(async () => {
    if (!aiOn || apps.length === 0) return;
    setView("synthesis"); setError("");
    const ac = new AbortController(); abortRef.current = ac;
    const prompt = buildSynthesisPrompt(PERSONAS, outputs);
    let result = "";
    await streamExperimentChat(apps, [{ role: "user", content: prompt }], {
      onToken: (full) => setOutputs((prev) => ({ ...prev, [SYNTHESIS_KEY]: full })),
      onDone: (full) => { result = full; },
      onError: (e) => setError(e),
    }, ac.signal, ai);
    setOutputs((prev) => ({ ...prev, [SYNTHESIS_KEY]: result }));
    if (result.trim()) saveAIOutput("dc", apps.map((e) => `${e.app.store}:${e.app.id}`), result, undefined, dcKey(SYNTHESIS_KEY));
  }, [aiOn, apps, outputs, ai, dcKey]);

  /** Sub-resposta: aprofunda a análise atual com uma pergunta livre. A resposta
   *  é acumulada abaixo da análise anterior (separador + pergunta), e a IA
   *  recebe a análise anterior como contexto. */
  const runFollowUp = useCallback(async () => {
    const q = followUp.trim();
    if (!q || !aiOn || apps.length === 0) return;
    const key = `${persona.id}:${activeModule.id}`;
    const base = outputs[key] ?? "";
    setFollowUp("");
    setLoading(key); setError("");
    const ac = new AbortController(); abortRef.current = ac;
    const sep = `\n\n---\n\n**Pergunta:** ${q}\n\n`;
    setOutputs((prev) => ({ ...prev, [key]: `${base}${sep}` }));
    const msgs: ChatMessage[] = [
      ...(base ? [{ role: "assistant" as const, content: base }] : []),
      { role: "user", content: q },
    ];
    await streamExperimentChat(apps, msgs, {
      onToken: (full) => setOutputs((prev) => ({ ...prev, [key]: `${base}${sep}${full}` })),
      onDone: (full) => {
        const combined = `${base}${sep}${full}`;
        setOutputs((prev) => ({ ...prev, [key]: combined }));
        saveAIOutput("dc", apps.map((e) => `${e.app.store}:${e.app.id}`), combined, undefined, dcKey(key));
      },
      onError: (e) => setError(e),
    }, ac.signal, ai);
    setLoading(null);
  }, [followUp, aiOn, apps, persona.id, activeModule.id, outputs, ai, dcKey]);

  if (apps.length === 0)
    return <EmptyHint icon={Database}>Selecione apps (sidebar esquerda do app, aba Apps) para que a IA aplique a lente "{persona.label}" sobre seus reviews.</EmptyHint>;

  return (
    <div className="flex h-full">
      {/* module list */}
      <div className="w-56 shrink-0 border-r border-border/50 overflow-y-auto">
        {/* Pipeline toolbar (run all) */}
        <div className="px-2 py-2 border-b border-border/40 space-y-1.5">
          <div className="flex items-center gap-1">
            <button
              onClick={() => runPipeline(buildRunStepsFor(persona))}
              disabled={!aiOn || !!pipeline?.running}
              className="flex-1 inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors"
              title={`Executar todas as 10 decisões de ${persona.label} em sequência`}
              aria-label="Executar toda a persona"
            >
              <Play className="h-3 w-3" /> Toda persona
            </button>
            <button
              onClick={() => runPipeline(buildRunSteps(PERSONAS))}
              disabled={!aiOn || !!pipeline?.running}
              className="flex-1 inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1.5 rounded-md border border-primary/30 text-primary hover:bg-primary/10 disabled:opacity-50 transition-colors"
              title="Executar TODAS as personas × decisões (7 × 10 = 70 análises)"
              aria-label="Executar todas as personas"
            >
              <Layers className="h-3 w-3" /> Todas personas
            </button>
            <button
              onClick={runSynthesis}
              disabled={!aiOn || pipeline?.running || countCompleted(outputs) === 0}
              className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1.5 rounded-md border border-violet-500/40 text-violet-600 dark:text-violet-300 hover:bg-violet-500/10 disabled:opacity-50 transition-colors"
              title="Síntese executiva (IA): consolida todas as decisões geradas num resumo de conselho"
              aria-label="Síntese executiva"
            >
              <Sparkles className="h-3 w-3" /> Síntese
            </button>
            <button
              onClick={exportCompendium}
              disabled={countCompleted(outputs) === 0}
              className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md border border-border/60 hover:border-primary/40 disabled:opacity-50 transition-colors"
              title="Baixar compêndio (.md) com todas as decisões geradas"
              aria-label="Baixar compêndio"
            >
              <FileText className="h-3 w-3" />
            </button>
          </div>
          {pipeline && (
            <div className="flex items-center gap-1.5">
              {pipeline.running ? (
                <button onClick={cancelPipeline} className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors" aria-label="Parar pipeline">
                  <Square className="h-3 w-3" /> Parar
                </button>
              ) : null}
              <div className="flex-1 min-w-0">
                <p className="text-[9px] text-muted-foreground truncate">{pipeline.label}</p>
                <div className="h-1 rounded-full bg-muted overflow-hidden mt-0.5">
                  <div className="h-full bg-primary transition-all" style={{ width: `${Math.round((pipeline.done / Math.max(1, pipeline.total)) * 100)}%` }} />
                </div>
              </div>
            </div>
          )}
          <IAQueueBar origin="decision-center" />
          <p className="text-[9px] text-muted-foreground px-0.5">
            {countCompleted(outputs)}/{buildRunSteps(PERSONAS).length} decisões geradas no escopo (todas as personas).
          </p>
        </div>

        {/* Modules (persona atual) */}
        <div className="p-2 space-y-0.5">
          <div className="flex items-center justify-between px-1 py-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              {persona.label} · 10 decisões
            </p>
            <span className="text-[9px] font-medium text-muted-foreground">{completedCount}/10</span>
          </div>
          {persona.modules.map((m) => {
            const Icon = m.icon;
            const key = outputKey(persona.id, m.id);
            const has = !!outputs[key];
            const isActive = m.id === activeModuleId && view === "modules";
            const isLoadingM = loading === key;
            return (
              <button
                key={m.id}
                onClick={() => { setActiveModuleId(m.id); setView("modules"); }}
                className={cn(
                  "w-full flex items-start gap-2 rounded-md p-2 text-left transition-colors",
                  isActive ? "bg-primary/10 text-primary" : "hover:bg-secondary text-muted-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium truncate">{m.label}</p>
                  <p className="text-[9px] text-muted-foreground line-clamp-1">{m.question}</p>
                </div>
                {isLoadingM ? <Loader2 className="h-3 w-3 animate-spin shrink-0 mt-0.5" /> : has ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" /> : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* output */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center justify-between p-3 border-b border-border/40 shrink-0 gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold flex items-center gap-1.5">
              {view === "synthesis" ? (
                <Sparkles className="h-4 w-4 text-violet-500" />
              ) : (
                <activeModule.icon className="h-4 w-4 text-primary" />
              )}
              {view === "synthesis" ? "Síntese executiva (todas as personas)" : activeModule.label}
              {/* status do painel de resposta — sempre visível */}
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${isLoading ? "bg-status-running/10 text-status-running" : currentOutput || outputs[SYNTHESIS_KEY] ? "bg-status-success/10 text-status-success" : error ? "bg-status-error/10 text-status-error" : "bg-status-idle/10 text-muted-foreground"}`}>
                {isLoading ? "Gerando" : currentOutput || outputs[SYNTHESIS_KEY] ? "Pronto" : error ? "Erro" : "Parado"}
              </span>
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {view === "synthesis"
                ? "Consolidation of ALL generated decisions across the 7 personas (board-level view)"
                : activeModule.question}
            </p>
          </div>
          {view === "modules" && (
            <Button size="sm" onClick={() => runModule(persona, activeModule)} disabled={isLoading || !aiOn} className="gap-1.5 shrink-0">
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {isLoading ? "Gerando…" : currentOutput ? "Regenerar" : "Gerar análise"}
            </Button>
          )}
        </div>

        {/* DNA action buttons — only when module output exists (not in synthesis view) */}
        {view === "modules" && currentOutput && !isLoading && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border/40 bg-muted/20 shrink-0 flex-wrap">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium mr-1">Investigar:</span>
            <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] gap-1" onClick={() => runAction("why")} disabled={!!loading}>
              <HelpCircle className="h-3 w-3" /> Por quê?
            </Button>
            <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] gap-1" onClick={() => runAction("action")} disabled={!!loading}>
              <Wand2 className="h-3 w-3" /> O que fazer?
            </Button>
            <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] gap-1 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10" onClick={() => runAction("challenge")} disabled={!!loading}>
              <ShieldAlert className="h-3 w-3" /> Desafiar conclusão
            </Button>
            {/* compendium shortcut (shows here too after decisions exist) */}
            <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] gap-1" onClick={exportCompendium} disabled={countCompleted(outputs) === 0}>
              <FileText className="h-3 w-3" /> Compêndio (.md)
            </Button>
            {apps.length > 0 && (
              <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] gap-1" onClick={exportDatasetPDF} title="Exportar dataset como PDF (imprimir)" aria-label="Exportar dataset como PDF">
                <Printer className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 relative">
          {view === "synthesis" ? (
            outputs[SYNTHESIS_KEY] ? (
              <AIOutputCard
                bare
                title="Síntese executiva"
                content={outputs[SYNTHESIS_KEY]}
                filename="sintese-executiva"
                storageKey="decision:synthesis"
                onRegenerate={isLoading || !aiOn ? undefined : () => void runSynthesis()}
              />
            ) : (
              <EmptyHint icon={Sparkles}>Gerando a síntese executiva — a IA consolida todas as {countCompleted(outputs)} decisões geradas em um resumo de conselho.</EmptyHint>
            )
          ) : currentOutput ? (
            <div className="space-y-1">
              <AIOutputCard
                bare
                title={activeModule?.label ?? "Decisão"}
                content={currentOutput}
                filename={`decision-${persona.id}`}
                storageKey={`decision:${persona.id}:${activeModule?.id ?? "mod"}`}
                onRegenerate={isLoading || !activeModule ? undefined : () => void runModule(persona, activeModule)}
              />
              <AIEvaluationChip content={currentOutput} entries={apps} />
            </div>
          ) : isLoading ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> A IA está aplicando a lente "{persona.label}" sobre os reviews…</p>
            </div>
          ) : error ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : (
            !aiOn
              ? <AIDisabledNotice compact />
              : <EmptyHint icon={Wand2}>{`Clique em "Gerar análise" para a IA responder "${activeModule.question}" aplicando a lente ${persona.label}. A resposta terá 6 camadas: insight, quantificação, evidência, contexto, decisão e ação. Ou rode "Toda persona"/"Todas personas" no pipeline da esquerda.`}</EmptyHint>
          )}
        </div>

        {/* composer de sub-resposta — investigação incremental (só no módulo) */}
        {view === "modules" && currentOutput && (
          <form
            onSubmit={(e) => { e.preventDefault(); runFollowUp(); }}
            className="flex items-center gap-1.5 px-3 py-2 border-t border-border/40 bg-muted/20 shrink-0"
          >
            <MessageSquarePlus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
              placeholder={isLoading ? "Gerando… aguarde para aprofundar" : "Pergunta de acompanhamento — gera uma sub-resposta com a análise atual como contexto"}
              disabled={isLoading || !aiOn}
              aria-label="Pergunta de acompanhamento"
              className="flex-1 bg-transparent text-[11px] outline-none placeholder:text-muted-foreground/60 disabled:opacity-50"
            />
            <Button type="submit" size="icon" variant="ghost" disabled={isLoading || !followUp.trim() || !aiOn} className="h-7 w-7" title="Gerar sub-resposta" aria-label="Gerar sub-resposta">
              <Send className="h-3.5 w-3.5" />
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

/* ====================================================================== */
/* RIGHT SIDEBAR — AI Copilot contextual                                   */
/* ====================================================================== */
function CopilotSidebar({
  persona, apps,
}: {
  persona: Persona; apps: DatasetEntry[];
}) {
  const reviews = useMemo(() => apps.flatMap((e) => e.reviews), [apps]);
  const ai = useAISettings();
  const aiOn = isAIEnabled(ai);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const suggestions = useMemo(() => personaChatSuggestions(persona.id), [persona.id]);

  // reset conversation when persona changes
  const personaId = persona.id;
  const [lastPersona, setLastPersona] = useState(personaId);
  if (lastPersona !== personaId) {
    setLastPersona(personaId);
    setMessages([]);
    setInput("");
  }

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading || apps.length === 0 || !aiOn) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput(""); setLoading(true);
    const ac = new AbortController(); abortRef.current = ac;
    // System context: the copilot knows persona, apps, reviews count, and the
    // analyses already produced in the workspace (passed via the conversation
    // by the user referring to them; the analysis output is in the DOM).
    const contextPrefix = `Contexto: persona ${persona.label} (${persona.centralQuestion}). ${apps.length} app(s), ${reviews.length} reviews coletados. Responda sempre com evidência real dos reviews e seja honesto sobre confiança.`;
    const msgs: ChatMessage[] = [
      { role: "user", content: `${contextPrefix}\n\n${text}` },
    ];
    await streamExperimentChat(apps, msgs, {
      onToken: (full) => setMessages((prev) => { const c = [...prev]; c[c.length - 1] = { role: "assistant", content: full }; return c; }),
      onDone: (full) => setMessages((prev) => { const c = [...prev]; c[c.length - 1] = { role: "assistant", content: full }; return c; }),
      onError: (e) => setMessages((prev) => { const c = [...prev]; c[c.length - 1] = { role: "assistant", content: `⚠️ ${e}` }; return c; }),
    }, ac.signal, ai);
    setLoading(false);
  }, [messages, loading, apps, aiOn, ai, persona, reviews]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-border/40 flex items-center gap-1.5">
        <BrainCircuit className="h-3.5 w-3.5 text-primary" />
        <p className="text-xs font-semibold">AI Copilot</p>
      </div>

      {/* context strip */}
      <div className="px-3 py-1.5 border-b border-border/40 bg-muted/20">
        <p className="text-[9px] text-muted-foreground">
          <span className="font-medium text-foreground">{persona.label}</span> · {persona.centralQuestion}
        </p>
        <p className="text-[9px] text-muted-foreground">{apps.length} apps · {reviews.length} reviews</p>
      </div>

      {/* messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-6 space-y-3">
            <Wand2 className="h-6 w-6 text-muted-foreground/40 mx-auto" />
            <p className="text-[11px] text-muted-foreground">
              {apps.length === 0 ? "Selecione apps para conversar." : !aiOn ? "Ative a IA em Configurações." : "Pergunte sobre os dados, as análises geradas, ou use uma sugestão abaixo."}
            </p>
            {aiOn && apps.length > 0 && (
              <div className="space-y-1.5 text-left">
                {suggestions.map((s) => (
                  <button key={s} onClick={() => send(s)} disabled={loading} className="w-full text-left text-[10px] rounded-md border border-border/40 p-2 hover:bg-secondary transition-colors disabled:opacity-50">
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={cn("rounded-lg p-2.5 text-[11px] leading-relaxed", m.role === "user" ? "bg-primary/10 ml-4" : "bg-muted/40 mr-4")}>
              {m.role === "assistant" && m.content ? (
                <AIOutputCard bare content={m.content} filename={`decision-copilot-${i}`} storageKey={`decision-copilot-${i}`} />
              ) : m.role === "assistant" && loading && i === messages.length - 1 ? (
                <span className="flex items-center gap-1.5 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> pensando…</span>
              ) : (
                m.content
              )}
            </div>
          ))
        )}
      </div>

      {/* composer */}
      <div className="p-2 border-t border-border/40">
        <div className="flex gap-1.5">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send(input))}
            placeholder={aiOn ? apps.length > 0 ? "Pergunte sobre os dados…" : "Selecione apps primeiro" : "IA desativada"}
            disabled={!aiOn || apps.length === 0 || loading}
            className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] disabled:opacity-50"
          />
          <Button size="sm" className="h-7 w-7 p-0" onClick={() => send(input)} disabled={!aiOn || apps.length === 0 || loading || !input.trim()}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </div>
        {!aiOn && <p className="text-[9px] text-muted-foreground mt-1">Ative a IA em Configurações → Inteligência Artificial.</p>}
      </div>
    </div>
  );
}

/* ====================================================================== */
/* PAGE                                                                   */
/* ====================================================================== */
export default function DecisionCenter({ embedded = false }: { embedded?: boolean }) {
  const { setPickerOpen } = useCompare();
  const dataset = useDataset();
  const { selected } = useSelection();
  const [persona, setPersona] = useState<Persona>(PERSONAS[0]);

  const activeApps = useMemo(() => {
    if (dataset.length === 0) return [];
    if (selected.size === 0) return dataset;
    return dataset.filter((e) => selected.has(`${e.app.store}:${e.app.id}`));
  }, [dataset, selected]);

  const reviews = useMemo(() => activeApps.flatMap((e) => e.reviews), [activeApps]);

  // F1: Export decision report; F2: Print; F3: Keyboard shortcut
  const exportReport = useCallback(() => {
    const kpis = computeKPIs(reviews, activeApps);
    const sentiment = computeSentiment(reviews);
    const data = JSON.stringify({
      persona: persona.label,
      apps: activeApps.map((e) => ({ name: e.app.name, store: e.app.store, reviews: e.reviews.length })),
      kpis, sentiment,
      exportedAt: new Date().toISOString(),
    }, null, 2);
    downloadFile(`decision-report-${persona.id}.json`, data, "application/json");
  }, [persona, activeApps, reviews]);

  useHotkey("p", () => window.print(), []);

  return (
    <div className="h-full flex bg-background">
      {/* LEFT — personas (sidebar interna da página) */}
      <PageSidebar
        meta={{
          id: "decision-personas", side: "left",
          title: "Personas", subtitle: "lente de decisão",
          icon: <BrainCircuit className="h-4 w-4" />,
          storageKey: "aso:decision-left-w", defaultWidth: 256,
          railIcons: <BrainCircuit className="h-4 w-4" aria-hidden />,
        }}
      >
        <PersonaSelector persona={persona} onSelect={setPersona} apps={activeApps} reviews={reviews} />
      </PageSidebar>

      {/* CENTER — modules + analysis */}
      <div className="flex-1 min-w-0 flex flex-col">
        {!embedded && (
        <AppHeader
          title="AI Decision Center"
          crumb={`${persona.label} · ${activeApps.length} app(s) · ${reviews.length} reviews`}
          compare={{ count: 0, onOpen: () => setPickerOpen(true) }}
          extraMenu={
            <div className="flex items-center gap-1.5 w-full justify-center py-1">
              <button
                onClick={exportReport}
                disabled={activeApps.length === 0}
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border/60 bg-card/60 hover:border-primary/50 disabled:opacity-50 transition-colors"
                aria-label="Exportar relatório de decisão"
              >
                <Download className="h-3.5 w-3.5" /> Exportar relatório
              </button>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-border/60 bg-card/60 hover:border-primary/50 transition-colors"
                aria-label="Imprimir"
                title="Imprimir (atalho: P)"
              >
                <Printer className="h-3.5 w-3.5" />
              </button>
            </div>
          }
        />
        )}
        <div className="flex-1 min-h-0">
          <ModuleWorkspace persona={persona} apps={activeApps} />
        </div>
      </div>

      {/* RIGHT — copiloto (sidebar interna da página) */}
      <PageSidebar
        meta={{
          id: "decision-copilot", side: "right",
          title: "Copiloto", subtitle: "IA contextual por persona",
          icon: <Sparkles className="h-4 w-4" />,
          storageKey: "aso:decision-right-w", defaultWidth: 320,
          railIcons: <Sparkles className="h-4 w-4" aria-hidden />,
        }}
      >
        <SidebarToolTabs
          toolLabel="Copiloto"
          toolIcon={<Sparkles className="h-3 w-3" />}
          help={{
            description: "O Decision Center transforma análises em decisões por persona: a mesma realidade (mesmos reviews) vista por 7 lentes — CEO, CPO, PM, UX, Engenharia, Marketing e Competitiva.",
            tips: ["Troque de persona sem trocar os dados — a IA reaplica a lente.", "Cada decisão segue o DNA de 6 camadas com evidência real.", "Use 'Por quê?', 'Desafiar' e 'O que fazer?' para aprofundar."],
          }}
        >
          <CopilotSidebar persona={persona} apps={activeApps} />
        </SidebarToolTabs>
      </PageSidebar>
    </div>
  );
}
