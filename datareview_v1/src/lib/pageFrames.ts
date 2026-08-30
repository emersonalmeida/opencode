/**
 * Registry de páginas renderizáveis ao vivo na página `/componentes`.
 *
 * Cada página real do sistema (registry `PAGES`) pode ser renderizada dentro
 * de um frame (PageFrame) via iframe same-origin para inspeção visual com
 * dados reais. A montagem é preguiçosa (só quando o frame é expandido).
 *
 * Páginas que não podem ser renderizadas ao vivo declaram `note` com a
 * razão honesta (ex.: a própria página do catálogo — recursão; rotas de
 * redirecionamento puro).
 */
import type { ComponentType } from "react";
import { PAGES } from "@/lib/pages";

export interface PageEmbedSpec {
  /** Path da página no registry PAGES. */
  path: string;
  /** Loader dinâmico do componente da página. */
  loader: () => Promise<{ default: ComponentType<Record<string, never>> }>;
  /** Quando definido, a página NÃO é renderizada — `note` explica o motivo. */
  note?: string;
}

const SELF_NOTE =
  "Esta é a própria página do catálogo — renderizá-la aqui criaria recursão infinita. Você já está vendo todos os componentes dela nesta tela.";
const REDIRECT_NOTE =
  "Rota de redirecionamento: prepara os apps selecionados e abre o Detalhe do app com a comparação inline. Use o menu Comparar de qualquer página.";

/** Mapa path → spec. Declarado na MESMA ordem lógica do registry PAGES. */
export const PAGE_EMBEDS: Record<string, PageEmbedSpec> = {
  "/auditoria": { path: "/auditoria", loader: () => import("@/pages/Audit") },
  "/chaves": { path: "/chaves", loader: () => import("@/pages/Keys") },
  "/testes-fontes": { path: "/testes-fontes", loader: () => import("@/pages/SourceTests") },
  "/": { path: "/", loader: () => import("@/pages/HomeLite") },
  "/home": { path: "/home", loader: () => import("@/pages/Home") },
  "/inicio": { path: "/inicio", loader: () => import("@/pages/Index") },
  "/boas-vindas": { path: "/boas-vindas", loader: () => import("@/pages/Welcome") },
  "/demo": { path: "/demo", loader: () => import("@/pages/DemoPage") },
  "/00": { path: "/00", loader: () => import("@/pages/Uni") },
  "/suggest": { path: "/suggest", loader: () => import("@/pages/Suggest") },
  "/trending": { path: "/trending", loader: () => import("@/pages/Trending") },
  "/descoberta": { path: "/descoberta", loader: () => import("@/pages/Discover") },
  "/one": { path: "/one", loader: () => import("@/pages/One") },
  "/pipeline-multifonte": { path: "/pipeline-multifonte", loader: () => import("@/pages/MultiPipeline") },
  "/fluxo-dados": { path: "/fluxo-dados", loader: () => import("@/pages/DataFlow") },
  "/01": { path: "/01", loader: () => import("@/pages/Page01") },
  "/search": { path: "/search", loader: () => import("@/pages/SearchResults") },
  "/fluxo": { path: "/fluxo", loader: () => import("@/pages/Flow") },
  "/jornada": { path: "/jornada", loader: () => import("@/pages/Journey") },
  "/dashboard": { path: "/dashboard", loader: () => import("@/pages/Dashboard") },
  "/dados": { path: "/dados", loader: () => import("@/pages/DataExplorer") },
  "/pipeline-dados": { path: "/pipeline-dados", loader: () => import("@/pages/DataPipeline") },
  "/compare": { path: "/compare", loader: () => import("@/pages/CompareRedirect"), note: REDIRECT_NOTE },
  "/chat": { path: "/chat", loader: () => import("@/pages/Chat") },
  "/chat-voz": { path: "/chat-voz", loader: () => import("@/pages/ChatVoz") },
  "/chat-arquivos": { path: "/chat-arquivos", loader: () => import("@/pages/FileChat") },
  "/conversa": { path: "/conversa", loader: () => import("@/pages/Conversa") },
  "/ia": { path: "/ia", loader: () => import("@/pages/AICentral") },
  "/experiments": { path: "/experiments", loader: () => import("@/pages/Experiments") },
  "/metodologias": { path: "/metodologias", loader: () => import("@/pages/Methodologies") },
  "/pipeline": { path: "/pipeline", loader: () => import("@/pages/Pipeline") },
  "/atlas": { path: "/atlas", loader: () => import("@/pages/AnalysisAtlas") },
  "/agentes": { path: "/agentes", loader: () => import("@/pages/Agentes") },
  "/decision-center": { path: "/decision-center", loader: () => import("@/pages/DecisionCenter") },
  "/lab": { path: "/lab", loader: () => import("@/pages/Lab") },
  "/canvas": { path: "/canvas", loader: () => import("@/pages/Canvas") },
  "/git": { path: "/git", loader: () => import("@/pages/GitCanvas") },
  "/design": { path: "/design", loader: () => import("@/pages/DesignCanvas") },
  "/layouts": { path: "/layouts", loader: () => import("@/pages/LayoutBuilder") },
  "/estrutura": { path: "/estrutura", loader: () => import("@/pages/Estrutura") },
  "/inventario": { path: "/inventario", loader: () => import("@/pages/Inventario") },
  "/feedback": { path: "/feedback", loader: () => import("@/pages/Feedback") },
  "/case-ia": { path: "/case-ia", loader: () => import("@/pages/CaseIa") },
  "/playground": { path: "/playground", loader: () => import("@/pages/Playground") },
  "/teste": { path: "/teste", loader: () => import("@/pages/TestCenter") },
  "/concept": { path: "/concept", loader: () => import("@/pages/Concept") },
  "/apresentacoes": { path: "/apresentacoes", loader: () => import("@/pages/Presentations") },
  "/sessions": { path: "/sessions", loader: () => import("@/pages/SessionsPage") },
  "/outputs": { path: "/outputs", loader: () => import("@/pages/Outputs") },
  "/uso": { path: "/uso", loader: () => import("@/pages/UsagePage") },
  "/terminal": { path: "/terminal", loader: () => import("@/pages/Terminal") },
  "/os": { path: "/os", loader: () => import("@/pages/OS") },
  "/nucleo": { path: "/nucleo", loader: () => import("@/pages/Nucleo") },
  "/design-system": { path: "/design-system", loader: () => import("@/pages/DesignSystemPage") },
  "/componentes": { path: "/componentes", loader: () => import("@/pages/ComponentsCatalog"), note: SELF_NOTE },
  "/case": { path: "/case", loader: () => import("@/pages/Case") },
  "/all": { path: "/all", loader: () => import("@/pages/All") },
  "/configuracoes": { path: "/configuracoes", loader: () => import("@/pages/SettingsPage") },
  "/ui": { path: "/ui", loader: () => import("@/pages/UiShell") },
};

/** Specs na ordem do menu (PAGES). Paths fora do registry são ignorados. */
export function pageFramesInMenuOrder(): PageEmbedSpec[] {
  const out: PageEmbedSpec[] = [];
  for (const p of PAGES) {
    const spec = PAGE_EMBEDS[p.path];
    if (spec) out.push(spec);
  }
  return out;
}

/** Páginas que renderizam ao vivo (sem `note`). */
export function renderablePageFrames(): PageEmbedSpec[] {
  return pageFramesInMenuOrder().filter((s) => !s.note);
}

/** id de âncora estável da seção de uma página no catálogo. */
export function catalogSectionId(path: string): string {
  return `cat-page-${path.replace(/\W+/g, "-").replace(/^-+|-+$/g, "") || "inicial"}`;
}

/**
 * Navegação interna do catálogo: as sidebars pedem para abrir uma seção da
 * coluna central. O frame alvo ouve `CATALOG_OPEN_EVENT`, expande (se
 * recolhido) e a página rola até a âncora. `opts.tab` ativa uma aba interna
 * do frame (ex.: "componentes" abre a aba de componentes da seção).
 */
export const CATALOG_OPEN_EVENT = "catalog:open-section";

export function openCatalogSection(id: string, opts?: { tab?: "pagina" | "componentes" }) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CATALOG_OPEN_EVENT, { detail: { id, tab: opts?.tab } }));
  // Scroll em 2 frames: o alvo precisa expandir antes de medir a posição.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }),
  );
}

/** Extrai o id da seção a partir do detail do evento (string legado ou objeto). */
export function catalogEventSectionId(event: Event): string | null {
  const detail = (event as CustomEvent<string | { id?: string }>).detail;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail.id === "string") return detail.id;
  return null;
}
