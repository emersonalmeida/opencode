/**
 * Derivacao deterministica do dataset — calculos que a IA e a UI usam sem
 * nunca reinventar agregacao por fonte
 */
import type { DatasetEntry } from "@v4/contracts";
import type { DatasetStats, DerivePort } from "../ports/index.js";

export function normalizeText(s: string): string {
  return s
    .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export const derive: DerivePort = {
  stats(list: DatasetEntry[]): DatasetStats {
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
  },

  contextHint(list: DatasetEntry[], maxItems: number = 60): string {
    const stats = this.stats(list);
    const order: Array<[string, number]> = [];
    for (const key of Object.keys(stats.bySource)) {
      order.push([key, (stats.bySource[key] ?? 0)]);
    }
    order.sort((a: [string, number], b: [string, number]) => b[1] - a[1]);


    const top: string[] = [];
    const k = Math.min(8, order.length);
    for (const e of order.slice(0, k)) {
      top.push(`${e[0]} (${e[1]})`);
    }
    const items: string[] = [];
    const n = Math.min(maxItems, list.length);
    for (const entry of list.slice(0, n)) {
      const item = entry.item;
      let linha = `- [${item.source}] ${item.title}`;
      if (item.author) linha += ` — ${item.author}`;
      if (item.score != null) linha += ` (score ${item.score})`;
      if (item.text) linha += `\n    ${item.text.slice(0, 200)}`;
      items.push(linha);
    }
    return [
      `DATASET: ${stats.total} itens coletados.`,
      `Fontes: ${top.join(", ") || "nenhuma"}.`,
      "",
      "Itens (mais recentes primeiro):",
      ...items,
    ].join("\n");
  },

  search(list: DatasetEntry[], term: string): DatasetEntry[] {
    const tokens = normalizeText(term).split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return list;
    const out: DatasetEntry[] = [];
    for (const entry of list) {
      const hay = `${entry.item.title} ${entry.item.text ?? ""} ${entry.item.author ?? ""}`;
      const norm = normalizeText(hay);
      let ok = true;
      for (const token of tokens) {
        if (norm.indexOf(normalizeText(token)) === -1) {
          ok = false;
          break;
        }
      }
      if (ok) out.push(entry);
    }
    return out;
  },
};