/**
 * Modelo de página do page builder do Design Canvas.
 *
 * Uma "página" é um documento estruturado (não um grafo livre): uma árvore de
 * containers de layout (sections → rows → columns) que no fim envolvem nós de
 * componente. É isso que transforma o canvas de um board de mockup estilo Figma
 * num *page builder* real, cuja saída pode ser renderizada como página
 * responsiva (desktop / tablet / mobile) e até materializada como rota real.
 *
 * Os mesmos nós vivem no grafo React Flow para edição visual; a árvore da
 * página é uma estrutura leve e serializável que referencia nós por id e
 * impõe semântica de layout sobre eles.
 *
 * Somente funções puras (sem React) → testáveis em unidade.
 */
import type { DCNode, DCEdge } from "./types";

export type ContainerKind = "page" | "section" | "row" | "column" | "stack";

export interface PageNode {
  /** Stable id. For containers, "c_…"; for component refs, equals the DCNode id. */
  id: string;
  /** Container type, or "component" for a leaf referencing a DCNode. */
  kind: ContainerKind | "component";
  /** For component leaves: the referenced DCNode id. */
  ref?: string;
  /** Optional width/offset hints for the column (1–12 grid span). */
  span?: number;
  /** Optional gap between children (px). */
  gap?: number;
  /** Optional className passthrough (designer escape hatch). */
  className?: string;
  children: PageNode[];
}

export interface DesignPage {
  id: string;
  name: string;
  route?: string;
  root: PageNode;
  createdAt: number;
  updatedAt: number;
  version: number;
  /** Optional previous-version snapshots (for "edit existing → new version"). */
  history: { version: number; root: PageNode; savedAt: number }[];
}

export interface PageSnapshot {
  nodes: DCNode[];
  edges: DCEdge[];
  root: PageNode;
}

export function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Create an empty page with a single section + column. */
export function createBlankPage(name = "Nova página"): DesignPage {
  const now = Date.now();
  const col: PageNode = { id: uid("c"), kind: "column", span: 12, children: [] };
  const section: PageNode = { id: uid("c"), kind: "section", gap: 16, children: [col] };
  return {
    id: uid("page"),
    name,
    root: { id: uid("c"), kind: "page", gap: 24, children: [section] },
    createdAt: now,
    updatedAt: now,
    version: 1,
    history: [],
  };
}

/** Deep-clone a page node tree (immutable helpers). */
export function cloneNode(n: PageNode): PageNode {
  return { ...n, children: n.children.map(cloneNode) };
}

/** Find a node by id in the tree. */
export function findNode(root: PageNode, id: string): PageNode | null {
  if (root.id === id) return root;
  for (const c of root.children) {
    const found = findNode(c, id);
    if (found) return found;
  }
  return null;
}

/** Functional update: return a new tree with the matching node replaced. */
export function replaceNode(root: PageNode, id: string, updater: (n: PageNode) => PageNode): PageNode {
  if (root.id === id) return updater(root);
  return { ...root, children: root.children.map((c) => replaceNode(c, id, updater)) };
}

/** Remove a node by id from the tree. */
export function removeNode(root: PageNode, id: string): PageNode {
  return {
    ...root,
    children: root.children
      .filter((c) => c.id !== id)
      .map((c) => removeNode(c, id)),
  };
}

/** Insert a child into a container by id. */
export function insertChild(root: PageNode, parentId: string, child: PageNode, index?: number): PageNode {
  return replaceNode(root, parentId, (n) => {
    const next = [...n.children];
    if (typeof index === "number") next.splice(index, 0, child);
    else next.push(child);
    return { ...n, children: next };
  });
}

/** Move a node to a new parent (removes from old, inserts at new). */
export function moveNode(root: PageNode, id: string, parentId: string, index?: number): PageNode {
  const found = findNode(root, id);
  if (!found) return root;
  const pruned = removeNode(root, id);
  return insertChild(pruned, parentId, cloneNode(found), index);
}

/** Collect every component-leaf ref id in the page (depth-first). */
export function collectRefs(root: PageNode): string[] {
  const out: string[] = [];
  const walk = (n: PageNode) => {
    if (n.kind === "component" && n.ref) out.push(n.ref);
    for (const c of n.children) walk(c);
  };
  walk(root);
  return out;
}

/** Default grid spans for a row's children so columns auto-balance. */
export function autoBalanceSpans(children: PageNode[]): PageNode[] {
  const cols = children.filter((c) => c.kind === "column");
  if (cols.length === 0) return children;
  const span = Math.max(1, Math.floor(12 / cols.length));
  return children.map((c) => (c.kind === "column" ? { ...c, span } : c));
}

/** Serialize a page to a plain JSON-safe object (already plain, but explicit). */
export function serializePage(page: DesignPage): string {
  return JSON.stringify(page);
}

/** Deserialize a page from JSON, tolerating missing fields. */
export function deserializePage(raw: string): DesignPage | null {
  try {
    const p = JSON.parse(raw) as Partial<DesignPage>;
    if (!p || !p.root) return null;
    return {
      id: p.id ?? uid("page"),
      name: p.name ?? "Nova página",
      route: p.route,
      root: p.root,
      createdAt: p.createdAt ?? Date.now(),
      updatedAt: p.updatedAt ?? Date.now(),
      version: p.version ?? 1,
      history: p.history ?? [],
    };
  } catch {
    return null;
  }
}

/** Bump a page to a new version, archiving the current root in history. */
export function bumpVersion(page: DesignPage, root: PageNode): DesignPage {
  return {
    ...page,
    root,
    version: page.version + 1,
    updatedAt: Date.now(),
    history: [
      ...page.history,
      { version: page.version, root: page.root, savedAt: Date.now() },
    ].slice(-20),
  };
}

/** Responsive breakpoint widths (px) for device preview. */
export const DEVICE_WIDTHS = {
  mobile: 390,
  tablet: 834,
  desktop: 1280,
} as const;

export type DeviceMode = keyof typeof DEVICE_WIDTHS;
