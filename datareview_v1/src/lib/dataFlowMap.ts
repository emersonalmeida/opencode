/**
 * dataFlowMap — mapa MICRO e MACRO do pipeline de dados de ponta a ponta.
 *
 * Responde: o que acontece em TODOS os níveis do processo de dados, do input
 * do usuário até o artefato final — quais fontes, como a requisição sai, como
 * a resposta chega, como o dado é coletado, normalizado, tratado, guardado,
 * derivado, visualizado, preparado para IA, analisado com IA, e o que a IA
 * gera como outputs/artefatos/documentos/relatórios.
 *
 * Lib pura (sem React) — alimenta a página /fluxo-dados e é testável.
 */

export type FlowAIMode = "sem-ia" | "com-ia" | "para-ia" | "hibrido";

export interface FlowMicroStep {
  id: string;
  title: string;
  detail: string;
  /** Arquivo/função de referência no código. */
  codeRef?: string;
}

export interface FlowStage {
  id: string;
  num: string;
  title: string;
  subtitle: string;
  aiMode: FlowAIMode;
  /** O que entra no estágio. */
  inputs: string[];
  /** O que sai do estágio. */
  outputs: string[];
  /** Chaves de storage envolvidas. */
  storage?: string[];
  microSteps: FlowMicroStep[];
  deepLinks?: { path: string; label: string }[];
}

export const AI_MODE_META: Record<FlowAIMode, { label: string; description: string }> = {
  "sem-ia": { label: "Sem IA", description: "Determinístico — código puro, sem modelo." },
  "para-ia": { label: "Para IA", description: "Prepara e orça os dados que a IA vai consumir." },
  "com-ia": { label: "Com IA", description: "Um modelo de linguagem participa do processamento." },
  hibrido: { label: "Híbrido", description: "Mistura etapas determinísticas e de IA." },
};

export const FLOW_STAGES: FlowStage[] = [
  {
    id: "busca", num: "01", title: "Entrada do usuário",
    subtitle: "Tudo começa com um termo, uma URL ou uma seleção de fontes.",
    aiMode: "sem-ia",
    inputs: ["intenção do usuário"],
    outputs: ["query validada", "fontes selecionadas", "modo de coleta"],
    microSteps: [
      { id: "termo", title: "Termo ou URL digitado", detail: "Input controlado; Enter dispara a ação. A query é validada com trim — vazia não dispara nada.", codeRef: "src/components/uni/UniSourcePanel.tsx" },
      { id: "fontes", title: "Seleção de fontes e recursos", detail: "Multi-seleção por toggle (verticais do Suggest, períodos × verticais do Trends, fontes do pipeline). Cada combinação vira uma execução própria.", codeRef: "src/lib/uni/collectModes.ts" },
      { id: "modo", title: "Modo de coleta", detail: "rápida/normal/max/custom define limites por recurso (5/12/50/N) e expansões profundas (suggest a–z).", codeRef: "modeLimit / modeExpand" },
      { id: "url", title: "Detecção de URL", detail: "Fontes que só aceitam URL (Web, RSS/Atom) são puladas com a razão honesta quando o input não é URL — nunca fingidas.", codeRef: "sourceSkipReason (sourceRunner.ts)" },
    ],
    deepLinks: [{ path: "/00", label: "Uni" }, { path: "/pipeline-multifonte", label: "Pipeline Multifonte" }],
  },
  {
    id: "requisicao", num: "02", title: "Requisição",
    subtitle: "O cliente chama as rotas locais; o servidor valida, orça e fala com as fontes externas.",
    aiMode: "sem-ia",
    inputs: ["query validada", "parâmetros do modo"],
    outputs: ["HTTP POST /functions/v1/uni-*"],
    microSteps: [
      { id: "post", title: "post() do cliente", detail: "Todas as chamadas passam por um helper que monta o body JSON com AbortSignal — o usuário pode cancelar a qualquer momento.", codeRef: "src/lib/uni/uniApi.ts" },
      { id: "rotas", title: "Rotas uni-*", detail: "Uma rota por fonte (uni-suggest, uni-trends, uni-serp…) + o motor declarativo uni-source (10 conectores) — o cliente nunca fala direto com a fonte externa.", codeRef: "server/routes/uni*.ts" },
      { id: "validacao", title: "Validação no servidor", detail: "Parâmetros são normalizados, limites clampados, e entradas inválidas viram erro honesto com mensagem.", codeRef: "server/routes/" },
      { id: "ratelimit", title: "Rate-limit e retries", detail: "Fontes com limite agressivo (Trends 429, GDELT 1 req/5s) usam backoff exponencial com jitter; falha persistente vira erro, não trava.", codeRef: "server/routes/uniTrends.ts" },
    ],
  },
  {
    id: "resposta-bruta", num: "03", title: "Resposta bruta",
    subtitle: "O payload original da fonte é preservado antes de qualquer transformação.",
    aiMode: "sem-ia",
    inputs: ["JSON/texto bruto da fonte"],
    outputs: ["raw artifact imutável + run registrada"],
    storage: ["rawStore (disco: artifacts/)"],
    microSteps: [
      { id: "run", title: "Run registrada", detail: "Cada coleta abre uma run (startRun) com fonte, parâmetros e timestamp — é o que alimenta o terminal Output em tempo real via SSE.", codeRef: "server/lib/rawStore.ts" },
      { id: "raw", title: "Raw artifact", detail: "O payload bruto é gravado imutável (saveRawArtifact) — nunca reescrito, sempre re-derivável. É a base de auditoria.", codeRef: "saveRawArtifact" },
      { id: "finish", title: "Fechamento da run", detail: "finishRun marca done/error com contagem de itens — o terminal da aba Output mostra [run] … done/error em tempo real.", codeRef: "server/routes/uniOutputStream.ts" },
    ],
    deepLinks: [{ path: "/00", label: "Uni (aba Output)" }],
  },
  {
    id: "normalizacao", num: "04", title: "Normalização",
    subtitle: "Cada fonte vira UniItem[] no formato único — um modelo para 26 fontes.",
    aiMode: "sem-ia",
    inputs: ["payload bruto da fonte"],
    outputs: ["UniItem[] uniforme"],
    microSteps: [
      { id: "uniitem", title: "UniItem", detail: "id estável (uniItemId fonte+chave), source, kind, title, text, url, author, date, score e meta — campos comuns a todas as fontes.", codeRef: "src/lib/uni/types.ts" },
      { id: "map", title: "Mapeamento por fonte", detail: "Cada fetch* converte o formato nativo (RSS, Atom, HTML, JSON de API) para UniItem; HTML é sanitizado (stripHtml), entidades decodificadas.", codeRef: "src/lib/uni/uniApi.ts" },
      { id: "meta", title: "Metadados preservados", detail: "O que não cabe no modelo comum vai para meta (engine, rank, vertical, combo do trends, pageid…) — nada é descartado.", codeRef: "meta: Record<string, unknown>" },
    ],
  },
  {
    id: "tratamento", num: "05", title: "Tratamento sem IA",
    subtitle: "Dedup, merge, ordenação, limites e validação — tudo determinístico.",
    aiMode: "sem-ia",
    inputs: ["UniItem[] de uma ou várias execuções"],
    outputs: ["UniItem[] tratado", "relatório de validação"],
    microSteps: [
      { id: "dedup", title: "Deduplicação", detail: "Por id estável; em merges multi-recurso o MAIOR score vence e as origens acumulam (meta.verticals).", codeRef: "dedupItems / fetchSuggestMulti" },
      { id: "clamp", title: "Limites por modo", detail: "O modo de coleta corta o volume por recurso (5/12/50/N) antes de chegar à tela — responsivo mesmo no modo max.", codeRef: "modeLimit" },
      { id: "cap", title: "Teto de combinações", detail: "Períodos × verticais do Trends são limitados (12 combos) para respeitar o rate-limit — o restante é informado, não executado às cegas.", codeRef: "cartesianCap" },
      { id: "validacao", title: "Validação", detail: "8 checks determinísticos (ids únicos, campos essenciais, tipos, cobertura) com resultado pass/warn/fail.", codeRef: "src/lib/dataPipeline.ts" },
    ],
    deepLinks: [{ path: "/pipeline-dados", label: "Pipeline de dados" }],
  },
  {
    id: "armazenamento", num: "06", title: "Armazenamento",
    subtitle: "Local-first: dataset, coleções, raws — tudo no dispositivo do usuário.",
    aiMode: "sem-ia",
    inputs: ["UniItem[] tratado", "reviews enriquecidos"],
    outputs: ["registros persistidos + pub/sub"],
    storage: ["aso:dataset:v1", "aso:uni-collections:v1", "rawStore (disco)"],
    microSteps: [
      { id: "dataset", title: "Dataset de apps", detail: "aso:dataset:v1 com cache de parse, revisão monotônica e índice O(1) — 27+ consumidores sem re-parsear JSON a cada leitura.", codeRef: "src/lib/datasetStore.ts" },
      { id: "colecoes", title: "Coleções Uni", detail: "Itens multi-fonte salvos em coleções nomeadas (aso:uni-collections:v1) — persistem entre sessões.", codeRef: "src/lib/uni/collections.ts" },
      { id: "pubsub", title: "Pub/sub", detail: "Todo store notifica subscribers — a UI inteira (menus, contadores, sidebars) reage sem reload.", codeRef: "padrão datasetStore" },
    ],
    deepLinks: [{ path: "/dados", label: "Dados brutos" }, { path: "/outputs", label: "Outputs" }],
  },
  {
    id: "derivacao", num: "07", title: "Bases derivadas (sem IA)",
    subtitle: "Agregados computados da base bruta — sempre re-deriváveis, nunca persistidos.",
    aiMode: "sem-ia",
    inputs: ["dataset + coleções"],
    outputs: ["digests, KPIs, distribuições, termos"],
    microSteps: [
      { id: "digest", title: "Digest do dataset", detail: "KPIs, distribuição, sentimento, timeline, wordcloud — memoizado por referência do array (WeakMap): todas as superfícies dividem UM cálculo.", codeRef: "src/lib/derivedData.ts" },
      { id: "perapp", title: "Stats por app", detail: "computePerAppStats cacheado por assinatura da entry — recoletar um app não invalida os outros.", codeRef: "dashboardAnalytics" },
      { id: "wordfreq", title: "Termos e distribuições Uni", detail: "uniWordFreq, uniSourceDist, uniKindDist, uniTopScored — puras, testáveis.", codeRef: "src/lib/uni/uniAnalytics.ts" },
      { id: "freshness", title: "Proveniência", detail: "datasetRev marca a revisão do dataset em cada geração — derivados desatualizados são sinalizados honestamente.", codeRef: "datasetRevision()" },
    ],
    deepLinks: [{ path: "/dashboard", label: "Dashboard" }],
  },
  {
    id: "visualizacao", num: "08", title: "Visualização",
    subtitle: "Gráficos e tabelas renderizados dos derivados — sem IA, sem rede.",
    aiMode: "sem-ia",
    inputs: ["digests derivados"],
    outputs: ["charts, tabelas, nuvens de termos"],
    microSteps: [
      { id: "charts", title: "Charts", detail: "UniTrendsChart (timeline), UniRegionsChart, UniTermsChart, UniSourceChart, UniTopScoredChart — um por combinação Trends no modo multi.", codeRef: "src/components/uni/UniCharts.tsx" },
      { id: "tabela", title: "Tabelas e cards", detail: "UniItemCard com expand, comentários sob demanda (YouTube/Reddit/HN/SE/Steam/Wikipedia), ações copiar/salvar.", codeRef: "src/components/uni/UniResults.tsx" },
      { id: "terminal", title: "Terminal Output", detail: "Log das runs em tempo real (SSE) + itens coletados formatados estilo _uni.py — visibilidade de status durante a coleta.", codeRef: "src/components/uni/UniOutputPanel.tsx" },
    ],
    deepLinks: [{ path: "/00", label: "Uni" }],
  },
  {
    id: "preparacao-ia", num: "09", title: "Preparação para IA",
    subtitle: "Serialização com budget, prompt com regra de evidência e anti-injeção.",
    aiMode: "para-ia",
    inputs: ["UniItem[] / reviews"],
    outputs: ["contexto orçado + system prompt"],
    microSteps: [
      { id: "serialize", title: "Serialização com budget", detail: "uniSerializeForAI corta em ~12k chars: um item por linha com fonte/tipo/título/score — o essencial cabe no contexto.", codeRef: "uniAnalytics.ts" },
      { id: "prompt", title: "System prompt compartilhado", detail: "buildUniSystemPrompt: regra de evidência (cite ou admita que não há) + aviso de conteúdo não confiável (anti prompt-injection).", codeRef: "src/lib/uni/uniAiPrompt.ts" },
      { id: "budget", title: "Budget de tokens", detail: "O servidor reserva overhead e amostra estratificadamente se estourar — métricas sempre sobre o total, nunca sobre a amostra.", codeRef: "server/routes/experimentAnalyze.ts" },
      { id: "perfil", title: "Perfil de hardware", detail: "Modo auto detecta tier/VRAM e escolhe modelo + num_ctx que cabem inteiros — sem swap silencioso.", codeRef: "server/lib/systemProfileCore.ts" },
    ],
  },
  {
    id: "analise-ia", num: "10", title: "Análise com IA",
    subtitle: "O modelo analisa os dados coletados com streaming ao vivo.",
    aiMode: "com-ia",
    inputs: ["contexto orçado", "pergunta do usuário"],
    outputs: ["markdown de análise (stream)"],
    storage: ["aso:ai-outputs:v1"],
    microSteps: [
      { id: "chat", title: "streamExperimentChat", detail: "Section \"os\" + systemPromptOverride (sem exigir apps) — mesmo endpoint unificado de todas as superfícies de IA.", codeRef: "src/lib/experimentChatApi.ts" },
      { id: "dispatcher", title: "Dispatcher multi-provider", detail: "resolveAI (auto/local/cloud) → streamLLM emite SSE OpenAI-compatível — o frontend não sabe qual provider está em uso.", codeRef: "server/routes/llmStream.ts" },
      { id: "streaming", title: "Streaming com cancelamento", detail: "AbortController por superfície; token a token no AIOutputCard com barra de status (tempo, ~tokens, tok/s).", codeRef: "AIOutputCard" },
      { id: "persist", title: "Saída persistida", detail: "saveAIOutput grava o markdown com escopo/proveniência — reload não perde a análise.", codeRef: "src/lib/aiOutputStore.ts" },
    ],
    deepLinks: [{ path: "/chat", label: "Chat" }, { path: "/experiments", label: "Experimentos" }],
  },
  {
    id: "ia-sobre-ia", num: "11", title: "IA analisa dados gerados por IA",
    subtitle: "Auditoria da própria saída: evidências, vieses, confiabilidade.",
    aiMode: "com-ia",
    inputs: ["markdown gerado pela IA", "dataset de origem"],
    outputs: ["crítica estruturada da resposta"],
    microSteps: [
      { id: "analisar", title: "Analisar com IA", detail: "Botão em TODA saída de IA (AIOutputCard): audita afirmação por afirmação contra o dataset, com confiabilidade e próximas ações.", codeRef: "src/components/shared/AIOutputCard.tsx" },
      { id: "validator", title: "Nós de validação no Canvas", detail: "validator (audita evidências) e challenge (evidências contrárias + vieses) — IA audita IA em pipeline visual.", codeRef: "nodeRegistry.ts" },
      { id: "sem-recursao", title: "Sem recursão", detail: "A análise da análise não oferece novo \"Analisar\" (analyzeWithAI={false}) — um nível de auditoria por saída.", codeRef: "AIOutputCard" },
    ],
    deepLinks: [{ path: "/canvas", label: "Canvas" }],
  },
  {
    id: "saidas", num: "12", title: "Saídas, artefatos e documentos",
    subtitle: "O que o sistema gera: análises, insights, sessões, artefatos, decks, relatórios.",
    aiMode: "hibrido",
    inputs: ["markdowns de IA", "derivados determinísticos"],
    outputs: ["outputs, insights, gerações, artefatos, documentos"],
    storage: ["aso:ai-outputs:v1", "aso:insights:v1", "aso:generations:v1", "aso:pipeline-artifacts:v1", "aso:presentations:v1"],
    microSteps: [
      { id: "outputs", title: "Outputs de IA", detail: "aso:ai-outputs:v1 — toda análise gerada, com escopo, seção e proveniência (provider/modelo).", codeRef: "aiOutputStore" },
      { id: "insights", title: "Insights", detail: "aso:insights:v1 — achados indexados por app/seção, consultáveis por outras superfícies (loop de feedback).", codeRef: "insightStore" },
      { id: "artefatos", title: "Artefatos do Pipeline", detail: "Vault com lineage (inputIds): cada insight rastreia até os dados brutos que o geraram.", codeRef: "pipeline/artifactStore.ts" },
      { id: "documentos", title: "Documentos e relatórios", detail: "buildPipelineDocument (multifonte), relatórios de agentes, decks de apresentação — markdown estruturado, copiável e baixável.", codeRef: "buildPipelineDocument / presentations" },
    ],
    deepLinks: [{ path: "/outputs", label: "Outputs" }, { path: "/apresentacoes", label: "Apresentações" }],
  },
  {
    id: "exportacao", num: "13", title: "Exportação e portabilidade",
    subtitle: "Tudo sai do sistema: copy, download, backup completo.",
    aiMode: "sem-ia",
    inputs: ["qualquer saída ou store"],
    outputs: [".md / .json / .csv / backup"],
    microSteps: [
      { id: "copydl", title: "Copy/Download padronizado", detail: "CopyDownloadButtons e AIOutputCard em toda saída — nada fica preso na UI.", codeRef: "src/components/shared/CopyDownloadButtons.tsx" },
      { id: "portability", title: "Backup completo", detail: "buildExportPayload exporta dataset + coleções + outputs (credenciais de IA NUNCA são exportadas); importar faz merge ou replace.", codeRef: "src/lib/dataPortability.ts" },
      { id: "outputs-page", title: "Página Outputs", detail: "Inventário chave-a-chave com bytes reais, exportar/apagar por chave ou grupo, reset de fábrica com confirmação.", codeRef: "src/lib/outputs.ts" },
    ],
    deepLinks: [{ path: "/outputs", label: "Outputs" }],
  },
];

/** Filtra estágios por modo de IA (todas = sem filtro). */
export function filterStages(mode: FlowAIMode | "todas"): FlowStage[] {
  if (mode === "todas") return FLOW_STAGES;
  return FLOW_STAGES.filter((s) => s.aiMode === mode);
}

/** Contagem de estágios por modo (para o seletor da página). */
export function stageCountByMode(): Record<FlowAIMode, number> {
  const counts: Record<FlowAIMode, number> = { "sem-ia": 0, "com-ia": 0, "para-ia": 0, hibrido: 0 };
  for (const s of FLOW_STAGES) counts[s.aiMode] += 1;
  return counts;
}
