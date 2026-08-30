/**
 * Seção 15 — Monitorar: o fechamento do loop — feed de atividade do sistema
 * em tempo real + ferramentas de poder (Terminal, Nexus OS, Explorar) + CTA
 * para reiniciar o ciclo com novos dados.
 */
import { Link } from "react-router-dom";
import { Terminal as TermIcon, Cpu, Compass, RotateCcw, Atom, TerminalSquare, Route } from "lucide-react";
import { FlowActivity } from "@/components/flow/FlowActivity";
import { MonitorPanel } from "@/components/flow/MonitorPanel";
import { Panel } from "@/components/Panel";
import { FlowEmbed } from "@/components/flow/FlowEmbed";

interface Props {
  /** Volta ao início da jornada (seção Descobrir). */
  onRestart: () => void;
}

export function SectionMonitor({ onRestart }: Props) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
        <p className="text-xs font-semibold">O ciclo nunca termina</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Novos dados geram novos sinais — e a jornada recomeça. Re-colete apps
          com limites maiores, investigue novamente e monitore a evolução.
        </p>
        <button
          onClick={onRestart}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          Reiniciar no Descobrir
        </button>
      </div>

      {/* Monitoramento agendado (Onda 3.2): recoleta periódica com diff */}
      <div className="rounded-lg border border-border/60 bg-card p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Monitoramento agendado
        </p>
        <MonitorPanel />
      </div>

      <FlowActivity limit={25} />

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Ferramentas de poder
        </p>
        <div className="flex flex-wrap gap-2">
          <Link to="/terminal" className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs hover:bg-secondary">
            <TermIcon className="h-3.5 w-3.5" aria-hidden /> Terminal
          </Link>
          <Link to="/os" className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs hover:bg-secondary">
            <Cpu className="h-3.5 w-3.5" aria-hidden /> Nexus OS
          </Link>
          <Link to="/case" className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs hover:bg-secondary">
            <Compass className="h-3.5 w-3.5" aria-hidden /> Explorar (como o produto foi feito)
          </Link>
          <Link to="/jornada" className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs hover:bg-secondary">
            <Route className="h-3.5 w-3.5" aria-hidden /> Jornada guiada
          </Link>
        </div>
      </div>

      <Panel
        title="Núcleo (Core Page)"
        subtitle="A página Núcleo inteira: sinais do sistema, memória (Nexus OS) e visão do pipeline macro → micro — sem sair do Fluxo."
        icon={<Atom className="h-4 w-4 text-primary" />}
        defaultOpen={false}
        storageKey="aso:flow-nucleo"
      >
        <FlowEmbed page="nucleo" />
        <Link to="/nucleo" className="mt-2 inline-block text-[11px] text-primary hover:underline">
          Abrir página dedicada ↗
        </Link>
      </Panel>

      <Panel
        title="Terminal embutido (nexterm)"
        subtitle="O shell NexTerm completo: abas, splits, comandos /collect, /analyze, /export… — sem sair do Fluxo."
        icon={<TerminalSquare className="h-4 w-4 text-primary" />}
        defaultOpen={false}
        storageKey="aso:flow-terminal"
      >
        <div className="h-[480px]">
          <FlowEmbed page="terminal" />
        </div>
        <Link to="/terminal" className="mt-2 inline-block text-[11px] text-primary hover:underline">
          Abrir página dedicada ↗
        </Link>
      </Panel>
    </div>
  );
}
