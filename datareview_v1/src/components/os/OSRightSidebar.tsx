/**
 * Nexus OS — sidebar direita (ações, funcionalidades e configurações
 * SECUNDÁRIAS). Três abas:
 *
 *  - "Console": o CLI do OS — /comandos + linguagem natural (vai para a IA).
 *  - "Memória": o que o sistema aprendeu — score de aprendizado, comandos
 *    mais usados, cobertura de análises, log de eventos, botão "esquecer".
 *  - "Sessões": histórico unificado de gerações (coletas + análises de IA).
 */
import { forwardRef, useMemo } from "react";
import { BrainCircuit, History, Terminal } from "lucide-react";
import { OSConsole } from "@/components/os/OSConsole";
import { AIOutputCard } from "@/components/shared/AIOutputCard";
import { useDataset } from "@/hooks/useDataset";
import { useGenerations } from "@/hooks/useSessions";
import {
  analysisCoverage, commandFrequency, learningScore, useOSEvents,
} from "@/lib/os/memory";
import { EXPERIMENT_SECTIONS } from "@/lib/experimentSections";
import { cn } from "@/lib/utils";
import type { ConsoleLine } from "@/lib/os/types";

export type OSRightTab = "console" | "memoria" | "sessoes";

export const OS_RIGHT_TABS: Array<{ id: OSRightTab; label: string; icon: typeof Terminal }> = [
  { id: "console", label: "Console", icon: Terminal },
  { id: "memoria", label: "Memória", icon: BrainCircuit },
  { id: "sessoes", label: "Sessões", icon: History },
];

export interface OSRightSidebarProps {
  consoleLines: ConsoleLine[];
  consoleBusy: boolean;
  onConsoleSubmit: (text: string) => void;
}

/** Ícones do rail (coluna recolhida) — trocam a aba ativa da sidebar. */
export function OSRightRailIcons({ tab, onTab }: { tab: OSRightTab; onTab: (t: OSRightTab) => void }) {
  return (
    <>
      {OS_RIGHT_TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => onTab(t.id)}
          aria-label={`Aba ${t.label}`}
          title={t.label}
          aria-pressed={tab === t.id}
          className={cn(
            "p-2 rounded-lg transition-colors",
            tab === t.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary",
          )}
        >
          <t.icon className="h-4 w-4" />
        </button>
      ))}
    </>
  );
}

/**
 * Conteúdo da sidebar direita do Nexus OS (SEM a moldura da coluna — o shell
 * aplica CollapsibleColumn via <PageSidebar>). forwardRef preserva o foco ⌃K
 * no console (ref chega ao OSConsole mesmo através do portal).
 */
export const OSRightContent = forwardRef<HTMLInputElement, OSRightSidebarProps & { tab: OSRightTab; onTab: (t: OSRightTab) => void }>(function OSRightContent(
  { consoleLines, consoleBusy, onConsoleSubmit, tab, onTab },
  consoleRef,
) {
  return (
      <div className="flex flex-col h-full min-h-0">
        <div role="tablist" aria-label="Painel de controle" className="flex border-b border-border/50 flex-shrink-0">
          {OS_RIGHT_TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => onTab(t.id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1 px-1 py-2 text-[10px] font-medium transition-colors border-b-2",
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <t.icon className="h-3 w-3" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0">
          {tab === "console" && (
            <OSConsole ref={consoleRef} lines={consoleLines} onSubmit={onConsoleSubmit} busy={consoleBusy} />
          )}
          {tab === "memoria" && <MemoriaTab />}
          {tab === "sessoes" && <SessoesTab />}
        </div>
      </div>
  );
});

/* ----------------------------------------------------------- Memória ---- */

const KIND_LABEL: Record<string, string> = {
  command: "comando", view: "view", analysis: "análise", agent: "agente",
  collect: "coleta", chat: "chat", export: "export",
};

function MemoriaTab() {
  const events = useOSEvents();
  const dataset = useDataset();
  const score = useMemo(() => learningScore(dataset.entries, events), [dataset.entries, events]);
  const top = useMemo(() => commandFrequency(events).slice(0, 6), [events]);
  const coverage = useMemo(() => analysisCoverage(events), [events]);
  const recent = useMemo(() => [...events].slice(-12).reverse(), [events]);

  return (
    <div className="h-full overflow-y-auto p-3 space-y-4">
      {/* Score de aprendizado */}
      <section className="rounded-lg border border-border/60 bg-card/40 p-3">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Aprendizado do OS</p>
          <span className="text-xs font-bold text-primary">{score}/100</span>
        </div>
        <div className="h-2 rounded-full bg-secondary overflow-hidden" role="progressbar" aria-valuenow={score} aria-valuemin={0} aria-valuemax={100} aria-label="Score de aprendizado">
          <div className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary transition-all duration-500" style={{ width: `${score}%` }} />
        </div>
        <p className="text-[9px] text-muted-foreground mt-1.5">
          Sobe com dados coletados, análises geradas, agentes executados e uso do console. Quanto maior, mais assertivas as recomendações.
        </p>
      </section>

      {/* Cobertura */}
      <section>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
          Cobertura de análises ({coverage.done.length}/{coverage.done.length + coverage.missing.length})
        </p>
        <div className="flex flex-wrap gap-1">
          {EXPERIMENT_SECTIONS.filter((s) => s.kind === "ai").map((s) => {
            const done = coverage.done.includes(s.id);
            return (
              <span
                key={s.id}
                title={s.label}
                className={cn(
                  "px-1.5 py-0.5 rounded-full text-[9px] border",
                  done ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "border-border/60 text-muted-foreground",
                )}
              >
                {s.label}
              </span>
            );
          })}
        </div>
      </section>

      {/* Comandos mais usados */}
      {top.length > 0 && (
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Mais usados</p>
          <div className="space-y-1">
            {top.map(([id, n]) => (
              <div key={id} className="flex items-center justify-between text-[11px]">
                <span className="font-mono text-foreground">/{id}</span>
                <span className="text-muted-foreground">{n}×</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Log de eventos */}
      <section>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Eventos recentes</p>
        {recent.length === 0 ? (
          <p className="text-[10px] text-muted-foreground">Nenhum evento ainda. O OS começa a aprender a partir do primeiro uso.</p>
        ) : (
          <div className="space-y-0.5 font-mono text-[10px]">
            {recent.map((e, i) => (
              <div key={`${e.ts}-${i}`} className="flex items-center gap-1.5 text-muted-foreground">
                <span className="text-primary/70">{KIND_LABEL[e.kind] ?? e.kind}</span>
                <span className="truncate text-foreground/80">{e.id}</span>
                {e.detail && <span className="truncate">{e.detail}</span>}
                <span className="ml-auto flex-shrink-0">{new Date(e.ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}

/* ----------------------------------------------------------- Sessões ---- */

const TYPE_LABEL: Record<string, string> = {
  collect: "Coleta", "atlas-run": "Atlas", "canvas-run": "Canvas", chat: "Chat", "ai-section": "Análise",
};

function SessoesTab() {
  const generations = useGenerations();

  return (
    <div className="h-full overflow-y-auto p-3">
      {generations.length === 0 ? (
        <p className="text-[10px] text-muted-foreground text-center py-8">
          Nenhuma geração ainda. Coletas e análises de IA aparecem aqui.
        </p>
      ) : (
        <div className="space-y-2">
          {generations.slice(0, 30).map((g) => (
            <article key={g.id} className="rounded-lg border border-border/60 bg-card/40 p-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-medium">
                  {TYPE_LABEL[g.type] ?? g.type}
                </span>
                <span className="text-[9px] text-muted-foreground ml-auto">
                  {new Date(g.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <p className="text-[11px] font-medium text-foreground truncate">{g.title}</p>
              {g.summary && <p className="text-[10px] text-muted-foreground truncate">{g.summary}</p>}
              {g.markdown && (
                <AIOutputCard bare content={g.markdown} title={TYPE_LABEL[g.type] ?? g.title} filename={`sessao-${g.id}`} storageKey={`sessao-os-${g.id}`} />
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
