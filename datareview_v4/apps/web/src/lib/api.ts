/**
 * Cliente tipado da API do v4 — um helper fetch com checagem de status.
 * Base: VITE_API_BASE (ex.: "http://127.0.0.1:8787") ou mesma origem "/api".
 */
import type { DatasetEntry, NormalizedItem } from "@v4/contracts";

const BASE =
  typeof import.meta !== "undefined" && (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_API_BASE
    ? (import.meta as { env: Record<string, string> }).env.VITE_API_BASE
    : "";

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(`${BASE}/api${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  const body = (await resp.json().catch(() => null)) as T & { error?: string } | null;
  if (!resp.ok) {
    throw new ApiError(resp.status, (body as { error?: string } | null)?.error ?? `HTTP ${resp.status}`);
  }
  return body as T;
}

export interface Health {
  ok: boolean;
  name: string;
  api: string;
  version: string;
}

export interface CatalogSource extends NormalizedItem {
  id: string;
  label: string;
  status: string;
  group: string;
  method: string;
  resource: string;
  params: string[];
  data: string[];
  keys: string[];
  aliases: string[];
  tosNote?: string;
}

export interface CatalogResponse {
  total: number;
  byGroup: Record<string, number>;
  sources: CatalogSource[];
}

export interface RunRequest {
  source: string;
  query: string;
  limit?: number;
  engine?: string;
  country?: string;
}

export interface RunResponse {
  source: string;
  added: number;
  total: number;
  response: {
    source: string;
    query: string;
    items: NormalizedItem[];
    error?: string;
    cached?: boolean;
  };
}

export interface DatasetResponse {
  total: number;
  entries: DatasetEntry[];
}

export interface Stats {
  total: number;
  bySource: Record<string, number>;
  byKind: Record<string, number>;
  withScore: number;
  newest: string | null;
}

export interface AuditEntryShape {
  id: string;
  order: number;
  name: string;
  category: string;
  status: "audited" | "in-progress" | "pending";
  implemented: boolean;
  sourceId: string;
  summary: string;
  capabilities: string[];
}

export interface AuditResponse {
  entries: AuditEntryShape[];
  categories: Record<string, number>;
}

export interface DeriveResponse {
  stats: Stats;
  hint: string;
}

export function getHealth(): Promise<Health> {
  return request("/health");
}

export function getCatalog(): Promise<CatalogResponse> {
  return request("/catalog");
}

export function runSource(req: RunRequest): Promise<RunResponse> {
  return request("/run", { method: "POST", body: JSON.stringify(req) });
}

export function getDataset(): Promise<DatasetResponse> {
  return request("/dataset");
}

export function getStats(): Promise<Stats> {
  return request("/stats");
}

export function getAudit(): Promise<AuditResponse> {
  return request("/audit");
}

export function getDerive(): Promise<DeriveResponse> {
  return request("/derive");
}