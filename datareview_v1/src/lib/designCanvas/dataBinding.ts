/**
 * Data binding do page builder do Design Canvas.
 *
 * Um nó "organismo de dados" (gráfico, tabela, lista de reviews, KPI, …) pode
 * declarar um `dataSource` que resolve para um recorte do dataset coletado
 * REAL, então o preview renderizado é funcional e mostra reviews/notas reais —
 * não placeholders estáticos. É isso que faz do canvas um page builder
 * *funcional* em vez de uma ferramenta de mockup estático.
 *
 * Fontes de dados:
 *  - "selected"  → apps atualmente selecionados no SelectionContext global
 *  - "all"       → todos os apps coletados no dataset local
 *  - "app:<key>" → um único app pela sua key do dataset (`store:id`)
 *
 * O resolver é puro (dadas entries + keys selecionadas), então é testado em
 * unidade sem React.
 */
import type { DatasetEntry } from "@/lib/datasetStore";
import type { ReviewEntry } from "@/lib/appStoreApi";
import { entryKey } from "@/lib/dashboardAnalytics";

/** A source spec stored on a node's `props.dataSource` (or `dataSource` field). */
export type DataSourceSpec = "selected" | "all" | `app:${string}` | string;

export interface ResolvedData {
  entries: DatasetEntry[];
  reviews: ReviewEntry[];
  /** Human label for the source (shown in the inspector). */
  label: string;
  empty: boolean;
}

/** Build a dataset key the same way the rest of the app does. */
export function makeAppKey(store: string, id: string): string {
  return entryKey(store, id);
}

/**
 * Resolve uma spec de fonte de dados em entries + reviews concretos do dataset.
 *
 * @param spec     a string dataSource (ex.: "selected", "all", "app:google:com.foo")
 * @param entries  todas as entries do dataset (do useDataset)
 * @param selected keys de apps selecionados globalmente (do useSelection)
 */
export function resolveDataSource(
  spec: DataSourceSpec | undefined | null,
  entries: DatasetEntry[],
  selected: Set<string>,
): ResolvedData {
  const all: DatasetEntry[] = entries;
  const src = (spec ?? "selected").toString();

  let resolved: DatasetEntry[];
  let label: string;

  if (src === "all") {
    resolved = all;
    label = "Todo o dataset";
  } else if (src.startsWith("app:")) {
    const key = src.slice(4);
    resolved = all.filter((e) => makeAppKey(e.app.store, e.app.id) === key);
    label = resolved[0]?.app?.name ?? `App ${key}`;
  } else {
    // "selected" (default) — selection falls back to "all" when empty so the
    // preview always shows something functional.
    if (selected.size > 0) {
      resolved = all.filter((e) => selected.has(makeAppKey(e.app.store, e.app.id)));
      label = `${selected.size} app(s) selecionado(s)`;
    } else {
      resolved = all;
      label = "Todos (sem seleção)";
    }
  }

  const reviews: ReviewEntry[] = resolved.flatMap((e) => e.reviews);
  return { entries: resolved, reviews, label, empty: resolved.length === 0 };
}

/** List of data-source options for the inspector select. */
export const DATA_SOURCE_OPTIONS: { value: DataSourceSpec; label: string }[] = [
  { value: "selected", label: "Apps selecionados" },
  { value: "all", label: "Todo o dataset" },
];

/** Build a per-app option list for the inspector (app:<key>). */
export function appDataSourceOptions(entries: DatasetEntry[]): { value: string; label: string }[] {
  return entries.map((e) => ({
    value: `app:${makeAppKey(e.app.store, e.app.id)}`,
    label: `${e.app.name} (${e.app.store})`,
  }));
}

/** Layers that consume bound data (for palette grouping). */
export const DATA_ORGANISM_KINDS = new Set<string>([
  "kpi-card",
  "rating-chart",
  "sentiment-chart",
  "timeline-chart",
  "store-comparison",
  "word-cloud",
  "reviews-list",
  "app-card",
  "per-app-table",
  "markdown",
  "ai-analysis",
]);

export function isDataOrganism(kind: string): boolean {
  return DATA_ORGANISM_KINDS.has(kind);
}
