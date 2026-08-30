/**
 * Trending — cliente da rota /functions/v1/uni-trending (extrator da página
 * Google Trends "Em alta": https://trends.google.com/trending?geo=BR).
 *
 * O servidor fala com as mesmas fontes da página oficial (RPC batchexecute
 * + RSS de notícias) e devolve itens normalizados com volume, crescimento,
 * janela de atividade, consultas relacionadas, tópicos e notícias.
 */
import { uniItemId, type UniItem } from "@/lib/uni/types";
import { apiUrl } from "@/lib/apiBase";
import type {
  TrendingItem,
  TrendingObservation,
} from "../../../server/lib/trendingCore";

const SUPA_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export interface TrendingFetchResult {
  ok: boolean;
  items: TrendingItem[];
  observations: TrendingObservation[];
  /** quantos itens receberam notícias do RSS top-10. */
  newsEnriched: number;
  cached: boolean;
  error?: string;
  /** erros parciais por janela (gather). */
  errors?: string[];
}

async function post(
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<TrendingFetchResult> {
  const resp = await fetch(apiUrl("/functions/v1/uni-trending"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify(body),
    signal,
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    return {
      ok: false,
      items: [],
      observations: [],
      newsEnriched: 0,
      cached: false,
      error: (data.error as string) || `Erro ${resp.status}`,
    };
  }
  return {
    ok: true,
    items: (data.items as TrendingItem[]) ?? [],
    observations: (data.observations as TrendingObservation[]) ?? [],
    newsEnriched: Number(data.newsEnriched) || 0,
    cached: Boolean(data.cached),
    errors: data.errors as string[] | undefined,
  };
}

/** Coleta rápida: 1 janela de tempo. */
export function fetchTrending(
  geo: string,
  hours: number,
  signal?: AbortSignal,
): Promise<TrendingFetchResult> {
  return post({ action: "trending", geo, hours }, signal);
}

/** Coleta completa: união das janelas com dedup e proveniência. */
export function gatherTrending(
  geo: string,
  hoursList: number[],
  signal?: AbortSignal,
): Promise<TrendingFetchResult> {
  return post({ action: "gather", geo, hoursList }, signal);
}

/**
 * Converte trends para o formato Uni (reuso de charts, IA embutida e
 * coleções da /00): cada trend vira um "news" com score = volume.
 */
export function toUniItems(items: TrendingItem[]): UniItem[] {
  return items.map((t) => ({
    id: uniItemId("trends", t.title),
    source: "trends",
    kind: "news",
    title: t.title,
    text: [
      `${t.traffic.toLocaleString("pt-BR")} buscas · +${t.growthPct}% no período`,
      t.active ? "Em alta agora" : "Encerrado",
      t.relatedQueries.length ? `Consultas: ${t.relatedQueries.slice(0, 5).join(", ")}` : "",
      t.news.length ? `Notícias: ${t.news.map((n) => `${n.title} (${n.source})`).join(" · ")}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    url: t.news[0]?.url,
    score: t.traffic,
    date: t.startedAt || undefined,
    meta: {
      growthPct: t.growthPct,
      active: t.active,
      endedAt: t.endedAt,
      relatedQueries: t.relatedQueries,
      topicIds: t.topicIds,
      hours: t.provenance.hours,
      news: t.news,
      picture: t.picture,
      pictureSource: t.pictureSource,
    },
  }));
}
