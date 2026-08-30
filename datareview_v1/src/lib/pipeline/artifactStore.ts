/**
 * Artifact store — vault de conhecimento do pipeline.
 *
 * Todo estágio (determinístico ou IA) grava um `PipelineArtifact` com seus
 * `inputIds`, formando um grafo de LINEAGE: de qualquer insight é possível
 * subir até os fatos e descer até os reviews originais que o sustentam.
 *
 * Persistido em localStorage (`aso:pipeline-artifacts:v1`), pub/sub como os
 * demais stores do app. Cap de 200 artefatos (drop mais antigos).
 */
import { useEffect, useState } from "react";
import type { PipelineArtifact } from "./types";

const KEY = "aso:pipeline-artifacts:v1";
const MAX_ARTIFACTS = 200;

type Listener = () => void;
const listeners = new Set<Listener>();

function read(): PipelineArtifact[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(list: PipelineArtifact[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_ARTIFACTS)));
  } catch {
    // Quota — remove os artefatos mais antigos e tenta de novo (uma vez).
    try {
      localStorage.setItem(KEY, JSON.stringify(list.slice(0, Math.floor(MAX_ARTIFACTS / 2))));
    } catch {
      /* give up */
    }
  }
  listeners.forEach((l) => l());
}

let idCounter = 0;

/** Lista artefatos, mais recentes primeiro. */
export function listArtifacts(): PipelineArtifact[] {
  return read().sort((a, b) => b.createdAt - a.createdAt);
}

export function getArtifact(id: string): PipelineArtifact | undefined {
  return read().find((a) => a.id === id);
}

export function saveArtifact(
  a: Omit<PipelineArtifact, "id" | "createdAt">,
): PipelineArtifact {
  // Timestamps estritamente crescentes para ordenação estável newest-first.
  const createdAt = Math.max(Date.now(), (read()[0]?.createdAt ?? 0) + 1, ++idCounter);
  const artifact: PipelineArtifact = {
    ...a,
    id: `art_${createdAt.toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt,
  };
  write([artifact, ...read()]);
  return artifact;
}

export function removeArtifact(id: string) {
  write(read().filter((a) => a.id !== id));
}

export function clearArtifacts() {
  write([]);
}

export function subscribeArtifacts(l: Listener): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/** Hook reativo — re-renderiza quando o vault muda. */
export function useArtifacts(): PipelineArtifact[] {
  const [snap, setSnap] = useState<PipelineArtifact[]>(() => listArtifacts());
  useEffect(() => subscribeArtifacts(() => setSnap(listArtifacts())), []);
  return snap;
}

/* --------------------------------------------------------- Data lineage --- */

export interface LineageNode {
  artifact: PipelineArtifact;
  /** Antecessores diretos (os inputs deste artefato), recursivo. */
  inputs: LineageNode[];
}

/**
 * Sobe a cadeia de um artefato até as raízes (artefatos sem inputs = ligados
 * diretamente ao dataset bruto). Guard contra ciclos via `visited`.
 */
export function buildLineage(id: string): LineageNode | null {
  const root = getArtifact(id);
  if (!root) return null;
  const visited = new Set<string>();
  const build = (a: PipelineArtifact): LineageNode => {
    if (visited.has(a.id)) return { artifact: a, inputs: [] };
    visited.add(a.id);
    const inputs = a.inputIds
      .map((iid) => getArtifact(iid))
      .filter((x): x is PipelineArtifact => !!x)
      .map(build);
    return { artifact: a, inputs };
  };
  return build(root);
}

/** Descendentes diretos: artefatos que consumiram `id` como input. */
export function getDescendants(id: string): PipelineArtifact[] {
  return read().filter((a) => a.inputIds.includes(id));
}

/** Todos os ids de antecessores (achatado, sem duplicatas). */
export function ancestorIds(id: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const walk = (aid: string) => {
    if (seen.has(aid)) return;
    seen.add(aid);
    const a = getArtifact(aid);
    if (!a) return;
    out.push(aid);
    a.inputIds.forEach(walk);
  };
  walk(id);
  return out;
}
