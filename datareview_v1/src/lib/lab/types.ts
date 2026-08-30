/**
 * Tipos do Lab — laboratório de descoberta, experimentação e incubação de
 * produtos. Camada de orquestração sobre as capacidades existentes (dataset,
 * IA, Canvas). Local-first, persistido em namespaces separados.
 *
 * Princípio: Lab NÃO duplica reviews — LabDataset referencia appKeys do dataset
 * principal (`aso:dataset:v1`).
 */

/** Dataset usado num experimento. Referencia apps do dataset principal. */
export type LabDatasetSource = "local-dataset" | "experiment" | "import";

export interface LabDataset {
  id: string;
  name: string;
  description?: string;
  /** Chaves `${store}:${id}` dos apps referenciados no dataset principal. */
  appKeys: string[];
  reviewCount: number;
  source: LabDatasetSource;
  metadata?: {
    stores?: string[];
    countries?: string[];
    dateRange?: { from?: string; to?: string };
  };
  createdAt: string;
  updatedAt: string;
}

export type ExperimentType = "data" | "intelligence" | "product" | "business";

export type ExperimentStatus =
  | "draft"
  | "running"
  | "completed"
  | "iterate"
  | "promote"
  | "rejected"
  | "archived";

export interface ExperimentAIPipeline {
  /** Referência a um grafo salvo no canvasStore (aso:canvas:v1). */
  canvasId?: string;
  nodes?: unknown[];
}

export interface ExperimentAIConfig {
  provider?: string;
  model?: string;
  temperature?: number;
  promptVersion?: string;
}

export interface ExperimentProvenance {
  /** Chaves de LabDataset usadas. */
  datasetIds: string[];
  /** Snapshot dos appKeys no momento da execução (rastreabilidade). */
  appKeys: string[];
  collectedAt?: string;
  collectorVersion?: string;
  /** AI config snapshot (model + provider + prompt version). */
  ai: ExperimentAIConfig;
  parameters?: Record<string, number | string | boolean>;
  executedAt?: string;
}

export interface LabExperiment {
  id: string;
  name: string;
  description?: string;
  type: ExperimentType;
  hypothesis?: string;
  question?: string;
  /** Chaves de LabDataset. */
  datasetIds: string[];
  pipeline?: ExperimentAIPipeline;
  aiConfig?: ExperimentAIConfig;
  status: ExperimentStatus;
  /** IDs de LabFinding produzidos. */
  findings: string[];
  metrics?: Record<string, number | string>;
  /** Resultado textual (markdown) da última execução. */
  result?: string;
  /** Resultado estruturado (JSON) quando disponível. */
  structuredResult?: ExperimentStructuredResult;
  conclusion?: string;
  provenance?: ExperimentProvenance;
  createdAt: string;
  updatedAt: string;
}

/** Resultado estruturado retornado pela IA (quando solicitado). */
export interface ExperimentStructuredResult {
  summary?: string;
  observed?: string[];
  inferred?: string[];
  estimated?: string[];
  metrics?: Record<string, number | string>;
  findings?: StructuredFinding[];
}

/** Finding gerado pela IA em forma estruturada (antes de validação). */
export interface StructuredFinding {
  title: string;
  description: string;
  type?: LabFindingType;
  evidence?: StructuredEvidence[];
  confidence?: number;
}

/** Evidência estruturada — referência a um review do dataset. */
export interface StructuredEvidence {
  reviewId?: string;
  appKey?: string;
  quote?: string;
  rating?: number;
}

export type LabFindingType =
  | "observation"
  | "insight"
  | "evidence"
  | "hypothesis"
  | "opportunity";

export type LabFindingStatus = "new" | "validated" | "uncertain" | "rejected";

export interface LabFindingEvidence {
  reviewIds?: string[];
  appKeys?: string[];
  quotes?: string[];
  metrics?: Record<string, number | string>;
  sources?: string[];
  /** Resultado da validação de evidência (review existe? quote bate?). */
  validation?: EvidenceValidation;
}

export interface EvidenceValidation {
  status: "valid" | "failed" | "unverified";
  checkedAt?: string;
  issues?: string[];
}

export interface LabFinding {
  id: string;
  title: string;
  description: string;
  experimentId: string;
  type: LabFindingType;
  confidence?: number;
  evidence?: LabFindingEvidence;
  status: LabFindingStatus;
  createdAt: string;
}

export type ProductStatus =
  | "idea"
  | "validating"
  | "prototype"
  | "business-test"
  | "promoted"
  | "rejected"
  | "archived";

export interface ProductScores {
  demand?: number;
  pain?: number;
  competitiveGap?: number;
  dataAvailability?: number;
  technicalFeasibility?: number;
  willingnessToPay?: number;
}

export interface ProductCandidate {
  id: string;
  name: string;
  vertical?: string;
  problem: string;
  targetUser?: string;
  hypothesis?: string;
  evidence: {
    experimentIds: string[];
    findingIds: string[];
    datasetIds: string[];
  };
  validatedFeatures?: string[];
  experimentalFeatures?: string[];
  opportunityScore?: number;
  scores?: ProductScores;
  status: ProductStatus;
  notes?: string;
  promotedAt?: string;
  createdAt: string;
  updatedAt: string;
}
