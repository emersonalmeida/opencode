/**
 * auditSnapshots — datasets/snapshots versionados da auditoria (briefing §7).
 *
 * Cada snapshot congela o ESTADO da auditoria num ponto no tempo: fontes
 * observadas, confiabilidade por fonte, estado das sondas e estatísticas do
 * catálogo. NUNCA sobrescreve um snapshot anterior — cada criação gera uma
 * versão nova. O raw data fica no servidor (rawStore); o snapshot guarda a
 * referência temporal (createdAt) para rastrear "de quando" é a evidência.
 *
 * Padrão dos stores do app: pub/sub + localStorage, snapshot memoizado por
 * fingerprint (anti-loop do useSyncExternalStore).
 */
import { useSyncExternalStore } from "react";

export const AUDIT_SNAPSHOT_SCHEMA = "audit-snapshot/1";
const STORAGE_KEY = "aso:audit-snapshots:v1";
const MAX_SNAPSHOTS = 20;

export interface AuditSnapshot {
  schema: typeof AUDIT_SNAPSHOT_SCHEMA;
  id: string;
  /** Versão sequencial (1, 2, 3…) — nunca reutilizada. */
  version: number;
  label: string;
  createdAt: number;
  /** Estatísticas do catálogo no momento (documentado ≠ observado). */
  catalog: {
    sources: number;
    endpoints: number;
    parameters: number;
    capabilities: number;
    fields: number;
  };
  /** Confiabilidade observada por fonte (métricas objetivas do servidor). */
  reliability: unknown[];
  /** Estado das sondas (status por fonte + duração/erro). */
  runs: Record<string, unknown>;
  /** Resumo derivado para listagem (sem recalcular). */
  summary: {
    sourcesObserved: number;
    runsDone: number;
    runsError: number;
  };
}

let cache: AuditSnapshot[] | null = null;
// Sentinel null ≠ qualquer fingerprint real (lista vazia também gera "").
let fingerprint: string | null = null;
let memoSnapshot: AuditSnapshot[] = [];
const listeners = new Set<() => void>();

function load(): AuditSnapshot[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      cache = [];
      return cache;
    }
    const parsed = JSON.parse(raw) as unknown;
    cache = Array.isArray(parsed)
      ? (parsed.filter((s) => s && typeof s === "object" && "id" in s && "version" in s) as AuditSnapshot[])
      : [];
    return cache;
  } catch {
    cache = [];
    return cache;
  }
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(load()));
  } catch {
    // storage cheio/bloqueado — mantém em memória
  }
}

function notify(): void {
  fingerprint = null;
  for (const cb of listeners) cb();
}

function nextVersion(): number {
  return load().reduce((max, s) => Math.max(max, s.version), 0) + 1;
}

/** Cria um snapshot NOVO (nunca sobrescreve — §7). */
export function createAuditSnapshot(input: {
  label?: string;
  catalog: AuditSnapshot["catalog"];
  reliability: unknown[];
  runs: Record<string, unknown>;
}): AuditSnapshot {
  const version = nextVersion();
  const runsDone = Object.values(input.runs).filter(
    (r) => r && typeof r === "object" && (r as { status?: string }).status === "done",
  ).length;
  const runsError = Object.values(input.runs).filter(
    (r) => r && typeof r === "object" && (r as { status?: string }).status === "error",
  ).length;
  const snap: AuditSnapshot = {
    schema: AUDIT_SNAPSHOT_SCHEMA,
    id: `snap-${Date.now()}-v${version}`,
    version,
    label: input.label?.trim() || `Snapshot v${version}`,
    createdAt: Date.now(),
    catalog: input.catalog,
    reliability: input.reliability,
    runs: input.runs,
    summary: {
      sourcesObserved: input.reliability.length,
      runsDone,
      runsError,
    },
  };
  const list = [snap, ...load()].slice(0, MAX_SNAPSHOTS);
  cache = list;
  persist();
  notify();
  return snap;
}

export function deleteAuditSnapshot(id: string): boolean {
  const before = load().length;
  cache = load().filter((s) => s.id !== id);
  if (cache.length === before) return false;
  persist();
  notify();
  return true;
}

export function clearAuditSnapshots(): void {
  cache = [];
  persist();
  notify();
}

export function listAuditSnapshots(): AuditSnapshot[] {
  const fp = load()
    .map((s) => `${s.id}@${s.version}`)
    .join("|");
  if (fp !== fingerprint) {
    fingerprint = fp;
    memoSnapshot = [...load()];
  }
  return memoSnapshot;
}

export function subscribeAuditSnapshots(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useAuditSnapshots(): AuditSnapshot[] {
  return useSyncExternalStore(subscribeAuditSnapshots, listAuditSnapshots);
}

/** Serialização para download (JSON versionado com schema declarado). */
export function snapshotToJson(snap: AuditSnapshot): string {
  return JSON.stringify(snap, null, 2);
}
