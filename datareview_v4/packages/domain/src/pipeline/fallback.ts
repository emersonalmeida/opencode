/**
* Fallback multi-fonte (ADR-0002) — quando a fonte primaria falha,
 * um adaptador reserva (ex.: serpapi) atende a chamada. O fallback e
 * recurso escasso (250 buscas por mes no Free): so acionado em falha real,
 * nunca como caminho padrao; contabilizado no SerpApiQuotaPort.
 *
 * DONO DA QUOTA: o orquestrador (esta funcao) e o unico que CONSOME quota.
 * Quando o adaptador fallback usado for o `SerpApiSource`, injete a MESMA
 * quota nele com `quotaManagedExternally: true` (ele so verifica `remaining`);
 * do contrario a mesma store seria consumida duas vezes (aqui + no adaptador).
 */
import type {
  CollectOptions, CollectResponse, EngineFallback, NormalizedItem,
} from "@v4/contracts";
import type { SerpApiQuotaPort, SourcePort } from "../ports/index.js";
import { stableId } from "./stableId.js";
import type { CollectRun, PipelineDeps } from "./index.js";

export interface FallbackDeps extends PipelineDeps {
  fallback: SourcePort;
  quota?: SerpApiQuotaPort;
}


function shouldFallback(response: CollectResponse): boolean {
  if (response.error) return true;
  if (response.items.length === 0) return true;
  return false;
}

function markFallback(
  items: NormalizedItem[],
  fallback: EngineFallback,
): NormalizedItem[] {
  return items.map((item) => ({ ...item, fallback }));
}

function toEntries(
  items: NormalizedItem[],
): Array<{ key: string; item: NormalizedItem; collectedAt: number }> {
  const now = Date.now();
  return items.map((item) => ({ key: stableId(item), item, collectedAt: now }));
}


export async function runSourceWithFallback(
  source: SourcePort,
  options: CollectOptions,
  deps: FallbackDeps,
  meta?: unknown,
): Promise<CollectRun> {
  const primary = await source.collect(options);
  if (!shouldFallback(primary)) {
    return {
      added: await deps.storage.upsertMany(toEntries(primary.items)),
      total: primary.items.length,
      response: primary,
      meta: meta as never,
    };
  }


  const engine = options.engine ?? "serpapi";
  const quota = deps.quota;
  if (quota && !(await quota.remaining(1))) {
    return {
      added: 0,
      total: 0,
      response: {
        source: source.id,
        query: options.query,
        items: [],
        error: "serpapi quota exhausted (" + engine + ")",
      },
      meta: meta as never,
    };
  }


  try {
    if (quota) await quota.consume(1, engine, source.id);
    const fallbackResponse = await deps.fallback.collect({ ...options, engine });
    if (fallbackResponse.error) {
      return {
        added: 0,
        total: 0,
        response: fallbackResponse,
        meta: meta as never,
      };
    }
    const fallbackInfo: EngineFallback = {
      engine,
      forSource: source.id,
      quotaConsumed: Boolean(quota),
    };
    const withFallback = markFallback(fallbackResponse.items, fallbackInfo);
    return {
      added: await deps.storage.upsertMany(toEntries(withFallback)),
      total: withFallback.length,
      response: { ...fallbackResponse, items: withFallback },
      meta: meta as never,
    };
  } catch (e) {
    return {
      added:  0,
      total:  0,
      response: {
        source: source.id,
        query: options.query,
        items: [],
        error: e instanceof Error ? e.message : String(e),
      },
      meta: meta as never,
    };
  }
}
