/**
 * auditSources — registry ordenado da AUDITORIA DE FONTES E DADOS.
 *
 * A ordem segue o pedido do usuário: Suggest → Trends → SERP → YouTube →
 * Reddit → Product Hunt → demais fontes agrupadas por afinidade (lojas,
 * social/dev, acadêmicas, conhecimento, pacotes, notícias, mídia, local,
 * genéricas). Cada fonte começa como stub "pending" e é promovida a
 * auditoria completa (status "audited") em pedaços incrementais.
 */
import type { AuditSource } from "./auditModel";
import { SUGGEST_AUDIT } from "./sources/suggest";
import { TRENDS_AUDIT } from "./sources/trends";
import { SERP_AUDIT } from "./sources/serp";
import { YOUTUBE_AUDIT } from "./sources/youtube";
import { REDDIT_AUDIT } from "./sources/reddit";
import { PRODUCTHUNT_AUDIT } from "./sources/producthunt";
import { APPLE_AUDIT } from "./sources/apple";
import { GOOGLE_AUDIT } from "./sources/google";
import { STEAM_AUDIT } from "./sources/steam";
import { ITCHIO_AUDIT } from "./sources/itchio";
import { HACKERNEWS_AUDIT } from "./sources/hackernews";
import { MASTODON_AUDIT } from "./sources/mastodon";
import { BLUESKY_AUDIT } from "./sources/bluesky";
import { LOBSTERS_AUDIT, DEVTO_AUDIT } from "./sources/lobstersDevto";
import { STACKEXCHANGE_AUDIT, GITHUB_AUDIT } from "./sources/stackexchangeGithub";
import { ARXIV_AUDIT, SEMANTICSCHOLAR_AUDIT, OPENALEX_AUDIT, CROSSREF_AUDIT, DOAJ_AUDIT } from "./sources/academic";
import { WIKIPEDIA_AUDIT, WIKIDATA_AUDIT, OPENLIBRARY_AUDIT, NPM_AUDIT, PYPI_AUDIT, RUBYGEMS_AUDIT, CRATESIO_AUDIT } from "./sources/knowledgePackages";
import { GDELT_AUDIT, TVMAZE_AUDIT, OPENFOODFACTS_AUDIT, ARCHIVE_AUDIT } from "./sources/media";
import { RECLAMEAQUI_AUDIT, WEB_AUDIT, FEED_AUDIT, PASTE_AUDIT, CUSTOM_AUDIT } from "./sources/extractors";
import {
  WIKITOP_AUDIT, WIKIVIEWS_AUDIT, ONTHISDAY_AUDIT, GOOGLENEWS_AUDIT,
  APPLE_PODCASTS_AUDIT, COINGECKO_AUDIT, STEAMTOP_AUDIT, OPEN_METEO_AUDIT,
  BRASIL_AUDIT, DEEZER_AUDIT, OPENLIBRARY_TRENDING_AUDIT, NPM_DOWNLOADS_AUDIT,
  GITHUB_TRENDING_AUDIT, MASTODON_TRENDS_AUDIT, URL_RESOLVER_AUDIT,
  WHISPER_AUDIT, PIPER_AUDIT,
} from "./sources/discover";

export const AUDIT_SOURCES: AuditSource[] = [
  SUGGEST_AUDIT,
  TRENDS_AUDIT,
  SERP_AUDIT,
  YOUTUBE_AUDIT,
  REDDIT_AUDIT,
  PRODUCTHUNT_AUDIT,
  APPLE_AUDIT,
  GOOGLE_AUDIT,
  STEAM_AUDIT,
  ITCHIO_AUDIT,
  HACKERNEWS_AUDIT,
  MASTODON_AUDIT,
  BLUESKY_AUDIT,
  LOBSTERS_AUDIT,
  DEVTO_AUDIT,
  STACKEXCHANGE_AUDIT,
  GITHUB_AUDIT,
  ARXIV_AUDIT,
  SEMANTICSCHOLAR_AUDIT,
  OPENALEX_AUDIT,
  CROSSREF_AUDIT,
  DOAJ_AUDIT,
  WIKIPEDIA_AUDIT,
  WIKIDATA_AUDIT,
  OPENLIBRARY_AUDIT,
  NPM_AUDIT,
  PYPI_AUDIT,
  RUBYGEMS_AUDIT,
  CRATESIO_AUDIT,
  GDELT_AUDIT,
  TVMAZE_AUDIT,
  OPENFOODFACTS_AUDIT,
  ARCHIVE_AUDIT,
  RECLAMEAQUI_AUDIT,
  WEB_AUDIT,
  FEED_AUDIT,
  PASTE_AUDIT,
  CUSTOM_AUDIT,
  WIKITOP_AUDIT,
  WIKIVIEWS_AUDIT,
  ONTHISDAY_AUDIT,
  GOOGLENEWS_AUDIT,
  APPLE_PODCASTS_AUDIT,
  COINGECKO_AUDIT,
  STEAMTOP_AUDIT,
  OPEN_METEO_AUDIT,
  BRASIL_AUDIT,
  DEEZER_AUDIT,
  OPENLIBRARY_TRENDING_AUDIT,
  NPM_DOWNLOADS_AUDIT,
  GITHUB_TRENDING_AUDIT,
  MASTODON_TRENDS_AUDIT,
  URL_RESOLVER_AUDIT,
  WHISPER_AUDIT,
  PIPER_AUDIT,
];

/** Fontes na ordem da auditoria (já ordenadas por `order`). */
export function auditSourcesOrdered(): AuditSource[] {
  return [...AUDIT_SOURCES].sort((a, b) => a.order - b.order);
}

export function auditSourceById(id: string): AuditSource | undefined {
  return AUDIT_SOURCES.find((s) => s.id === id);
}
