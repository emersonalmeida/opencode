/**
 * Templates de página do page builder do Design Canvas.
 *
 * Cada template semeia uma `DesignPage` estruturada (section → row → columns →
 * refs de componentes) que imita o layout de uma página existente do app
 * (Dashboard, Concept, Decision Center, App Detail). Os nós de componente
 * referenciados também são materializados como DCNodes, então o grafo do modo
 * design e o preview compartilham o mesmo store de componentes reais e
 * editáveis, vinculados a dados reais.
 *
 * Funções puras (sem React) → testáveis em unidade.
 */
import type { DCNode, DCEdge } from "./types";
import { resolveMeta } from "./registry";
import {
  createBlankPage, uid, type DesignPage, type PageNode,
} from "./pageModel";

export interface PageTemplate {
  id: string;
  name: string;
  description: string;
  build: () => { page: DesignPage; nodes: DCNode[]; edges: DCEdge[] };
}

/** Materialize a DCNode for a component kind with given props + label. */
function mkNode(kind: string, props: Record<string, unknown>, label: string): DCNode {
  const meta = resolveMeta(kind);
  return {
    id: uid("dc_node"),
    type: "design" as const,
    position: { x: 0, y: 0 },
    width: meta.defaultWidth ?? 220,
    data: { kind, props: { ...meta.defaults, ...props }, width: meta.defaultWidth ?? 220, label },
  };
}

/** A component leaf in the page tree referencing a node id. */
function leaf(ref: string): PageNode {
  return { id: uid("c"), kind: "component" as const, ref, children: [] };
}

/** A column wrapper. */
function col(span: number, children: PageNode[]): PageNode {
  return { id: uid("c"), kind: "column" as const, span, children };
}

/** A row wrapper. */
function row(gap: number, children: PageNode[]): PageNode {
  return { id: uid("c"), kind: "row" as const, gap, children };
}

/** A section wrapper. */
function section(gap: number, children: PageNode[]): PageNode {
  return { id: uid("c"), kind: "section" as const, gap, children };
}

/** Wire a fresh page root around the given section children. */
function pageRoot(children: PageNode[]): PageNode {
  return { id: uid("c"), kind: "page" as const, gap: 24, children };
}

/** Dashboard: KPI strip + charts row + per-app table + timeline. */
const dashboardTemplate: PageTemplate = {
  id: "tpl-dashboard",
  name: "Dashboard",
  description: "KPIs + gráficos + tabela por app, com dados reais do dataset.",
  build: () => {
    const kpiApps = mkNode("kpi-card", { metric: "totalApps", title: "Apps", dataSource: "all" }, "KPI Apps");
    const kpiReviews = mkNode("kpi-card", { metric: "totalReviews", title: "Reviews", dataSource: "all" }, "KPI Reviews");
    const kpiRating = mkNode("kpi-card", { metric: "avgRating", title: "Nota média", dataSource: "all" }, "KPI Nota");
    const kpiPositive = mkNode("kpi-card", { metric: "positivePct", title: "% Positivo", dataSource: "all" }, "KPI Positivo");
    const rating = mkNode("rating-chart", { dataSource: "all" }, "Distribuição de notas");
    const sentiment = mkNode("sentiment-chart", { dataSource: "all" }, "Sentimento");
    const timeline = mkNode("timeline-chart", { dataSource: "all" }, "Timeline");
    const perApp = mkNode("per-app-table", { dataSource: "all" }, "Tabela por app");
    const storeCmp = mkNode("store-comparison", { dataSource: "all" }, "Comparar lojas");

    const nodes = [kpiApps, kpiReviews, kpiRating, kpiPositive, rating, sentiment, timeline, perApp, storeCmp];
    const page = createBlankPage("Dashboard");
    const kpiRow = row(16, [col(3, [leaf(kpiApps.id)]), col(3, [leaf(kpiReviews.id)]), col(3, [leaf(kpiRating.id)]), col(3, [leaf(kpiPositive.id)])]);
    const chartsRow = row(16, [col(6, [leaf(rating.id)]), col(6, [leaf(sentiment.id)])]);
    const fullRow = row(16, [col(12, [leaf(timeline.id)])]);
    const tableRow = row(16, [col(8, [leaf(perApp.id)]), col(4, [leaf(storeCmp.id)])]);
    page.root = pageRoot([
      section(16, [kpiRow]),
      section(16, [chartsRow]),
      section(16, [fullRow]),
      section(16, [tableRow]),
    ]);
    return { page, nodes, edges: [] };
  },
};

/** Compare/Concept: app cards grid + analysis + word cloud. */
const compareTemplate: PageTemplate = {
  id: "tpl-compare",
  name: "Comparativo",
  description: "Cards de apps + word cloud + análise de IA, com dados selecionados.",
  build: () => {
    const app1 = mkNode("app-card", { dataSource: "selected", index: 0 }, "App 1");
    const app2 = mkNode("app-card", { dataSource: "selected", index: 1 }, "App 2");
    const app3 = mkNode("app-card", { dataSource: "selected", index: 2 }, "App 3");
    const wc = mkNode("word-cloud", { dataSource: "selected", limit: 40 }, "Nuvem de termos");
    const ai = mkNode("ai-analysis", { dataSource: "selected", section: "summary" }, "Análise de IA");
    const reviews = mkNode("reviews-list", { dataSource: "selected", limit: 8 }, "Reviews recentes");
    const nodes = [app1, app2, app3, wc, ai, reviews];
    const page = createBlankPage("Comparativo");
    page.root = pageRoot([
      section(16, [row(16, [col(4, [leaf(app1.id)]), col(4, [leaf(app2.id)]), col(4, [leaf(app3.id)])])]),
      section(16, [row(16, [col(6, [leaf(wc.id)]), col(6, [leaf(reviews.id)])])]),
      section(16, [row(16, [col(12, [leaf(ai.id)])])]),
    ]);
    return { page, nodes, edges: [] };
  },
};

/** App detail: hero card + stats + reviews + analysis. */
const appDetailTemplate: PageTemplate = {
  id: "tpl-app-detail",
  name: "Detalhe de app",
  description: "Card de app + tabela por app + reviews + análise de IA.",
  build: () => {
    const hero = mkNode("app-card", { dataSource: "selected", index: 0 }, "App");
    const perApp = mkNode("per-app-table", { dataSource: "selected" }, "Stats");
    const rating = mkNode("rating-chart", { dataSource: "selected" }, "Notas");
    const reviews = mkNode("reviews-list", { dataSource: "selected", limit: 10 }, "Reviews");
    const ai = mkNode("ai-analysis", { dataSource: "selected", section: "problems" }, "Problemas (IA)");
    const nodes = [hero, perApp, rating, reviews, ai];
    const page = createBlankPage("Detalhe de app");
    page.root = pageRoot([
      section(16, [row(16, [col(4, [leaf(hero.id)]), col(8, [leaf(perApp.id)])])]),
      section(16, [row(16, [col(6, [leaf(rating.id)]), col(6, [leaf(reviews.id)])])]),
      section(16, [row(16, [col(12, [leaf(ai.id)])])]),
    ]);
    return { page, nodes, edges: [] };
  },
};

/** Landing: hero + features + CTA. */
const landingTemplate: PageTemplate = {
  id: "tpl-landing",
  name: "Landing page",
  description: "Frame de página + CTAs + cards de recursos.",
  build: () => {
    const frame = mkNode("pageframe", { title: "App Intelligence", subtitle: "Analise reviews com IA local" }, "Hero");
    const cta = mkNode("button", { children: "Começar agora", variant: "default", size: "lg" }, "CTA");
    const card1 = mkNode("card", { title: "Colete", description: "Apple + Google", content: "Reviews reais de todas as lojas.", footer: "" }, "Card 1");
    const card2 = mkNode("card", { title: "Analise", description: "IA local", content: "Gemma, Qwen, Llama via Ollama.", footer: "" }, "Card 2");
    const card3 = mkNode("card", { title: "Decida", description: "Por persona", content: "CEO, CPO, PM, UX, Eng, Mkt.", footer: "" }, "Card 3");
    const nodes = [frame, cta, card1, card2, card3];
    const page = createBlankPage("Landing page");
    page.root = pageRoot([
      section(24, [row(16, [col(12, [leaf(frame.id)]), col(12, [leaf(cta.id)])])]),
      section(16, [row(16, [col(4, [leaf(card1.id)]), col(4, [leaf(card2.id)]), col(4, [leaf(card3.id)])])]),
    ]);
    return { page, nodes, edges: [] };
  },
};

export const PAGE_TEMPLATES: PageTemplate[] = [
  dashboardTemplate,
  compareTemplate,
  appDetailTemplate,
  landingTemplate,
];

export function getTemplate(id: string): PageTemplate | undefined {
  return PAGE_TEMPLATES.find((t) => t.id === id);
}
