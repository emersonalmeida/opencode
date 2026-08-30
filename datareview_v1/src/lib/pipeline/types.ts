/**
 * Pipeline — Motor de Conhecimento (pipeline analítico recursivo).
 *
 * Modelo do briefing:
 *
 *   DATASET BRUTO → PIPELINE DETERMINÍSTICO (facts/features)
 *     → IA #1 EXTRAÇÃO (tópicos, sentimento por tópico)
 *       → IA #2 RACIOCÍNIO (cruzamento, hipóteses, causa-raiz)
 *         → IA #3 ESTRATÉGIA (produto, oportunidades, ações)
 *           → VALOR / DECISÕES
 *
 * O fluxo NÃO é linear: cada etapa produz artefatos que viram entrada das
 * próximas (grafo de conhecimento), e a IA pode pedir novas análises
 * (`next_analysis`) que o orquestrador executa — o loop de descoberta.
 *
 * Princípio central: separar FATO CALCULADO (determinístico, auditável) de
 * INTERPRETAÇÃO GERADA POR IA, e deixar ambos alimentarem o próximo estágio.
 * Tudo é armazenado como artefato com lineage (de onde cada insight veio).
 */
import type { LucideIcon } from "lucide-react";
import {
  Database, Calculator, ScanSearch, BrainCircuit, Rocket,
} from "lucide-react";
import type { Anomaly } from "./anomalies";

/** Estágios do pipeline (os "tipos de nó" do briefing). */
export type PipelineStage =
  | "data"      // ① DATA — dados brutos (dataset coletado)
  | "compute"   // ② COMPUTE — determinístico: estatística, agregações, anomalias
  | "extract"   // ③ AI EXTRAÇÃO — classificação, temas, sentimento
  | "reason"    // ④ REASONING — cruzamento, investigação, hipóteses
  | "strategy"; // ⑤ ACTION — produto, estratégia, recomendações

export interface StageMeta {
  label: string;
  short: string;
  description: string;
  icon: LucideIcon;
  /** classes tailwind para badge/borda do estágio */
  color: string;
  textColor: string;
}

export const STAGE_ORDER: PipelineStage[] = ["data", "compute", "extract", "reason", "strategy"];

export const STAGE_META: Record<PipelineStage, StageMeta> = {
  data: {
    label: "Dataset bruto",
    short: "Dados",
    description: "Apps e reviews coletados das lojas — a matéria-prima.",
    icon: Database,
    color: "bg-slate-500/10 border-slate-500/30",
    textColor: "text-slate-500",
  },
  compute: {
    label: "Fatos & features",
    short: "Fatos",
    description: "Estatística, agregações, distribuições, anomalias — 100% determinístico, sem IA.",
    icon: Calculator,
    color: "bg-sky-500/10 border-sky-500/30",
    textColor: "text-sky-500",
  },
  extract: {
    label: "Dados derivados de IA",
    short: "Extração IA",
    description: "Classificação, temas, sentimento por tópico — interpretação estruturada.",
    icon: ScanSearch,
    color: "bg-violet-500/10 border-violet-500/30",
    textColor: "text-violet-500",
  },
  reason: {
    label: "Descobertas & hipóteses",
    short: "Raciocínio",
    description: "Cruzamento de fatos × temas, investigação, causalidade candidata.",
    icon: BrainCircuit,
    color: "bg-amber-500/10 border-amber-500/30",
    textColor: "text-amber-500",
  },
  strategy: {
    label: "Valor & decisões",
    short: "Estratégia",
    description: "Oportunidades, produto, ações priorizadas — inteligência virando decisão.",
    icon: Rocket,
    color: "bg-emerald-500/10 border-emerald-500/30",
    textColor: "text-emerald-500",
  },
};

/** Tipo de artefato produzido por cada análise. */
export type ArtifactKind =
  | "facts"        // bundle de fatos determinísticos
  | "anomaly"      // anomalias detectadas deterministicamente
  | "topics"       // extração de temas (IA)
  | "sentiment"    // sentimento por tópico (IA)
  | "problems"     // cluster de problemas (IA)
  | "requests"     // pedidos dos usuários (IA)
  | "finding"      // descoberta de raciocínio (IA)
  | "hypothesis"   // hipótese causal candidata (IA)
  | "decision"     // oportunidade/ação (IA)
  | "report";      // relatório consolidado (IA)

export const KIND_LABEL: Record<ArtifactKind, string> = {
  facts: "Fatos",
  anomaly: "Anomalias",
  topics: "Temas",
  sentiment: "Sentimento/tema",
  problems: "Problemas",
  requests: "Pedidos",
  finding: "Descoberta",
  hypothesis: "Hipótese",
  decision: "Decisão",
  report: "Relatório",
};

export type Confidence = "alta" | "média" | "baixa";

/** Finding estruturado extraído do output da IA (loop de descoberta). */
export interface AIFinding {
  title: string;
  confidence: number; // 0..1
  evidence?: string;
}

/** Pedido de nova análise emitido pela IA — alimenta o loop de descoberta. */
export interface NextAnalysisRequest {
  /** id da análise do catálogo (ex.: "version-impact") ou tipo livre. */
  type: string;
  rationale?: string;
  parameters?: Record<string, unknown>;
}

/**
 * Artefato — a unidade de conhecimento do pipeline. Cada etapa gera um
 * artefato que registra de onde veio (lineage) e o que produziu.
 */
export interface PipelineArtifact {
  id: string;
  kind: ArtifactKind;
  stage: PipelineStage;
  title: string;
  /** Como foi produzido: "deterministic:anomaly-scan" ou "ai:topic-extraction". */
  methodology: string;
  engine: "deterministic" | "ai";
  /** Modelo de IA usado (quando engine=ai). */
  model?: string;
  /** Ids dos artefatos consumidos como entrada (lineage / data lineage). */
  inputIds: string[];
  /** App keys no escopo (`${store}:${id}`). */
  appKeys: string[];
  /** Payload estruturado (fatos, anomalias, findings, nextAnalysis…). */
  data?: {
    anomalies?: Anomaly[];
    findings?: AIFinding[];
    nextAnalysis?: NextAnalysisRequest | null;
    facts?: unknown;
    [k: string]: unknown;
  };
  /** Saída legível (markdown) — para artefatos de IA e resumos determinísticos. */
  markdown?: string;
  confidence?: Confidence;
  createdAt: number;
}
