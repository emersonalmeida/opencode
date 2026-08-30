/**
 * Source Engine - declarative adapter.
 *
 * Wraps the existing declarative JSON connector engine
 * (server/lib/uniConnectors: buildUrl + listPath + mapItem) as
 * SourceCollectors of the unified engine - WITHOUT rewriting any source
 * (adapter pattern). The catalog remains the source of truth; this module
 * only dresses it with the new contract.
 *
 * Reuses mapConnectorItems (the same already-tested normalization).
 */
import { UNI_CONNECTORS, getConnector, mapConnectorItems, type UniConnector } from "../../uniConnectors.js";
import type { SourceCollector, CollectOutcome, SourceRequest, SourceKind } from "../types.js";

/** Maps the open connector kind to the engine enum (fallback "other"). */
function normalizeKind(kind: string): SourceKind {
  const kw = kind.toLowerCase();
  const match = (words: string[], out: SourceKind): SourceKind | null => {
    for (const w of words) {
      if (kw.includes(w)) return out;
    }
    return null;
  };
  const st = match(["store", "game", "product", "book", "tool", "app"], "store");
  if (st) return st;
  const so = match(["social", "post", "comment", "community"], "social");
  if (so) return so;
  const ne = match(["news", "article", "paper", "document", "bookmark"], "news");
  if (ne) return ne;
  const se = match(["search", "suggestion", "entity", "query", "trend"], "search");
  if (se) return se;
  const ac = match(["academic", "preprint", "scholar", "citation"], "academic");
  if (ac) return ac;
  const de = match(["developer", "package", "repo", "api", "library", "code"], "developer");
  if (de) return de;
  const vi = match(["video", "show", "episode", "movie"], "video");
  if (vi) return vi;
  const au = match(["audio", "podcast", "music", "song"], "audio");
  if (au) return au;
  return "other";
}

/** Wraps ONE declarative connector into an engine collector. */
export function toCollector(c: UniConnector): SourceCollector {
  const kind = normalizeKind(c.kind);
  return {
    id: c.id,
    label: c.label,
    kind,
    description: c.description,
    auth: c.auth ? "byok" : "none",
    capabilities: c.lookup ? { search: false, lookup: true } : { search: true },
    method: "declarative JSON connector",
    collector: "uni-connectors",
    collectorVersion: "1",
    collect: async (req: SourceRequest): Promise<CollectOutcome> => {
      const max = Math.max(1, Math.min(req.limit ?? 20,  100));
      const url = c.buildUrl(req.query, max);
      const headers: Record<string, string> = {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        Accept: "application/json",
      };
      if (c.auth?.value) {
        if (c.auth.type === "bearer") headers["Authorization"] = `Bearer ${c.auth.value}`;
        else if (c.auth.type === "header" && c.auth.key) headers[c.auth.key] = c.auth.value;
        else if (c.auth.type === "query" && c.auth.key) {
          const sep = url.includes("?") ? "&" : "?";
          void sep; // query auth is applied on the URL (already reflected in cache/provenance key)
        }
      }
      const resp = await fetch(url, { headers, signal: req.signal, });
      if (!resp.ok) {
        if (resp.status === 401 || resp.status === 403) {
          throw new Error(
            c.auth
              ? `${c.label}: credential refused (${resp.status}) - check the key in the source panel.`
              : `${c.label} requires authentication (${resp.status}) - configure the API key in the source panel.`,
          );
        }
        if (resp.status === 404) throw new Error(`${c.label}: not found (404)`);
        if (resp.status === 429) throw new Error(`${c.label} returned 429 (rate-limit) - wait and try again.`);
        throw new Error(`${c.label} returned ${resp.status}`);
      }
      const payload: unknown = await resp.json();
      const items = mapConnectorItems(c, payload, max).map(function (it) {
        return { ...it, source: c.id, kind: c.kind, meta: { ...(it.meta ?? {}), rawKind: c.kind } };
      });
      return { items };
    },
  };
}

/** Batch: wraps ALL current declarative connectors into collectors. */
export function declarativeCollectors(): SourceCollector[] {
  return UNI_CONNECTORS.map(toCollector);
}

/** Wraps ONE connector by id (tests/point use). */
export function declarativeCollector(id: string): SourceCollector | undefined {
  const c = getConnector(id);
  return c ? toCollector(c) : undefined;
}