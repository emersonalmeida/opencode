/**
 * Infraestrutura dos adaptadores — um único formato de fonte (SourcePort).
 * `defineAdapter` reduz o boilerplate: cuida de try/catch (parcial-OK) e do
 * shape de resposta; cada fonte só informa como BUSCAR e como NORMALIZAR.
 */
import type { CollectOptions, CollectResponse, NormalizedItem, RateLimit, SourceDescriptor } from "@v4/contracts";
import type { SourcePort } from "@v4/domain";

export interface AdapterMeta {
  id: string;
  label: string;
  kind: string;
  description: string;
  capabilities: SourceDescriptor["capabilities"];
  rateLimit: RateLimit;
}

export type FetchStep = (options: CollectOptions) => Promise<unknown>;

export type MapStep = (data: unknown, options: CollectOptions) => NormalizedItem[];

export interface DefineOptions {
  fetch: FetchStep;
  map: MapStep;
}

/**
 * Adaptador genérico: fetch + map + try/catch. A fonte NUNCA lança — falhas
 * viram `response.error` (parcial-OK), a mesma convenção do v1 e do núcleo.
 */
export function defineAdapter(meta: AdapterMeta, impl: DefineOptions): SourcePort {
  return {
    ...meta,
    async collect(options: CollectOptions): Promise<CollectResponse> {
      const response: CollectResponse = { source: meta.id, query: options.query, items: [] };
      try {
        const data = await impl.fetch(options);
        response.items = impl.map(data, options);
        response.meta = { count: response.items.length };
      } catch (error) {
        response.error = error instanceof Error ? error.message : String(error);
        response.meta = { error: response.error };
      }
      return response;
    },
  };
}

/** Converte entrada num item com os campos Silver mínimos. */
export interface ItemSeed {
  id: string;
  title: string;
  url?: string;
  text?: string;
  author?: string;
  date?: string;
  score?: number;
  kind?: NormalizedItem["kind"];
  meta?: Record<string, unknown>;
}

export function item(seed: ItemSeed, source: string, kind: NormalizedItem["kind"]): NormalizedItem {
  return {
    id: seed.id,
    source,
    kind: seed.kind ?? kind,
    title: seed.title,
    url: seed.url,
    text: seed.text,
    author: seed.author,
    date: seed.date,
    score: seed.score,
    meta: seed.meta,
  };
}

export function cap(n: number, max = 50): number {
  if (!Number.isFinite(n)) return max;
  return Math.max(1, Math.min(Math.floor(n), max));
}

export function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function num(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}