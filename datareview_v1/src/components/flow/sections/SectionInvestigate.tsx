/**
 * Seção 07 — Investigar: a superfície de IA da jornada. Duas formas reais de
 * investigação: (a) seções de análise do Experimentos e (b) módulos do
 * Analysis Atlas — ambos executam via experiment-analyze com streaming.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Loader2, Play, Square, BrainCircuit, Search as SearchIcon, Check, BookOpen,
  FlaskConical, BookOpenCheck, MessageSquare,
} from "lucide-react";
import { Panel } from "@/components/Panel";
import { FlowEmbed } from "@/components/flow/FlowEmbed";
import { useFlowScope } from "@/components/flow/useFlowScope";
import { useAISettings, isAIEnabled } from "@/lib/aiSettings";
import { streamExperiment } from "@/lib/experimentApi";
import { streamExperimentChat } from "@/lib/experimentChatApi";
import {
  enqueueJobs, startQueue, pauseQueue, useIAQueue, subscribeRunnerEvents,
  type IAJob,
} from "@/lib/iaRunner";
import { IAQueueBar } from "@/components/shared/IAQueueBar";
import { getAIOutputFor } from "@/lib/aiOutputStore";
import { EXPERIMENT_SECTIONS } from "@/lib/experimentSections";
import { ANALYSIS_MODULES, searchModules } from "@/lib/analysisAtlas/registry";
import type { AnalysisModule } from "@/lib/analysisAtlas/types";
import { isAIModule } from "@/lib/analysisAtlas/canvasBridge";
import { AIOutputCard } from "@/components/shared/AIOutputCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils";
import { AIDisabledEmptyState } from "@/components/shared/AIDisabledNotice";

const AI_SECTIONS = EXPERIMENT_SECTIONS.filter((s) => s.kind === "ai");
const RUNNABLE_MODULES = ANALYSIS_MODULES.filter(isAIModule);

type RunState = "idle" | "running" | "done" | "error";

export function SectionInvestigate() {
  const { scoped } = useFlowScope();
  const ai = useAISettings();
  const [tab, setTab] = useState<"sections" | "atlas">("sections");
  const [picked, setPicked] = useState<Set<string>>(new Set(["summary", "problems", "opportunities"]));
  const [outputs, setOutputs] = useState<Record<string, string>>({});
  const [states, setStates] = useState<Record<string, RunState>>({});
  const [query, setQuery] = useState("");
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const queue = useIAQueue();

  const aiOk = isAIEnabled(ai);

  const results = useMemo(
    () => (query.trim() ? searchModules(query) : RUNNABLE_MODULES.slice(0, 12)),
    [query],
  );

  const appKeys = useMemo(() => scoped.map((e) => `${e.app.store}:${e.app.id}`), [scoped]);

  /**
   * Streaming da fila global → estados locais. O runner é module-level: se o
   * usuário navegar para outra página, os jobs continuam (e os outputs já
   * persistidos via saveAIOutput em streamExperiment). Ao remontar, o efeito
   * abaixo reidrata os outputs concluídos.
   */
  useEffect(() => {
    return subscribeRunnerEvents((ev) => {
      const id = ev.jobId ?? "";
      if (!id.startsWith("inv:")) return;
      const secId = id.slice(4);
      if (ev.type === "token" && ev.text != null) {
        setStates((s) => ({ ...s, [secId]: "running" }));
        setOutputs((o) => ({ ...o, [secId]: ev.text! }));
      } else if (ev.type === "done") {
        setStates((s) => ({ ...s, [secId]: "done" }));
      } else if (ev.type === "error") {
        setStates((s) => ({ ...s, [secId]: "error" }));
      }
    });
  }, []);

  /** backgroundRuns OFF → pausa a fila ao sair da página (default ON: continua). */
  useEffect(() => {
    return () => {
      if (ai.backgroundRuns === false) pauseQueue();
    };
  }, [ai.backgroundRuns]);

  /** Reidrata outputs já gerados (ex.: após navegar/recarregar). */
  useEffect(() => {
    if (appKeys.length === 0) return;
    const nextOut: Record<string, string> = {};
    const nextSt: Record<string, RunState> = {};
    for (const sec of AI_SECTIONS) {
      const rec = getAIOutputFor(sec.id, appKeys);
      if (rec?.markdown?.trim()) {
        nextOut[sec.id] = rec.markdown;
        nextSt[sec.id] = "done";
      }
    }
    setOutputs((o) => ({ ...nextOut, ...o }));
    setStates((s) => ({ ...nextSt, ...s }));
  }, [appKeys]);

  /** Estados derivados da fila (sobrevivem a navegação). */
  useEffect(() => {
    setStates((s) => {
      const next = { ...s };
      for (const job of queue.jobs) {
        if (!job.id.startsWith("inv:")) continue;
        const r = queue.results[job.id];
        const secId = job.id.slice(4);
        if (r === "running") next[secId] = "running";
        else if (r === "done") next[secId] = "done";
        else if (r === "error") next[secId] = "error";
      }
      return next;
    });
  }, [queue]);

  if (scoped.length === 0) {
    return (
      <EmptyState
        icon={BrainCircuit}
        title="Sem dados para a IA investigar"
        description="Colete apps para rodar seções de análise e módulos do Atlas aqui."
      />
    );
  }

  if (!aiOk) {
    return (
<AIDisabledEmptyState />
    );
  }

  const stop = () => {
    abortRef.current?.abort();
    setRunning(false);
  };

  /**
   * Pipeline completo das seções escolhidas via fila global de IA: continua
   * rodando ao navegar, pausa pela barra, retoma de onde parou (jobs done
   * são pulados) e pode recomeçar do zero.
   */
  const runSections = () => {
    const jobs: IAJob[] = AI_SECTIONS.filter((sec) => picked.has(sec.id)).map((sec) => ({
      id: `inv:${sec.id}`,
      label: `Análise: ${sec.label}`,
      kind: "section",
      section: sec.id,
      origin: "investigar",
    }));
    if (jobs.length === 0) return;
    enqueueJobs(jobs, "replace");
    void startQueue();
  };

  /** Execução independente de UMA seção (component-scoped, direto). */
  const runSingleSection = async (sectionId: string) => {
    setRunning(true);
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;
    setStates((s) => ({ ...s, [sectionId]: "running" }));
    setOutputs((o) => ({ ...o, [sectionId]: "" }));
    await streamExperiment(sectionId, scoped, {
      onToken: (full) => setOutputs((o) => ({ ...o, [sectionId]: full })),
      onDone: (full) => {
        setOutputs((o) => ({ ...o, [sectionId]: full }));
        setStates((s) => ({ ...s, [sectionId]: "done" }));
      },
      onError: () => setStates((s) => ({ ...s, [sectionId]: "error" })),
    }, signal, ai).catch(() => {});
    setRunning(false);
  };

  const runModule = async (mod: AnalysisModule) => {
    setRunning(true);
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;
    const key = `atlas:${mod.id}`;
    setStates((s) => ({ ...s, [key]: "running" }));
    setOutputs((o) => ({ ...o, [key]: "" }));
    const handlers = {
      onToken: (full: string) => setOutputs((o) => ({ ...o, [key]: full })),
      onDone: (full: string) => {
        setOutputs((o) => ({ ...o, [key]: full }));
        setStates((s) => ({ ...s, [key]: "done" }));
      },
      onError: () => setStates((s) => ({ ...s, [key]: "error" })),
    };
    try {
      if (mod.canvas.section) {
        await streamExperiment(mod.canvas.section, scoped, handlers, signal, ai);
      } else {
        await streamExperimentChat(
          scoped,
          [{ role: "user", content: mod.canvas.promptSeed ?? mod.description }],
          handlers,
          signal,
          ai,
        );
      }
    } catch {
      /* streamed error já tratado */
    }
    setRunning(false);
  };

  const togglePick = (id: string) => {
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const pickAll = () => setPicked(new Set(AI_SECTIONS.map((sec) => sec.id)));
  const pickNone = () => setPicked(new Set());

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-border/40 pb-2" role="tablist" aria-label="Modo de investigação">
        <button
          role="tab"
          aria-selected={tab === "sections"}
          onClick={() => setTab("sections")}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium",
            tab === "sections" ? "bg-primary text-primary-foreground" : "hover:bg-secondary",
          )}
        >
          Seções de análise
        </button>
        <button
          role="tab"
          aria-selected={tab === "atlas"}
          onClick={() => setTab("atlas")}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium",
            tab === "atlas" ? "bg-primary text-primary-foreground" : "hover:bg-secondary",
          )}
        >
          Catálogo Atlas
        </button>
        <span className="flex-1" />
        {running ? (
          <button onClick={stop} className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-[11px] hover:bg-secondary">
            <Square className="h-3 w-3" aria-hidden /> Parar
          </button>
        ) : tab === "sections" ? (
          <button
            onClick={runSections}
            disabled={picked.size === 0}
            title="Executa as seções selecionadas em sequência (fila global — continua mesmo se você sair da página)"
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-[11px] font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Play className="h-3 w-3" aria-hidden /> Executar pipeline ({picked.size})
          </button>
        ) : null}
      </div>

      {/* Controles da fila global: pausar / retomar de onde parou / recomeçar */}
      <IAQueueBar origin="investigar" />

      {tab === "sections" ? (
        <div className="space-y-3">
          {/* Toda lista selecionável tem "Todas"/"Nenhuma" (padrão do sistema). */}
          <div className="mb-2 flex items-center gap-2 text-[10px]" role="group" aria-label="Seleção de seções em massa">
            <span className="text-muted-foreground">{picked.size}/{AI_SECTIONS.length} seções</span>
            <button type="button" onClick={pickAll} disabled={picked.size === AI_SECTIONS.length} className="text-primary hover:underline disabled:opacity-40">Todas</button>
            <button type="button" onClick={pickNone} disabled={picked.size === 0} className="text-primary hover:underline disabled:opacity-40">Nenhuma</button>
          </div>
          <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3" aria-label="Seções de análise">
            {AI_SECTIONS.map((sec) => {
              const on = picked.has(sec.id);
              const st = states[sec.id];
              const Icon = sec.icon;
              return (
                <li key={sec.id}>
                  <button
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => togglePick(sec.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left",
                      on ? "border-primary/50 bg-primary/5" : "border-border/60 bg-background/60 hover:border-primary/30",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                    <span className="flex-1 truncate text-xs font-medium">{sec.label}</span>
                    {st === "running" && <Loader2 className="h-3.5 w-3.5 animate-spin text-status-info" aria-hidden />}
                    {st === "done" && <Check className="h-3.5 w-3.5 text-status-success" aria-hidden />}
                  </button>
                  <button
                    onClick={() => runSingleSection(sec.id)}
                    disabled={running || queue.status === "running"}
                    aria-label={`Executar só ${sec.label}`}
                    title="Executar esta análise independentemente"
                    className="mt-1 inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
                  >
                    <Play className="h-2.5 w-2.5" aria-hidden /> Só esta
                  </button>
                </li>
              );
            })}
          </ul>
          {Object.entries(outputs).filter(([k]) => !k.startsWith("atlas:")).map(([k, text]) =>
            text ? (
              <div key={k} className="relative rounded-lg border border-border/60 bg-background/60 p-3">
                <p className="mb-2 pr-16 text-xs font-semibold text-muted-foreground">
                  {AI_SECTIONS.find((s) => s.id === k)?.label ?? k}
                </p>
                <AIOutputCard
                  bare
                  content={text}
                  filename={`analise-${k}`}
                  storageKey={`flow-investigar-${k}`}
                  onRegenerate={running ? undefined : () => runSingleSection(k)}
                />
              </div>
            ) : null,
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar módulo do Atlas (ex.: regressão, keywords, cohort…) "
              aria-label="Buscar módulo do Atlas"
              className="w-full rounded-lg border border-border/60 bg-secondary/50 py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <p className="text-[11px] text-muted-foreground" role="status">
            {results.length} módulo(s) executável(is) por IA de {RUNNABLE_MODULES.length} no Atlas.
          </p>
          <ul className="grid gap-2 sm:grid-cols-2" aria-label="Módulos do Atlas">
            {results.map((mod) => {
              const key = `atlas:${mod.id}`;
              const st = states[key];
              const Icon = mod.icon;
              return (
                <li key={mod.id} className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-background/60 p-2.5">
                  <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{mod.label}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{mod.tagline}</p>
                  </div>
                  <button
                    onClick={() => runModule(mod)}
                    disabled={running}
                    aria-label={`Executar ${mod.label}`}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-[11px] hover:bg-secondary disabled:opacity-50"
                  >
                    {st === "running" ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <Play className="h-3 w-3" aria-hidden />}
                    Executar
                  </button>
                </li>
              );
            })}
          </ul>
          {Object.entries(outputs).filter(([k]) => k.startsWith("atlas:")).map(([k, text]) =>
            text ? (
              <div key={k} className="relative rounded-lg border border-border/60 bg-background/60 p-3">
                <p className="mb-2 pr-16 text-xs font-semibold text-muted-foreground">
                  {ANALYSIS_MODULES.find((m) => `atlas:${m.id}` === k)?.label ?? k}
                </p>
                <AIOutputCard
                  bare
                  content={text}
                  filename={k.replace("atlas:", "atlas-")}
                  storageKey={`flow-investigar-${k}`}
                  onRegenerate={running ? undefined : () => {
                    const mod = ANALYSIS_MODULES.find((m) => `atlas:${m.id}` === k);
                    if (mod) void runModule(mod);
                  }}
                />
              </div>
            ) : null,
          )}
        </div>
      )}

      <Panel
        title="Analysis Atlas completo"
        subtitle="A página Atlas inteira: árvore dos 60+ módulos com contratos (input → output → evidência → score), composição de pipeline e envio ao Canvas — sem sair do Fluxo."
        icon={<BookOpen className="h-4 w-4 text-primary" />}
        defaultOpen={false}
        storageKey="aso:flow-atlas"
      >
        <FlowEmbed page="atlas" />
        <Link to="/atlas" className="mt-2 inline-block text-[11px] text-primary hover:underline">
          Abrir página dedicada ↗
        </Link>
      </Panel>

      <Panel
        title="Experimentos completos"
        subtitle="A página Experimentos inteira: as 12 seções de IA sobre o dataset com streaming, histórico e exportações — sem sair do Fluxo."
        icon={<FlaskConical className="h-4 w-4 text-primary" />}
        defaultOpen={false}
        storageKey="aso:flow-experiments"
      >
        <FlowEmbed page="experiments" />
        <Link to="/experiments" className="mt-2 inline-block text-[11px] text-primary hover:underline">
          Abrir página dedicada ↗
        </Link>
      </Panel>

      <Panel
        title="Metodologias completas"
        subtitle="A página Metodologias inteira: catálogo de métodos de pesquisa/análise e pipelines de IA prontos — sem sair do Fluxo."
        icon={<BookOpenCheck className="h-4 w-4 text-primary" />}
        defaultOpen={false}
        storageKey="aso:flow-metodologias"
      >
        <FlowEmbed page="metodologias" />
        <Link to="/metodologias" className="mt-2 inline-block text-[11px] text-primary hover:underline">
          Abrir página dedicada ↗
        </Link>
      </Panel>

      <Panel
        title="Chat de investigação"
        subtitle="A página Chat inteira: análise conversacional com IA sobre os apps selecionados, com histórico de sessões — sem sair do Fluxo."
        icon={<MessageSquare className="h-4 w-4 text-primary" />}
        defaultOpen={false}
        storageKey="aso:flow-chat"
      >
        <FlowEmbed page="chat" />
        <Link to="/chat" className="mt-2 inline-block text-[11px] text-primary hover:underline">
          Abrir página dedicada ↗
        </Link>
      </Panel>
    </div>
  );
}
