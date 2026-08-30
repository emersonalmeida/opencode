/**
 * Metodologias — catálogo de métodos de pesquisa/análise por área + composer
 * de pipelines de métodos executados pela IA (via fila global `iaRunner`).
 *
 * Cada metodologia declara `goal` (o que queremos saber) e `deliverable`
 * (o formato do artefato gerado) — a IA recebe ambos + os dados do escopo
 * (dataset ou seleção) e produz um artefato markdown persistido via
 * `saveAIOutput` (chave `met:<pipelineId>:<methodId>`).
 *
 * Pipelines montados pelo usuário são persistidos em `aso:method-pipelines:v1`.
 */
import { useEffect, useState } from "react";
import type { IAJob } from "@/lib/iaRunner";

export type MethodCategory =
  | "pesquisa" | "ux" | "design" | "produto"
  | "negocio" | "marketing" | "tech" | "suporte";

export const METHOD_CATEGORY_LABELS: Record<MethodCategory, string> = {
  pesquisa: "Pesquisa",
  ux: "UX & Research",
  design: "Design",
  produto: "Produto",
  negocio: "Negócio",
  marketing: "Marketing & ASO",
  tech: "Engenharia & QA",
  suporte: "Suporte & CX",
};

export const METHOD_CATEGORY_ORDER: MethodCategory[] = [
  "pesquisa", "ux", "design", "produto", "negocio", "marketing", "tech", "suporte",
];

export interface Methodology {
  id: string;
  name: string;
  category: MethodCategory;
  /** O que queremos saber (pergunta-guia). */
  goal: string;
  /** Formato do artefato produzido. */
  deliverable: string;
}

const P = (
  id: string, name: string, category: MethodCategory, goal: string, deliverable: string,
): Methodology => ({ id, name, category, goal, deliverable });

/** Catálogo — 24 metodologias cobrindo as 8 áreas. */
export const METHODOLOGIES: Methodology[] = [
  // Pesquisa
  P("desk-research", "Desk research", "pesquisa", "Mapear o que já se sabe sobre o tema a partir dos dados coletados e do conhecimento acumulado.", "Relatório: estado do conhecimento, lacunas e perguntas abertas"),
  P("benchmark-competitivo", "Benchmark competitivo", "pesquisa", "Comparar o(s) app(s) do escopo com concorrentes em forças, fraquezas e diferenciais percebidos pelos usuários.", "Matriz comparativa com evidências de reviews"),
  P("tendencias-mercado", "Análise de tendências", "pesquisa", "Identificar temas emergentes e mudanças de comportamento dos usuários ao longo do tempo.", "Lista ranqueada de tendências com sinais e citações"),
  // UX
  P("ux-research-plan", "Plano de UX research", "ux", "Definir um plano de pesquisa com usuários a partir das lacunas de conhecimento detectadas nos reviews.", "Plano: perguntas, perfil de participantes, método, roteiro"),
  P("jornada-usuario", "Jornada do usuário", "ux", "Reconstruir a jornada do usuário (descoberta → onboarding → uso → suporte) a partir das reviews.", "Mapa da jornada com pontos de dor e momentos de delight por etapa"),
  P("mapa-empatia", "Mapa de empatia", "ux", "Sintetizar o que usuários dizem, pensam, sentem e fazem segundo as reviews.", "Mapa de empatia em 4 quadrantes com citações"),
  P("5-porques", "5 Porquês", "ux", "Escavar a causa-raiz do principal problema identificado nas reviews.", "Cadeia de causa até a raiz + evidência por elo"),
  // Design
  P("avaliacao-heuristica", "Avaliação heurística (Nielsen)", "design", "Avaliar o app contra as 10 heurísticas de Nielsen usando os reviews como evidência.", "Relatório heurístico: violações, severidade, evidência, sugestão"),
  P("design-critique", "Crítica de UX/UI", "design", "Critérios de usabilidade, acessibilidade e clareza avaliados a partir do que os usuários relatam.", "Lista priorizada de problemas de interface com severidade"),
  P("content-design", "Revisão de conteúdo & microcopy", "design", "Avaliar clareza e tom da comunicação do app segundo a voz dos usuários.", "Diretrizes de conteúdo + exemplos problemáticos citados"),
  // Produto
  P("product-discovery", "Product discovery", "produto", "Descobrir problemas e oportunidades de produto com maior potencial a partir dos dados.", "Top oportunidades com evidência, tamanho e confiança"),
  P("jtbd", "Jobs-to-be-Done", "produto", "Identificar os 'trabalhos' que os usuários contratam o app para fazer.", "Lista de JTBD (quando… quero… para…) com evidências"),
  P("rice", "Priorização RICE", "produto", "Priorizar as oportunidades/problemas descobertos por Reach, Impact, Confidence, Effort.", "Tabela RICE ranqueada com justificativa por fator"),
  P("kano", "Modelo Kano", "produto", "Classificar features/necessidades em básicas, performance e encantamento.", "Matriz Kano com features e citações por categoria"),
  P("matriz-impacto-esforco", "Impacto × Esforço", "produto", "Posicionar ações candidatas na matriz impacto × esforço.", "Matriz 2×2 com quick wins, big bets, fill-ins e money pits"),
  // Negócio
  P("swot", "SWOT", "negocio", "Forças, fraquezas, oportunidades e ameaças do(s) app(s) no mercado.", "Matriz SWOT com evidências por quadrante"),
  P("business-model", "Modelo de negócio", "negocio", "Inferir proposta de valor, segmentos e canais a partir da percepção dos usuários.", "Canvas de modelo de negócio resumido com evidências"),
  P("okr-review", "Revisão de OKRs", "negocio", "Traduzir os sinais dos dados em sugestões de objetivos e resultados-chave mensuráveis.", "3-5 OKRs propostos com baseline a partir dos dados"),
  // Marketing & ASO
  P("aso-keywords", "Keywords ASO", "marketing", "Extrair keywords de ASO com base na linguagem real dos usuários.", "20 keywords ranqueadas (relevância × frequência) + sugestões de title/subtitle"),
  P("growth-loops", "Growth loops", "marketing", "Identificar loops de crescimento potenciais (aquisição, retenção, referral) sinalizados nas reviews.", "Mapa de loops com gatilhos e atritos identificados"),
  P("plano-conteudo", "Estratégia de conteúdo", "marketing", "Definir temas e formatos de conteúdo a partir das dúvidas e dores recorrentes dos usuários.", "Calendário editorial: 10 temas com gancho e CTA"),
  // Engenharia & QA
  P("qa-estrategia", "Estratégia de QA", "tech", "Definir foco de QA a partir dos bugs e regressões mais relatados (por versão, país, loja).", "Plano de testes priorizado com cenários críticos"),
  P("risco-tecnico", "Análise de risco técnico", "tech", "Mapear riscos técnicos percebidos (estabilidade, performance, segurança) e sua evolução.", "Registro de riscos com severidade, evidência e mitigação"),
  // Suporte & CX
  P("playbook-cx", "Playbook de suporte/CX", "suporte", "Criar playbook de resposta para os problemas mais frequentes e graves.", "Playbook: macros de resposta por tema + SLA sugerido"),
  P("nps-drivers", "Drivers de satisfação", "suporte", "Identificar o que mais puxa a nota para cima e para baixo (drivers de NPS/satisfação).", "Ranking de drivers positivos e negativos com impacto estimado"),
];

export function getMethodology(id: string): Methodology | undefined {
  return METHODOLOGIES.find((m) => m.id === id);
}

export function methodologiesByCategory(cat: MethodCategory): Methodology[] {
  return METHODOLOGIES.filter((m) => m.category === cat);
}

export function searchMethodologies(query: string): Methodology[] {
  const q = query.trim().toLowerCase();
  if (!q) return METHODOLOGIES;
  return METHODOLOGIES.filter((m) =>
    m.name.toLowerCase().includes(q) ||
    m.goal.toLowerCase().includes(q) ||
    m.deliverable.toLowerCase().includes(q) ||
    METHOD_CATEGORY_LABELS[m.category].toLowerCase().includes(q),
  );
}

/** Prompt que a IA executa para uma metodologia. */
export function buildMethodPrompt(m: Methodology): string {
  return `Aplique a metodologia "${m.name}" aos dados do escopo.

OBJETIVO (o que queremos saber): ${m.goal}

ENTREGÁVEL (formato obrigatório da resposta): ${m.deliverable}

Regras: use SOMENTE os dados fornecidos (apps + reviews); cite reviews reais como evidência (blockquote com nota/país); quando não houver evidência suficiente para uma parte, diga explicitamente; termine com "## Resumo" (3-5 linhas acionáveis).`;
}

/** Converte uma sequência de metodologias em jobs da fila global de IA. */
export function methodologyJobs(pipelineId: string, methodIds: string[]): IAJob[] {
  return methodIds
    .map((id) => getMethodology(id))
    .filter((m): m is Methodology => !!m)
    .map((m) => ({
      id: `met:${pipelineId}:${m.id}`,
      label: `Metodologia: ${m.name}`,
      kind: "chat" as const,
      prompt: buildMethodPrompt(m),
      saveAs: { section: "metodologia", key: `met:${pipelineId}:${m.id}` },
      origin: "metodologias",
    }));
}

// ---------------------------------------------------------------------------
// Pipelines salvos (store pub/sub)
// ---------------------------------------------------------------------------

export interface MethodPipeline {
  id: string;
  name: string;
  methodIds: string[];
  createdAt: number;
}

const PIPELINES_KEY = "aso:method-pipelines:v1";
const pipelineListeners = new Set<() => void>();

function loadPipelines(): MethodPipeline[] {
  try {
    const raw = localStorage.getItem(PIPELINES_KEY);
    const p = raw ? JSON.parse(raw) : [];
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

export function listMethodPipelines(): MethodPipeline[] {
  return loadPipelines().sort((a, b) => b.createdAt - a.createdAt);
}

export function saveMethodPipeline(name: string, methodIds: string[]): MethodPipeline {
  const pipeline: MethodPipeline = {
    id: `mp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim() || `Pipeline ${new Date().toLocaleDateString("pt-BR")}`,
    methodIds,
    createdAt: Date.now(),
  };
  const all = [pipeline, ...loadPipelines()].slice(0, 50);
  try {
    localStorage.setItem(PIPELINES_KEY, JSON.stringify(all));
  } catch { /* quota */ }
  pipelineListeners.forEach((fn) => fn());
  return pipeline;
}

export function deleteMethodPipeline(id: string) {
  const all = loadPipelines().filter((p) => p.id !== id);
  try {
    localStorage.setItem(PIPELINES_KEY, JSON.stringify(all));
  } catch { /* quota */ }
  pipelineListeners.forEach((fn) => fn());
}

export function useMethodPipelines(): MethodPipeline[] {
  const [p, setP] = useState<MethodPipeline[]>(listMethodPipelines());
  useEffect(() => {
    const fn = () => setP(listMethodPipelines());
    pipelineListeners.add(fn);
    return () => { pipelineListeners.delete(fn); };
  }, []);
  return p;
}

/** Presets prontos para um clique. */
export const PRESET_PIPELINES: { name: string; methodIds: string[] }[] = [
  { name: "Product Discovery completo", methodIds: ["product-discovery", "jtbd", "kano", "matriz-impacto-esforco", "rice"] },
  { name: "Benchmark & Competitivo", methodIds: ["benchmark-competitivo", "swot", "tendencias-mercado"] },
  { name: "UX Research Sprint", methodIds: ["desk-research", "ux-research-plan", "jornada-usuario", "mapa-empatia", "5-porques"] },
  { name: "Go-to-Market", methodIds: ["aso-keywords", "plano-conteudo", "growth-loops", "okr-review"] },
  { name: "Qualidade & CX", methodIds: ["qa-estrategia", "risco-tecnico", "playbook-cx", "nps-drivers"] },
];
