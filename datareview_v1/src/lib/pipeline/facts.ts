/**
 * Camada determinística do pipeline — FATOS, não opinião.
 *
 * Tudo aqui é computado sem IA, a partir do dataset bruto, e é 100%
 * reproduzível/auditável: mesma entrada → mesma saída. O resultado
 * (`ComputedFacts`) alimenta os estágios de IA como contexto estruturado,
 * para que a IA nunca precise "adivinhar" números.
 */
import type { DatasetEntry } from "@/lib/datasetStore";
import type { ReviewEntry } from "@/lib/appStoreApi";
import { getEntryDerived } from "@/lib/derivedData";
import {
  computeKPIs,
  computeRatingDistribution,
  computeSentiment,
  computeTimeline,
  computePerAppStats,
  computeVersionBreakdown,
  computeWordCloud,
  entryKey,
  type DashboardKPIs,
  type PerAppStat,
} from "@/lib/dashboardAnalytics";

export interface VersionStat {
  version: string;
  count: number;
  avgRating: number;
  negativePct: number;
}

export interface CountryStat {
  country: string;
  count: number;
  avgRating: number;
  negativePct: number;
}

export interface HelpfulReview {
  reviewId: string;
  appKey: string;
  appName: string;
  author: string;
  rating: number;
  thumbsUp: number;
  snippet: string;
}

export interface DataQuality {
  total: number;
  withDate: number;
  withVersion: number;
  withCountry: number;
  withReply: number;
  /** % de reviews com cada campo (0-100). */
  datePct: number;
  versionPct: number;
  countryPct: number;
  replyPct: number;
}

export interface ComputedFacts {
  scope: { apps: number; reviews: number; appKeys: string[] };
  kpis: DashboardKPIs;
  ratingDistribution: { star: string; count: number; rating: number }[];
  sentiment: { name: string; value: number }[];
  perApp: PerAppStat[];
  timeline: { month: string; avgRating: number; count: number }[];
  /** Versões agregadas (todos os apps). */
  versions: VersionStat[];
  /** Versões por app (chave `${store}:${id}`). */
  perAppVersions: Record<string, VersionStat[]>;
  countries: CountryStat[];
  topTerms: [string, number][];
  /** Reviews mais úteis (thumbsUp) — evidência de maior peso. */
  helpful: HelpfulReview[];
  reviewLength: { avg: number; median: number; max: number };
  dataQuality: DataQuality;
}

function versionStats(reviews: ReviewEntry[]): VersionStat[] {
  const base = computeVersionBreakdown(reviews);
  return base.map((v) => {
    const rs = reviews.filter((r) => r.version === v.version);
    const neg = rs.filter((r) => r.rating <= 2).length;
    return {
      version: v.version,
      count: v.count,
      avgRating: v.avgRating,
      negativePct: v.count ? Math.round((neg / v.count) * 100) : 0,
    };
  });
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/** Computa TODOS os fatos determinísticos do escopo (entries selecionadas). */
export function computeFacts(entries: DatasetEntry[]): ComputedFacts {
  const reviews = entries.flatMap((e) => e.reviews);
  const total = reviews.length;

  // Países
  const byCountry: Record<string, { ratings: number[]; neg: number }> = {};
  for (const r of reviews) {
    if (!r.country) continue;
    const c = r.country.toUpperCase();
    if (!byCountry[c]) byCountry[c] = { ratings: [], neg: 0 };
    byCountry[c].ratings.push(r.rating);
    if (r.rating <= 2) byCountry[c].neg++;
  }
  const countries: CountryStat[] = Object.entries(byCountry)
    .map(([country, d]) => ({
      country,
      count: d.ratings.length,
      avgRating: +(d.ratings.reduce((a, b) => a + b, 0) / d.ratings.length).toFixed(2),
      negativePct: Math.round((d.neg / d.ratings.length) * 100),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  // Reviews mais úteis
  const helpful: HelpfulReview[] = entries
    .flatMap((e) =>
      e.reviews
        .filter((r) => (r.thumbsUp ?? 0) > 0)
        .map((r) => ({
          reviewId: r.id,
          appKey: entryKey(e.app.store, e.app.id),
          appName: e.app.name,
          author: r.author,
          rating: r.rating,
          thumbsUp: r.thumbsUp ?? 0,
          snippet: (r.text || r.title || "").slice(0, 140),
        })),
    )
    .sort((a, b) => b.thumbsUp - a.thumbsUp)
    .slice(0, 10);

  // Comprimento dos reviews
  const lengths = reviews.map((r) => (r.text || "").length).filter((n) => n > 0);

  // Qualidade dos dados
  const withDate = reviews.filter((r) => r.date).length;
  const withVersion = reviews.filter((r) => r.version).length;
  const withCountry = reviews.filter((r) => r.country).length;
  const withReply = reviews.filter((r) => r.developerReply).length;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  // Versões por app via camada derivada (cache por assinatura de entry —
  // recoletar outro app não recomputa estas agregações).
  const perAppVersions: Record<string, VersionStat[]> = {};
  for (const e of entries) {
    perAppVersions[entryKey(e.app.store, e.app.id)] = getEntryDerived(e).versions;
  }

  return {
    scope: {
      apps: entries.length,
      reviews: total,
      appKeys: entries.map((e) => entryKey(e.app.store, e.app.id)),
    },
    kpis: computeKPIs(reviews, entries),
    ratingDistribution: computeRatingDistribution(reviews),
    sentiment: computeSentiment(reviews),
    perApp: computePerAppStats(entries),
    timeline: computeTimeline(reviews),
    versions: versionStats(reviews),
    perAppVersions,
    countries,
    topTerms: computeWordCloud(reviews, 30),
    helpful,
    reviewLength: {
      avg: lengths.length ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length) : 0,
      median: median(lengths),
      max: lengths.length ? Math.max(...lengths) : 0,
    },
    dataQuality: {
      total,
      withDate,
      withVersion,
      withCountry,
      withReply,
      datePct: pct(withDate),
      versionPct: pct(withVersion),
      countryPct: pct(withCountry),
      replyPct: pct(withReply),
    },
  };
}

/** Renderiza os fatos como markdown enxuto — usado no artefato e como
 *  contexto estruturado para os estágios de IA. */
export function factsToMarkdown(facts: ComputedFacts, appNames: Record<string, string>): string {
  const k = facts.kpis;
  const lines: string[] = [];
  lines.push(`## Fatos determinísticos (computados, não interpretados)`);
  lines.push("");
  lines.push(`- **Escopo**: ${facts.scope.apps} app(s), ${facts.scope.reviews} reviews coletados`);
  lines.push(`- **Nota média coletada**: ${k.avgRating} (Positivo ${k.positivePct}% · Neutro ${k.neutralPct}% · Negativo ${k.negativePct}%)`);
  if (k.oldestDate && k.newestDate) {
    lines.push(`- **Período**: ${k.oldestDate.slice(0, 10)} → ${k.newestDate.slice(0, 10)}`);
  }
  lines.push(`- **Distribuição**: ${facts.ratingDistribution.map((d) => `${d.star}=${d.count}`).join(" · ")}`);
  lines.push(`- **Comprimento médio dos reviews**: ${facts.reviewLength.avg} chars (mediana ${facts.reviewLength.median})`);
  lines.push(`- **Qualidade dos dados**: data ${facts.dataQuality.datePct}% · versão ${facts.dataQuality.versionPct}% · país ${facts.dataQuality.countryPct}%`);
  lines.push("");

  if (facts.perApp.length > 0) {
    lines.push(`### Por app`);
    lines.push("");
    lines.push(`| App | Reviews | Nota coletada | % Pos | % Neg |`);
    lines.push(`|---|---|---|---|---|`);
    for (const p of facts.perApp) {
      lines.push(`| ${p.name} | ${p.reviewCount} | ${p.avgCollected} | ${p.positivePct}% | ${p.negativePct}% |`);
    }
    lines.push("");
  }

  const appsWithVersions = Object.entries(facts.perAppVersions).filter(([, vs]) => vs.length > 1);
  if (appsWithVersions.length > 0) {
    lines.push(`### Versões (por app)`);
    lines.push("");
    for (const [appKey, vs] of appsWithVersions.slice(0, 6)) {
      const name = appNames[appKey] ?? appKey;
      lines.push(`**${name}**: ${vs.map((v) => `v${v.version} ${v.avgRating}★ (n=${v.count}, neg ${v.negativePct}%)`).join(" · ")}`);
    }
    lines.push("");
  }

  if (facts.countries.length > 1) {
    lines.push(`### Países`);
    lines.push("");
    lines.push(facts.countries.map((c) => `**${c.country}** ${c.count} reviews · ${c.avgRating}★ · neg ${c.negativePct}%`).join(" · "));
    lines.push("");
  }

  if (facts.topTerms.length > 0) {
    lines.push(`### Termos mais frequentes`);
    lines.push("");
    lines.push(facts.topTerms.slice(0, 20).map(([t, n]) => `${t} (${n})`).join(" · "));
    lines.push("");
  }

  return lines.join("\n");
}
