/**
 * Descoberta — cliente da rota /functions/v1/uni-discover.
 *
 * Duas famílias de chamadas:
 *  - fetchDiscover(source, params): coleta de uma fonte (wikitop, crypto…)
 *    devolvendo DiscoverItem[] normalizados.
 *  - resolveInput(url): detecta o tipo de entidade de uma URL/identificador
 *    e traz os detalhes da API pública correspondente (quando há).
 *
 * Tipos compartilhados com o servidor via caminho relativo (mesmo padrão do
 * trendingApi) — o núcleo puro NÃO pode importar de src (rootDir do server).
 */
import type {
  DiscoverItem,
  DiscoverResult,
} from "../../../server/lib/discoverCore";
import { apiUrl } from "@/lib/apiBase";
import type { ResolvedTarget } from "../../../server/lib/urlResolver";
import { uniItemId, type UniItem } from "@/lib/uni/types";

const SUPA_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export type { DiscoverItem, DiscoverResult, ResolvedTarget };

export interface DiscoverFetchResult {
  ok: boolean;
  items: DiscoverItem[];
  note?: string;
  cached: boolean;
  error?: string;
}

export interface ResolveResult {
  ok: boolean;
  target?: ResolvedTarget & { fanout?: string; detail?: Record<string, unknown> };
  error?: string;
}

async function post<T>(
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<{ ok: boolean; data: T; error?: string }> {
  try {
    const resp = await fetch(apiUrl("/functions/v1/uni-discover"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPA_KEY}` },
      body: JSON.stringify(body),
      signal,
    });
    const data = (await resp.json().catch(() => ({}))) as T & { error?: string };
    if (!resp.ok) return { ok: false, data: {} as T, error: data.error || `Erro ${resp.status}` };
    return { ok: true, data };
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    return { ok: false, data: {} as T, error: String((err as Error)?.message || err) };
  }
}

export async function fetchDiscover(
  source: string,
  params: Record<string, unknown> = {},
  signal?: AbortSignal,
): Promise<DiscoverFetchResult> {
  const { ok, data, error } = await post<DiscoverResult>({ source, ...params }, signal);
  if (!ok) return { ok: false, items: [], cached: false, error };
  return {
    ok: true,
    items: data.items ?? [],
    note: data.note,
    cached: Boolean(data.cached),
  };
}

export async function resolveInput(url: string, signal?: AbortSignal): Promise<ResolveResult> {
  const { ok, data, error } = await post<ResolvedTarget & { fanout?: string; detail?: Record<string, unknown> }>(
    { action: "resolve", url },
    signal,
  );
  if (!ok) return { ok: false, error };
  return { ok: true, target: data };
}

/** Formata a métrica principal do item ("1,2 mi visualizações"). */
export function formatScore(item: DiscoverItem): string {
  if (item.score == null) return "";
  const n = item.score;
  const label = item.scoreLabel ? ` ${item.scoreLabel}` : "";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")} mi${label}`;
  if (Math.abs(n) >= 10_000) return `${Math.round(n / 1000)} mil${label}`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1).replace(".", ",")} mil${label}`;
  return `${Number.isInteger(n) ? n : n.toFixed(2).replace(".", ",")}${label}`;
}

/** Converte itens da Descoberta para o formato Uni (source "custom") —
 * habilita salvar como coleção da /00 e analisar com o UniAI embutido. */
export function toUniItems(source: string, items: DiscoverItem[]): UniItem[] {
  return items.map((it) => ({
    id: uniItemId(`discover-${source}`, it.id),
    source: "custom",
    kind: "web-result",
    title: it.title,
    text: [it.subtitle, it.score != null ? formatScore(it) : ""].filter(Boolean).join(" · ") || undefined,
    url: it.url,
    score: it.score,
    date: it.publishedAt,
    meta: { discoverSource: source, image: it.image, ...it.meta },
  }));
}
