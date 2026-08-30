import { useEffect, useRef, useState } from "react";
import { TerminalSquare, Loader2, CheckCircle2, AlertCircle, Circle, Trash2, ChevronDown, ChevronRight, Activity, Gauge } from "lucide-react";
import { useCanvasStore, type CanvasNodeStatus } from "@/lib/canvasStore";
import { NODE_REGISTRY } from "@/components/canvas/nodeRegistry";
import { ResourceMonitor } from "@/components/ResourceMonitor";
import { useActivityEvents, clearActivity } from "@/lib/activityStore";
import { PHASE_META } from "@/lib/statusSystem";
import { useSmartAutoScroll } from "@/hooks/useSmartAutoScroll";

const LEVEL_COLOR: Record<string, string> = {
  info: "text-muted-foreground",
  success: "text-status-success",
  error: "text-status-error",
  warn: "text-status-warning",
};

type UiStatus = CanvasNodeStatus | "disabled";

const STATUS_META: Record<UiStatus, { icon: typeof Circle; cls: string; label: string; hint: string }> = {
  idle: { icon: Circle, cls: "text-status-idle", label: "Parado", hint: "Aguardando execução" },
  running: { icon: Loader2, cls: "text-status-running", label: "Executando", hint: "Processando agora" },
  done: { icon: CheckCircle2, cls: "text-status-success", label: "Concluído", hint: "Terminou — veja a saída" },
  error: { icon: AlertCircle, cls: "text-status-error", label: "Erro", hint: "Falhou — veja o log" },
  skipped: { icon: Circle, cls: "text-status-skipped", label: "Pulado", hint: "Dependência falhou/pulada — não executou" },
  disabled: { icon: Circle, cls: "text-status-skipped", label: "Desativado", hint: "Nó desativado — não executa" },
};

type TermTab = "canvas" | "system" | "resources";

/** Terminal vivo: logs exatos em tempo real do canvas + de todo o sistema + recursos. */
export function CanvasTerminal() {
  const [tab, setTab] = useState<TermTab>("canvas");
  const logs = useCanvasStore((s) => s.logs);
  const status = useCanvasStore((s) => s.status);
  const nodes = useCanvasStore((s) => s.nodes);
  const running = useCanvasStore((s) => s.running);
  const run = useCanvasStore((s) => s.run);
  const cancel = useCanvasStore((s) => s.cancel);
  const [filter, setFilter] = useState<"all" | "error" | "running">("all");
  const [expandedNodes, setExpandedNodes] = useState(true);
  const events = useActivityEvents();

  // Auto-scroll inteligente: novos logs só puxam a view quando o usuário já
  // está no fim; trocar de aba sempre vai ao fim.
  const { ref: scrollRef, onScroll: handleScroll, scrollToBottom } = useSmartAutoScroll<HTMLDivElement>([logs, events]);
  // Trocar de aba sempre vai ao fim.
  useEffect(() => { scrollToBottom(false); }, [tab, scrollToBottom]);

  const visibleLogs = filter === "error" ? logs.filter((l) => l.level === "error") : filter === "running" ? logs.filter((l) => l.level !== "success") : logs;
  const nodeRows = nodes.map((n) => ({ node: n, st: (n.data.enabled === false ? "disabled" : status[n.id] ?? "idle") as UiStatus }));
  const activeCount = nodeRows.filter((r) => r.st === "running").length;
  const recentEvents = [...events].reverse();

  return (
    <div className="flex flex-col h-full -m-3">
      {/* Header / controls */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 flex-shrink-0">
        <TerminalSquare className="h-3.5 w-3.5 text-primary" />
        <span className="text-[11px] font-medium">Terminal</span>
        <div className="flex-1" />
        {running ? (
          <button onClick={cancel} className="text-[10px] px-2 py-0.5 rounded bg-status-error/10 text-status-error hover:bg-status-error/20">Parar</button>
        ) : (
          <button onClick={run} className="text-[10px] px-2 py-0.5 rounded bg-primary text-primary-foreground hover:bg-primary/90">Executar</button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0.5 px-2 py-1 border-b border-border/50 flex-shrink-0" role="tablist" aria-label="Abas do terminal">
        {([
          { key: "canvas" as const, label: "Canvas", icon: TerminalSquare },
          { key: "system" as const, label: "Sistema", icon: Activity },
          { key: "resources" as const, label: "Recursos", icon: Gauge },
        ]).map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-md transition-colors ${tab === t.key ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground"}`}
          >
            <t.icon className="h-3 w-3" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "resources" && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <ResourceMonitor />
        </div>
      )}

      {tab === "system" && (
        <>
          <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border/50 flex-shrink-0">
            <span className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground">
              Atividade do sistema · {events.length}
            </span>
            <div className="flex-1" />
            <button onClick={clearActivity} className="text-muted-foreground hover:text-destructive" title="Limpar atividade" aria-label="Limpar atividade"><Trash2 className="h-3 w-3" /></button>
          </div>
          <div ref={scrollRef} onScroll={handleScroll} className="flex-1 min-h-0 overflow-y-auto px-3 py-2 font-mono text-[10px] leading-relaxed bg-background/60">
            {recentEvents.length === 0 ? (
              <p className="text-muted-foreground italic">Nenhuma atividade ainda. Rode o canvas, o pipeline ou uma análise de IA.</p>
            ) : (
              recentEvents.map((e) => {
                const pm = PHASE_META[e.phase];
                return (
                  <div key={e.id} className="flex gap-1.5 items-baseline">
                    <span className="text-muted-foreground/40 shrink-0">{new Date(e.ts).toLocaleTimeString("pt-BR", { hour12: false })}</span>
                    <span className={`shrink-0 text-[8px] uppercase tracking-wide text-status-${pm.color}`}>{pm.label}</span>
                    <span className="text-primary/60 shrink-0">[{e.source}]</span>
                    <span className="text-foreground/90">{e.message}{e.detail ? <span className="text-muted-foreground"> — {e.detail}</span> : null}</span>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {tab === "canvas" && (
        <>
          {/* Node status */}
          {nodeRows.length > 0 && (
            <div className="px-3 py-2 border-b border-border/50 flex-shrink-0">
              <button onClick={() => setExpandedNodes((v) => !v)} className="flex items-center gap-1 text-[9px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">
                {expandedNodes ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                Nós · {activeCount} ativos · {nodeRows.filter((r) => r.st === "done").length} ok · {nodeRows.filter((r) => r.st === "error").length} erro · {nodeRows.filter((r) => r.st === "skipped").length} pulados
              </button>
              {expandedNodes && (
                <div className="space-y-0.5 max-h-28 overflow-y-auto">
                  {nodeRows.map(({ node, st }) => {
                    const meta = NODE_REGISTRY[node.data.kind];
                    const sm = STATUS_META[st];
                    return (
                      <div key={node.id} className="flex items-center gap-1.5 text-[10px]" title={sm.hint}>
                        <sm.icon className={`h-3 w-3 ${sm.cls} ${st === "running" ? "animate-spin" : ""}`} />
                        <span className="truncate flex-1">{node.data.label ?? meta.label}</span>
                        <span className={sm.cls}>{sm.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Log filter */}
          <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border/50 flex-shrink-0">
            {(["all", "error", "running"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`text-[9px] px-1.5 py-0.5 rounded ${filter === f ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                {f === "all" ? "Tudo" : f === "error" ? "Erros" : "Sem sucesso"}
              </button>
            ))}
            <div className="flex-1" />
            <button onClick={() => useCanvasStore.setState({ logs: [] })} className="text-muted-foreground hover:text-destructive" title="Limpar logs" aria-label="Limpar logs"><Trash2 className="h-3 w-3" /></button>
          </div>

          {/* Log stream */}
          <div ref={scrollRef} onScroll={handleScroll} className="flex-1 min-h-0 overflow-y-auto px-3 py-2 font-mono text-[10px] leading-relaxed bg-background/60">
            {visibleLogs.length === 0 ? (
              <p className="text-muted-foreground italic">Sem logs. Execute o canvas para ver a atividade aqui.</p>
            ) : (
              visibleLogs.map((l) => (
                <div key={l.id} className="flex gap-1.5">
                  <span className="text-muted-foreground/40 shrink-0">{new Date(l.ts).toLocaleTimeString("pt-BR", { hour12: false })}</span>
                  {l.nodeLabel && <span className="text-primary/70 shrink-0 max-w-[60px] truncate">[{l.nodeLabel}]</span>}
                  <span className={LEVEL_COLOR[l.level]}>{l.message}</span>
                </div>
              ))
            )}
            {running && <div className="flex items-center gap-1 text-status-running mt-1"><Loader2 className="h-2.5 w-2.5 animate-spin" /> aguardando…</div>}
          </div>
        </>
      )}
    </div>
  );
}
