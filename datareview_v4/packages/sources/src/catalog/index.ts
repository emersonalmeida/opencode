export type {
  SourceCatalogEntry,
  SourceAuth,
  SourceGroup,
  SourceMethod,
  SourceStatus,
} from "./types.js";
export { toSourceDescriptor } from "./types.js";
export {
  SOURCE_CATALOG,
  catalogByGroup,
  catalogCount,
  getSourceCatalogEntry,
  listSourceCatalog,
} from "./registry.js";
export type { SourceCapability } from "@v4/contracts"; // re-export pragmático p/ testes/consumidores