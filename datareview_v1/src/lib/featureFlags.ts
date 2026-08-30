/**
 * Store de feature flags — permite ao usuário ligar/desligar qualquer recurso
 * ou página importante do sistema pela página de Configurações
 * (`/configuracoes`). Persistido no localStorage (`aso:feature-flags:v1`) para
 * as preferências sobreviverem a reloads.
 *
 * Cada flag tem key estável, label legível, descrição, grupo e default.
 * Recursos desligados somem da navegação e suas rotas são curto-circuitadas.
 * Páginas núcleo (Home, Dados, Configurações) não podem ser desligadas — ficam
 * sempre disponíveis para o usuário sempre conseguir voltar às configurações.
 */
import { useEffect, useState } from "react";

export type FeatureGroup = "pages" | "intelligence" | "canvas" | "ui" | "data";

export interface FeatureFlag {
  key: string;
  label: string;
  description: string;
  group: FeatureGroup;
  /** Always-on flags cannot be toggled off (keeps the system reachable). */
  locked?: boolean;
  /**
   * Padrão desligada em instalações novas (labs/superfícies experimentais —
   * regra "superfície é orçamento", Onda 1.1). Quem já tem a flag persistida
   * mantém o próprio estado; o usuário liga explicitamente se quiser.
   */
  defaultOff?: boolean;
}

export const FEATURE_FLAGS: FeatureFlag[] = [
  // --- Pages (navigation + route) ---
  { key: "page.auditoria", label: "Auditoria", description: "Auditoria de fontes e dados: tudo sobre todas as fontes, fonte a fonte — endpoints, parâmetros, capacidades, saídas, limites e confiabilidade.", group: "pages" },
  { key: "page.chaves", label: "Chaves API", description: "Adicionar chaves das fontes e da IA via API (BYOK). Links oficiais para criação.", group: "pages" },
  { key: "page.testes-fontes", label: "Testes de fontes", description: "Testa TODAS as fontes ao vivo com um termo — separado por probe e unificado, com terminal em tempo real.", group: "pages" },
  { key: "page.demo", label: "Demo", description: "Demo pública de 90s com dataset de exemplo — sem cadastro, sem rede, sem IA.", group: "pages" },
  { key: "page.home", label: "Home", description: "Página inicial modelo (mobile-first, responsiva): status bar, header, abas, conteúdo em seções, task bar e footer.", group: "pages", locked: true },
  { key: "page.ui", label: "UI", description: "Estrutura de layout pura (mobile-first, responsiva): barras de status, toolbar, 5 colunas inteligentes e footer. Guardada no fim do grupo Backup do menu.", group: "pages" },
  { key: "page.inicio", label: "Coleta", description: "Busca e coleta de apps (página inicial clássica).", group: "pages" },
  { key: "page.boas-vindas", label: "Boas-vindas", description: "A porta de entrada do sistema: boot de chegada, anfitrião-guia e visão viva do sistema.", group: "pages" },
  { key: "page.00", label: "Uni", description: "Workspace de dados multi-fonte: pesquisar, coletar, tratar, organizar, visualizar, analisar com IA e salvar (Suggest, Trends, SERP, YouTube, Reddit…).", group: "pages" },
  { key: "page.suggest", label: "Suggest", description: "Extrator maximalista do Google Suggest: parâmetros (região/idioma/cliente/vertical) × grupos de expansão → grafo de descoberta com proveniência completa.", group: "pages" },
  { key: "page.trending", label: "Trending", description: "Extrator do Google Trends “Em alta”: região × janelas (4h/24h/48h/7d) → lista completa de trends com volume, crescimento, consultas relacionadas e notícias, com KPIs, filtros e exportação.", group: "pages" },
  { key: "page.descoberta", label: "Descoberta", description: "Radar de fontes novas sem chave (Wikipédia top/views, neste dia, cripto, podcasts, música, jogos, clima, dados do Brasil, npm, GitHub trending, notícias, Mastodon) em seções independentes + investigador de URLs (detecta a entidade e busca detalhes).", group: "pages" },
  { key: "page.one", label: "One Page", description: "Todas as fontes numa única página: slides fullscreen com scroll snap vertical (uma fonte por tela) — pesquisar, configurar, visualizar, analisar, salvar e conversar de ponta a ponta, com busca global e navegação por pontos/teclado.", group: "pages" },
  { key: "page.pipeline-multifonte", label: "Pipeline Multifonte", description: "Automação de coleta em várias fontes → análise determinística + IA → documento gerado.", group: "pages" },
  { key: "page.fluxo-dados", label: "Fluxo de dados", description: "Mapa micro/macro do pipeline de dados ponta a ponta (busca → coleta → tratamento → IA → artefatos).", group: "pages" },
  { key: "page.01", label: "01", description: "Hub analítico (lab): top/bottom bar, pesquisa/coleta, chat IA completo e pipelines num único workspace de 3 colunas. Lab opt-in (Onda 2.5) — compete com Fluxo/Conversa/Chat.", group: "pages", defaultOff: true },
  { key: "page.chat-voz", label: "Chat com voz", description: "Assistente de voz estilo ChatGPT/Jarvis: voz↔texto (Whisper local), fala, ouve e executa tudo (comandos, análises, agentes) numa conversa.", group: "pages" },
  { key: "page.chat-arquivos", label: "Chat com arquivos", description: "Conversa com a IA enriquecida pelos arquivos do usuário (upload de CSV, TXT, MD, JSON como contexto).", group: "pages" },
  { key: "page.conversa", label: "Conversa", description: "Página apenas-chat (lab): duplica o /chat — o canônico é o Chat com páginas/componentes embutidos. Lab opt-in (Onda 2.4).", group: "pages", defaultOff: true },
  { key: "page.fluxo", label: "Fluxo", description: "Jornada completa: todas as páginas do sistema em seções guiadas (missão → descobrir → … → monitorar).", group: "pages" },
  { key: "page.dados", label: "Dados brutos", description: "Explorador de tudo que foi coletado.", group: "pages", locked: true },
  { key: "page.dashboard", label: "Dashboard", description: "Analytics e KPIs agregados.", group: "pages" },
  { key: "page.experiments", label: "Experimentos", description: "Análises de IA por seção.", group: "pages" },
  { key: "page.chat", label: "Chat", description: "Conversa com IA sobre os apps.", group: "pages" },
  { key: "page.canvas", label: "Canvas", description: "Pipeline visual node-based.", group: "pages" },
  { key: "page.git", label: "Git", description: "Visual Git Canvas: sistema operacional visual para desenvolvimento baseado em Git (mapa vivo do projeto).", group: "pages" },
  { key: "page.lab", label: "Lab", description: "Descoberta e incubação de produtos.", group: "pages" },
  { key: "page.decision-center", label: "Decision Center", description: "Decisões por persona.", group: "pages" },
  { key: "page.concept", label: "Conceito", description: "Workspace funcional ponta a ponta.", group: "pages", defaultOff: true },
  { key: "page.estrutura", label: "Estrutura", description: "Desenho estrutural de páginas: presets de colunas/blocos expansíveis sem conteúdo, modo dinâmico e salvar em Minhas páginas.", group: "pages" },
  { key: "page.case-ia", label: "Case IA", description: "IA gera case completo (resumo, perguntas, respostas com evidência, plano de ação) por perfil profissional sobre os dados coletados.", group: "pages" },
  { key: "page.feedback", label: "Feedback", description: "Reporte de bugs/melhorias/features com evidências, votos e workflow de status (exportável em Markdown).", group: "pages" },
  { key: "page.inventario", label: "Inventário", description: "Todos os componentes do sistema renderizados ao vivo (ComponentLiveRender), agrupados por similaridade com busca.", group: "pages" },
  { key: "page.layouts", label: "Layouts", description: "Construtor de templates de layout: colunas responsivas ajustáveis, divisões horizontais e blocos expansíveis (estrutural, sem conteúdo).", group: "pages" },
  { key: "page.playground", label: "Playground", description: "Ideias e protótipos funcionais.", group: "pages", defaultOff: true },
  { key: "page.teste", label: "Test Center", description: "Centro de testes do sistema.", group: "pages", defaultOff: true },
  { key: "page.design", label: "Design Canvas", description: "Page builder estilo Figma.", group: "pages" },
  { key: "page.design-system", label: "Design System", description: "Catálogo vivo do design system: tokens, tipografia, componentes, padrões e acessibilidade (estilo Pajamas/Storybook).", group: "pages" },
  { key: "page.componentes", label: "Componentes", description: "Catálogo vivo de todos os componentes do sistema por página: repetições, reuso e previews ao vivo.", group: "pages" },
  { key: "page.atlas", label: "Analysis Atlas", description: "Catálogo de análises (Analysis OS).", group: "pages" },
  { key: "page.pipeline", label: "Pipeline", description: "Motor de conhecimento recursivo: fatos → IA → decisão, com orquestrador e lineage.", group: "pages" },
  { key: "page.pipeline-dados", label: "Pipeline de dados", description: "Auditoria e validação do pipeline de coleta→dataset com qualidade e cobertura de campos.", group: "pages" },
  { key: "page.outputs", label: "Outputs", description: "Inventário e gestão de tudo que o sistema gerou: dados coletados, saídas sem/com IA, projetos e arquivos — exportar, importar, apagar, resetar.", group: "pages" },
  { key: "page.uso", label: "Uso do sistema", description: "Telemetria LOCAL (zero rede): páginas mais abertas, comandos mais usados, gerações e cobertura — dados reais para decidir consolidações.", group: "pages" },
  { key: "page.terminal", label: "Terminal", description: "Shell inteligente com tabs, splits, autocomplete e IA embutida.", group: "pages" },
  { key: "page.apresentacoes", label: "Apresentações", description: "Decks de slides profissionais gerados do dataset (temas, IA, export HTML/MD).", group: "pages" },
  { key: "page.jornada", label: "Jornada", description: "Pipeline guiado de ponta a ponta: descobrir → coletar → analisar → visualizar → decidir → apresentar.", group: "pages" },
  { key: "page.nucleo", label: "Núcleo", description: "Core Page (lab): sinais do sistema, pipeline do Fluxo e memória — subconjunto do Fluxo. Lab opt-in (Onda 2.5).", group: "pages", defaultOff: true },
  { key: "page.agentes", label: "Agentes", description: "Agentes de IA por segmento/perfil com pipelines de trabalho executáveis.", group: "pages" },
  { key: "page.sessions", label: "Sessões", description: "Histórico unificado de coletas + gerações.", group: "pages" },
  { key: "page.case", label: "Explorar", description: "Investigação narrativa do produto.", group: "pages" },
  { key: "page.all", label: "All", description: "Toda a jornada do usuário num só lugar: cada página do sistema embutida ao vivo como tarefa sequenciada (mapa de refatoração).", group: "pages" },
  { key: "page.configuracoes", label: "Configurações", description: "Esta página — todas as opções do sistema.", group: "pages", locked: true },
  { key: "page.os", label: "Nexus OS", description: "Sistema operacional inteligente: CLI + IA + aprendizado por uso.", group: "pages" },
  { key: "page.ia", label: "Central de IA", description: "Tudo sobre a IA do sistema: como funciona, capacidades, configuração, análises executáveis, playground e histórico de gerações.", group: "pages" },
  { key: "page.metodologias", label: "Metodologias", description: "Catálogo de métodos (pesquisa/UX/design/produto/negócio/marketing/tech/suporte) + pipelines de IA.", group: "pages" },

  // --- Intelligence / IA ---
  { key: "ai.analyze", label: "Análises de IA", description: "Geração de análises e relatórios por IA (Canvas, Atlas, Experimentos).", group: "intelligence" },
  { key: "ai.chat", label: "Chat de IA", description: "Assistente conversacional nas sidebars.", group: "intelligence" },
  { key: "ai.review-reply", label: "Gerador de resposta a review", description: "Protótipo do Playground que responde reviews.", group: "intelligence" },

  // --- Canvas ---
  { key: "canvas.auto-output", label: "Saída automática", description: "Adiciona um nó de saída após cada nó terminar.", group: "canvas" },
  { key: "canvas.selection-explore", label: "Explorar seleção", description: "Permite aprofundar trechos selecionados do output com IA.", group: "canvas" },
  { key: "canvas.snap-to-grid", label: "Alinhamento à grade (padrão)", description: "Alinhar nós a uma grade ao adicioná-los.", group: "canvas" },
  { key: "canvas.minimap", label: "MiniMapa (padrão)", description: "Mostrar minimapa por padrão no Canvas.", group: "canvas" },

  // --- UI ---
  { key: "ui.left-sidebar", label: "Sidebar esquerda", description: "Apps coletados, chats e config.", group: "ui" },
  { key: "ui.right-sidebar", label: "Sidebar direita (IA)", description: "Assistente de IA, artefatos e gráficos.", group: "ui" },
  { key: "ui.onboarding-tour", label: "Tour guiado", description: "Exibir tour de boas-vindas.", group: "ui" },
  { key: "ui.compact-tables", label: "Tabelas compactas", description: "Renderizar tabelas em modo denso.", group: "ui" },
  { key: "ui.window-tiling", label: "Janelas flutuantes (window tiling)", description: "Modo desktop OS: janelas arrastáveis, redimensionáveis e encaixáveis (drag, resize, snap, context menu). Recurso experimental.", group: "ui" },
  { key: "ui.panel-auto-expand", label: "Painéis abertos por padrão", description: "Todo painel/acordeão nasce expandido com conteúdo completo; o usuário pode recolher.", group: "ui" },
  { key: "ui.snap-grid", label: "Alinhamento à grade (interface)", description: "Alinhar janelas e colunas a uma grade ao arrastar/redimensionar.", group: "ui" },
  { key: "ui.compact-density", label: "Densidade compacta", description: "Reduz espaçamentos em toda a interface para mais conteúdo por tela.", group: "ui" },
  { key: "ui.layout-composer", label: "Compositor de layout (widgets)", description: "Permite montar a própria interface: mover widgets (menu, assistente de IA, painéis da página) entre colunas por arrastar/soltar ou menu, com splits verticais. O layout padrão é preservado até você mover algo.", group: "ui" },
  { key: "ui.page-groups", label: "Grupos de páginas (workspaces)", description: "Menu de páginas organizado em grupos expansíveis customizáveis (criar/editar/excluir). Desligado = lista plana de todas as páginas.", group: "ui" },

  // --- Data ---
  { key: "data.app-store", label: "Apple App Store", description: "Coletar apps e reviews da Apple.", group: "data" },
  { key: "data.google-play", label: "Google Play", description: "Coletar apps e reviews do Google Play.", group: "data" },
  { key: "data.multi-country", label: "Coleta multi-país", description: "Coletar reviews de vários storefronts.", group: "data" },
];

const STORAGE_KEY = "aso:feature-flags:v1";
const GROUP_LABEL: Record<FeatureGroup, string> = {
  pages: "Páginas & navegação",
  intelligence: "Inteligência Artificial",
  canvas: "Canvas",
  ui: "Interface",
  data: "Fontes de dados",
};
export const FEATURE_GROUP_LABEL = GROUP_LABEL;
export const FEATURE_GROUP_ORDER: FeatureGroup[] = ["pages", "intelligence", "canvas", "ui", "data"];

type FlagMap = Record<string, boolean>;

const DEFAULTS: FlagMap = Object.fromEntries(FEATURE_FLAGS.map((f) => [f.key, !f.defaultOff]));

function load(): FlagMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as FlagMap;
    // Migração: a flag antiga page.assistente virou page.chat-voz (rename 2026-08-21).
    if (typeof parsed["page.assistente"] === "boolean" && parsed["page.chat-voz"] === undefined) {
      parsed["page.chat-voz"] = parsed["page.assistente"];
    }
    delete parsed["page.assistente"];
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

let current: FlagMap = load();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(current)); } catch { /* ignore */ }
}

/** Read a single flag. Reactive when used via `useFeatureFlag`/`useFeatureFlags`. */
export function isFeatureEnabled(key: string): boolean {
  return current[key] !== false;
}

/** Set a single flag (persisted). Locked flags are ignored. */
export function setFeatureFlag(key: string, enabled: boolean) {
  const flag = FEATURE_FLAGS.find((f) => f.key === key);
  if (!flag || flag.locked) return;
  if (current[key] === enabled) return;
  current = { ...current, [key]: enabled };
  persist();
  emit();
}

/** Bulk-set many flags at once (e.g. presets). */
export function setFeatureFlags(patch: FlagMap) {
  const next: FlagMap = { ...current };
  for (const [k, v] of Object.entries(patch)) {
    const flag = FEATURE_FLAGS.find((f) => f.key === k);
    if (flag && !flag.locked) next[k] = v;
  }
  current = next;
  persist();
  emit();
}

/** Reset all flags to defaults. */
export function resetFeatureFlags() {
  current = { ...DEFAULTS };
  persist();
  emit();
}

/** Snapshot hook (re-renders on any change). */
export function useFeatureFlags(): FlagMap {
  const [snap, setSnap] = useState<FlagMap>(() => ({ ...current }));
  useEffect(() => {
    const l = () => setSnap({ ...current });
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return snap;
}

/** Single-flag reactive hook. */
export function useFeatureFlag(key: string): boolean {
  return useFeatureFlags()[key] !== false;
}

/** Map a page path (from `pages.ts`) to its flag key. */
export function pagePathToFlag(path: string): string | null {
  const seg = path.replace(/^\//, "").split("/")[0] || "home";
  const key = `page.${seg}`;
  return FEATURE_FLAGS.some((f) => f.key === key) ? key : null;
}
