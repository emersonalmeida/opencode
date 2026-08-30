/**
 * Validação de evidências — garante que claims da IA apontem para reviews
 * reais do dataset. Reviews públicas são dados NÃO confiáveis; a validação
 * protege contra evidência fabricada ou deslocada.
 *
 * Verifica, para cada evidência estruturada:
 *  1. review existe no dataset;
 *  2. review pertence ao app declarado;
 *  3. quote existe (aproximadamente) no texto original;
 *  4. app corresponde;
 *  5. review ID é válido.
 */

import type { DatasetEntry } from "@/lib/datasetStore";
import { entryKey } from "@/context/SelectionContext";
import type {
  EvidenceValidation,
  LabFinding,
  LabFindingEvidence,
  StructuredEvidence,
  StructuredFinding,
} from "./types";

/** Indexa reviews por id e por appKey para lookup O(1). */
interface ReviewIndex {
  byId: Map<string, { entry: DatasetEntry; reviewId: string; text: string }>;
  byApp: Map<string, string[]>;
}

function buildIndex(entries: DatasetEntry[]): ReviewIndex {
  const byId = new Map<string, { entry: DatasetEntry; reviewId: string; text: string }>();
  const byApp = new Map<string, string[]>();
  for (const entry of entries) {
    const key = entryKey(entry.app.store, entry.app.id);
    const ids: string[] = [];
    for (const r of entry.reviews) {
      byId.set(r.id, { entry, reviewId: r.id, text: r.text || "" });
      ids.push(r.id);
    }
    byApp.set(key, ids);
  }
  return { byId, byApp };
}

/** Normaliza texto para comparação tolerante (case/acentos/espaços). */
function normalize(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Quote existe (substring aproximada) no texto do review? */
function quoteMatches(quote: string, text: string, minLen = 12): boolean {
  const q = normalize(quote);
  const t = normalize(text);
  if (q.length < minLen) return false;
  if (t.includes(q)) return true;
  // tolerância: pelo menos 70% de overlap token a token
  const qt = new Set(q.split(" ").filter((w) => w.length > 2));
  if (qt.size === 0) return false;
  let hits = 0;
  for (const w of qt) if (t.includes(w)) hits++;
  return hits / qt.size >= 0.7;
}

/**
 * Valida uma evidência estruturada (saída da IA) contra o dataset.
 * Retorna issues descritivas quando há falha.
 */
export function validateEvidence(
  ev: StructuredEvidence,
  index: ReviewIndex,
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  // 5. review ID presente e válido
  if (!ev.reviewId) {
    issues.push("reviewId ausente");
  } else {
    const found = index.byId.get(ev.reviewId);
    // 1. review existe no dataset
    if (!found) {
      issues.push(`review ${ev.reviewId} não existe no dataset`);
    } else {
      // 4. app corresponde
      const key = entryKey(found.entry.app.store, found.entry.app.id);
      if (ev.appKey && ev.appKey !== key) {
        issues.push(`appKey ${ev.appKey} ≠ app do review (${key})`);
      }
      // 3. quote existe no texto
      if (ev.quote && !quoteMatches(ev.quote, found.text)) {
        issues.push("quote não encontrada no texto do review");
      }
    }
  }
  return { valid: issues.length === 0, issues };
}

/**
 * Valida um conjunto de evidências estruturadas (findings da IA).
 * Retorna o índice construído para reuso.
 */
export function validateStructuredFindings(
  findings: StructuredFinding[],
  entries: DatasetEntry[],
): { index: ReviewIndex; results: Map<string, { valid: boolean; issues: string[] }[]> } {
  const index = buildIndex(entries);
  const results = new Map<string, { valid: boolean; issues: string[] }[]>();
  for (const f of findings) {
    if (!f.evidence?.length) continue;
    results.set(
      f.title,
      f.evidence.map((ev) => validateEvidence(ev, index)),
    );
  }
  return { index, results };
}

/** Marca a validação numa LabFinding (persiste status + issues). */
export function annotateFinding(
  finding: LabFinding,
  entries: DatasetEntry[],
): LabFinding {
  const index = buildIndex(entries);
  const evidence: LabFindingEvidence = { ...(finding.evidence || {}) };
  const issues: string[] = [];
  const reviewIds = evidence.reviewIds || [];
  const quotes = evidence.quotes || [];

  let allValid = true;
  let anyChecked = false;
  for (let i = 0; i < reviewIds.length; i++) {
    const rid = reviewIds[i];
    const quote = quotes[i];
    const found = index.byId.get(rid);
    anyChecked = true;
    if (!found) {
      issues.push(`review ${rid} não existe no dataset`);
      allValid = false;
      continue;
    }
    if (quote && !quoteMatches(quote, found.text)) {
      issues.push(`quote do review ${rid} não corresponde ao texto`);
      allValid = false;
    }
  }
  if (!anyChecked) {
    // Sem reviewIds para validar — só checamos se há appKeys declarados
    if (evidence.appKeys?.length) {
      for (const key of evidence.appKeys) {
        if (!index.byApp.has(key)) {
          issues.push(`app ${key} não está no dataset`);
          allValid = false;
        }
      }
    }
  }

  const validation: EvidenceValidation = {
    status: anyChecked || evidence.appKeys?.length ? (allValid ? "valid" : "failed") : "unverified",
    checkedAt: new Date().toISOString(),
    issues: issues.length ? issues : undefined,
  };
  return { ...finding, evidence: { ...evidence, validation } };
}
