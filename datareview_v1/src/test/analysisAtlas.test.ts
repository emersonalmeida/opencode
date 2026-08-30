import { describe, it, expect, beforeEach } from "vitest";
import {
  ANALYSIS_MODULES, getModule, modulesByGroup, searchModules, moduleStats,
} from "@/lib/analysisAtlas/registry";
import { GROUP_META, GROUP_ORDER, DISCOVERY_LABELS, CONFIDENCE_LABELS, DATASOURCE_LABELS, VIZ_LABELS } from "@/lib/analysisAtlas/groups";
import {
  moduleToNodeConfig, moduleNodeLabel, moduleToNode, buildPipeline, appendModuleNode,
} from "@/lib/analysisAtlas/canvasBridge";
import type { AnalysisModule } from "@/lib/analysisAtlas/types";
import { useCanvasStore, NODE_DEFAULT_LABEL } from "@/lib/canvasStore";
import type { CanvasNode } from "@/lib/canvasStore";

/* ----------------------------------------------------------------- catalog */
describe("analysis atlas registry", () => {
  it("has a non-empty catalog of modules", () => {
    expect(ANALYSIS_MODULES.length).toBeGreaterThan(30);
  });

  it("every module id is unique", () => {
    const ids = ANALYSIS_MODULES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every module has the full contract filled", () => {
    for (const m of ANALYSIS_MODULES) {
      expect(m.label.length).toBeGreaterThan(0);
      expect(m.tagline.length).toBeGreaterThan(0);
      expect(m.description.length).toBeGreaterThan(0);
      expect(m.input.length).toBeGreaterThan(0);
      expect(m.processing.length).toBeGreaterThan(0);
      expect(m.outputs.length).toBeGreaterThan(0);
      expect(m.evidence.claimExample.length).toBeGreaterThan(0);
      expect(m.evidence.sourceType.length).toBeGreaterThan(0);
      expect(m.visualization.length).toBeGreaterThan(0);
      expect(m.canvas).toBeDefined();
      expect(["available", "planned"]).toContain(m.status);
      expect(NODE_DEFAULT_LABEL[m.canvas.kind]).toBeDefined();
    }
  });

  it("every module group exists in GROUP_META and GROUP_ORDER", () => {
    for (const m of ANALYSIS_MODULES) {
      expect(GROUP_META[m.group]).toBeDefined();
      expect(GROUP_ORDER).toContain(m.group);
    }
  });

  it("every discovery/output/confidence/datasource/viz has a label", () => {
    for (const m of ANALYSIS_MODULES) {
      for (const o of m.outputs) expect(DISCOVERY_LABELS[o]).toBeDefined();
      expect(CONFIDENCE_LABELS[m.confidence]).toBeDefined();
      for (const d of m.input) expect(DATASOURCE_LABELS[d]).toBeDefined();
      for (const v of m.visualization) expect(VIZ_LABELS[v]).toBeDefined();
    }
  });

  it("covers all 10 domains of the DATA LAB tree", () => {
    const groups = new Set(ANALYSIS_MODULES.map((m) => m.group));
    for (const g of GROUP_ORDER) expect(groups.has(g)).toBe(true);
  });

  it("getModule resolves by id", () => {
    const first = ANALYSIS_MODULES[0];
    expect(getModule(first.id)?.id).toBe(first.id);
    expect(getModule("does-not-exist")).toBeUndefined();
  });

  it("modulesByGroup returns only that group", () => {
    for (const g of GROUP_ORDER) {
      const mods = modulesByGroup(g);
      for (const m of mods) expect(m.group).toBe(g);
    }
  });

  it("searchModules matches label/tagline/description/tags", () => {
    const results = searchModules("login");
    expect(results.length).toBeGreaterThan(0);
    // Case-insensitive
    expect(searchModules("LOGIN").length).toBe(results.length);
    // Empty query returns all
    expect(searchModules("").length).toBe(ANALYSIS_MODULES.length);
    // No match
    expect(searchModules("zzz-nope-xyz").length).toBe(0);
  });

  it("moduleStats counts available vs planned", () => {
    const s = moduleStats();
    expect(s.total).toBe(ANALYSIS_MODULES.length);
    expect(s.available + s.planned).toBe(s.total);
    expect(s.available).toBeGreaterThan(0); // at least some run today
  });

  it("score components are always kept separate (never only the final number)", () => {
    const withScore = ANALYSIS_MODULES.filter((m) => m.score);
    expect(withScore.length).toBeGreaterThan(0);
    for (const m of withScore) {
      expect(m.score!.components.length).toBeGreaterThan(1);
      expect(m.score!.formula.length).toBeGreaterThan(0);
    }
  });
});

/* ---------------------------------------------------------- canvas bridge */
describe("analysis atlas canvas bridge", () => {
  const mod: AnalysisModule = ANALYSIS_MODULES.find((m) => m.id === "pain-point-mining")!;

  it("moduleToNodeConfig maps section/chartType/promptSeed", () => {
    const cfg = moduleToNodeConfig(mod.canvas);
    expect(cfg.section).toBe(mod.canvas.section);
    expect(cfg.kind).toBeUndefined(); // kind lives on the node, not config
  });

  it("moduleToNode produces a valid CanvasNode with the right kind + config", () => {
    const node = moduleToNode(mod, { x: 10, y: 20 });
    expect(node.type).toBe(mod.canvas.kind);
    expect(node.position).toEqual({ x: 10, y: 20 });
    expect(node.data.kind).toBe(mod.canvas.kind);
    expect(node.data.config.section).toBe(mod.canvas.section);
    expect(node.data.label).toBe(mod.canvas.nodeLabel ?? mod.label);
  });

  it("moduleNodeLabel prefers nodeLabel, then module.label, then NODE_DEFAULT_LABEL", () => {
    const explicit = { ...mod, canvas: { ...mod.canvas, nodeLabel: "Custom" } };
    expect(moduleNodeLabel(explicit)).toBe("Custom");
    // No nodeLabel → falls back to the module's display label (better UX than the generic kind default).
    const noLabel = { ...mod, canvas: { ...mod.canvas, nodeLabel: undefined } };
    expect(moduleNodeLabel(noLabel)).toBe(mod.label);
    // No nodeLabel and no module.label → kind default.
    const noKind = { ...mod, label: "", canvas: { ...mod.canvas, nodeLabel: undefined } };
    expect(moduleNodeLabel(noKind)).toBe(NODE_DEFAULT_LABEL[mod.canvas.kind]);
  });

  it("buildPipeline chains N modules with edges", () => {
    const a = ANALYSIS_MODULES[0];
    const b = ANALYSIS_MODULES[1];
    const c = ANALYSIS_MODULES[2];
    const { nodes, edges } = buildPipeline([a, b, c]);
    expect(nodes).toHaveLength(3);
    expect(edges).toHaveLength(2);
    // Each edge connects consecutive nodes
    expect(edges[0].source).toBe(nodes[0].id);
    expect(edges[0].target).toBe(nodes[1].id);
    expect(edges[1].source).toBe(nodes[1].id);
    expect(edges[1].target).toBe(nodes[2].id);
    // Nodes stack vertically
    expect(nodes[1].position.y).toBeGreaterThan(nodes[0].position.y);
    expect(nodes[2].position.y).toBeGreaterThan(nodes[1].position.y);
  });

  it("buildPipeline handles a single module (no edges)", () => {
    const { nodes, edges } = buildPipeline([mod]);
    expect(nodes).toHaveLength(1);
    expect(edges).toHaveLength(0);
  });

  it("buildPipeline handles empty list", () => {
    const { nodes, edges } = buildPipeline([]);
    expect(nodes).toHaveLength(0);
    expect(edges).toHaveLength(0);
  });

  it("appendModuleNode positions to the right of the last existing node", () => {
    const existing: CanvasNode[] = [
      { id: "x", type: "note", position: { x: 100, y: 50 }, data: { kind: "note", label: "n", config: {} } },
    ];
    const { node } = appendModuleNode(mod, existing);
    expect(node.position.x).toBeGreaterThan(100);
  });

  it("appendModuleNode defaults to origin when no existing nodes", () => {
    const { node } = appendModuleNode(mod, []);
    expect(node.position.x).toBeGreaterThanOrEqual(0);
  });
});

/* ------------------------------------------------------ canvasStore.appendGraph */
describe("canvasStore.appendGraph", () => {
  beforeEach(() => {
    localStorage.clear();
    useCanvasStore.getState().clearCanvas();
  });

  it("appends nodes to the existing canvas without clearing", () => {
    const store = useCanvasStore.getState();
    expect(store.nodes.length).toBe(0);
    const mod = ANALYSIS_MODULES[0];
    const node = moduleToNode(mod, { x: 0, y: 0 }, "atlas_test_1");
    const ids = store.appendGraph([node], []);
    expect(ids).toEqual(["atlas_test_1"]);
    expect(useCanvasStore.getState().nodes.length).toBe(1);
  });

  it("remaps duplicate ids to avoid collisions", () => {
    const store = useCanvasStore.getState();
    const mod = ANALYSIS_MODULES[0];
    const n1 = moduleToNode(mod, { x: 0, y: 0 }, "dup");
    store.appendGraph([n1], []);
    const n2 = moduleToNode(mod, { x: 0, y: 0 }, "dup");
    const ids = store.appendGraph([n2], []);
    expect(ids[0]).not.toBe("dup");
    expect(useCanvasStore.getState().nodes.length).toBe(2);
  });

  it("appends a pipeline with edges and remaps edge sources/targets", () => {
    const store = useCanvasStore.getState();
    const { nodes, edges } = buildPipeline([ANALYSIS_MODULES[0], ANALYSIS_MODULES[1]]);
    const ids = store.appendGraph(nodes, edges);
    expect(ids.length).toBe(2);
    const state = useCanvasStore.getState();
    expect(state.nodes.length).toBe(2);
    expect(state.edges.length).toBe(1);
    // edge references the (possibly remapped) node ids
    const e = state.edges[0];
    expect(state.nodes.some((n) => n.id === e.source)).toBe(true);
    expect(state.nodes.some((n) => n.id === e.target)).toBe(true);
  });
});
