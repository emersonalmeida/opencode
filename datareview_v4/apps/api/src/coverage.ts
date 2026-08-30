/**
 * Matriz de cobertura por fonte — o que o código REAL porta (v4),
 * o que o legado v1 tinha (perdido na migração) e o que a API oficial
 * ainda permite (potencial não usado). Fonte de verdade: `ADAPTERS`
 * (não o catálogo) — o catálogo pode declarar 'implemented' enquanto o
 * coletor correspondente não existe; aqui expomos essa divergência.
 *
 * coverageScore = ações v4 / (v4 + v1-perdidas + api-potencial).
 */
import { SOURCE_CATALOG, type SourceCatalogEntry } from "@v4/sources";
import { ADAPTERS } from "./adapters/index.js";

export type CoverageTier = "v4" | "v1" | "api";

export interface SourceAction {
  tier: CoverageTier;
  action: string;
  detail: string;
}

export interface SourceCoverage extends SourceCatalogEntry {
  /** true = existe coletor SourcePort registrado (buildAdapter sucede). */
  ported: boolean;
  /** Ações/capacidades efetivamente implementadas no código v4. */
  v4Actions: string[];
  /** Capacidades existentes no legado v1 (rotas/adapters) ainda perdidas. */
  v1Actions: string[];
  /** Capacidades oficiais da API ainda não usadas pelo coletor atual. */
  apiActions: string[];
  /** 0..1 — fração das capacidades relevantes que estão portadas. */
  coverageScore: number;
}

const V1_LOST: Record<string, string[]> = {
  suggest: ["expand-seeds", "verticals", "clients"],
  trends: ["gprop"],
  serp: ["content"],
  youtube: ["comments-multipage"],
  reddit: ["comments", "user-about"],
  hackernews: ["firebase-listings", "author-profiles", "numeric-filters"],
  github: ["readme", "commits", "releases", "stars-qualifier", "language-qualifier"],
  semanticscholar: ["tldr", "fields-of-study", "open-access-pdf", "citation-graph"],
  arxiv: ["ti-au-cat-qualifiers", "date-range", "id-list-batch"],
  stackexchange: ["tagged-filter", "accepted-filter", "date-filter", "comments", "user-reputation"],
  gdelt: ["timeline-vol", "timeline-tone", "image-collage", "tone-theme-near-operators"],
  openalex: ["open-access-filter", "concepts", "topics", "authors", "institutions"],
  crossref: ["query-bibliographic", "query-author", "doi-exact", "type-date-filter"],
  doaj: ["pagination", "journals-entity", "year-license-filter"],
  wikipedia: ["categories", "infobox", "pageimages", "exintro"],
  wikidata: ["wbgetclaims", "sparql", "lang-config"],
  openlibrary: ["field-search", "works-editions", "online-reader"],
  npm: ["author-qualifier", "not-deprecated", "version-history", "dependency-graph"],
  pypi: ["search-scrape", "release-history-not-mapped", "pypistats-downloads"],
  rubygems: ["versions", "dependencies", "author-search"],
  cratesio: ["recent-downloads", "official-sort", "reverse-dependencies", "versions"],
  openfoodfacts: ["barcode-lookup", "nutriments-full", "nutriscore-facet", "ingredients-allergens"],
  archive: ["mediatype-filter", "fulltext-search", "item-metadata-full", "wayback"],
  tvmaze: ["episodes", "cast", "schedule", "people-search"],
  producthunt: ["graphql-votes", "graphql-comments", "graphql-topics", "cursor-pagination"],
  mastodon: ["instance-config", "v2-search-fulltext", "local-federated-timeline", "trends"],
  bluesky: ["search-filters", "get-post-thread", "firehose"],
  lobsters: ["hot-test-newest-global", "story-comments"],
  devto: ["forem-top-latest-rising", "username", "date-range", "article-comments"],
  stackoverflow_site: [],
  "suggest-provider": ["naver-extra", "amazon-ebay", "wikipedia-lang"],
  itchio: ["price-filter", "tag-filter"],
  steam: ["reviews"],
  deezer: ["chart"],
  apple: ["ssr-multi-country-sweep"],
  googleplay: ["reviews-multisort", "install-range", "rating-histogram", "developer-response"],
};

const API_AVAILABLE: Record<string, string[]> = {
  youtube: ["data-api-v3-search", "data-api-comments", "data-api-captions", "data-api-channels", "data-api-playlists"],
  reddit: ["oauth-search", "oauth-subreddit", "oauth-user", "oauth-comments"],
  github: ["search-advanced", "contents-readme", "commits", "releases", "topics-graphql"],
  producthunt: ["graphql-search", "graphql-collections", "graphql-topics"],
  mastodon: ["public-timeline", "v2-search-token", "trends-api", "instance-peers"],
  bluesky: ["search-filters", "get-post-thread", "firehose"],
  semanticscholar: ["paper-references", "paper-citations", "bulk-search", "tldr-endpoint"],
  openalex: ["works-filter", "concepts", "institutions", "authors", "sources"],
  crossref: ["works-by-doi", "funders", "members", "prefixes"],
  arxiv: ["by-id-list", "by-category", "date-range"],
  gdelt: ["doc-api", "timeline-api", "image-collage"],
  hackernews: ["firebase-top", "firebase-new", "firebase-best", "firebase-ask", "firebase-show", "firebase-job", "user-profiles"],
  stackexchange: ["search-advanced", "answers", "comments", "users", "tags"],
  wikipedia: ["opensearch", "geosearch", "categorymembers", "pageviews"],
  wikidata: ["wbsearchentities", "wbgetclaims", "sparql"],
  openlibrary: ["search", "works", "books", "authors", "editions", "subjects"],
  npm: ["registry-search", "downloads-api", "packuments"],
  pypi: ["json-api", "xmlrpc-deprecated", "simple-index"],
  rubygems: ["search-api", "versions-api", "dependencies-api"],
  cratesio: ["search-api", "downloads-api", "reverse-deps-api"],
  doaj: ["articles-search", "journals-search", "pagination"],
  archive: ["advancedsearch", "metadata-api", "fulltext-search", "wayback-cdx"],
  tvmaze: ["shows", "episodes", "schedule", "people", "lookup"],
  openfoodfacts: ["search", "product-by-barcode", "facets", "nutriments"],
  googlenews: ["rss-search", "rss-top", "rss-topic"],
  deezer: ["search", "chart", "artist", "album", "track"],
  steam: ["storesearch", "appdetails", "appreviews", "featuredcategories"],
  apple: ["itunes-search", "itunes-lookup", "rss-reviews", "amp-api-reviews"],
  googleplay: ["play-search", "play-details", "play-reviews"],
};

/** Lista agregada de cobertura (todas as fontes, ordenada por score crescente). */
export function coverageReport(): SourceCoverage[] {
  return SOURCE_CATALOG
    .map(computeSourceCoverage)
    .sort((a, b) => a.coverageScore - b.coverageScore || a.id.localeCompare(b.id));
}

function relevantCapabilities(entry: SourceCatalogEntry): string[] {
  // Capacidades relevantes = declaradas no catálogo (fonte de intenção).
  return entry.capabilities;
}

export function computeSourceCoverage(entry: SourceCatalogEntry): SourceCoverage {
  const factory = ADAPTERS[entry.id];
  const ported = Boolean(factory);
  // Instancia a factory sem chaves apenas para ler as capabilities declaradas
  // (o `defineAdapter` espalha o meta no objeto; construção não toca keys).)
  let v4Actions: string[] = [];
  if (factory) {
    try {
      v4Actions = factory({} as never).capabilities ?? [];
    } catch {
      v4Actions = [];
    }
  }
  const v1Actions = V1_LOST[entry.id] ?? [];
  const apiActions = API_AVAILABLE[entry.id] ?? [];
  const relevant = relevantCapabilities(entry);
  const known = Math.max(relevant.length, v1Actions.length + apiActions.length + v4Actions.length);
  const base = known === 0 ? 1 : known;
  const coverageScore = base === 1 ? 1 : ported ? v4Actions.length / base : 0;
  return { ...entry, ported, v4Actions, v1Actions, apiActions, coverageScore };
}