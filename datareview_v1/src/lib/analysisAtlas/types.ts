/**
 * Analysis Atlas — tipos.
 *
 * O Atlas é um catálogo/registry de módulos de análise. Cada módulo declara um
 * CONTRATO explícito (input → processamento → output → evidência → confiança
 * → score → visualização), permitindo que o App Data Review funcione como uma
 * espécie de "Analysis OS" para App Intelligence.
 *
 * O Atlas NÃO reimplementa cada análise — ele descreve a metodologia e, quando
 * possível, aponta para a infraestrutura que a realiza (nó do Canvas, seção de
 * IA da rota experiment-analyze, ou análise determinística do dashboardAnalytics).
 * Módulos marcados como `status: "planned"` são framework declarado (precisam
 * de NLP/embeddings ainda não construídos) — honestidade sobre o estado real,
 * mesmo princípio da página /case.
 */
import type { LucideIcon } from "lucide-react";
import type { NodeKind } from "@/components/canvas/nodeRegistry";

/** Domínios da árvore DATA LAB (ponto 72 do briefing). */
export type AtlasGroup =
  | "app" // APP ANALYTICS
  | "review" // REVIEW ANALYTICS
  | "temporal" // TEMPORAL
  | "geo" // GEO
  | "cross" // CROSS-DATA
  | "intelligence" // INTELLIGENCE
  | "discovery" // DISCOVERY
  | "evidence" // EVIDENCE
  | "decision" // DECISION
  | "output"; // OUTPUT

/** Tipos universais de descoberta (ponto 71). */
export type DiscoveryType =
  | "problem" // bugs, friction, pain, complaints
  | "need" // functional, emotional, contextual
  | "desire" // features, outcomes, experiences
  | "opportunity" // product, market, monetization, retention
  | "threat" // competitor, churn, regression, emerging negative trend
  | "trend" // emerging demand, technology, changing perception
  | "gap" // feature gap, market gap, positioning gap, experience gap
  | "signal" // churn, switching, satisfaction, purchase intent
  | "pattern"; // behavioral, temporal, geographic, semantic

/**
 * Camadas de confiança (ponto 70). Toda descoberta deve declarar em qual nível
 * de abstração opera — separar observação de inferência de hipótese de previsão
 * é fundamental para não tratar estimativas como fatos.
 */
export type ConfidenceLevel =
  | "observation" // "18% dos reviews mencionam login."
  | "inference" // "Login parece ser um problema relevante."
  | "hypothesis" // "Corrigir login pode reduzir churn."
  | "prediction"; // "Pode reduzir churn em X%."

/** Fontes de dado exigidas por um módulo. */
export type DataSource =
  | "app-metadata"
  | "reviews"
  | "competitor-features"
  | "user-requests"
  | "pricing"
  | "versions"
  | "countries"
  | "timeline"
  | "store-comparison"
  | "helpfulness";

/** Visualizações suportadas (ponto 68). */
export type ChartViz =
  | "bar" | "line" | "area" | "pie" | "heatmap" | "scatter"
  | "network" | "matrix" | "table" | "markdown" | "wordcloud" | "timeline";

/** Estado real do módulo — honestidade sobre o que roda hoje. */
export type ModuleStatus =
  /** Roda agora via IA local/cloud (experiment-analyze) ou análise determinística. */
  | "available"
  /** Framework declarado — metodologia definida, mas o motor (NLP/embeddings) ainda não está construído. */
  | "planned";

/** Componente de um score composto (ponto 51 — guardar cada parte separadamente). */
export interface ScoreComponent {
  key: string;
  label: string;
  /** Peso relativo (0..1). Omitir = mesmo peso dos demais. */
  weight?: number;
}

/** Score de oportunidade (ou similar) — NUNCA só o número final. */
export interface ScoreSpec {
  name: string;
  components: ScoreComponent[];
  formula: string;
}

/** Evidência de exemplo (ponto 69 — Claim → Evidence → Source → Calculation → Confidence). */
export interface EvidenceSpec {
  claimExample: string;
  /** Tipo de fonte esperada (review id, métrica agregada, citação). */
  sourceType: string;
  calculationExample?: string;
}

/**
 * Ponte para o Canvas: qual nó + config realiza este módulo num pipeline.
 * Permite "enviar módulo para o Canvas" e combinar módulos em pipelines.
 */
export interface CanvasBridge {
  kind: NodeKind;
  /** Seção de IA (experiment-analyze) quando kind for analyze/report. */
  section?: string;
  /** chartType quando kind for chart. */
  chartType?: string;
  /** Prompt seed quando kind for prompt/report (modo custom). */
  promptSeed?: string;
  /** Label amigável para o nó no canvas. */
  nodeLabel?: string;
}

/** Um módulo de análise — o contrato completo. */
export interface AnalysisModule {
  id: string;
  label: string;
  group: AtlasGroup;
  icon: LucideIcon;
  tagline: string;
  description: string;
  input: DataSource[];
  processing: string[];
  parameters?: string[];
  outputs: DiscoveryType[];
  evidence: EvidenceSpec;
  confidence: ConfidenceLevel;
  score?: ScoreSpec;
  visualization: ChartViz[];
  canvas: CanvasBridge;
  status: ModuleStatus;
  /** Tags livres para busca/filtro. */
  tags?: string[];
}

/** Metadados visuais de um grupo (domínio da árvore). */
export interface GroupMeta {
  key: AtlasGroup;
  label: string;
  /** Rótulo da árvore DATA LAB (ponto 72). */
  treeLabel: string;
  icon: LucideIcon;
  desc: string;
  /** Cor de destaque tailwind. */
  color: string;
}
