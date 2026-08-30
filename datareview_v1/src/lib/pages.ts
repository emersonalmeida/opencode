import {
  Boxes,
  Home, House, LayoutDashboard, FlaskConical, MessageSquare, MessagesSquare, MessageSquarePlus, Workflow, Briefcase,
  Lightbulb, Crown, BrainCircuit, Compass, Database, FlaskRound, Shapes,
  Search, GitCompare, History, Settings2, Network, Bot, Cpu, DatabaseZap,
  Terminal as TermIcon, Presentation, Route as RouteIcon, PackageOpen,
  Waypoints, BookOpenCheck, Atom, Palette, Sparkles, AudioLines, LayoutTemplate, Paperclip, Globe,
  Columns3, GitBranch, GitMerge, Layers, ArrowRightLeft, LayoutGrid, Gauge, Play, TrendingUp,
  PanelsTopLeft, Orbit, ListChecks, ScanSearch, Key } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface PageItem {
  path: string;
  label: string;
  icon: LucideIcon;
  desc: string;
  /** Tecla de atalho na Home (opcional). */
  hint?: string;
  /** Link externo/outro app: renderizado como <a href> (reload completo),
   *  não como rota interna do SPA. */
  external?: boolean;
}

/** Central registry of all navigable app pages. */
/** Central registry of all navigable app pages.
 *
 * A ORDEM do array é a ordem lógica de apresentação (modelo mental do
 * primeiro acesso: começar → entender os dados → conversar/analisar →
 * construir → apresentar → sistema) e define a NUMERAÇÃO exibida nos menus
 * (`pageNumber`). Página nova = adicionar aqui na posição lógica — todos os
 * menus (sidebar esquerda, grupos, quick actions) atualizam sozinhos.
 */
export const PAGES: PageItem[] = [
  { path: "/auditoria", label: "Auditoria", icon: ScanSearch, desc: "Auditoria de fontes e dados: tudo sobre todas as fontes, fonte a fonte — endpoints, parâmetros, capacidades, variações, combinações, saídas, derivações, limites e confiabilidade" },
  { path: "/chaves", label: "Chaves API", icon: Key, desc: "Adicionar chaves das fontes e da IA via API (BYOK), com links oficiais para criação" },
  { path: "/testes-fontes", label: "Testes de fontes", icon: FlaskConical, desc: "Testa TODAS as fontes ao vivo com um termo — separado por probe e unificado, terminal em tempo real" },
  { path: "/", label: "Início", icon: Home, desc: "Página inicial do sistema: hero e Top Charts das lojas (duplicata enxuta da Coleta" },
  { path: "/home", label: "Home", icon: House, desc: "Página inicial mobile-first com conteúdo real: saudação contextual, estatísticas do dataset ao vivo, ações rápidas e acesso às áreas do sistema" },
  { path: "/inicio", label: "Coleta", icon: Home, desc: "Busca e coleta de apps (página inicial clássica)" },
  { path: "/boas-vindas", label: "Boas-vindas", icon: Orbit, desc: "A porta de entrada: boot de chegada, anfitrião que guia cada etapa e visão viva do sistema — o primeiro contato" },
  { path: "/demo", label: "Demo", icon: Play, desc: "Demo pública de 90s: o sistema funcionando com dados de exemplo — sem cadastro, sem rede, sem IA" },
  { path: "/00", label: "Uni", icon: Layers, desc: "Dados multi-fonte: pesquisar, coletar, tratar, organizar, visualizar, analisar com IA e salvar (Suggest, Trends, SERP, YouTube, Reddit…)", hint: "n" },
  { path: "/suggest", label: "Suggest", icon: Sparkles, desc: "Extrator maximalista de autocomplete: termo × regiões × verticais × grupos de expansão (alfabeto, questões, intenções…) → grafo de descoberta com proveniência", hint: "s" },
  { path: "/trending", label: "Trending", icon: TrendingUp, desc: "Extrator do Google Trends “Em alta”: região × janelas → lista completa de trends com volume, crescimento, consultas relacionadas e notícias", hint: "t" },
  { path: "/descoberta", label: "Descoberta", icon: Compass, desc: "Radar de fontes novas sem chave (Wikipédia, cripto, podcasts, música, jogos, clima, Brasil, npm, GitHub, notícias…) + investigador de URLs", hint: "x" },
  { path: "/one", label: "One Page", icon: Globe, desc: "Todas as fontes numa única página: slides fullscreen com scroll snap (uma fonte por tela) — pesquisar, configurar, visualizar, analisar, salvar e conversar de ponta a ponta", hint: "y" },
  { path: "/pipeline-multifonte", label: "Pipeline Multifonte", icon: GitMerge, desc: "Automação de coleta em várias fontes → análise determinística + IA → documento gerado", hint: "m" },
  { path: "/fluxo-dados", label: "Fluxo de dados", icon: ArrowRightLeft, desc: "Mapa micro/macro do pipeline de dados ponta a ponta: busca → coleta → tratamento → IA → artefatos" },
  { path: "/01", label: "Hub 01", icon: Columns3, desc: "Hub analítico: top/bottom bar, pesquisa/coleta, chat IA completo e pipelines num só workspace", hint: "u" },
  { path: "/search", label: "Busca", icon: Search, desc: "Resultados de busca de apps" },
  { path: "/fluxo", label: "Fluxo", icon: Waypoints, desc: "Jornada completa: todas as páginas em seções guiadas", hint: "f" },
  { path: "/jornada", label: "Jornada", icon: RouteIcon, desc: "Fluxo guiado de ponta a ponta: descobrir → apresentar", hint: "j" },
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, desc: "Analytics e KPIs", hint: "h" },
  { path: "/dados", label: "Dados brutos", icon: Database, desc: "Tudo que foi coletado" },
  { path: "/pipeline-dados", label: "Pipeline de dados", icon: DatabaseZap, desc: "Auditoria e validação da coleta" },
  { path: "/compare", label: "Comparar", icon: GitCompare, desc: "Comparativo de apps" },
  { path: "/chat", label: "Chat", icon: MessageSquare, desc: "Conversa com IA", hint: "c" },
  { path: "/chat-voz", label: "Chat com voz", icon: AudioLines, desc: "Assistente estilo ChatGPT/Jarvis: voz↔texto (Whisper local), fala, ouve, executa tudo", hint: "z" },
  { path: "/chat-arquivos", label: "Chat com arquivos", icon: Paperclip, desc: "Conversa com IA enriquecida pelos seus arquivos (CSV, TXT, MD, JSON) — anexe e pergunte", hint: "q" },
  { path: "/conversa", label: "Conversa", icon: MessagesSquare, desc: "Apenas o chat: todo o sistema via conversa (input + config + output), com e sem IA", hint: "b" },
  { path: "/ia", label: "Central de IA", icon: Sparkles, desc: "Tudo sobre a IA: como funciona, capacidades, config, análises e playground" },
  { path: "/experiments", label: "Experimentos", icon: FlaskConical, desc: "Análises de IA", hint: "e" },
  { path: "/metodologias", label: "Metodologias", icon: BookOpenCheck, desc: "Métodos de pesquisa/análise + pipelines de IA" },
  { path: "/pipeline", label: "Pipeline", icon: Network, desc: "Motor de conhecimento recursivo" },
  { path: "/atlas", label: "Analysis Atlas", icon: Search, desc: "Catálogo de análises (Analysis OS)", hint: "a" },
  { path: "/agentes", label: "Agentes", icon: Bot, desc: "Agentes por segmento com pipelines de trabalho" },
  { path: "/decision-center", label: "Decision Center", icon: BrainCircuit, desc: "Decisões por persona", hint: "d" },
  { path: "/lab", label: "Lab", icon: FlaskRound, desc: "Descoberta e incubação de produtos" },
  { path: "/canvas", label: "Canvas", icon: Workflow, desc: "Pipeline visual", hint: "v" },
  { path: "/git", label: "Git", icon: GitBranch, desc: "Visual Git Canvas: mapa vivo do projeto (branches, commits, PRs, agentes, CI/CD, deploys)", hint: "g" },
  { path: "/design", label: "Design Canvas", icon: Shapes, desc: "Figma-like: design system ao vivo" },
  { path: "/layouts", label: "Layouts", icon: LayoutTemplate, desc: "Construtor de telas: linhas, colunas ajustáveis, blocos expansíveis com componentes reais", hint: "l" },
  { path: "/estrutura", label: "Estrutura", icon: LayoutGrid, desc: "Desenho estrutural de páginas: presets de colunas/blocos expansíveis sem conteúdo + modo dinâmico", hint: "r" },
  { path: "/playground", label: "Playground", icon: Lightbulb, desc: "Ideias e testes" },
  { path: "/teste", label: "Test Center", icon: FlaskConical, desc: "Validação completa do sistema" },
  { path: "/concept", label: "Conceito", icon: Crown, desc: "Workspace funcional", hint: "o" },
  { path: "/apresentacoes", label: "Apresentações", icon: Presentation, desc: "Decks de slides profissionais do dataset", hint: "p" },
  { path: "/sessions", label: "Sessões", icon: History, desc: "Histórico unificado: coletas + gerações" },
  { path: "/outputs", label: "Outputs", icon: PackageOpen, desc: "Tudo que o sistema gerou: exportar, importar, gerenciar" },
  { path: "/uso", label: "Uso do sistema", icon: Gauge, desc: "Telemetria local: páginas abertas, comandos, gerações e cobertura — dados para decidir consolidações" },
  { path: "/terminal", label: "Terminal", icon: TermIcon, desc: "Shell inteligente com tabs/splits e IA" },
  { path: "/os", label: "Nexus OS", icon: Cpu, desc: "Sistema operacional inteligente (CLI + IA)" },
  { path: "/nucleo", label: "Núcleo", icon: Atom, desc: "Core Page: sinais, pipeline do Fluxo e memória" },
  { path: "/design-system", label: "Design System", icon: Palette, desc: "Tokens, componentes e padrões com previews ao vivo" },
  { path: "/componentes", label: "Componentes", icon: Boxes, desc: "Catálogo vivo de todos os componentes por página: repetições, reuso e previews" },
  { path: "/inventario", label: "Inventário", icon: Boxes, desc: "Todos os componentes do sistema renderizados ao vivo, agrupados por similaridade", hint: "i" },
  { path: "/feedback", label: "Feedback", icon: MessageSquarePlus, desc: "Reporte bugs, sugira melhorias e proponha features com evidências — ajude a evoluir o sistema", hint: "k" },
  { path: "/case-ia", label: "Case IA", icon: Briefcase, desc: "Case gerado pela IA com o olhar de qualquer perfil profissional sobre os dados coletados", hint: "w" },
  { path: "/case", label: "Explorar", icon: Compass, desc: "Como o produto foi construído" },
  { path: "/all", label: "All", icon: ListChecks, desc: "Toda a jornada do usuário num só lugar: cada página embutida ao vivo como tarefa sequenciada (referência de refatoração)" },
  { path: "/configuracoes", label: "Configurações", icon: Settings2, desc: "Todas as opções do sistema em um só lugar" },
  { path: "/frontend-starter/", label: "Frontend Starter", icon: Boxes, desc: "Design system reutilizável (outro app nesta origem)", external: true },
  { path: "/ui", label: "UI", icon: PanelsTopLeft, desc: "Estrutura de layout pura (sem conteúdo): barras de status, barra de ferramentas, 5 colunas inteligentes (expansíveis/recolhíveis/redimensionáveis) e footer — mobile-first e responsiva" },
];

/** Número de ordem da página no menu (01, 02, 03…), derivado da posição no
 *  registry PAGES. Retorna "" para paths fora do registry. */
export function pageNumber(path: string): string {
  const i = PAGES.findIndex((p) => p.path === path);
  return i < 0 ? "" : String(i + 1).padStart(2, "0");
}

/** Label numerada para menus: "01. Início". */
export function numberedLabel(path: string, label: string): string {
  const n = pageNumber(path);
  return n ? `${n}. ${label}` : label;
}

