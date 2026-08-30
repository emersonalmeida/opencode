/**
 * Raw Store — camada RAW imutável de provenance (Phase 2 do target-state).
 *
 *   RAW DATA IS IMMUTABLE. DERIVED DATA IS RECOMPUTABLE.
 *
 * Cada coleta registra:
 *   - uma CollectionRun (params, status, yield, erros) em `runs.jsonl`;
 *   - um ou mais RawArtifacts (payload original + hash sha256 + endpoint +
 *     params + collector + versão) em `artifacts.jsonl`.
 *
 * Formato: JSONL append-only no filesystem (nunca sobrescreve, nunca apaga).
 * Diretório: `RAW_STORE_DIR` (default: `<cwd>/data/raw`). Testes usam tmpdir.
 *
 * TODAS as funções são failure-safe: falha de I/O vira console.warn e retorno
 * best-effort — a coleta (V0) NUNCA quebra por causa da camada RAW.
 *
 * Sem dependências externas (node:crypto/fs apenas).
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type RunStatus = "running" | "completed" | "failed" | "partial";

export interface CollectionRun {
  id: string;
  sourceId: string;
  subjectKey?: string;
  collector: string;
  collectorVersion: string;
  params: Record<string, unknown>;
  startedAt: number;
  finishedAt?: number;
  status: RunStatus;
  requested?: number;
  yielded?: number;
  errors: { endpoint: string; message: string; at: number }[];
}

export interface RawArtifact {
  id: string;
  runId: string;
  sourceId: string;
  subjectKey?: string;
  endpoint: string;
  url?: string;
  params: Record<string, unknown>;
  payload: unknown;
  hash: string;
  bytes: number;
  collectedAt: number;
  collector: string;
  collectorVersion: string;
}

interface StartRunInput {
  sourceId: string;
  subjectKey?: string;
  collector: string;
  collectorVersion: string;
  params: Record<string, unknown>;
  requested?: number;
}

interface ArtifactInput {
  runId: string;
  sourceId: string;
  subjectKey?: string;
  endpoint: string;
  url?: string;
  params: Record<string, unknown>;
  payload: unknown;
  collector: string;
  collectorVersion: string;
}

let seq = 0;
function nextId(prefix: string): string {
  seq = (seq + 1) % 10000;
  return `${prefix}_${Date.now().toString(36)}_${seq.toString(36)}`;
}

// ---------------------------------------------------------------------------
// Pub/sub em memória (failure-safe): alimenta o stream SSE de eventos de run
// para a aba "Output" da página Uni — terminal de coleta em tempo real.
// ---------------------------------------------------------------------------

export interface RunProgress {
  runId: string;
  sourceId: string;
  message: string;
  at: number;
}

export type RunEvent =
  | { event: "start" | "finish"; run: CollectionRun }
  | { event: "progress"; progress: RunProgress };

type RunListener = (e: RunEvent) => void;
const listeners = new Set<RunListener>();

/** Inscreve um listener de eventos de run; retorna função de unsubscribe. */
export function subscribeRunEvents(listener: RunListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(e: RunEvent): void {
  for (const l of listeners) {
    try {
      l(e);
    } catch {
      // Listener quebrado nunca derruba a coleta.
    }
  }
}

/** Emite progresso intermediário de uma run (ex.: expansão a-z do suggest). */
export function progressRun(run: CollectionRun, message: string): void {
  emit({
    event: "progress",
    progress: { runId: run.id, sourceId: run.sourceId, message, at: Date.now() },
  });
}

function rawDir(): string {
  return process.env.RAW_STORE_DIR || path.join(process.cwd(), "data", "raw");
}
function artifactsFile(): string {
  return path.join(rawDir(), "artifacts.jsonl");
}
function runsFile(): string {
  return path.join(rawDir(), "runs.jsonl");
}

function warn(op: string, err: unknown): void {
  console.warn(`[rawStore] ${op} falhou (best-effort, coleta continua):`, (err as Error)?.message ?? err);
}

/** sha256 hex do payload (JSON.stringify determinístico para a mesma entrada). */
export function hashPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload ?? null)).digest("hex");
}

/**
 * Inicia uma CollectionRun e a registra (append "start"). Retorna o objeto
 * vivo para `finishRun(run, …)` e para o runId dos artifacts.
 */
export function startRun(input: StartRunInput): CollectionRun {
  const run: CollectionRun = {
    id: nextId("run"),
    sourceId: input.sourceId,
    subjectKey: input.subjectKey,
    collector: input.collector,
    collectorVersion: input.collectorVersion,
    params: input.params,
    startedAt: Date.now(),
    status: "running",
    requested: input.requested,
    errors: [],
  };
  try {
    fs.mkdirSync(rawDir(), { recursive: true });
    fs.appendFileSync(runsFile(), JSON.stringify({ event: "start", run }) + "\n");
  } catch (err) {
    warn("startRun", err);
  }
  emit({ event: "start", run });
  return run;
}

/** Finaliza a run (append "finish" com status final). */
export function finishRun(
  run: CollectionRun,
  outcome: { status: RunStatus; yielded?: number; errors?: { endpoint: string; message: string }[] },
): void {
  run.finishedAt = Date.now();
  run.status = outcome.status;
  run.yielded = outcome.yielded;
  if (outcome.errors?.length) {
    run.errors = outcome.errors.map((e) => ({ endpoint: e.endpoint, message: e.message, at: Date.now() }));
  }
  try {
    fs.mkdirSync(rawDir(), { recursive: true });
    fs.appendFileSync(runsFile(), JSON.stringify({ event: "finish", run }) + "\n");
  } catch (err) {
    warn("finishRun", err);
  }
  emit({ event: "finish", run });
}

/** Registra um artefato RAW imutável (append-only) com hash e provenance. */
export function saveRawArtifact(input: ArtifactInput): RawArtifact | null {
  const bytes = Buffer.byteLength(JSON.stringify(input.payload ?? null), "utf8");
  const artifact: RawArtifact = {
    id: nextId("raw"),
    runId: input.runId,
    sourceId: input.sourceId,
    subjectKey: input.subjectKey,
    endpoint: input.endpoint,
    url: input.url,
    params: input.params,
    payload: input.payload,
    hash: hashPayload(input.payload),
    bytes,
    collectedAt: Date.now(),
    collector: input.collector,
    collectorVersion: input.collectorVersion,
  };
  try {
    fs.mkdirSync(rawDir(), { recursive: true });
    fs.appendFileSync(artifactsFile(), JSON.stringify(artifact) + "\n");
    return artifact;
  } catch (err) {
    warn("saveRawArtifact", err);
    return null;
  }
}


// ---------------------------------------------------------------------------
// OBSERVAÇÕES AUDITÁVEIS (briefing §2) — camada deduzida do Engine sobre os
// artifacts imutáveis. NÃO sobrescreve raw: deriva duration/http/schema/
// confidence e permanece best-effort (falha nunca quebra a coleta).
// ---------------------------------------------------------------------------

export interface Observation {
  runId: string;
  sourceId: string;
  endpoint: string;
  url?: string;
  params: Record<string, unknown>;
  /** Duração da chamada em ms (capturada pelo wrapper). */
  durationMs?: number;
  /** Schema observado (chaves do payload, até 32). */
  schema?: string[];
  /** 0–1: 1 = resposta parseável com conteúdo útil. */
  confidence?: number;
  at: number;
}

function observationsFile(): string {
  return path.join(rawDir(), "observations.jsonl");
}

/** Extrai schema do payload (objeto → chaves; array → chaves do 1º item). */
export function extractSchema(payload: unknown): string[] {
  const target = Array.isArray(payload) ? payload[0] : payload;
  if (target && typeof target === "object" && !Array.isArray(target)) {
    return Object.keys(target as Record<string, unknown>).slice(0, 32);
  }
  return [];
}

/**
 * Registra uma observação auditável (append-only). Best-effort: se falhar,
 * retorna null e a coleta segue (padrão failure-safe do rawStore).
 */
export function captureObservation(input: {
  runId: string;
  sourceId: string;
  endpoint: string;
  url?: string;
  params: Record<string, unknown>;
  payload: unknown;
  durationMs?: number;
}): Observation | null {
  const schema = extractSchema(input.payload);
  const confidence =
    input.payload == null ? 0 :
    Array.isArray(input.payload) ? (input.payload.length > 0 ? 1 : 0.2) :
    typeof input.payload === "object" ? 1 : 0.4;
  const observation: Observation = {
    runId: input.runId,
    sourceId: input.sourceId,
    endpoint: input.endpoint,
    url: input.url,
    params: input.params,
    durationMs: input.durationMs,
    schema,
    confidence,
    at: Date.now(),
  };
  try {
    fs.mkdirSync(rawDir(), { recursive: true });
    fs.appendFileSync(observationsFile(), JSON.stringify(observation) + "\n");
    return observation;
  } catch (err) {
    warn("captureObservation", err);
    return null;
  }
}

/** Lê observações (best-effort) para métricas. Sem índice (arquivo pequeno). */
export function listObservations(sourceId?: string): Observation[] {
  try {
    const lines = fs.readFileSync(observationsFile(), "utf8").split("\n").filter(Boolean);
    const all = lines.map((l) => JSON.parse(l) as Observation);
    return sourceId ? all.filter((o) => o.sourceId === sourceId) : all;
  } catch (err) {
    warn("listObservations", err);
    return [];
  }
}

function readJsonl(file: string, limit: number): unknown[] {
  try {
    const raw = fs.readFileSync(file, "utf8");
    const lines = raw.split("\n").filter((l) => l.trim().length > 0);
    const slice = limit > 0 ? lines.slice(-limit) : lines;
    return slice.map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

/** Lê artifacts mais recentes primeiro (debug/provenance). */
export function listArtifacts(limit = 100): RawArtifact[] {
  return readJsonl(artifactsFile(), limit).reverse() as RawArtifact[];
}

/** Lê eventos de run mais recentes primeiro (debug/provenance). */
export function listRunEvents(limit = 100): { event: string; run: CollectionRun }[] {
  return readJsonl(runsFile(), limit).reverse() as { event: string; run: CollectionRun }[];
}
