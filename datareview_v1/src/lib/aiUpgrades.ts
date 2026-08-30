/**
 * aiUpgrades — matriz dos superpoderes de IA sobre as capacidades sem IA.
 *
 * Complemento de `noAiCapabilities.ts`: para cada capacidade determinística,
 * registra O QUE a IA adiciona quando ativada (modo auto/local/cloud) e onde
 * a implementação vive. Regras invariantes (ver docs/sem-ia.md):
 *
 *  1. A IA nunca é requisito — ela potencializa uma base que já funciona.
 *  2. A IA recebe a preparação determinística ANTES (computeFacts +
 *     detectAnomalies + agregados) e cita evidências reais — nunca recalcula
 *     estatística nem inventa números.
 *  3. Toda saída de IA usa o AIOutputCard (copiar/baixar/expandir/regenerar/
 *     ler em voz/IA analisa IA) e é persistida (aiOutputStore) com
 *     proveniência (modo + modelo).
 *  4. Modos: "auto" (servidor escolhe pelo hardware), "local" (Ollama),
 *     "cloud" (BYOK — chave nunca sai do navegador). O dispatcher do servidor
 *     (`llmStream.ts`) emite SSE OpenAI-compatível para todos.
 *
 * Guard: src/test/aiUpgrades.test.ts (ids existem na matriz sem IA, refs
 * apontam arquivos/símbolos reais, toda capacidade-chave tem upgrade).
 */

import type { NoAiCapability } from "./noAiCapabilities";

export interface AIUpgrade {
  /** Id da capacidade sem IA potencializada (NO_AI_CAPABILITIES). */
  capabilityId: NoAiCapability["id"];
  /** O que a IA adiciona quando ativada. */
  superpower: string;
  /** Implementações (arquivo · símbolo). */
  implementations: { ref: string; surface: string }[];
  /** Preparação determinística que alimenta a IA antes da geração. */
  deterministicBase?: string;
}

export const AI_UPGRADES: AIUpgrade[] = [
  {
    capabilityId: "analisar",
    superpower:
      "12 seções de análise profunda (resumo, problemas, oportunidades, sentimento, versões…) com citações reais de reviews e cálculo entre parênteses.",
    deterministicBase: "computeFacts + agregados do dashboardAnalytics (a IA recebe os números prontos).",
    implementations: [
      { ref: "server/routes/experimentAnalyze.ts", surface: "Todas as superfícies de IA" },
      { ref: "src/lib/experimentApi.ts · streamExperiment", surface: "Experimentos, Dashboard, Pipeline" },
      { ref: "src/lib/experimentSections.ts · EXPERIMENT_SECTIONS", surface: "Fluxo → Investigar, /ia" },
    ],
  },
  {
    capabilityId: "gerar-relatorio",
    superpower:
      "Relatórios longos sob medida, CASE por perfil profissional (9 personas), síntese executiva de 70 decisões e compêndio — sempre com evidência.",
    deterministicBase: "computeFacts + detectAnomalies antes da geração (padrão do /case-ia).",
    implementations: [
      { ref: "src/lib/caseIa.ts", surface: "/case-ia" },
      { ref: "src/lib/decisionPipeline.ts", surface: "/decision-center (síntese + compêndio)" },
      { ref: "src/lib/methodologies.ts", surface: "/metodologias (24 métodos)" },
    ],
  },
  {
    capabilityId: "comandar",
    superpower:
      "Linguagem natural livre (além dos intents determinísticos), streaming paralelo/sequencial e IA encadeada (IA analisa o que IA gerou).",
    implementations: [
      { ref: "src/lib/experimentChatApi.ts · streamExperimentChat", surface: "Todos os chats" },
      { ref: "src/lib/chatStream.ts", surface: "Chats (streams concorrentes)" },
      { ref: "src/lib/iaRunner.ts", surface: "Fila global com worker pool" },
    ],
  },
  {
    capabilityId: "criar",
    superpower:
      "A IA constrói artefatos: páginas do Design Canvas via ops JSON, decks a partir de markdown, pipelines de metodologias e agentes executando etapas.",
    implementations: [
      { ref: "src/lib/designCanvas/aiOps.ts", surface: "/design (copiloto Gerar)" },
      { ref: "src/lib/presentations.ts · markdownToSlides", surface: "/apresentacoes" },
      { ref: "src/lib/agentRunner.ts", surface: "/agentes (7 agentes + custom)" },
    ],
  },
  {
    capabilityId: "reanalisar",
    superpower:
      "Regenerar com outra lente (persona/seção), Desafiar/Por quê?/O que fazer? sobre a análise anterior e IA auditando IA (validator/challenge).",
    implementations: [
      { ref: "src/lib/decisionCenter.ts", surface: "/decision-center (3 investigações)" },
      { ref: "src/components/canvas/nodeRegistry.ts", surface: "/canvas (nós challenge/validator)" },
      { ref: "src/components/shared/AIOutputCard.tsx", surface: "Toda saída (Analisar com IA)" },
    ],
  },
  {
    capabilityId: "pesquisar",
    superpower:
      "Busca semântica de reviews por embeddings locais (nomic-embed-text via Ollama) — relevância por significado, não só por termo.",
    implementations: [
      { ref: "server/routes/embedSearch.ts", surface: "/dashboard (toggle Semântica)" },
      { ref: "src/lib/embedSearch.ts · semanticSearchReviews", surface: "Feed de reviews" },
    ],
  },
  {
    capabilityId: "ouvir",
    superpower:
      "Leitura em voz DURANTE a geração (streaming speaker por frases) e IA narrando análises — além do TTS determinístico de qualquer texto.",
    implementations: [
      { ref: "src/lib/voiceStream.ts · StreamingSpeaker", surface: "AIOutputCard (ouvir ao vivo)" },
      { ref: "src/components/shared/VoiceControls.tsx", surface: "Toda saída de IA" },
    ],
  },
];

export function upgradesFor(capabilityId: string): AIUpgrade[] {
  return AI_UPGRADES.filter((u) => u.capabilityId === capabilityId);
}
