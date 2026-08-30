/**
 * Detecção determinística de anomalias — evidência computacional pura.
 *
 * Cada anomalia é um FATO quantificado (ex.: "v8.2: média 2.9, -0.9 vs geral,
 * negativos +184%"), nunca uma interpretação. As anomalias servem a dois
 * propósitos no pipeline:
 *
 *  1. Viram artefatos do estágio COMPUTE (com reviewIds → lineage até os
 *     dados originais).
 *  2. Alimentam o ORQUESTRADOR: anomalias aumentam o potencial das análises
 *     relacionadas (ex.: regressão de versão → prioriza "version-impact" e
 *     "what-changed").
 */
import type { DatasetEntry } from "@/lib/datasetStore";
import { entryKey } from "@/lib/dashboardAnalytics";
import type { ComputedFacts } from "./facts";

export type AnomalyType =
  | "version-regression"  // versão com nota muito abaixo da média do app
  | "negativity-spike"    // % negativo recente muito acima do baseline
  | "volume-spike"        // mês com volume muito acima da mediana
  | "app-rating-outlier"; // app descolado da média do conjunto

export interface Anomaly {
  id: string;
  type: AnomalyType;
  severity: "alta" | "média" | "baixa";
  appKey?: string;
  appName?: string;
  title: string;
  /** Detalhe quantificado (o cálculo visível). */
  detail: string;
  numbers: Record<string, number>;
  /** Reviews que sustentam a anomalia (lineage até os dados brutos). */
  reviewIds: string[];
}

export const ANOMALY_TYPE_LABEL: Record<AnomalyType, string> = {
  "version-regression": "Regressão de versão",
  "negativity-spike": "Pico de negatividade",
  "volume-spike": "Pico de volume",
  "app-rating-outlier": "App fora da curva",
};

const DAY = 24 * 60 * 60 * 1000;

/** Versão com média ≥ 0.7 abaixo da média do app (mín. 5 reviews na versão,
 *  20 no app). Severidade escala com o tamanho da queda. */
function detectVersionRegressions(entries: DatasetEntry[], facts: ComputedFacts): Anomaly[] {
  const out: Anomaly[] = [];
  for (const e of entries) {
    const key = entryKey(e.app.store, e.app.id);
    const versions = facts.perAppVersions[key] ?? [];
    if (e.reviews.length < 20 || versions.length < 2) continue;
    const appAvg = e.reviews.reduce((s, r) => s + r.rating, 0) / e.reviews.length;
    for (const v of versions) {
      if (v.count < 5) continue;
      const delta = +(v.avgRating - appAvg).toFixed(2);
      if (delta <= -0.7) {
        const vReviews = e.reviews.filter((r) => r.version === v.version);
        const negIds = vReviews.filter((r) => r.rating <= 2).map((r) => r.id).slice(0, 12);
        out.push({
          id: `version-regression:${key}:${v.version}`,
          type: "version-regression",
          severity: delta <= -1.2 ? "alta" : delta <= -0.9 ? "média" : "baixa",
          appKey: key,
          appName: e.app.name,
          title: `${e.app.name} · v${v.version} com queda de ${delta}`,
          detail: `v${v.version}: média ${v.avgRating}★ (n=${v.count}, neg ${v.negativePct}%) vs média do app ${appAvg.toFixed(2)}★ — delta ${delta}.`,
          numbers: { versionAvg: v.avgRating, appAvg: +appAvg.toFixed(2), delta, count: v.count, negativePct: v.negativePct },
          reviewIds: negIds,
        });
      }
    }
  }
  return out;
}

/** Últimos 14 dias com % negativo ≥ +15pp vs período anterior (mín. 10
 *  reviews recentes). */
function detectNegativitySpikes(entries: DatasetEntry[]): Anomaly[] {
  const out: Anomaly[] = [];
  for (const e of entries) {
    const key = entryKey(e.app.store, e.app.id);
    const dated = e.reviews
      .filter((r) => r.date)
      .map((r) => ({ r, ts: new Date(r.date).getTime() }))
      .filter((x) => Number.isFinite(x.ts))
      .sort((a, b) => a.ts - b.ts);
    if (dated.length < 30) continue;
    const newest = dated[dated.length - 1].ts;
    const cutoff = newest - 14 * DAY;
    const recent = dated.filter((x) => x.ts >= cutoff);
    const baseline = dated.filter((x) => x.ts < cutoff);
    if (recent.length < 10 || baseline.length < 10) continue;
    const negPct = (arr: typeof dated) =>
      Math.round((arr.filter((x) => x.r.rating <= 2).length / arr.length) * 100);
    const recentNeg = negPct(recent);
    const baseNeg = negPct(baseline);
    const delta = recentNeg - baseNeg;
    if (delta >= 15) {
      out.push({
        id: `negativity-spike:${key}`,
        type: "negativity-spike",
        severity: delta >= 30 ? "alta" : delta >= 20 ? "média" : "baixa",
        appKey: key,
        appName: e.app.name,
        title: `${e.app.name} · negatividade +${delta}pp nos últimos 14 dias`,
        detail: `Negativos recentes: ${recentNeg}% (n=${recent.length}) vs baseline ${baseNeg}% (n=${baseline.length}) — +${delta}pp.`,
        numbers: { recentNegativePct: recentNeg, baselineNegativePct: baseNeg, deltaPp: delta, recentCount: recent.length },
        reviewIds: recent.filter((x) => x.r.rating <= 2).map((x) => x.r.id).slice(0, 12),
      });
    }
  }
  return out;
}

/** Último mês com volume ≥ 2× a mediana mensal (mín. 4 meses de dados). */
function detectVolumeSpikes(facts: ComputedFacts): Anomaly[] {
  const t = facts.timeline;
  if (t.length < 4) return [];
  const counts = t.map((m) => m.count).sort((a, b) => a - b);
  const med = counts.length % 2 ? counts[(counts.length - 1) / 2] : (counts[counts.length / 2 - 1] + counts[counts.length / 2]) / 2;
  if (med <= 0) return [];
  const last = t[t.length - 1];
  const ratio = +(last.count / med).toFixed(1);
  if (ratio < 2) return [];
  return [{
    id: `volume-spike:${last.month}`,
    type: "volume-spike",
    severity: ratio >= 4 ? "alta" : ratio >= 2.5 ? "média" : "baixa",
    title: `Volume de reviews ${ratio}× acima da mediana em ${last.month}`,
    detail: `${last.month}: ${last.count} reviews vs mediana mensal ${med} — ${ratio}×.`,
    numbers: { monthCount: last.count, medianCount: med, ratio },
    reviewIds: [],
  }];
}

/** App com nota coletada |delta| ≥ 0.8 da média do conjunto (mín. 30 reviews,
 *  2+ apps). */
function detectAppOutliers(facts: ComputedFacts): Anomaly[] {
  if (facts.perApp.length < 2) return [];
  const eligible = facts.perApp.filter((p) => p.reviewCount >= 30);
  if (eligible.length < 2) return [];
  const globalAvg = facts.kpis.avgRating;
  const out: Anomaly[] = [];
  for (const p of eligible) {
    const delta = +(p.avgCollected - globalAvg).toFixed(2);
    if (Math.abs(delta) >= 0.8) {
      out.push({
        id: `app-rating-outlier:${p.key}`,
        type: "app-rating-outlier",
        severity: Math.abs(delta) >= 1.2 ? "alta" : "média",
        appKey: p.key,
        appName: p.name,
        title: `${p.name} ${delta > 0 ? "acima" : "abaixo"} do conjunto (${delta > 0 ? "+" : ""}${delta})`,
        detail: `${p.name}: média coletada ${p.avgCollected}★ (n=${p.reviewCount}) vs média do conjunto ${globalAvg}★ — delta ${delta > 0 ? "+" : ""}${delta}.`,
        numbers: { appAvg: p.avgCollected, globalAvg, delta, count: p.reviewCount },
        reviewIds: [],
      });
    }
  }
  return out;
}

/** Roda todos os detectores e ordena por severidade. */
export function detectAnomalies(entries: DatasetEntry[], facts: ComputedFacts): Anomaly[] {
  const all = [
    ...detectVersionRegressions(entries, facts),
    ...detectNegativitySpikes(entries),
    ...detectVolumeSpikes(facts),
    ...detectAppOutliers(facts),
  ];
  const sevRank = { alta: 0, "média": 1, baixa: 2 };
  return all.sort((a, b) => sevRank[a.severity] - sevRank[b.severity]);
}
