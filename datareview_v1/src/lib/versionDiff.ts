/**
 * Diff de versões como cidadão de primeira classe (Onda 4.2): responde
 * deterministicamente "o que mudou entre a versão X e a Y" — nota média,
 * % positivo/neutro/negativo, volume e termos em ascensão/queda — e gera a
 * narrativa do diff em texto. Sem IA: tudo computado dos reviews.
 */
import type { ReviewEntry } from "@/lib/appStoreApi";
import { computeWordCloud } from "@/lib/dashboardAnalytics";

export interface VersionStats {
  version: string;
  count: number;
  avgRating: number;
  positive: number;
  neutral: number;
  negative: number;
  pctPositive: number;
  pctNegative: number;
}

export interface TermShift {
  term: string;
  countA: number;
  countB: number;
  /** variação relativa: positivo = cresceu na versão B */
  delta: number;
}

export interface VersionDiff {
  a: VersionStats;
  b: VersionStats;
  ratingDelta: number;
  pctPositiveDelta: number;
  pctNegativeDelta: number;
  verdict: "melhora" | "regressao" | "estavel" | "dados-insuficientes";
  /** termos que mais cresceram (B vs A) e mais caíram */
  rising: TermShift[];
  falling: TermShift[];
  narrative: string[];
}

const MIN_REVIEWS_PER_VERSION = 3;
const STOPWORDS = new Set(["the", "and", "para", "com", "que", "uma", "app", "mas", "por", "mais", "muito"]);

function statsOf(version: string, reviews: ReviewEntry[]): VersionStats {
  const list = reviews.filter((r) => r.version === version);
  const pos = list.filter((r) => r.rating >= 4).length;
  const neg = list.filter((r) => r.rating <= 2).length;
  const avg = list.length ? list.reduce((s, r) => s + r.rating, 0) / list.length : 0;
  return {
    version,
    count: list.length,
    avgRating: +avg.toFixed(2),
    positive: pos,
    neutral: list.length - pos - neg,
    negative: neg,
    pctPositive: list.length ? Math.round((pos / list.length) * 100) : 0,
    pctNegative: list.length ? Math.round((neg / list.length) * 100) : 0,
  };
}

function termCounts(reviews: ReviewEntry[]): Map<string, number> {
  const counts = new Map<string, number>();
  const seen = computeWordCloud(reviews, 200);
  for (const [text, value] of seen) {
    const term = text.toLowerCase();
    if (term.length < 4 || STOPWORDS.has(term)) continue;
    counts.set(term, value);
  }
  return counts;
}

export function listVersions(reviews: ReviewEntry[]): string[] {
  const order: string[] = [];
  const seen = new Set<string>();
  for (const r of reviews) {
    if (r.version && !seen.has(r.version)) {
      seen.add(r.version);
      order.push(r.version);
    }
  }
  // Ordem semântica simples: compara segmentos numéricos; strings sem número
  // caem no fim em ordem alfabética.
  return order.sort((a, b) => compareVersions(a, b));
}

export function compareVersions(a: string, b: string): number {
  const pa = a.split(/[^0-9]+/).filter(Boolean).map(Number);
  const pb = b.split(/[^0-9]+/).filter(Boolean).map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return a.localeCompare(b);
}

export function diffVersions(reviews: ReviewEntry[], versionA: string, versionB: string): VersionDiff {
  const a = statsOf(versionA, reviews);
  const b = statsOf(versionB, reviews);

  const countsA = termCounts(reviews.filter((r) => r.version === versionA));
  const countsB = termCounts(reviews.filter((r) => r.version === versionB));
  const terms = new Set([...countsA.keys(), ...countsB.keys()]);
  const shifts: TermShift[] = [];
  for (const t of terms) {
    const countA = countsA.get(t) ?? 0;
    const countB = countsB.get(t) ?? 0;
    const base = countA + countB;
    if (base < 3) continue; // ruído: ignora termos raros
    shifts.push({ term: t, countA, countB, delta: countB - countA });
  }
  shifts.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
  const rising = shifts.filter((s) => s.delta > 0).slice(0, 5);
  const falling = shifts.filter((s) => s.delta < 0).slice(0, 5);

  const ratingDelta = +(b.avgRating - a.avgRating).toFixed(2);
  const pctPositiveDelta = b.pctPositive - a.pctPositive;
  const pctNegativeDelta = b.pctNegative - a.pctNegative;

  let verdict: VersionDiff["verdict"] = "estavel";
  if (a.count < MIN_REVIEWS_PER_VERSION || b.count < MIN_REVIEWS_PER_VERSION) verdict = "dados-insuficientes";
  else if (ratingDelta <= -0.5 || pctNegativeDelta >= 15) verdict = "regressao";
  else if (ratingDelta >= 0.5 || pctPositiveDelta >= 15) verdict = "melhora";

  const narrative: string[] = [];
  if (verdict === "dados-insuficientes") {
    narrative.push(
      `Amostra pequena para comparar ${versionA} (${a.count} reviews) com ${versionB} (${b.count} reviews) — colete mais dados para um veredito confiável.`,
    );
  } else {
    narrative.push(
      `${versionB} vs ${versionA}: nota média ${a.avgRating} → ${b.avgRating} (${ratingDelta >= 0 ? "+" : ""}${ratingDelta}), ` +
      `positivos ${a.pctPositive}% → ${b.pctPositive}%, negativos ${a.pctNegative}% → ${b.pctNegative}%.`,
    );
    if (verdict === "regressao") narrative.push(`Veredito: REGRESSÃO em ${versionB} — investigue os termos em ascensão abaixo.`);
    else if (verdict === "melhora") narrative.push(`Veredito: MELHORA em ${versionB} — a atualização foi bem recebida.`);
    else narrative.push(`Veredito: estável — sem mudança significativa de recepção.`);
  }
  if (rising.length) narrative.push(`Termos em ascensão em ${versionB}: ${rising.map((t) => `"${t.term}" (+${t.delta})`).join(", ")}.`);
  if (falling.length) narrative.push(`Termos que sumiram em ${versionB}: ${falling.map((t) => `"${t.term}" (${t.delta})`).join(", ")}.`);

  return { a, b, ratingDelta, pctPositiveDelta, pctNegativeDelta, verdict, rising, falling, narrative };
}
