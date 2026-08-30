/**
 * Seção 10 — Decidir: versão compacta do Decision Center — escolhe uma
 * persona (lente) e executa um de seus 10 módulos de decisão sobre o escopo,
 * com a resposta estruturada no DNA de 6 camadas (Insight → … → Ação).
 */
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Play, Square, Scale, Check, BrainCircuit } from "lucide-react";
import { Panel } from "@/components/Panel";
import { FlowEmbed } from "@/components/flow/FlowEmbed";
import { useFlowScope } from "@/components/flow/useFlowScope";
import { useAISettings, isAIEnabled } from "@/lib/aiSettings";
import { PERSONAS, type Persona } from "@/lib/decisionCenter";
import { streamExperimentChat } from "@/lib/experimentChatApi";
import { AIOutputCard } from "@/components/shared/AIOutputCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils";
import { AIDisabledEmptyState } from "@/components/shared/AIDisabledNotice";

export function SectionDecide() {
  const { scoped } = useFlowScope();
  const ai = useAISettings();
  const [persona, setPersona] = useState<Persona>(PERSONAS[0]);
  const [outputs, setOutputs] = useState<Record<string, string>>({});
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const aiOk = isAIEnabled(ai);

  if (scoped.length === 0) {
    return (
      <EmptyState
        icon={Scale}
        title="Sem dados para decidir"
        description="Colete apps para gerar decisões por persona com evidência."
      />
    );
  }

  if (!aiOk) {
    return (
<AIDisabledEmptyState icon={Scale} />
    );
  }

  const key = (modId: string) => `${persona.id}:${modId}`;

  const run = async (modId: string) => {
    const mod = persona.modules.find((m) => m.id === modId);
    if (!mod) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const k = key(modId);
    setActiveModule(k);
    setRunning(true);
    setOutputs((o) => ({ ...o, [k]: "" }));
    await streamExperimentChat(
      scoped,
      [{ role: "user", content: mod.prompt }],
      {
        onToken: (full) => setOutputs((o) => ({ ...o, [k]: full })),
        onDone: (full) => setOutputs((o) => ({ ...o, [k]: full })),
        onError: () => {},
      },
      ctrl.signal,
      ai,
    ).catch(() => {});
    setRunning(false);
  };

  const stop = () => {
    abortRef.current?.abort();
    setRunning(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Escolha a lente (persona) — os mesmos dados, decisões diferentes
        </p>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Personas">
          {PERSONAS.map((p) => {
            const Icon = p.icon;
            const on = p.id === persona.id;
            return (
              <button
                key={p.id}
                role="tab"
                aria-selected={on}
                onClick={() => setPersona(p)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
                  on ? "border-primary/50 bg-primary/10 text-foreground" : "border-border/60 hover:bg-secondary text-muted-foreground",
                )}
              >
                <Icon className="h-3 w-3" aria-hidden />
                {p.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{persona.tagline}</span> — {persona.centralQuestion}
        </p>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2" aria-label="Módulos de decisão">
        {persona.modules.map((mod) => {
          const k = key(mod.id);
          const st = activeModule === k && running;
          const has = (outputs[k] ?? "").length > 0;
          const Icon = mod.icon;
          return (
            <li key={mod.id} className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-background/60 p-3">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold">{mod.label}</p>
                <p className="text-[11px] text-muted-foreground">{mod.question}</p>
              </div>
              <button
                onClick={() => (st ? stop() : run(mod.id))}
                aria-label={`Gerar ${mod.label}`}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-[11px] hover:bg-secondary"
              >
                {st ? (
                  <>
                    <Square className="h-3 w-3" aria-hidden /> Parar
                  </>
                ) : has ? (
                  <>
                    <Check className="h-3 w-3 text-status-success" aria-hidden /> Refazer
                  </>
                ) : (
                  <>
                    <Play className="h-3 w-3" aria-hidden /> Gerar
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {activeModule && (outputs[activeModule] ?? "") !== "" && (
        <div className="relative rounded-lg border border-border/60 bg-background/60 p-3">
          <p className="mb-2 flex items-center gap-1.5 pr-16 text-xs font-semibold text-muted-foreground">
            {running && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            {persona.label} · {persona.modules.find((m) => key(m.id) === activeModule)?.label}
          </p>
          <AIOutputCard
            bare
            content={outputs[activeModule]}
            filename={`decisao-${activeModule}`}
            streaming={running}
            storageKey={`flow-decisao-${activeModule}`}
            onRegenerate={running ? undefined : () => {
              const modId = activeModule.split(":")[1];
              if (modId) void run(modId);
            }}
          />
        </div>
      )}

      <Panel
        title="Decision Center completo"
        subtitle="A página inteira: seletor de personas, pipeline de 70 decisões (todas as personas), síntese executiva, compêndio exportável e copiloto — sem sair do Fluxo."
        icon={<BrainCircuit className="h-4 w-4 text-primary" />}
        defaultOpen={false}
        storageKey="aso:flow-decision"
      >
        <div className="h-[640px]">
          <FlowEmbed page="decision-center" />
        </div>
        <Link to="/decision-center" className="mt-2 inline-block text-[11px] text-primary hover:underline">
          Abrir página dedicada ↗
        </Link>
      </Panel>
    </div>
  );
}
