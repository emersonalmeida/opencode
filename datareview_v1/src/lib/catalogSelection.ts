/**
 * Seleção de componente na página `/componentes` — pub/sub simples (padrão
 * dos stores do sistema). O card clicado na coluna central define o
 * componente selecionado; a sidebar interna direita (aba "Componente")
 * reage e mostra detalhes + preview.
 *
 * Estado em memória (não persistido) — a seleção é efêmera por natureza.
 */
import { useEffect, useState } from "react";

export interface SelectedComponent {
  /** Caminho do arquivo (ex.: "components/shared/EmptyState.tsx"). */
  file: string;
  /** Página de origem (path do registry) ou "shared". */
  pagePath: string;
  /** Label da página de origem. */
  pageLabel: string;
}

type Listener = () => void;

let selected: SelectedComponent | null = null;
const listeners = new Set<Listener>();

/** Evento disparado junto com a seleção — a sidebar direita ouve para
 *  trocar automaticamente para a aba "Componente". */
export const CATALOG_SELECT_EVENT = "catalog:select-component";

export function getSelectedComponent(): SelectedComponent | null {
  return selected;
}

export function selectComponent(sel: SelectedComponent | null) {
  const same =
    (selected === null && sel === null) ||
    (selected !== null && sel !== null && selected.file === sel.file);
  if (same) return;
  selected = sel;
  for (const l of listeners) l();
  if (sel && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CATALOG_SELECT_EVENT, { detail: sel }));
  }
}

export function subscribeSelectedComponent(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Hook reativo (padrão useDataset: useState + subscribe — nunca
 *  useSyncExternalStore com estado mutável). */
export function useSelectedComponent(): SelectedComponent | null {
  const [value, setValue] = useState(selected);
  useEffect(() => subscribeSelectedComponent(() => setValue(getSelectedComponent())), []);
  return value;
}
