/**
 * PipelineComposer — coluna direita.
 *
 * Mostra os módulos atualmente no pipeline (combinados) e permite:
 *  - reordenar (subir/descer),
 *  - remover,
 *  - "Carregar no Canvas": monta o grafo (buildPipeline) e appenda no canvas,
 *    depois navega para /canvas.
 *
 * É a peça "combinar módulos em pipelines" que conecta o Atlas ao Canvas
 * existente — o Atlas descreve as metodologias, o Canvas as executa.
 */
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Trash2, ArrowUp, ArrowDown, Workflow, Plus, X, Rocket, Play, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/lib/canvasStore";
import { buildPipeline } from "@/lib/analysisAtlas/canvasBridge";
import type { AnalysisModule } from "@/lib/analysisAtlas/types";
import { GROUP_META } from "@/lib/analysisAtlas/groups";

interface Props {
  pipeline: AnalysisModule[];
  onReorder: (next: AnalysisModule[]) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  /** Executa o pipeline inteiro (módulos de IA) sequencialmente. */
  onRun?: () => void;
  running?: boolean;
}

export function PipelineComposer({ pipeline, onReorder, onRemove, onClear, onRun, running = false }: Props) {
  const navigate = useNavigate();
  const appendGraph = useCanvasStore((s) => s.appendGraph);
  const existingNodes = useCanvasStore((s) => s.nodes);

  const hasGraph = useMemo(() => existingNodes.length > 0, [existingNodes.length]);

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= pipeline.length) return;
    const next = [...pipeline];
    [next[i], next[j]] = [next[j], next[i]];
    onReorder(next);
  };

  const loadToCanvas = () => {
    if (pipeline.length === 0) return;
    const { nodes, edges } = buildPipeline(pipeline);
    appendGraph(nodes, edges);
    navigate("/canvas");
  };

  return (
    <div className="flex flex-col h-full text-xs">
      {/* Header */}
      <div className="p-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
            <Workflow className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold leading-tight">Pipeline</p>
            <p className="text-[10px] text-muted-foreground">{pipeline.length} módulo(s) combinado(s)</p>
          </div>
          {pipeline.length > 0 && (
            <button onClick={onClear} className="p-1 text-muted-foreground hover:text-destructive" aria-label="Limpar pipeline" title="Limpar pipeline">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {pipeline.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-10 px-3 gap-2">
            <Plus className="h-6 w-6 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground max-w-[200px]">
              Adicione módulos ao pipeline com o botão "+ Pipeline" no centro.
              Combine metodologias e carregue tudo no Canvas.
            </p>
          </div>
        ) : (
          pipeline.map((m, i) => {
            const MIcon = m.icon;
            const gmeta = GROUP_META[m.group];
            const prev = pipeline[i - 1];
            const PIcon = prev?.icon;
            return (
              <div key={`${m.id}-${i}`} className="space-y-0.5">
                {prev && (
                  <div className="flex items-center gap-1 pl-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      {PIcon && <PIcon className="h-2.5 w-2.5" />}
                      <span className="truncate max-w-[80px]">{prev.label}</span>
                    </span>
                    <span>→</span>
                    <span className="italic">dados/saída</span>
                    <span>→</span>
                  </div>
                )}
                <div className="rounded-md border border-border/60 bg-card/60 p-2">
                  <div className="flex items-center gap-1.5">
                    <MIcon className={cn("h-3.5 w-3.5 shrink-0", gmeta.color)} />
                    <span className="text-xs font-medium truncate flex-1">{m.label}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{m.tagline}</p>
                  <div className="flex items-center gap-0.5 mt-1.5">
                    <button onClick={() => move(i, -1)} disabled={i === 0} className="p-1 rounded hover:bg-secondary disabled:opacity-30 text-muted-foreground hover:text-foreground" aria-label="Mover para cima">
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button onClick={() => move(i, 1)} disabled={i === pipeline.length - 1} className="p-1 rounded hover:bg-secondary disabled:opacity-30 text-muted-foreground hover:text-foreground" aria-label="Mover para baixo">
                      <ArrowDown className="h-3 w-3" />
                    </button>
                    <button onClick={() => onRemove(m.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive ml-auto" aria-label="Remover do pipeline">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Run + load to canvas */}
      <div className="p-2 border-t border-border/50 space-y-2">
        {onRun && (
          <Button size="sm" variant="default" className="w-full h-8 text-xs" onClick={onRun} disabled={pipeline.length === 0 || running}>
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            {running ? "Executando…" : "Executar pipeline"}
          </Button>
        )}
        <Button size="sm" variant={onRun ? "outline" : "default"} className="w-full h-8 text-xs" onClick={loadToCanvas} disabled={pipeline.length === 0}>
          <Rocket className="h-3.5 w-3.5" /> Carregar no Canvas
        </Button>
        {hasGraph && (
          <p className="text-[10px] text-muted-foreground text-center">
            O canvas já tem nós — o pipeline será adicionado ao final.
          </p>
        )}
        <p className="text-[10px] text-muted-foreground text-center">
          No Canvas, nós IA encadeados refinam a saída do anterior automaticamente.
        </p>
      </div>
    </div>
  );
}
