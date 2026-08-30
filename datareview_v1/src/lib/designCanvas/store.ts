import { create } from "zustand";
import {
  addEdge, applyEdgeChanges, applyNodeChanges,
  type Connection, type EdgeChange, type NodeChange,
} from "@xyflow/react";
import type { Board, DCNode, DCEdge, DesignSnapshot, DesignToken } from "./types";
import { DESIGN_TOKENS, resolveMeta } from "./registry";
import { parseGenerateResult, type GenerateOp } from "./aiOps";
import {
  createBlankPage, bumpVersion, insertChild, removeNode as removeFromTree,
  type DesignPage, type PageNode, type DeviceMode,
} from "./pageModel";
import { PAGE_TEMPLATES } from "./pageTemplates";
/**
 * Design Canvas store — local-first (Zustand + localStorage). Mirrors the
 * pattern of canvasStore but for live design composition: nodes render real
 * components, edges are prototype flows, boards are Figma-like frames.
 *
 * - nodes/edges: the React Flow graph (per active board).
 * - boards: list of frames; activeBoard filters visible nodes.
 * - tokenOverrides: live token edits scoped to the board preview.
 * - history: undo/redo stack of {nodes, edges} snapshots.
 */

const STORAGE_KEY = "aso:design-canvas:v2";

interface PersistShape {
  nodes: DCNode[];
  edges: DCEdge[];
  boards: Board[];
  activeBoard: string;
  tokenOverrides: Record<string, string>;
  snapshots: DesignSnapshot[];
  pages: DesignPage[];
  activePageId: string | null;
  viewMode: ViewMode;
  device: DeviceMode;
}

export type ViewMode = "design" | "preview" | "code";

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function persist(state: PersistShape) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* quota / disabled */ }
}

function load(): PersistShape | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistShape>;
    const defaultBoard: Board = {
      id: "board_main",
      name: "Board principal",
      background: undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    return {
      nodes: parsed.nodes ?? [],
      edges: parsed.edges ?? [],
      boards: parsed.boards?.length ? parsed.boards : [defaultBoard],
      activeBoard: parsed.activeBoard ?? defaultBoard.id,
      tokenOverrides: parsed.tokenOverrides ?? {},
      snapshots: parsed.snapshots ?? [],
      pages: parsed.pages ?? [],
      activePageId: parsed.activePageId ?? null,
      viewMode: parsed.viewMode ?? "design",
      device: parsed.device ?? "desktop",
    };
  } catch {
    return null;
  }
}

const initial = load();
const defaultBoard: Board = initial?.boards?.find((b) => b.id === initial.activeBoard) ?? {
  id: "board_main", name: "Board principal", createdAt: Date.now(), updatedAt: Date.now(),
};

function snapshot(nodes: DCNode[], edges: DCEdge[], activeBoard: string): { nodes: DCNode[]; edges: DCEdge[] } {
  const boardNodes = nodes.filter((n) => (n.data.board ?? "board_main") === activeBoard);
  const ids = new Set(boardNodes.map((n) => n.id));
  return {
    nodes: boardNodes.map((n) => ({ ...n, data: { ...n.data } })),
    edges: edges.filter((e) => ids.has(e.source) && ids.has(e.target)),
  };
}

interface HistoryEntry { nodes: DCNode[]; edges: DCEdge[]; }

interface DesignState {
  nodes: DCNode[];
  edges: DCEdge[];
  boards: Board[];
  activeBoard: string;
  tokenOverrides: Record<string, string>;
  snapshots: DesignSnapshot[];
  selectedId: string | null;
  selectedEdgeId: string | null;
  snapToGrid: boolean;
  showMinimap: boolean;
  past: HistoryEntry[];
  future: HistoryEntry[];
  /** Page-builder state (structured pages + view mode + device frame). */
  pages: DesignPage[];
  activePageId: string | null;
  viewMode: ViewMode;
  device: DeviceMode;

  onNodesChange: (c: NodeChange<DCNode>[]) => void;
  onEdgesChange: (c: EdgeChange<DCEdge>[]) => void;
  onConnect: (c: Connection) => void;
  addNode: (kind: string, position: { x: number; y: number }) => string;
  updateNodeProps: (id: string, patch: Record<string, unknown>) => void;
  updateNodeLabel: (id: string, label: string) => void;
  updateNodeSize: (id: string, width: number) => void;
  duplicateNode: (id: string) => void;
  removeNode: (id: string) => void;
  selectNode: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  setEdgeLabel: (id: string, label: string) => void;
  toggleSnapToGrid: () => void;
  toggleMinimap: () => void;

  addBoard: (name: string) => string;
  renameBoard: (id: string, name: string) => void;
  removeBoard: (id: string) => void;
  setActiveBoard: (id: string) => void;

  setTokenOverride: (token: DesignToken, value: string) => void;
  resetTokens: () => void;

  saveSnapshot: (name: string) => void;
  restoreSnapshot: (id: string) => void;
  removeSnapshot: (id: string) => void;

  undo: () => void;
  redo: () => void;
  clearBoard: () => void;
  loadGraph: (nodes: DCNode[], edges: DCEdge[]) => void;
  loadExample: () => void;

  // ── Page builder ──────────────────────────────────────────────────────
  setViewMode: (m: ViewMode) => void;
  setDevice: (d: DeviceMode) => void;
  createPage: (name?: string) => string;
  loadTemplate: (templateId: string) => void;
  setActivePage: (id: string) => void;
  renamePage: (id: string, name: string) => void;
  removePage: (id: string) => void;
  duplicatePage: (id: string) => string;
  publishPageVersion: (id: string) => void;
  addNodeToActivePage: (kind: string, props?: Record<string, unknown>, label?: string) => string;
  applyGenerateOps: (ops: GenerateOp[]) => string[];
  insertComponentIntoPage: (pageId: string, nodeId: string, parentId?: string) => void;
  removeNodeFromPage: (pageId: string, nodeId: string) => void;

  _commit: () => void;
}

const MAX_HISTORY = 60;

function pushHistory(past: HistoryEntry[], snap: HistoryEntry): HistoryEntry[] {
  return [...past.slice(-(MAX_HISTORY - 1)), snap];
}

export const useDesignStore = create<DesignState>((set, get) => ({
  nodes: initial?.nodes ?? [],
  edges: initial?.edges ?? [],
  boards: initial?.boards ?? [defaultBoard],
  activeBoard: initial?.activeBoard ?? defaultBoard.id,
  tokenOverrides: initial?.tokenOverrides ?? {},
  snapshots: initial?.snapshots ?? [],
  selectedId: null,
  selectedEdgeId: null,
  snapToGrid: false,
  showMinimap: true,
  past: [],
  future: [],
  pages: initial?.pages ?? [],
  activePageId: initial?.activePageId ?? null,
  viewMode: initial?.viewMode ?? "design",
  device: initial?.device ?? "desktop",

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) as DCNode[] });
    get()._commit();
  },
  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) as DCEdge[] });
    get()._commit();
  },
  onConnect: (c) => {
    const id = uid("dc_edge");
    const edge: DCEdge = {
      id, source: c.source ?? "", target: c.target ?? "", label: "navigate", animated: false,
    };
    set({ edges: addEdge({ ...edge, id }, get().edges) as DCEdge[] });
    get()._commit();
  },

  addNode: (kind, position) => {
    const meta = resolveMeta(kind);
    const id = uid("dc_node");
    const snap = get().snapToGrid ? { x: Math.round(position.x / 20) * 20, y: Math.round(position.y / 20) * 20 } : position;
    const node: DCNode = {
      id, type: "design", position: snap,
      data: { kind, props: { ...meta.defaults }, width: meta.defaultWidth ?? 220, board: get().activeBoard },
      width: meta.defaultWidth ?? 220,
    };
    set((s) => ({ nodes: [...s.nodes, node], selectedId: id, past: pushHistory(s.past, snapshot(s.nodes, s.edges, s.activeBoard)), future: [] }));
    get()._commit();
    return id;
  },

  updateNodeProps: (id, patch) => {
    set((s) => ({
      nodes: s.nodes.map((n) => n.id === id ? { ...n, data: { ...n.data, props: { ...n.data.props, ...patch } } } : n),
    }));
    get()._commit();
  },
  updateNodeLabel: (id, label) => {
    set((s) => ({ nodes: s.nodes.map((n) => n.id === id ? { ...n, data: { ...n.data, label } } : n) }));
    get()._commit();
  },
  updateNodeSize: (id, width) => {
    set((s) => ({ nodes: s.nodes.map((n) => n.id === id ? { ...n, width: Math.max(140, width), data: { ...n.data, width: Math.max(140, width) } } : n) }));
    get()._commit();
  },
  duplicateNode: (id) => {
    const src = get().nodes.find((n) => n.id === id);
    if (!src) return;
    const nid = uid("dc_node");
    const dup: DCNode = {
      ...src, id: nid, position: { x: src.position.x + 32, y: src.position.y + 32 },
      data: { ...src.data, props: { ...src.data.props } },
    };
    set((s) => ({ nodes: [...s.nodes, dup], selectedId: nid, past: pushHistory(s.past, snapshot(s.nodes, s.edges, s.activeBoard)), future: [] }));
    get()._commit();
  },
  removeNode: (id) => {
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
      past: pushHistory(s.past, snapshot(s.nodes, s.edges, s.activeBoard)),
      future: [],
    }));
    get()._commit();
  },
  selectNode: (id) => set({ selectedId: id, selectedEdgeId: null }),
  selectEdge: (id) => set({ selectedEdgeId: id, selectedId: null }),
  setEdgeLabel: (id, label) => {
    set((s) => ({ edges: s.edges.map((e) => e.id === id ? { ...e, label } : e) }));
    get()._commit();
  },

  toggleSnapToGrid: () => set((s) => ({ snapToGrid: !s.snapToGrid })),
  toggleMinimap: () => set((s) => ({ showMinimap: !s.showMinimap })),

  addBoard: (name) => {
    const id = uid("board");
    const board: Board = { id, name, createdAt: Date.now(), updatedAt: Date.now() };
    set((s) => ({ boards: [...s.boards, board], activeBoard: id }));
    get()._commit();
    return id;
  },
  renameBoard: (id, name) => {
    set((s) => ({ boards: s.boards.map((b) => b.id === id ? { ...b, name, updatedAt: Date.now() } : b) }));
    get()._commit();
  },
  removeBoard: (id) => {
    const s = get();
    if (s.boards.length <= 1) return;
    const next = s.boards.filter((b) => b.id !== id);
    const nextActive = id === s.activeBoard ? next[0].id : s.activeBoard;
    set({ boards: next, activeBoard: nextActive, nodes: s.nodes.filter((n) => (n.data.board ?? "board_main") !== id) });
    get()._commit();
  },
  setActiveBoard: (id) => set({ activeBoard: id, selectedId: null, selectedEdgeId: null }),

  setTokenOverride: (token, value) => {
    set((s) => ({ tokenOverrides: { ...s.tokenOverrides, [token.cssVar]: value } }));
    get()._commit();
  },
  resetTokens: () => {
    set({ tokenOverrides: {} });
    get()._commit();
  },

  saveSnapshot: (name) => {
    const s = get();
    const snap: DesignSnapshot = {
      id: uid("snap"), name: name || `Snapshot ${new Date().toLocaleString()}`,
      nodes: s.nodes.filter((n) => (n.data.board ?? "board_main") === s.activeBoard).map((n) => ({ ...n, data: { ...n.data, props: { ...n.data.props } } })),
      edges: s.edges.filter((e) => s.nodes.some((n) => n.id === e.source) && s.nodes.some((n) => n.id === e.target)),
      createdAt: Date.now(),
    };
    set((st) => ({ snapshots: [snap, ...st.snapshots].slice(0, 30) }));
    get()._commit();
  },
  restoreSnapshot: (id) => {
    const s = get();
    const snap = s.snapshots.find((x) => x.id === id);
    if (!snap) return;
    const otherBoardNodes = s.nodes.filter((n) => (n.data.board ?? "board_main") !== s.activeBoard);
    const restored = snap.nodes.map((n) => ({ ...n, data: { ...n.data, board: s.activeBoard } }));
    set({
      nodes: [...otherBoardNodes, ...restored],
      edges: snap.edges.map((e) => ({ ...e })),
      selectedId: null,
      past: pushHistory(s.past, snapshot(s.nodes, s.edges, s.activeBoard)),
      future: [],
    });
    get()._commit();
  },
  removeSnapshot: (id) => {
    set((s) => ({ snapshots: s.snapshots.filter((x) => x.id !== id) }));
    get()._commit();
  },

  undo: () => {
    const s = get();
    if (s.past.length === 0) return;
    const prev = s.past[s.past.length - 1];
    const current = snapshot(s.nodes, s.edges, s.activeBoard);
    const otherBoardNodes = s.nodes.filter((n) => (n.data.board ?? "board_main") !== s.activeBoard);
    // Mantém edges de outros boards; substitui as do board ativo pelas do
    // snapshot anterior.
    const otherBoardIds = new Set(otherBoardNodes.map((n) => n.id));
    const otherBoardEdges = s.edges.filter((e) => otherBoardIds.has(e.source) && otherBoardIds.has(e.target));
    set({
      nodes: [...otherBoardNodes, ...prev.nodes],
      edges: [...otherBoardEdges, ...prev.edges],
      past: s.past.slice(0, -1),
      future: [current, ...s.future].slice(0, MAX_HISTORY),
      selectedId: null,
    });
    get()._commit();
  },
  redo: () => {
    const s = get();
    if (s.future.length === 0) return;
    const next = s.future[0];
    const current = snapshot(s.nodes, s.edges, s.activeBoard);
    const otherBoardNodes = s.nodes.filter((n) => (n.data.board ?? "board_main") !== s.activeBoard);
    const otherBoardIds = new Set(otherBoardNodes.map((n) => n.id));
    const otherBoardEdges = s.edges.filter((e) => otherBoardIds.has(e.source) && otherBoardIds.has(e.target));
    set({
      nodes: [...otherBoardNodes, ...next.nodes],
      edges: [...otherBoardEdges, ...next.edges],
      past: pushHistory(s.past, current),
      future: s.future.slice(1),
      selectedId: null,
    });
    get()._commit();
  },

  clearBoard: () => {
    const s = get();
    set({
      nodes: s.nodes.filter((n) => (n.data.board ?? "board_main") !== s.activeBoard),
      edges: [],
      selectedId: null,
      past: pushHistory(s.past, snapshot(s.nodes, s.edges, s.activeBoard)),
      future: [],
    });
    get()._commit();
  },
  loadGraph: (nodes, edges) => {
    const s = get();
    const otherBoardNodes = s.nodes.filter((n) => (n.data.board ?? "board_main") !== s.activeBoard);
    const tagged = nodes.map((n) => ({ ...n, data: { ...n.data, board: s.activeBoard } }));
    set({
      nodes: [...otherBoardNodes, ...tagged],
      edges,
      selectedId: null,
      past: pushHistory(s.past, snapshot(s.nodes, s.edges, s.activeBoard)),
      future: [],
    });
    get()._commit();
  },

  loadExample: () => {
    const s = get();
    const board = s.activeBoard;
    const mk = (id: string, kind: string, x: number, y: number, props: Record<string, unknown>, width?: number, label?: string): DCNode => ({
      id, type: "design", position: { x, y }, width: width ?? 220,
      data: { kind, props, width: width ?? 220, board, label },
    });
    const exampleNodes: DCNode[] = [
      mk("dc_ex_btn1", "button", 80, 80, { children: "Entrar", variant: "default", size: "default", disabled: false }, 160, "CTA Entrar"),
      mk("dc_ex_input1", "input", 80, 160, { placeholder: "email@exemplo.com", type: "email", disabled: false }, 240, "Email"),
      mk("dc_ex_input2", "input", 80, 230, { placeholder: "••••••••", type: "password", disabled: false }, 240, "Senha"),
      mk("dc_ex_btn2", "button", 80, 300, { children: "Esqueci a senha", variant: "link", size: "sm", disabled: false }, 180, "Link"),
      mk("dc_ex_card1", "card", 420, 80, { title: "Login", description: "Acesse sua conta", content: "Use o formulário ao lado.", footer: "Não tem conta? Cadastre-se" }, 320, "Card de login"),
      mk("dc_ex_badge1", "badge", 420, 280, { children: "Novo", variant: "secondary" }, 120, "Badge"),
      mk("dc_ex_alert1", "alert", 420, 330, { title: "Aviso", description: "Verifique seu email.", variant: "default" }, 320, "Alerta"),
      mk("dc_ex_note1", "note", 80, 380, { text: "Exemplo: compose um formulário de login conectando o botão Entrar → Card. Fluxos de protótipo são as edges." }, 260, "Nota"),
    ];
    const exampleEdges: DCEdge[] = [
      { id: "dc_ex_e1", source: "dc_ex_btn1", target: "dc_ex_card1", label: "submit", animated: true },
    ];
    const otherBoardNodes = s.nodes.filter((n) => (n.data.board ?? "board_main") !== board);
    set({
      nodes: [...otherBoardNodes, ...exampleNodes],
      edges: exampleEdges,
      selectedId: null,
      past: pushHistory(s.past, snapshot(s.nodes, s.edges, s.activeBoard)),
      future: [],
    });
    get()._commit();
  },

  // ── Page builder actions ───────────────────────────────────────────────
  setViewMode: (m) => { set({ viewMode: m }); get()._commit(); },
  setDevice: (d) => { set({ device: d }); get()._commit(); },

  createPage: (name) => {
    const page = createBlankPage(name ?? `Página ${(get().pages.length || 0) + 1}`);
    set((s) => ({ pages: [...s.pages, page], activePageId: page.id }));
    get()._commit();
    return page.id;
  },

  loadTemplate: (templateId) => {
    const tpl = PAGE_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    const { page, nodes, edges } = tpl.build();
    set((s) => ({
      pages: [...s.pages, page],
      activePageId: page.id,
      nodes: [...s.nodes, ...nodes],
      edges: [...s.edges, ...edges],
      selectedId: null,
    }));
    get()._commit();
  },

  setActivePage: (id) => { set({ activePageId: id, selectedId: null }); get()._commit(); },

  renamePage: (id, name) => {
    set((s) => ({
      pages: s.pages.map((p) => p.id === id ? { ...p, name, updatedAt: Date.now() } : p),
    }));
    get()._commit();
  },

  removePage: (id) => {
    set((s) => {
      const next = s.pages.filter((p) => p.id !== id);
      const activePageId = s.activePageId === id ? (next[0]?.id ?? null) : s.activePageId;
      return { pages: next, activePageId };
    });
    get()._commit();
  },

  duplicatePage: (id) => {
    const src = get().pages.find((p) => p.id === id);
    if (!src) return "";
    const copy: DesignPage = {
      ...src,
      id: uid("page"),
      name: `${src.name} (cópia)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set((s) => ({ pages: [...s.pages, copy], activePageId: copy.id }));
    get()._commit();
    return copy.id;
  },

  publishPageVersion: (id) => {
    const page = get().pages.find((p) => p.id === id);
    if (!page) return;
    set((s) => ({
      pages: s.pages.map((p) => p.id === id ? bumpVersion(p, p.root) : p),
    }));
    get()._commit();
  },

  addNodeToActivePage: (kind, props, label) => {
    const id = get().addNode(kind, { x: 120 + Math.random() * 80, y: 100 + Math.random() * 80 });
    if (props) get().updateNodeProps(id, props);
    if (label) get().updateNodeLabel(id, label);
    const activePageId = get().activePageId;
    if (activePageId) get().insertComponentIntoPage(activePageId, id);
    return id;
  },

  applyGenerateOps: (ops) => {
    const createdIds: string[] = [];
    const labelToId = new Map<string, string>();
    for (const op of ops) {
      if (op.type === "add") {
        const id = get().addNode(op.kind, { x: 120 + Math.random() * 120, y: 100 + Math.random() * 120 });
        if (op.label) { get().updateNodeLabel(id, op.label); labelToId.set(op.label, id); }
        if (op.props && Object.keys(op.props).length) get().updateNodeProps(id, op.props);
        if (op.dataSource) get().updateNodeProps(id, { dataSource: op.dataSource });
        createdIds.push(id);
        const activePageId = get().activePageId;
        if (activePageId) get().insertComponentIntoPage(activePageId, id);
      } else if (op.type === "setProps") {
        const id = op.label ? labelToId.get(op.label) : createdIds[createdIds.length - 1];
        if (id && op.props) get().updateNodeProps(id, op.props);
      } else if (op.type === "setDataSource") {
        const id = op.label ? labelToId.get(op.label) : createdIds[createdIds.length - 1];
        if (id) get().updateNodeProps(id, { dataSource: op.dataSource });
      } else if (op.type === "connect") {
        const src = op.fromLabel ? labelToId.get(op.fromLabel) : createdIds[createdIds.length - 2];
        const tgt = op.toLabel ? labelToId.get(op.toLabel) : createdIds[createdIds.length - 1];
        if (src && tgt) get().onConnect({ source: src, target: tgt, sourceHandle: null, targetHandle: null });
      } else if (op.type === "note") {
        const id = get().addNode("note", { x: 120 + Math.random() * 120, y: 240 + Math.random() * 80 });
        get().updateNodeProps(id, { text: op.text });
        const activePageId = get().activePageId;
        if (activePageId) get().insertComponentIntoPage(activePageId, id);
        createdIds.push(id);
      }
    }
    return createdIds;
  },

  insertComponentIntoPage: (pageId, nodeId, parentId) => {
    set((s) => ({
      pages: s.pages.map((p) => {
        if (p.id !== pageId) return p;
        const target = parentId
          ? { ...p, root: insertChild(p.root, parentId, { id: uid("c"), kind: "component", ref: nodeId, children: [] }) }
          : (() => {
              // Insert into the first column found (depth-first), else into the first section.
              let inserted = false;
              const ins = (n: PageNode): PageNode => {
                if (inserted) return n;
                if (n.kind === "column") {
                  inserted = true;
                  return { ...n, children: [...n.children, { id: uid("c"), kind: "component", ref: nodeId, children: [] }] };
                }
                return { ...n, children: n.children.map(ins) };
              };
              const root2 = ins(p.root);
              return { ...p, root: inserted ? root2 : insertChild(p.root, p.root.id, { id: uid("c"), kind: "component", ref: nodeId, children: [] }) };
          })();
        return { ...target, updatedAt: Date.now() };
      }),
    }));
    get()._commit();
  },

  removeNodeFromPage: (pageId, nodeId) => {
    set((s) => ({
      pages: s.pages.map((p) => p.id === pageId ? { ...p, root: removeFromTree(p.root, nodeId), updatedAt: Date.now() } : p),
    }));
    get()._commit();
  },

  _commit: () => {
    const s = get();
    persist({
      nodes: s.nodes, edges: s.edges, boards: s.boards,
      activeBoard: s.activeBoard, tokenOverrides: s.tokenOverrides,
      snapshots: s.snapshots,
      pages: s.pages, activePageId: s.activePageId,
      viewMode: s.viewMode, device: s.device,
    });
  },
}));

/** Visible nodes for the active board (React Flow only renders these). */
export function useVisibleNodes(): DCNode[] {
  const nodes = useDesignStore((s) => s.nodes);
  const activeBoard = useDesignStore((s) => s.activeBoard);
  return nodes.filter((n) => (n.data.board ?? "board_main") === activeBoard);
}

export function useVisibleEdges(): DCEdge[] {
  const edges = useDesignStore((s) => s.edges);
  const nodes = useDesignStore((s) => s.nodes);
  const activeBoard = useDesignStore((s) => s.activeBoard);
  const ids = new Set(nodes.filter((n) => (n.data.board ?? "board_main") === activeBoard).map((n) => n.id));
  return edges.filter((e) => ids.has(e.source) && ids.has(e.target));
}

export { DESIGN_TOKENS };

export type { DCNode, DCEdge, Board, DesignSnapshot, DesignToken, DCNodeData } from "./types";
// Re-export pure page-model helpers consumers (preview, tests) use.
export {
  createBlankPage, bumpVersion, insertChild, removeNode as removeFromTree,
  findNode, replaceNode, cloneNode, collectRefs, serializePage, deserializePage,
  DEVICE_WIDTHS,
} from "./pageModel";
export type { DesignPage, PageNode, ContainerKind, DeviceMode } from "./pageModel";
export { PAGE_TEMPLATES, getTemplate } from "./pageTemplates";
export type { PageTemplate } from "./pageTemplates";
export {
  resolveDataSource, makeAppKey, DATA_SOURCE_OPTIONS, appDataSourceOptions,
  isDataOrganism, DATA_ORGANISM_KINDS,
} from "./dataBinding";
export type { DataSourceSpec, ResolvedData } from "./dataBinding";
export { GENERATE_SYSTEM_PROMPT, parseGenerateResult as parseGenerate } from "./aiOps";
export type { GenerateOp, GenerateResult } from "./aiOps";
