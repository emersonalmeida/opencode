/**
 * Grafo de conhecimento navegável (Onda 4.1): projeta o lineage do Pipeline
 * (artifactStore) como grafo explorável — insight → análises → dataset —
 * com posições determinísticas para render em SVG. Puro/testável.
 */
import type { PipelineArtifact } from "./types";
import { STAGE_META } from "./types";

export interface KnowledgeNode {
  id: string;
  title: string;
  stage: PipelineArtifact["stage"];
  stageLabel: string;
  kind: string;
  engine: PipelineArtifact["engine"];
  /** profundidade (0 = raiz selecionada) e ordem dentro do nível. */
  depth: number;
  /** posição normalizada 0..1 (x = depth, y = ordem no nível). */
  x: number;
  y: number;
}

export interface KnowledgeEdge {
  from: string;
  to: string;
}

export interface KnowledgeGraph {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  /** profundidade máxima (para dimensionar o viewBox). */
  maxDepth: number;
}

interface LineageLike {
  artifact: PipelineArtifact;
  inputs: LineageLike[];
}

/**
 * Constrói o grafo a partir da árvore de lineage (buildLineage). Layout:
 * raiz à esquerda (x=0), cada input um nível à direita; y distribui os nós
 * do nível uniformemente. Determinístico (ordem dos inputIds).
 */
export function lineageToGraph(root: LineageLike): KnowledgeGraph {
  const nodes: KnowledgeNode[] = [];
  const edges: KnowledgeEdge[] = [];
  const seen = new Set<string>();
  const byDepth = new Map<number, KnowledgeNode[]>();

  const visit = (node: LineageLike, depth: number) => {
    if (seen.has(node.artifact.id)) return;
    seen.add(node.artifact.id);
    const kn: KnowledgeNode = {
      id: node.artifact.id,
      title: node.artifact.title,
      stage: node.artifact.stage,
      stageLabel: STAGE_META[node.artifact.stage]?.label ?? node.artifact.stage,
      kind: node.artifact.kind,
      engine: node.artifact.engine,
      depth,
      x: 0,
      y: 0,
    };
    nodes.push(kn);
    const level = byDepth.get(depth) ?? [];
    level.push(kn);
    byDepth.set(depth, level);
    for (const input of node.inputs) {
      edges.push({ from: node.artifact.id, to: input.artifact.id });
      visit(input, depth + 1);
    }
  };
  visit(root, 0);

  // Layout normalizado: x por profundidade, y pela ordem no nível.
  const maxDepth = Math.max(...nodes.map((n) => n.depth), 0);
  const depthCount = maxDepth + 1;
  for (const [depth, level] of byDepth) {
    level.forEach((n, i) => {
      n.x = depthCount === 1 ? 0.5 : depth / maxDepth;
      n.y = (i + 1) / (level.length + 1);
    });
  }

  return { nodes, edges, maxDepth };
}

/** Título curto para o nó (trunca com reticências). */
export function nodeTitle(title: string, max = 22): string {
  return title.length > max ? `${title.slice(0, max - 1)}…` : title;
}
