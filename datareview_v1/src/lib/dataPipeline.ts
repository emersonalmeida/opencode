/**
 * Pipeline de dados — validação e auditoria do dataset de ponta a ponta.
 *
 * `runValidation(entries)` executa 8 verificações determinísticas por app e
 * retorna um relatório com status PASS/WARN/FAIL por verificação + issues
 * estruturadas (qual app, qual review, mensagem). A página `/pipeline-dados`
 * mostra esse relatório interativo.
 */
import type { AppInfo, ReviewEntry } from "@/lib/appStoreApi";
import type { DatasetEntry } from "@/lib/datasetStore";
import { appCoverage, APPFIELD_AUDIT } from "@/lib/enrichment";

export type CheckStatus = "pass" | "warn" | "fail";
export interface CheckIssue {
  appKey: string;
  reviewId?: string;
  message: string;
}
export interface CheckResult {
  id: string;
  label: string;
  status: CheckStatus;
  issues: CheckIssue[];
}

export interface ValidationReport {
  checks: CheckResult[];
  totalIssues: number;
  overall: CheckStatus;
}

const RATING_BAD = (r: number) => !(r >= 1 && r <= 5);

/** Executa 8 verificações determinísticas no dataset. */
export function runValidation(entries: DatasetEntry[]): ValidationReport {
  const checks: CheckResult[] = [];

  // 1. Duplicatas de review por id
  const dupIds = entries.flatMap((e) => {
    const seen = new Map<string, number>();
    for (const r of e.reviews) seen.set(r.id, (seen.get(r.id) ?? 0) + 1);
    return [...seen.entries()].filter(([, n]) => n > 1).map(([id, n]) => ({
      appKey: `${e.app.store}:${e.app.id}`,
      reviewId: id,
      message: `review "${id}" aparece ${n} vezes`,
    }));
  });
  checks.push({ id: "dup-ids", label: "IDs de review únicos", status: dupIds.length ? "fail" : "pass", issues: dupIds });

  // 2. Rating válido
  const badRating = entries.flatMap((e) =>
    e.reviews.filter((r) => RATING_BAD(r.rating)).map((r) => ({
      appKey: `${e.app.store}:${e.app.id}`,
      reviewId: r.id,
      message: `rating inválido: ${r.rating}`,
    })),
  );
  checks.push({ id: "rating", label: "Ratings 1–5 válidos", status: badRating.length ? "fail" : "pass", issues: badRating });

  // 3. Reviews vazios (sem texto e sem título)
  const empty = entries.flatMap((e) =>
    e.reviews.filter((r) => !r.text && !r.title).map((r) => ({
      appKey: `${e.app.store}:${e.app.id}`,
      reviewId: r.id,
      message: "review sem texto e sem título",
    })),
  );
  checks.push({
    id: "empty",
    label: "Reviews com conteúdo não-vazio",
    status: empty.length ? "warn" : "pass",
    issues: empty,
  });

  // 4. Datas parseáveis e não futuras
  const now = Date.now();
  const badDates = entries.flatMap((e) =>
    e.reviews.filter((r) => {
      const t = new Date(r.date).getTime();
      return !r.date || Number.isNaN(t) || t > now + 86400000;
    }).map((r) => ({
      appKey: `${e.app.store}:${e.app.id}`,
      reviewId: r.id,
      message: `data inválida/futura: "${r.date}"`,
    })),
  );
  checks.push({ id: "dates", label: "Datas de review válidas", status: badDates.length ? "warn" : "pass", issues: badDates });

  // 5. Campos essenciais do app preenchidos
  const REQUIRED: (keyof AppInfo)[] = ["id", "store", "name", "icon", "developer", "rating"];
  const missingEssential = entries.flatMap((e) =>
    REQUIRED.filter((k) => {
      const v = e.app[k];
      return v == null || v === "" || (typeof v === "number" && Number.isNaN(v));
    }).map((k) => ({
      appKey: `${e.app.store}:${e.app.id}`,
      message: `campo essencial ausente: ${String(k)}`,
    })),
  );
  checks.push({ id: "essential", label: "Campos essenciais do app", status: missingEssential.length ? "fail" : "pass", issues: missingEssential });

  // 6. Completude média do dataset ≥ 60% — appCoverage computado UMA vez por
  // entry (antes: 2x, score + issues).
  const coverages = entries.map((e) => ({ e, score: appCoverage(e.app as AppInfo).score }));
  const coverage = coverages.reduce((s, c) => s + c.score, 0) / Math.max(1, entries.length);
  checks.push({
    id: "coverage",
    label: `Cobertura de campos ≥ 60% (atual: ${Math.round(coverage)}%)`,
    status: coverage >= 60 ? "pass" : "warn",
    issues: coverage < 60
      ? coverages.map((c) => ({
          appKey: `${c.e.app.store}:${c.e.app.id}`,
          message: `cobertura ${c.score}%`,
        }))
      : [],
  });

  // 7. Campos estruturados esperados por loja
  const storeHints: CheckIssue[] = [];
  for (const e of entries) {
    const k = `${e.app.store}:${e.app.id}`;
    if (e.app.store === "google" && e.app.histogram == null) {
      storeHints.push({ appKey: k, message: "Google sem histograma de notas (costuma existir)" });
    }
    if (e.app.store === "apple" && (e.app.languages == null) && (e.app.supportedDevices == null)) {
      storeHints.push({ appKey: k, message: "Apple sem languages/supportedDevices (costuma existir)" });
    }
  }
  checks.push({ id: "store", label: "Campos exclusivos da loja presentes", status: storeHints.length ? "warn" : "pass", issues: storeHints });

  // 8. Reviews com data/números enriquecidos presentes
  const enrichMissing = entries.flatMap((e) =>
    e.reviews.filter((r) => {
      const er = r as ReviewEntry & { sentiment?: string; wordCount?: number };
      return er.sentiment == null || er.wordCount == null;
    }).slice(0, 10).map((r) => ({
      appKey: `${e.app.store}:${e.app.id}`,
      reviewId: r.id,
      message: "review não enriquecido (rode o audit em qualquer coleta nova)",
    })),
  );
  checks.push({
    id: "enriched",
    label: "Reviews enriquecidos (sentimento/wordCount/flags)",
    status: enrichMissing.length ? "warn" : "pass",
    issues: enrichMissing,
  });

  const totalIssues = checks.reduce((s, c) => s + c.issues.length, 0);
  const overall: CheckStatus = checks.some((c) => c.status === "fail") ? "fail"
    : checks.some((c) => c.status === "warn") ? "warn" : "pass";
  return { checks, totalIssues, overall };
}
