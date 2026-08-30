import type { LucideIcon } from "lucide-react";

/**
 * Design Canvas — a Figma/Penpot-like surface where the user composes, edits,
 * connects and prototypes the entire design system live: tokens, atoms,
 * molecules, organisms, layouts, themes and templates. Every node renders a
 * REAL component from `src/components/ui/*` (or a layout frame), editable
 * through the inspector.
 */

export type AtomicLayer = "token" | "atom" | "molecule" | "organism" | "layout" | "template";

/** A single editable prop of a component node. */
export interface PropSchema {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "boolean" | "select" | "color" | "icon" | "dataSource" | "json";
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  default: unknown;
  placeholder?: string;
  help?: string;
}

export interface ComponentMeta {
  kind: string;
  label: string;
  layer: AtomicLayer;
  icon: LucideIcon;
  description: string;
  defaults: Record<string, unknown>;
  props: PropSchema[];
  defaultWidth?: number;
  /** True when this component consumes bound dataset (charts, tables, lists). */
  dataBound?: boolean;
}

export interface DesignToken {
  key: string;
  label: string;
  layer: "color" | "radius" | "spacing" | "type" | "elevation";
  cssVar: string;
  value: string;
  description: string;
}

export interface DCNodeData {
  kind: string;
  label?: string;
  props: Record<string, unknown>;
  width?: number;
  board?: string;
  [key: string]: unknown;
}

export interface DCNode {
  id: string;
  type: "design";
  position: { x: number; y: number };
  data: DCNodeData;
  width?: number;
  height?: number;
  selected?: boolean;
}

export interface DCEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
}

export interface Board {
  id: string;
  name: string;
  background?: string;
  createdAt: number;
  updatedAt: number;
}

export interface DesignSnapshot {
  id: string;
  name: string;
  nodes: DCNode[];
  edges: DCEdge[];
  createdAt: number;
}
