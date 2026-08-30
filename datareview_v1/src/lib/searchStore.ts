/**
 * Search Store — estado compartilhado da busca de apps (Apple + Google).
 *
 * Permite que o CAMPO de busca, os RESULTADOS e a SELEÇÃO vivam em
 * componentes/blocos separados (ex.: blocos distintos no construtor
 * `/layouts`): o campo escreve aqui, os resultados leem daqui — sem
 * acoplamento direto entre eles.
 *
 * Pub/sub com snapshot memoizado (anti-loop do useSyncExternalStore).
 * Nada é persistido: busca é estado de sessão (efêmero por design).
 */
import { useSyncExternalStore } from "react";
import { searchApps, type AppInfo } from "@/lib/appStoreApi";
import { searchGooglePlayApps } from "@/lib/googlePlayApi";
import { getUserRegion } from "@/lib/region";

export interface SearchState {
  /** Último termo buscado (submetido). */
  term: string;
  /** Resultados da última busca (null = ainda não buscou). */
  results: AppInfo[] | null;
  searching: boolean;
  error: string | null;
  /** Timestamp da última busca concluída (0 = nunca). */
  searchedAt: number;
}

const INITIAL: SearchState = {
  term: "",
  results: null,
  searching: false,
  error: null,
  searchedAt: 0,
};

let state: SearchState = INITIAL;
// Snapshot string: único a cada setState (busca é ação explícita — re-buscar o
// mesmo termo deve re-notificar). Conteúdo do fingerprint é irrelevante, só a
// identidade importa (anti-loop: muda só quando setState é chamado).
let fingerprint = "initial";
const listeners = new Set<() => void>();

function setState(next: SearchState) {
  state = next;
  fingerprint = `${next.searchedAt}:${next.searching ? 1 : 0}:${Math.random().toString(36).slice(2, 8)}`;
  listeners.forEach((l) => l());
}

export function subscribeSearch(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getSearchState(): SearchState {
  return state;
}

/** Resultados por loja (derivados, sem rede). */
export function searchResultsByStore(s: SearchState): { apple: AppInfo[]; google: AppInfo[] } {
  const results = s.results ?? [];
  return {
    apple: results.filter((a) => a.store === "apple"),
    google: results.filter((a) => a.store === "google"),
  };
}

/** Executa a busca nas duas lojas em paralelo (até `perStore` por loja). */
export async function runSearch(term: string, perStore = 6): Promise<void> {
  const q = term.trim();
  if (!q) return;
  setState({ ...state, term: q, searching: true, error: null });
  try {
    const region = getUserRegion();
    const [apple, google] = await Promise.all([
      searchApps(q, region, perStore).catch(() => []),
      searchGooglePlayApps(q, region, perStore).catch(() => []),
    ]);
    setState({
      term: q,
      results: [...apple, ...google],
      searching: false,
      error: null,
      searchedAt: Date.now(),
    });
  } catch {
    setState({
      ...state,
      searching: false,
      error: "Falha na busca. Verifique a conexão e tente novamente.",
      searchedAt: Date.now(),
    });
  }
}

/** Limpa termo + resultados (volta ao estado inicial). */
export function clearSearch(): void {
  setState(INITIAL);
}

/** Hook reativo do estado de busca. */
export function useSearchState(): SearchState {
  useSyncExternalStore(subscribeSearch, () => fingerprint);
  return state;
}
