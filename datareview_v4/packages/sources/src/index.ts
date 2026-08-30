export {
  SOURCE_CATALOG,
  catalogByGroup,
  catalogCount,
  getSourceCatalogEntry,
  listSourceCatalog,
  toSourceDescriptor,
} from "./catalog/index.js";
export type {
  SourceCatalogEntry,
  SourceAuth,
  SourceGroup,
  SourceMethod,
  SourceStatus,
} from "./catalog/index.js";

export { SERPAPI_FALLBACKS } from "./serpapi/fallbacks.js";
export type { SerpApiFallback } from "./serpapi/fallbacks.js";
export {
  SerpApiSource,
  fallbackEngineFor,
  fallbackCapabilities,
  fallbackMarker,
} from "./serpapi/serpapi.js";
export type { SerpApiOptions } from "./serpapi/serpapi.js";
export { normalizeSerpApiResults, serpApiItemKind } from "./serpapi/normalize.js";
export type {
  SerpApiQuotaStore,
  SerpApiQuotaStoreOptions,
} from "./serpapi/quota.js";
export { AUDIT_REGISTRY, auditSourceById } from "./audit/registry.js";
export { sourceStats, categoryCounts } from "./audit/stats.js";
export type { AuditEntry, AuditStatus } from "./audit/types.js";
export type { AuditStats } from "./audit/stats.js";

export {
  VERTICALS,
  REGIONS,
  LANGS,
  CLIENTS,
  MAX_SEEDS,
  EXPANSION_GROUPS,
  suggestionTokens,
  buildSeeds,
  mergeObservations,
} from "./suggest/core.js";
export type {
  SuggestVertical,
  SeedPosition,
  SuggestSeed,
  RawSuggestItem,
  SuggestRow,
  GatherObservation,
} from "./suggest/core.js";
export {
  SUGGEST_PROVIDERS,
  getSuggestProvider,
  SUGGEST_PROVIDER_GROUPS,
  listSuggestProviderIds,
} from "./suggest/providers.js";
export type {
  SuggestProvider,
  SuggestProviderItem,
  SuggestProviderParams,
} from "./suggest/providers.js";
export { fetchSuggestProvider, listSuggestProviders } from "./suggest/providersApi.js";
export type { SuggestProviderResult } from "./suggest/providersApi.js";
export { runGather, runAlternativeProvider } from "./suggest/api.js";
export type {
  SuggestClient,
  GatherCombo,
  GatherParams,
  GatherProgress,
  GatherResult,
} from "./suggest/api.js";