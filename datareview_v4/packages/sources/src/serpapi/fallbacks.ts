import type { SourceCapability } from "@v4/contracts";

/**
 * Mapeamento fonte→produto SerpAPI — fallbacks aprovados no ADR-0002.
 *
 * So implementamos os fallbacks das fontes que JA temos (o catalogo SerpAPI
 * tem dezenas de produtos; aqui so os pares auditados e aprovados).
 */
export interface SerpApiFallback {
  /** Produto SerpAPI (ex.: google_search, google_news). */
  engine: string;
  /** Capacidades da fonte original (mantidas na proveniencia.. */
  capabilities: SourceCapability[];
}

export const SERPAPI_FALLBACKS: Readonly<Record<string, SerpApiFallback>> = {
  suggest: { engine: "google_autocomplete", capabilities: ["trends"] },
  trends: { engine: "google_trends", capabilities: ["trends"] },
  serp: { engine: "google_search", capabilities: ["search"] },
  youtube: { engine: "youtube_search", capabilities: ["media", "search"] },
  reddit: { engine: "google_search", capabilities: ["social"] },
  apple: { engine: "apple_app_store", capabilities: ["search"] },
  googleplay: { engine: "google_search", capabilities: ["search"] },
  gdelt: { engine: "google_news", capabilities: ["news"] },
  googlenews: { engine: "google_news", capabilities: ["news"] },
  wikipedia: { engine: "google_search", capabilities: ["search"] },
  mastodon: { engine: "google_search", capabilities: ["social"] },
  bluesky: { engine: "google_search", capabilities: ["social"] },
  hackernews: { engine: "google_search", capabilities: ["social"] },
  arxiv: { engine: "google_scholar", capabilities: ["academic"] },
  semanticscholar: { engine: "google_scholar", capabilities: ["academic"] },
};