/**
 * Derivados determinísticos do dataset — cálculos que a IA e a UI usam
 * sem nunca precisar reinventar agregação por fonte.
 */
import type { DatasetEntry } from "./store.js";

export interface DatasetStats {
  total: number;
  bySource: Record<string, number>;
  byKind: Record<string, number>;
  withScore: number;
  newest: Date | null;
}

export function computeStats(list: DatasetEntry[]): DatasetStats {
  const bySource: Record<string, number> = {};
  const byKind: Record<string, number> = {};
  let withScore = 0;
  let newestTs = 0;

  for (const e of list) {
    bySource[e.item.source] = (bySource[e.item.source] ?? 0) + 1;
    byKind[e.item.kind] = (byKind[e.item.kind] ?? 0) + 1;
    if (typeof e.item.score === "number") withScore++;
    if (e.collectedAt > newestTs) newestTs = e.collectedAt;
  }

  return {
    total: list.length,
    bySource,
    byKind,
    withScore,
    newest: newestTs > 0 ? new Date(newestTs) : null,
  };
}

/** Texto de contexto determinístico a alimentar a IA (nunca recalculado no prompt). */
export function buildContextHint(list: DatasetEntry[], maxItems = 60): string {
  const stats = computeStats(list);
  const sources = Object.entries(stats.bySource)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([k, v]) => `${k} (${v})`)
    .join(", ");
  const items = list.slice(0, maxItems).map((e) => {
    const { item } = e;
    return `- [${item.source}] ${item.title}${item.author ? ` — ${item.author}` : ""}${item.score != null ? ` (score ${item.score})` : ""}${item.text ? `\n    ${item.text.slice(0, 200)}` : ""}`;
  });
  return [
    `DATASET: ${stats.total} itens coletados.`,
    `Fontes: ${sources || "nenhuma"}.`,
    "",
    "Itens (mais recentes primeiro):",
    ...items,
  ].join("\n");
}
