/**
 * Registry de adaptadores — mapa id-do-catálogo → construtor de SourcePort.
 *
 * Fonte de verdade dos ids: packages/sources/src/catalog/registry.ts. Fontes
 * ainda não portadas devolvem `{ manifest }` (a UI cataloga o status) e a rota
 * responde 501 informando o motivo — NUNCA aparece como fonte "morta".
 */
import type { SourcePort } from "@v4/domain";
import { getSourceCatalogEntry, toSourceDescriptor } from "@v4/sources";
import type { SourceCatalogEntry } from "@v4/sources";
import type { ApiKeys } from "../keys.js";
import {
  arxiv, gdelt, github, hackernews, reddit, semanticscholar, stackexchange, wikipedia,
} from "./jsonSources.js";
import {
  bluesky, crossref, deezer, devto, googlenews, mastodon, npm, openalex, openlibrary, steam, wikidata,
} from "./moreSources.js";
import { SuggestSource } from "./suggest.js";
import { INFRA_ADAPTERS } from "./infraSources.js";

export type AdapterFactory = (keys: ApiKeys) => SourcePort;

/** Adaptadores portados nesta entrega (v4). Cada linha = um coletor REAL;
 *  os demais do catálogo continuam PONTE(v1) até serem embrulhados por
 *  SourcePort (etapa incremental seguinte). */
export const ADAPTERS: Record<string, AdapterFactory> = {
  suggest: () => new SuggestSource(),
  hackernews: () => hackernews,
  gdelt: () => gdelt,
  github: () => github,
  arxiv: () => arxiv,
  stackexchange: () => stackexchange,
  semanticscholar: () => semanticscholar,
  wikipedia: () => wikipedia,
  reddit: () => reddit,
  bluesky: () => bluesky,
  deezer: () => deezer,
  steam: () => steam,
  googlenews: () => googlenews,
  wikidata: () => wikidata,
  openalex: () => openalex,
  mastodon: () => mastodon,
  npm: () => npm,
  crossref: () => crossref,
  openlibrary: () => openlibrary,
  devto: () => devto,
  ...INFRA_ADAPTERS,
};

export interface BuiltAdapter {
  source?: SourcePort;
  manifest?: { id: string; label: string; status: SourceCatalogEntry["status"]; resource: string; capabilities: string[] };
  reason?: string;
}

export function buildAdapter(id: string, keys: ApiKeys, registry: Record<string, AdapterFactory> = ADAPTERS): BuiltAdapter {
  const entry = getSourceCatalogEntry(id);
  if (!entry) return { reason: `fonte '${id}' não existe no catálogo` };

  const factory = registry[id];
  if (!factory) {
    return {
      manifest: {
        id: entry.id,
        label: entry.label,
        status: entry.status,
        resource: entry.resource,
        capabilities: entry.capabilities,
      },
      reason: `coletor '${id}' ainda não portado para SourcePort (status catalogado: ${entry.status})`,
    };
  }

  return { source: factory(keys) };
}

export { toSourceDescriptor };
export type { SourceCatalogEntry };