/**
 * Global app-selection state — the single source of truth for "which collected
 * apps is the user currently working with". Driven by the unified left sidebar
 * and consumed by every page that runs AI (Chat, Experiments) and by the right
 * AI assistant panel, so selecting an app in the sidebar makes it the active
 * context everywhere — no re-collection needed.
 *
 * Keys are `${store}:${id}` (same shape used by the dataset store). Persisted
 * to localStorage so the selection survives reloads.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { listDataset, subscribeDataset } from "@/lib/datasetStore";

const KEY = "aso:selected-apps:v1";

/** Lê a seleção persistida (exportado p/ comandos CLI e testes). */
export function readStored(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function write(keys: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(keys));
  } catch {
    /* ignore quota */
  }
}

function entryKey(store: string, id: string) {
  return `${store}:${id}`;
}

/**
 * Evento de sincronização externa da seleção — disparado quando código fora
 * do React (ex.: `collectAndSelect`, busca global) escreve na seleção. O
 * provider escuta e re-sincroniza o estado a partir do localStorage.
 */
const SELECTION_SYNC_EVENT = "aso:selection-sync";

/**
 * Seleciona chaves na seleção global FORA de componentes React (união com a
 * seleção atual, persistido + evento de sync). Usado pelo fluxo de
 * auto-coleta: ao escolher um app na busca, ele entra selecionado em todo o
 * sistema sem o usuário precisar marcá-lo de novo na aba Apps.
 */
function selectKeysGlobally(keys: string[]) {
  if (keys.length === 0) return;
  const next = new Set(readStored());
  for (const k of keys) next.add(k);
  write(Array.from(next));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SELECTION_SYNC_EVENT));
  }
}

interface SelectionCtx {
  /** Selected app keys (`store:id`). */
  selected: Set<string>;
  /** Toggle a key on/off. */
  toggle: (key: string) => void;
  /** Replace the whole selection. */
  setSelected: (keys: Iterable<string>) => void;
  selectAll: (keys: Iterable<string>) => void;
  selectNone: () => void;
  /** Whether a key is selected. */
  isSelected: (key: string) => boolean;
}

const Ctx = createContext<SelectionCtx>({
  selected: new Set(),
  toggle: () => {},
  setSelected: () => {},
  selectAll: () => {},
  selectNone: () => {},
  isSelected: () => false,
});

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selected, setSelectedState] = useState<Set<string>>(() => new Set(readStored()));

  // Persist on every change.
  useEffect(() => {
    write(Array.from(selected));
  }, [selected]);

  // Re-sync when external code (auto collect-and-select, outra aba/aba do
  // navegador) escreve na seleção diretamente no localStorage.
  useEffect(() => {
    const sync = () => setSelectedState((prev) => {
      const fromStore = new Set(readStored());
      if (fromStore.size === prev.size && [...fromStore].every((k) => prev.has(k))) return prev;
      return fromStore;
    });
    window.addEventListener(SELECTION_SYNC_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SELECTION_SYNC_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Drop keys whose apps were removed from the dataset, so the selection never
  // references apps that no longer exist.
  useEffect(() => {
    return subscribeDataset(() => {
      const valid = new Set(listDataset().map((e) => entryKey(e.app.store, e.app.id)));
      setSelectedState((prev) => {
        let changed = false;
        const next = new Set<string>();
        for (const k of prev) {
          if (valid.has(k)) next.add(k);
          else changed = true;
        }
        return changed ? next : prev;
      });
    });
  }, []);

  const toggle = useCallback((key: string) => {
    setSelectedState((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const setSelected = useCallback((keys: Iterable<string>) => {
    setSelectedState(new Set(keys));
  }, []);

  const selectAll = useCallback((keys: Iterable<string>) => {
    setSelectedState(new Set(keys));
  }, []);

  const selectNone = useCallback(() => setSelectedState(new Set()), []);

  const isSelected = useCallback((key: string) => selected.has(key), [selected]);

  const value = useMemo(
    () => ({ selected, toggle, setSelected, selectAll, selectNone, isSelected }),
    [selected, toggle, setSelected, selectAll, selectNone, isSelected],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSelection() {
  return useContext(Ctx);
}

export { entryKey, selectKeysGlobally, SELECTION_SYNC_EVENT };
