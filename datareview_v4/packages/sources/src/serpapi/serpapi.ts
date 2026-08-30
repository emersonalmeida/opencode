import type {
  CollectOptions,
  CollectResponse,
  EngineFallback,

  RateLimit,
  SourceCapability,

  SourceId,
} from "@v4/contracts";
import type { SourcePort } from "@v4/domain";
import { SERPAPI_FALLBACKS } from "./fallbacks.js";
import { normalizeSerpApiResults } from "./normalize.js";
import type { SerpApiQuotaStore } from "./quota.js";

export interface SerpApiOptions {
  /** Chave API SerpAPI (backend-only, via env SERPAPI_KEY). */
  apiKey?: string;
  /** Engine padrao quando o chamado nao especifica (ex.: "google_search"). */
  engine?: string;
  /** Quota store opcional — sem ele o adaptador funciona (sem contabilizar. */
  quota?: SerpApiQuotaStore;
  /** true quando o ORQUESTRADOR do pipeline (ex.: `runSourceWithFallback`)
   *   ja consome a quota por esta fonte. Evita dupla contagem quando a MESMA
   *   store e injetada em `deps.quota` E aqui (o orquestrador e o dono). */
  quotaManagedExternally?: boolean;
}

const DEFAULT_RATE_LIMIT: RateLimit = { rps: 10, burst:  5 };

/**
 * Adaptador SourcePort para o SerpAPI (byok — SERPAPI_KEY so no backend..
 *
 * A chamada usa `options.engine` (produto SerpAPI); sem engine, usa o
 * mapeamento do fallback registrado no ADR-0002. O payload e normalizado
 * para NormalizedItem (Silver), preservando o bruto em `meta` (Bronze).
 * Erros de rede/HTTP sao devolvidos como `error` honesto na CollectResponse —
 * nunca derrubam o pipeline (mesma convencao do legado).
 */
export class SerpApiSource implements SourcePort {
  readonly id: SourceId = "serpapi";
  readonly kind: "fallback" = "fallback";
  readonly label: string;
  readonly description: string;
  readonly capabilities: SourceCapability[];
  readonly rateLimit: RateLimit;
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly engine: string;
  private readonly quota?: SerpApiQuotaStore;
  private readonly quotaManagedExternally: boolean;

  constructor(options: SerpApiOptions ={}) {
    this.label = options.engine ?? "SerpAPI";
    this.description = "Fallback multi-fonte via SerpAPI (ADR-0002, byok.";
    this.capabilities = ["search", "news", "trends", "social", "media"];
    this.rateLimit = DEFAULT_RATE_LIMIT;
    this.baseUrl = process.env.SERPAPI_BASE_URL ?? "https://serpapi.com/search.json";
    this.apiKey = options.apiKey ?? process.env.SERPAPI_KEY;
    this.engine = options.engine ?? "google_search";
    this.quota = options.quota;
    this.quotaManagedExternally = options.quotaManagedExternally ?? false;
  }

  async collect(options: CollectOptions): Promise<CollectResponse> {
    if (!this.apiKey) {
      return {
        source: "serpapi",
        query: options.query,
        items: [],
        error: "serpapi api key missing (set SERPAPI_KEY)",
      };
    }
    if (this.quota && !(await this.quota.remaining(1))) {
      return {
        source: "serpapi",
        query: options.query,
        items: [],
        error: "serpapi quota exhausted (" + this.engine + ")",
      };
    }

    const fallback = options.engine ?? this.engine;
    const url = this.buildUrl(options.query, fallback);


    try {
      const res = await fetch(url, {
        headers: { "Authorization": "Bearer " + this.apiKey },
        signal: options.signal,
      });
      if (res.status === 429 || res.status === 403) {
        return this.errorResponse(options, `serpapi http %d: collidido ao rate limit`, res.status);
      }
      if (!res.ok) {
        return this.errorResponse(options, "serpapi http " + res.status, res.status);
      }
      const payload: unknown = await res.json();
      const items = normalizeSerpApiResults(fallback, payload);
      if (this.quota && !this.quotaManagedExternally) {
        await this.quota.consume(1, fallback, "serpapi");
      }
      return { source: "serpapi", query: options.query, items, meta: { engine: fallback } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return this.errorResponse(options, "serpapi fetch failed: " + msg, undefined);
    }
  }

  private buildUrl(query: string, engine: string): string {
    const params = new URLSearchParams({
      engine,
      q: query,
      api_key: this.apiKey ?? "",
      hl: this.engine,
    });
    return this.baseUrl + "?" + params.toString();
  }

  private errorResponse(options: CollectOptions, message: string, status?: number): CollectResponse {
    return {
      source: "serpapi",
      query: options.query,
      items: [],
      error: message,
      meta: status != null ? { status } : undefined,
    };
  }
}

export function fallbackEngineFor(sourceId: SourceId): string | undefined {
  return SERPAPI_FALLBACKS[sourceId]?.engine;
}

export function fallbackCapabilities(sourceId: SourceId): SourceCapability[] {
  const f = SERPAPI_FALLBACKS[sourceId];
  return f?.capabilities ?? [];
}

export function fallbackMarker(sourceId: SourceId, engine: string): EngineFallback {
  return { engine, forSource: sourceId, quotaConsumed: false };
}