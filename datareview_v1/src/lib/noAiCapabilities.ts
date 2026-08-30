/**
 * noAiCapabilities — matriz canônica de capacidades do sistema SEM IA.
 *
 * Princípio do produto: o sistema é COMPLETO sem IA (modo "none" é o padrão).
 * Cada verbo do usuário (configurar, pesquisar, coletar, ..., gerar, regerar)
 * tem pelo menos uma implementação determinística real. A IA (auto/local/cloud)
 * entra como superpoder ADICIONAL sobre a mesma base — nunca como requisito.
 *
 * Esta matriz é a fonte única de verdade consultada por:
 *  - src/test/noAiAudit.test.ts (guard permanente: integridade + fluxos reais)
 *  - docs/sem-ia.md (documento humano da auditoria)
 *
 * Regra de manutenção: ao adicionar uma capacidade sem IA nova, registrar aqui;
 * ao remover/renomear uma implementação, atualizar o ref (o guard falha se o
 * arquivo referenciado não existir).
 */

export interface CapabilityImpl {
  /** Caminho repo-relativo do arquivo + símbolo ("src/lib/collect.ts · collectApp"). */
  ref: string;
  /** Superfície(s) onde o usuário executa a capacidade. */
  surface: string;
  /** Observação curta (limite honesto, dependência, etc.). */
  note?: string;
}

export type CapabilityGroup =
  | "collect" // obter dados do mundo
  | "process" // tratar/normalizar/enriquecer
  | "analyze" // análise determinística
  | "manage" // CRUD + persistência + portabilidade
  | "create" // construir coisas novas em cima dos dados
  | "system"; // plataforma (config, navegação, comando, voz)

export interface NoAiCapability {
  id: string;
  /** Verbo canônico (como o usuário pede). */
  verb: string;
  /** Sinônimos cobertos pela mesma capacidade. */
  aliases: string[];
  group: CapabilityGroup;
  summary: string;
  implementations: CapabilityImpl[];
}

export const NO_AI_GROUP_ORDER: CapabilityGroup[] = [
  "collect",
  "process",
  "analyze",
  "manage",
  "create",
  "system",
];

export const NO_AI_GROUP_META: Record<CapabilityGroup, { label: string; desc: string }> = {
  collect: { label: "Obter dados", desc: "Pesquisar e coletar das fontes (lojas + multifonte)." },
  process: { label: "Tratar dados", desc: "Normalizar, enriquecer, deduplicar, ordenar, validar." },
  analyze: { label: "Analisar sem IA", desc: "Agregados, fatos, anomalias e relatórios determinísticos." },
  manage: { label: "Gerenciar dados", desc: "Selecionar, salvar, exportar, importar, editar, deletar." },
  create: { label: "Criar com os dados", desc: "Páginas, layouts, decks, agentes e fontes do usuário." },
  system: { label: "Plataforma", desc: "Configurar, navegar, comandar, monitorar, ouvir." },
};

export const NO_AI_CAPABILITIES: NoAiCapability[] = [
  // ---------------------------------------------------------------- coleta
  {
    id: "pesquisar",
    verb: "pesquisar",
    aliases: ["buscar", "procurar", "descobrir"],
    group: "collect",
    summary:
      "Busca de apps nas duas lojas (iTunes Search + google-play-scraper), Top Charts por tipo/país/quantidade, e busca multifonte em 33+ fontes públicas sem chave.",
    implementations: [
      { ref: "src/lib/appStoreApi.ts · searchApps", surface: "Home, QuickCollect, AppsPanel, /search" },
      { ref: "src/lib/googlePlayApi.ts · searchGooglePlayApps", surface: "Home, QuickCollect, AppsPanel, /search" },
      { ref: "src/components/TopCharts.tsx", surface: "Home (/) e Fluxo → Descobrir", note: "Grátis/pagos/arrecadação × 10-100 × região." },
      { ref: "src/lib/uni/uniApi.ts", surface: "/00 Uni e /pipeline-multifonte", note: "33 fontes builtin + custom do usuário." },
    ],
  },
  {
    id: "coletar",
    verb: "coletar",
    aliases: ["capturar", "baixar dados"],
    group: "collect",
    summary:
      "Coleta unificada com dedup limit-aware: Apple (amp-api + SSR multi-país + RSS) e Google Play (multi-sort), até 10.000 reviews/app. Multifonte coleta por termo em 32 fontes.",
    implementations: [
      { ref: "src/lib/collect.ts · collectApp", surface: "Todas as páginas (único entry point)" },
      { ref: "server/routes/appleReviews.ts", surface: "Servidor local :8787", note: "3 fases: SSR broad → amp-api deep → RSS fallback." },
      { ref: "server/routes/googlePlay.ts", surface: "Servidor local :8787" },
      { ref: "src/lib/uni/sourceRunner.ts · collectFromSource", surface: "/pipeline-multifonte, Uni, chat" },
      { ref: "src/lib/uni/customSources.ts", surface: "/00 Uni (painel Fontes custom)" },
    ],
  },
  {
    id: "selecionar",
    verb: "selecionar",
    aliases: ["escolher escopo", "marcar apps"],
    group: "manage",
    summary:
      "Seleção global de apps (store:id) compartilhada por TODAS as páginas; vazio = dataset inteiro. Todas/Nenhuma em toda lista selecionável.",
    implementations: [
      { ref: "src/context/SelectionContext.tsx · useSelection", surface: "Sistema inteiro" },
      { ref: "src/components/shared/QuickCollect.tsx", surface: "Empty states de 8+ páginas" },
    ],
  },
  // ---------------------------------------------------------------- processar
  {
    id: "tratar",
    verb: "tratar",
    aliases: ["processar", "normalizar", "limpar"],
    group: "process",
    summary:
      "Normalização dos payloads crus das lojas para AppInfo/ReviewEntry tipados na entrada; enriquecimento determinístico de cada review (sentimento, tamanho, idade, flags, faixa de qualidade).",
    implementations: [
      { ref: "src/lib/appStoreApi.ts · fetchReviews", surface: "Coleta Apple" },
      { ref: "src/lib/enrichment.ts · enrichReviews", surface: "Coleta (persiste enriquecido)", note: "Sem rede, sem IA — derivado puro." },
      { ref: "server/lib/uniConnectors.ts", surface: "Multifonte", note: "Conectores declarativos → UniItem padronizado." },
    ],
  },
  {
    id: "organizar",
    verb: "organizar",
    aliases: ["ordenar", "agrupar", "estruturar"],
    group: "process",
    summary:
      "Dataset indexado por store:id com revisão monotônica; ordenação de reviews por preferência (recentes/úteis/nota/misto); grupos de páginas do usuário.",
    implementations: [
      { ref: "src/lib/datasetStore.ts", surface: "Sistema inteiro", note: "Cache de parse + índice O(1) + datasetRevision." },
      { ref: "src/lib/collect.ts · collectApp", surface: "Coleta", note: "sortReviews interno antes de persistir." },
      { ref: "src/lib/pageGroups.ts", surface: "Sidebar esquerda (menu de páginas)" },
    ],
  },
  {
    id: "padronizar",
    verb: "padronizar",
    aliases: ["uniformizar", "esquema único"],
    group: "process",
    summary:
      "Esquemas únicos por domínio: AppInfo/ReviewEntry (lojas), UniItem (34 fontes), EnrichedReview (derivados), tokens de design e cores de gráfico.",
    implementations: [
      { ref: "src/lib/uni/types.ts · UniItem", surface: "Multifonte inteira" },
      { ref: "src/lib/uni/sourceFields.ts · SOURCE_FIELDS", surface: "Uni (/00)", note: "Mapa maximalista de campos por fonte." },
      { ref: "src/lib/chartColors.ts", surface: "Todos os gráficos" },
      { ref: "src/lib/tokenDefaults.ts · TOKEN_CATALOG", surface: "Design System, /configuracoes" },
    ],
  },
  {
    id: "validar",
    verb: "validar",
    aliases: ["auditar", "checar qualidade"],
    group: "process",
    summary:
      "Validação determinística do dataset: 8 checks (ids únicos, ratings 1-5, conteúdo, datas, campos essenciais, cobertura ≥60%, exclusivos por loja, enriquecimento).",
    implementations: [
      { ref: "src/lib/dataPipeline.ts · runValidation", surface: "/pipeline-dados, Hub 01 (Qualidade)" },
      { ref: "src/lib/enrichment.ts · appCoverage", surface: "/pipeline-dados (auditoria de campos)", note: "55 campos possíveis auditados por app." },
    ],
  },
  // ---------------------------------------------------------------- analisar
  {
    id: "analisar",
    verb: "analisar",
    aliases: ["investigar", "medir"],
    group: "analyze",
    summary:
      "Análise determinística completa: KPIs, distribuição de notas, sentimento, timeline, lojas, por app, versões, países, termos, reviews úteis, qualidade dos dados.",
    implementations: [
      { ref: "src/lib/dashboardAnalytics.ts · computeKPIs", surface: "/dashboard, Home, Hub 01, sidebars" },
      { ref: "src/lib/dashboardAnalytics.ts · computePerAppStats", surface: "Dashboard, Playground (benchmark), Pipeline" },
      { ref: "src/lib/pipeline/facts.ts · computeFacts", surface: "/pipeline, /case-ia, Fluxo → Sinais" },
      { ref: "src/lib/uni/uniAnalytics.ts", surface: "/00 Uni", note: "Frequência de termos, dist por fonte/kind, top score." },
    ],
  },
  {
    id: "detectar-anomalias",
    verb: "detectar anomalias",
    aliases: ["sinais", "alertas"],
    group: "analyze",
    summary:
      "Detectores determinísticos com números auditáveis: regressão por versão (Δ≤−0,7), pico de negatividade (+15pp/14d), pico de volume (≥2× mediana), app outlier (|Δ|≥0,8).",
    implementations: [
      { ref: "src/lib/pipeline/anomalies.ts · detectAnomalies", surface: "/pipeline, Fluxo → Sinais, Canvas (nó anomaly-detector)" },
    ],
  },
  {
    id: "comparar",
    verb: "comparar",
    aliases: ["benchmark", "competitivo"],
    group: "analyze",
    summary:
      "Comparativo determinístico entre apps: por loja, por app (% positivo, nota coletada, volume), heatmap app×notas e scatter nota×reviews.",
    implementations: [
      { ref: "src/lib/dashboardAnalytics.ts · computeStoreComparison", surface: "/dashboard, /compare" },
      { ref: "src/lib/dashboardAnalytics.ts · computePerAppStats", surface: "/compare, Playground (Score competitivo)" },
      { ref: "src/components/canvas/nodeRegistry.ts", surface: "/canvas (charts scatter/heatmap)", },
    ],
  },
  {
    id: "reanalisar",
    verb: "reanalisar",
    aliases: ["recomputar", "atualizar análise"],
    group: "analyze",
    summary:
      "Toda análise determinística é reexecutável a qualquer momento sem custo: a camada derivada é memoizada por referência e invalida sozinha quando o dataset muda (datasetRevision).",
    implementations: [
      { ref: "src/lib/derivedData.ts · getDatasetDigest", surface: "Todas as superfícies de dados" },
      { ref: "src/lib/derivedData.ts · getEntryDerived", surface: "Pipeline, validação, qualidade", note: "Versões+países+qualidade em 1 passagem." },
    ],
  },
  {
    id: "gerar-relatorio",
    verb: "gerar",
    aliases: ["regerar", "relatório", "documento"],
    group: "analyze",
    summary:
      "Geração determinística (sem IA): relatório de KPIs via chat ('gere um relatório'), deck executivo do dataset, documento do pipeline multifonte com resumo por fonte.",
    implementations: [
      { ref: "src/components/shared/UnifiedChatPanel.tsx", surface: "Chats (intent report)", note: "computeKPIs → markdown, sem IA." },
      { ref: "src/lib/presentations.ts · buildDatasetDeck", surface: "/apresentacoes, Fluxo → Apresentar" },
      { ref: "src/lib/uni/sourceRunner.ts · buildPipelineDocument", surface: "/pipeline-multifonte" },
    ],
  },
  // ---------------------------------------------------------------- gerenciar
  {
    id: "salvar",
    verb: "salvar",
    aliases: ["persistir", "guardar"],
    group: "manage",
    summary:
      "Persistência local-first com pub/sub: dataset, histórico de chats, sessões/gerações, artefatos do pipeline, saídas de IA, páginas/layouts/decks do usuário.",
    implementations: [
      { ref: "src/lib/datasetStore.ts · upsertDataset", surface: "Coleta (automático)" },
      { ref: "src/lib/sessionStore.ts · recordGeneration", surface: "Coletas e gerações" },
      { ref: "src/lib/pipeline/artifactStore.ts", surface: "/pipeline (vault de artefatos)" },
      { ref: "src/lib/chatHistoryStore.ts · saveSession", surface: "/chat, /chat-voz, Hub 01" },
    ],
  },
  {
    id: "exportar",
    verb: "exportar",
    aliases: ["baixar", "extrair"],
    group: "manage",
    summary:
      "Exportação em JSON/CSV/Markdown por app; backup completo ou por seleção de chaves; deck em HTML autocontido; pipeline do canvas em JSON; inventário por chave com bytes reais.",
    implementations: [
      { ref: "src/lib/exportUtils.ts", surface: "DataExplorer, Fluxo → Dados, Concept" },
      { ref: "src/lib/dataPortability.ts · exportAllData", surface: "/configuracoes → Data Hub, /outputs" },
      { ref: "src/lib/outputs.ts · downloadKey", surface: "/outputs, /configuracoes → Data Hub" },
      { ref: "src/lib/presentations.ts · deckToMarkdown", surface: "/apresentacoes" },
      { ref: "src/lib/canvasStore.ts · importPipeline", surface: "/canvas", note: "Exportar/importar pipeline JSON (ida e volta)." },
    ],
  },
  {
    id: "importar",
    verb: "importar",
    aliases: ["restaurar", "carregar backup"],
    group: "manage",
    summary:
      "Importação de backup com inspeção prévia (quantas chaves), modo merge ou replace; importação de pipeline/layout por arquivo JSON.",
    implementations: [
      { ref: "src/lib/dataPortability.ts · importAllData", surface: "/configuracoes → Data Hub, /outputs" },
      { ref: "src/lib/dataPortability.ts · inspectBackup", surface: "Prévia antes de importar" },
    ],
  },
  {
    id: "exibir",
    verb: "exibir",
    aliases: ["visualizar", "renderizar", "mostrar"],
    group: "manage",
    summary:
      "Visualização sem IA em todas as escalas: gráficos (bar/pie/area/line/scatter/heatmap/wordcloud), tabelas, JSON bruto, markdown, slides e páginas embutidas.",
    implementations: [
      { ref: "src/components/dashboard/DashboardCharts.tsx", surface: "/dashboard, Hub 01, sidebars" },
      { ref: "src/pages/DataExplorer.tsx", surface: "/dados (metadados + reviews + JSON bruto)" },
      { ref: "src/components/MarkdownRenderer.tsx", surface: "Todo conteúdo markdown", note: "Charts, tabelas GFM, HTML rico." },
      { ref: "src/components/shared/EmbeddedPage.tsx", surface: "Chats (páginas dentro da conversa)" },
    ],
  },
  {
    id: "editar",
    verb: "editar",
    aliases: ["renomear", "ajustar"],
    group: "manage",
    summary:
      "Edição de tudo que é do usuário: sessões de chat, decks e slides, páginas e layouts, prompts overrides, tokens de design, grupos de páginas.",
    implementations: [
      { ref: "src/lib/presentations.ts · updateSlide", surface: "/apresentacoes" },
      { ref: "src/lib/layoutTemplates.ts", surface: "/layouts" },
      { ref: "src/lib/promptOverrides.ts", surface: "/configuracoes → IA" },
      { ref: "src/lib/designTokens.ts", surface: "/configuracoes, /design-system" },
    ],
  },
  {
    id: "deletar",
    verb: "deletar",
    aliases: ["excluir", "apagar", "limpar"],
    group: "manage",
    summary:
      "Exclusão segura em todos os stores: confirmação padronizada + toast com Desfazer; reset de fábrica centralizado na Zona de perigo.",
    implementations: [
      { ref: "src/lib/ux.ts · confirmDestructive", surface: "Sistema inteiro (padrão único)" },
      { ref: "src/lib/outputs.ts · factoryReset", surface: "/configuracoes → Zona de perigo", note: "Wipe total com backup oferecido antes." },
      { ref: "src/lib/datasetStore.ts · removeDataset", surface: "DataExplorer, Experiments" },
    ],
  },
  {
    id: "reusar",
    verb: "reusar",
    aliases: ["usar", "aproveitar", "reaproveitar"],
    group: "manage",
    summary:
      "Colete uma vez, reutilize sempre: o dataset é compartilhado por todas as páginas; a coleta reusa o cache quando o limite já foi atendido (sem rede); derivados são memoizados por referência.",
    implementations: [
      { ref: "src/lib/collect.ts · collectApp", surface: "Coleta (dedup limit-aware)" },
      { ref: "src/lib/derivedData.ts", surface: "Todas as superfícies de dados" },
      { ref: "src/lib/aiOutputStore.ts · getAIOutput", surface: "Reidratação de saídas de IA salvas" },
    ],
  },
  // ---------------------------------------------------------------- criar
  {
    id: "criar",
    verb: "criar",
    aliases: ["construir", "montar"],
    group: "create",
    summary:
      "Criação sem IA: páginas customizadas com componentes reais (/p/:id), templates de layout, decks, agentes custom, fontes de dados custom, grupos de páginas, experimentos e findings do Lab.",
    implementations: [
      { ref: "src/lib/customPages.ts", surface: "/layouts → Salvar como página" },
      { ref: "src/lib/layoutTemplates.ts", surface: "/layouts" },
      { ref: "src/lib/agents.ts", surface: "/agentes (agentes custom)" },
      { ref: "src/lib/uni/customSources.ts", surface: "/00 Uni" },
      { ref: "src/lib/lab/repository.ts", surface: "/lab" },
    ],
  },
  {
    id: "apresentar",
    verb: "apresentar",
    aliases: ["slides", "deck"],
    group: "create",
    summary:
      "Decks com dados reais (KPIs, charts, quotes, tabelas) renderizados ao vivo do escopo, modo apresentação fullscreen e export HTML/markdown.",
    implementations: [
      { ref: "src/pages/Presentations.tsx", surface: "/apresentacoes" },
      { ref: "src/lib/presentations.ts · buildDatasetDeck", surface: "Deck executivo determinístico" },
    ],
  },
  {
    id: "montar-pipelines",
    verb: "montar pipelines",
    aliases: ["canvas", "fluxos"],
    group: "create",
    summary:
      "Canvas node-based com 38+ tipos de nó, incluindo família inteira de análise SEM IA (statistics, sentiment, themes, version, reviews, country, anomaly, aggregate, sampler) e undo/redo persistente.",
    implementations: [
      { ref: "src/lib/canvasStore.ts", surface: "/canvas" },
      { ref: "src/components/canvas/nodeRegistry.ts", surface: "/canvas", note: "Nós analysis/* não chamam IA." },
      { ref: "src/components/canvas/pipelineTemplates.ts", surface: "/canvas (18 templates, vários 100% determinísticos)" },
    ],
  },
  // ---------------------------------------------------------------- sistema
  {
    id: "configurar",
    verb: "configurar",
    aliases: ["personalizar", "ajustar sistema"],
    group: "system",
    summary:
      "Configuração total sem IA: coleta (limite/ordenação/região/idioma), aparência e fundo, tokens de design, tipografia por papel, sidebars, feature flags (63), layout composer.",
    implementations: [
      { ref: "src/pages/SettingsPage.tsx", surface: "/configuracoes" },
      { ref: "src/lib/featureFlags.ts", surface: "/configuracoes → Funcionalidades" },
      { ref: "src/lib/uiSettings.ts", surface: "Aparência avançada" },
      { ref: "src/lib/region.ts", surface: "Coleta (país/idioma da loja)" },
    ],
  },
  {
    id: "navegar",
    verb: "navegar",
    aliases: ["ir para", "abrir página"],
    group: "system",
    summary:
      "Navegação sem IA por menu numerado, busca de páginas, atalhos de teclado (g+letra), comando 'vá para X' no chat (resolve por label/número/path) e versões por URL (/vN, /latest, /oldest).",
    implementations: [
      { ref: "src/lib/pages.ts · PAGES", surface: "Sidebars, menus, /goto" },
      { ref: "src/lib/chatCommands.ts · resolvePagePath", surface: "Chats (intent goto)" },
      { ref: "src/components/VersionGateway.tsx", surface: "/v0 /v1 /v2 /latest /oldest" },
    ],
  },
  {
    id: "comandar",
    verb: "comandar por texto",
    aliases: ["comandos", "cli"],
    group: "system",
    summary:
      "O sistema inteiro é operável por texto sem IA: intents determinísticos PT-BR no chat (exibir/coletar/pesquisar/executar/relatório/ajuda) e CLI completo no Terminal e no Nexus OS.",
    implementations: [
      { ref: "src/lib/chatCommands.ts · detectChatIntent", surface: "Todos os chats" },
      { ref: "src/lib/os/commands.ts", surface: "/terminal, /os" },
      { ref: "src/components/shared/UnifiedChatPanel.tsx", surface: "Chat unificado (executa as ações)" },
    ],
  },
  {
    id: "ouvir",
    verb: "ouvir",
    aliases: ["ler em voz alta", "tts", "voz"],
    group: "system",
    summary:
      "Leitura em voz alta de qualquer saída (navegador ou Piper local no servidor) e ditado por voz (Web Speech ou Whisper local) — motores de voz locais, independentes de IA de análise.",
    implementations: [
      { ref: "src/lib/voice.ts · speakTracked", surface: "AIOutputCard (botão Ouvir), /chat-voz" },
      { ref: "src/lib/voiceServer.ts · speakSmart", surface: "Fallback servidor (Piper)" },
      { ref: "src/hooks/useVoiceInput.ts", surface: "Composers (ditado)" },
    ],
  },
  {
    id: "monitorar",
    verb: "monitorar",
    aliases: ["acompanhar", "atividade"],
    group: "system",
    summary:
      "Monitoramento local: log de atividades com fases, tarefas com 7 estados, indicador global no header, terminal vivo, timeline do Fluxo e histórico de sessões.",
    implementations: [
      { ref: "src/lib/activityStore.ts", surface: "SystemStatusIndicator, LiveTerminal, Fluxo" },
      { ref: "src/lib/statusSystem.ts", surface: "Estados e fases canônicos" },
      { ref: "src/lib/sessionStore.ts", surface: "/sessões, Hub 01" },
    ],
  },
];

export function capabilityById(id: string): NoAiCapability | undefined {
  return NO_AI_CAPABILITIES.find((c) => c.id === id);
}

/** Extrai o caminho do arquivo de um ref ("src/lib/x.ts · simbolo" → "src/lib/x.ts"). */
export function implFilePath(ref: string): string {
  return ref.split("·")[0].trim();
}

export interface CapabilityCoverage {
  total: number;
  byGroup: Record<CapabilityGroup, number>;
  implementations: number;
}

export function capabilityCoverage(): CapabilityCoverage {
  const byGroup = Object.fromEntries(NO_AI_GROUP_ORDER.map((g) => [g, 0])) as Record<CapabilityGroup, number>;
  let implementations = 0;
  for (const c of NO_AI_CAPABILITIES) {
    byGroup[c.group] += 1;
    implementations += c.implementations.length;
  }
  return { total: NO_AI_CAPABILITIES.length, byGroup, implementations };
}
