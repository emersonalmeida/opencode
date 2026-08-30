/**
 * LabRepository — camada de persistência local-first do Lab.
 *
 * Reutiliza o padrão pub/sub do datasetStore/chatHistoryStore (localStorage +
 * Set<Listener>). Namespaces separados por entidade para evitar uma única
 * chave gigante e preparar migração futura para IndexedDB/SQLite.
 *
 * O repository NÃO duplica reviews — LabDataset referencia appKeys do dataset
 * principal. A única dependência externa é `genId` (nanoid-like).
 */

import type {
  LabDataset,
  LabExperiment,
  LabFinding,
  ProductCandidate,
} from "./types";

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l());
}

export function subscribeLab(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/* ----------------------------------------------------------------- utils --- */

export function genId(prefix = ""): string {
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return prefix ? `${prefix}_${rnd}` : rnd;
}

function read<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]") as T[];
  } catch {
    return [];
  }
}

function write<T>(key: string, list: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    /* quota — give up silently; data is best-effort local */
  }
  notify();
}

const nowISO = () => new Date().toISOString();

/* ------------------------------------------------------------- experiments */

const EXP_KEY = "aso:lab:experiments:v1";

export function listExperiments(): LabExperiment[] {
  return read<LabExperiment>(EXP_KEY).sort(
    (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  );
}

export function getExperiment(id: string): LabExperiment | undefined {
  return read<LabExperiment>(EXP_KEY).find((e) => e.id === id);
}

export function saveExperiment(exp: LabExperiment): LabExperiment {
  const list = read<LabExperiment>(EXP_KEY);
  const idx = list.findIndex((e) => e.id === exp.id);
  const next = { ...exp, updatedAt: nowISO() };
  if (idx >= 0) list[idx] = next;
  else list.unshift({ ...next, createdAt: next.createdAt || nowISO() });
  write(EXP_KEY, list);
  return next;
}

export function deleteExperiment(id: string): void {
  write(
    EXP_KEY,
    read<LabExperiment>(EXP_KEY).filter((e) => e.id !== id),
  );
  // cascade-delete findings
  write(
    "aso:lab:findings:v1",
    read<LabFinding>("aso:lab:findings:v1").filter((f) => f.experimentId !== id),
  );
}

/* ---------------------------------------------------------------- findings */

const FIND_KEY = "aso:lab:findings:v1";

export function listFindings(): LabFinding[] {
  return read<LabFinding>(FIND_KEY).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export function listFindingsByExperiment(experimentId: string): LabFinding[] {
  return listFindings().filter((f) => f.experimentId === experimentId);
}

export function getFinding(id: string): LabFinding | undefined {
  return read<LabFinding>(FIND_KEY).find((f) => f.id === id);
}

export function saveFinding(finding: LabFinding): LabFinding {
  const list = read<LabFinding>(FIND_KEY);
  const idx = list.findIndex((f) => f.id === finding.id);
  const next = { ...finding, createdAt: finding.createdAt || nowISO() };
  if (idx >= 0) list[idx] = next;
  else list.unshift(next);
  write(FIND_KEY, list);
  return next;
}

export function deleteFinding(id: string): void {
  write(
    FIND_KEY,
    read<LabFinding>(FIND_KEY).filter((f) => f.id !== id),
  );
}

/* ------------------------------------------------------- product candidates */

const PROD_KEY = "aso:lab:products:v1";

export function listProductCandidates(): ProductCandidate[] {
  return read<ProductCandidate>(PROD_KEY).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}

export function getProductCandidate(id: string): ProductCandidate | undefined {
  return read<ProductCandidate>(PROD_KEY).find((p) => p.id === id);
}

export function saveProductCandidate(p: ProductCandidate): ProductCandidate {
  const list = read<ProductCandidate>(PROD_KEY);
  const idx = list.findIndex((x) => x.id === p.id);
  const next = { ...p, updatedAt: nowISO() };
  if (idx >= 0) list[idx] = next;
  else list.unshift({ ...next, createdAt: next.createdAt || nowISO() });
  write(PROD_KEY, list);
  return next;
}

export function deleteProductCandidate(id: string): void {
  write(
    PROD_KEY,
    read<ProductCandidate>(PROD_KEY).filter((p) => p.id !== id),
  );
}

/* --------------------------------------------------------------- datasets */

const DS_KEY = "aso:lab:datasets:v1";

export function listLabDatasets(): LabDataset[] {
  return read<LabDataset>(DS_KEY).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}

export function getLabDataset(id: string): LabDataset | undefined {
  return read<LabDataset>(DS_KEY).find((d) => d.id === id);
}

export function saveLabDataset(d: LabDataset): LabDataset {
  const list = read<LabDataset>(DS_KEY);
  const idx = list.findIndex((x) => x.id === d.id);
  const next = { ...d, updatedAt: nowISO() };
  if (idx >= 0) list[idx] = next;
  else list.unshift({ ...next, createdAt: next.createdAt || nowISO() });
  write(DS_KEY, list);
  return next;
}

export function deleteLabDataset(id: string): void {
  write(
    DS_KEY,
    read<LabDataset>(DS_KEY).filter((d) => d.id !== id),
  );
}

/* ----------------------------------------------------------- factory fns --- */

export function newExperiment(partial: Partial<LabExperiment>): LabExperiment {
  const ts = nowISO();
  return {
    id: genId("exp"),
    name: partial.name || "Experimento sem nome",
    description: partial.description,
    type: partial.type || "intelligence",
    hypothesis: partial.hypothesis,
    question: partial.question,
    datasetIds: partial.datasetIds || [],
    pipeline: partial.pipeline,
    aiConfig: partial.aiConfig,
    status: partial.status || "draft",
    findings: [],
    metrics: partial.metrics,
    result: partial.result,
    structuredResult: partial.structuredResult,
    conclusion: partial.conclusion,
    provenance: partial.provenance,
    createdAt: ts,
    updatedAt: ts,
  };
}

export function newFinding(partial: Partial<LabFinding>): LabFinding {
  return {
    id: genId("find"),
    title: partial.title || "Nova descoberta",
    description: partial.description || "",
    experimentId: partial.experimentId || "",
    type: partial.type || "observation",
    confidence: partial.confidence,
    evidence: partial.evidence,
    status: partial.status || "new",
    createdAt: nowISO(),
  };
}

export function newProductCandidate(
  partial: Partial<ProductCandidate>,
): ProductCandidate {
  const ts = nowISO();
  return {
    id: genId("prod"),
    name: partial.name || "Novo produto candidato",
    vertical: partial.vertical,
    problem: partial.problem || "",
    targetUser: partial.targetUser,
    hypothesis: partial.hypothesis,
    evidence: partial.evidence || { experimentIds: [], findingIds: [], datasetIds: [] },
    validatedFeatures: partial.validatedFeatures,
    experimentalFeatures: partial.experimentalFeatures,
    opportunityScore: partial.opportunityScore,
    scores: partial.scores,
    status: partial.status || "idea",
    notes: partial.notes,
    createdAt: ts,
    updatedAt: ts,
  };
}
