/**
 * uiShell/store.ts — store pub/sub do layout da página UI.
 *
 * Persiste larguras + recolhimento das 4 colunas laterais em
 * `aso:ui-shell:v1` (o auto-collapse NÃO é persistido — é derivado do
 * espaço disponível a cada render). A referência do estado só muda em
 * writes (snapshot estável para useSyncExternalStore).
 */
import { useSyncExternalStore } from "react";
import {
  defaultShellState, parseShellState, serializeShellState, clampWidth,
  getColumnSpec, type UiColumnId, type UiShellState,
} from "./layout";

const STORAGE_KEY = "aso:ui-shell:v1";
const listeners = new Set<() => void>();

function load(): UiShellState {
  try {
    return parseShellState(localStorage.getItem(STORAGE_KEY));
  } catch {
    return defaultShellState();
  }
}

let state: UiShellState = load();

function persist() {
  try { localStorage.setItem(STORAGE_KEY, serializeShellState(state)); } catch { /* quota */ }
}

function setState(next: UiShellState) {
  state = next;
  persist();
  listeners.forEach((l) => l());
}

export function getUiShellState(): UiShellState {
  return state;
}

export function useUiShell(): UiShellState {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => state,
    () => state,
  );
}

function patchColumn(id: UiColumnId, patch: Partial<{ width: number; collapsed: boolean }>) {
  const spec = getColumnSpec(id);
  setState({
    ...state,
    [id]: {
      width: patch.width != null ? clampWidth(spec, patch.width) : state[id].width,
      collapsed: patch.collapsed ?? state[id].collapsed,
    },
  });
}

export function setColumnWidth(id: UiColumnId, width: number): void {
  patchColumn(id, { width });
}

/** Ajusta a largura por delta (px) — usado pelo drag handle e teclado. */
export function resizeColumn(id: UiColumnId, deltaPx: number): void {
  patchColumn(id, { width: state[id].width + deltaPx });
}

export function setColumnCollapsed(id: UiColumnId, collapsed: boolean): void {
  patchColumn(id, { collapsed });
}

export function toggleColumnCollapsed(id: UiColumnId): void {
  patchColumn(id, { collapsed: !state[id].collapsed });
}

/** Reset individual: largura padrão (mantém o recolhimento). */
export function resetColumn(id: UiColumnId): void {
  patchColumn(id, { width: getColumnSpec(id).defaultWidth });
}

/** Reset global: volta ao layout padrão dividido em 3 colunas
 *  (externas abertas na largura padrão, internas recolhidas em rail). */
export function resetShell(): void {
  setState(defaultShellState());
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}
