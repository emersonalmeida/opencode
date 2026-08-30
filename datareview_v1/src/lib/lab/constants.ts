/**
 * Constantes visuais do Lab — labels, cores e badges para tipos/status.
 * Centraliza a apresentação dos estados do pipeline de descoberta.
 */

import {
  FlaskConical, BrainCircuit, Layout, TrendingUp,
  Pencil, Loader2, CheckCircle2, RefreshCw, ArrowUpCircle,
  XCircle, Archive, Beaker,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  ExperimentType,
  ExperimentStatus,
  LabFindingType,
  LabFindingStatus,
  ProductStatus,
} from "./types";

export const EXPERIMENT_TYPES: Record<
  ExperimentType,
  { label: string; icon: LucideIcon; color: string; desc: string }
> = {
  data: {
    label: "Data",
    icon: Beaker,
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    desc: "Testa a qualidade/viabilidade da coleta ou dataset.",
  },
  intelligence: {
    label: "Intelligence",
    icon: BrainCircuit,
    color: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
    desc: "Testa uma hipótese analítica sobre os reviews.",
  },
  product: {
    label: "Product",
    icon: Layout,
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    desc: "Testa um workflow ou experiência de produto.",
  },
  business: {
    label: "Business",
    icon: TrendingUp,
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    desc: "Testa uma oportunidade comercial / nicho.",
  },
};

export const EXPERIMENT_STATUS: Record<
  ExperimentStatus,
  { label: string; icon: LucideIcon; color: string; dot: string }
> = {
  draft: { label: "Rascunho", icon: Pencil, color: "text-muted-foreground", dot: "bg-muted-foreground/40" },
  running: { label: "Executando", icon: Loader2, color: "text-blue-500", dot: "bg-blue-500 animate-pulse" },
  completed: { label: "Concluído", icon: CheckCircle2, color: "text-emerald-500", dot: "bg-emerald-500" },
  iterate: { label: "Iterar", icon: RefreshCw, color: "text-amber-500", dot: "bg-amber-500" },
  promote: { label: "Promovido", icon: ArrowUpCircle, color: "text-violet-500", dot: "bg-violet-500" },
  rejected: { label: "Rejeitado", icon: XCircle, color: "text-destructive", dot: "bg-destructive" },
  archived: { label: "Arquivado", icon: Archive, color: "text-muted-foreground", dot: "bg-muted-foreground/30" },
};

export const FINDING_TYPES: Record<
  LabFindingType,
  { label: string; color: string }
> = {
  observation: { label: "Observação", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  insight: { label: "Insight", color: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20" },
  evidence: { label: "Evidência", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  hypothesis: { label: "Hipótese", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  opportunity: { label: "Oportunidade", color: "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20" },
};

export const FINDING_STATUS: Record<
  LabFindingStatus,
  { label: string; color: string }
> = {
  new: { label: "Nova", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  validated: { label: "Validada", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  uncertain: { label: "Incerta", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  rejected: { label: "Rejeitada", color: "bg-destructive/10 text-destructive border-destructive/20" },
};

export const PRODUCT_STATUS: Record<
  ProductStatus,
  { label: string; color: string; dot: string }
> = {
  idea: { label: "Ideia", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20", dot: "bg-blue-500" },
  validating: { label: "Validando", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20", dot: "bg-amber-500" },
  prototype: { label: "Protótipo", color: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20", dot: "bg-violet-500" },
  "business-test": { label: "Teste de negócio", color: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20", dot: "bg-orange-500" },
  promoted: { label: "Promovido", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20", dot: "bg-emerald-500" },
  rejected: { label: "Rejeitado", color: "bg-destructive/10 text-destructive border-destructive/20", dot: "bg-destructive" },
  archived: { label: "Arquivado", color: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground/40" },
};

/** Colunas do Discovery Board (Kanban de Product Candidates). */
export const DISCOVERY_COLUMNS: ProductStatus[] = [
  "idea",
  "validating",
  "prototype",
  "business-test",
  "promoted",
];

/** Etapas do pipeline de descoberta (clicáveis na visão geral). */
export const PIPELINE_STAGES = [
  { key: "dataset", label: "Dataset", icon: Beaker },
  { key: "experiment", label: "Experimento", icon: FlaskConical },
  { key: "finding", label: "Finding", icon: BrainCircuit },
  { key: "validation", label: "Validação", icon: CheckCircle2 },
  { key: "product", label: "Produto", icon: ArrowUpCircle },
] as const;
