/**
 * Hooks reativos do Lab — usam useSyncExternalStore com fingerprint memoization
 * (mesmo padrão do useChatHistory) para evitar loops infinitos, já que os
 * getters do repository retornam arrays novos (com .sort) a cada chamada.
 */

import { useSyncExternalStore, useRef } from "react";
import {
  subscribeLab,
  listExperiments,
  listFindings,
  listProductCandidates,
  listLabDatasets,
} from "./repository";
import type {
  LabExperiment,
  LabFinding,
  ProductCandidate,
  LabDataset,
} from "./types";

export function useLabExperiments(): LabExperiment[] {
  const lastRef = useRef<LabExperiment[]>([]);
  const fpRef = useRef<string>("");
  const getSnapshot = (): LabExperiment[] => {
    const fresh = listExperiments();
    const fp = fresh.map((e) => `${e.id}@${e.updatedAt}`).join("|");
    if (fp !== fpRef.current) {
      fpRef.current = fp;
      lastRef.current = fresh;
    }
    return lastRef.current;
  };
  return useSyncExternalStore(subscribeLab, getSnapshot, getSnapshot);
}

export function useLabFindings(): LabFinding[] {
  const lastRef = useRef<LabFinding[]>([]);
  const fpRef = useRef<string>("");
  const getSnapshot = (): LabFinding[] => {
    const fresh = listFindings();
    const fp = fresh.map((f) => `${f.id}@${f.status}`).join("|");
    if (fp !== fpRef.current) {
      fpRef.current = fp;
      lastRef.current = fresh;
    }
    return lastRef.current;
  };
  return useSyncExternalStore(subscribeLab, getSnapshot, getSnapshot);
}

export function useLabProductCandidates(): ProductCandidate[] {
  const lastRef = useRef<ProductCandidate[]>([]);
  const fpRef = useRef<string>("");
  const getSnapshot = (): ProductCandidate[] => {
    const fresh = listProductCandidates();
    const fp = fresh.map((p) => `${p.id}@${p.updatedAt}@${p.status}`).join("|");
    if (fp !== fpRef.current) {
      fpRef.current = fp;
      lastRef.current = fresh;
    }
    return lastRef.current;
  };
  return useSyncExternalStore(subscribeLab, getSnapshot, getSnapshot);
}

export function useLabDatasets(): LabDataset[] {
  const lastRef = useRef<LabDataset[]>([]);
  const fpRef = useRef<string>("");
  const getSnapshot = (): LabDataset[] => {
    const fresh = listLabDatasets();
    const fp = fresh.map((d) => `${d.id}@${d.updatedAt}`).join("|");
    if (fp !== fpRef.current) {
      fpRef.current = fp;
      lastRef.current = fresh;
    }
    return lastRef.current;
  };
  return useSyncExternalStore(subscribeLab, getSnapshot, getSnapshot);
}

