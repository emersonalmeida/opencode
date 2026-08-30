/**
 * Hook reativo para o session store. Usa useState + subscribe (como useDataset)
 * para evitar o "Maximum update depth" do useSyncExternalStore com listagens
 * que criam array novo a cada chamada.
 */
import { useEffect, useState } from "react";
import { listGenerations, listSnapshots, subscribeSessions, type GenerationType, type GenerationRecord, type CanvasSnapshot } from "@/lib/sessionStore";

export function useGenerations(type?: GenerationType) {
  const [items, setItems] = useState<GenerationRecord[]>(() => listGenerations(type));
  useEffect(() => {
    const update = () => setItems(listGenerations(type));
    update();
    return subscribeSessions(update);
  }, [type]);
  return items;
}

export function useSnapshots() {
  const [items, setItems] = useState<CanvasSnapshot[]>(() => listSnapshots());
  useEffect(() => {
    const update = () => setItems(listSnapshots());
    update();
    return subscribeSessions(update);
  }, []);
  return items;
}
