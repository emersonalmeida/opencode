import { describe, it, expect, beforeEach } from "vitest";
import { useDesignStore, useVisibleNodes, useVisibleEdges } from "@/lib/designCanvas/store";
import { COMPONENT_REGISTRY, resolveMeta, DESIGN_TOKENS } from "@/lib/designCanvas/registry";
import { resolveDataSource, isDataOrganism } from "@/lib/designCanvas/dataBinding";
import {
  createBlankPage, findNode, replaceNode, insertChild, removeNode, collectRefs,
  bumpVersion, deserializePage, serializePage,
} from "@/lib/designCanvas/pageModel";
import { PAGE_TEMPLATES } from "@/lib/designCanvas/pageTemplates";
import { parseGenerateResult, extractJsonBlock, normalizeOps } from "@/lib/designCanvas/aiOps";
import type { GenerateOp } from "@/lib/designCanvas/aiOps";
import type { DatasetEntry } from "@/lib/datasetStore";
import type { ReviewEntry } from "@/lib/appStoreApi";

function mkEntry(store: "apple" | "google", id: string, n = 5): DatasetEntry {
  const reviews: ReviewEntry[] = Array.from({ length: n }, (_, i) => ({
    id: `r${i}`, store, appId: id, appName: id, author: `u${i}`,
    rating: (i % 5) + 1, title: `t${i}`, text: "texto bom", date: `2026-0${(i % 9) + 1}-1${i}`,
    country: "br",
  }));
  return {
    app: { id, store, name: id, icon: "", developer: "", rating: 4, ratingCount: n, price: "", genre: "", description: "", version: "1", releaseDate: "", currentVersionReleaseDate: "", screenshots: [], url: "" },
    reviews, collectedAt: Date.now(),
  };
}

beforeEach(() => {
  localStorage.clear();
  // Reset the zustand store to a clean state between tests.
  const { setState } = useDesignStore;
  setState({
    nodes: [], edges: [], boards: [{ id: "board_main", name: "Board principal", createdAt: 0, updatedAt: 0 }],
    activeBoard: "board_main", tokenOverrides: {}, snapshots: [],
    selectedId: null, selectedEdgeId: null, snapToGrid: false, showMinimap: true,
    past: [], future: [],
    pages: [], activePageId: null, viewMode: "design", device: "desktop",
  });
});

describe("design canvas registry", () => {
  it("every component meta has props matching its defaults keys", () => {
    for (const meta of Object.values(COMPONENT_REGISTRY)) {
      const defaultKeys = Object.keys(meta.defaults);
      const propKeys = meta.props.map((p) => p.key);
      for (const k of defaultKeys) {
        expect(propKeys, `${meta.kind}.defaults.${k} should be in props`).toContain(k);
      }
    }
  });

  it("resolveMeta falls back to note for unknown kinds", () => {
    expect(resolveMeta("nope").kind).toBe("note");
  });

  it("DESIGN_TOKENS are non-empty and each has a cssVar", () => {
    expect(DESIGN_TOKENS.length).toBeGreaterThan(0);
    for (const t of DESIGN_TOKENS) expect(t.cssVar.length).toBeGreaterThan(0);
  });
});

describe("design canvas store", () => {
  it("addNode adds a node with the component defaults", () => {
    const { addNode } = useDesignStore.getState();
    addNode("button", { x: 10, y: 10 });
    const { nodes } = useDesignStore.getState();
    expect(nodes).toHaveLength(1);
    expect(nodes[0].data.kind).toBe("button");
    expect(nodes[0].data.props.children).toBe("Button");
    expect(nodes[0].data.board).toBe("board_main");
  });

  it("updateNodeProps patches props live", () => {
    const { addNode, updateNodeProps } = useDesignStore.getState();
    addNode("button", { x: 0, y: 0 });
    const id = useDesignStore.getState().nodes[0].id;
    updateNodeProps(id, { children: "Salvar", variant: "destructive" });
    const node = useDesignStore.getState().nodes[0];
    expect(node.data.props.children).toBe("Salvar");
    expect(node.data.props.variant).toBe("destructive");
  });

  it("onConnect wires a prototype-flow edge between two nodes", () => {
    const { addNode, onConnect } = useDesignStore.getState();
    addNode("button", { x: 0, y: 0 });
    addNode("card", { x: 200, y: 0 });
    const [a, b] = useDesignStore.getState().nodes;
    onConnect({ source: a.id, target: b.id, sourceHandle: null, targetHandle: null });
    expect(useDesignStore.getState().edges).toHaveLength(1);
    expect(useDesignStore.getState().edges[0].label).toBe("navigate");
  });

  it("removeNode also removes its connected edges", () => {
    const { addNode, onConnect, removeNode } = useDesignStore.getState();
    addNode("button", { x: 0, y: 0 });
    addNode("card", { x: 200, y: 0 });
    const [a, b] = useDesignStore.getState().nodes;
    onConnect({ source: a.id, target: b.id, sourceHandle: null, targetHandle: null });
    removeNode(a.id);
    expect(useDesignStore.getState().nodes).toHaveLength(1);
    expect(useDesignStore.getState().edges).toHaveLength(0);
  });

  it("undo/redo restores the board state", () => {
    const { addNode, undo, redo } = useDesignStore.getState();
    addNode("button", { x: 0, y: 0 });
    expect(useDesignStore.getState().nodes).toHaveLength(1);
    undo();
    expect(useDesignStore.getState().nodes).toHaveLength(0);
    redo();
    expect(useDesignStore.getState().nodes).toHaveLength(1);
  });

  it("saveSnapshot and restoreSnapshot round-trip the board", () => {
    const { addNode, saveSnapshot, clearBoard, restoreSnapshot } = useDesignStore.getState();
    addNode("badge", { x: 0, y: 0 });
    saveSnapshot("s1");
    clearBoard();
    expect(useDesignStore.getState().nodes).toHaveLength(0);
    const snapId = useDesignStore.getState().snapshots[0].id;
    restoreSnapshot(snapId);
    expect(useDesignStore.getState().nodes).toHaveLength(1);
    expect(useDesignStore.getState().nodes[0].data.kind).toBe("badge");
  });

  it("multiple boards keep their nodes isolated", () => {
    const { addBoard, addNode, setActiveBoard } = useDesignStore.getState();
    addNode("button", { x: 0, y: 0 }); // board_main
    const board2 = addBoard("Board 2");
    setActiveBoard(board2);
    addNode("badge", { x: 0, y: 0 });
    const s = useDesignStore.getState();
    const visible = s.nodes.filter((n) => (n.data.board ?? "board_main") === s.activeBoard);
    expect(visible).toHaveLength(1);
    expect(visible[0].data.kind).toBe("badge");
  });

  it("token overrides are applied scoped and resettable", () => {
    const { setTokenOverride, resetTokens, tokenOverrides } = useDesignStore.getState();
    setTokenOverride(DESIGN_TOKENS[0], "0 0% 50%");
    expect(useDesignStore.getState().tokenOverrides[DESIGN_TOKENS[0].cssVar]).toBe("0 0% 50%");
    resetTokens();
    expect(Object.keys(useDesignStore.getState().tokenOverrides)).toHaveLength(0);
    // referenced to avoid unused warning
    expect(tokenOverrides).toBeDefined();
  });

  it("duplicateNode clones props independently", () => {
    const { addNode, duplicateNode, updateNodeProps } = useDesignStore.getState();
    addNode("input", { x: 0, y: 0 });
    const original = useDesignStore.getState().nodes[0];
    duplicateNode(original.id);
    const nodes = useDesignStore.getState().nodes;
    expect(nodes).toHaveLength(2);
    const dup = nodes[1];
    updateNodeProps(dup.id, { placeholder: "alterado" });
    expect(useDesignStore.getState().nodes[0].data.props.placeholder).not.toBe("alterado");
  });
});

describe("registry expansion (page builder)", () => {
  it("exposes the new shadcn molecules and data organisms", () => {
    const kinds = Object.keys(COMPONENT_REGISTRY);
    for (const k of ["tabs", "table", "progress", "accordion", "slider", "avatar", "dialog", "breadcrumb", "pagination", "calendar", "toggle-group", "tooltip"]) {
      expect(kinds, `expected ${k}`).toContain(k);
    }
    for (const k of ["kpi-card", "rating-chart", "sentiment-chart", "timeline-chart", "store-comparison", "word-cloud", "reviews-list", "app-card", "per-app-table", "markdown", "ai-analysis"]) {
      expect(kinds, `expected ${k}`).toContain(k);
    }
  });

  it("data organisms are flagged dataBound and have a dataSource prop", () => {
    for (const k of ["kpi-card", "rating-chart", "reviews-list", "per-app-table"]) {
      const meta = resolveMeta(k);
      expect(meta.dataBound).toBe(true);
      expect(meta.props.some((p) => p.type === "dataSource")).toBe(true);
    }
  });

  it("non-data organisms are not flagged dataBound", () => {
    expect(resolveMeta("button").dataBound).toBeFalsy();
    expect(isDataOrganism("button")).toBe(false);
    expect(isDataOrganism("rating-chart")).toBe(true);
  });

  it("every meta's defaults keys appear in props", () => {
    for (const meta of Object.values(COMPONENT_REGISTRY)) {
      for (const k of Object.keys(meta.defaults)) {
        expect(meta.props.map((p) => p.key), `${meta.kind}.defaults.${k}`).toContain(k);
      }
    }
  });
});

describe("data binding", () => {
  const entries = [mkEntry("apple", "111", 4), mkEntry("google", "com.foo", 6)];

  it("'all' returns every entry and all reviews", () => {
    const r = resolveDataSource("all", entries, new Set());
    expect(r.entries).toHaveLength(2);
    expect(r.reviews).toHaveLength(10);
    expect(r.empty).toBe(false);
  });

  it("'selected' honors the global selection", () => {
    const r = resolveDataSource("selected", entries, new Set(["apple:111"]));
    expect(r.entries).toHaveLength(1);
    expect(r.entries[0].app.id).toBe("111");
  });

  it("'selected' with empty selection falls back to all", () => {
    const r = resolveDataSource("selected", entries, new Set());
    expect(r.entries).toHaveLength(2);
    expect(r.label).toContain("sem seleção");
  });

  it("'app:<key>' pins a single app", () => {
    const r = resolveDataSource("app:google:com.foo", entries, new Set());
    expect(r.entries).toHaveLength(1);
    expect(r.entries[0].app.store).toBe("google");
  });

  it("unknown source defaults gracefully (empty entries)", () => {
    const r = resolveDataSource("app:google:nope", entries, new Set());
    expect(r.empty).toBe(true);
    expect(r.reviews).toHaveLength(0);
  });
});

describe("page model", () => {
  it("createBlankPage yields page→section→column", () => {
    const p = createBlankPage("Teste");
    expect(p.root.kind).toBe("page");
    expect(p.version).toBe(1);
    expect(p.root.children[0].kind).toBe("section");
    expect(p.root.children[0].children[0].kind).toBe("column");
  });

  it("insertChild + collectRefs track component leaves", () => {
    const p = createBlankPage("T");
    const colId = p.root.children[0].children[0].id;
    const next = insertChild(p.root, colId, { id: "leaf1", kind: "component", ref: "nodeA", children: [] });
    expect(findNode(next, "leaf1")).not.toBeNull();
    expect(collectRefs(next)).toEqual(["nodeA"]);
  });

  it("removeNode prunes a leaf from the tree", () => {
    const p = createBlankPage("T");
    const colId = p.root.children[0].children[0].id;
    const withLeaf = insertChild(p.root, colId, { id: "leaf1", kind: "component", ref: "n", children: [] });
    const pruned = removeNode(withLeaf, "leaf1");
    expect(collectRefs(pruned)).toHaveLength(0);
  });

  it("replaceNode updates a container", () => {
    const p = createBlankPage("T");
    const updated = replaceNode(p.root, p.root.id, (n) => ({ ...n, gap: 99 }));
    expect(findNode(updated, p.root.id)?.gap).toBe(99);
  });

  it("serialize/deserialize round-trips a page", () => {
    const p = createBlankPage("RT");
    const json = serializePage(p);
    const back = deserializePage(json);
    expect(back).not.toBeNull();
    expect(back!.name).toBe("RT");
    expect(back!.root.kind).toBe("page");
  });

  it("bumpVersion archives the previous root and increments", () => {
    const p = createBlankPage("V");
    const newRoot = { ...p.root, gap: 30 };
    const v2 = bumpVersion(p, newRoot);
    expect(v2.version).toBe(2);
    expect(v2.history).toHaveLength(1);
    expect(v2.history[0].version).toBe(1);
  });

  it("templates build a page + materialized nodes", () => {
    for (const tpl of PAGE_TEMPLATES) {
      const { page, nodes, edges } = tpl.build();
      expect(page.root.kind).toBe("page");
      expect(nodes.length).toBeGreaterThan(0);
      expect(edges).toBeDefined();
      // All component refs in the page resolve to a built node.
      const ids = new Set(nodes.map((n) => n.id));
      for (const ref of collectRefs(page.root)) expect(ids.has(ref)).toBe(true);
    }
  });
});

describe("AI ops parsing", () => {
  it("extractJsonBlock finds the first balanced object", () => {
    expect(extractJsonBlock("prose [{\"a\":1}]")).toBe("[{\"a\":1}]");
    expect(extractJsonBlock("no json here")).toBeNull();
  });

  it("normalizeOps accepts array and {ops:[]} shapes", () => {
    expect(normalizeOps([{ type: "add", kind: "button" }])).toHaveLength(1);
    expect(normalizeOps({ ops: [{ type: "note", text: "hi" }] })).toHaveLength(1);
  });

  it("parseGenerateResult returns ops + prose from mixed text", () => {
    const text = 'Pronto! ```json\n[{"type":"add","kind":"kpi-card","label":"KPI","dataSource":"all"}]\n```';
    const res = parseGenerateResult(text);
    expect(res.ops).toHaveLength(1);
    expect(res.ops[0].type).toBe("add");
    if (res.ops[0].type === "add") expect(res.ops[0].kind).toBe("kpi-card");
  });

  it("applyGenerateOps adds nodes to the store", () => {
    const { applyGenerateOps, nodes: _n } = useDesignStore.getState();
    const ids = applyGenerateOps([
      { type: "add", kind: "button", label: "CTA", props: { children: "OK" } },
      { type: "note", text: "gerado" },
    ] as GenerateOp[]);
    expect(ids).toHaveLength(2);
    expect(useDesignStore.getState().nodes.length).toBeGreaterThanOrEqual(2);
  });

  it("applyGenerateOps respects dataSource binding", () => {
    const { applyGenerateOps } = useDesignStore.getState();
    const ids = applyGenerateOps([{ type: "add", kind: "rating-chart", dataSource: "all" }] as GenerateOp[]);
    const node = useDesignStore.getState().nodes.find((n) => n.id === ids[0]);
    expect(node?.data.props.dataSource).toBe("all");
  });
});

describe("page builder store", () => {
  it("createPage adds a page and sets it active", () => {
    const { createPage } = useDesignStore.getState();
    const id = createPage("P1");
    const s = useDesignStore.getState();
    expect(s.pages).toHaveLength(1);
    expect(s.activePageId).toBe(id);
    expect(s.pages[0].name).toBe("P1");
  });

  it("loadTemplate materializes a page + nodes", () => {
    const { loadTemplate } = useDesignStore.getState();
    loadTemplate("tpl-dashboard");
    const s = useDesignStore.getState();
    expect(s.pages.length).toBeGreaterThanOrEqual(1);
    expect(s.activePageId).not.toBeNull();
    expect(s.nodes.length).toBeGreaterThan(0);
  });

  it("viewMode + device toggle and persist", () => {
    const { setViewMode, setDevice } = useDesignStore.getState();
    setViewMode("preview");
    setDevice("mobile");
    expect(useDesignStore.getState().viewMode).toBe("preview");
    expect(useDesignStore.getState().device).toBe("mobile");
  });
});
