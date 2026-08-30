/**
 * Normalização — transforma RawConnectorItem (shape livre do mapItem) em
 * SourceItem (contrato compartilhado) com identidade estável para dedup.
 *
 * A identidade vem de (url | id da fonte em meta | hash do conteúdo) —
 * determinística, então o mesmo item coletado duas vezes gera a mesma chave.
 */
import { createHash } from "node:crypto";
import { mapConnectorItems, type RawConnectorItem, type SourceConnector } from "./sources/connectors.js";
import type { SourceItem } from "../../shared/contracts.js";

function stableId(source: string, raw: RawConnectorItem): string {
  const explicit = raw.url || raw.meta?.appId || raw.meta?.entityId || raw.meta?.hnId;
  if (explicit) return `${source}#${explicit.slice(0, 200)}`;
  const hash = createHash("sha1")
    .update(`${raw.title}|${raw.author ?? ""}|${raw.date ?? ""}|${(raw.text ?? "").slice(0, 80)}`)
    .digest("hex")
    .slice(0, 12);
  return `${source}#${hash}`;
}

export function normalizeItem(source: string, kind: string, raw: RawConnectorItem): SourceItem {
  return {
    id: stableId(source, raw),
    source,
    kind,
    title: raw.title,
    text: raw.text,
    url: raw.url,
    author: raw.author,
    date: raw.date,
    score: raw.score,
    meta: raw.meta,
  };
}

/* ------------------------------------------------------------------ cache --- */

/** Cache TTL simples com eviction ao atingir o teto (inspirado no routeCache
 *  do projeto original: só grava resultado útil, hit não abre run nova). */
interface CacheEntry {
  items: SourceItem[];
  expiresAt: number;
}
const cache = new Map<string, CacheEntry>();
const CACHE_MAX = 200;
const DEFAULT_TTL_MS = 10 * 60_000; // 10 min

export function cacheKey(source: string, query: string, limit: number): string {
  return `${source}|${query.toLowerCase()}|${limit}`;
}

export function cachedGet(key: string): SourceItem[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.items;
}

export function cachedSet(key: string, items: SourceItem[], ttlMs = DEFAULT_TTL_MS): void {
  if (items.length === 0) return; // nunca cacheia zero/erro
  if (cache.size >= CACHE_MAX) {
    // Evict expirados primeiro, depois o mais antigo.
    for (const [k, v] of cache) {
      if (v.expiresAt < Date.now()) cache.delete(k);
    }
    if (cache.size >= CACHE_MAX) {
      const oldest = [...cache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt)[0];
      if (oldest) cache.delete(oldest[0]);
    }
  }
  cache.set(key, { items, expiresAt: Date.now() + ttlMs });
}

/* ------------------------------------------------------------- assemble --- */

export const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export interface CollectOutcome {
  items: SourceItem[];
  cached: boolean;
  error?: string;
}

/** Executa a coleta de UM conector: fetch → parse JSON → normaliza → cache. */
export async function runConnector(
  connector: SourceConnector,
  query: string,
  limit: number,
  signal?: AbortSignal,
): Promise<CollectOutcome> {
  const key = cacheKey(connector.id, query, limit);
  const hit = cachedGet(key);
  if (hit) return { items: hit, cached: true };

  const url = connector.buildUrl(query, limit);
  const ac = AbortSignal.timeout(12_000);
  const composite = signal ? AbortSignal.any([signal, ac]) : ac;

  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json, text/plain, */*" },
      signal: composite,
    });
    if (!resp.ok) {
      return { items: [], cached: false, error: `HTTP ${resp.status}` };
    }
    const payload = await resp.json();
    const raw = mapConnectorItems(connector, payload, limit);
    const items = raw.map((r) => normalizeItem(connector.id, connector.kind, r));
    cachedSet(key, items);
    return { items, cached: false };
  } catch (e) {
    return { items: [], cached: false, error: e instanceof Error ? e.message : "falha de rede" };
  }
}
