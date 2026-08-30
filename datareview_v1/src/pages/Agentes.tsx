import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { Play, Square, PlusCircle, CheckCircle2, Loader2, AlertCircle, Trash2, ChevronDown, ChevronRight, ShoppingCart } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { ErrorBoundary } from "@/components/dashboard/ErrorBoundary";
import { AIOutputCard } from "@/components/shared/AIOutputCard";
import {
  listAllAgents, listCustomAgents, saveCustomAgent, deleteCustomAgent, restoreCustomAgent,
  type GeneratorAgent, type AgentStep, BUILTIN_SEGMENTS,
} from "@/lib/agents";
import { useDestructiveAction } from "@/hooks/useUx";
import { runAgent, type StepState } from "@/lib/agentRunner";
import { useDataset } from "@/hooks/useDataset";
import { useSelection, entryKey } from "@/context/SelectionContext";
import { useAISettings, isAIEnabled } from "@/lib/aiSettings";
import type { DatasetEntry } from "@/lib/datasetStore";
import { AIDisabledNotice } from "@/components/shared/AIDisabledNotice";

/** Página Agentes: agentes por segmento com pipelines de trabalho executáveis. */
export default function Agentes({ embedded = false }: { embedded?: boolean }) {
  const { entries: dataset } = useDataset();
  const { selected } = useSelection();
  const ai = useAISettings();

  const entries: DatasetEntry[] = useMemo(() => {
    if (selected.size === 0) return dataset;
    const filtered = dataset.filter((e) => selected.has(entryKey(e.app.store, e.app.id)));
    return filtered.length > 0 ? filtered : dataset;
  }, [dataset, selected]);

  const [agents, setAgents] = useState<GeneratorAgent[]>(() => listAllAgents());
  const [activeId, setActiveId] = useState<string>(agents[0]?.id ?? "");
  const [customCount, setCustomCount] = useState(listCustomAgents().length);
  const destroy = useDestructiveAction();

  const active = agents.find((a) => a.id === activeId);
  const totalReviews = entries.reduce((s, e) => s + e.reviews.length, 0);

  const refresh = () => {
    const list = listAllAgents();
    setAgents(list);
    setCustomCount(listCustomAgents().length);
    if (!list.some((a) => a.id === activeId)) setActiveId(list[0]?.id ?? "");
  };

  return (
    <div className="min-h-0 flex flex-col h-full">
      {!embedded && <AppHeader title="Agentes" crumb={`${agents.length} agentes · ${entries.length} apps em escopo`} />}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="content-fluid py-4 space-y-4">
          {/* intro */}
          <div className="rounded-xl border border-border/50 bg-card p-4">
            <p className="text-sm font-semibold text-foreground">Agentes por segmento com pipelines de trabalho</p>
            <p className="text-xs text-muted-foreground leading-relaxed mt-1">
              Cada agente declara quem é (segmento) e o que faz (sequência de etapas analíticas).
              Execute o pipeline completo e veja status por etapa — sempre sabendo o que está rodando.
              O escopo usa a seleção global de apps ({selected.size === 0 ? "todos" : `${selected.size} selecionado(s)`}).
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            {/* lista de agentes */}
            <div className="space-y-1.5">
              {agents.map((a) => (
                <div
                  key={a.id}
                  role="button"
                  tabIndex={0}
                  aria-current={a.id === activeId}
                  onClick={() => setActiveId(a.id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActiveId(a.id); } }}
                  className={`w-full text-left p-2.5 rounded-lg border transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-primary/60 focus:outline-none ${a.id === activeId ? "border-primary/50 bg-primary/5" : "border-border/50 bg-card hover:border-primary/30"}`}
                >
                  <div className="flex items-center gap-2">
                    <a.icon className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
                    <span className="text-[12px] font-medium text-foreground truncate flex-1">{a.label}</span>
                    {!a.builtin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          destroy({
                            confirm: `Excluir o agente "${a.label}"?`,
                            detail: "Agente customizado. Você poderá desfazer.",
                            toast: `Agente "${a.label}" excluído`,
                            action: () => {
                              const backup = a;
                              deleteCustomAgent(a.id);
                              refresh();
                              return () => { restoreCustomAgent(backup); refresh(); };
                            },
                          });
                        }}
                        className="text-muted-foreground hover:text-destructive"
                        title="Excluir agente customizado"
                        aria-label={`Excluir agente ${a.label}`}
                      >
                        <Trash2 className="h-3 w-3" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{a.tagline}</p>
                  <p className="text-[9px] text-muted-foreground/70 mt-1">{a.pipeline.length} etapas</p>
                </div>
              ))}
              <AddCustomAgent onCreated={refresh} />
            </div>

            {/* detalhe */}
            <ErrorBoundary>
              {active ? (
                <AgentDetail
                  key={active.id}
                  agent={active}
                  entries={entries}
                  totalReviews={totalReviews}
                  aiEnabled={isAIEnabled(ai)}
                />
              ) : (
                <p className="text-sm text-muted-foreground p-4">Selecione um agente.</p>
              )}
            </ErrorBoundary>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ detalhe */

function AgentDetail({ agent, entries, totalReviews, aiEnabled }: {
  agent: GeneratorAgent;
  entries: DatasetEntry[];
  totalReviews: number;
  aiEnabled: boolean;
}) {
  const [steps, setSteps] = useState<StepState[]>(() => agent.pipeline.map(() => ({ status: "pending", output: "" })));
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(() => {
    if (running || entries.length === 0) return;
    const ac = new AbortController();
    abortRef.current = ac;
    setRunning(true);
    setSteps(agent.pipeline.map(() => ({ status: "pending", output: "" })));
    runAgent(agent, entries, {
      onStep: (idx, state) => setSteps((prev) => prev.map((p, i) => (i === idx ? state : p))),
      onDone: () => setRunning(false),
      onError: () => setRunning(false),
    }, { signal: ac.signal });
  }, [agent, entries, running]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setRunning(false);
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  const doneCount = steps.filter((s) => s.status === "done").length;

  return (
    <div className="rounded-xl border border-border/50 bg-card">
      {/* header do agente */}
      <div className="p-4 border-b border-border/50">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <agent.icon className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">{agent.label}</h2>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">{agent.segment}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{agent.description}</p>
            <p className="text-[10px] text-muted-foreground/70 mt-1">
              Escopo: {entries.length} app(s) · {totalReviews.toLocaleString("pt-BR")} reviews
            </p>
          </div>
          {running ? (
            <button onClick={stop} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] bg-status-error/10 text-status-error hover:bg-status-error/20">
              <Square className="h-3 w-3" /> Parar
            </button>
          ) : (
            <button
              onClick={run}
              disabled={!aiEnabled || entries.length === 0}
              title={
                !aiEnabled
                  ? "IA desativada — ative em Configurações → Inteligência Artificial"
                                      : entries.length === 0
                    ? "Colete apps primeiro para executar"
                    : "Executar todas as etapas em sequência"
              }
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="h-3 w-3" /> Executar pipeline
            </button>
          )}
        </div>
{!aiEnabled && <AIDisabledNotice compact className="mt-2" />}
        {running && (
          <div
            className="mt-2 h-1 rounded-full bg-muted overflow-hidden"
            role="progressbar"
            aria-valuenow={Math.round((doneCount / agent.pipeline.length) * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progresso do pipeline: ${doneCount} de ${agent.pipeline.length} etapas`}
          >
            <div className="h-full bg-status-running rounded-full transition-all" style={{ width: `${(doneCount / agent.pipeline.length) * 100}%` }} />
          </div>
        )}
      </div>

      {/* etapas */}
      <div className="p-3 space-y-2">
        {agent.pipeline.map((step, i) => (
          <StepPanel key={i} index={i} step={step} state={steps[i]} />
        ))}
      </div>
    </div>
  );
}

function StepPanel({ index, step, state }: { index: number; step: AgentStep; state: StepState }) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    if (state.status === "done" && !seen) {
      setOpen(false);
      setSeen(true);
    }
  }, [state.status, seen]);

  return (
    <div className={`rounded-lg border anim-fade-in ${state.status === "running" ? "border-status-running/40 bg-status-running/5" : state.status === "error" ? "border-status-error/40" : state.status === "done" ? "border-status-success/30" : "border-border/50"}`}>
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-2 px-3 py-2 text-left" aria-expanded={open}>
        <StatusIcon status={state.status} />
        <span className="text-[11px] font-medium text-foreground">
          {index + 1}. {step.label}
        </span>
        <span className={`text-[9px] ${state.status === "running" ? "text-status-running" : state.status === "done" ? "text-status-success" : state.status === "error" ? "text-status-error" : "text-muted-foreground/70"}`}>
          {state.status === "pending" ? "Pendente" : state.status === "running" ? "Gerando…" : state.status === "done" ? "Concluído" : "Erro"}
        </span>
        <div className="flex-1" />
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {(open || state.status === "running") && state.output && (
        <div className="px-3 pb-3 border-t border-border/40">
          <AIOutputCard bare content={state.output} filename={`agente-${step.section}`} streaming={state.status === "running"} storageKey={`agente-step-${step.section}-${index}`} />
        </div>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: StepState["status"] }) {
  if (status === "running") return <Loader2 className="h-3.5 w-3.5 text-status-running animate-spin shrink-0" aria-hidden="true" />;
  if (status === "done") return <CheckCircle2 className="h-3.5 w-3.5 text-status-success shrink-0" aria-hidden="true" />;
  if (status === "error") return <AlertCircle className="h-3.5 w-3.5 text-status-error shrink-0" aria-hidden="true" />;
  return <Play className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" aria-hidden="true" />;
}

/* ----------------------------------------------------------- custom agent */

function AddCustomAgent({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [segment, setSegment] = useState<string>("produto");
  const [prompt, setPrompt] = useState("");

  const create = () => {
    if (!label.trim() || !prompt.trim()) return;
    const agent = saveCustomAgent({
      label: label.trim(),
      segment,
      tagline: "Agente customizado",
      description: prompt.trim(),
      pipeline: [{ section: "custom", label: label.trim(), prompt: prompt.trim() }],
      icon: ShoppingCart,
    });
    setLabel(""); setPrompt(""); setOpen(false);
    onCreated();
    return agent;
  };

  return (
    <div className="rounded-lg border border-dashed border-border/60 bg-card/50">
      {!open ? (
        <button onClick={() => setOpen(true)} className="w-full flex items-center justify-center gap-1.5 p-2.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
          <PlusCircle className="h-3.5 w-3.5" /> Criar agente customizado
        </button>
      ) : (
        <div className="p-2.5 space-y-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Nome do agente (ex.: Revisor de loja)"
            className="w-full text-[11px] px-2 py-1.5 rounded-md bg-secondary text-secondary-foreground border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
          <select
            value={segment}
            onChange={(e) => setSegment(e.target.value)}
            className="w-full text-[11px] px-2 py-1.5 rounded-md bg-secondary text-secondary-foreground border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
          >
            {BUILTIN_SEGMENTS.map((s) => <option key={s} value={s}>{s}</option>)}
            <option value="customizado">customizado</option>
          </select>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Prompt do trabalho (o que o agente deve analisar)"
            rows={3}
            className="w-full text-[11px] px-2 py-1.5 rounded-md bg-secondary text-secondary-foreground border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
          />
          <div className="flex gap-1.5">
            <button onClick={create} disabled={!label.trim() || !prompt.trim()} className="flex-1 py-1.5 rounded-md text-[11px] bg-primary text-primary-foreground disabled:opacity-50">
              Criar
            </button>
            <button onClick={() => setOpen(false)} className="flex-1 py-1.5 rounded-md text-[11px] bg-secondary text-secondary-foreground">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
