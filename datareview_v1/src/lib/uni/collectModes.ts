/**
 * collectModes — modos de coleta da página Uni (rápida/normal/max/custom) e
 * helpers de multi-seleção de recursos por fonte (ex.: suggest em várias
 * verticais, trends em vários períodos × verticais).
 *
 * Referência: docs/_uni.py — o usuário escolhe blocos/recursos em conjunto
 * ("t" = todos) e o sistema executa todas as combinações selecionadas.
 */
import type { UniItem } from "./types";

export type CollectMode = "fast" | "normal" | "max" | "custom";

export const COLLECT_MODES: { id: CollectMode; label: string; description: string }[] = [
  { id: "fast", label: "Rápida", description: "Poucas requisições, limites mínimos — resposta quase instantânea." },
  { id: "normal", label: "Normal", description: "Equilíbrio entre cobertura e tempo (padrão)." },
  { id: "max", label: "Máxima", description: "Limites altos + expansões — cobertura maximalista, mais lenta." },
  { id: "custom", label: "Custom", description: "Você define o limite de resultados por recurso." },
];

export const CUSTOM_LIMIT_MIN = 1;
export const CUSTOM_LIMIT_MAX = 500;

/** Limite de resultados por recurso para cada modo. */
export function modeLimit(mode: CollectMode, customLimit?: number): number {
  switch (mode) {
    case "fast":
      return 5;
    case "normal":
      return 12;
    case "max":
      return 50;
    case "custom": {
      const n = Math.floor(Number(customLimit) || CUSTOM_LIMIT_MIN);
      return Math.max(CUSTOM_LIMIT_MIN, Math.min(n, CUSTOM_LIMIT_MAX));
    }
  }
}

/** Modo "max" liga expansões profundas (ex.: suggest a–z) por padrão. */
export function modeExpand(mode: CollectMode): boolean {
  return mode === "max";
}

/** Toggle de multi-seleção (adiciona se ausente, remove se presente). */
export function toggleInList<T>(list: readonly T[], id: T): T[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

/** Dedup de itens por id mantendo o MAIOR score (merges multi-recurso). */
export function dedupItems(items: UniItem[]): UniItem[] {
  const best = new Map<string, UniItem>();
  for (const item of items) {
    const prev = best.get(item.id);
    if (!prev || (item.score ?? 0) > (prev.score ?? 0)) best.set(item.id, item);
  }
  return [...best.values()];
}

/** Produto cartesiano limitado (ex.: períodos × verticais do trends). */
export function cartesianCap<A, B>(as: readonly A[], bs: readonly B[], cap: number): [A, B][] {
  const out: [A, B][] = [];
  for (const a of as) {
    for (const b of bs) {
      if (out.length >= cap) return out;
      out.push([a, b]);
    }
  }
  return out;
}
