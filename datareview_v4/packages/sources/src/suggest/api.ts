import type { NormalizedItem } from "@v4/contracts";
import { stableId } from "@v4/domain";
import { mergeObservations, type GatherObservation, type RawSuggestItem, type SuggestRow, type SuggestSeed, type SuggestVertical } from "./core.js";
import { fetchSuggestProvider, listSuggestProviders } from "./providersApi.js";
import { apiSuggestUrl } from "./url.js";

export type SuggestClient = "chrome" | "firefox";

export interface GatherCombo { region: string; vertical: SuggestVertical; }
export interface GatherParams { lang?: string; client?: SuggestClient; limit?: number; }
export interface GatherProgress { combo: GatherCombo; done: number; total: number; added: number; }

export interface GatherResult {
  ok: boolean; rows: SuggestRow[]; observations: GatherObservation[]; items: NormalizedItem[]; error?: string;
}

async function postGather(query: string, seeds: string[], combo: GatherCombo, params: GatherParams, signal?: AbortSignal): Promise<{ ok: boolean; items?: RawSuggestItem[]; error?: string }> {
  try {
    const resp = await fetch(apiSuggestUrl("/functions/v1/uni-suggest"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "gather", query, seeds, region: combo.region, lang: params.lang ?? "", vertical: combo.vertical, client: params.client ?? "chrome", limit: params.limit ?? 10 }),
      signal,
    });
    const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
    if (!resp.ok) return { ok: false, error: (data.error as string) || `Erro ${resp.status}` };
    return { ok: true, items: (data as { items?: RawSuggestItem[] }).items ?? [] };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return { ok: false, error: "cancelado" };
    return { ok: false, error: e instanceof Error ? e.message : "Falha de conexao" };
  }
}

export async function runGather(query: string, seeds: SuggestSeed[], combos: GatherCombo[], params: GatherParams, signal?: AbortSignal, onProgress?: (p: GatherProgress) => void): Promise<GatherResult> {
  const groupBySeed = new Map(seeds.map((s) => [s.seed, { group: s.group, groupLabel: s.groupLabel }]));
  const observations: GatherObservation[] = [];
  const total = combos.length;
  let done = 0;
  for (const combo of combos) {
    const res = await postGather(query, seeds.map((s) => s.seed), combo, params, signal);
    if (!res.ok) return { ok: false, rows: [], observations, items: [], error: res.error ?? "Falha na coleta" };
    let added =  0;
    for (const item of res.items ?? []) {
      const meta = groupBySeed.get(item.seed ?? query);
      observations.push({ item, seed: item.seed ?? query, group: meta?.group ?? "base", groupLabel: meta?.groupLabel ?? "Base", region: combo.region, vertical: combo.vertical });
      added +=  1;
    }
    done +=  1;
    onProgress?.({ combo, done, total, added });
  }
  const rows = mergeObservations(observations);
  const items: NormalizedItem[] = rows.map((r) => ({
    id: stableId({ id: r.text, source: "suggest", kind: "suggestion", title: r.text }),
    source: "suggest", kind: "suggestion", title: r.text, score: r.relevance,
    meta: { occurrences: r.occurrences, groups: r.groups, seeds: r.seeds, verticals: r.verticals, regions: r.regions, query },
  }));
  return { ok: true, rows, observations, items };
}

export async function runAlternativeProvider(query: string, provider: string, params: GatherParams, signal?: AbortSignal): Promise<GatherResult> {
  const observations: GatherObservation[] = [];
  const items: RawSuggestItem[] = [];
  const res = await fetchSuggestProvider(provider, query, { limit: params.limit ?? 10, lang: params.lang, signal });
  if (!res.ok) return { ok: false, rows: [], observations, items: [], error: res.error ?? "Falha na coleta" };
  res.items.forEach((item) => {
    const raw: RawSuggestItem = { seed: query, text: item.text, relevance: item.relevance };
    items.push(raw);
    observations.push({ item: raw, seed: query, group: "provider", groupLabel: provLabel(provider), region: "", vertical: "web" });
  });
  const rows = mergeObservations(observations);
  const normalized: NormalizedItem[] = rows.map((r) => ({
    id: stableId({ id: r.text, source: "suggest", kind: "suggestion", title: r.text }),
    source: "suggest", kind: "suggestion", title: r.text, score: r.relevance,
    meta: { occurrences: r.occurrences, groups: r.groups, seeds: r.seeds, verticals: r.verticals, regions: r.regions, query, provider },
  }));
  return { ok: true, rows, observations, items: normalized };
}

function provLabel(provider: string): string {
  const p = listSuggestProviders().find((x) => x.id === provider);
  return p ? p.label : provider;
}