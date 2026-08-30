/**
 * useFlowScope — escopo compartilhado das seções do `/fluxo`:
 * o dataset inteiro + o recorte da seleção global (vazia = todos os apps).
 */
import { useMemo } from "react";
import { useDataset } from "@/hooks/useDataset";
import { useSelection, entryKey } from "@/context/SelectionContext";
import type { DatasetEntry } from "@/lib/datasetStore";

export interface FlowScope {
  entries: DatasetEntry[];
  scoped: DatasetEntry[];
  selected: Set<string>;
  totalReviews: number;
}

export function useFlowScope(): FlowScope {
  const { entries } = useDataset();
  const { selected } = useSelection();

  return useMemo(() => {
    const scoped = selected.size > 0
      ? entries.filter((e) => selected.has(entryKey(e.app.store, e.app.id)))
      : entries;
    const totalReviews = scoped.reduce((acc, e) => acc + e.reviews.length, 0);
    return { entries, scoped, selected, totalReviews };
  }, [entries, selected]);
}
