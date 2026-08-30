import type { FlowSectionId } from "@/lib/flow/flowModel";

/**
 * Foco compartilhado do System Flow — qual seção está "ativa" no momento.
 * O navegador (esquerda), a missão bar e o painel contextual (direita) leem
 * esse estado para mostrar a seção relevante. Render-safe via pub/sub.
 */

type Listener = () => void;
let focused: FlowSectionId | null = null;
const listeners = new Set<Listener>();

export function getFocusedSection(): FlowSectionId | null {
  return focused;
}

export function setFocusedSection(id: FlowSectionId | null): void {
  if (focused === id) return;
  focused = id;
  listeners.forEach((l) => l());
}

export function subscribeFlowFocus(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
