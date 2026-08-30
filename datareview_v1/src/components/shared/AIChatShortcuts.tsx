/**
 * AIChatShortcuts — a MESMA barra de atalhos de IA em toda superfície de chat
 * (página Chat, sidebar direita, e onde mais houver conversa com IA):
 *
 *   - Análises: as 12 seções de IA do sistema (1 clique = análise completa).
 *   - Pipelines: os 7 agentes (sequência de análises encadeadas).
 *   - Sugestões inteligentes: prompts gerados a partir da FORMA dos dados
 *     coletados (multi-app/versão/país/loja, sentimento, utilidade…).
 *
 * Tudo em chips compactos, scroll horizontal, sem poluir — reconhecimento em
 * vez de memorização (o usuário descobre o que o sistema sabe fazer).
 */
import { Zap, Workflow, Lightbulb } from "lucide-react";
import type { DatasetEntry } from "@/lib/datasetStore";
import type { SectionDef } from "@/lib/experimentSections";
import {
  ANALYSIS_SHORTCUTS, PIPELINE_SHORTCUTS, buildDataAwareSuggestions,
  type PipelineShortcut,
} from "@/lib/aiChatShared";

interface Props {
  entries: Pick<DatasetEntry, "app" | "reviews">[];
  disabled?: boolean;
  /** Executa uma análise de seção (stream) — o caller renderiza no chat. */
  onRunSection: (section: SectionDef) => void;
  /** Executa um pipeline (sequência de seções). */
  onRunPipeline: (pipeline: PipelineShortcut) => void;
  /** Envia uma sugestão como mensagem de chat. */
  onSuggestion: (text: string) => void;
  /** Mostra sugestões inteligentes (default true). */
  showSuggestions?: boolean;
  /** Máximo de sugestões (default 4 no atalho; use mais no empty state). */
  maxSuggestions?: number;
}

export function AIChatShortcuts({
  entries,
  disabled,
  onRunSection,
  onRunPipeline,
  onSuggestion,
  showSuggestions = true,
  maxSuggestions = 4,
}: Props) {
  const suggestions = showSuggestions ? buildDataAwareSuggestions(entries, maxSuggestions) : [];
  const hasApps = entries.length > 0;

  if (!hasApps && !showSuggestions) return null;

  return (
    <div className="space-y-2" data-testid="ai-chat-shortcuts">
      {hasApps && (
        <>
          <div>
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground/70 px-0.5 mb-1 flex items-center gap-1">
              <Zap className="h-2.5 w-2.5" aria-hidden="true" /> Análises em 1 clique
            </p>
            <div className="flex gap-1 overflow-x-auto scrollbar-thin pb-0.5" role="group" aria-label="Análises de IA disponíveis">
              {ANALYSIS_SHORTCUTS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onRunSection(s)}
                  disabled={disabled}
                  title={s.description}
                  className="shrink-0 inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border border-border/50 bg-card hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-colors disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 whitespace-nowrap"
                >
                  <s.icon className="h-3 w-3" aria-hidden="true" />
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground/70 px-0.5 mb-1 flex items-center gap-1">
              <Workflow className="h-2.5 w-2.5" aria-hidden="true" /> Pipelines (sequências de análises)
            </p>
            <div className="flex gap-1 overflow-x-auto scrollbar-thin pb-0.5" role="group" aria-label="Pipelines de agentes">
              {PIPELINE_SHORTCUTS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onRunPipeline(p)}
                  disabled={disabled}
                  title={`${p.tagline} — etapas: ${p.steps.map((s) => s.label).join(" → ")}`}
                  className="shrink-0 inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border border-violet-500/30 bg-violet-500/5 hover:border-violet-500/60 hover:bg-violet-500/10 text-violet-700 dark:text-violet-300 transition-colors disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 whitespace-nowrap"
                >
                  <Workflow className="h-3 w-3" aria-hidden="true" />
                  {p.label}
                  <span className="text-[8px] opacity-70">{p.steps.length} etapas</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
      {suggestions.length > 0 && (
        <div>
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground/70 px-0.5 mb-1 flex items-center gap-1">
            <Lightbulb className="h-2.5 w-2.5" aria-hidden="true" /> Sugestões para estes dados
          </p>
          <div className="space-y-1">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => onSuggestion(s)}
                disabled={disabled}
                className="w-full text-left text-xs px-3 py-2 rounded-lg border border-border/40 hover:border-primary/40 hover:bg-primary/5 transition-colors disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
