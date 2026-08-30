/**
 * Agentes de IA — por segmento/perfil, com "pipelinas de trabalho executáveis.
 *
 * Um agente declara WHO ele é (segmento) e WHAT he faz (sequência de etapas).
 * Cada etapa é uma seção do EXPERIMENT_SECTIONS (ex.: problems, opportunities)
 * ou um prompt livre do usuário (agente customizado). O runner executa as
 * etapas em sequência, mostrando status por etapa — nada de caixa-preta.
 *
 * Agentes customizados do usuário ficam em `aso:agents:v1`.
 */

import { ShoppingCart, Paintbrush, Wrench, Megaphone, Headset, Briefcase, Eye, PlusCircle } from "lucide-react";

export interface AgentStep {
  /** id de uma seção do experiment, ou "custom" (usa prompt). */
  section: string;
  label: string;
  /** prompt livre (só para section === "custom" em agentes custom). */
  prompt?: string;
}

export interface GeneratorAgent {
  id: string;
  segment: string;
  label: string;
  /** tagline — a lente do agente. */
  tagline: string;
  description: string;
  icon: typeof ShoppingCart;
  pipeline: AgentStep[];
  builtin: boolean;
  createdAt: number;
}

export const BUILTIN_SEGMENTS = [
  "produto",
  "ux",
  "engenharia",
  "marketing",
  "suporte",
  "executivo",
  "competitivo",
] as const;

export type BuiltinSegment = (typeof BUILTIN_SEGMENTS)[number];

export const BUILTIN_AGENTS: GeneratorAgent[] = [
  {
    id: "seg-produto",
    segment: "produto",
    label: "Produto",
    tagline: "O que construir",
    description: "Pipeline de PM: resumo → problemas → solicitações → oportunidades priorizadas.",
    icon: ShoppingCart,
    pipeline: [
      { section: "summary", label: "Resumo" },
      { section: "problems", label: "Problemas" },
      { section: "requests", label: "Solicitações" },
      { section: "opportunities", label: "Oportunidades" },
    ],
    builtin: true,
    createdAt: 0,
  },
  {
    id: "seg-ux",
    segment: "ux",
    label: "UX / Design",
    tagline: "Como os usuários vivem o produto",
    description: "Padrões qualitativos + pontos de dor de UX + sugestões de melhoria.",
    icon: Paintbrush,
    pipeline: [
      { section: "qualitative", label: "Qualitativo" },
      { section: "problems", label: "Pontos de dor" },
      { section: "suggestions", label: "Sugestões" },
    ],
    builtin: true,
    createdAt: 0,
  },
  {
    id: "seg-eng",
    segment: "engenharia",
    label: "Engenharia & QA",
    tagline: "Onde quebra e por quê",
    description: "Bugs/crashes com frequência e severidade + métricas quantitativas + oportunidades técnicas.",
    icon: Wrench,
    pipeline: [
      { section: "problems", label: "Bugs & crashes" },
      { section: "quantitative", label: "Quantitativo" },
      { section: "opportunities", label: "Oportunidades" },
    ],
    builtin: true,
    createdAt: 0,
  },
  {
    id: "seg-mkt",
    segment: "marketing",
    label: "Marketing / ASO",
    tagline: "O que ressoa com o público",
    description: "Voz do usuário (qualitativo) + catálogo de evidências citáveis + posicionamento estratégico.",
    icon: Megaphone,
    pipeline: [
      { section: "qualitative", label: "Voz do usuário" },
      { section: "evidence", label: "Evidências" },
      { section: "strategy", label: "Posicionamento" },
    ],
    builtin: true,
    createdAt: 0,
  },
  {
    id: "seg-suporte",
    segment: "suporte",
    label: "Suporte / Comunidade",
    tagline: "O que responder primeiro",
    description: "Problemas recorrentes + solicitações dos usuários + citações prontas para respondê-los.",
    icon: Headset,
    pipeline: [
      { section: "problems", label: "Problemas" },
      { section: "requests", label: "Solicitações" },
      { section: "evidence", label: "Evidências" },
    ],
    builtin: true,
    createdAt: 0,
  },
  {
    id: "seg-exec",
    segment: "executivo",
    label: "Executivo",
    tagline: "Onde está o valor",
    description: "Resumo executivo + modelo de negócio + ROI das iniciativas.",
    icon: Briefcase,
    pipeline: [
      { section: "summary", label: "Resumo" },
      { section: "business", label: "Negócios" },
      { section: "roi", label: "ROI" },
    ],
    builtin: true,
    createdAt: 0,
  },
  {
    id: "seg-comp",
    segment: "competitivo",
    label: "Competitivo",
    tagline: "Onde os concorrentes abrem",
    description: "Baselines quantitativos + oportunidades + estratégia de lacuna competitiva.",
    icon: Eye,
    pipeline: [
      { section: "quantitative", label: "Baselines" },
      { section: "opportunities", label: "Oportunidades" },
      { section: "strategy", label: "Estratégia" },
    ],
    builtin: true,
    createdAt: 0,
  },
];

/* -------------------------------------------------------------------- store */

const STORAGE_KEY = "aso:agents:v1";

function loadCustom(): GeneratorAgent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function listCustomAgents(): GeneratorAgent[] {
  return loadCustom();
}

export function listAllAgents(): GeneratorAgent[] {
  return [...BUILTIN_AGENTS, ...loadCustom()];
}

export function getAgent(id: string): GeneratorAgent | undefined {
  return listAllAgents().find((a) => a.id === id);
}

export function saveCustomAgent(agent: Omit<GeneratorAgent, "builtin" | "createdAt" | "id">): GeneratorAgent {
  const custom = loadCustom();
  const full: GeneratorAgent = {
    ...agent,
    id: `custom_${Date.now().toString(36)}`,
    builtin: false,
    createdAt: Date.now(),
    icon: PlusCircle,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...custom, full]));
  } catch { /* quota */ }
  return full;
}

export function deleteCustomAgent(id: string): void {
  const next = loadCustom().filter((a) => a.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch { /* quota */ }
}

/** Restaura um agente customizado (ex.: undo de exclusão). */
export function restoreCustomAgent(agent: GeneratorAgent): void {
  const custom = loadCustom().filter((a) => a.id !== agent.id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...custom, agent]));
  } catch { /* quota */ }
}
