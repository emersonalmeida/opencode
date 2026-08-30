/**
 * RouteSidebars — registra automaticamente as sidebars INTERNAS padrão de
 * cada página (modelo de 5 colunas), a partir da rota ativa.
 *
 *   [Externa: páginas] [Interna E: Contexto/Seções/Ajuda] [CENTRO] [Interna D: Insights/Atividade] [Externa: IA]
 *
 * Páginas com sidebars internas PRÓPRIAS (Atlas, Canvas, Pipeline, Concept,
 * DecisionCenter, DesignCanvas, Flow, OS) ficam de fora — elas registram via
 * PageSidebar/PageTabsSidebar diretamente. Redirects/404 não registram nada.
 */
import { useLocation } from "react-router-dom";
import { PAGES } from "@/lib/pages";
import { StandardPageSidebars } from "@/components/pageSidebars/StandardPageSidebars";
import { DS_SECTION_ANCHORS } from "@/lib/designSystem";
import { FLOW_STAGES } from "@/lib/dataFlowMap";
import { AUDIT_SOURCES } from "@/lib/audit/auditSources";
import { auditAnchor } from "@/lib/audit/auditModel";
import type { PageAnchor } from "@/components/pageSidebars/kit";

/** Rotas com sidebars internas próprias ou sem necessidade de sidebar interna. */
const EXCLUDED: RegExp[] = [
  /^\/ui$/, // UI: shell estrutural próprio de 5 colunas (barras/toolbar/footer)
  /^\/$/, // Início: hero + Top Charts, sem sidebars internas
  /^\/home$/, // Home mobile-first: seções próprias sem sidebars internas
  /^\/os/, /^\/canvas/, /^\/fluxo$/, /^\/atlas/, /^\/pipeline$/,
  /^\/concept/, /^\/decision-center/, /^\/design$/, /^\/chat-voz/, /^\/chat-arquivos/, /^\/01/, /^\/testes-fontes/,
  /^\/compare/, // redirect picker
  /^\/git/, // Visual Git Canvas: tela cheia com barra própria
  /^\/componentes/, // catálogo vivo: sidebars internas próprias (CatalogSidebars)
  /^\/00/, // Uni: sidebar interna própria (aba Output em tempo real)
];

const CASE_ANCHORS: PageAnchor[] = [
  { id: "opening", label: "Abertura" },
  { id: "question", label: "A pergunta" },
  { id: "technical", label: "Investigação técnica" },
  { id: "evolution", label: "Evolução" },
  { id: "decisions", label: "Decisões" },
  { id: "evidence", label: "Evidência" },
  { id: "ai-interaction", label: "Interação com IA" },
  { id: "skills", label: "Skills de IA" },
  { id: "evaluation", label: "Avaliação" },
  { id: "ai-dev", label: "Desenvolvimento" },
  { id: "system", label: "Sistema" },
  { id: "failures", label: "O que mudou" },
  { id: "current", label: "Produto atual" },
  { id: "explore", label: "Explorar" },
];

interface RouteConfig {
  pageId: string;
  match: RegExp;
  pagePath: string; // path no registry PAGES (label/desc/icon)
  anchors?: PageAnchor[];
  tips?: string[];
  /** aba ativa por padrão na sidebar interna esquerda (ex.: "secoes"). */
  defaultLeftTab?: string;
}

const ROUTE_CONFIGS: RouteConfig[] = [
  {
    pageId: "chaves", match: /^\/chaves/, pagePath: "/chaves",
    anchors: [
      { id: "keys-fontes", label: "Fontes" },
      { id: "keys-ia", label: "IA via API" },
    ],
    tips: [
      "Salvar persiste no localStorage do usuário (aso:api-keys:v1); Limpar remove tudo.",
      "BYOK de IA nunca vai para o servidor — o provedor é chamado direto do navegador.",
    ],
  },
  {
    pageId: "auditoria", match: /^\/auditoria/, pagePath: "/auditoria",
    anchors: [
      { id: "audit-index", label: "Índice de fontes" },
      ...AUDIT_SOURCES.map((s) => ({
        id: auditAnchor(s.id),
        label: `${String(s.order).padStart(2, "0")} · ${s.name}`,
      })),
    ],
    tips: [
      "Cada fonte é uma seção expansível: endpoints, parâmetros, capacidades, saídas, limites e confiabilidade.",
      "Badges azuis marcam lacunas reais — o que a fonte oferece e o sistema ainda não coleta.",
      "Copie/baixe a auditoria de cada fonte em JSON pelo header do bloco.",
    ],
  },
  {
    pageId: "home", match: /^\/$/, pagePath: "/",
    anchors: [
      { id: "home-status", label: "Status" },
      { id: "home-tabs", label: "Abas" },
      { id: "home-content", label: "Conteúdo" },
      { id: "home-taskbar", label: "Task bar" },
    ],
    tips: [
      "O modelo é mobile-first e container-relacional: estreite o centro e veja o layout mudar de phone → tablet → desktop.",
      "As abas trocam o conteúdo; os botões e a task bar navegam para páginas reais do sistema.",
      "A página UI (antiga home estrutural) foi guardada no fim do grupo Backup do menu — rota /ui.",
    ],
  },
  { pageId: "demo", match: /^\/demo/, pagePath: "/demo", tips: ["O demo roda 100% local com dados de exemplo — sem rede e sem IA.", "Remova os dados de exemplo para começar do zero, ou colete um app real."] },
  { pageId: "inicio", match: /^\/inicio/, pagePath: "/inicio", tips: ["Busque apps na barra global ou na aba Apps da assistente.", "Os Top Charts exploram as lojas por tipo, quantidade e região."] },
  {
    pageId: "boas-vindas", match: /^\/boas-vindas/, pagePath: "/boas-vindas",
    anchors: [
      { id: "welcome-hero", label: "Saudação" },
      { id: "welcome-host", label: "Anfitrião" },
      { id: "welcome-stats", label: "Números ao vivo" },
      { id: "welcome-tour", label: "Tour de capacidades" },
    ],
    tips: ["O boot de entrada é sempre pulável (botão ou Esc).", "O anfitrião adapta a saudação: primeira visita, retorno e estado dos seus dados mudam a conversa.", "A demo de 90s mostra o sistema funcionando sem rede e sem IA."],
  },
  {
    pageId: "all", match: /^\/all/, pagePath: "/all",
    anchors: [
      { id: "all-ato-conhecer", label: "01 · Primeiro contato" },
      { id: "all-ato-coletar", label: "02 · Coletar dados" },
      { id: "all-ato-entender", label: "03 · Entender os dados" },
      { id: "all-ato-analisar", label: "04 · Conversar e analisar" },
      { id: "all-ato-construir", label: "05 · Construir" },
      { id: "all-ato-apresentar", label: "06 · Apresentar" },
      { id: "all-ato-gerenciar", label: "07 · Gerenciar resultados" },
      { id: "all-ato-sistema", label: "08 · Sistema e referência" },
    ],
    tips: ["Siga a ordem dos atos: sem coleta de dados, nada do resto rende.", "Cada seção tem 3 níveis (fixo com scroll, expandido sem scroll, recolhido) — recolhido não carrega o iframe.", "Marque a tarefa como concluída: o progresso fica salvo entre visitas."],
  },
  {
    pageId: "suggest", match: /^\/suggest/, pagePath: "/suggest",
    anchors: [
      { id: "suggest-params", label: "Parâmetros e expansões" },
      { id: "suggest-ia", label: "Análise com IA" },
    ],
    tips: ["Combine regiões (gl), verticais (ds) e grupos de expansão — cada combo coleta todas as sondas e o merge preserva a proveniência.", "Salvar na Uni transforma a descoberta em coleção reutilizável na /00.", "Servidor executa em lotes com cache — coletas repetidas são instantâneas."],
  },
  {
    pageId: "trending", match: /^\/trending/, pagePath: "/trending",
    anchors: [
      { id: "trending-params", label: "Fonte e parâmetros" },
      { id: "trending-ia", label: "Análise com IA" },
    ],
    tips: ["A janela define o rendimento: 4h ≈ 25 trends, 24h ≈ 230, 48h ≈ 630, 7d ≈ 1.800.", "O modo Completo une as 4 janelas com dedup — cada trend mostra em quais janelas apareceu.", "Notícias e imagens vêm do RSS top-10 do Google (união honesta com o ranking interno).", "Salvar na Uni transforma a coleta em coleção reutilizável na /00."],
  },
  {
    pageId: "descoberta", match: /^\/descoberta/, pagePath: "/descoberta",
    anchors: [
      { id: "discover-resolver", label: "Investigar um link" },
      { id: "discover-ia", label: "Análise com IA" },
    ],
    tips: ["Cada seção é independente: colete uma fonte sem esperar as outras.", "O investigador de URLs detecta o tipo da entidade (vídeo, artigo, repo, app…) e busca os detalhes na API pública.", "Fontes sem parâmetro obrigatório já coletam ao abrir a seção.", "Selecione uma fonte coletada no seletor de escopo e salve como coleção da Uni (/00)."],
  },
  { pageId: "one", match: /^\/one/, pagePath: "/one", tips: ["Role para trocar de fonte — cada seção ocupa a tela inteira.", "A busca global (topo) coleta em todas as fontes de uma vez.", "Navegue pelos pontos à direita ou com PageUp/PageDown/↑/↓.", "Cada seção expande/recolhe (3 níveis), seleciona itens e salva na Uni."] },
  { pageId: "nucleo", match: /^\/nucleo/, pagePath: "/nucleo", tips: ["O Núcleo agrega sinais e memória do sistema inteiro."] },
  { pageId: "jornada", match: /^\/jornada/, pagePath: "/jornada", tips: ["Cada etapa reutiliza os componentes reais do sistema.", "O progresso é persistido localmente."] },
  { pageId: "dados", match: /^\/dados/, pagePath: "/dados", tips: ["Nada aqui é amostra: é exatamente o que está armazenado.", "A aba IA de cada app conversa sobre os dados brutos."] },
  { pageId: "dashboard", match: /^\/dashboard/, pagePath: "/dashboard", tips: ["Use a seleção global (aba Contexto) para recortar o dataset.", "O painel de IA gera 12 seções de análise."] },
  { pageId: "experiments", match: /^\/experiments/, pagePath: "/experiments", tips: ["A IA roda só sobre os apps selecionados.", "Resultados ficam persistidos e reidratam após reload."] },
  { pageId: "chat", match: /^\/chat$/, pagePath: "/chat", tips: ["A conversa usa os apps selecionados como contexto.", "Conversas ficam salvas na aba Chats da assistente."] },
  { pageId: "conversa", match: /^\/conversa/, pagePath: "/conversa", tips: ["Apenas o chat: exibir/coletar/pesquisar/executar/relatar — tudo por comando, com e sem IA.", "Peça \"ajuda\" para ver todos os comandos sem IA."] },
  { pageId: "lab", match: /^\/lab/, pagePath: "/lab", tips: ["Descobertas validadas viram candidatos a produto.", "O Opportunity Score pondera dimensões 0–100."] },
  { pageId: "metodologias", match: /^\/metodologias/, pagePath: "/metodologias" },
  { pageId: "playground", match: /^\/playground/, pagePath: "/playground", tips: ["Cada card é um protótipo funcional sobre o dataset."] },
  { pageId: "teste", match: /^\/teste/, pagePath: "/teste", tips: ["Catálogo SAFE executável, histórico persistido, testes nunca executam sozinhos."] },
  { pageId: "case-ia", match: /^\/case-ia/, pagePath: "/case-ia", tips: ["Escolha o perfil (CEO, PM, UX…) — a lente muda a estrutura do case.", "Preparação determinística roda antes (fatos + anomalias) — a IA cita números computados.", "QuickCollect na seção de dados — pesquise e colete sem sair da página.", "Salvar como página leva o case a Minhas páginas (/p/:id)."] },
  { pageId: "feedback", match: /^\/feedback/, pagePath: "/feedback", tips: ["Anexe prints/evidências (imagem ou texto).", "Contexto automático: rota atual + modo de IA.", "Vote nas ideias e acompanhe o status (novo → feito)."] },
  { pageId: "inventario", match: /^\/inventario/, pagePath: "/inventario", tips: ["Ao vivo renderiza o componente real (lazy) — quem exige props/contexto mostra o erro honesto.", "Badges: reuso ×N (padronizado), específico, sem consumidores.", "Busca filtra mantendo a agrupação por similaridade."] },
  { pageId: "estrutura", match: /^\/estrutura/, pagePath: "/estrutura", tips: ["Modo Estrutural edita a forma (sem dados); modo Dinâmico renderiza os componentes vinculados com dados reais.", "Presets: grid, 1/3/5 colunas, laterais divididas em 2 ou 3 — todos sem conteúdo, só a forma.", "Selecione um bloco para vincular um componente do sistema (galeria com busca).", "Salvar como página publica em Minhas páginas (/p/:id)."] },
  { pageId: "layouts", match: /^\/layouts/, pagePath: "/layouts", anchors: [
    { id: "canvas", label: "Canvas" },
    { id: "salvar", label: "Salvar template" },
    { id: "templates", label: "Biblioteca" },
  ], tips: ["Os handles ajustam largura (entre colunas) e altura (abaixo de blocos e de linhas) — drag ou setas do teclado.", "Cada bloco tem 3 níveis de expansão (recolhido/padrão/expandido) e pode ser dividido na vertical (lado a lado) ou em abas.", "Dividir empilha um componente a mais na coluna; linhas no topo/rodapé adicionam faixas horizontais (header, status).", "Vincule componentes reais (busca, chat IA, gráficos, Top Charts, qualidade dos dados…) — o modo Visualizar renderiza a tela funcional com dados coletados.", "Templates salvos viram telas reutilizáveis — no modo Visualizar, o seletor acima do canvas troca de tela na hora."] },
  { pageId: "pipeline-dados", match: /^\/pipeline-dados/, pagePath: "/pipeline-dados", tips: ["A validação roda 8 checks determinísticos sobre o dataset."] },
  { pageId: "outputs", match: /^\/outputs/, pagePath: "/outputs", tips: ["Exporte tudo como backup e importe depois (merge ou replace)."] },
  {
    pageId: "uso", match: /^\/uso/, pagePath: "/uso",
    anchors: [
      { id: "uso-paginas", label: "Páginas mais abertas" },
      { id: "uso-comandos", label: "Comandos e ações" },
      { id: "uso-geracoes", label: "Gerações" },
      { id: "uso-atividade", label: "Atividade" },
      { id: "uso-cobertura", label: "Cobertura" },
      { id: "uso-relatorio", label: "Relatório" },
    ],
    tips: ["A telemetria é 100% local — nada sai da máquina.", "Páginas nunca abertas são candidatas a revisão/consolidação."],
  },
  { pageId: "terminal", match: /^\/terminal/, pagePath: "/terminal", tips: ["Texto sem \"/\" vira prompt direto para a IA.", "Ctrl+T nova aba · Ctrl+S/Ctrl+D splits · Ctrl+W fecha."] },
  { pageId: "apresentacoes", match: /^\/apresentacoes/, pagePath: "/apresentacoes", tips: ["Gere decks do dataset ou converta markdown da IA em slides."] },
  { pageId: "agentes", match: /^\/agentes/, pagePath: "/agentes", tips: ["Cada agente executa um pipeline de etapas de IA.", "Você pode criar agentes customizados."] },
  { pageId: "sessions", match: /^\/sessions/, pagePath: "/sessions", tips: ["Toda coleta e geração de IA fica registrada aqui."] },
  {
    pageId: "configuracoes", match: /^\/configuracoes/, pagePath: "/configuracoes",
    anchors: [
      { id: "conf-interface", label: "Interface" },
      { id: "conf-design", label: "Design System" },
      { id: "conf-layout", label: "Layout & widgets" },
      { id: "conf-dados", label: "Dados & backup" },
      { id: "conf-fontes", label: "Fontes" },
      { id: "conf-paginas", label: "Páginas" },
      { id: "conf-funcionalidades", label: "Funcionalidades" },
      { id: "conf-geral", label: "Gerais" },
      { id: "conf-reset", label: "Zona de perigo" },
    ],
    tips: ["Use a busca de funcionalidades para filtrar as flags.", "Cada bloco tem 3 níveis de expansão e exporta suas configurações em JSON.", "O bloco Layout & widgets controla o compositor de interface (widgets movíveis)."],
    defaultLeftTab: "secoes",
  },
  { pageId: "search", match: /^\/search/, pagePath: "/search" },
  {
    pageId: "ia", match: /^\/ia/, pagePath: "/ia",
    anchors: [
      { id: "ia-visao-geral", label: "Visão geral" },
      { id: "ia-como-funciona", label: "Como funciona" },
      { id: "ia-config", label: "Configuração" },
      { id: "ia-capacidades", label: "Capacidades" },
      { id: "ia-analises", label: "Análises & pipelines" },
      { id: "ia-playground", label: "Playground" },
      { id: "ia-historico", label: "O que a IA já fez" },
    ],
    tips: ["O escopo honra a seleção global (aba Apps); vazio = dataset inteiro.", "Os prompts da IA são editáveis no bloco Configuração.", "Tudo que a IA gera fica persistido — reload não apaga."],
  },
  {
    pageId: "design-system", match: /^\/design-system/, pagePath: "/design-system",
    anchors: DS_SECTION_ANCHORS,
    tips: ["Cada seção exporta seu conteúdo (copy/download).", "Os previews usam os componentes reais — mudanças de token refletem na hora."],
  },
  { pageId: "case", match: /^\/case/, pagePath: "/case", anchors: CASE_ANCHORS },
  { pageId: "app", match: /^\/app\//, pagePath: "/dados", tips: ["A análise IA do app é gerada sob demanda (nada automático)."] },
  {
    pageId: "pipeline-multifonte", match: /^\/pipeline-multifonte/, pagePath: "/pipeline-multifonte",
    tips: [
      "Fontes que precisam de URL (Web, RSS/Atom) são puladas com a razão quando o termo não é URL.",
      "O documento é gerado deterministicamente mesmo sem IA — com IA, a seção de análise é anexada.",
    ],
  },
  {
    pageId: "fluxo-dados", match: /^\/fluxo-dados/, pagePath: "/fluxo-dados",
    anchors: FLOW_STAGES.map((s) => ({ id: `flow-${s.id}`, label: `${s.num}. ${s.title}` })),
    tips: [
      "O mapa macro no topo navega por âncora para cada estágio.",
      "Filtre por modo de IA para ver só as etapas determinísticas ou só as de IA.",
    ],
  },
];

/** Resolve (puro, testável) a config de sidebars internas padrão para uma rota. */
export function resolveRouteSidebarsConfig(pathname: string): RouteConfig | null {
  if (EXCLUDED.some((r) => r.test(pathname))) return null;
  return ROUTE_CONFIGS.find((c) => c.match.test(pathname)) ?? null;
}

export function RouteSidebars() {
  const { pathname } = useLocation();
  const cfg = resolveRouteSidebarsConfig(pathname);
  if (!cfg) return null;
  const page = PAGES.find((p) => p.path === cfg.pagePath) ?? PAGES[0];
  const Icon = page.icon;
  return (
    <StandardPageSidebars
      pageId={cfg.pageId}
      title={page.label}
      subtitle={page.desc}
      icon={<Icon className="h-4 w-4" />}
      anchors={cfg.anchors}
      help={{ description: page.desc, tips: cfg.tips }}
      defaultLeftTab={cfg.defaultLeftTab}
    />
  );
}
