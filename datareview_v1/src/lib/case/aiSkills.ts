/**
 * AI Skills — especificações estruturadas de comportamento (NÃO dumps de prompt).
 *
 * Cada skill é uma capacidade de produto reutilizável com: input, task, output,
 * evaluation. Baseadas nas seções de experimento reais (EXPERIMENT_SECTIONS).
 * Nenhuma chain-of-thought exposta.
 */

export interface SkillOutput {
  label: string;
  description: string;
}

export interface AISkill {
  id: string;
  name: string;
  input: string;
  task: string;
  outputs: SkillOutput[];
  evaluation: string[];
  /** Maps to an EXPERIMENT_SECTIONS id where the skill is exercised. */
  sectionId?: string;
}

export const AI_SKILLS: AISkill[] = [
  {
    id: "review-analyst",
    name: "Analista de Reviews",
    input: "Reviews coletados (texto, nota, autor, data, versão, país).",
    task: "Identificar temas recorrentes fundamentados em evidência — nunca sem citação.",
    outputs: [
      { label: "Tema", description: "Categoria recorrente extraída dos reviews." },
      { label: "Frequência", description: "Número de reviews que mencionam o tema." },
      { label: "Evidência", description: "Citação literal com atribuição ao autor." },
      { label: "Severidade", description: "Impacto percebido pelos usuários." },
    ],
    evaluation: ["Validade da citação", "Precisão numérica", "Claims sem suporte"],
    sectionId: "qualitative",
  },
  {
    id: "problem-analyst",
    name: "Analista de Problemas",
    input: "Reviews com notas baixas (★1-2) e menções a bugs/crashes/UX.",
    task: "Agrupar problemas por categoria com frequência e severidade.",
    outputs: [
      { label: "Problema", description: "Bug, crash ou fricção de UX." },
      { label: "Frequência", description: "Quantos reviews relatam." },
      { label: "Severidade", description: "Crítico / alto / médio / baixo." },
      { label: "Versão", description: "Em qual versão aparece, se informado." },
    ],
    evaluation: ["Cobertura de evidência", "Consistência temática"],
    sectionId: "problems",
  },
  {
    id: "feature-request-analyst",
    name: "Analista de Solicitações",
    input: "Reviews com pedidos explícitos de funcionalidades.",
    task: "Ordenar pedidos por recorrência e contexto.",
    outputs: [
      { label: "Solicitação", description: "Funcionalidade pedida." },
      { label: "Recorrência", description: "Nº de usuários que pedem." },
      { label: "Contexto", description: "Por que querem, nas palavras deles." },
    ],
    evaluation: ["Distinção entre pedido explícito e implícito", "Frequência correta"],
    sectionId: "requests",
  },
  {
    id: "opportunity-analyst",
    name: "Analista de Oportunidades",
    input: "Conjunto completo de reviews + problemas + solicitações.",
    task: "Priorizar oportunidades de produto por impacto × esforço.",
    outputs: [
      { label: "Oportunidade", description: "Ação de produto derivada dos dados." },
      { label: "Impacto", description: "Alto / médio / baixo, com base em evidência." },
      { label: "Esforço", description: "Estimativa de complexidade." },
      { label: "Evidência", description: "Reviews que sustentam a oportunidade." },
    ],
    evaluation: ["Priorização justificada", "Sem invenção de demanda"],
    sectionId: "opportunities",
  },
  {
    id: "competitive-analyst",
    name: "Analista Competitivo",
    input: "Reviews de múltiplos apps do mesmo segmento.",
    task: "Comparar pontos fortes e fracos relativos entre concorrentes.",
    outputs: [
      { label: "App", description: "App analisado." },
      { label: "Forças relativas", description: "Onde supera os concorrentes." },
      { label: "Fraquezas relativas", description: "Onde perde." },
      { label: "Diferencial", description: "Aspecto único percebido." },
    ],
    evaluation: ["Comparação simétrica", "Sem viés de volume"],
    sectionId: "strategy",
  },
  {
    id: "strategy-analyst",
    name: "Analista de Estratégia",
    input: "Toda a análise consolidada (problemas, oportunidades, competitivo).",
    task: "Formular estratégias de produto e mercado fundamentadas em evidência.",
    outputs: [
      { label: "Estratégia", description: "Direção de produto." },
      { label: "Premissa", description: "Hipótese com base nos dados." },
      { label: "Evidência", description: "Citações que sustentam." },
      { label: "Risco", description: "O que pode invalidar." },
    ],
    evaluation: ["Estratégia derivada dos dados", "Riscos declarados"],
    sectionId: "strategy",
  },
  {
    id: "roi-analyst",
    name: "Analista de ROI",
    input: "Oportunidades priorizadas + métricas de coleta.",
    task: "Estimar retorno potencial das iniciativas com tabela de priorização.",
    outputs: [
      { label: "Iniciativa", description: "Ação concreta." },
      { label: "Esforço", description: "Estimativa." },
      { label: "Retorno esperado", description: "Qualitativo, com evidência." },
      { label: "Prioridade", description: "Ranking final." },
    ],
    evaluation: ["ROI sem métricas fabricadas", "Prioridade consistente"],
    sectionId: "roi",
  },
];
