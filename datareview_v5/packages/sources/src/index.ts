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
export {
  AUTH_PRIORITY,
  computeEnabledSources,
  countEnabled,
  enabledSourceIds,
  isPublic,
  compareEnabledThenAuth,
} from "./activation.js";
export type { ActivationOverrides } from "./activation.js";