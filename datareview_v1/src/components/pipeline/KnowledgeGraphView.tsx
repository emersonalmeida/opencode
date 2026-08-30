/**
 * Grafo de conhecimento navegável (Onda 4.1): o lineage do Pipeline como
 * grafo visual SVG — insight → análises → fatos → dataset — com nós
 * clicáveis (selecionar o artefato). Determinístico (knowledgeGraph.ts).
 */
import { useMemo } from "react";
import { lineageToGraph, nodeTitle, type KnowledgeGraph } from "@/lib/pipeline/knowledgeGraph";
import { STAGE_META, type PipelineArtifact } from "@/lib/pipeline/types";
import { cn } from "@/lib/utils";

interface Props {
  /** Árvore de lineage (buildLineage do artifactStore). */
  root: { artifact: PipelineArtifact; inputs: Props["root"][] } | null;
  selectedId?: string | null;
  onSelect: (id: string) => void;
}

const W = 560;
const H = 260;
const PAD = 34;
const NODE_W = 108;
const NODE_H = 34;

function color(node: KnowledgeGraph["nodes"][number]): string {
  // Cores por estágio (tokens do design system via STAGE_META não expõem cor
  // de nó — usamos uma escala fixa consistente por engine+depth).
  return node.engine === "ai" ? "hsl(var(--chart-2))" : "hsl(var(--chart-4))";
}

export function KnowledgeGraphView({ root, selectedId, onSelect }: Props) {
  const graph = useMemo(() => (root ? lineageToGraph(root as never) : null), [root]);

  if (!graph || graph.nodes.length === 0) {
    return (
      <p className="text-[10px] text-muted-foreground px-1 py-2">
        Sem lineage para desenhar — execute análises para formar o grafo de conhecimento.
      </p>
    );
  }

  const pos = (n: KnowledgeGraph["nodes"][number]) => ({
    cx: PAD + n.x * (W - PAD * 2),
    cy: PAD + n.y * (H - PAD * 2),
  });
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));

  return (
    <div className="rounded-lg border border-border/40 bg-background/60 overflow-hidden">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label="Grafo de conhecimento: do insight até os dados"
      >
        {/* Arestas */}
        {graph.edges.map((e) => {
          const a = byId.get(e.from);
          const b = byId.get(e.to);
          if (!a || !b) return null;
          const pa = pos(a);
          const pb = pos(b);
          return (
            <line
              key={`${e.from}->${e.to}`}
              x1={pa.cx}
              y1={pa.cy}
              x2={pb.cx}
              y2={pb.cy}
              stroke="hsl(var(--border))"
              strokeWidth={1.2}
              markerEnd="url(#kg-arrow)"
            />
          );
        })}
        <defs>
          <marker id="kg-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L8,4 L0,8 z" fill="hsl(var(--muted-foreground))" />
          </marker>
        </defs>

        {/* Nós */}
        {graph.nodes.map((n) => {
          const p = pos(n);
          const selected = n.id === selectedId;
          return (
            <g
              key={n.id}
              transform={`translate(${p.cx - NODE_W / 2}, ${p.cy - NODE_H / 2})`}
              onClick={() => onSelect(n.id)}
              className="cursor-pointer"
              role="button"
              aria-label={`Selecionar artefato ${n.title}`}
              tabIndex={0}
              onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") onSelect(n.id); }}
            >
              <rect
                width={NODE_W}
                height={NODE_H}
                rx={8}
                fill={selected ? "hsl(var(--primary) / 0.14)" : "hsl(var(--card))"}
                stroke={selected ? "hsl(var(--primary))" : color(n)}
                strokeWidth={selected ? 2 : 1.2}
              />
              <text
                x={NODE_W / 2}
                y={15}
                textAnchor="middle"
                className="fill-foreground"
                fontSize={9}
                fontWeight={600}
              >
                {nodeTitle(n.title)}
              </text>
              <text
                x={NODE_W / 2}
                y={26}
                textAnchor="middle"
                className="fill-muted-foreground"
                fontSize={7.5}
              >
                {n.stageLabel} · {n.engine === "ai" ? "IA" : "det."}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="px-2 pb-1.5 text-[9px] text-muted-foreground">
        {graph.nodes.length} artefatos · {graph.edges.length} conexões — clique num nó para inspecionar
        {STAGE_META ? "" : ""}
      </p>
    </div>
  );
}
