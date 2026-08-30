/**
 * Framework de avaliação de IA automatizada (todo.md P0) — determinístico,
 * zero-rede e honesto: não inventa métricas de negócio; pontua a saída de IA
 * contra o dataset computável (agregados, reviews) em 6 dimensões. O status
 * "framework" é deliberado: sem baselines reais, não fabricamos scores.
 */
import type { DatasetEntry } from "@/lib/datasetStore";
import { computeKPIs } from "@/lib/dashboardAnalytics";

export interface EvaluationDimension {
  id: string;
  label: string;
  /** 0–100 (clamped). undefined quando não se aplica ao contexto. */
  score?: number;
  rationale: string;
}

export interface Evaluation {
  dimensions: EvaluationDimension[];
  /** Média ponderada (todas as dimensões com score) em 0–100, arredondada. */
  overall?: number;
  issues: string[];
}

/** Extrai percentuais do texto, p.ex. "positivo 62%", "60% de positivo". */
export function extractPercents(text: string): { value: number; context: string }[] {
  const out: { value: number; context: string }[] = [];
  const re = /(\d{1,3})\s*%/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    out.push({ value: Number(m[1]), context: text.slice(Math.max(0, m.index - 24), m.index + m[0].length) });
  }
  return out;
}

/** Fidelity: numeros de % do texto deveriam refletir os agregados computados. */
export function evaluateNumericFidelity(output: string, entries: DatasetEntry[]): EvaluationDimension {
  const reviews = entries.flatMap((e) => e.reviews);
  if (!reviews.length || !output) {
    return { id: "fidelity", label: "Fidelidade numérica", score: undefined, rationale: "sem dados ou saída vazia" };
  }
  const kpis = computeKPIs(reviews, entries);
  const n = reviews.length || 1;
  const positivePct = (reviews.filter((r) => r.rating >= 4).length / n) * 100;
  const neutralPct = (reviews.filter((r) => r.rating === 3).length / n) * 100;
  const negativePct = (reviews.filter((r) => r.rating <= 2).length / n) * 100;
  const ints = extractPercents(output);
  if (!ints.length) {
    return { id: "fidelity", label: "Fidelidade numérica", score: 55, rationale: "sem percentuais auditáveis na saída" };
  }
  const hand: number[] = [positivePct, negativePct, neutralPct, kpis.avgRating * 20];
  let matchable = 0;
  let faithful = 0;
  for (const it of ints) {
    // tolerância 8pp para auditáveis
    for (const ref of hand) {
      if (Math.abs(ref - it.value) <= 8) {
        matchable++;
        if (Math.abs(ref - it.value) <= 3) faithful++;
        break;
      }
    }
  }
  if (!matchable) {
    return { id: "fidelity", label: "Fidelidade numérica", score: 20, rationale: "percentuais não batem com os agregados do dataset" };
  }
  const score = Math.min(100, Math.round(40 + (faithful / ints.length) * 60));
  return { id: "fidelity", label: "Fidelidade numérica", score, rationale: `${matchable}/${ints.length} percentuais dentro dos agregados` };
}

/** Cobertura de evidência: blocos de citação reais e referências a ids. */
export function evaluateEvidenceCoverage(output: string, entries: DatasetEntry[]): EvaluationDimension {
  if (!output) return { id: "evidence", label: "Evidência", score: undefined, rationale: "sem saída" };
  const quotes = (output.match(/^>\s/mg) || []).length;
  const honest = /não há evidência|sem evidência/i.test(output);
  const claims = (output.match(/([^.!?]*(O|A) [^.!?]*)([^.!?]|$)/g) || []).filter((c) => /[A-Za-z]{4,}/.test(c)).length;
  const reviews = entries.flatMap((e) => e.reviews);
  if (!claims) {
    return { id: "evidence", label: "Evidência", score: 50, rationale: "pouco conteúdo auditável" };
  }
  const density = quotes / Math.max(1, claims);
  let score = Math.min(100, Math.round(density * 140));
  if (honest && !quotes) score = Math.max(40, score);
  if (!reviews.length) score = 40;
  return { id: "evidence", label: "Evidência", score, rationale: `${quotes} citações em ${claims} afirmações${honest ? " (honesto)" : ""}` };
}

/** Aderência de estrutura: cabeçalhos e camadas distintas na resposta. */
export function evaluateStructure(output: string): EvaluationDimension {
  if (!output) return { id: "structure", label: "Estrutura", score: undefined, rationale: "sem saída" };
  const headings = (output.match(/^#{2,4}\s+/gm) || []).length;
  const layers = ["Insight", "Quantificação", "Evidência", "Contexto", "Decisão", "Ação"].reduce(
    (n, k) => n + (new RegExp(`^#{2,4}[^\\n]*${k}`, "im").test(output) ? 1 : 0),
    0,
  );
  const score = Math.min(100, headings * 8 + layers * 14);
  return { id: "structure", label: "Estrutura", score, rationale: `${headings} cabeçalhos, ${layers} camadas nomeadas` };
}

/** Calibração de confiança honesta: saída coerente com o volume de dados. */
export function evaluateCalibration(output: string, entries: DatasetEntry[]): EvaluationDimension {
  if (!output) return { id: "calibration", label: "Calibração", score: undefined, rationale: "sem saída" };
  const reviews = entries.flatMap((e) => e.reviews);
  const n = reviews.length;
  const hasUncertainty = /incert|pouco evidência|pequena amostra|poucos reviews|não conclusivo/i.test(output);
  if (n >= 200) {
    if (hasUncertainty) return { id: "calibration", label: "Calibração", score: 70, rationale: "incerteza explícita com amostra grande" };
    return { id: "calibration", label: "Calibração", score: 55, rationale: "confiança sem ressalva (amostra grande — aceitável)" };
  }
  if (n >= 30) {
    return { id: "calibration", label: "Calibração", score: hasUncertainty ? 80 : 50, rationale: hasUncertainty ? "incerteza coerente com amostra média" : "confiança alta com amostra média" };
  }
  return { id: "calibration", label: "Calibração", score: hasUncertainty ? 90 : 10, rationale: hasUncertainty ? "incerteza coerente com amostra pequena" : "confiança alta com amostra pequena" };
}

/** Cobertura do escopo: menciona apps do dataset (nome de cada entry). */
export function evaluateScopeCoverage(output: string, entries: DatasetEntry[]): EvaluationDimension {
  if (!output || !entries.length) return { id: "scope", label: "Escopo", score: undefined, rationale: "sem saída/dataset" };
  const names = entries.map((e) => e.app.name).filter(Boolean);
  const hit = names.filter((n) => output.toLowerCase().includes(n!.toLowerCase())).length;
  const score = Math.round((hit / names.length) * 100);
  return { id: "scope", label: "Escopo", score, rationale: `${hit}/${names.length} apps mencionados` };
}

/** Completude: a saída doestá completa (não cortada no meio). */
export function evaluateCompleteness(output: string): EvaluationDimension {
  if (!output) return { id: "completeness", label: "Completude", score: undefined, rationale: "sem saída vazia" };
  const trimmed = output.trim();
  const last = trimmed.slice(-1);
  const cut = /[.!?…#)\]]|"|'/.test(last) || /:`/.test(trimmed.slice(-2));
  return {
    id: "completeness",
    label: "Completude",
    score: cut ? 100 : 30,
    rationale: cut ? "termina em borda de frase" : "parece cortada no meio da frase",
  };
}

export function evaluateAIOutput(output: string, entries: DatasetEntry[]): Evaluation {
  const dimensions = [
    evaluateCompleteness(output),
    evaluateStructure(output),
    evaluateNumericFidelity(output, entries),
    evaluateEvidenceCoverage(output, entries),
    evaluateCalibration(output, entries),
    evaluateScopeCoverage(output, entries),
  ];
  const issues: string[] = [];
  for (const d of dimensions) if (d.score !== undefined && d.score < 40) issues.push(d.rationale);
  const scored = dimensions.filter((d) => d.score !== undefined) as { score: number }[];
  const overall = scored.length
    ? Math.round(scored.reduce((s, d) => s + d.score, 0) / scored.length)
    : undefined;
  return { dimensions, overall, issues };
}
