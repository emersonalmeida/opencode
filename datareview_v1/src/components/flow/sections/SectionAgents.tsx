/**
 * Seção 08 — Agentes: executa um especialista (builtin/custom) — pipeline de
 * etapas com status vivo por etapa e output streaming, sobre o escopo global.
 */
import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bot, Loader2, Play, Square, Check, XCircle, Circle } from "lucide-react";
import { Panel } from "@/components/Panel";
import { FlowEmbed } from "@/components/flow/FlowEmbed";
import { useFlowScope } from "@/components/flow/useFlowScope";
import { useAISettings, isAIEnabled } from "@/lib/aiSettings";
import { listAllAgents, type GeneratorAgent } from "@/lib/agents";
import { runAgent, type StepState } from "@/lib/agentRunner";
import { AIOutputCard } from "@/components/shared/AIOutputCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils";
import { AIDisabledEmptyState } from "@/components/shared/AIDisabledNotice";

export function SectionAgents() {
  const { scoped } = useFlowScope();
  const ai = useAISettings();
  const agents = useMemo(() => listAllAgents(), []);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [steps, setSteps] = useState<Record<number, StepState>>({});
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const aiOk = isAIEnabled(ai);

  if (scoped.length === 0) {
    return (
      <EmptyState
        icon={Bot}
        title="Sem dados para os especialistas"
        description="Colete apps para que os agentes tenham reviews para analisar."
      />
    );
  }

  if (!aiOk) {
    return <AIDisabledEmptyState icon={Bot} />;
  }

  const run = (agent: GeneratorAgent) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setActiveId(agent.id);
    setSteps({});
    setRunning(true);
    void runAgent(
      agent,
      scoped,
      {
        onStep: (idx, state) => setSteps((s) => ({ ...s, [idx]: state })),
        onDone: () => setRunning(false),
        onError: () => setRunning(false),
      },
      { signal: ctrl.signal, ai },
    );
  };

  const stop = () => {
    abortRef.current?.abort();
    setRunning(false);
  };

  const active = agents.find((a) => a.id === activeId) ?? null;

  return (
    <div className="space-y-4">
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label="Especialistas">
        {agents.map((agent) => {
          const Icon = agent.icon;
          const isActive = activeId === agent.id;
          return (
            <li key={agent.id} className={cn("rounded-lg border p-3", isActive ? "border-primary/50 bg-primary/5" : "border-border/60 bg-background/60")}>
              <div className="flex items-center gap-2.5">
                <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold">{agent.label}</p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {agent.pipeline.length} etapas{agent.builtin ? "" : " · custom"}
                  </p>
                </div>
                <button
                  onClick={() => run(agent)}
                  disabled={running}
                  aria-label={`Executar agente ${agent.label}`}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  <Play className="h-3 w-3" aria-hidden />
                  Executar
                </button>
              </div>
              <p className="mt-1.5 line-clamp-2 text-[11px] text-muted-foreground">{agent.description}</p>
            </li>
          );
        })}
      </ul>

      {active && (
        <div className="rounded-lg border border-border/60 bg-background/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold">
              Pipeline: {active.label}
            </p>
            {running ? (
              <button onClick={stop} className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-[11px] hover:bg-secondary">
                <Square className="h-3 w-3" aria-hidden /> Parar
              </button>
            ) : null}
          </div>
          <ol className="mt-3 space-y-2" aria-label="Etapas do agente">
            {active.pipeline.map((step, idx) => {
              const st = steps[idx];
              const status = st?.status ?? "pending";
              return (
                <li key={idx} className="rounded-md border border-border/40 bg-background/60 p-2.5">
                  <div className="flex items-center gap-2 text-xs">
                    {status === "running" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-status-info" aria-hidden />
                    ) : status === "done" ? (
                      <Check className="h-3.5 w-3.5 text-status-success" aria-hidden />
                    ) : status === "error" ? (
                      <XCircle className="h-3.5 w-3.5 text-status-error" aria-hidden />
                    ) : (
                      <Circle className="h-3.5 w-3.5 text-muted-foreground/40" aria-hidden />
                    )}
                    <span className="font-medium">
                      {idx + 1}. {step.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground">({step.section})</span>
                  </div>
                  {st?.output ? (
                    <AIOutputCard
                      bare
                      content={st.output}
                      filename={`${active.id}-${step.section}`}
                      streaming={st?.status === "running"}
                      storageKey={`flow-agente-step-${idx}`}
                      onRegenerate={running ? undefined : () => run(active)}
                    />
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <Panel
        title="Gerenciar agentes (página completa)"
        subtitle="Criar, editar e excluir agentes customizados + executar qualquer agente com o pipeline completo de etapas — a página Agentes inteira, aqui dentro."
        icon={<Bot className="h-4 w-4 text-primary" />}
        defaultOpen={false}
        storageKey="aso:flow-agentes"
      >
        <FlowEmbed page="agentes" />
        <Link to="/agentes" className="mt-2 inline-block text-[11px] text-primary hover:underline">
          Abrir página dedicada ↗
        </Link>
      </Panel>
    </div>
  );
}
