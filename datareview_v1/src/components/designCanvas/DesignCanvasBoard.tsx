import { useMemo } from "react";
import {
  ReactFlow, Background, BackgroundVariant, Controls, MiniMap, Panel,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Undo2, Redo2, Magnet, Map, Trash2, Sparkles } from "lucide-react";
import { useDesignStore, useVisibleNodes, useVisibleEdges } from "@/lib/designCanvas/store";
import { DesignCanvasNode } from "./DesignCanvasNode";
import { DESIGN_TOKENS } from "@/lib/designCanvas/registry";

const nodeTypes: NodeTypes = { design: DesignCanvasNode };

/**
 * Scoped theme injector — re-emits the active board's token overrides as CSS
 * custom properties on a wrapper div, so the live previews reflect the edited
 * tokens WITHOUT mutating the global app theme (other pages stay untouched).
 */
function ThemeScope({ children }: { children: React.ReactNode }) {
  const overrides = useDesignStore((s) => s.tokenOverrides);
  const style = useMemo(() => {
    const vars: Record<string, string> = {};
    for (const t of DESIGN_TOKENS) {
      const val = overrides[t.cssVar] ?? t.value;
      vars[`--${t.cssVar}`] = val.startsWith("0") || /^\d/.test(val) ? `hsl(${val})` : val;
    }
    return vars as React.CSSProperties;
  }, [overrides]);
  return <div style={style} className="w-full h-full">{children}</div>;
}

/**
 * A superfície do canvas — React Flow com nós de componente vivos, edges de
 * fluxo de protótipo, pan/zoom, snap-to-grid, minimap, undo/redo e pill de status.
 */
export function DesignCanvasBoard({ onOpenAI }: { onOpenAI: () => void }) {
  const nodes = useVisibleNodes();
  const edges = useVisibleEdges();
  const onNodesChange = useDesignStore((s) => s.onNodesChange);
  const onEdgesChange = useDesignStore((s) => s.onEdgesChange);
  const onConnect = useDesignStore((s) => s.onConnect);
  const snapToGrid = useDesignStore((s) => s.snapToGrid);
  const showMinimap = useDesignStore((s) => s.showMinimap);
  const toggleSnapToGrid = useDesignStore((s) => s.toggleSnapToGrid);
  const toggleMinimap = useDesignStore((s) => s.toggleMinimap);
  const undo = useDesignStore((s) => s.undo);
  const redo = useDesignStore((s) => s.redo);
  const clearBoard = useDesignStore((s) => s.clearBoard);
  const loadExample = useDesignStore((s) => s.loadExample);
  const past = useDesignStore((s) => s.past);
  const future = useDesignStore((s) => s.future);
  const selectNode = useDesignStore((s) => s.selectNode);
  const selectEdge = useDesignStore((s) => s.selectEdge);
  const boards = useDesignStore((s) => s.boards);
  const activeBoard = useDesignStore((s) => s.activeBoard);
  const board = boards.find((b) => b.id === activeBoard);

  const nodeCount = nodes.length;
  const edgeCount = edges.length;

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, n) => selectNode(n.id)}
        onEdgeClick={(_, e) => selectEdge(e.id)}
        onPaneClick={() => { selectNode(null); selectEdge(null); }}
        snapToGrid={snapToGrid}
        snapGrid={[20, 20]}
        fitView
        proOptions={{ hideAttribution: true }}
        className="bg-muted/30"
      >
        <ThemeScope>
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} className="opacity-60" />
        </ThemeScope>
        <Controls className="!shadow-md" />
        {showMinimap && (
          <MiniMap
            pannable
            zoomable
            nodeColor={() => "hsl(var(--primary))"}
            maskColor="hsl(var(--muted) / 0.6)"
            className="!bg-card !border !border-border/60"
          />
        )}

        {/* Floating toolbar */}
        <Panel position="top-left" className="!m-2">
          <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-card/90 backdrop-blur p-1 shadow-md">
            <button onClick={undo} disabled={past.length === 0} title="Desfazer" aria-label="Desfazer"
              className="p-1.5 rounded hover:bg-secondary disabled:opacity-30 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50">
              <Undo2 className="h-4 w-4" />
            </button>
            <button onClick={redo} disabled={future.length === 0} title="Refazer" aria-label="Refazer"
              className="p-1.5 rounded hover:bg-secondary disabled:opacity-30 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50">
              <Redo2 className="h-4 w-4" />
            </button>
            <div className="w-px h-5 bg-border/60" />
            <button onClick={toggleSnapToGrid} title="Snap à grade" aria-pressed={snapToGrid}
              className={`p-1.5 rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 ${snapToGrid ? "bg-primary/10 text-primary" : "hover:bg-secondary"}`}>
              <Magnet className="h-4 w-4" />
            </button>
            <button onClick={toggleMinimap} title="Minimapa" aria-pressed={showMinimap}
              className={`p-1.5 rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 ${showMinimap ? "bg-primary/10 text-primary" : "hover:bg-secondary"}`}>
              <Map className="h-4 w-4" />
            </button>
            <div className="w-px h-5 bg-border/60" />
            <button onClick={() => { if (confirm("Limpar board atual?")) clearBoard(); }} title="Limpar board" aria-label="Limpar board"
              className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-destructive focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50">
              <Trash2 className="h-4 w-4" />
            </button>
            <div className="w-px h-5 bg-border/60" />
            <button onClick={loadExample} title="Carregar exemplo" aria-label="Carregar exemplo"
              className="px-2 h-7 rounded text-[11px] font-medium bg-primary/10 text-primary hover:bg-primary/20 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50">
              Exemplo
            </button>
            <div className="w-px h-5 bg-border/60" />
            <button onClick={onOpenAI} title="Assistente de IA" aria-label="Assistente de IA"
              className="p-1.5 rounded hover:bg-secondary text-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50">
              <Sparkles className="h-4 w-4" />
            </button>
          </div>
        </Panel>

        {/* Status pill */}
        <Panel position="top-right" className="!m-2">
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/90 backdrop-blur px-2.5 py-1 text-[11px] shadow-md">
            <span className="font-medium truncate max-w-[160px]">{board?.name ?? "Board"}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{nodeCount} nós · {edgeCount} fluxos</span>
          </div>
        </Panel>

        {/* Empty state */}
        {nodeCount === 0 && (
          <Panel position="top-center" className="!m-0 !top-1/2 -translate-y-1/2">
            <div className="text-center max-w-sm rounded-xl border border-dashed border-border/70 bg-card/80 backdrop-blur p-5 shadow-sm">
              <div className="text-sm font-semibold mb-1">Canvas vazio</div>
              <p className="text-xs text-muted-foreground mb-3">
                Adicione componentes pela paleta à esquerda, conecte-os pelas bordas (●) para criar fluxos de protótipo, ou comece com um exemplo.
              </p>
              <button onClick={loadExample} className="text-xs font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
                Carregar exemplo de login
              </button>
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}
