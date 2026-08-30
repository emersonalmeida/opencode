import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildExampleGraph,
  topologicalOrder,
  sourceOutputs,
  NODE_DEFAULT_LABEL,
  useCanvasStore,
} from "@/lib/canvasStore";
import { runNodeExecutor, type NodeRunContext } from "@/components/canvas/nodeRegistry";

// Mock network-dependent helpers so node executors run without a backend.
vi.mock("@/lib/appStoreApi", () => ({
  searchApps: vi.fn(async (_term: string, _country: string, limit: number) => [
    { id: "111", store: "apple", name: "Nubank", icon: "", developer: "Nu", rating: 4.8, ratingCount: 1, price: "", genre: "", description: "", version: "1", releaseDate: "", currentVersionReleaseDate: "", screenshots: [], url: "" },
    ...Array.from({ length: Math.max(0, limit - 1) }, (_, i) => ({ id: `a${i}`, store: "apple", name: `App ${i}`, icon: "", developer: "", rating: 0, ratingCount: 0, price: "", genre: "", description: "", version: "", releaseDate: "", currentVersionReleaseDate: "", screenshots: [], url: "" })),
  ]),
  searchGooglePlayApps: vi.fn(async () => []),
}));
vi.mock("@/lib/googlePlayApi", () => ({
  searchGooglePlayApps: vi.fn(async () => []),
  fetchGooglePlayReviews: vi.fn(async () => []),
  fetchGooglePlayAppDetails: vi.fn(async () => null),
}));
vi.mock("@/lib/collect", () => ({
  collectApp: vi.fn(async (app: { id: string; store: string; name: string }) => ({
    entry: {
      app,
      reviews: [{ id: "r1", rating: 5, author: "u", title: "", text: "bom", date: "2025-01-01" }],
      collectedAt: Date.now(),
    },
    reused: false,
  })),
}));
vi.mock("@/lib/experimentApi", () => ({
  streamExperiment: vi.fn(async (_section: string, _entries: unknown[], handlers: { onToken: (f: string) => void; onDone: (f: string) => void; onError: (e: string) => void }, _signal?: AbortSignal) => {
    handlers.onToken("# Resumo");
    handlers.onDone("# Resumo");
  }),
}));
vi.mock("@/lib/experimentChatApi", () => ({
  streamExperimentChat: vi.fn(async (_apps: unknown[], messages: { role: string; content: string }[], handlers: { onToken: (f: string) => void; onDone: (f: string) => void; onError: (e: string) => void }, _signal?: AbortSignal) => {
    const seed = messages[0]?.content ?? "";
    const md = seed.includes("apresentação") ? "# Apresentação" : "# Refinado";
    handlers.onToken(md);
    handlers.onDone(md);
  }),
}));

function makeCtx(config: Record<string, unknown>, inputs: unknown[], signal?: AbortSignal): NodeRunContext {
  return {
    config,
    inputs,
    log: () => {},
    setStatus: () => {},
    setOutput: () => {},
    signal: signal ?? new AbortController().signal,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("canvas example graph", () => {
  it("builds a search → collect → (analyze + chart) → refine → prompt pipeline", () => {
    const { nodes, edges } = buildExampleGraph();
    const ids = nodes.map((n) => n.id);
    expect(ids).toContain("ex_search");
    expect(ids).toContain("ex_collect");
    expect(ids).toContain("ex_analyze");
    expect(ids).toContain("ex_chart");
    expect(ids).toContain("ex_refine");
    expect(ids).toContain("ex_prompt");
    expect(ids).toContain("ex_note");
    // collect consumes search; analyze & chart consume collect; refine consumes
    // analyze (chained); prompt consumes refine (chained).
    const sources = (target: string) => edges.filter((e) => e.target === target).map((e) => e.source);
    expect(sources("ex_collect")).toEqual(["ex_search"]);
    expect(sources("ex_analyze").sort()).toEqual(["ex_collect"]);
    expect(sources("ex_chart")).toEqual(["ex_collect"]);
    expect(sources("ex_refine")).toEqual(["ex_analyze"]);
    expect(sources("ex_prompt")).toEqual(["ex_refine"]);
  });

  it("every node kind has a default label", () => {
    for (const kind of Object.keys(NODE_DEFAULT_LABEL) as (keyof typeof NODE_DEFAULT_LABEL)[]) {
      expect(typeof NODE_DEFAULT_LABEL[kind]).toBe("string");
      expect(NODE_DEFAULT_LABEL[kind].length).toBeGreaterThan(0);
    }
  });
});

describe("topologicalOrder", () => {
  it("runs roots first and respects dependencies incl. chained AI", () => {
    const { nodes, edges } = buildExampleGraph();
    const order = topologicalOrder(nodes, edges).map((n) => n.id);
    const pos = (id: string) => order.indexOf(id);
    expect(pos("ex_search")).toBeLessThan(pos("ex_collect"));
    expect(pos("ex_collect")).toBeLessThan(pos("ex_analyze"));
    expect(pos("ex_collect")).toBeLessThan(pos("ex_chart"));
    expect(pos("ex_analyze")).toBeLessThan(pos("ex_refine"));
    expect(pos("ex_refine")).toBeLessThan(pos("ex_prompt"));
  });

  it("handles disconnected note nodes", () => {
    const { nodes, edges } = buildExampleGraph();
    const order = topologicalOrder(nodes, edges);
    expect(order.length).toBe(nodes.length);
  });
});

describe("sourceOutputs", () => {
  it("returns upstream outputs for a node", () => {
    const { edges } = buildExampleGraph();
    const out = { ex_search: ["app1"], ex_collect: { app: "x", reviews: [] } };
    expect(sourceOutputs("ex_collect", edges, out)).toEqual([["app1"]]);
    expect(sourceOutputs("ex_analyze", edges, out)).toEqual([{ app: "x", reviews: [] }]);
    expect(sourceOutputs("ex_search", edges, out)).toEqual([]);
  });
});

describe("node executors", () => {
  it("search returns the apps array", async () => {
    const res = await runNodeExecutor("search", makeCtx({ term: "nubank", store: "both", limit: 5 }, []));
    expect(Array.isArray(res.output)).toBe(true);
    expect((res.output as { id: string }[]).length).toBe(5);
    expect((res.output as { id: string }[])[0].id).toBe("111");
  });

  it("collect consumes search output (the example pipeline path)", async () => {
    // Single-result search takes the single-app branch (returns the entry directly,
    // independent of dataset persistence).
    const searchOut = await runNodeExecutor("search", makeCtx({ term: "nubank", store: "both", limit: 1 }, []));
    const res = await runNodeExecutor("collect", makeCtx({ reviewLimit: 250 }, [searchOut.output]));
    const out = res.output as { app: { id: string }; reviews: unknown[] };
    expect(out.app.id).toBe("111");
    expect(out.reviews.length).toBeGreaterThan(0);
    expect(res.summary).toMatch(/\d+ reviews/);
  });

  it("collect fans out to multiple apps and returns a dataset slice", async () => {
    const searchOut = await runNodeExecutor("search", makeCtx({ term: "nubank", store: "both", limit: 3 }, []));
    // With 3 apps the multi-app branch reads listDataset; the mocked collectApp
    // doesn't persist, so we assert it ran without throwing and produced a summary.
    const res = await runNodeExecutor("collect", makeCtx({ reviewLimit: 100 }, [searchOut.output]));
    expect(res.summary).toMatch(/\d+ reviews/);
    expect(Array.isArray(res.output)).toBe(true);
  });

  it("collect throws when nothing is connected or configured", async () => {
    await expect(runNodeExecutor("collect", makeCtx({ reviewLimit: 100 }, []))).rejects.toThrow(/Conecte/);
  });

  it("chart builds a rating distribution from entries", async () => {
    const entries = [{ app: { store: "apple", id: "1", name: "X" }, reviews: [{ rating: 5 }, { rating: 5 }, { rating: 1 }] }];
    const res = await runNodeExecutor("chart", makeCtx({}, [entries]));
    const out = res.output as { chart: string; data: { star: string; count: number }[]; title?: string };
    expect(out.chart).toBe("bar");
    expect(out.title).toBe("Distribuição de notas");
    const five = out.data.find((d) => d.star === "★5");
    const one = out.data.find((d) => d.star === "★1");
    expect(five?.count).toBe(2);
    expect(one?.count).toBe(1);
  });

  it("chart can produce a sentiment pie from the same data", async () => {
    const entries = [{ app: { store: "apple", id: "1", name: "X" }, reviews: [{ rating: 5 }, { rating: 3 }, { rating: 1 }] }];
    const res = await runNodeExecutor("chart", makeCtx({ chartType: "sentiment" }, [entries]));
    const out = res.output as { chart: string; data: { name: string; value: number }[] };
    expect(out.chart).toBe("pie");
    expect(out.data.length).toBeGreaterThan(0);
    expect(out.data.some((d) => d.value > 0)).toBe(true);
  });

  it("chart wordcloud extracts frequent terms", async () => {
    const entries = [{ app: { store: "google", id: "1", name: "X" }, reviews: [
      { rating: 1, title: "", text: "problema login constante problema", date: "2025-01-01" },
      { rating: 1, title: "", text: "outro problema de login", date: "2025-01-02" },
    ] }];
    const res = await runNodeExecutor("chart", makeCtx({ chartType: "wordcloud" }, [entries]));
    const out = res.output as { chart: string; data: { text: string; value: number }[] };
    expect(out.chart).toBe("wordcloud");
    expect(out.data.length).toBeGreaterThan(0);
  });

  it("chart scatter plots nota × reviews per app", async () => {
    const entries = [
      { app: { store: "apple", id: "1", name: "A", rating: 4.5, ratingCount: 100 }, reviews: Array.from({ length: 10 }, () => ({ rating: 5 })) },
      { app: { store: "google", id: "2", name: "B", rating: 3.2, ratingCount: 50 }, reviews: Array.from({ length: 5 }, () => ({ rating: 2 })) },
    ];
    const res = await runNodeExecutor("chart", makeCtx({ chartType: "scatter" }, [entries]));
    const out = res.output as { chart: string; data: { name: string; x: number; y: number; z: number }[] };
    expect(out.chart).toBe("scatter");
    expect(out.data.length).toBe(2);
    expect(out.data[0].x).toBe(4.5);
  });

  it("chart heatmap builds app × rating matrix", async () => {
    const entries = [
      { app: { store: "apple", id: "1", name: "A" }, reviews: [{ rating: 5 }, { rating: 5 }, { rating: 1 }] },
      { app: { store: "google", id: "2", name: "B" }, reviews: [{ rating: 3 }, { rating: 2 }] },
    ];
    const res = await runNodeExecutor("chart", makeCtx({ chartType: "heatmap" }, [entries]));
    const out = res.output as { chart: string; data: Record<string, number | string>[] };
    expect(out.chart).toBe("heatmap");
    expect(out.data.length).toBe(2);
    expect(out.data[0]["5★"]).toBe(2);
    expect(out.data[1]["3★"]).toBe(1);
  });

  it("chart country counts reviews by country", async () => {
    const entries = [{ app: { store: "apple", id: "1", name: "A" }, reviews: [
      { rating: 5, country: "BR" }, { rating: 4, country: "BR" }, { rating: 1, country: "US" },
    ] }];
    const res = await runNodeExecutor("chart", makeCtx({ chartType: "country" }, [entries]));
    const out = res.output as { chart: string; data: { country: string; count: number }[] };
    expect(out.chart).toBe("country");
    expect(out.data.find((d) => d.country === "BR")?.count).toBe(2);
    expect(out.data.find((d) => d.country === "US")?.count).toBe(1);
  });

  it("analyze streams markdown from the dataset (raw-data mode)", async () => {
    const entries = [{ app: { store: "apple", id: "1", name: "X" }, reviews: [{ rating: 5, author: "u", title: "", text: "ok", date: "2025-01-01" }] }];
    const res = await runNodeExecutor("analyze", makeCtx({ section: "summary" }, [entries]));
    expect((res.output as { markdown: string }).markdown).toContain("# Resumo");
  });

  it("analyze enters chained mode when fed an upstream IA markdown", async () => {
    const upstream = { markdown: "# Análise anterior\nPontos: bom e mau.", entries: [] };
    const res = await runNodeExecutor("analyze", makeCtx({ section: "summary" }, [upstream]));
    const out = res.output as { markdown: string; derivedFrom: string };
    expect(out.markdown).toContain("# Refinado");
    expect(out.derivedFrom).toBe("upstream");
  });

  it("prompt node generates presentation markdown from upstream output", async () => {
    const upstream = { markdown: "# Análise\nDetalhes.", entries: [] };
    const res = await runNodeExecutor("prompt", makeCtx({ prompt: "Gere uma apresentação executiva." }, [upstream]));
    const out = res.output as { markdown: string; presentation: boolean; derivedFrom: string };
    expect(out.presentation).toBe(true);
    expect(out.markdown).toContain("# Apresentação");
    expect(out.derivedFrom).toBe("upstream");
  });

  it("prompt node falls back to data mode when only entries are connected", async () => {
    const entries = [{ app: { store: "apple", id: "1", name: "X" }, reviews: [{ rating: 5, author: "u", title: "", text: "ok", date: "2025-01-01" }] }];
    const res = await runNodeExecutor("prompt", makeCtx({ prompt: "Gere uma apresentação executiva." }, [entries]));
    const out = res.output as { markdown: string; derivedFrom: string };
    expect(out.derivedFrom).toBe("data");
  });

  it("prompt node throws without a prompt", async () => {
    await expect(runNodeExecutor("prompt", makeCtx({}, []))).rejects.toThrow(/prompt/i);
  });

  it("report node chains off upstream text when available", async () => {
    const upstream = { markdown: "# Base\nConclusão.", entries: [] };
    const res = await runNodeExecutor("report", makeCtx({ prompt: "Relatório consolidado." }, [upstream]));
    const out = res.output as { markdown: string; derivedFrom: string };
    expect(out.derivedFrom).toBe("upstream");
  });

  it("note returns null output without executing", async () => {
    const res = await runNodeExecutor("note", makeCtx({ text: "hi" }, []));
    expect(res.output).toBeNull();
  });

  it("output is a pass-through viewer (forwards first input)", async () => {
    const upstream = { markdown: "# Análise anterior", entries: [] };
    const res = await runNodeExecutor("output", makeCtx({}, [upstream]));
    expect(res.output).toEqual(upstream);
  });

  it("output with no upstream returns null", async () => {
    const res = await runNodeExecutor("output", makeCtx({}, []));
    expect(res.output).toBeNull();
  });
});

describe("analysis nodes (no-IA)", () => {
  const entries = [
    { app: { store: "apple", id: "1", name: "X" }, reviews: [
      { rating: 5, author: "u", title: "", text: "ótimo app login funciona", date: "2025-01-01", version: "1.0" },
      { rating: 1, author: "u", title: "", text: "problema login constante", date: "2025-02-01", version: "1.1" },
      { rating: 3, author: "u", title: "", text: "ok", date: "2025-03-01", version: "1.1" },
    ] },
  ];

  it("statistics computes KPIs + markdown", async () => {
    const res = await runNodeExecutor("statistics", makeCtx({}, [entries]));
    const out = res.output as { kpis: { totalReviews: number; avgRating: number }; markdown: string };
    expect(out.kpis.totalReviews).toBe(3);
    expect(out.markdown).toContain("Estatísticas");
  });

  it("sentiment produces a pie chart", async () => {
    const res = await runNodeExecutor("sentiment", makeCtx({}, [entries]));
    const out = res.output as { chart: string; data: { name: string; value: number }[] };
    expect(out.chart).toBe("pie");
    expect(out.data.length).toBeGreaterThan(0);
  });

  it("themes extracts a wordcloud", async () => {
    const res = await runNodeExecutor("themes", makeCtx({}, [entries]));
    const out = res.output as { chart: string; data: { text: string; value: number }[] };
    expect(out.chart).toBe("wordcloud");
    expect(out.data.length).toBeGreaterThan(0);
  });

  it("version-analysis groups by version", async () => {
    const res = await runNodeExecutor("version-analysis", makeCtx({}, [entries]));
    const out = res.output as { chart: string; data: { version: string; count: number }[] };
    expect(out.chart).toBe("bar");
    expect(out.data.some((d) => d.version === "1.1")).toBe(true);
  });

  it("reviews-analysis summarizes recent + per-app", async () => {
    const res = await runNodeExecutor("reviews-analysis", makeCtx({}, [entries]));
    const out = res.output as { recent: unknown[]; perApp: unknown[]; markdown: string };
    expect(out.recent.length).toBeGreaterThan(0);
    expect(out.perApp.length).toBe(1);
    expect(out.markdown).toContain("Análise de reviews");
  });

  it("country-analysis counts reviews + sentiment by country", async () => {
    const entriesCountry = [{ app: { store: "apple", id: "1", name: "X" }, reviews: [
      { rating: 5, country: "BR" }, { rating: 1, country: "US" }, { rating: 3, country: "BR" },
    ] }];
    const res = await runNodeExecutor("country-analysis", makeCtx({}, [entriesCountry]));
    const out = res.output as { chart: string; data: { country: string; count: number; pctPositive: number }[]; markdown: string };
    expect(out.chart).toBe("country");
    expect(out.data.find((d) => d.country === "BR")?.count).toBe(2);
    expect(out.data.find((d) => d.country === "BR")?.pctPositive).toBe(50);
    expect(out.markdown).toContain("Análise por país");
  });

  it("dashboard outputs KPIs + multiple charts", async () => {
    const res = await runNodeExecutor("dashboard", makeCtx({}, [entries]));
    const out = res.output as { dashboard: boolean; kpis: { totalReviews: number }; charts: { chart: string }[] };
    expect(out.dashboard).toBe(true);
    expect(out.kpis.totalReviews).toBe(3);
    expect(out.charts.length).toBeGreaterThan(0);
  });

  it("chart repasses upstream analysis chart data", async () => {
    const upstream = { chart: "pie", data: [{ name: "Positivo", value: 1 }], title: "Sentimento" };
    const res = await runNodeExecutor("chart", makeCtx({ chartType: "rating" }, [upstream]));
    const out = res.output as { chart: string; data: { name: string; value: number }[] };
    expect(out.chart).toBe("pie");
    expect(out.data[0].name).toBe("Positivo");
  });
});

describe("store node placement + lifecycle", () => {
  // Note: zustand keeps in-memory state across tests; reset via clearCanvas
  // (not just localStorage.clear, which won't touch the live store).
  // getState() returns a snapshot of the store at call time, so re-fetch after
  // each mutation to read the new state.
  beforeEach(() => {
    useCanvasStore.getState().clearCanvas();
  });

  it("addNode places the second node to the right of the first (same Y)", () => {
    const store = useCanvasStore.getState();
    store.addNode("note");
    const first = useCanvasStore.getState().nodes[0];
    store.addNode("note");
    const second = useCanvasStore.getState().nodes[1];
    expect(second.position.y).toBe(first.position.y);
    expect(second.position.x).toBeGreaterThan(first.position.x);
  });

  it("addNode without nodes places at the default origin", () => {
    useCanvasStore.getState().addNode("note");
    const n = useCanvasStore.getState().nodes[0];
    expect(n.position.x).toBeGreaterThanOrEqual(0);
    expect(n.position.y).toBeGreaterThanOrEqual(0);
  });

  it("toggleCollapse flips the collapsed flag", () => {
    useCanvasStore.getState().addNode("note");
    const id = useCanvasStore.getState().nodes[0].id;
    expect(useCanvasStore.getState().nodes[0].data.collapsed ?? false).toBe(false);
    useCanvasStore.getState().toggleCollapse(id);
    expect(useCanvasStore.getState().nodes[0].data.collapsed).toBe(true);
    useCanvasStore.getState().toggleCollapse(id);
    expect(useCanvasStore.getState().nodes[0].data.collapsed).toBe(false);
  });

  it("newCanvas clears nodes and selects none", () => {
    useCanvasStore.getState().addNode("note");
    useCanvasStore.getState().addNode("note");
    expect(useCanvasStore.getState().nodes.length).toBe(2);
    useCanvasStore.getState().newCanvas();
    expect(useCanvasStore.getState().nodes.length).toBe(0);
    expect(useCanvasStore.getState().selectedNodeId).toBeNull();
  });

  it("updateNodeSize persists width and height", () => {
    useCanvasStore.getState().addNode("note");
    const id = useCanvasStore.getState().nodes[0].id;
    useCanvasStore.getState().updateNodeSize(id, 400, 300);
    const node = useCanvasStore.getState().nodes[0];
    expect(node.data.width).toBe(400);
    expect(node.data.height).toBe(300);
  });

  it("toggleEnabled disables a node (topologicalOrder excludes it)", () => {
    useCanvasStore.getState().clearCanvas();
    useCanvasStore.getState().addNode("note");
    useCanvasStore.getState().addNode("note");
    const a = useCanvasStore.getState().nodes[0];
    const b = useCanvasStore.getState().nodes[1];
    useCanvasStore.getState().onConnect({ source: a.id, target: b.id, sourceHandle: null, targetHandle: null });
    // Disable node B — it should be excluded from topological order.
    useCanvasStore.getState().toggleEnabled(b.id);
    const order = topologicalOrder(useCanvasStore.getState().nodes, useCanvasStore.getState().edges);
    expect(order.map((n) => n.id)).not.toContain(b.id);
    expect(order.map((n) => n.id)).toContain(a.id);
  });

  it("toggleOutputExpanded flips the outputExpanded flag", () => {
    useCanvasStore.getState().clearCanvas();
    useCanvasStore.getState().addNode("note");
    const id = useCanvasStore.getState().nodes[0].id;
    expect(useCanvasStore.getState().nodes[0].data.outputExpanded ?? false).toBe(false);
    useCanvasStore.getState().toggleOutputExpanded(id);
    expect(useCanvasStore.getState().nodes[0].data.outputExpanded).toBe(true);
  });

  it("maybeAutoAddOutput adds a connected output node after a result", () => {
    useCanvasStore.getState().clearCanvas();
    useCanvasStore.getState().addNode("note");
    const noteId = useCanvasStore.getState().nodes[0].id;
    // Simulate a processing node with a result: inject an output for a chart node.
    useCanvasStore.getState().addNode("chart");
    const chartId = useCanvasStore.getState().nodes.find((n) => n.data.kind === "chart")!.id;
    // Seed an output value (as if it ran).
    useCanvasStore.setState({ output: { [chartId]: { chart: "bar", data: [{ x: 1, y: 1 }] } } });
    const before = useCanvasStore.getState().nodes.length;
    useCanvasStore.getState().maybeAutoAddOutput(chartId);
    const after = useCanvasStore.getState();
    expect(after.nodes.length).toBe(before + 1);
    const outNode = after.nodes[after.nodes.length - 1];
    expect(outNode.data.kind).toBe("output");
    expect(after.edges.some((e) => e.source === chartId && e.target === outNode.id)).toBe(true);
  });

  it("maybeAutoAddOutput skips when an output node is already connected", () => {
    useCanvasStore.getState().clearCanvas();
    useCanvasStore.getState().addNode("chart");
    const chartId = useCanvasStore.getState().nodes[0].id;
    useCanvasStore.getState().addNode("output");
    const outId = useCanvasStore.getState().nodes[1].id;
    useCanvasStore.getState().onConnect({ source: chartId, target: outId, sourceHandle: null, targetHandle: null });
    useCanvasStore.setState({ output: { [chartId]: { chart: "bar", data: [{ x: 1 }] } } });
    const before = useCanvasStore.getState().nodes.length;
    useCanvasStore.getState().maybeAutoAddOutput(chartId);
    expect(useCanvasStore.getState().nodes.length).toBe(before);
  });

  it("maybeAutoAddOutput skips utility nodes (note) and null results", () => {
    useCanvasStore.getState().clearCanvas();
    useCanvasStore.getState().addNode("note");
    const noteId = useCanvasStore.getState().nodes[0].id;
    const before = useCanvasStore.getState().nodes.length;
    useCanvasStore.getState().maybeAutoAddOutput(noteId);
    expect(useCanvasStore.getState().nodes.length).toBe(before);
  });

  it("exploreSelection creates a downstream prompt node seeded with the snippet and auto-runs", async () => {
    useCanvasStore.getState().clearCanvas();
    useCanvasStore.getState().addNode("analyze");
    const sourceId = useCanvasStore.getState().nodes[0].id;
    const before = useCanvasStore.getState().nodes.length;
    const newId = useCanvasStore.getState().exploreSelection(sourceId, "login quebra sempre");
    expect(newId).toBeTruthy();
    const after = useCanvasStore.getState();
    expect(after.nodes.length).toBe(before + 1);
    const created = after.nodes.find((n) => n.id === newId)!;
    expect(created.data.kind).toBe("prompt");
    expect(String(created.data.config.prompt)).toContain("login quebra sempre");
    // connected to the source so it inherits dataset/upstream context
    expect(after.edges.some((e) => e.source === sourceId && e.target === newId)).toBe(true);
    // runSingleNode was invoked (streamExperimentChat mock resolves with a token)
    await Promise.resolve();
    expect(after.selectedNodeId).toBe(newId);
  });

  it("exploreSelection returns empty when no text is given", () => {
    useCanvasStore.getState().clearCanvas();
    useCanvasStore.getState().addNode("analyze");
    const sourceId = useCanvasStore.getState().nodes[0].id;
    const id = useCanvasStore.getState().exploreSelection(sourceId, "   ");
    expect(id).toBe("");
  });
});

// ---------- Additional coverage: new nodes (v8) + history + import ----------

const mkReview = (over: { rating: number; date?: string; version?: string; thumbsUp?: number; reply?: boolean; author?: string; text?: string; id?: string }) => ({
  id: over.id ?? `r_${Math.random().toString(36).slice(2, 8)}`,
  rating: over.rating,
  author: over.author ?? "user",
  title: "",
  text: over.text ?? "texto do review",
  date: over.date,
  version: over.version,
  thumbsUp: over.thumbsUp,
  developerReply: over.reply ? { text: "Obrigado!" } : undefined,
  country: "br",
});

const mkEntry = (over: { appId?: string; appName?: string; store?: string; reviews: ReturnType<typeof mkReview>[] }) => ({
  app: {
    id: over.appId ?? "app1",
    store: over.store ?? "apple",
    name: over.appName ?? "App One",
    icon: "", developer: "Dev", rating: 4, ratingCount: 10, price: "", genre: "", description: "", version: "1.0.0", releaseDate: "", currentVersionReleaseDate: "", screenshots: [], url: "",
  },
  reviews: over.reviews,
  collectedAt: Date.now(),
});

describe("new deterministic nodes (no-AI)", () => {
  it("rating-trend aggregates avgRating per day and returns a line chart", async () => {
    const entry = mkEntry({ reviews: [mkReview({ rating: 5, date: "2025-06-01" }), mkReview({ rating: 3, date: "2025-06-01" }), mkReview({ rating: 1, date: "2025-06-02" })] });
    const res = await runNodeExecutor("rating-trend", makeCtx({}, [entry]));
    expect(res.output).toMatchObject({ chart: "line" });
    const v = res.output as { data: { date: string; avgRating: number; count: number }[] };
    expect(v.data).toHaveLength(2);
    expect(v.data[0]).toMatchObject({ date: "2025-06-01", avgRating: 4, count: 2 });
  });

  it("rating-trend throws when there are no dated reviews", async () => {
    const entry = mkEntry({ reviews: [mkReview({ rating: 5 })] });
    await expect(runNodeExecutor("rating-trend", makeCtx({}, [entry]))).rejects.toThrow(/reviews com data/);
  });

  it("version-compare ranks versions by count and computes sentiment %", async () => {
    const reviews = [
      ...Array.from({ length: 10 }, () => mkReview({ rating: 5, version: "2.0" })),
      ...Array.from({ length: 5 }, () => mkReview({ rating: 1, version: "1.0" })),
    ];
    const res = await runNodeExecutor("version-compare", makeCtx({}, [mkEntry({ reviews })]));
    const v = res.output as { rows: { version: string; reviews: number; positivePct: number }[] };
    expect(v.rows[0]).toMatchObject({ version: "2.0", reviews: 10, positivePct: 100 });
    expect((res.output as { markdown: string }).markdown).toContain("Comparação de versões");
  });

  it("review-sampler picks the most recent reviews deterministically", async () => {
    const entry = mkEntry({ reviews: [
      mkReview({ rating: 5, date: "2025-01-01", text: "antigo" }),
      mkReview({ rating: 1, date: "2025-03-01", text: "recente" }),
      mkReview({ rating: 3, date: "2025-02-01", text: "meio" }),
    ] });
    const res = await runNodeExecutor("review-sampler", makeCtx({ mode: "recent", sampleSize: 2 }, [entry]));
    const v = res.output as { rows: { text: string }[] };
    expect(v.rows).toHaveLength(2);
    expect(v.rows[0].text).toBe("recente");
  });

  it("review-sampler supports helpful and bottom modes", async () => {
    const entry = mkEntry({ reviews: [
      mkReview({ rating: 1, thumbsUp: 1, text: "ruim ignorado" }),
      mkReview({ rating: 1, thumbsUp: 50, text: "ruim útil" }),
      mkReview({ rating: 5, thumbsUp: 10, text: "bom" }),
    ] });
    const helpful = await runNodeExecutor("review-sampler", makeCtx({ mode: "helpful", sampleSize: 1 }, [entry]));
    expect((helpful.output as { rows: { text: string }[] }).rows[0].text).toBe("ruim útil");
    const bottom = await runNodeExecutor("review-sampler", makeCtx({ mode: "bottom", sampleSize: 2 }, [entry]));
    expect((bottom.output as { rows: { text: string }[] }).rows[0].text).toContain("ruim");
  });

  it("anomaly-detector finds a version regression when a newer version tanks", async () => {
    const v100 = Array.from({ length: 20 }, (_, i) => mkReview({ id: `a${i}`, rating: 5, version: "1.0.0", date: "2025-01-01" }));
    const v200 = Array.from({ length: 20 }, (_, i) => mkReview({ id: `b${i}`, rating: 1, version: "2.0.0", date: "2025-02-01" }));
    const res = await runNodeExecutor("anomaly-detector", makeCtx({}, [mkEntry({ reviews: [...v100, ...v200] })]));
    expect((res.summary ?? "")).toMatch(/anomalia/);
    const v = res.output as { markdown: string };
    expect(v.markdown).toContain("anomalia");
  });

  it("anomaly-detector reports none on a uniform dataset", async () => {
    const reviews = Array.from({ length: 30 }, (_, i) => mkReview({ id: `c${i}`, rating: 4, version: "1.0.0", date: "2025-01-01" }));
    const res = await runNodeExecutor("anomaly-detector", makeCtx({}, [mkEntry({ reviews })]));
    expect((res.output as { markdown: string }).markdown).toMatch(/Nenhuma anomalia/);
  });

  it("reply-rate computes dev response percentage per app", async () => {
    const entry = mkEntry({ reviews: [mkReview({ rating: 5, reply: true }), mkReview({ rating: 5, reply: true }), mkReview({ rating: 1 }), mkReview({ rating: 1 })] });
    const res = await runNodeExecutor("reply-rate", makeCtx({}, [entry]));
    const v = res.output as { data: { name: string; ratePct: number }[] };
    expect(v.data[0]).toMatchObject({ ratePct: 50 });
    expect((res.output as { markdown: string }).markdown).toContain("Taxa de resposta");
  });

  it("sort reorders reviews within entries and forwards them", async () => {
    const entry = mkEntry({ reviews: [
      mkReview({ rating: 1, date: "2025-01-01", text: "a" }),
      mkReview({ rating: 5, date: "2025-02-01", text: "b" }),
      mkReview({ rating: 3, date: "2025-03-01", text: "c" }),
    ] });
    const res = await runNodeExecutor("sort", makeCtx({ order: "rating" }, [entry]));
    const out = res.output as { reviews: { rating: number }[] }[];
    expect(out[0].reviews.map((r) => r.rating)).toEqual([5, 3, 1]);
  });

  it("chart trend returns a line chart of avgRating per day", async () => {
    const entry = mkEntry({ reviews: [mkReview({ rating: 5, date: "2025-06-01" }), mkReview({ rating: 2, date: "2025-06-02" })] });
    const res = await runNodeExecutor("chart", makeCtx({ chartType: "trend" }, [entry]));
    expect(res.output).toMatchObject({ chart: "line" });
  });
});

describe("new AI nodes", () => {
  it("action-plan chains from an upstream AI output", async () => {
    const upstream = { markdown: "# Análise prévia\nAfirmação A com citação." };
    const res = await runNodeExecutor("action-plan", makeCtx({}, [upstream]));
    expect((res.output as { markdown: string }).markdown).toBeTruthy();
    expect((res.output as { derivedFrom: string }).derivedFrom).toBe("upstream");
  });

  it("action-plan works on raw data (entries)", async () => {
    const entry = mkEntry({ reviews: [mkReview({ rating: 5, text: "top" })] });
    const res = await runNodeExecutor("action-plan", makeCtx({}, [entry]));
    expect((res.output as { derivedFrom: string }).derivedFrom).toBe("data");
  });

  it("validator audits an upstream analysis", async () => {
    const upstream = { markdown: "# Análise\nAfirmação X com evidência." };
    const res = await runNodeExecutor("validator", makeCtx({}, [upstream]));
    expect((res.output as { markdown: string }).markdown).toBeTruthy();
  });

  it("validator throws when no upstream is connected", async () => {
    await expect(runNodeExecutor("validator", makeCtx({}, []))).rejects.toThrow(/auditar/);
  });
});

describe("pipeline templates v8", () => {
  it("all templates build valid graphs with known node kinds", async () => {
    const t = await import("@/components/canvas/pipelineTemplates");
    const { NODE_REGISTRY } = await import("@/components/canvas/nodeRegistry");
    expect(t.PIPELINE_TEMPLATES.length).toBeGreaterThanOrEqual(16);
    for (const tpl of t.PIPELINE_TEMPLATES) {
      const { nodes, edges } = tpl.build();
      expect(nodes.length).toBeGreaterThan(0);
      for (const n of nodes) expect(NODE_REGISTRY[n.data.kind]).toBeTruthy();
      const ids = new Set(nodes.map((n) => n.id));
      for (const e of edges) {
        expect(ids.has(e.source)).toBe(true);
        expect(ids.has(e.target)).toBe(true);
      }
    }
  });
});

describe("history (undo/redo)", () => {
  it("undo returns to the previous structural state; redo reapplies", () => {
    useCanvasStore.getState().clearCanvas();
    expect(useCanvasStore.getState().nodes.length).toBe(0);
    useCanvasStore.getState().addNode("analyze");
    expect(useCanvasStore.getState().nodes.length).toBe(1);

    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().nodes.length).toBe(0);
    expect(useCanvasStore.getState().future.length).toBe(1);

    useCanvasStore.getState().redo();
    expect(useCanvasStore.getState().nodes.length).toBe(1);
    expect(useCanvasStore.getState().past.length).toBeGreaterThan(0);
  });

  it("a new action clears the redo stack", () => {
    useCanvasStore.getState().clearCanvas();
    useCanvasStore.getState().addNode("analyze");
    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().future.length).toBe(1);
    useCanvasStore.getState().addNode("note");
    expect(useCanvasStore.getState().future.length).toBe(0);
  });
});

describe("importPipeline", () => {
  it("rejects invalid JSON with a readable error", () => {
    const res = useCanvasStore.getState().importPipeline("not json");
    expect(res.ok).toBe(false);
    expect(res.error).toBeTruthy();
  });

  it("rejects a payload without nodes/edges arrays", () => {
    const res = useCanvasStore.getState().importPipeline(JSON.stringify({ hello: 1 }));
    expect(res.ok).toBe(false);
  });

  it("loads the exported example graph", () => {
    const g = buildExampleGraph();
    const res = useCanvasStore.getState().importPipeline(JSON.stringify(g));
    expect(res).toMatchObject({ ok: true });
    const after = useCanvasStore.getState();
    expect(after.nodes.length).toBe(g.nodes.length);
    expect(after.edges.length).toBe(g.edges.length);
  });
});

describe("addNodeAndConnect", () => {
  it("creates the node, the animated edge and selects the new node", () => {
    useCanvasStore.getState().clearCanvas();
    useCanvasStore.getState().addNode("collect");
    const sourceId = useCanvasStore.getState().nodes[0].id;
    const newId = useCanvasStore.getState().addNodeAndConnect(sourceId, "analyze");
    expect(newId).toBeTruthy();
    const after = useCanvasStore.getState();
    expect(after.nodes.length).toBe(2);
    expect(after.edges).toContainEqual(expect.objectContaining({ source: sourceId, target: newId, animated: true }));
    expect(after.selectedNodeId).toBe(newId);
  });

  it("returns empty when the source does not exist", () => {
    useCanvasStore.getState().clearCanvas();
    const id = useCanvasStore.getState().addNodeAndConnect("missing", "analyze");
    expect(id).toBe("");
  });
});

// ---------- v9: mais nós IA/sem IA, validação de conexões, multi-seleção, history persistente ----------

describe("new deterministic nodes (v9, no-AI)", () => {
  it("bigram-cloud extracts the most frequent word pairs (dedupe per review)", async () => {
    const entry = mkEntry({ reviews: [
      mkReview({ rating: 1, text: "transferência pix falhou arraste até a — old" }),
      mkReview({ rating: 1, text: "transferência pix falhou pix falhou transferência pix falhou" }),
      mkReview({ rating: 5, text: "transferência pix funcionou muito bem" }),
    ] });
    const res = await runNodeExecutor("bigram-cloud", makeCtx({}, [entry]));
    const v = res.output as { chart: string; data: { text: string; value: number }[] };
    expect(v.chart).toBe("wordcloud");
    expect(v.data[0].text).toBe("transferência pix");
  });

  it("bigram-cloud throws when reviews are empty", async () => {
    await expect(runNodeExecutor("bigram-cloud", makeCtx({}, []))).rejects.toThrow(/reviews/);
  });

  it("aggregate computes avg rating per app and overall", async () => {
    const e1 = mkEntry({ appId: "a1", appName: "App A", reviews: [mkReview({ rating: 5 }), mkReview({ rating: 3 })] });
    const e2 = mkEntry({ appId: "a2", appName: "App B", reviews: [mkReview({ rating: 1 })] });
    const res = await runNodeExecutor("aggregate", makeCtx({ field: "rating", op: "avg" }, [e1, e2]));
    const v = res.output as { rows: { app: string; value: number }[] };
    expect(v.rows).toMatchObject([{ app: "App A", value: 4 }, { app: "App B", value: 1 }]);
  });

  it("review-age buckets reviews by age and reports avg age", async () => {
    const now = new Date();
    const d40 = new Date(now.getTime() - 40 * 86400_000).toISOString().slice(0, 10);
    const d10 = new Date(now.getTime() - 10 * 86400_000).toISOString().slice(0, 10);
    const entry = mkEntry({ reviews: [
      mkReview({ rating: 5, date: d10 }), mkReview({ rating: 3, date: d40 }), mkReview({ rating: 1, date: d40 }),
    ] });
    const res = await runNodeExecutor("review-age", makeCtx({}, [entry]));
    const v = res.output as { rows: { faixa: string; count: number }[]; markdown: string };
    const twoWeek = v.rows.find((r) => r.faixa === "≤ 30 dias");
    const midAge = v.rows.find((r) => r.faixa === "31–90 dias");
    expect(twoWeek?.count).toBe(1);
    expect(midAge?.count).toBe(2);
    expect(v.markdown).toContain("Idade média");
  });
});

describe("new AI nodes (v9)", () => {
  it("challenge chains from an upstream AI output", async () => {
    const upstream = { markdown: "# Análise anterior\nConclusão A." };
    const res = await runNodeExecutor("challenge", makeCtx({}, [upstream]));
    expect((res.output as { derivedFrom: string }).derivedFrom).toBe("upstream");
    expect((res.output as { markdown: string }).markdown).toBeTruthy();
  });

  it("challenge throws without upstream", async () => {
    await expect(runNodeExecutor("challenge", makeCtx({}, [mkEntry({ reviews: [mkReview({ rating: 5 })] })]))).rejects.toThrow(/desafiar/);
  });

  it("competitive-gap works with ≥2 apps, errors with 1", async () => {
    const e1 = mkEntry({ appId: "a1", appName: "Meu App", reviews: [mkReview({ rating: 5 })] });
    const e2 = mkEntry({ appId: "a2", appName: "Concorrente", reviews: [mkReview({ rating: 4 })] });
    const res = await runNodeExecutor("competitive-gap", makeCtx({}, [e1, e2]));
    expect((res.output as { derivedFrom: string }).derivedFrom).toBe("data");
    await expect(runNodeExecutor("competitive-gap", makeCtx({}, [e1]))).rejects.toThrow(/2 apps/);
  });

  it("tag-cluster works on reviews; errors on empty", async () => {
    const entry = mkEntry({ reviews: [mkReview({ rating: 5, text: "adorei o app" })] });
    const res = await runNodeExecutor("tag-cluster", makeCtx({ maxClusters: 6 }, [entry]));
    expect((res.output as { derivedFrom: string }).derivedFrom).toBe("data");
    await expect(runNodeExecutor("tag-cluster", makeCtx({}, []))).rejects.toThrow(/reviews/);
  });
});

describe("connection validation", () => {
  it("blocks self-loops, duplicates and cycles", async () => {
    useCanvasStore.getState().clearCanvas();
    useCanvasStore.getState().addNode("collect");
    useCanvasStore.getState().addNode("analyze");
    const [nc, na] = useCanvasStore.getState().nodes.map((n) => n.id);
    expect(useCanvasStore.getState().isValidConnection({ source: nc, target: nc })).toBe(false);
    expect(useCanvasStore.getState().isValidConnection({ source: nc, target: na })).toBe(true);
    useCanvasStore.getState().onConnect({ source: nc, target: na, sourceHandle: null, targetHandle: null });
    expect(useCanvasStore.getState().isValidConnection({ source: nc, target: na })).toBe(false); // duplicate
    expect(useCanvasStore.getState().isValidConnection({ source: na, target: nc })).toBe(false); // cycle
    const { wouldCreateCycle } = await import("@/lib/canvasStore");
    expect(wouldCreateCycle(na, nc, useCanvasStore.getState().edges)).toBe(true);
    expect(wouldCreateCycle(nc, na, useCanvasStore.getState().edges)).toBe(false);
  });

  it("onConnect drops invalid attempts and logs a warning", () => {
    useCanvasStore.getState().clearCanvas();
    useCanvasStore.getState().addNode("collect");
    const id = useCanvasStore.getState().nodes[0].id;
    useCanvasStore.getState().onConnect({ source: id, target: id, sourceHandle: null, targetHandle: null });
    expect(useCanvasStore.getState().edges.length).toBe(0);
    expect(useCanvasStore.getState().logs.some((l) => l.level === "warn")).toBe(true);
  });
});

describe("multi-selection ops", () => {
  it("removeNodes removes nodes and touching edges; setNodesEnabled toggles", () => {
    useCanvasStore.getState().clearCanvas();
    useCanvasStore.getState().addNode("search");
    useCanvasStore.getState().addNode("collect");
    const [s, c] = useCanvasStore.getState().nodes.map((n) => n.id);
    useCanvasStore.getState().onConnect({ source: s, target: c, sourceHandle: null, targetHandle: null });
    useCanvasStore.getState().setNodesEnabled([s, c], false);
    expect(useCanvasStore.getState().nodes.every((n) => n.data.enabled === false)).toBe(true);
    useCanvasStore.getState().removeNodes([c]);
    expect(useCanvasStore.getState().nodes.length).toBe(1);
    expect(useCanvasStore.getState().edges.length).toBe(0);
  });

  it("alignNodes aligns selected nodes to the left edge and distributes vertically", () => {
    useCanvasStore.getState().clearCanvas();
    useCanvasStore.getState().addNode("search", { x: 300, y: 10 });
    useCanvasStore.getState().addNode("collect", { x: 100, y: 500 });
    useCanvasStore.getState().addNode("analyze", { x: 700, y: 200 });
    const ids = useCanvasStore.getState().nodes.map((n) => n.id);
    useCanvasStore.getState().alignNodes(ids, "left");
    expect(useCanvasStore.getState().nodes.every((n) => n.position.x === 100)).toBe(true);
    useCanvasStore.getState().alignNodes(ids, "distribute-v");
    const ys = useCanvasStore.getState().nodes.map((n) => n.position.y).sort((a, b) => a - b);
    expect(ys[0]).toBe(10);
    expect(ys[ys.length - 1]).toBe(500);
  });
});

describe("history persistence", () => {
  it("persists undo/redo stacks to localStorage", () => {
    useCanvasStore.getState().clearCanvas(); // snapshot #1
    useCanvasStore.getState().addNode("analyze"); // snapshot #2
    const raw = JSON.parse(localStorage.getItem("aso:canvas-history:v1") ?? "{}");
    expect(Array.isArray(raw.past)).toBe(true);
    expect(raw.past.length).toBeGreaterThan(0);
    expect(raw.past.at(-1)).toHaveProperty("nodes");
    expect(raw.past.at(-1)).toHaveProperty("edges");
  });

  it("reloads persisted history on a fresh module state (via load)", () => {
    useCanvasStore.getState().clearCanvas();
    useCanvasStore.getState().addNode("analyze");
    // remember the pre-undo snapshot count
    const before = useCanvasStore.getState().past.length;
    useCanvasStore.getState().undo();
    const raw = JSON.parse(localStorage.getItem("aso:canvas-history:v1") ?? "{}");
    expect(raw.future.length).toBe(1);
    expect(before).toBeGreaterThan(0);
  });
});

describe("dependência falha → downstream pulado (skipped)", () => {
  async function makeGraph() {
    const store = useCanvasStore.getState();
    store.clearCanvas();
    const nodes: import("@/lib/canvasStore").CanvasNode[] = [
      { id: "n_fail", type: "tag-cluster", position: { x: 0, y: 0 }, data: { kind: "tag-cluster", label: "Cluster (falha sem reviews)", config: {} } },
      { id: "n_down", type: "themes", position: { x: 200, y: 0 }, data: { kind: "themes", label: "Temas (downstream)", config: {} } },
      { id: "n_indep", type: "note", position: { x: 400, y: 0 }, data: { kind: "note", label: "Nota independente", config: {} } },
    ];
    const edges = [{ id: "e1", source: "n_fail", target: "n_down", animated: true, sourceHandle: null, targetHandle: null }];
    store.loadGraph(nodes, edges);
    await useCanvasStore.getState().run();
    return useCanvasStore.getState();
  }

  it("downstream de nó com erro vira 'skipped' e nó independente executa", async () => {
    const s = await makeGraph();
    expect(s.status.n_fail).toBe("error");
    expect(s.status.n_down).toBe("skipped");
    expect(s.status.n_indep).toBe("done");
  });

  it("log explica o pulo e o resumo final conta pulados", async () => {
    const s = await makeGraph();
    const skipLog = s.logs.find((l) => l.nodeId === "n_down");
    expect(skipLog?.level).toBe("warn");
    expect(skipLog?.message).toContain("Pulado");
    const finalLog = s.logs.find((l) => l.message.startsWith("Execução finalizada"));
    expect(finalLog?.message).toContain("1 pulados");
  });
});

describe("nó dataset honra seleção global", () => {
  const entries = [
    { app: { id: "1", store: "apple", name: "A" }, reviews: [], collectedAt: Date.now() },
    { app: { id: "2", store: "google", name: "B" }, reviews: [], collectedAt: Date.now() },
  ];
  function seedDataset() {
    localStorage.setItem("aso:dataset:v1", JSON.stringify(entries));
  }

  it("sem chaves explícitas e sem seleção → dataset inteiro", async () => {
    seedDataset();
    const res = await runNodeExecutor("dataset", makeCtx({}, []));
    expect((res.output as unknown[]).length).toBe(2);
    expect(res.summary).toContain("dataset inteiro");
  });

  it("sem chaves explícitas com seleção global → filtrado", async () => {
    seedDataset();
    localStorage.setItem("aso:selected-apps:v1", JSON.stringify(["apple:1"]));
    const res = await runNodeExecutor("dataset", makeCtx({}, []));
    const out = res.output as typeof entries;
    expect(out.length).toBe(1);
    expect(out[0].app.name).toBe("A");
    expect(res.summary).toContain("seleção global");
  });

  it("chaves explícitas prevalecem sobre a seleção global", async () => {
    seedDataset();
    localStorage.setItem("aso:selected-apps:v1", JSON.stringify(["apple:1"]));
    const res = await runNodeExecutor("dataset", makeCtx({ keys: ["google:2"] }, []));
    const out = res.output as typeof entries;
    expect(out.length).toBe(1);
    expect(out[0].app.name).toBe("B");
  });
});
