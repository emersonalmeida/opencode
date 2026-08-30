/**
 * Cliente da busca semântica de reviews (POST /functions/v1/embed-search).
 * Usa o modelo de embeddings local (ex.: nomic-embed-text) detectado no
 * perfil de hardware — nada sai da máquina.
 */
import { getAISettings } from "@/lib/aiSettings";
import { apiUrl } from "@/lib/apiBase";

export interface EmbedSearchHit {
  /** Índice do review no array enviado. */
  index: number;
  /** Similaridade de cosseno (0–1, arredondada a 3 casas). */
  score: number;
}

export interface EmbedSearchResult {
  ok: boolean;
  hits: EmbedSearchHit[];
  searched: number;
  model: string;
  error?: string;
}

const SUPA_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export async function semanticSearchReviews(
  query: string,
  reviews: { rating?: number; title?: string; text?: string }[],
  topK = 30,
  signal?: AbortSignal,
): Promise<EmbedSearchResult> {
  try {
    const resp = await fetch(apiUrl("/functions/v1/embed-search"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPA_KEY}` },
      body: JSON.stringify({ query, reviews, topK, ai: getAISettings() }),
      signal,
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return { ok: false, hits: [], searched: 0, model: "", error: (data.error as string) || `Erro ${resp.status}` };
    }
    return {
      ok: true,
      hits: (data.results as EmbedSearchHit[]) ?? [],
      searched: (data.searched as number) ?? reviews.length,
      model: (data.model as string) ?? "",
    };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return { ok: false, hits: [], searched: 0, model: "", error: "cancelado" };
    }
    return { ok: false, hits: [], searched: 0, model: "", error: e instanceof Error ? e.message : "Falha de conexão" };
  }
}
