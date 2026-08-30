/**
 * GitCanvasBoard — o Canvas infinito (spec §2/§7).
 *
 * UMA superfície espacial: pan, zoom, fit, minimapa, seleção, drag de nodes.
 * O componente é controlado: o estado (nodes/edges/view/seleção) vive na
 * página/store; o board só renderiza e reporta interações.
 *
 * zoomOnScroll sempre ativo (padrão Canvas v7 do projeto): scroll sobre o
 * fundo faz zoom; áreas roláveis dentro de nodes capturam o wheel antes.
 */
import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  applyNodeChanges,
  type NodeChange,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import GitObjectNode from "./GitObjectNode";
import type { GitCanvasNode } from "@/lib/gitCanvas/graph";

const nodeTypes = { gitObject: GitObjectNode };

export interface GitCanvasBoardProps {
  nodes: GitCanvasNode[];
  edges: Edge[];
  onNodesChange(nodes: GitCanvasNode[]): void;
  selectedId: string | null;
  onSelect(nodeId: string | null): void;
  onNodeDoubleClick?(nodeId: string): void;
  onNodeContextMenu?(nodeId: string, x: number, y: number): void;
  onPaneContextMenu?(x: number, y: number): void;
  children?: React.ReactNode;
}

const KIND_MINIMAP_COLOR: Record<string, string> = {
  project: "#8b5cf6",
  remote: "#0ea5e9",
  "local-repository": "#10b981",
  branch: "#6366f1",
  commit: "#94a3b8",
  "pull-request": "#3b82f6",
  issue: "#f59e0b",
  agent: "#a855f7",
  workflow: "#14b8a6",
  deployment: "#6366f1",
  release: "#ec4899",
  folder: "#fbbf24",
  file: "#64748b",
  diff: "#f97316",
};

export function GitCanvasBoard({
  nodes,
  edges,
  onNodesChange,
  selectedId,
  onSelect,
  onNodeDoubleClick,
  onNodeContextMenu,
  onPaneContextMenu,
  children,
}: GitCanvasBoardProps) {
  const handleChanges = useCallback(
    (changes: NodeChange<GitCanvasNode>[]) => onNodesChange(applyNodeChanges(changes, nodes)),
    [nodes, onNodesChange],
  );

  const flowNodes = useMemo(
    () => nodes.map((n) => ({ ...n, selected: n.id === selectedId })),
    [nodes, selectedId],
  );

  return (
    <ReactFlow
      nodes={flowNodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={handleChanges}
      onNodeClick={(_, n) => onSelect(n.id)}
      onNodeDoubleClick={(_, n) => onNodeDoubleClick?.(n.id)}
      onNodeContextMenu={(ev, n) => {
        ev.preventDefault();
        onNodeContextMenu?.(n.id, ev.clientX, ev.clientY);
      }}
      onPaneClick={() => onSelect(null)}
      onPaneContextMenu={(ev) => {
        ev.preventDefault();
        const e = ev as unknown as { clientX: number; clientY: number };
        onPaneContextMenu?.(e.clientX, e.clientY);
      }}
      minZoom={0.15}
      maxZoom={2.5}
      zoomOnScroll
      zoomOnPinch
      panOnDrag
      panActivationKeyCode="Space"
      fitView
      fitViewOptions={{ padding: 0.25, maxZoom: 1.1 }}
      proOptions={{ hideAttribution: true }}
      className="bg-background"
      defaultEdgeOptions={{ type: "smoothstep", style: { stroke: "hsl(var(--muted-foreground) / 0.45)", strokeWidth: 1.4 } }}
    >
      <Background variant={BackgroundVariant.Dots} gap={26} size={1.2} className="opacity-40" />
      <Controls showInteractive={false} position="bottom-left" />
      <MiniMap
        pannable
        zoomable
        position="bottom-right"
        className="!bg-card/80 !border !border-border/60 !rounded-lg"
        nodeColor={(n: Node) => KIND_MINIMAP_COLOR[(n.data as { kind?: string }).kind ?? ""] ?? "#64748b"}
        maskColor="hsl(var(--background) / 0.75)"
      />
      {children}
    </ReactFlow>
  );
}
