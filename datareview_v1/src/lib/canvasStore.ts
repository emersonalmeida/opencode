import { create } from "zustand";
import { addEdge, applyEdgeChanges, applyNodeChanges, type Connection, type Edge, type EdgeChange, type Node, type NodeChange } from "@xyflow/react";
import { runNodeExecutor, type NodeKind, type NodeRunContext, type NodeRunResult } from "@/components/canvas/nodeRegistry";
import { recordGeneration } from "@/lib/sessionStore";
import { isFeatureEnabled } from "@/lib/featureFlags";
import { logActivity, taskStart, taskEnd } from "@/lib/activityStore";

/**
 * Registra uma geração de IA do canvas no histórico de sessões. Só registra
 * nós cujo output contenha markdown (analyze/prompt/report) — os determinísticos
 * (chart/stats/...) ficam no canvas, não no log textual. Fire-and-forget.
 */
function recordCanvasGeneration(node: { id: string; data: { kind: NodeKind; label?: string; config?: Record<string, unknown> } }, output: unknown) {
  try {
    const kind = node.data.kind;
    if (kind !== "analyze" && kind !== "prompt" && kind !== "report") return;
    if (output && typeof output === "object" && typeof (output as { markdown?: unknown }).markdown === "string") {
      const md = (output as { markdown: string }).markdown;
      if (md && md.trim()) {
        const section = typeof node.data.config?.section === "string" ? node.data.config.section : kind;
        recordGeneration({
          type: "canvas-run",
          title: `${node.data.label ?? kind} · ${section}`,
          appKeys: [],
          markdown: md,
          summary: `${md.length} chars`,
          source: "canvas",
        });
      }
    }
  } catch { /* never let logging break a run */ }
}

/**
 * Canvas store — a fonte única de verdade do playground de grafo de nós.
 *
 * - nodes/edges: grafo React Flow (posição, conexões, `data` por nó).
 * - status: ciclo de vida por nó ("idle" | "running" | "done" | "error").
 * - output: último valor produzido por nó (consumido por nós downstream + UI).
 * - logs: stream append-only do terminal (aba "Terminal" da sidebar direita).
 *
 * A execução é topológica: raízes rodam primeiro, depois nós cujas fontes
 * estão todas resolvidas, em ondas. O executor de um nó recebe as saídas das
 * fontes conectadas e pode ser async (busca, coleta, streaming de IA).
 */

export type CanvasNodeStatus = "idle" | "running" | "done" | "error" | "skipped";

export interface CanvasNodeData {
  kind: NodeKind;
  label?: string;
  config: Record<string, unknown>;
  [key: string]: unknown;
}

export type CanvasNode = Node<CanvasNodeData, NodeKind>;
export type CanvasEdge = Edge;

/** Structural snapshot of the graph (nodes + edges) — unit of undo/redo. */
export interface CanvasSnapshot { nodes: CanvasNode[]; edges: CanvasEdge[] }

export interface LogEntry {
  id: string;
  ts: number;
  nodeId?: string;
  nodeLabel?: string;
  level: "info" | "success" | "error" | "warn";
  message: string;
}

interface CanvasState {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  status: Record<string, CanvasNodeStatus>;
  output: Record<string, unknown>;
  logs: LogEntry[];
  running: boolean;
  activeRunId: string | null;
  selectedNodeId: string | null;
  snapToGrid: boolean;
  showMinimap: boolean;
  /** AbortController for the in-flight run (lets "Parar" interrupt nodes). */
  _abort: AbortController | null;

  onNodesChange: (changes: NodeChange<CanvasNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<CanvasEdge>[]) => void;
  onConnect: (c: Connection) => void;
  onSelectionChange: (nodes: { id: string }[]) => void;
  addNode: (kind: NodeKind, position?: { x: number; y: number }) => void;
  duplicateNode: (id: string) => void;
  updateNodeConfig: (id: string, patch: Record<string, unknown>) => void;
  updateNodeLabel: (id: string, label: string) => void;
  updateNodeSize: (id: string, width: number, height?: number) => void;
  toggleCollapse: (id: string) => void;
  toggleEnabled: (id: string) => void;
  toggleOutputExpanded: (id: string) => void;
  removeNode: (id: string) => void;
  clearCanvas: () => void;
  newCanvas: () => void;
  loadGraph: (nodes: CanvasNode[], edges: CanvasEdge[]) => void;
  /** Append nodes+edges to the existing canvas (does NOT clear). Used by the
   *  Analysis Atlas to "send a module/pipeline to the canvas" without losing
   *  the current graph. Returns the ids of the appended nodes. */
  appendGraph: (nodes: CanvasNode[], edges: CanvasEdge[]) => string[];
  loadExample: () => void;
  loadTemplate: (template: { nodes: CanvasNode[]; edges: CanvasEdge[] }) => void;
  selectNode: (id: string | null) => void;
  toggleSnapToGrid: () => void;
  toggleMinimap: () => void;
  autoLayout: () => void;

  run: () => Promise<void>;
  runSingleNode: (id: string) => Promise<void>;
  cancel: () => void;
  /** After a processing node finishes with a non-null output, auto-add a
   *  connected `output` node (viewer) if none is connected yet. Position it
   *  to the right of the source node so it appears next to its result. */
  maybeAutoAddOutput: (sourceId: string) => void;
  /** Create a `prompt` node seeded with a text snippet selected inside a
   *  node's rendered output, connect it to the source (so it inherits the
   *  dataset/entries + upstream markdown context), and auto-run it. The
   *  selected text becomes the focus of a new AI exploration. Returns the
   *  new node id. */
  exploreSelection: (sourceId: string, selectedText: string, instruction?: string) => string;
  log: (level: LogEntry["level"], message: string, nodeId?: string) => void;

  // History (undo/redo of structural graph changes)
  past: CanvasSnapshot[];
  future: CanvasSnapshot[];
  /** Undo last structural change. No-op when there is nothing to undo. */
  undo: () => void;
  /** Redo what was undone. No-op when there is nothing to redo. */
  redo: () => void;
  /** Add a node connected to the given source (source → new node). Returns
   *  the new node id ("" when the source is missing). */
  addNodeAndConnect: (sourceId: string, kind: NodeKind) => string;
  /** Load a pipeline from exported JSON text ("Exportar pipeline").
   *  Retorna {ok:errorMessage?}. Payloads inválidos são rejeitados com uma
   *  mensagem de erro legível. */
  importPipeline: (text: string) => { ok: boolean; error?: string };

  // Multi-selection ops
  /** Ids of ALL selected nodes (first = selectedNodeId). Empty = none. */
  selectedNodeIds: string[];
  /** Remove every node in `ids` (+ touching edges), with history. */
  removeNodes: (ids: string[]) => void;
  /** Enable/disable every node in `ids`, with history. */
  setNodesEnabled: (ids: string[], enabled: boolean) => void;
  /** Align the given nodes: left/right/top/bottom/distribute-h/distribute-v. */
  alignNodes: (ids: string[], mode: "left" | "right" | "top" | "bottom" | "distribute-h" | "distribute-v") => void;

  /** Connection validation exposed to React Flow (`isValidConnection`).
   *  Blocks: self-loops, duplicate edges, and connections that would create a cycle. */
  isValidConnection: (c: { source?: string | null; target?: string | null }) => boolean;
}

const STORAGE_KEY = "aso:canvas:v1";
const MAX_LOGS = 400;
const MAX_HISTORY = 50;

/** Append a structural snapshot to the undo stack (tail), dropping the
 *  oldest beyond MAX_HISTORY. Every mutation that pushes history also
 *  clears the redo stack — the "future" is invalidated by a new action. */
function pushHistory(past: CanvasSnapshot[], snapshot: CanvasSnapshot): { past: CanvasSnapshot[]; future: CanvasSnapshot[] } {
  const past2 = [...past, snapshot];
  if (past2.length > MAX_HISTORY) past2.splice(0, past2.length - MAX_HISTORY);
  return { past: past2, future: [] };
}

// O histórico é persistido para sobreviver a reloads (snapshots estruturais
// são pequenos).
const HISTORY_KEY = "aso:canvas-history:v1";

function loadHistory(): { past: CanvasSnapshot[]; future: CanvasSnapshot[] } {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return { past: [], future: [] };
    const parsed = JSON.parse(raw) as { past?: unknown; future?: unknown };
    return {
      past: Array.isArray(parsed.past) ? (parsed.past as CanvasSnapshot[]).filter(isValidSnapshot).slice(-MAX_HISTORY) : [],
      future: Array.isArray(parsed.future) ? (parsed.future as CanvasSnapshot[]).filter(isValidSnapshot).slice(0, MAX_HISTORY) : [],
    };
  } catch { return { past: [], future: [] }; }
}

function isValidSnapshot(s: unknown): s is CanvasSnapshot {
  return !!s && typeof s === "object" && Array.isArray((s as CanvasSnapshot).nodes) && Array.isArray((s as CanvasSnapshot).edges);
}

function persistHistory(past: CanvasSnapshot[], future: CanvasSnapshot[]) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify({ past, future })); } catch { /* quota */ }
}

/** DFS from `target` following edge.source→target. If `source` is reachable,
 *  adding source→target would close a cycle. Self-loops count as cycles. */
export function wouldCreateCycle(source: string, target: string, edges: CanvasEdge[]): boolean {
  if (source === target) return true;
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const cur = adj.get(e.source);
    if (cur) cur.push(e.target);
    else adj.set(e.source, [e.target]);
  }
  const stack = [target];
  const seen = new Set<string>();
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === source) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const n of adj.get(cur) ?? []) stack.push(n);
  }
  return false;
}

function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

function nodeLabel(nodes: CanvasNode[], id: string): string {
  return nodes.find((n) => n.id === id)?.data.label ?? id;
}

interface PersistedCanvas {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  /** Outputs computados (sobrevivem ao reload — "nada se perde"). */
  output?: Record<string, unknown>;
  status?: Record<string, CanvasNodeStatus>;
}

function persist(nodes: CanvasNode[], edges: CanvasEdge[], outputOverride?: Record<string, unknown>, statusOverride?: Record<string, CanvasNodeStatus>) {
  // Auto-read current output/status from the store so structural ops (addNode,
  // removeNode, connect...) don't clobber the persisted results. Reset ops
  // (clear/loadGraph/loadExample) pass explicit {} to wipe them.
  let output: Record<string, unknown> | undefined = outputOverride;
  let status: Record<string, CanvasNodeStatus> | undefined = statusOverride;
  if (output === undefined || status === undefined) {
    try {
      const s = useCanvasStore.getState();
      if (output === undefined) output = s.output;
      if (status === undefined) status = s.status;
    } catch { /* store not initialized yet — ignore */ }
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, edges, output, status }));
  } catch { /* quota / disabled */ }
}

function load(): { nodes: CanvasNode[]; edges: CanvasEdge[]; output: Record<string, unknown>; status: Record<string, CanvasNodeStatus> } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { nodes: [], edges: [], output: {}, status: {} };
    const parsed = JSON.parse(raw) as PersistedCanvas;
    return {
      nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
      edges: Array.isArray(parsed.edges) ? parsed.edges : [],
      output: parsed.output && typeof parsed.output === "object" ? parsed.output : {},
      status: parsed.status && typeof parsed.status === "object" ? parsed.status : {},
    };
  } catch {
    return { nodes: [], edges: [], output: {}, status: {} };
  }
}

/**
 * Pipeline de exemplo pronto para rodar: buscar → coletar → (análise IA +
 * gráfico) → exibição. Pré-configurado para um usuário novo abrir o canvas,
 * clicar "Executar" e ver uma execução completa de ponta a ponta sem conectar
 * nada manualmente. Todo nó é editável depois.
 */
export function buildExampleGraph(): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  const mk = (id: string, kind: NodeKind, label: string, position: { x: number; y: number }, config: Record<string, unknown> = {}): CanvasNode => ({
    id, type: kind, position, data: { kind, label, config },
  });
  const nodes: CanvasNode[] = [
    mk("ex_search", "search", "Buscar apps", { x: 0, y: 160 }, { term: "nubank", store: "both", limit: 5 }),
    mk("ex_collect", "collect", "Coletar reviews", { x: 280, y: 160 }, { reviewLimit: 250 }),
    mk("ex_analyze", "analyze", "Análise IA", { x: 560, y: 20 }, { section: "summary" }),
    mk("ex_refine", "analyze", "Refinar análise", { x: 840, y: 20 }, { section: "summary" }),
    mk("ex_chart", "chart", "Gráfico de notas", { x: 560, y: 300 }, { chartType: "rating" }),
    mk("ex_prompt", "prompt", "Apresentação", { x: 1120, y: 20 }, { prompt: "Transforme a análise anterior numa apresentação executiva com slides separados por ##: capa, métricas, pontos fortes, problemas e recomendações." }),
    mk("ex_note", "note", "Pipeline de exemplo", { x: 280, y: -60 }, { text: "Fluxo: busca → coleta → análise IA → refina → apresentação + gráfico. Ao executar cada nó, um nó de Saída renderizada é adicionado automaticamente ao lado do resultado. Edite cada nó e clique em Executar." }),
  ];
  const edges: CanvasEdge[] = [
    { id: "e_s_c", source: "ex_search", target: "ex_collect", animated: true },
    { id: "e_c_a", source: "ex_collect", target: "ex_analyze", animated: true },
    { id: "e_a_r", source: "ex_analyze", target: "ex_refine", animated: true },
    { id: "e_c_ch", source: "ex_collect", target: "ex_chart", animated: true },
    { id: "e_r_p", source: "ex_refine", target: "ex_prompt", animated: true },
  ];
  return { nodes, edges };
}

/**
 * Topological order of the graph. Disabled nodes (data.enabled === false) are
 * excluded entirely — they neither run nor feed downstream nodes. Cycles fall
 * back to append-at-end.
 */
export function topologicalOrder(nodes: CanvasNode[], edges: CanvasEdge[]): CanvasNode[] {
  const enabled = nodes.filter((n) => (n.data.enabled as boolean | undefined) !== false);
  const enabledIds = new Set(enabled.map((n) => n.id));
  const byId = new Map(enabled.map((n) => [n.id, n]));
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const n of enabled) { indeg.set(n.id, 0); adj.set(n.id, []); }
  for (const e of edges) {
    if (!enabledIds.has(e.source) || !enabledIds.has(e.target)) continue;
    adj.get(e.source)!.push(e.target);
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
  }
  const queue = enabled.filter((n) => (indeg.get(n.id) ?? 0) === 0);
  const order: CanvasNode[] = [];
  while (queue.length) {
    const n = queue.shift()!;
    order.push(n);
    for (const t of adj.get(n.id) ?? []) {
      indeg.set(t, (indeg.get(t) ?? 1) - 1);
      if (indeg.get(t) === 0) queue.push(byId.get(t)!);
    }
  }
  // Fallback: any nodes left (cycles) appended at the end.
  if (order.length < enabled.length) {
    for (const n of enabled) if (!order.includes(n)) order.push(n);
  }
  return order;
}

export function sourceOutputs(nodeId: string, edges: CanvasEdge[], output: Record<string, unknown>): unknown[] {
  return edges.filter((e) => e.target === nodeId).map((e) => output[e.source]);
}

const initial = load();
const historyInit = loadHistory();

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: initial.nodes,
  edges: initial.edges,
  status: initial.status,
  output: initial.output,
  logs: [{ id: "boot", ts: Date.now(), level: "info", message: "Canvas pronto. Arraste nós do painel esquerdo e conecte-os, ou carregue o pipeline de exemplo." }],
  running: false,
  activeRunId: null,
  selectedNodeId: null,
  snapToGrid: false,
  showMinimap: true,
  past: historyInit.past,
  future: historyInit.future,
  selectedNodeIds: [],
  _abort: null,

  onNodesChange: (changes) => set((s) => {
    const nodes = applyNodeChanges(changes, s.nodes) as CanvasNode[];
    persist(nodes, s.edges);
    return { nodes };
  }),
  onEdgesChange: (changes) => set((s) => {
    const edges = applyEdgeChanges(changes, s.edges) as CanvasEdge[];
    persist(s.nodes, edges);
    // Snapshot only on structural id changes (remove/select), not on tick.
    if (changes.some((c) => c.type === "remove")) {
      return { edges, ...pushHistory(s.past, { nodes: s.nodes, edges: s.edges }) };
    }
    return { edges };
  }),
  onConnect: (c) => set((s) => {
    // Validation: no self-loops, no duplicate edges, no cycles.
    if (!c.source || !c.target || c.source === c.target) { get().log("warn", "Loop de um nó em si mesmo ignorado."); return {}; }
    if (s.edges.some((e) => e.source === c.source && e.target === c.target)) { get().log("warn", "Conexão duplicada ignorada."); return {}; }
    if (wouldCreateCycle(c.source, c.target, s.edges)) {
      get().log("warn", `Conexão rejeitada: criaria um ciclo (${nodeLabel(s.nodes, c.source)} ⇄ ${nodeLabel(s.nodes, c.target)}).`);
      return {};
    }
    const edges = addEdge({ ...c, animated: true }, s.edges) as CanvasEdge[];
    persist(s.nodes, edges);
    return { edges, ...pushHistory(s.past, { nodes: s.nodes, edges: s.edges }) };
  }),
  onSelectionChange: (selNodes) => {
    const ids = selNodes.map((n) => n.id);
    const next = ids[0] ?? null;
    const cur = get();
    // Guard: zustand `set` always notifies subscribers; React Flow fires this
    // on every render, so an unconditional set would loop ("Maximum update
    // depth exceeded"). Only update when the selection actually changes.
    if (cur.selectedNodeId !== next || !sameIds(cur.selectedNodeIds, ids)) {
      set({ selectedNodeId: next, selectedNodeIds: ids });
    }
  },
  selectNode: (id) => set({ selectedNodeId: id }),

  addNode: (kind, position) => {
    const id = `${kind}_${Math.random().toString(36).slice(2, 9)}`;
    const label = NODE_DEFAULT_LABEL[kind];
    // Snap to grid when enabled (20px grid) for clean alignment.
    const snap = (v: number) => get().snapToGrid ? Math.round(v / 20) * 20 : v;
    // Posicionamento padrão: alinhado ao último nó criado (à direita dele,
    // mesmo Y). Faz o canvas crescer organicamente para a direita sem sobrepor,
    // mantendo nós novos organizados ao lado do anterior.
    let pos = position;
    if (!pos) {
      const last = get().nodes[get().nodes.length - 1];
      pos = last
        ? { x: last.position.x + 320, y: last.position.y }
        : { x: 80, y: 120 };
    }
    const node: CanvasNode = {
      id,
      type: kind,
      position: { x: snap(pos.x), y: snap(pos.y) },
      data: { kind, label, config: {} },
    };
    set((s) => {
      const nodes = [...s.nodes, node];
      persist(nodes, s.edges);
      return { nodes, selectedNodeId: id, ...pushHistory(s.past, { nodes: s.nodes, edges: s.edges }) };
    });
    get().log("info", `Nó adicionado: ${label}`, id);
  },

  duplicateNode: (id) => {
    const src = get().nodes.find((n) => n.id === id);
    if (!src) return;
    const newId = `${src.data.kind}_${Math.random().toString(36).slice(2, 9)}`;
    const clone: CanvasNode = {
      ...src,
      id: newId,
      position: { x: src.position.x + 48, y: src.position.y + 48 },
      selected: false,
      data: { ...src.data, config: { ...src.data.config } },
    };
    set((s) => {
      const nodes = [...s.nodes, clone];
      persist(nodes, s.edges);
      return { nodes, selectedNodeId: newId, ...pushHistory(s.past, { nodes: s.nodes, edges: s.edges }) };
    });
    get().log("info", `Nó duplicado: ${src.data.label}`, newId);
  },

  updateNodeSize: (id, width, height) => set((s) => {
    const w = Math.max(220, Math.min(720, Math.round(width)));
    const patch: Partial<CanvasNode["data"]> = { width: w };
    if (height != null && Number.isFinite(height)) patch.height = Math.max(120, Math.round(height));
    const nodes = s.nodes.map((n) => n.id === id ? { ...n, data: { ...n.data, ...patch } } : n);
    persist(nodes, s.edges);
    return { nodes };
  }),

  toggleCollapse: (id) => set((s) => {
    const nodes = s.nodes.map((n) => n.id === id ? { ...n, data: { ...n.data, collapsed: !n.data.collapsed } } : n);
    persist(nodes, s.edges);
    return { nodes };
  }),

  toggleEnabled: (id) => set((s) => {
    const nodes = s.nodes.map((n) => n.id === id ? { ...n, data: { ...n.data, enabled: (n.data.enabled as boolean | undefined) === false } } : n);
    persist(nodes, s.edges);
    const enabled = (nodes.find((n) => n.id === id)?.data.enabled as boolean | undefined) ?? true;
    get().log(enabled ? "info" : "warn", `Nó ${enabled ? "ativado" : "desativado"} — ${enabled ? "será executado" : "pulado na execução"}.`, id);
    return { nodes };
  }),

  toggleOutputExpanded: (id) => set((s) => {
    const nodes = s.nodes.map((n) => n.id === id ? { ...n, data: { ...n.data, outputExpanded: !n.data.outputExpanded } } : n);
    persist(nodes, s.edges);
    return { nodes };
  }),

  loadTemplate: (template) => {
    persist(template.nodes, template.edges);
    set((s) => ({ nodes: template.nodes, edges: template.edges, status: {}, output: {}, selectedNodeId: null, logs: [{ id: "tpl_" + Date.now(), ts: Date.now(), level: "info", message: "Template carregado. Clique em Executar ou edite os nós." }], ...pushHistory(s.past, { nodes: s.nodes, edges: s.edges }) }));
  },

  toggleSnapToGrid: () => set((s) => ({ snapToGrid: !s.snapToGrid })),
  toggleMinimap: () => set((s) => ({ showMinimap: !s.showMinimap })),

  autoLayout: () => {
    // Simple layered topological layout: assign each node a column by its
    // depth (longest path from a root) and stack vertically within a column.
    const { nodes, edges } = get();
    if (nodes.length === 0) return;
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const indeg = new Map<string, number>();
    const adj = new Map<string, string[]>();
    for (const n of nodes) { indeg.set(n.id, 0); adj.set(n.id, []); }
    for (const e of edges) {
      if (!byId.has(e.source) || !byId.has(e.target)) continue;
      adj.get(e.source)!.push(e.target);
      indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
    }
    // Depth = longest path from any root.
    const depth = new Map<string, number>();
    const roots = nodes.filter((n) => (indeg.get(n.id) ?? 0) === 0);
    const queue = roots.map((r) => ({ id: r.id, d: 0 }));
    depth.set(roots[0]?.id ?? nodes[0].id, 0);
    while (queue.length) {
      const { id, d } = queue.shift()!;
      depth.set(id, d);
      for (const t of adj.get(id) ?? []) {
        const cur = depth.get(t) ?? -1;
        if (d + 1 > cur) {
          depth.set(t, d + 1);
          queue.push({ id: t, d: d + 1 });
        }
      }
    }
    // Fallback: nodes with no computed depth go to column 0.
    for (const n of nodes) if (!depth.has(n.id)) depth.set(n.id, 0);
    // Group by column.
    const cols = new Map<number, string[]>();
    for (const n of nodes) {
      const c = depth.get(n.id) ?? 0;
      if (!cols.has(c)) cols.set(c, []);
      cols.get(c)!.push(n.id);
    }
    const COL_W = 320, ROW_H = 160;
    const laidOut = nodes.map((n) => {
      const c = depth.get(n.id) ?? 0;
      const colNodes = cols.get(c) ?? [];
      const idx = colNodes.indexOf(n.id);
      return { ...n, position: { x: c * COL_W + 40, y: idx * ROW_H + 40 } };
    });
    persist(laidOut, edges);
    set({ nodes: laidOut });
    get().log("info", "Layout automático aplicado (topológico em colunas).");
  },

  runSingleNode: async (id) => {
    const { nodes, edges, running, log } = get();
    if (running) return;
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    const runId = `single_${Date.now()}`;
    log("info", `Execução de nó único: ${node.data.label}.`, node.id);
    const abort = new AbortController();
    set({ running: true, activeRunId: runId, _abort: abort });
    set((s) => ({ status: { ...s.status, [node.id]: "running" } }));
    const ctx: NodeRunContext = {
      config: node.data.config,
      inputs: sourceOutputs(node.id, edges, get().output),
      log: (lvl, msg) => get().log(lvl, msg, node.id),
      setStatus: (out) => set((s) => ({ status: { ...s.status, [node.id]: out } })),
      setOutput: (val) => set((s) => ({ output: { ...s.output, [node.id]: val } })),
      signal: abort.signal,
    };
    try {
      const res: NodeRunResult = await runNodeExecutor(node.data.kind, ctx);
      set((s) => ({ output: { ...s.output, [node.id]: res.output }, status: { ...s.status, [node.id]: "done" } }));
      get().log("success", `Concluído — ${res.summary ?? "ok"}`, node.id);
      persist(get().nodes, get().edges, get().output, get().status);
      recordCanvasGeneration(node, res.output);
      get().maybeAutoAddOutput(node.id);
    } catch (e) {
      if (ctx.signal.aborted) get().log("warn", "Interrompido.", node.id);
      else {
        set((s) => ({ status: { ...s.status, [node.id]: "error" } }));
        get().log("error", e instanceof Error ? e.message : "Falha", node.id);
      }
      persist(get().nodes, get().edges, get().output, get().status);
    }
    set({ running: false, activeRunId: null, _abort: null });
  },

  maybeAutoAddOutput: (sourceId) => {
    // Respeita a feature flag: se o usuário desligou o auto-output, pula.
    if (!isFeatureEnabled("canvas.auto-output")) return;
    const { nodes, edges, output } = get();
    const source = nodes.find((n) => n.id === sourceId);
    if (!source) return;
    // Só kinds de processamento que produzem resultado visualizável ganham
    // um nó de saída automaticamente.
    const kind = source.data.kind as NodeKind;
    if (!AUTO_OUTPUT_KINDS.includes(kind)) return;
    // Skip if the result is null/undefined (nothing to render).
    if (output[sourceId] == null) return;
    // Skip if there's already an `output` node connected downstream.
    const hasOutputDownstream = edges.some(
      (e) => e.source === sourceId && nodes.find((n) => n.id === e.target)?.data.kind === "output",
    );
    if (hasOutputDownstream) return;
    // Posiciona o novo nó de saída à direita da fonte, mesmo centro vertical.
    const snap = (v: number) => get().snapToGrid ? Math.round(v / 20) * 20 : v;
    const w = (source.data.width as number) ?? 280;
    const outId = `output_${Math.random().toString(36).slice(2, 9)}`;
    const outNode: CanvasNode = {
      id: outId,
      type: "output",
      position: { x: snap(source.position.x + w + 60), y: snap(source.position.y) },
      data: { kind: "output", label: `Saída: ${source.data.label ?? NODE_DEFAULT_LABEL[kind]}`, config: {} },
    };
    const outEdge: CanvasEdge = { id: `e_${sourceId}_${outId}`, source: sourceId, target: outId, animated: true };
    set((s) => {
      const nodes = [...s.nodes, outNode];
      const edges = [...s.edges, outEdge];
      persist(nodes, edges);
      return { nodes, edges, selectedNodeId: outId };
    });
    get().log("info", `Saída renderizada adicionada automaticamente.`, outId);
  },

  exploreSelection: (sourceId, selectedText, instruction) => {
    const text = (selectedText ?? "").trim();
    if (!text) return "";
    const source = get().nodes.find((n) => n.id === sourceId);
    if (!source) return "";
    const snap = (v: number) => get().snapToGrid ? Math.round(v / 20) * 20 : v;
    const w = (source.data.width as number) ?? 280;
    const id = `prompt_${Math.random().toString(36).slice(2, 9)}`;
    const prompt =
      (instruction?.trim() || "Aprofunde e explore o trecho selecionado abaixo. Cruze-o com os dados do dataset e com as saídas anteriores quando relevante, e produza uma análise em markdown.") +
      `\n\n--- INÍCIO DO TRECHO SELECIONADO ---\n${text}\n--- FIM DO TRECHO SELECIONADO ---\n\nFoque exclusivamente neste trecho, mas use os dados de apps/reviews conectados como evidência complementar.`;
    const node: CanvasNode = {
      id,
      type: "prompt",
      position: { x: snap(source.position.x + w + 60), y: snap(source.position.y + 40) },
      data: { kind: "prompt", label: "Explorar seleção", config: { prompt } },
    };
    const edge: CanvasEdge = { id: `e_${sourceId}_${id}`, source: sourceId, target: id, animated: true };
    set((s) => {
      const nodes = [...s.nodes, node];
      const edges = [...s.edges, edge];
      persist(nodes, edges);
      return { nodes, edges, selectedNodeId: id };
    });
    get().log("info", `Nó "Explorar seleção" criado a partir de ${text.length} caracteres selecionados.`, id);
    // Auto-run the new node so the exploration starts immediately.
    void get().runSingleNode(id);
    return id;
  },

  updateNodeConfig: (id, patch) => set((s) => {
    const nodes = s.nodes.map((n) => n.id === id ? { ...n, data: { ...n.data, config: { ...n.data.config, ...patch } } } : n);
    persist(nodes, s.edges);
    return { nodes };
  }),
  updateNodeLabel: (id, label) => set((s) => {
    const nodes = s.nodes.map((n) => n.id === id ? { ...n, data: { ...n.data, label } } : n);
    persist(nodes, s.edges);
    return { nodes };
  }),
  removeNode: (id) => set((s) => {
    const nodes = s.nodes.filter((n) => n.id !== id);
    const edges = s.edges.filter((e) => e.source !== id && e.target !== id);
    persist(nodes, edges);
    return { nodes, edges, ...pushHistory(s.past, { nodes: s.nodes, edges: s.edges }) };
  }),
  clearCanvas: () => {
    persist([], [], {}, {});
    set((s) => ({
      nodes: [], edges: [], status: {}, output: {}, selectedNodeId: null,
      logs: [{ id: "cleared", ts: Date.now(), level: "info", message: "Canvas limpo." }],
      ...pushHistory(s.past, { nodes: s.nodes, edges: s.edges }),
    }));
  },
  newCanvas: () => {
    persist([], [], {}, {});
    set((s) => ({
      nodes: [], edges: [], status: {}, output: {}, selectedNodeId: null,
      logs: [{ id: "new_" + Date.now(), ts: Date.now(), level: "info", message: "Novo canvas em branco. Adicione nós pelo painel esquerdo." }],
      ...pushHistory(s.past, { nodes: s.nodes, edges: s.edges }),
    }));
  },
  loadGraph: (nodes, edges) => {
    persist(nodes, edges, {}, {});
    set((s) => ({ nodes, edges, status: {}, output: {}, ...pushHistory(s.past, { nodes: s.nodes, edges: s.edges }) }));
  },
  appendGraph: (incoming, incomingEdges) => {
    const s = get();
    // Avoid id collisions with existing nodes by suffixing duplicates.
    const existingIds = new Set(s.nodes.map((n) => n.id));
    const remapped = incoming.map((n) => {
      let id = n.id;
      while (existingIds.has(id)) id = `${id}_${Math.random().toString(36).slice(2, 6)}`;
      existingIds.add(id);
      return { ...n, id, selected: false };
    });
    const idMap = new Map(incoming.map((n, i) => [n.id, remapped[i].id]));
    const remappedEdges = incomingEdges.map((e) => ({
      ...e,
      id: `e_${e.source}_${e.target}_${Math.random().toString(36).slice(2, 6)}`,
      source: idMap.get(e.source) ?? e.source,
      target: idMap.get(e.target) ?? e.target,
      selected: false,
    }));
    const nodes = [...s.nodes, ...remapped];
    const edges = [...s.edges, ...remappedEdges];
    persist(nodes, edges);
    set({ nodes, edges, selectedNodeId: remapped[0]?.id ?? s.selectedNodeId, ...pushHistory(s.past, { nodes: s.nodes, edges: s.edges }) });
    get().log("info", `${remapped.length} nó(s) adicionado(s) ao canvas a partir do Analysis Atlas.`, remapped[0]?.id);
    return remapped.map((n) => n.id);
  },
  loadExample: () => {
    const { nodes, edges } = buildExampleGraph();
    persist(nodes, edges);
    set((s) => ({ nodes, edges, status: {}, output: {}, selectedNodeId: null, logs: [{ id: "example", ts: Date.now(), level: "info", message: "Pipeline de exemplo carregado. Clique em Executar ou edite os nós." }], ...pushHistory(s.past, { nodes: s.nodes, edges: s.edges }) }));
  },

  cancel: () => {
    get()._abort?.abort();
    set({ activeRunId: null, running: false, _abort: null });
  },

  log: (level, message, nodeId) => {
    // Espelha no activity store global → o Terminal do sistema mostra TUDO
    // (não só o canvas) e o indicador do header conta tarefas vivas.
    const phase =
      level === "error" ? "error" : level === "success" ? "done" : level === "warn" ? "skip" : "progress";
    logActivity("canvas", phase, message);
    set((s) => {
      const node = nodeId ? s.nodes.find((n) => n.id === nodeId) : undefined;
      const entry: LogEntry = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        ts: Date.now(),
        nodeId,
        nodeLabel: node?.data.label,
        level,
        message,
      };
      const logs = [...s.logs, entry];
      if (logs.length > MAX_LOGS) logs.splice(0, logs.length - MAX_LOGS);
      return { logs };
    });
  },

  undo: () => set((s) => {
    if (s.past.length === 0) return {};
    const prev = s.past[s.past.length - 1];
    const past = s.past.slice(0, -1);
    const future = [{ nodes: s.nodes, edges: s.edges }, ...s.future].slice(0, MAX_HISTORY);
    // Restore status/output only if the snapshot has fewer nodes — the original
    // outputs may reference nodes that no longer exist in the restored graph.
    const restoredIds = new Set(prev.nodes.map((n) => n.id));
    const status = Object.fromEntries(Object.entries(s.status).filter(([id]) => restoredIds.has(id)));
    const output = Object.fromEntries(Object.entries(s.output).filter(([id]) => restoredIds.has(id)));
    persist(prev.nodes, prev.edges, output, status);
    return { past, future, nodes: prev.nodes, edges: prev.edges, status, output, selectedNodeId: null };
  }),

  redo: () => set((s) => {
    if (s.future.length === 0) return {};
    const next = s.future[0];
    const future = s.future.slice(1);
    const past = [...s.past, { nodes: s.nodes, edges: s.edges }];
    if (past.length > MAX_HISTORY) past.splice(0, past.length - MAX_HISTORY);
    const restoredIds = new Set(next.nodes.map((n) => n.id));
    const status = Object.fromEntries(Object.entries(s.status).filter(([id]) => restoredIds.has(id)));
    const output = Object.fromEntries(Object.entries(s.output).filter(([id]) => restoredIds.has(id)));
    persist(next.nodes, next.edges, output, status);
    return { past, future, nodes: next.nodes, edges: next.edges, status, output, selectedNodeId: null };
  }),

  addNodeAndConnect: (sourceId, kind) => {
    const s = get();
    const source = s.nodes.find((n) => n.id === sourceId);
    if (!source) { get().log("warn", "addNodeAndConnect: nó de origem não encontrado."); return ""; }
    const id = `${kind}_${Math.random().toString(36).slice(2, 9)}`;
    const label = NODE_DEFAULT_LABEL[kind];
    const snap = (v: number) => get().snapToGrid ? Math.round(v / 20) * 20 : v;
    const w = (source.data.width as number) ?? 280;
    const node: CanvasNode = {
      id, type: kind,
      position: { x: snap(source.position.x + w + 60), y: snap(source.position.y) },
      data: { kind, label, config: {} },
    };
    const edge: CanvasEdge = { id: `e_${sourceId}_${id}_${Math.random().toString(36).slice(2, 6)}`, source: sourceId, target: id, animated: true };
    set((st) => {
      const nodes = [...st.nodes, node];
      const edges = [...st.edges, edge];
      persist(nodes, edges);
      return { nodes, edges, selectedNodeId: id, ...pushHistory(st.past, { nodes: st.nodes, edges: st.edges }) };
    });
    get().log("info", `Nó "${label}" adicionado e conectado a "${source.data.label}".`, id);
    return id;
  },

  importPipeline: (text) => {
    try {
      const parsed = JSON.parse(text) as { nodes?: unknown[]; edges?: unknown[] };
      if (!parsed || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
        return { ok: false, error: "JSON inválido — esperado { nodes: [], edges: [] }." };
      }
      const nodes = (parsed.nodes as Record<string, unknown>[])
        .filter((n) => n && typeof n.id === "string" && n.data && typeof (n.data as { kind?: unknown }).kind === "string")
        .map((n) => ({ ...n, selected: false }) as CanvasNode);
      if (nodes.length === 0) return { ok: false, error: "Pipeline sem nós válidos." };
      const ids = new Set(nodes.map((n) => n.id));
      const edges = (parsed.edges as Record<string, unknown>[])
        .filter((e) => e && typeof e.source === "string" && typeof e.target === "string" && ids.has(e.source as string) && ids.has(e.target as string))
        .map((e, i) => ({ ...(e as CanvasEdge), id: (e.id as string) ?? `imp_${i}`, selected: false }));
      get().loadGraph(nodes, edges);
      get().log("success", `Pipeline importado: ${nodes.length} nó(s), ${edges.length} conexão(ões).`);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: `Falha ao ler o JSON: ${e instanceof Error ? e.message : String(e)}` };
    }
  },

  removeNodes: (ids) => set((s) => {
    if (ids.length === 0) return {};
    const idSet = new Set(ids);
    const nodes = s.nodes.filter((n) => !idSet.has(n.id));
    const edges = s.edges.filter((e) => !idSet.has(e.source) && !idSet.has(e.target));
    const status = Object.fromEntries(Object.entries(s.status).filter(([id]) => !idSet.has(id)));
    const output = Object.fromEntries(Object.entries(s.output).filter(([id]) => !idSet.has(id)));
    persist(nodes, edges, output, status);
    return {
      nodes, edges, status, output,
      selectedNodeId: idSet.has(s.selectedNodeId ?? "") ? null : s.selectedNodeId,
      selectedNodeIds: s.selectedNodeIds.filter((x) => !idSet.has(x)),
      ...pushHistory(s.past, { nodes: s.nodes, edges: s.edges }),
    };
  }),

  setNodesEnabled: (ids, enabled) => set((s) => {
    if (ids.length === 0) return {};
    const idSet = new Set(ids);
    const nodes = s.nodes.map((n) => idSet.has(n.id) ? { ...n, data: { ...n.data, enabled } } : n);
    persist(nodes, s.edges);
    return { nodes, ...pushHistory(s.past, { nodes: s.nodes, edges: s.edges }) };
  }),

  alignNodes: (ids, mode) => set((s) => {
    const targets = s.nodes.filter((n) => ids.includes(n.id));
    if (targets.length === 0) return {};
    const minX = Math.min(...targets.map((n) => n.position.x));
    const maxX = Math.max(...targets.map((n) => n.position.x));
    const minY = Math.min(...targets.map((n) => n.position.y));
    const maxY = Math.max(...targets.map((n) => n.position.y));
    const pos = (n: CanvasNode): { x: number; y: number } => {
      switch (mode) {
        case "left": return { x: minX, y: n.position.y };
        case "right": return { x: maxX, y: n.position.y };
        case "top": return { x: n.position.x, y: minY };
        case "bottom": return { x: n.position.x, y: maxY };
        case "distribute-h": {
          const sorted = [...targets].sort((a, b) => a.position.x - b.position.x);
          const idx = sorted.findIndex((x) => x.id === n.id);
          return { x: sorted.length > 1 ? minX + (idx * (maxX - minX)) / (sorted.length - 1) : minX, y: n.position.y };
        }
        case "distribute-v": {
          const sorted = [...targets].sort((a, b) => a.position.y - b.position.y);
          const idx = sorted.findIndex((x) => x.id === n.id);
          return { x: n.position.x, y: sorted.length > 1 ? minY + (idx * (maxY - minY)) / (sorted.length - 1) : minY };
        }
        default: return n.position;
      }
    };
    const nodes = s.nodes.map((n) => {
      if (!ids.includes(n.id)) return n;
      const p = pos(n);
      return { ...n, position: { x: Math.round(p.x), y: Math.round(p.y) } };
    });
    persist(nodes, s.edges);
    get().log("info", `Alinhamento (${mode}) em ${targets.length} nó(s).`);
    return { nodes, ...pushHistory(s.past, { nodes: s.nodes, edges: s.edges }) };
  }),

  isValidConnection: (c) => {
    const { edges } = get();
    if (!c.source || !c.target || c.source === c.target) return false;
    if (edges.some((e) => e.source === c.source && e.target === c.target)) return false;
    return !wouldCreateCycle(c.source, c.target, edges);
  },

  run: async () => {
    const { nodes, edges, running, log } = get();
    if (running) return;
    const runId = `run_${Date.now()}`;
    const order = topologicalOrder(nodes, edges);
    const taskId = taskStart(null, `Canvas: executar ${order.length} nó(s)`, "canvas");
    log("info", `Execução iniciada — ${order.length} nó(s) na ordem topológica.`);
    // Um AbortController compartilhado permite ao "Parar" interromper nós de
    // longa duração (ex.: análise de IA em streaming), em vez de só parar entre
    // um nó e outro.
    const abort = new AbortController();
    set({ running: true, activeRunId: runId, status: {}, _abort: abort });
    const persistNow = () => persist(get().nodes, get().edges, get().output, get().status);

    /** Nós que falharam (ou foram pulados por dependência) — propagam "skipped"
     *  para os downstream em vez de executá-los com inputs inválidos. */
    const failed = new Set<string>();

    for (const node of order) {
      if (get().activeRunId !== runId) { log("warn", "Execução cancelada."); taskEnd(taskId, "cancelled"); persistNow(); return; }

      // Dependência falhou ou foi pulada → pulado (não executa nem chama IA).
      const upstreamIds = edges.filter((e) => e.target === node.id).map((e) => e.source);
      if (upstreamIds.length > 0 && upstreamIds.some((u) => failed.has(u))) {
        set((s) => ({ status: { ...s.status, [node.id]: "skipped" } }));
        failed.add(node.id);
        get().log("warn", "Pulado: dependência falhou ou foi pulada.", node.id);
        persistNow();
        continue;
      }

      set((s) => ({ status: { ...s.status, [node.id]: "running" } }));
      const ctx: NodeRunContext = {
        config: node.data.config,
        inputs: sourceOutputs(node.id, edges, get().output),
        log: (lvl, msg) => get().log(lvl, msg, node.id),
        setStatus: (out) => set((s) => ({ status: { ...s.status, [node.id]: out } })),
        setOutput: (val) => set((s) => ({ output: { ...s.output, [node.id]: val } })),
        signal: abort.signal,
      };
      try {
        const res: NodeRunResult = await runNodeExecutor(node.data.kind, ctx);
        set((s) => ({ output: { ...s.output, [node.id]: res.output }, status: { ...s.status, [node.id]: "done" } }));
        get().log("success", `Concluído — ${res.summary ?? "ok"}`, node.id);
        // Persiste o output: "nada se perde" — sobrevive a reload.
        persistNow();
        // Registra gerações de IA no histórico de sessões (sem await — fire-and-forget).
        recordCanvasGeneration(node, res.output);
        get().maybeAutoAddOutput(node.id);
      } catch (e) {
        if (ctx.signal.aborted) {
          get().log("warn", "Interrompido.", node.id);
        } else {
          set((s) => ({ status: { ...s.status, [node.id]: "error" } }));
          failed.add(node.id);
          get().log("error", e instanceof Error ? e.message : "Falha", node.id);
        }
        persistNow();
      }
      if (get().activeRunId !== runId) { taskEnd(taskId, "cancelled"); persistNow(); return; }
    }
    set({ running: false, activeRunId: null, _abort: null });
    persistNow();
    const finalStatus = get().status;
    const errors = order.filter((n) => finalStatus[n.id] === "error").length;
    const skipped = order.filter((n) => finalStatus[n.id] === "skipped").length;
    const done = order.filter((n) => finalStatus[n.id] === "done").length;
    const parts = [`${done} concluídos`];
    if (errors > 0) parts.push(`${errors} com erro`);
    if (skipped > 0) parts.push(`${skipped} pulados`);
    get().log("info", `Execução finalizada — ${parts.join(" · ")}.`);
    taskEnd(
      taskId,
      errors > 0 ? "error" : "done",
      errors > 0
        ? `${errors} nó(s) com erro${skipped > 0 ? ` · ${skipped} pulados` : ""}`
        : skipped > 0
          ? `${done} nó(s) concluídos · ${skipped} pulados`
          : `${done} nó(s) concluídos`,
    );
  },
}));

// Persist undo/redo whenever the stacks change — the history survives reloads
// (structural snapshots are small; the heavy payloads live in the canvas key).
// Compare by reference: pushHistory always builds new arrays, so a re-render
// of the same lengths still persists (important after localStorage.clear()).
let _lastPastRef: CanvasSnapshot[] | null = null;
let _lastFutureRef: CanvasSnapshot[] | null = null;
useCanvasStore.subscribe((s) => {
  if (s.past !== _lastPastRef || s.future !== _lastFutureRef) {
    _lastPastRef = s.past;
    _lastFutureRef = s.future;
    persistHistory(s.past, s.future);
  }
});

/**
 * Kinds that produce a visible rendered result and should auto-get a connected
 * `output` node after running. Excludes passive/utility nodes (output itself,
 * note, filter, code) — they don't render a result worth auto-viewing.
 */
const AUTO_OUTPUT_KINDS: NodeKind[] = [
  "analyze", "prompt", "report", "action-plan", "validator", "challenge", "competitive-gap", "tag-cluster",
  "statistics", "sentiment", "themes", "version-analysis", "reviews-analysis", "country-analysis",
  "rating-trend", "version-compare", "review-sampler", "anomaly-detector", "reply-rate", "bigram-cloud", "aggregate", "review-age",
  "chart", "dashboard", "table", "display",
  "search", "collect", "dataset",
];



export const NODE_DEFAULT_LABEL: Record<NodeKind, string> = {
  search: "Buscar apps",
  collect: "Coletar reviews",
  dataset: "Dataset",
  analyze: "Análise IA",
  prompt: "Prompt IA",
  report: "Relatório IA",
  "action-plan": "Plano de ação IA",
  validator: "Validador IA",
  challenge: "Desafiar conclusão",
  "competitive-gap": "Gap competitivo",
  "tag-cluster": "Cluster por tema",
  statistics: "Estatísticas",
  sentiment: "Análise de sentimento",
  themes: "Temas & keywords",
  "version-analysis": "Análise por versão",
  "reviews-analysis": "Análise de reviews",
  "country-analysis": "Análise por país",
  "rating-trend": "Tendência de nota",
  "version-compare": "Comparar versões",
  "review-sampler": "Amostra de reviews",
  "anomaly-detector": "Detector de anomalias",
  "reply-rate": "Taxa de resposta",
  "bigram-cloud": "Bigramas",
  aggregate: "Agregar métricas",
  "review-age": "Idade dos reviews",
  chart: "Gráfico",
  dashboard: "Dashboard",
  table: "Tabela",
  display: "Exibição",
  output: "Saída renderizada",
  note: "Nota",
  filter: "Filtro",
  code: "Código",
  sort: "Ordenar reviews",
};
