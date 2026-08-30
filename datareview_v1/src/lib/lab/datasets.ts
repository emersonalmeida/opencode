/**
 * Helpers para construir LabDatasets a partir do dataset principal.
 * O Lab NÃO duplica reviews — LabDataset referencia apenas appKeys.
 */

import type { DatasetEntry } from "@/lib/datasetStore";
import { entryKey } from "@/context/SelectionContext";
import { saveLabDataset, genId } from "./repository";
import type { LabDataset } from "./types";

/**
 * Cria (ou reusa) um LabDataset a partir de um conjunto de apps do dataset
 * principal. Não copia reviews — apenas referencia appKeys + metadados.
 */
export function createLabDatasetFromEntries(
  entries: DatasetEntry[],
  name: string,
  description?: string,
): LabDataset {
  const appKeys = entries.map((e) => entryKey(e.app.store, e.app.id));
  const stores = [...new Set(entries.map((e) => e.app.store))];
  const countries = [
    ...new Set(
      entries.flatMap((e) => e.reviews.map((r) => r.country).filter(Boolean)),
    ),
  ];
  const dates = entries
    .flatMap((e) => e.reviews.map((r) => r.date).filter(Boolean))
    .sort();
  const reviewCount = entries.reduce((s, e) => s + e.reviews.length, 0);
  const ts = new Date().toISOString();
  const dataset: LabDataset = {
    id: genId("ds"),
    name,
    description,
    appKeys,
    reviewCount,
    source: "local-dataset",
    metadata: {
      stores,
      countries,
      dateRange:
        dates.length > 0 ? { from: dates[0], to: dates[dates.length - 1] } : undefined,
    },
    createdAt: ts,
    updatedAt: ts,
  };
  return saveLabDataset(dataset);
}

/** Cria um LabDataset "todo o dataset" referenciando todos os apps coletados. */
export function createFullLabDataset(entries: DatasetEntry[]): LabDataset {
  return createLabDatasetFromEntries(
    entries,
    `Dataset completo (${entries.length} apps)`,
    "Referência a todos os apps coletados no dataset principal.",
  );
}

/** Descrição resumida de um LabDataset para UI. */
export function describeDataset(ds: LabDataset): string {
  const parts: string[] = [];
  parts.push(`${ds.appKeys.length} app(s)`);
  parts.push(`${ds.reviewCount.toLocaleString("pt-BR")} reviews`);
  if (ds.metadata?.stores?.length) {
    parts.push(ds.metadata.stores.map((s) => (s === "apple" ? "Apple" : "Google")).join(" + "));
  }
  return parts.join(" · ");
}
