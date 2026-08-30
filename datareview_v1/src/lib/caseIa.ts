/**
 * caseIa — geração de CASE pela IA a partir dos dados coletados (página
 * /case-ia): o usuário escolhe um PERFIL de profissional (CEO, pesquisador,
 * designer, dev, PM, PO, marketing…) e a IA estrutura o case com a estrutura
 * fixa e evidência honesta. Buscamos/coletamos antes da geração (QuickCollect)
 * e rodamos o pipeline determinístico de preparação (fatos + anomalias) —
 * a IA escreve sobre números computados, não inventa.
 *
 * Puro/testável: perfis, promt do case, parser de artefatos, e título
 * derivado. O componente decide o escopo (seleção global / dataset inteiro).
 */
import { Briefcase, Crown, Search, Palette, Code2, ClipboardList, ListChecks, Megaphone,
  Users, Target } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface CaseProfile {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Lente do perfil (o "olhar" do profissional). */
  lens: string;
  /** Perguntas que o case deve responder neste perfil. */
  questions: string[];
}

export const CASE_PROFILES: CaseProfile[] = [
  {
    id: "ceo",
    label: "CEO",
    icon: Crown,
    lens: "valor de negócio e direção",
    questions: ["Onde estamos perdendo/criando valor?", "Qual a decisão que mais move o ponteiro?"],
  },
  {
    id: "product-manager",
    label: "PM (Product Manager)",
    icon: ClipboardList,
    lens: "priorização do que construir",
    questions: ["Qual problema resolver primeiro?", "O que entra no roadmap P0/P1/P2?"],
  },
  {
    id: "ux-designer",
    label: "UX/Designer",
    icon: Palette,
    lens: "experiência e usabilidade",
    questions: ["Onde a experiência quebra?", "Quais padrões de fricção se repetem?"],
  },
  {
    id: "engineering",
    label: "Engenharia/Dev",
    icon: Code2,
    lens: "qualidade técnica e estabilidade",
    questions: ["Bugs, crashes e latência por versão", "Regressões em fluxo crítico?"],
  },
  {
    id: "product-owner",
    label: "PO (Product Owner)",
    icon: ListChecks,
    lens: "backlog e aceite",
    questions: ["Histórias que reduzem os maiores problemas", "Critérios de aceite do próximo ciclo"],
  },
  {
    id: "marketing",
    label: "Marketing/ASO",
    icon: Megaphone,
    lens: "posicionamento e aquisição",
    questions: ["Palavras-chave dos usuários", "O que os elogios/queixas sugerem p/ a mensagem?"],
  },
  {
    id: "researcher",
    label: "Pesquisador (UX Research)",
    icon: Search,
    lens: "evidência qualitativa",
    questions: ["Temas recorrentes por segmento", "Quotes reais que sustentam cada achado"],
  },
  {
    id: "customer-success",
    label: "Cliente/Suporte",
    icon: Users,
    lens: "satisfação e retenção",
    questions: ["O que os usuários elogiam/reclamam por versão e país?", "Respostas do desenvolvedor ajudam?"],
  },
  {
    id: "competitive",
    label: "Competitive Intel",
    icon: Target,
    lens: "diferenciação competitiva",
    questions: ["Onde ganhamos/perdemos", "Lacunas que os concorrentes cobrem"],
  },
];

/** Prompt do case (perfil + preparação determinística opcional). */
export function buildCasePrompt(profile: CaseProfile, preparedContext?: string): string {
  const lines = [
    `Você é o profissional "${profile.label}" (lente: ${profile.lens}).`,
    `Gere um CASE completo sobre os dados em contexto com a estrutura exata:`,
    ``,
    `# Case: <título do case>`,
    `## Perfil`,
    `1 linha: a lente (${profile.lens})`,
    `## Resumo executivo`,
    `3-5 bullets com os achados centrais`,
    `## Perguntas de pesquisa`,
    profile.questions.map((q) => `- ${q}`).join("\n"),
    `## Respostas com evidência`,
    `Cada achado em '### <achado>' com números (cálculo entre parênteses) e 2-4 citações REAIS em blockquote (autor, ★N, app). Se faltar dado: "Não há evidência suficiente".`,
    `## Plano de ação`,
    `"Prioridade: ALTA|MÉDIA|BAIXA" + 3-5 passos numerados`,
    `## Como este case foi gerado`,
    `Liste: dados em contexto e preparação determinística usada`,
    ``,
    `Regra de evidência: NUNCA invente citações. Blockquote só para reviews reais.`,
  ];
  if (preparedContext?.trim()) {
    lines.splice(6, 0, `## Preparação determinística (compute/anomalias)`, `Use os números preparados abaixo (a IA não recalcula):`, preparedContext.trim().slice(0, 20_000), ``);
  }
  return lines.join("\n");
}

/** Título do case a partir do markdown gerado (1º h1) com fallback por perfil. */
export function caseTitle(markdown: string, profileLabel: string): string {
  const m = markdown.match(/^#\s+Case:? *(.*)$/m);
  const t = (m?.[1] ?? "").trim();
  return t || `Case de ${profileLabel}`;
}
