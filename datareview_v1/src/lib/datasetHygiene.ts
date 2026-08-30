/**
 * Higiene do dataset local (todo.md P0): detecta e remove entries
 * SINTÉTICOS que sobraram de instalações de teste antigas no localStorage
 * (ex.: o Nubank-Apple fake id "123456789" com reviews autor "User0..59"
 * documentado no hip histórico do AGENTS.md).
 *
 * A regra é determinística e conservadora: só poda quando quase todos os
 * autores seguem o padrão `/^user\d+$/i` (mínimo de 5 reviews para decidir).
 * A entry demo de primeiro acesso (`demo:` prefix) NUNCA é podada. Runs são
 * idempotentes — varre a cada boot e só escreve quando acha algo; cada
 * remoção é registrada no activityStore com a razão (nada some em silêncio).
 */
import { listDataset, removeDataset, type DatasetEntry } from "@/lib/datasetStore";
import { logActivity } from "@/lib/activityStore";

const SYNTHETIC_AUTHOR_RE = /^user\d+$/i;
const MIN_REVIEWS_TO_DECIDE = 5;
const SYNTHETIC_RATIO = 0.7;

export interface SyntheticHit {
  store: string;
  id: string;
  appName: string;
  reviewCount: number;
  reason: string;
}

/** True quando a entry é claramente sintética de geração automática. */
export function isSyntheticEntry(entry: DatasetEntry): boolean {
  if (entry.app.id.startsWith("demo:")) return false; // primeiro acesso demo
  if (entry.reviews.length < MIN_REVIEWS_TO_DECIDE) return false;
  const generic = entry.reviews.filter((r) => SYNTHETIC_AUTHOR_RE.test(r.author)).length;
  return generic / entry.reviews.length >= SYNTHETIC_RATIO;
}

/** Lista entries sintéticas presentes do dataset com a razão do descarte. */
export function findSyntheticEntries(entries: DatasetEntry[]): SyntheticHit[] {
  return entries.filter(isSyntheticEntry).map((e) => ({
    store: e.app.store,
    id: e.app.id,
    appName: e.app.name,
    reviewCount: e.reviews.length,
    reason:
      `autores genéricos ("UserN") em ${Math.round((e.reviews.filter((r) => SYNTHETIC_AUTHOR_RE.test(r.author)).length / e.reviews.length) * 100)}% das reviews`,
  }));
}

/** Podado silenciosamente ao boot — retorna as removidas (também logadas). */
export function runDatasetHygiene(): SyntheticHit[] {
  const hits = findSyntheticEntries(listDataset());
  for (const hit of hits) {
    removeDataset(hit.store, hit.id);
    logActivity(
      "dataset-hygiene",
      "skip",
      `Dataset higienizado: "${hit.appName}" removido (dados sintéticos de teste)`,
      hit.reason,
    );
  }
  return hits;
}
