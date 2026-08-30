/**
 * Núcleo puro — só ports + pipeline + derivação. Zero deps de I/O/HTTP/React.
 *
 * Consumidores (adaptadores, API, front) importam daqui; o núcleo nunca
 * importa deles — dependência invertida (hexagonal).
 */
export type {
  AIPort,
  DerivePort,
  DatasetStats,
  SourcePort,
  StoragePort,
} from "./ports/index.js";

export type {
  CollectRun,
  AnalyzeRun,
  PipelineDeps,
} from "./pipeline/index.js";
export { deriveFromDataset, runPipeline, runSource } from "./pipeline/index.js";
export { derive, normalizeText } from "./pipeline/derive.js";
export { stableId } from "./pipeline/stableId.js";