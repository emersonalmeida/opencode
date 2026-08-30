/**
 * Lojas vinculadas (todo.md P1): agrupa entries do dataset que parecem ser o
 * mesmo app em lojas diferentes (Apple/App Store ↔ Google Play). Determinístico
 * e honesto: usa normalização de nome (+ desempate por desenvolvedor) e expõe
 * a confiança do match; nunca merge silenciosamente.
 */
import type { DatasetEntry } from "@/lib/datasetStore";

export interface LinkedGroup {
  /** Nome normalizado do app (chave do grupo). */
  name: string;
  developer?: string;
  entries: DatasetEntry[];
  /** Lojas presentes no grupo. */
  stores: string[];
  /** Confiança 0–1 da ligação (1 = nome exato + dev confere). */
  confidence: number;
}

/** Normaliza o nome do app para casar Apple↔Google: lowercase, sem acento, sem pontuação extra. */
export function normalizeAppName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Normaliza o desenvolvedor para comparação (desempate no match). */
export function normalizeDeveloper(dev?: string): string | undefined {
  if (!dev) return undefined;
  const n = normalizeAppName(dev);
  return n || undefined;
}

/** So score entre duas entries: 1 = nome exato; 0.7 = nome exato mas dev diverge; 0.4 = prefixo forte. */
export function storeLinkScore(a: DatasetEntry, b: DatasetEntry): number {
  const an = normalizeAppName(a.app.name);
  const bn = normalizeAppName(b.app.name);
  if (!an || !bn) return 0;
  if (an === bn) {
    const da = normalizeDeveloper(a.app.developer);
    const db = normalizeDeveloper(b.app.developer);
    if (da && db && da === db) return 1;
    if (da && db && da !== db) return 0.7;
    return 0.85;
  }
  // prefixo forte: nomes curtos com prefixo comum ≥ min(4, 60% do menor)
  const shorter = Math.min(an.length, bn.length);
  const prefixLen = Math.max(4, Math.floor(shorter * 0.6));
  if (an.startsWith(bn.slice(0, prefixLen)) || bn.startsWith(an.slice(0, prefixLen))) return 0.4;
  return 0;
}

/**
 * Agrupa o dataset por nome normalizado. Grupos com >1 loja ganham confiança
 * ≥ 0.7 (senão honestamente marcados como match fraco).
 */
export function linkStoresAcrossStores(entries: DatasetEntry[], minConfidence = 0.4): LinkedGroup[] {
  const groups = new Map<string, DatasetEntry[]>();
  for (const e of entries) {
    const key = normalizeAppName(e.app.name);
    if (!key) continue;
    const arr = groups.get(key) ?? [];
    arr.push(e);
    groups.set(key, arr);
  }
  const out: LinkedGroup[] = [];
  for (const arr of groups.values()) {
    const stores = [...new Set(arr.map((e) => e.app.store))];
    let confidence = 1;
    if (stores.length > 1) {
      // match 1-loja com nomes idênticos: confiança no valor máximo do par mais fraco
      let minPair = 1;
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          minPair = Math.min(minPair, storeLinkScore(arr[i], arr[j]));
        }
      }
      confidence = minPair;
    }
    if (confidence >= minConfidence) {
      out.push({
        name: normalizeAppName(arr[0].app.name),
        developer: normalizeDeveloper(arr[0].app.developer),
        entries: arr,
        stores,
        confidence,
      });
    }
  }
  return out.sort((a, b) => b.entries.reduce((s, e) => s + e.reviews.length, 0) - a.entries.reduce((s, e) => s + e.reviews.length, 0));
}

/** Apenas grupos com mais de uma loja (cross-store de verdade). */
export function crossStoreGroups(entries: DatasetEntry[], minConfidence = 0.4): LinkedGroup[] {
  return linkStoresAcrossStores(entries, minConfidence).filter((g) => g.stores.length > 1);
}
