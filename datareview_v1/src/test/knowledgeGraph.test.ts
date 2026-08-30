import { describe, it, expect } from "vitest";
import { lineageToGraph, nodeTitle } from "@/lib/pipeline/knowledgeGraph";
import type { PipelineArtifact } from "@/lib/pipeline/types";

function art(id: string, inputIds: string[] = [], over: Partial<PipelineArtifact> = {}): PipelineArtifact {
  return {
    id,
    kind: "finding",
    stage: "reason",
    title: `Artefato ${id}`,
    methodology: "ai:test",
    engine: "ai",
    inputIds,
    appKeys: [],
    createdAt: 1,
    ...over,
  };
}

// Helper: monta a árvore de lineage com guarda de ciclos (espelha o
// comportamento do buildLineage real, que também guarda contra ciclos).
function tree(
  root: PipelineArtifact,
  all: Map<string, PipelineArtifact>,
  visited: Set<string> = new Set(),
): { artifact: PipelineArtifact; inputs: ReturnType<typeof tree>[] } {
  if (visited.has(root.id)) return { artifact: root, inputs: [] };
  visited.add(root.id);
  return {
    artifact: root,
    inputs: root.inputIds.map((id) => tree(all.get(id)!, all, visited)),
  };
}

describe("knowledgeGraph — grafo de conhecimento navegável (Onda 4.1)", () => {
  it("projeta lineage linear: dataset → fatos → insight", () => {
    const all = new Map([
      ["data", art("data", [], { stage: "data", kind: "facts" })],
      ["facts", art("facts", ["data"], { stage: "compute", kind: "facts" })],
      ["insight", art("insight", ["facts"])],
    ]);
    const g = lineageToGraph(tree(all.get("insight")!, all));
    expect(g.nodes).toHaveLength(3);
    expect(g.edges).toHaveLength(2);
    expect(g.maxDepth).toBe(2);
    const insight = g.nodes.find((n) => n.id === "insight")!;
    const data = g.nodes.find((n) => n.id === "data")!;
    expect(insight.x).toBe(0);
    expect(data.x).toBe(1);
  });

  it("fan-in: dois pais compartilham um input comum sem duplicar nó", () => {
    const all = new Map([
      ["data", art("data", [])],
      ["a", art("a", ["data"])],
      ["b", art("b", ["data"])],
      ["root", art("root", ["a", "b"])],
    ]);
    const g = lineageToGraph(tree(all.get("root")!, all));
    expect(g.nodes).toHaveLength(4); // data não duplica
    expect(g.edges).toHaveLength(4);
    expect(g.nodes.filter((n) => n.depth === 2)).toHaveLength(1);
  });

  it("ciclo não trava (guard de visitados)", () => {
    const a = art("a", ["b"]);
    const b = art("b", ["a"]);
    const all = new Map([["a", a], ["b", b]]);
    const g = lineageToGraph(tree(a, all));
    expect(g.nodes).toHaveLength(2);
  });

  it("posições normalizadas dentro de 0..1 e y distribuído no nível", () => {
    const all = new Map([
      ["data", art("data", [])],
      ["a", art("a", ["data"])],
      ["b", art("b", ["data"])],
      ["root", art("root", ["a", "b"])],
    ]);
    const g = lineageToGraph(tree(all.get("root")!, all));
    for (const n of g.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x).toBeLessThanOrEqual(1);
      expect(n.y).toBeGreaterThan(0);
      expect(n.y).toBeLessThan(1);
    }
    const level1 = g.nodes.filter((n) => n.depth === 1);
    expect(level1[0].y).not.toBe(level1[1].y);
  });

  it("metadados do estágio acompanham o nó", () => {
    const all = new Map([["x", art("x", [], { stage: "data" })]]);
    const g = lineageToGraph(tree(all.get("x")!, all));
    expect(g.nodes[0].stageLabel).toBe("Dataset bruto");
  });

  it("nodeTitle trunca com reticências", () => {
    expect(nodeTitle("curto")).toBe("curto");
    expect(nodeTitle("um título muito muito muito longo mesmo")).toBe("um título muito muito…");
  });
});
