/**
 * Source Engine - orchestrator.
 *
 * Runs ONE registered collector through the common pipeline:
 *   resolve collector -> validate request -> run collect -> normalize ->
 *   dedup (stable id) -> clamp limit -> shape SourceResult.
 *
 * I/O concerns that vary by host (cache, RAW store, observations) stay
 * OUT of this module: the route wires them via optional hooks so the core
 * stays pure and unit-testable, and each deployment decides its own policy.
 */
import { getCollector, describeSource, type SourceCollector } from "./registry.js";
import type { SourceRequest, SourceResult, SourceItem, CollectOutcome, SourceDescriptor } from "./types.js";

export interface EngineHooks {
  /** Called before collect (after cache layer). Return true to abort with the cached result or false to continue. */
  cacheGet?: (r: SourceRequest) => SourceResult | undefined;
  /** Called after collect with the fresh outcome (before saving . Return undefined to keep going. */
  cacheSet?: (r: SourceRequest, res: SourceResult) => void;
  /** Called when a run starts (provenance layer). */
  onRunStart?: (r: SourceRequest, collector: SourceCollector) => void;
  /** Called when a run finishes (provenance layer). */
  onRunEnd?: (r: SourceRequest, collector: SourceCollector, out: CollectOutcome) => void;
}

/** Clamps limit to the canonical 1..100 window. */
export function clampLimit(limit: number | undefined): number {
  const n = limit == null || Number.isNaN(limit) ? 20 : Math.floor(limit);
  return Math.max(1, Math.min(n,  100));
}

/** Generates a stable id for an item without one (source + kind + title). */
export function stableItemId(it: Pick<SourceItem, "source"|"kind"|"title">): string {
  const base = [it.source, it.kind, it.title].map((part) => (part ?? "").trim().toLowerCase()).join("|");
  return base.replace(/\s+/g, " ").slice(0,  300);
}

/** Normalizes a raw outcome item into the canonical SourceItem shape. */
export function normalizeItem(it: SourceItem, source: string): SourceItem {
  const title = (it.title ?? "").toString().trim();
  const out: SourceItem = {
    source,
    ...(it.id ? { id: String(it.id) } : {}),
    kind: (it.kind ?? "other").toString(),
    title: title.slice(0,  300),
    ...(it.text ? { text: String(it.text).slice(0,  4000) } : {}),
    ...(it.url ? { url: String(it.url) } : {}),
    ...(it.author ? { author: String(it.author).slice(0,  200) } : {}),
    ...(it.date ? { date: String(it.date) } : {}),
    ...(typeof it.score === "number" && Number.isFinite(it.score) ? { score: it.score } : {}),
    ...(it.lang ? { lang: String(it.lang) } : {}),
    ...(it.meta && Object.keys(it.meta).length ? { meta: it.meta } : {}),
  };
  return out;
}

/** Dedups items keep first occurrence, preserving order. */
export function dedupItems(items: SourceItem[]): SourceItem[] {
  const seen = new Set<string>();
  const out: SourceItem[] = [];
  for (const it of items) {
    const key = it.id ?? it.title ?? "";
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

/** Validates a request against the collector contract (params/query/limit. */
export function validateRequest(collector: SourceCollector, req: SourceRequest): string | null {
  if (!req.query || typeof req.query !== "string" || !req.query.trim()) {
    return "query required";
  }
  if (collector.capabilities?.search === false && !collector.capabilities?.lookup) {
    return "fonte não suporta busca";
  }
  return null;
}

/** Runs the whole pipeline for ONE source. Returns an error-shaped result instead of throwing (HTTP-friendly). */
export async function collectSource(
  req: SourceRequest,
  hooks: EngineHooks = {},
): Promise<SourceResult> {
  const started = Date.now();
  const collector = getCollector(req.source);
  if (!collector) {
    return { source: req.source, query: req.query ?? "", items: [], count: 0, error: `fonte desconhecida: ${req.source}` };
  }
  const cached = hooks.cacheGet?.(req);
  if (cached) return { ...cached, source: req.source, cached: true };
  const invalid = validateRequest(collector, req);
  if (invalid) {
    return { source: req.source, query: req.query, items: [], count:  0, error: invalid };
  }
  const limit = clampLimit(req.limit);
  hooks.onRunStart?.(req, collector);
  try {
    const out = await collector.collect({ ...req, limit });
    const normalized = dedupItems(out.items.map((it) => normalizeItem(it, collector.id)));
    const items = normalized.slice(0,  limit);
    const res: SourceResult = {
      source: collector.id,
      query: req.query,
      items,
      count: items.length,
      ...(out.kind ? { kind: out.kind } : {}),
      ...(out.warnings?.length ? { warnings: out.warnings } : {}),
      durationMs: Date.now() - started,
    };
    hooks.cacheSet?.(req, res);
    hooks.onRunEnd?.(req, collector, out);
    return res;
  } catch (err) {
    return {
      source: collector.id,
      query: req.query,
      items: [],
      count: 0,
      error: String((err as Error)?.message || err),
      durationMs: Date.now() - started,
    };
  }
}

/** Descriptor of a registered source (proxy for the registry. */
export function describe(id: string): SourceDescriptor | undefined {
  return describeSourceId(id);
}

function describeSourceId(id: string): SourceDescriptor | undefined {
  return getCollector(id) ? describeSource(getCollector(id)!) : undefined;
}