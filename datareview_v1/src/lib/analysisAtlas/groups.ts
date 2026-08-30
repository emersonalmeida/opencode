/**
 * Groups — metadados visuais dos 10 domínios da árvore DATA LAB (ponto 72).
 * Cada grupo mapeia 1:1 para um ramo da árvore e recebe uma cor de destaque.
 */
import {
  Boxes, MessageSquareText, Clock, Globe2, GitCompare,
  Lightbulb, Crosshair, ShieldCheck, Scale, FileOutput,
  type LucideIcon,
} from "lucide-react";
import type {
  AtlasGroup, GroupMeta, DiscoveryType, ConfidenceLevel, DataSource, ChartViz,
} from "./types";

export const GROUP_META: Record<AtlasGroup, GroupMeta> = {
  app: {
    key: "app", label: "App Analytics", treeLabel: "APP ANALYTICS",
    icon: Boxes, color: "text-sky-500",
    desc: "Profiling, features, positioning, pricing, monetization, segmentação, clustering, competitivo.",
  },
  review: {
    key: "review", label: "Review Analytics", treeLabel: "REVIEW ANALYTICS",
    icon: MessageSquareText, color: "text-rose-500",
    desc: "Sentimento, emoção, tópicos, aspectos, pain, requests, desejos, JTBD, churn, switching, linguagem.",
  },
  temporal: {
    key: "temporal", label: "Temporal", treeLabel: "TEMPORAL",
    icon: Clock, color: "text-amber-500",
    desc: "Trends, velocity, change points, versões, release impact.",
  },
  geo: {
    key: "geo", label: "Geo", treeLabel: "GEO",
    icon: Globe2, color: "text-emerald-500",
    desc: "País, região, idioma, localization.",
  },
  cross: {
    key: "cross", label: "Cross-Data", treeLabel: "CROSS-DATA",
    icon: GitCompare, color: "text-violet-500",
    desc: "Feature gaps, market gaps, white spaces, regressions, emerging demand, oportunidades.",
  },
  intelligence: {
    key: "intelligence", label: "Intelligence", treeLabel: "INTELLIGENCE",
    icon: Lightbulb, color: "text-orange-500",
    desc: "Product, customer, market, competitive, marketing, sales, QA, venture.",
  },
  discovery: {
    key: "discovery", label: "Discovery", treeLabel: "DISCOVERY",
    icon: Crosshair, color: "text-fuchsia-500",
    desc: "Problems, needs, desires, oportunidades, threats, trends, gaps, signals.",
  },
  evidence: {
    key: "evidence", label: "Evidence", treeLabel: "EVIDENCE",
    icon: ShieldCheck, color: "text-teal-500",
    desc: "Sources, citations, calculations, confidence, provenance.",
  },
  decision: {
    key: "decision", label: "Decision", treeLabel: "DECISION",
    icon: Scale, color: "text-indigo-500",
    desc: "RICE, ICE, WSJF, ROI, impact/effort.",
  },
  output: {
    key: "output", label: "Output", treeLabel: "OUTPUT",
    icon: FileOutput, color: "text-cyan-500",
    desc: "Dashboard, report, dataset, opportunity, product idea, market report, API.",
  },
};

/** Ordem canônica dos grupos (igual à árvore do briefing). */
export const GROUP_ORDER: AtlasGroup[] = [
  "app", "review", "temporal", "geo", "cross",
  "intelligence", "discovery", "evidence", "decision", "output",
];

/** Label curto de um discovery type (ponto 71). */
export const DISCOVERY_LABELS: Record<DiscoveryType, string> = {
  problem: "Problema",
  need: "Necessidade",
  desire: "Desejo",
  opportunity: "Oportunidade",
  threat: "Ameaça",
  trend: "Tendência",
  gap: "Gap",
  signal: "Sinal",
  pattern: "Padrão",
};

/** Label curto de um nível de confiança (ponto 70). */
export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  observation: "Observação",
  inference: "Inferência",
  hypothesis: "Hipótese",
  prediction: "Previsão",
};

/** Label curto de uma fonte de dado. */
export const DATASOURCE_LABELS: Record<DataSource, string> = {
  "app-metadata": "Metadados do app",
  reviews: "Reviews",
  "competitor-features": "Features de concorrentes",
  "user-requests": "Requests de usuários",
  pricing: "Preço/monetização",
  versions: "Versões",
  countries: "Países/storefront",
  timeline: "Timeline",
  "store-comparison": "Comparação de lojas",
  helpfulness: "Helpfulness (👍)",
};

/** Label curto de uma visualização. */
export const VIZ_LABELS: Record<ChartViz, string> = {
  bar: "Barras", line: "Linha", area: "Área", pie: "Pizza",
  heatmap: "Heatmap", scatter: "Scatter", network: "Rede", matrix: "Matriz",
  table: "Tabela", markdown: "Markdown", wordcloud: "Nuvem de termos", timeline: "Timeline",
};
