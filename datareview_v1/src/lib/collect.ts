/**
 * Unified app-collection helper — the single entry point every surface (home,
 * header search, chat, experiments, compare tray, app detail) uses to "collect"
 * an app. It guarantees:
 *
 *   1. DEDUP — if the app is already in the local dataset (`aso:dataset:v1`)
 *      AND already has at least `reviewLimit` reviews stored, those reviews are
 *      reused and NOTHING is refetched. This is what makes the search bars
 *      "talk to each other": an app collected on the Chat page is instantly
 *      recognised as collected on Experiments / Search / Detail, and vice-versa.
 *      Quando o usuário aumenta o limite acima do já armazenado, o helper
 *      refaz o fetch (até o novo limite) e mescla as reviews novas com as do
 *      cache (dedup por id de review) — assim aumentar o limite realmente
 *      rende mais reviews, em vez de ficar preso na contagem antiga e menor.
 *   2. PERSISTÊNCIA — apps coletados são upsertados no dataset store
 *      (localStorage, pub/sub) para todas as páginas ficarem em sincronia.
 *   3. HISTÓRICO — cada app coletado vai para a sidebar de histórico à esquerda
 *      (`aso:history`), e grupos de comparação multi-app entram como uma única
 *      entrada agrupada `compare`.
 */
import type { AppInfo, ReviewEntry } from "@/lib/appStoreApi";
import { fetchReviews, lookupApp } from "@/lib/appStoreApi";
import { fetchGooglePlayAppDetails, fetchGooglePlayReviews } from "@/lib/googlePlayApi";
import {
  getDatasetEntry,
  upsertDataset,
  type DatasetEntry,
} from "@/lib/datasetStore";
import { pushHistory } from "@/lib/history";
import { recordGeneration } from "@/lib/sessionStore";
import { taskStart, taskEnd } from "@/lib/activityStore";
import { enrichReviews } from "@/lib/enrichment";
import { DEFAULT_TTL_DAYS } from "@/lib/datasetFreshness";

export interface CollectResult {
  entry: DatasetEntry;
  /** true when the reviews came from the local cache (no network). */
  reused: boolean;
}

/** Stable identity for a review, used to dedupe cached + freshly fetched ones. */
function reviewKey(r: ReviewEntry): string {
  if (r.id) return r.id;
  return `${r.author}|${r.date}|${r.rating}|${(r.text || "").slice(0, 60)}`;
}

/** Merge two review lists, deduping by reviewKey and keeping the freshest copy. */
function mergeReviews(base: ReviewEntry[], extra: ReviewEntry[]): ReviewEntry[] {
  const map = new Map<string, ReviewEntry>();
  for (const r of base) map.set(reviewKey(r), r);
  for (const r of extra) {
    const k = reviewKey(r);
    if (!map.has(k)) map.set(k, r);
  }
  return Array.from(map.values());
}

export type ReviewSortPref = "recent" | "helpful" | "rating" | "mixed";

/**
 * Order reviews according to the user's preference. Applied AFTER collection
 * (and merge) so the stored dataset — and therefore every AI surface and
 * chart — sees a consistent, deterministic ordering regardless of which
 * source/country the review came from.
 *
 * - recent: newest first (date desc)
 * - helpful: most-thumbs-up first (Google only; Apple has no public helpfulness
 *   count, so those keep date order)
 * - rating: highest rating first
 * - mixed: collection order (no re-sort) — preserves source diversity
 */
function sortReviews(reviews: ReviewEntry[], pref: ReviewSortPref): ReviewEntry[] {
  if (pref === "mixed") return reviews;
  const arr = [...reviews];
  const byDateDesc = (a: ReviewEntry, b: ReviewEntry) => (b.date || "").localeCompare(a.date || "");
  if (pref === "recent") {
    arr.sort(byDateDesc);
  } else if (pref === "helpful") {
    arr.sort((a, b) => (b.thumbsUp ?? 0) - (a.thumbsUp ?? 0) || byDateDesc(a, b));
  } else if (pref === "rating") {
    arr.sort((a, b) => b.rating - a.rating || byDateDesc(a, b));
  }
  return arr;
}

/**
 * Coleta um único app. Se já está no dataset com reviews suficientes
 * (>= reviewLimit), retorna a entry armazenada sem nenhuma chamada de rede.
 * Senão, busca reviews (respeitando o limite configurado) — mesclando com as
 * reviews em cache ao refazer o fetch num limite maior — e persiste. Sempre
 * registra o app na sidebar de histórico à esquerda.
 */
export async function collectApp(
  app: AppInfo,
  region: string,
  reviewLimit: number,
  reviewSort: ReviewSortPref = "mixed",
  opts?: { ttlDays?: number },
): Promise<CollectResult> {
  const taskId = taskStart(null, `Coletar ${app.name ?? app.id}`, "coleta", `alvo: ${reviewLimit} reviews`);
  try {
    const result = await collectAppInner(app, region, reviewLimit, reviewSort, opts);
    taskEnd(taskId, "done", result.reused ? `${result.entry.reviews.length} reviews (cache)` : `${result.entry.reviews.length} reviews coletados`);
    return result;
  } catch (e) {
    taskEnd(taskId, "error", e instanceof Error ? e.message : "falha na coleta");
    throw e;
  }
}

async function collectAppInner(
  app: AppInfo,
  region: string,
  reviewLimit: number,
  reviewSort: ReviewSortPref,
  opts?: { ttlDays?: number },
): Promise<CollectResult> {
  // 1. Dedup against the persisted dataset — but only skip the network when we
  //    already have at least as many reviews as the user is asking for. Raising
  //    the limit must be able to pull more reviews. Stale entries (fora do TTL)
  //    refazem o fetch e mesclam — recolhe incremental sem perder dados.
  const existing = getDatasetEntry(app.store, app.id);
  const ttlDays = opts?.ttlDays ?? DEFAULT_TTL_DAYS;
  const stale = existing ? (Date.now() - existing.collectedAt) / 86400000 > ttlDays : false;
  if (existing && !stale && existing.reviews.length >= reviewLimit) {
    // Refresh history timestamp so the app floats to the top of the sidebar,
    // but do not refetch reviews.
    pushHistory({
      type: "app",
      store: existing.app.store,
      id: existing.app.id,
      name: existing.app.name,
      icon: existing.app.icon,
      ts: Date.now(),
    });
    try {
      recordGeneration({
        type: "collect",
        title: `${existing.app.name} · ${existing.app.store}`,
        appKeys: [`${existing.app.store}:${existing.app.id}`],
        summary: `${existing.reviews.length} reviews (cache)`,
        source: "collect",
      });
    } catch { /* logging never breaks collection */ }
    return { entry: existing, reused: true };
  }

  // 2. Fetch reviews + (for bare AppInfo shells) hydrate metadata. Metadata
  //    and reviews are independent — fetch them IN PARALLEL (cuts the collect
  //    latency roughly in half on both stores).
  const seed = app.id ? app : (existing?.app ?? app);
  let updated = existing?.app ?? app;
  let reviews: ReviewEntry[] = [];
  if (app.store === "google") {
    const [detailsRes, reviewsRes] = await Promise.allSettled([
      fetchGooglePlayAppDetails(app.id, region),
      fetchGooglePlayReviews(app.id, updated.name ?? "", region, reviewLimit, reviewSort),
    ]);
    if (detailsRes.status === "fulfilled" && detailsRes.value) {
      updated = { ...seed, ...detailsRes.value, id: app.id };
    }
    reviews = reviewsRes.status === "fulfilled" ? reviewsRes.value : [];
  } else {
    const [detailsRes, reviewsRes] = await Promise.allSettled([
      lookupApp(app.id, region),
      fetchReviews(app.id, updated.name ?? "", region, reviewLimit, reviewSort),
    ]);
    if (detailsRes.status === "fulfilled" && detailsRes.value) {
      updated = { ...seed, ...detailsRes.value, id: app.id };
    }
    reviews = reviewsRes.status === "fulfilled" ? reviewsRes.value : [];
  }

  // Ao refazer o fetch num limite maior, mantém as reviews já coletadas e
  // adiciona as novas (dedup) — nunca perde dados que o usuário já pagou
  // (em tempo de coleta), e continua crescendo em direção ao novo alvo.
  const merged = existing ? mergeReviews(existing.reviews, reviews) : reviews;

  // Aplica a preferência de ordenação do usuário ao dataset final para todo
  // consumidor (IA, gráficos, feed de reviews) ver uma ordenação consistente.
  // O enriquecimento determinístico (sentiment/wordCount/flags/ageDays) vai
  // junto, para a IA e a página Pipeline de dados raciocinarem sobre campos
  // mais ricos.
  const ordered = enrichReviews(sortReviews(merged, reviewSort));

  // 3. Persist + history.
  const entry: DatasetEntry = { app: updated, reviews: ordered, collectedAt: Date.now() };
  upsertDataset(entry);
  pushHistory({
    type: "app",
    store: updated.store,
    id: updated.id,
    name: updated.name,
    icon: updated.icon,
    ts: Date.now(),
  });
  try {
    recordGeneration({
      type: "collect",
      title: `${updated.name} · ${updated.store}`,
      appKeys: [`${updated.store}:${updated.id}`],
      summary: `${ordered.length} reviews coletados`,
      source: "collect",
    });
  } catch { /* logging never breaks collection */ }
  return { entry, reused: false };
}

/**
 * Registra um grupo de comparação na sidebar de histórico à esquerda (uma
 * única entrada `compare` que agrega todos os seus apps). Apps ausentes do
 * dataset também são coletados, para o grupo poder ser reaberto depois com os
 * dados intactos.
 */
export async function collectCompareGroup(
  apps: AppInfo[],
  region: string,
  reviewLimit: number,
  reviewSort: ReviewSortPref = "mixed",
): Promise<void> {
  if (apps.length === 0) return;
  // Garante que cada app está no dataset (dedup por app).
  await Promise.all(apps.map((a) => collectApp(a, region, reviewLimit, reviewSort)));
  // Empilha uma única entrada de comparação agrupada.
  pushHistory({
    type: "compare",
    apps: apps.map((a) => ({
      store: a.store,
      id: a.id,
      name: a.name,
      icon: a.icon,
    })),
    ts: Date.now(),
  });
}
