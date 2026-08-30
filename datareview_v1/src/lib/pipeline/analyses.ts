/**
 * Catálogo de análises — tudo que o pipeline sabe executar.
 *
 * Cada análise declara: estágio, motor (determinístico/IA), custo, o que
 * consome (para lineage + scoring), potencial base e uma estimativa de
 * evidência disponível no dataset. O ORQUESTRADOR usa esses metadados para
 * pontuar e priorizar o que rodar em seguida.
 *
 * Análises de IA carregam `buildPrompt(ctx)`: o prompt recebe os FATOS
 * determinísticos + resumos dos artefatos upstream — nunca só os reviews
 * crus. É o "fato calculado alimenta a interpretação" do briefing.
 */
import type { DatasetEntry } from "@/lib/datasetStore";
import type { ArtifactKind, PipelineArtifact, PipelineStage } from "./types";

export type AnalysisCost = "baixo" | "médio" | "alto";

export interface AIPromptCtx {
  /** Markdown dos fatos determinísticos (computeFacts → factsToMarkdown). */
  factsMarkdown: string;
  /** Resumos (markdown truncado) dos artefatos upstream consumidos. */
  upstreamDigest: string;
  /** Parâmetros livres vindos de um `next_analysis` da IA (loop). */
  parameters?: Record<string, unknown>;
}

export interface AnalysisSpec {
  id: string;
  label: string;
  stage: PipelineStage;
  engine: "deterministic" | "ai";
  kind: ArtifactKind;
  description: string;
  cost: AnalysisCost;
  /** Kinds de artefato que esta análise consome (quando disponíveis). */
  consumes: ArtifactKind[];
  /** Potencial base 0-100 (quanta informação nova tende a gerar). */
  basePotential: number;
  /** Evidência disponível 0-100 dado o dataset atual. */
  evidence(entries: DatasetEntry[]): number;
  /** Prompt da análise (somente engine=ai). */
  buildPrompt?: (ctx: AIPromptCtx) => string;
}

const totalReviews = (entries: DatasetEntry[]) => entries.reduce((s, e) => s + e.reviews.length, 0);
const withDates = (entries: DatasetEntry[]) =>
  entries.reduce((s, e) => s + e.reviews.filter((r) => r.date).length, 0);
const withVersions = (entries: DatasetEntry[]) =>
  entries.reduce((s, e) => s + e.reviews.filter((r) => r.version).length, 0);
const withCountries = (entries: DatasetEntry[]) =>
  entries.reduce((s, e) => s + e.reviews.filter((r) => r.country).length, 0);
const pctOf = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
const clamp100 = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/* ---------------------------------------------------------------- prompts */

const PROTOCOL = `

---
PROTOCOLO DO PIPELINE (obrigatório): ao final da análise, adicione um bloco de código \`\`\`json com EXATAMENTE este formato:
\`\`\`json
{
  "findings": [
    { "title": "descoberta curta e específica", "confidence": 0.0-1.0, "evidence": "métrica ou citação que sustenta" }
  ],
  "next_analysis": {
    "type": "<id da próxima análise que geraria mais informação nova>",
    "rationale": "por que essa análise agora",
    "parameters": { "topic": "...", "versions": ["..."], "country": "..." }
  }
}
\`\`\`
Regras do protocolo:
- "findings": 1 a 5 descobertas desta análise, com confiança honesta.
- "next_analysis": a ÚNICA próxima análise que mais agregaria, ou null se nenhuma análise adicional se justificar. IDs disponíveis: version-impact, temporal-trends, geo-split, topic-extraction, sentiment-by-topic, problem-clustering, request-mining, what-changed, root-cause, hypothesis-generation, competitive-gap, opportunity-synthesis, action-plan, executive-report.
- NÃO peça uma análise que já foi feita (ver seção ANÁLISES JÁ REALIZADAS). NÃO peça análise para a qual não há evidência nos dados.`;

function extractionPrompt(task: string) {
  return (ctx: AIPromptCtx) => `Você é o estágio de EXTRAÇÃO de um pipeline analítico. Abaixo estão os FATOS DETERMINÍSTICOS já computados sobre o dataset (números exatos — confie neles, não recalcule) e, quando houver, resultados de análises anteriores.

FATOS COMPUTADOS:
${ctx.factsMarkdown}

${ctx.upstreamDigest}

TAREFA: ${task}

Separe claramente o que é FATO (veio dos números acima) do que é INTERPRETAÇÃO sua. Toda interpretação deve citar evidência dos reviews (blockquote) ou dos fatos.
${PROTOCOL}`;
}

function reasoningPrompt(task: string) {
  return (ctx: AIPromptCtx) => `Você é o estágio de RACIOCÍNIO de um pipeline analítico recursivo. Você NÃO precisa reler todos os reviews — recebe os FATOS determinísticos e os DADOS DERIVADOS de análises de IA anteriores, e sua função é CRUZAR essas camadas.

FATOS COMPUTADOS:
${ctx.factsMarkdown}

ANÁLISES ANTERIORES (dados derivados de IA):
${ctx.upstreamDigest || "(nenhuma análise anterior disponível ainda)"}

TAREFA: ${task}

Para cada conclusão, indique as camadas que sustentam (fato X + tema Y + versão Z). Distingua evidência quantitativa (alta/média/baixa) de evidência causal.
${PROTOCOL}`;
}

function strategyPrompt(task: string) {
  return (ctx: AIPromptCtx) => `Você é o estágio de ESTRATÉGIA de um pipeline analítico. Recebe fatos determinísticos + descobertas/hipóteses dos estágios anteriores e transforma inteligência em DECISÃO.

FATOS COMPUTADOS:
${ctx.factsMarkdown}

CONHECIMENTO ACUMULADO (extração + raciocínio):
${ctx.upstreamDigest || "(sem estágios anteriores — baseie-se nos fatos e nos reviews)"}

TAREFA: ${task}

Estruture cada saída como: Insight → Evidência (citações/estatísticas reais) → Hipótese → Oportunidade → Confiança (quantitativa/qualitativa/causal).
${PROTOCOL}`;
}

/* ---------------------------------------------------------------- catálogo */

export const ANALYSES: AnalysisSpec[] = [
  // -------------------------------------------------- COMPUTE (determinístico)
  {
    id: "facts-overview",
    label: "Panorama de fatos",
    stage: "compute",
    engine: "deterministic",
    kind: "facts",
    description: "KPIs, distribuição de notas, sentimento, por app, qualidade dos dados.",
    cost: "baixo",
    consumes: [],
    basePotential: 80,
    evidence: (e) => (totalReviews(e) > 0 ? 100 : 0),
  },
  {
    id: "version-impact",
    label: "Impacto por versão",
    stage: "compute",
    engine: "deterministic",
    kind: "facts",
    description: "Nota média, volume e % negativo por versão de cada app.",
    cost: "baixo",
    consumes: [],
    basePotential: 90,
    evidence: (e) => clamp100(pctOf(withVersions(e), totalReviews(e))),
  },
  {
    id: "temporal-trends",
    label: "Tendências temporais",
    stage: "compute",
    engine: "deterministic",
    kind: "facts",
    description: "Evolução mensal de volume e nota média; crescimento de reviews.",
    cost: "baixo",
    consumes: [],
    basePotential: 78,
    evidence: (e) => clamp100(pctOf(withDates(e), totalReviews(e))),
  },
  {
    id: "geo-split",
    label: "Segmentação geográfica",
    stage: "compute",
    engine: "deterministic",
    kind: "facts",
    description: "Reviews, nota e % negativo por país/storefront.",
    cost: "baixo",
    consumes: [],
    basePotential: 62,
    evidence: (e) => clamp100(pctOf(withCountries(e), totalReviews(e))),
  },
  {
    id: "term-frequency",
    label: "Frequência de termos",
    stage: "compute",
    engine: "deterministic",
    kind: "facts",
    description: "Termos mais citados nos reviews (pré-tópicos determinísticos).",
    cost: "baixo",
    consumes: [],
    basePotential: 66,
    evidence: (e) => (totalReviews(e) >= 20 ? 90 : 40),
  },
  {
    id: "anomaly-scan",
    label: "Varredura de anomalias",
    stage: "compute",
    engine: "deterministic",
    kind: "anomaly",
    description: "Regressões de versão, picos de negatividade/volume, apps fora da curva.",
    cost: "baixo",
    consumes: ["facts"],
    basePotential: 95,
    evidence: (e) => (totalReviews(e) >= 50 ? 92 : totalReviews(e) > 0 ? 55 : 0),
  },

  // ------------------------------------------------------- EXTRACT (IA #1)
  {
    id: "topic-extraction",
    label: "Extração de temas",
    stage: "extract",
    engine: "ai",
    kind: "topics",
    description: "Agrupa os reviews em temas (login, pagamento, performance…) com contagem.",
    cost: "médio",
    consumes: ["facts"],
    basePotential: 88,
    evidence: (e) => (totalReviews(e) >= 30 ? 95 : totalReviews(e) > 0 ? 60 : 0),
    buildPrompt: extractionPrompt(
      "Extraia os TEMAS recorrentes dos reviews (ex.: login, pagamentos, performance, UI, suporte, cobrança, notificações). Para cada tema: nome curto em MAIÚSCULAS, nº estimado de reviews que o mencionam (conte), % sobre o total, e 2 citações reais. Ordene por frequência. Formato: tabela markdown.",
    ),
  },
  {
    id: "sentiment-by-topic",
    label: "Sentimento por tema",
    stage: "extract",
    engine: "ai",
    kind: "sentiment",
    description: "Para cada tema, o sentimento dominante e a variação (positivo/negativo).",
    cost: "médio",
    consumes: ["facts", "topics"],
    basePotential: 90,
    evidence: (e) => (totalReviews(e) >= 30 ? 93 : totalReviews(e) > 0 ? 55 : 0),
    buildPrompt: extractionPrompt(
      "Para cada TEMA identificado nos reviews, classifique o sentimento dominante: % de menções negativas vs positivas (com contagem entre parênteses). Formato: tabela 'TEMA | % negativo | % positivo | n | tendência'. Se uma análise de temas já existir acima, use os temas dela.",
    ),
  },
  {
    id: "problem-clustering",
    label: "Agrupamento de problemas",
    stage: "extract",
    engine: "ai",
    kind: "problems",
    description: "Clusteriza reclamações: categoria, frequência, severidade, versões afetadas.",
    cost: "médio",
    consumes: ["facts", "anomaly"],
    basePotential: 86,
    evidence: (e) => (totalReviews(e) >= 30 ? 90 : totalReviews(e) > 0 ? 50 : 0),
    buildPrompt: extractionPrompt(
      "Agrupe os PROBLEMAS reportados em clusters (bugs, UX, performance, cobrança, login, suporte…). Para cada cluster: frequência (contagem), severidade (alta/média/baixa), versões afetadas (se houver nos fatos), e trechos reais. Ordene por frequência × severidade.",
    ),
  },
  {
    id: "request-mining",
    label: "Mineração de pedidos",
    stage: "extract",
    engine: "ai",
    kind: "requests",
    description: "Extrai pedidos/sugestões de funcionalidades com frequência e citações.",
    cost: "médio",
    consumes: ["facts"],
    basePotential: 72,
    evidence: (e) => (totalReviews(e) >= 30 ? 85 : totalReviews(e) > 0 ? 45 : 0),
    buildPrompt: extractionPrompt(
      "Extraia os PEDIDOS e SUGESTÕES de funcionalidades dos reviews. Para cada: frequência (contagem), apps onde aparece, citações reais. Ordene por recorrência e destaque pedidos presentes em mais de um app.",
    ),
  },

  // ------------------------------------------------------- REASON (IA #2)
  {
    id: "what-changed",
    label: "O que mudou?",
    stage: "reason",
    engine: "ai",
    kind: "finding",
    description: "Cruza versões × temas × sentimento: o que mudou, quando, em qual versão.",
    cost: "alto",
    consumes: ["facts", "anomaly", "topics", "sentiment"],
    basePotential: 94,
    evidence: (e) => clamp100(pctOf(withVersions(e), totalReviews(e)) * 0.9),
    buildPrompt: reasoningPrompt(
      "Responda: O QUE MUDOU? Compare períodos e versões usando os fatos (impacto por versão, tendências temporais, anomalias) e os temas/sentimentos extraídos. Para cada mudança: antes → depois (com números), tema afetado, versão/período, e evidência. Se nada mudou significativamente, diga isso com os números que provam estabilidade.",
    ),
  },
  {
    id: "root-cause",
    label: "Causa-raiz candidata",
    stage: "reason",
    engine: "ai",
    kind: "hypothesis",
    description: "Investiga as anomalias: hipóteses de causa com evidência a favor/contra.",
    cost: "alto",
    consumes: ["anomaly", "facts", "topics", "problems"],
    basePotential: 92,
    evidence: (e) => (totalReviews(e) >= 50 ? 88 : totalReviews(e) > 0 ? 50 : 0),
    buildPrompt: reasoningPrompt(
      "Investigue as ANOMALIAS detectadas (e quedas de nota por versão, se houver). Para cada uma: formule a hipótese de causa-raiz mais provável, liste evidências A FAVOR e CONTRA (citações reais + números), e classifique a confiança causal (alta/média/baixa) com justificativa. Seja cético: correlação não é causalidade.",
    ),
  },
  {
    id: "hypothesis-generation",
    label: "Geração de hipóteses",
    stage: "reason",
    engine: "ai",
    kind: "hypothesis",
    description: "Hipóteses testáveis sobre o comportamento dos usuários e do mercado.",
    cost: "alto",
    consumes: ["facts", "topics", "sentiment"],
    basePotential: 76,
    evidence: (e) => (totalReviews(e) >= 30 ? 80 : totalReviews(e) > 0 ? 45 : 0),
    buildPrompt: reasoningPrompt(
      "Gere 3-5 HIPÓTESES testáveis a partir do cruzamento dos fatos com os temas/sentimentos. Para cada: formulação clara, dados que a sustentam, dados que a refutariam, e qual análise a validaria. Ordene por (evidência disponível × impacto se verdadeira).",
    ),
  },
  {
    id: "competitive-gap",
    label: "Gap competitivo",
    stage: "reason",
    engine: "ai",
    kind: "finding",
    description: "Compara apps do conjunto: quem lidera em quê, gaps exploráveis.",
    cost: "alto",
    consumes: ["facts", "topics", "sentiment"],
    basePotential: 91,
    evidence: (e) => (e.length >= 2 ? 89 : 20),
    buildPrompt: reasoningPrompt(
      "Compare os apps do conjunto. Para cada dimensão (temas, sentimento, versões, países): quem lidera, quem perde, e qual gap é explorável. Destaque: funcionalidades elogiadas num app e ausentes/criticadas em outro; problemas que um app resolveu e o outro não. Tabela comparativa + leitura estratégica dos gaps.",
    ),
  },

  // ------------------------------------------------------ STRATEGY (IA #3)
  {
    id: "opportunity-synthesis",
    label: "Síntese de oportunidades",
    stage: "strategy",
    engine: "ai",
    kind: "decision",
    description: "Oportunidades priorizadas por impacto × esforço, ancoradas em evidência.",
    cost: "alto",
    consumes: ["finding", "hypothesis", "problems", "requests", "facts"],
    basePotential: 93,
    evidence: (e) => (totalReviews(e) >= 30 ? 87 : totalReviews(e) > 0 ? 50 : 0),
    buildPrompt: strategyPrompt(
      "Sintetize as OPORTUNIDADES a partir de tudo que o pipeline descobriu. Para cada: Insight → Evidência (citações + estatísticas reais) → Hipótese de valor → Ação concreta → Confiança (quantitativa/qualitativa/causal). Priorize por impacto × esforço (tabela final).",
    ),
  },
  {
    id: "action-plan",
    label: "Plano de ação",
    stage: "strategy",
    engine: "ai",
    kind: "decision",
    description: "Ações priorizadas (P0/P1/P2) com dono sugerido, esforço e KPI de sucesso.",
    cost: "alto",
    consumes: ["decision", "finding", "hypothesis", "facts"],
    basePotential: 84,
    evidence: (e) => (totalReviews(e) >= 30 ? 82 : totalReviews(e) > 0 ? 45 : 0),
    buildPrompt: strategyPrompt(
      "Transforme as descobertas e oportunidades em um PLANO DE AÇÃO. Para cada ação: prioridade (P0/P1/P2), o que fazer exatamente, evidência que justifica, esforço estimado (baixo/médio/alto), KPI de sucesso e prazo sugerido. Tabela de priorização ao final.",
    ),
  },
  {
    id: "executive-report",
    label: "Relatório executivo",
    stage: "strategy",
    engine: "ai",
    kind: "report",
    description: "Consolida todo o conhecimento do pipeline num relatório para decisores.",
    cost: "alto",
    consumes: ["finding", "hypothesis", "decision", "facts", "anomaly"],
    basePotential: 80,
    evidence: (e) => (totalReviews(e) > 0 ? 85 : 0),
    buildPrompt: strategyPrompt(
      "Escreva o RELATÓRIO EXECUTIVO consolidando todo o pipeline: contexto (escopo dos dados), fatos-chave (números), principais descobertas (com confiança), riscos, oportunidades priorizadas e recomendação final. É o documento que um C-level leria em 3 minutos. Ao final, uma seção 'Lineage' listando quais análises alimentaram cada conclusão.",
    ),
  },
];

export function getAnalysis(id: string): AnalysisSpec | undefined {
  return ANALYSES.find((a) => a.id === id);
}

export function analysesByStage(stage: PipelineStage): AnalysisSpec[] {
  return ANALYSES.filter((a) => a.stage === stage);
}

/** Mapeia um `type` livre pedido pela IA (next_analysis) para um id do
 *  catálogo — aceita sinônimos comuns ("version_comparison" → version-impact). */
const TYPE_ALIASES: Record<string, string> = {
  version_comparison: "version-impact",
  "version-analysis": "version-impact",
  version: "version-impact",
  geographic: "geo-split",
  geographic_analysis: "geo-split",
  country: "geo-split",
  topic_modeling: "topic-extraction",
  topics: "topic-extraction",
  sentiment: "sentiment-by-topic",
  sentiment_by_topic: "sentiment-by-topic",
  problems: "problem-clustering",
  requests: "request-mining",
  anomalies: "anomaly-scan",
  anomaly: "anomaly-scan",
  temporal: "temporal-trends",
  trends: "temporal-trends",
  opportunities: "opportunity-synthesis",
  strategy: "action-plan",
  report: "executive-report",
};

export function resolveAnalysisId(type: string): string | null {
  const norm = type.trim().toLowerCase().replace(/\s+/g, "-").replace(/_/g, "-");
  if (getAnalysis(norm)) return norm;
  const alias = TYPE_ALIASES[norm] ?? TYPE_ALIASES[type.trim().toLowerCase()];
  if (alias) return alias;
  // match parcial: "compare-versions" contém "version" → version-impact
  const partial = ANALYSES.find((a) => norm.includes(a.id) || a.id.includes(norm));
  return partial ? partial.id : null;
}
