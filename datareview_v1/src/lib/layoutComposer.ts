/**
 * Layout Composer — o usuário monta a própria interface movendo WIDGETS
 * entre os 4 slots de coluna do modelo de 5 colunas:
 *
 *   [leftExt] [leftInt] [CENTRO] [rightInt] [rightExt]
 *
 * Cada slot é uma LISTA ordenada de widgets — vários widgets no mesmo slot
 * empilham verticalmente (split vertical), cada um com seu próprio conteúdo,
 * colapso e altura. Widgets podem ser movidos entre slots (arrastar/soltar
 * ou menu "Mover para") e reordenados dentro do slot.
 *
 * Persistido em `aso:layout-composer:v1`. O layout padrão reproduz exatamente
 * o comportamento atual (nav à esquerda externa, IA à direita externa,
 * sidebars internas da página nos slots internos).
 */
import { useEffect, useState } from "react";

export type LayoutSlot = "leftExt" | "leftInt" | "rightInt" | "rightExt";
export const SLOT_ORDER: LayoutSlot[] = ["leftExt", "leftInt", "rightInt", "rightExt"];
export const SLOT_LABEL: Record<LayoutSlot, string> = {
  leftExt: "Extrema esquerda",
  leftInt: "Esquerda interna",
  rightInt: "Direita interna",
  rightExt: "Extrema direita",
};

export type WidgetId = "nav" | "ai" | "page-left" | "page-right";

export interface WidgetMeta {
  id: WidgetId;
  label: string;
  description: string;
}

export const WIDGETS: WidgetMeta[] = [
  { id: "nav", label: "Menu de páginas", description: "Navegação principal do sistema" },
  { id: "ai", label: "Assistente de IA", description: "Chat, apps, gráficos, artefatos, chats e config" },
  { id: "page-left", label: "Painel da página (esq.)", description: "Contexto, seções e ajuda da página ativa" },
  { id: "page-right", label: "Painel da página (dir.)", description: "Insights e atividade da página ativa" },
];

export type LayoutState = Record<LayoutSlot, WidgetId[]>;

export const DEFAULT_LAYOUT: LayoutState = {
  leftExt: ["nav"],
  leftInt: ["page-left"],
  rightInt: ["page-right"],
  rightExt: ["ai"],
};

const KEY = "aso:layout-composer:v1";
let cache: LayoutState | null = null;
const listeners = new Set<() => void>();

/** Sanitiza: cada widget aparece exatamente uma vez; slots desconhecidos fora. */
export function sanitizeLayout(raw: unknown): LayoutState {
  const result: LayoutState = { leftExt: [], leftInt: [], rightInt: [], rightExt: [] };
  const seen = new Set<WidgetId>();
  const valid = new Set<WidgetId>(WIDGETS.map((w) => w.id));
  if (raw && typeof raw === "object") {
    for (const slot of SLOT_ORDER) {
      const list = (raw as Record<string, unknown>)[slot];
      if (Array.isArray(list)) {
        for (const id of list) {
          if (valid.has(id as WidgetId) && !seen.has(id as WidgetId)) {
            result[slot].push(id as WidgetId);
            seen.add(id as WidgetId);
          }
        }
      }
    }
  }
  // Widgets ausentes voltam ao slot padrão (nunca somem da interface).
  for (const slot of SLOT_ORDER) {
    for (const id of DEFAULT_LAYOUT[slot]) {
      if (!seen.has(id)) {
        result[slot].push(id);
        seen.add(id);
      }
    }
  }
  return result;
}

export function getLayout(): LayoutState {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? sanitizeLayout(JSON.parse(raw)) : sanitizeLayout(DEFAULT_LAYOUT);
  } catch {
    cache = sanitizeLayout(DEFAULT_LAYOUT);
  }
  return cache;
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* quota */ }
}
function notify() { listeners.forEach((l) => l()); }

export function isDefaultLayout(s: LayoutState = getLayout()): boolean {
  return SLOT_ORDER.every((slot) =>
    s[slot].length === DEFAULT_LAYOUT[slot].length &&
    s[slot].every((w, i) => DEFAULT_LAYOUT[slot][i] === w));
}

/** Move um widget para outro slot (ou reordena dentro do mesmo). */
export function moveWidget(state: LayoutState, id: WidgetId, to: LayoutSlot, index?: number): LayoutState {
  const next: LayoutState = {
    leftExt: state.leftExt.filter((w) => w !== id),
    leftInt: state.leftInt.filter((w) => w !== id),
    rightInt: state.rightInt.filter((w) => w !== id),
    rightExt: state.rightExt.filter((w) => w !== id),
  };
  const list = [...next[to]];
  const at = index === undefined ? list.length : Math.max(0, Math.min(index, list.length));
  list.splice(at, 0, id);
  next[to] = list;
  return next;
}

export function setLayout(state: LayoutState): void {
  cache = sanitizeLayout(state);
  persist(); notify();
}

export function move(id: WidgetId, to: LayoutSlot, index?: number): void {
  setLayout(moveWidget(getLayout(), id, to, index));
}

export function resetLayout(): void {
  cache = sanitizeLayout(DEFAULT_LAYOUT);
  persist(); notify();
}

export function useLayout(): LayoutState {
  const [s, setS] = useState<LayoutState>(getLayout);
  useEffect(() => {
    const l = () => setS(getLayout());
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return s;
}
