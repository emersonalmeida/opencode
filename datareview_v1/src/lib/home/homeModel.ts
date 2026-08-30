/**
 * Home (`/`) — MODELO de página inicial mobile-first e responsiva.
 *
 * Núcleo PURO (sem React/DOM) com o modelo estrutural da página:
 *
 *   ┌ STATUS BAR (topo, 100%) ┐
 *   ├ HEADER (ícone · TÍTULO · ícone) ┤
 *   ├ ABAS (ABA 1 · ABA 2 · ABA 3 · ABA 4) ┤
 *   ├ CONTEÚDO rolável (título + seções → componentes + botão) ┤
 *   ├ TASK BAR (5 ícones de navegação) ┤
 *   └ STATUS BAR (footer, 100%) ┘
 *
 * O conteúdo é um MODELO estrutural: os componentes são placeholders com
 * linhas skeleton (o "conteúdo" real entra depois), mas toda a interação é
 * real — abas trocam o conteúdo, botões navegam para páginas reais, a task
 * bar navega e as barras de status mostram modo/largura ao vivo.
 *
 * Mobile-first e container-relacional: o modo (phone/tablet/desktop) vem da
 * LARGURA DO CONTAINER (ResizeObserver), nunca de media query de viewport —
 * a página se adapta mesmo dentro de um centro estreito do AppShell.
 */
import {
  House, Compass, Sparkles, Settings2, Search, MessageSquare, LayoutDashboard,
  type LucideIcon,
} from "lucide-react";

/** Componente placeholder de uma seção (card com linhas de conteúdo). */
export interface HomeComponentSpec {
  id: string;
  title: string;
  /** Texto exibido pelo botão de info do card. */
  desc: string;
  /** Larguras (%) das linhas skeleton do conteúdo, em ordem. */
  lines: number[];
}

/** Seção do conteúdo: título + componentes + botão de ação full-width. */
export interface HomeSectionSpec {
  id: string;
  title: string;
  components: HomeComponentSpec[];
  action: { label: string; path: string };
}

/** Aba do modelo (ABA 1–4 do desenho). */
export interface HomeTabSpec {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Título do conteúdo quando a aba está ativa. */
  pageTitle: string;
  sections: HomeSectionSpec[];
}

/** Item da task bar (navegação real). */
export interface HomeTaskSpec {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
}

export const HOME_TABS: HomeTabSpec[] = [
  {
    id: "inicio",
    label: "Início",
    icon: House,
    pageTitle: "Visão geral",
    sections: [
      {
        id: "resumo",
        title: "Resumo",
        action: { label: "Abrir Dashboard", path: "/dashboard" },
        components: [
          { id: "indicadores", title: "Indicadores", desc: "KPIs do dataset: apps coletados, reviews, nota média e sentimento.", lines: [100, 82, 64] },
          { id: "atividade", title: "Atividade recente", desc: "Linha do tempo das coletas e gerações mais recentes do sistema.", lines: [100, 74] },
        ],
      },
      {
        id: "comecar",
        title: "Comece por aqui",
        action: { label: "Coletar apps", path: "/inicio" },
        components: [
          { id: "primeiros-passos", title: "Primeiros passos", desc: "Busque um app, colete os reviews e explore as análises — tudo local.", lines: [100, 88, 70, 52] },
        ],
      },
    ],
  },
  {
    id: "descobrir",
    label: "Descobrir",
    icon: Compass,
    pageTitle: "Descobrir apps e fontes",
    sections: [
      {
        id: "lojas",
        title: "Explorar lojas",
        action: { label: "Abrir Busca", path: "/search" },
        components: [
          { id: "busca-apps", title: "Busca de apps", desc: "Busque na Apple App Store e no Google Play ao mesmo tempo.", lines: [100, 80, 58] },
          { id: "top-charts", title: "Top charts", desc: "Os líderes de cada loja por tipo, quantidade e região.", lines: [100, 68] },
        ],
      },
      {
        id: "fontes",
        title: "Fontes de dados",
        action: { label: "Abrir Descoberta", path: "/descoberta" },
        components: [
          { id: "radar", title: "Radar de fontes", desc: "Fontes públicas sem chave (Wikipédia, cripto, podcasts, clima, GitHub…).", lines: [100, 84, 60] },
        ],
      },
    ],
  },
  {
    id: "analisar",
    label: "Analisar",
    icon: Sparkles,
    pageTitle: "Análises e inteligência",
    sections: [
      {
        id: "inteligencia",
        title: "Inteligência",
        action: { label: "Abrir Experimentos", path: "/experiments" },
        components: [
          { id: "analises-ia", title: "Análises de IA", desc: "12 seções de análise sobre os apps coletados — com ou sem IA.", lines: [100, 78, 62] },
          { id: "graficos", title: "Gráficos", desc: "Distribuição de notas, sentimento, timeline e comparações.", lines: [100, 70] },
        ],
      },
      {
        id: "conversar",
        title: "Conversar",
        action: { label: "Abrir Chat", path: "/chat" },
        components: [
          { id: "chat-ia", title: "Chat com IA", desc: "Converse sobre os dados, peça análises e execute comandos do sistema.", lines: [100, 86, 66, 48] },
        ],
      },
    ],
  },
  {
    id: "sistema",
    label: "Sistema",
    icon: Settings2,
    pageTitle: "Sistema e configuração",
    sections: [
      {
        id: "configuracao",
        title: "Configuração",
        action: { label: "Abrir Configurações", path: "/configuracoes" },
        components: [
          { id: "preferencias", title: "Preferências", desc: "Tema, cor principal, tipografia, motion e densidade da interface.", lines: [100, 76, 56] },
          { id: "recursos", title: "Recursos", desc: "Feature flags: ligue e desligue páginas e comportamentos do sistema.", lines: [100, 64] },
        ],
      },
      {
        id: "dados-locais",
        title: "Dados locais",
        action: { label: "Abrir Outputs", path: "/outputs" },
        components: [
          { id: "saidas", title: "Saídas e backups", desc: "Tudo que o sistema gerou: exportar, importar, gerenciar e resetar.", lines: [100, 90, 72] },
        ],
      },
    ],
  },
];

/** Task bar (5 ícones) — navegação real, com estado ativo pela rota atual. */
export const HOME_TASKBAR: HomeTaskSpec[] = [
  { id: "home", label: "Início", icon: House, path: "/" },
  { id: "busca", label: "Busca", icon: Search, path: "/search" },
  { id: "chat", label: "Chat", icon: MessageSquare, path: "/chat" },
  { id: "dash", label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { id: "config", label: "Config", icon: Settings2, path: "/configuracoes" },
];

/** Modo de apresentação por LARGURA DO CONTAINER (não viewport). */
export type HomeShellMode = "phone" | "tablet" | "desktop";

export function homeShellMode(width: number): HomeShellMode {
  if (width < 640) return "phone";
  if (width < 1024) return "tablet";
  return "desktop";
}

/** Largura máxima do conteúdo por modo (contêiner centralizado). */
export function contentMaxWidth(mode: HomeShellMode): string {
  if (mode === "desktop") return "max-w-5xl";
  if (mode === "tablet") return "max-w-3xl";
  return "max-w-full";
}

/** Colunas do grid de componentes de cada seção, por modo. */
export function componentGridCols(mode: HomeShellMode): string {
  if (mode === "desktop") return "sm:grid-cols-2 lg:grid-cols-3";
  if (mode === "tablet") return "sm:grid-cols-2";
  return "grid-cols-1";
}

export function getHomeTab(id: string): HomeTabSpec {
  return HOME_TABS.find((t) => t.id === id) ?? HOME_TABS[0];
}

// --- Aba ativa persistida (sobrevive a reloads) ---

const TAB_KEY = "aso:home-tab:v1";

export function loadHomeTab(): string {
  try {
    const raw = localStorage.getItem(TAB_KEY);
    return raw && HOME_TABS.some((t) => t.id === raw) ? raw : HOME_TABS[0].id;
  } catch {
    return HOME_TABS[0].id;
  }
}

export function saveHomeTab(id: string): void {
  if (!HOME_TABS.some((t) => t.id === id)) return;
  try { localStorage.setItem(TAB_KEY, id); } catch { /* quota */ }
}
