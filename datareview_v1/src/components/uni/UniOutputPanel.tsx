/**
 * UniOutputPanel — terminal de coleta em tempo real (aba "Output" da sidebar
 * direita interna da página Uni). Inspirado na saída do docs/_uni.py:
 * cabeçalhos de bloco, itens numerados, erros em vermelho, metas em cinza.
 *
 * Consome o uniOutputLog (SSE do servidor + itens logados pelo cliente) e
 * auto-scroll inteligente (segue o fim só se o usuário já está no fim).
 */
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, Eraser, TerminalSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSmartAutoScroll } from "@/hooks/useSmartAutoScroll";
import { apiBase } from "@/lib/apiBase";
import {
  clearOutputLog,
  ensureOutputStream,
  formatClock,
  useUniOutputLog,
  type OutputLineKind,
} from "@/lib/uni/uniOutputLog";

const KIND_CLASS: Record<OutputLineKind, string> = {
  header: "text-sky-400 font-semibold",
  item: "text-zinc-200",
  meta: "text-zinc-500",
  success: "text-emerald-400",
  error: "text-red-400",
  progress: "text-amber-300",
};


export function UniOutputPanel() {
  const lines = useUniOutputLog();
  const scroll = useSmartAutoScroll<HTMLDivElement>([lines.length]);
  const [kindFilter, setKindFilter] = useState<OutputLineKind | "all">("all");

  useEffect(() => {
    ensureOutputStream(apiBase());
  }, []);

  const visible = useMemo(
    () => (kindFilter === "all" ? lines : lines.filter((l) => l.kind === kindFilter || l.kind === "error")),
    [lines, kindFilter],
  );

  return (
    <div className="relative flex h-full min-h-0 flex-col" role="region" aria-label="Output da coleta">
      <div className="flex items-center gap-1 border-b px-2 py-1.5">
        <TerminalSquare className="text-muted-foreground h-3.5 w-3.5" />
        <span className="text-muted-foreground flex-1 truncate text-xs">
          {lines.length} linha{lines.length === 1 ? "" : "s"}
        </span>
        <select
          aria-label="Filtrar por tipo de linha"
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value as OutputLineKind | "all")}
          className="bg-background h-6 rounded border px-1 text-xs"
        >
          <option value="all">Tudo</option>
          <option value="item">Itens</option>
          <option value="header">Execuções</option>
          <option value="progress">Progresso</option>
        </select>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          aria-label="Limpar output"
          onClick={clearOutputLog}
        >
          <Eraser className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div
        ref={scroll.ref}
        onScroll={scroll.onScroll}
        role="log"
        aria-live="polite"
        className="min-h-0 flex-1 overflow-y-auto bg-zinc-950 p-2 font-mono text-[11px] leading-relaxed"
      >
        {visible.length === 0 ? (
          <p className="text-zinc-500">
            $ aguardando coletas…{"\n"}Execute qualquer fonte no centro da página — cada etapa aparece aqui em tempo real.
          </p>
        ) : (
          visible.map((l) => (
            <div key={l.id} className="flex gap-2">
              <span className="shrink-0 text-zinc-600">{formatClock(l.ts)}</span>
              <span className={cn("min-w-0 break-words", KIND_CLASS[l.kind])}>{l.text}</span>
            </div>
          ))
        )}
      </div>

      {scroll.showJump && (
        <button
          onClick={scroll.resumeFollow}
          className="bg-primary text-primary-foreground absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full px-3 py-1 text-xs shadow-lg"
        >
          <ArrowDown className="h-3 w-3" /> Recentes
        </button>
      )}
    </div>
  );
}
