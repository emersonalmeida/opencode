/**
 * Nexus OS — topbar: identidade do sistema + seletor de views da coluna
 * central + ferramentas globais (foco no console via ⌃K, badge de IA,
 * medidor de aprendizado).
 *
 * O medidor de aprendizado (0-100) torna visível o "sistema aprende com o
 * uso": sobe conforme dados são coletados, análises geradas e agentes usados.
 */
import { BrainCircuit, Cpu, LayoutDashboard, Lightbulb, Sparkles, Terminal, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";
import { OS_VIEWS, type OSView } from "@/lib/os/types";

const VIEW_ICONS: Record<OSView, typeof LayoutDashboard> = {
  overview: LayoutDashboard,
  analises: Sparkles,
  fluxos: Workflow,
  insights: Lightbulb,
};

export interface OSTopbarProps {
  view: OSView;
  onViewChange: (v: OSView) => void;
  aiOn: boolean;
  aiMode: string;
  /** Score de aprendizado 0-100 (memory.learningScore). */
  score: number;
  runningCount: number;
  onFocusConsole: () => void;
}

export function OSTopbar({ view, onViewChange, aiOn, aiMode, score, runningCount, onFocusConsole }: OSTopbarProps) {
  return (
    <header className="flex items-center gap-3 px-3 h-12 border-b border-border/50 bg-card/50 backdrop-blur-sm flex-shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-md shadow-primary/20">
          <Cpu className="h-4 w-4" />
        </div>
        <div className="hidden sm:block leading-tight">
          <p className="text-xs font-bold text-foreground tracking-tight">Nexus OS</p>
          <p className="text-[9px] text-muted-foreground">sistema operacional de inteligência</p>
        </div>
      </div>

      {/* View tabs */}
      <nav role="tablist" aria-label="Views do OS" className="flex items-center gap-0.5 mx-auto overflow-x-auto">
        {OS_VIEWS.map((v) => {
          const Icon = VIEW_ICONS[v.id];
          const active = view === v.id;
          return (
            <button
              key={v.id}
              role="tab"
              aria-selected={active}
              title={v.hint}
              onClick={() => onViewChange(v.id)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden md:inline">{v.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Ferramentas globais */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {runningCount > 0 && (
          <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] text-primary" aria-live="polite">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            {runningCount} em execução
          </span>
        )}

        {/* Medidor de aprendizado */}
        <div className="hidden lg:flex items-center gap-1.5" title={`Aprendizado do OS: ${score}/100 — sobe com coletas, análises e uso`}>
          <BrainCircuit className="h-3.5 w-3.5 text-primary" />
          <div className="w-16 h-1.5 rounded-full bg-secondary overflow-hidden" role="progressbar" aria-valuenow={score} aria-valuemin={0} aria-valuemax={100} aria-label="Aprendizado do OS">
            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${score}%` }} />
          </div>
          <span className="text-[9px] font-mono text-muted-foreground">{score}</span>
        </div>

        {/* Badge de IA */}
        <span
          className={cn(
            "hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium",
            aiOn ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground",
          )}
          title={aiOn ? `IA ativa (${aiMode})` : "IA desativada — ative em Configurações"}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", aiOn ? "bg-emerald-500" : "bg-muted-foreground/50")} />
          {aiOn ? `IA ${aiMode}` : "IA off"}
        </span>

        {/* Foco no console */}
        <button
          onClick={onFocusConsole}
          aria-label="Abrir console (Ctrl+K)"
          title="Console — ⌃K"
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-border/60 text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
        >
          <Terminal className="h-3.5 w-3.5" />
          <kbd className="hidden md:inline text-[9px] font-mono">⌃K</kbd>
        </button>
      </div>
    </header>
  );
}
