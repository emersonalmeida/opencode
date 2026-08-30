/**
 * Suggest — cliente da rota /functions/v1/uni-suggest (ação "gather").
 *
 * A página constrói sondas com buildSeeds (suggestCore) e orquestra a
 * matriz região × vertical aqui; o servidor executa os lotes e devolve os
 * itens com proveniência por sonda. Cada observação carrega grupo/sonda/
 * região/vertical — matéria-prima do merge determinístico.
 */
import { uniItemId, type UniItem } from "@/lib/uni/types";
import { fetchSuggestProvider, listSuggestProviders } from "./suggestProvidersApi";
import { apiUrl } from "@/lib/apiBase";
import {
  mergeObservations,
  type GatherObservation, type RawSuggestItem, type SuggestRow,
  type SuggestSeed, type SuggestVertical,
} from "./suggestCore";

const SUPA_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export type SuggestClient = "chrome" | "firefox";

export interface GatherCombo {
  region: string;
  vertical: SuggestVertical;
}

export interface GatherParams {
  lang?: string;
  client?: SuggestClient;
  /** sugestões por sonda (1–50). */
  limit?: number;
}

export interface GatherProgress {
  combo: GatherCombo;
  done: number;
  total: number;
  added: number;
}

async function postGather(
  query: string,
  seeds: string[],
  combo: GatherCombo,
  params: GatherParams,
  signal?: AbortSignal,
): Promise<{ ok: boolean; items?: RawSuggestItem[]; error?: string }> {
  const resp = await fetch(apiUrl("/functions/v1/uni-suggest"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({
      action: "gather",
      query,
      seeds,
      region: combo.region,
      lang: params.lang ?? "",
      vertical: combo.vertical,
      client: params.client ?? "chrome",
      limit: params.limit ?? 10,
    }),
    signal,
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) return { ok: false, error: (data.error as string) || `Erro ${resp.status}` };
  return { ok: true, items: (data as { items?: RawSuggestItem[] }).items ?? [] };
}

export interface GatherResult {
  ok: boolean;
  rows: SuggestRow[];
  observations: GatherObservation[];
  /** itens normalizados no formato Uni (reuso de charts/IA/coleções). */
  uniItems: UniItem[];
  error?: string;
}

/**
 * Executa a matriz de coleta: para cada combo região × vertical, envia
 * TODAS as sondas numa chamada e oberva o progresso por combo. Abort é
 * respeitado entre combos.
 */
export async function runGather(
  query: string,
  seeds: SuggestSeed[],
  combos: GatherCombo[],
  params: GatherParams,
  signal?: AbortSignal,
  onProgress?: (p: GatherProgress) => void,
): Promise<GatherResult> {
  // Índice sonda → grupo (proveniência) construído a partir do catálogo.
  const groupBySeed = new Map(seeds.map((s) => [s.seed, { group: s.group, groupLabel: s.groupLabel }]));
  const observations: GatherObservation[] = [];
  const total = combos.length;
  for (let i = 0; i < combos.length; i += 1) {
    const combo = combos[i];
    const res = await postGather(query, seeds.map((s) => s.seed), combo, params, signal);
    if (!res.ok) return { ok: false, rows: [], observations, uniItems: [], error: res.error ?? "Falha na coleta" };
    let added = 0;
    for (const item of res.items ?? []) {
      const meta = groupBySeed.get(item.seed ?? query);
      observations.push({
        item,
        seed: item.seed ?? query,
        group: meta?.group ?? "base",
        groupLabel: meta?.groupLabel ?? "Base",
        region: combo.region,
        vertical: combo.vertical,
      });
      added += 1;
    }
    onProgress?.({ combo, done: i + 1, total, added });
  }
  const rows = mergeObservations(observations);
  const uniItems: UniItem[] = rows.map((r) => ({
    id: uniItemId("suggest", r.text),
    source: "suggest",
    kind: "suggestion",
    title: r.text,
    score: r.relevance,
    meta: {
      occurrences: r.occurrences,
      groups: r.groups,
      seeds: r.seeds,
      verticals: r.verticals,
      regions: r.regions,
      query,
    },
  }));
  return { ok: true, rows, observations, uniItems };
}
export async function runAlternativeProvider(
  query: string,
  provider: string,
  params: GatherParams,
  signal?: AbortSignal
): Promise<GatherResult> {
  const res = await fetchSuggestProvider(provider, query, {
    limit: params.limit ?? 10,
    lang: params.lang,
    signal
  })

  if (!res.ok) return { ok: false, rows: [], observations: [], uniItems: [], error: res.error ?? "Falha na coleta" }

  const observations: GatherObservation[] = []
  const items: RawSuggestItem[] = []
  res.items.forEach((item) => {
    const raw: RawSuggestItem = { seed: query, text: item.text, relevance: item.relevance }
    items.push(raw)
    observations.push({ item: raw, seed: query, group: "provider", groupLabel: provLabel(provider), region: "", vertical: "web" })
  })

  const rows = mergeObservations(observations)
  const uniItems: UniItem[] = rows.map((r) => ({
    id: uniItemId("suggest", r.text),
    source: "suggest",
    kind: "suggestion",
    title: r.text,
    score: r.relevance,
    meta: {
      occurrences: r.occurrences,
      groups: r.groups,
      seeds: r.seeds,
      verticals: r.verticals,
      regions: r.regions,
      query,
      provider
    }
  }))

  return { ok: true, rows, observations, uniItems }
}

function provLabel(provider: string): string {
  const p = listSuggestProviders().find((x) => x.id === provider)
  return p ? p.label : provider
}

