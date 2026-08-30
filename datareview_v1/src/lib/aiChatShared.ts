/**
 * Inteligência compartilhada dos chats de IA — usada IGUALMENTE pela página
 * Chat, pela sidebar direita (AIAssistantPanel) e pela Central de IA, para
 * que todas as superfícies de conversa tenham o mesmo poder:
 *
 *   - ANALYSIS_SHORTCUTS — as 12 análises de IA do sistema (EXPERIMENT_SECTIONS).
 *   - PIPELINE_SHORTCUTS — os 7 pipelines de agentes (sequências de análises).
 *   - buildDataAwareSuggestions — sugestões de prompt geradas a partir da
 *     FORMA dos dados coletados (versões, países, lojas, sentimento, volume).
 *   - buildSystemContextSummary — resumo vivo do sistema (dataset, seleção,
 *     gerações, outputs, tarefas em execução) injetado no chat generalista.
 *
 * Lib pura (sem React) — testável diretamente.
 */
import type { DatasetEntry } from "@/lib/datasetStore";
import { EXPERIMENT_SECTIONS, type SectionDef } from "@/lib/experimentSections";
import { BUILTIN_AGENTS, type GeneratorAgent } from "@/lib/agents";
import { listTasks } from "@/lib/activityStore";
import { listGenerations } from "@/lib/sessionStore";
import { listAIOutputs } from "@/lib/aiOutputStore";
import { listArtifacts } from "@/lib/pipeline/artifactStore";
import { PAGES } from "@/lib/pages";

/* ------------------------------------------------------------ atalhos --- */

/** As 12 análises de IA do sistema (mesmas da página Experimentos). */
export const ANALYSIS_SHORTCUTS: SectionDef[] = EXPERIMENT_SECTIONS.filter((s) => s.kind === "ai");

export interface PipelineShortcutStep {
  /** id de seção do experiment-analyze (ou "custom" com prompt). */
  section: string;
  label: string;
  prompt?: string;
}

export interface PipelineShortcut {
  id: string;
  label: string;
  tagline: string;
  steps: PipelineShortcutStep[];
}

/** Pipelines de agentes builtin (sequência de seções de análise). */
export const PIPELINE_SHORTCUTS: PipelineShortcut[] = BUILTIN_AGENTS.map((a: GeneratorAgent) => ({
  id: a.id,
  label: a.label,
  tagline: a.tagline,
  steps: a.pipeline.map((p) => ({ section: p.section, label: p.label, prompt: p.prompt })),
}));

/* ------------------------------------------- sugestões por tipo de dado --- */

/**
 * Gera sugestões de prompt baseadas na FORMA dos dados coletados — quanto
 * mais rico o recorte (multi-app, multi-versão, multi-país, multi-loja,
 * sentimento extremo), mais específica a sugestão. Retorna até `max` itens,
 * sempre começando pelos mais específicos do dataset atual.
 */
export function buildDataAwareSuggestions(entries: Pick<DatasetEntry, "app" | "reviews">[], max = 6): string[] {
  const out: string[] = [];
  if (entries.length === 0) return out;

  const allReviews = entries.flatMap((e) => e.reviews);
  const total = allReviews.length;
  const apps = entries.map((e) => e.app);
  const names = apps.map((a) => a.name);

  // Dimensões do dataset
  const versions = new Set(allReviews.map((r) => r.version).filter(Boolean) as string[]);
  const countries = new Set(allReviews.map((r) => r.country).filter(Boolean) as string[]);
  const stores = new Set(apps.map((a) => a.store));
  const neg = allReviews.filter((r) => r.rating <= 2).length;
  const pos = allReviews.filter((r) => r.rating >= 4).length;
  const negPct = total ? Math.round((neg / total) * 100) : 0;
  const posPct = total ? Math.round((pos / total) * 100) : 0;
  const hasHelpful = allReviews.some((r) => (r.thumbsUp ?? 0) > 0);
  const hasReplies = allReviews.some((r) => r.developerReply);

  // Multi-app → comparativos
  if (entries.length >= 2) {
    out.push(`Compare ${names.slice(0, 3).join(" × ")}: onde cada um ganha e onde cada um perde?`);
    out.push("Ranqueie os apps por satisfação real dos usuários, com o cálculo");
    out.push("Que pedidos de funcionalidade aparecem em mais de um app? (sinal forte de mercado)");
  }

  // Multi-versão → evolução/regressão
  if (versions.size >= 2) {
    out.push(`Há regressão ou melhora entre as versões? Compare as ${Math.min(versions.size, 3)} mais recentes`);
  }

  // Multi-país → diferenças regionais
  if (countries.size >= 2) {
    out.push(`O sentimento muda por país? Compare os ${countries.size} países presentes nos reviews`);
  }

  // Multi-loja → percepção Apple vs Google
  if (stores.size >= 2) {
    out.push("Há diferença de percepção entre usuários da App Store e do Google Play?");
  }

  // Sentimento extremo → aprofundar onde dói/onde encanta
  if (negPct >= 25) {
    out.push(`Os negativos são ${negPct}% dos reviews — investigue a fundo as causas raiz dos principais problemas`);
  } else if (posPct >= 70) {
    out.push(`Os positivos são ${posPct}% — identifique os diferenciais que os usuários mais valorizam para proteger`);
  }

  // Reviews úteis → o que a comunidade valida
  if (hasHelpful) {
    out.push("O que os reviews mais úteis (mais 👍) ensinam? São o que a comunidade mais valida");
  }

  // Respostas do dev → relacionamento com a comunidade
  if (hasReplies) {
    out.push("Analise as respostas do desenvolvedor: cobrem os temas certos? O que ficou sem resposta?");
  }

  // Universais (sempre úteis)
  out.push("Resumo executivo: veredito, top 3 forças, top 3 fraquezas e plano P0/P1/P2");
  out.push("Quais funcionalidades os usuários mais pedem, com citações?");
  out.push("Monte uma tabela dos 5 problemas mais frequentes com severidade e evidência");
  out.push("Que oportunidades de produto os dados revelam? Priorize por impacto × esforço");

  // Dedup preservando ordem e corta no máximo pedido
  return Array.from(new Set(out)).slice(0, max);
}

/** Sugestões para o chat generalista (sem apps em escopo). */
export const SYSTEM_CHAT_SUGGESTIONS: string[] = [
  "O que este sistema faz?",
  "O que a IA consegue acessar e gerar?",
  "Quais dados já foram coletados?",
  "O que já foi gerado por IA até agora?",
  "Como coletar reviews de um app?",
  "Como funciona a IA local (modo auto)?",
  "Onde ficam salvos meus dados e saídas?",
  "Qual página uso para comparar apps?",
  "O que são os pipelines de agentes?",
  "Como edito os prompts da IA?",
];

/* ------------------------------------------------- contexto vivo do sistema --- */

/**
 * Resumo vivo do sistema para o chat generalista (section "os") — o que a IA
 * pode saber SEM o usuário ter que perguntar: dataset, seleção, tudo que já
 * foi gerado, e o que está rodando agora. Injetado no system prompt.
 */
export function buildSystemContextSummary(pagePath?: string): string {
  const parts: string[] = [];

  // Página atual
  if (pagePath) {
    const page = PAGES.find((p) => p.path === pagePath);
    parts.push(`PÁGINA ATUAL DO USUÁRIO: ${page ? `${page.label} (${pagePath}) — ${page.desc}` : pagePath}.`);
  }

  // Tarefas em execução (coletas, análises, pipelines)
  const active = listTasks().filter((t) => t.status === "running" || t.status === "queued");
  if (active.length > 0) {
    parts.push(`EM EXECUÇÃO AGORA (${active.length}): ${active.slice(0, 5).map((t) => `"${t.label}"${t.detail ? ` — ${t.detail}` : ""}`).join("; ")}.`);
  }

  // O que já foi gerado (contagens + mais recentes)
  const gens = listGenerations();
  const outputs = listAIOutputs();
  const artifacts = listArtifacts();
  if (gens.length > 0) {
    const recent = gens.slice(0, 3).map((g) => `"${g.title}"`).join(", ");
    parts.push(`GERAÇÕES DE IA REGISTRADAS: ${gens.length} (mais recentes: ${recent}).`);
  }
  if (outputs.length > 0) {
    parts.push(`SAÍDAS DE IA PERSISTIDAS: ${outputs.length} seções salvas (reutilizáveis sem regerar).`);
  }
  if (artifacts.length > 0) {
    parts.push(`ARTEFATOS DO PIPELINE DE CONHECIMENTO: ${artifacts.length}.`);
  }

  return parts.join("\n");
}
