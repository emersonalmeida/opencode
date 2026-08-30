// Registry de fontes EM RUNTIME do nucleo v5; liga catalogo aos adaptadores de coleta real.
// V4 tinha keys na API; no v5 o nucleo expoe createSources para injecao testavel de keys, e sourcesFromEnv para ler do env.
// Ordem: SOURCES segue a prioridade sem-auth do catalogo.

import type { CollectOptions, CollectResponse } from '@v5/contracts';
import type { SourceDescriptor } from '@v5/contracts';
import type { SourcePort } from '@v5/domain';
import { SOURCE_CATALOG, computeEnabledSources, toSourceDescriptor, getSourceCatalogEntry } from './index.js';
import { keysFromEnv } from './keys.js';
import type { ApiKeys } from './keys.js';
import { SuggestSource } from './adapters/suggest.js';
import { trends } from './adapters/trends.js';
import { serpFactory } from './adapters/serp.js';
import { youtube } from './adapters/youtube.js';
import { reclameaqui } from './adapters/reclameaqui.js';
import { apple } from './adapters/apple.js';
import { googleplay } from './adapters/googleplay.js';
import { producthunt } from './adapters/producthunt.js';

export interface SourceRegistry {
  /** Mapa id → adaptador instanciado (gateway default por catálogo). */
  adapters: ReadonlyMap<string, SourcePort>;
  /** ids ativos (default + overrides). */
  enabled: string[];
  /** descritores completos dos ativos (para vistas/menus). */
  descriptors: SourceDescriptor[];
}

/** Adaptadores default(8 ativas)+ extras portados: todos os 59+ existem
 *  no catálogo, mas só estes tem coletor real no núcleo. Outros = opt-in
 *  via 'createSources' com 'extraAdapters' (futuro incremento..
 */
export function createSources(options: {
  keys?: ApiKeys;
  overrides?: Record<string, boolean>;
  extraAdapters?: Record<string, SourcePort>;
} = {}): SourceRegistry {
  const keys = options.keys ?? {};
  const extra = options.extraAdapters ?? {};
  const pool: Record<string, SourcePort> = {
    suggest: extra.suggest ?? new SuggestSource(),
    trends: extra.trends ?? trends,
    serp: extra.serp ?? serpFactory(keys),
    youtube: extra.youtube ?? youtube,
    reclameaqui: extra.reclameaqui ?? reclameaqui,
    apple: extra.apple ?? apple,
    googleplay: extra.googleplay ?? googleplay,
    producthunt: extra.producthunt ?? producthunt,
    ...extra,
  };
  const enabled = computeEnabledSources(SOURCE_CATALOG, options.overrides ?? {}).map((e) => e.id);
  const adapters = new Map<string, SourcePort>();
  for (const id of enabled) {
    const adapter = pool[id];
    if (adapter) adapters.set(id, adapter);
  }
  const descriptors = [...adapters.keys()].flatMap((id) => {
    const entry = getSourceCatalogEntry(id);
    return entry ? [toSourceDescriptor(entry)] : [];
  });
  return { adapters, enabled, descriptors };
}

export function sourcesFromEnv(): SourceRegistry {
  return createSources({ keys: keysFromEnv() });
}

export async function collectAll(registry: SourceRegistry, options: CollectOptions): Promise<CollectResponse[]> {
  const out: CollectResponse[] = [];
  for (const id of registry.enabled) {
    const adapter = registry.adapters.get(id);
    if (!adapter) continue;
    out.push(await adapter.collect({ ...options, query: options.query }));
  }
  return out;
}

export type { ApiKeys };
export { keysFromEnv };

