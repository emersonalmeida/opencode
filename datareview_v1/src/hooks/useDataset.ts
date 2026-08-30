import { useEffect, useState, useCallback } from "react";
import {
  listDataset,
  subscribeDataset,
  upsertDataset,
  removeDataset,
  clearDataset,
  type DatasetEntry,
} from "@/lib/datasetStore";

export function useDataset() {
  const [entries, setEntries] = useState<DatasetEntry[]>(() => listDataset());

  useEffect(() => subscribeDataset(() => setEntries(listDataset())), []);

  const add = useCallback((entry: DatasetEntry) => upsertDataset(entry), []);
  const remove = useCallback(
    (store: string, id: string) => removeDataset(store, id),
    []
  );
  const clear = useCallback(() => clearDataset(), []);

  return { entries, add, remove, clear };
}
