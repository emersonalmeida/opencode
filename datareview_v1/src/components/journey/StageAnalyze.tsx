import { useMemo, useRef, useState } from "react";
import { Loader2, Play, Square, CheckCircle2, Circle, AlertTriangle, BrainCircuit } from "lucide-react";
import { useAISettings, isAIEnabled } from "@/lib/aiSettings";
import { streamExperiment } from "@/lib/experimentApi";
import { EXPERIMENT_SECTIONS } from "@/lib/experimentSections";
import { AIOutputCard } from "@/components/shared/AIOutputCard";
import { AIDisabledNotice } from "@/components/shared/AIDisabledNotice";
import { EmptyState } from "@/components/shared/EmptyState";
import type { DatasetEntry } from "@/lib/datasetStore";

const AI_SECTIONS = EXPERIMENT_SECTIONS.filter((s) => s.kind === "ai");

type RunState = "idle" | "running" | "done" | "error";

/**
 * Etapa 3 — Analisar: roda as seções de IA escolhidas em sequência sobre o
 * escopo (seleção global; vazia = dataset inteiro), com streaming ao vivo.
 */
export function StageAnalyze({ scoped }: { scoped: DatasetEntry[] }) {
  const ai = useAISettings();
  const [picked, setPicked] = useState<Set<string>>(new Set(["summary", "problems", "opportunities"]));
  const [outputs, setOutputs] = useState<Record<string, string>>({});
  const [states, setStates] = useState<Record<string, RunState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const toggleSection = (id: string) => {
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const runSection = async (sectionId: string, signal: AbortSignal) => {
    setStates((s) => ({ ...s, [sectionId]: "running" }));
    setOutputs((o) => ({ ...o, [sectionId]: "" }));
    await streamExperiment(sectionId, scoped, {
      onToken: (full) => setOutputs((o) => ({ ...o, [sectionId]: full })),
      onDone: (full) => {
        setOutputs((o) => ({ ...o, [sectionId]: full }));
        setStates((s) => ({ ...s, [sectionId]: "done" }));
      },
      onError: (err) => {
        setErrors((e) => ({ ...e, [sectionId]: err }));
        setStates((s) => ({ ...s, [sectionId]: "error" }));
      },
    }, signal, ai);
  };

  const runAll = async () => {
    setRunning(true);
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;
    for (const sec of AI_SECTIONS) {
      if (!picked.has(sec.id) || signal.aborted) continue;
      await runSection(sec.id, signal);
    }
    setRunning(false);
  };

  const regenerateOne = async (sectionId: string) => {
    if (running) return;
    setRunning(true);
    abortRef.current = new AbortController();
    await runSection(sectionId, abortRef.current.signal);
    setRunning(false);
  };

  const stop = () => { abortRef.current?.abort(); setRunning(false); };

  const doneCount = useMemo(() => Object.values(states).filter((s) => s === "done").length, [states]);

  if (scoped.length === 0) {
    return (
      <EmptyState
        icon={BrainCircuit}
        title="Sem dados para analisar"
        description="Colete pelo menos um app nas etapas anteriores para a IA ter reviews para trabalhar."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Análise com IA</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Escolha as análises e execute sobre {scoped.length} app(s) no escopo.
          A IA cita reviews reais como evidência.
        </p>
      </div>

      {!isAIEnabled(ai) && <AIDisabledNotice />}

      {/* Toda lista selecionável tem "Todas"/"Nenhuma" (padrão do sistema). */}
      <div className="flex items-center gap-2 text-[10px]" role="group" aria-label="Seleção de seções em massa">
        <span className="text-muted-foreground">{picked.size}/{AI_SECTIONS.length} seções</span>
        <button
          type="button"
          onClick={() => setPicked(new Set(AI_SECTIONS.map((sec) => sec.id)))}
          disabled={picked.size === AI_SECTIONS.length}
          className="text-primary hover:underline disabled:opacity-40"
        >
          Todas
        </button>
        <button
          type="button"
          onClick={() => setPicked(new Set())}
          disabled={picked.size === 0}
          className="text-primary hover:underline disabled:opacity-40"
        >
          Nenhuma
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Seções de análise">
        {AI_SECTIONS.map((sec) => {
          const on = picked.has(sec.id);
          const st = states[sec.id];
          return (
            <button
              key={sec.id}
              role="checkbox"
              aria-checked={on}
              onClick={() => toggleSection(sec.id)}
              title={sec.description}
              className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-full border transition-colors ${
                on ? "border-primary bg-primary/10 text-foreground" : "border-border/60 text-muted-foreground hover:bg-secondary/60"
              }`}
            >
              {st === "running" && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
              {st === "done" && <CheckCircle2 className="h-3 w-3 text-success" aria-hidden />}
              {st === "error" && <AlertTriangle className="h-3 w-3 text-destructive" aria-hidden />}
              {(!st || st === "idle") && (on
                ? <CheckCircle2 className="h-3 w-3 text-primary" aria-hidden />
                : <Circle className="h-3 w-3 opacity-40" aria-hidden />)}
              {sec.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        {!running ? (
          <button
            onClick={runAll}
            disabled={picked.size === 0 || !isAIEnabled(ai)}
            className="inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Play className="h-4 w-4" aria-hidden /> Analisar {picked.size} seção(ões)
          </button>
        ) : (
          <button
            onClick={stop}
            className="inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-destructive text-destructive-foreground hover:opacity-90"
          >
            <Square className="h-4 w-4" aria-hidden /> Parar
          </button>
        )}
        {doneCount > 0 && (
          <span className="text-xs text-muted-foreground" role="status">{doneCount} análise(s) concluída(s)</span>
        )}
      </div>

      <div className="space-y-4">
        {AI_SECTIONS.filter((s) => picked.has(s.id) && outputs[s.id]).map((sec) => (
          <div key={sec.id} className="rounded-lg border border-border/60 bg-background p-4 relative">
            <h3 className="text-sm font-semibold mb-2">{sec.label}</h3>
            <AIOutputCard
              bare
              content={outputs[sec.id]}
              filename={`analise-${sec.id}`}
              storageKey={`jornada-${sec.id}`}
              onRegenerate={running ? undefined : () => void regenerateOne(sec.id)}
            />
            {errors[sec.id] && <p className="text-xs text-destructive mt-2" role="alert">{errors[sec.id]}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
