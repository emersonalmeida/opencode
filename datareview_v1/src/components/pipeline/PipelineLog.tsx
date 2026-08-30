/**
 * PipelineLog — feed ao vivo do que o pipeline está fazendo.
 *
 * Cada evento do runner vira uma linha timestamped: escolha do orquestrador,
 * início/fim de análises, pedidos de next_analysis da IA (o "pipeline que
 * volta"), skips e o critério de parada.
 */
import {
  ArrowRightCircle, CheckCircle2, CircleDashed, Flag, PlayCircle, SkipForward, XCircle,
} from "lucide-react";
import type { LoopEvent } from "@/lib/pipeline/runner";
import { useSmartAutoScroll } from "@/hooks/useSmartAutoScroll";
import { cn } from "@/lib/utils";

export interface LogLine {
  ts: number;
  event: LoopEvent;
}

function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString("pt-BR", { hour12: false });
}

function Line({ line }: { line: LogLine }) {
  const e = line.event;
  switch (e.type) {
    case "pick":
      return (
        <div className="flex gap-1.5 items-start">
          <ArrowRightCircle className="h-3 w-3 mt-0.5 text-orange-500 flex-shrink-0" />
          <p className="text-[10px] text-foreground">
            Orquestrador escolheu <strong>{e.label}</strong> <span className="text-muted-foreground">(prioridade {e.priority})</span>
          </p>
        </div>
      );
    case "start":
      return (
        <div className="flex gap-1.5 items-start">
          <PlayCircle className="h-3 w-3 mt-0.5 text-primary flex-shrink-0" />
          <p className="text-[10px] text-foreground">
            Executando <strong>{e.label}</strong> <span className="text-muted-foreground">({e.engine === "ai" ? "IA" : "determinístico"})</span>
          </p>
        </div>
      );
    case "artifact":
      return (
        <div className="flex gap-1.5 items-start">
          <CheckCircle2 className="h-3 w-3 mt-0.5 text-emerald-500 flex-shrink-0" />
          <p className="text-[10px] text-foreground">
            Artefato gerado: <strong>{e.artifact.title}</strong>
            {e.artifact.data?.findings?.length ? (
              <span className="text-muted-foreground"> · {e.artifact.data.findings.length} finding(s)</span>
            ) : null}
          </p>
        </div>
      );
    case "next-request":
      return (
        <div className="flex gap-1.5 items-start">
          <CircleDashed className="h-3 w-3 mt-0.5 text-violet-500 flex-shrink-0" />
          <p className="text-[10px] text-foreground">
            IA pediu nova análise: <strong>{e.request.type}</strong>
            {e.resolved ? (
              <span className="text-emerald-600 dark:text-emerald-400"> → {e.resolved}</span>
            ) : (
              <span className="text-muted-foreground"> (não mapeada — ignorada)</span>
            )}
            {e.request.rationale && <span className="block text-muted-foreground italic">“{e.request.rationale}”</span>}
          </p>
        </div>
      );
    case "skip":
      return (
        <div className="flex gap-1.5 items-start">
          <SkipForward className="h-3 w-3 mt-0.5 text-muted-foreground flex-shrink-0" />
          <p className="text-[10px] text-muted-foreground">{e.reason}</p>
        </div>
      );
    case "error":
      return (
        <div className="flex gap-1.5 items-start">
          <XCircle className="h-3 w-3 mt-0.5 text-destructive flex-shrink-0" />
          <p className="text-[10px] text-destructive">Erro em {e.analysisId}: {e.message}</p>
        </div>
      );
    case "done":
      return (
        <div className="flex gap-1.5 items-start">
          <Flag className="h-3 w-3 mt-0.5 text-primary flex-shrink-0" />
          <p className="text-[10px] text-foreground">
            Loop encerrado após {e.iterations} iteração(ões) — <span className="text-muted-foreground">{e.reason}</span>
          </p>
        </div>
      );
  }
}

export function PipelineLog({ lines }: { lines: LogLine[] }) {
  // Auto-scroll inteligente: segue o log ao vivo só se o usuário já estava
  // no fim — rolar para cima durante o loop nunca é interrompido.
  const scroll = useSmartAutoScroll<HTMLDivElement>([lines.length]);

  return (
    <div className="rounded-lg border border-border/60 bg-card/40 overflow-hidden flex flex-col min-h-0 h-full">
      <div className="px-3 py-1.5 border-b border-border/50 bg-card/60 flex-shrink-0">
        <h3 className="text-[11px] font-bold text-foreground">Loop de descoberta</h3>
      </div>
      <div ref={scroll.ref} onScroll={scroll.onScroll} className="overflow-y-auto min-h-0 p-2 space-y-1.5 flex-1">
        {lines.length === 0 ? (
          <p className="text-[10px] text-muted-foreground px-1 py-2">
            O log do pipeline aparece aqui. Rode a camada determinística ou inicie o loop de descoberta.
          </p>
        ) : (
          lines.map((l, i) => (
            <div key={i} className={cn("flex gap-1.5 items-start", i < lines.length - 1 && "opacity-80")}>
              <span className="text-[9px] text-muted-foreground/60 tabular-nums mt-0.5 flex-shrink-0 w-14">{fmtTime(l.ts)}</span>
              <div className="min-w-0 flex-1"><Line line={l} /></div>
            </div>
          ))
        )}
        <div aria-hidden="true" />
      </div>
    </div>
  );
}
