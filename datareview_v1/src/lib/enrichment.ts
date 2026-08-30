/**
 * Enrichment determinístico de reviews/completude de AppInfo (sem IA).
 *
 * Injetado na coleta (`collectApp`) e usado pela página Pipeline de dados e
 * pela IA: adiciona campos derivados que TODOS consomem:
 *  - sentiment: "positive" | "neutral" | "negative" (regra: ★4-5 pos, ★3 nei, ★1-2 neg)
 *  - wordCount, charCount: tamanho útil do review
 *  - emojiFlag/capsFlag/linkFlag/questionFlag: sinais leves de qualidade
 *  - qualityBand: "rich" | "medium" | "poor" (quanto em texto creamos do review)
 *  - ageDays: idade do review (para análise temporal e inferência de versão)
 *
 * Também computa o índice de completude de AppInfo (`coverage`) para o
 * audit da pipeline de dados (página /pipeline-dados).
 */
import type { AppInfo, ReviewEntry } from "@/lib/appStoreApi";

export type EnrichedReview = ReviewEntry & {
  sentiment: "positive" | "neutral" | "negative";
  wordCount: number;
  charCount: number;
  ageDays: number | undefined;
  flags: {
    emoji: boolean;
    caps: boolean;
    link: boolean;
    question: boolean;
  };
  qualityBand: "rich" | "medium" | "poor";
};

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const LINK_RE = /https?:\/\/|www\./i;

function sentimentOf(rating: number): EnrichedReview["sentiment"] {
  if (rating >= 4) return "positive";
  if (rating === 3) return "neutral";
  return "negative";
}

/** Compute deterministic enrichment fields over a review. */
export function enrichReview(r: ReviewEntry, now = Date.now()): EnrichedReview {
  const text = r.text || "";
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const chars = text.length;
  const ageDays = r.date
    ? Math.max(0, Math.floor((now - new Date(r.date).getTime()) / 86400000))
    : undefined;
  const caps = /[A-ZÁÉÍÓÚÀÇ]{6,}/.test(text);
  const question = /[?¿]/.test(text);
  const fullText = `${r.title || ""} ${text}`.trim();
  const totalWords = fullText.trim() ? fullText.trim().split(/\s+/).length : 0;
  const qualityBand: EnrichedReview["qualityBand"] =
    totalWords >= 40 ? "rich" : totalWords >= 8 ? "medium" : "poor";
  return {
    ...r,
    sentiment: sentimentOf(r.rating),
    wordCount: totalWords,
    charCount: chars,
    ageDays: Number.isFinite(ageDays) ? ageDays : undefined,
    flags: {
      emoji: EMOJI_RE.test(fullText),
      caps,
      link: LINK_RE.test(fullText),
      question,
    },
    qualityBand,
  };
}

/** Map over a review list, enriching each entry. */
export function enrichReviews(reviews: ReviewEntry[], now = Date.now()): EnrichedReview[] {
  return reviews.map((r) => enrichReview(r, now));
}

/* ------------------------------------------------------------------ AppInfo */

/** Campos nos quais a completude é medida — uma linha de descrição por campo. */
export const APPFIELD_AUDIT: { key: keyof AppInfo; label: string }[] = [
  { key: "id", label: "ID" },
  { key: "store", label: "Loja" },
  { key: "name", label: "Nome" },
  { key: "icon", label: "Ícone" },
  { key: "developer", label: "Desenvolvedor" },
  { key: "developerId", label: "ID do desenvolvedor" },
  { key: "developerWebsite", label: "Site do dev" },
  { key: "developerEmail", label: "E-mail do dev" },
  { key: "developerAddress", label: "Endereço do dev" },
  { key: "rating", label: "Nota da loja" },
  { key: "ratingCount", label: "Nº de avaliações" },
  { key: "ratingCurrentVersion", label: "Nota (versão atual)" },
  { key: "ratingCountCurrentVersion", label: "Nº (versão atual)" },
  { key: "price", label: "Preço" },
  { key: "currency", label: "Moeda" },
  { key: "genre", label: "Gênero" },
  { key: "genres", label: "Gêneros" },
  { key: "genreIds", label: "Ids de gênero" },
  { key: "description", label: "Descrição" },
  { key: "summary", label: "Resumo curto" },
  { key: "version", label: "Versão" },
  { key: "releaseDate", label: "Lançamento" },
  { key: "currentVersionReleaseDate", label: "Data da versão atual" },
  { key: "lastUpdated", label: "Última atualização" },
  { key: "releaseNotes", label: "Release notes" },
  { key: "recentChanges", label: "Mudanças recentes" },
  { key: "size", label: "Tamanho" },
  { key: "minimumOsVersion", label: "SO mínimo" },
  { key: "contentRating", label: "Classificação" },
  { key: "trackContentRating", label: "Classificação (texto)" },
  { key: "downloads", label: "Downloads" },
  { key: "minInstalls", label: "Mín. instalações" },
  { key: "maxInstalls", label: "Máx. instalações" },
  { key: "reviewsCount", label: "Reviews na loja" },
  { key: "comments", label: "Comentários" },
  { key: "sellerName", label: "Vendedor" },
  { key: "bundleId", label: "Bundle ID" },
  { key: "languages", label: "Idiomas" },
  { key: "supportedDevices", label: "Dispositivos" },
  { key: "advisories", label: "Avisos" },
  { key: "features", label: "Recursos" },
  { key: "primaryGenreId", label: "Id de gênero primário" },
  { key: "privacyPolicy", label: "Privacidade" },
  { key: "screenshots", label: "Screenshots" },
  { key: "ipadScreenshots", label: "Screenshots iPad" },
  { key: "appletvAppScreenshots", label: "Screenshots Apple TV" },
  { key: "headerImage", label: "Imagem cabeçalho" },
  { key: "video", label: "Vídeo" },
  { key: "editorsChoice", label: "Escolha editores" },
  { key: "adSupported", label: "Com anúncios" },
  { key: "offersIAP", label: "Compras no app" },
  { key: "containsAds", label: "Anúncios" },
  { key: "histogram", label: "Histograma de notas" },
  { key: "url", label: "URL" },
];

function hasValue(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "number") return true;
  if (typeof v === "boolean") return true;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v).length > 0;
  return true;
}

/** One field entry: key, label, present or not. */
export interface FieldPresence {
  key: string;
  label: string;
  present: boolean;
}

/**
 * Computa quais campos de AppInfo estão presentes (preenchidos) vs ausentes num app.
 * Usado pela UI de auditoria do pipeline.
 */
export function appCoverage(app: AppInfo): { present: FieldPresence[]; missing: FieldPresence[]; score: number } {
  const present: FieldPresence[] = [];
  const missing: FieldPresence[] = [];
  for (const f of APPFIELD_AUDIT) {
    const e = { key: f.key as string, label: f.label, present: hasValue(app[f.key]) };
    (e.present ? present : missing).push(e);
  }
  const score = Math.round((present.length / APPFIELD_AUDIT.length) * 100);
  return { present, missing, score };
}

/** Overall dataset coverage ratio (kept for the audit header). */
export function datasetCoverage(entries: { app: AppInfo }[]): number {
  if (entries.length === 0) return 0;
  const total = entries.reduce((s, e) => s + appCoverage(e.app).score, 0);
  return Math.round(total / entries.length);
}
