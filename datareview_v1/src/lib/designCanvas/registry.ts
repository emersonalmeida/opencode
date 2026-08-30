import {
  Square, Type, TextCursorInput, AlignLeft, ToggleLeft, CheckSquare,
  ChevronDown, Tag, Minus, AlertTriangle, CreditCard,
  Columns2, Monitor, PanelTop, Table2 as TableIcon, BarChart3,
  Users, MessageSquare, Activity, Sparkles, ScrollText,
  Layers, LayoutGrid, Presentation, Database,
  ImageIcon, ChevronRight, Calendar, SlidersHorizontal,
  Rows3, ListTree, LayoutDashboard,
} from "lucide-react";
import type { ComponentMeta, DesignToken } from "./types";
import { TOKEN_CATALOG } from "@/lib/tokenDefaults";

/**
 * DESIGN_TOKENS — the live design tokens of the system (CSS custom properties
 * from `src/index.css`). Derivado do catálogo canônico `tokenDefaults.ts`
 * (TODAS as vars de tema, valores do modo claro). Each is editable in the
 * inspector; the board surface re-injects them into a scoped `<style>` so a
 * board can preview a theme without mutating the global app theme.
 */
export const DESIGN_TOKENS: DesignToken[] = TOKEN_CATALOG.map((t) => ({
  key: t.cssVar,
  label: t.label,
  layer: t.kind === "size" ? "radius" : "color",
  cssVar: t.cssVar,
  value: t.light,
  description: t.description,
}));

/**
 * COMPONENT_REGISTRY — every node kind the user can drop. Atoms/molecules/
 * organisms resolve into a REAL component render (see DesignCanvasNode). Each
 * carries a prop schema that the inspector turns into live-editable controls.
 */
export const COMPONENT_REGISTRY: Record<string, ComponentMeta> = {
  // ── Atoms ──────────────────────────────────────────────────────────────
  button: {
    kind: "button", label: "Button", layer: "atom", icon: Square,
    description: "Botão primário de ação.",
    defaultWidth: 180,
    defaults: { children: "Button", variant: "default", size: "default", disabled: false },
    props: [
      { key: "children", label: "Texto", type: "text", default: "Button" },
      { key: "variant", label: "Variante", type: "select", default: "default", options: ["default", "destructive", "outline", "secondary", "ghost", "link"] },
      { key: "size", label: "Tamanho", type: "select", default: "default", options: ["default", "sm", "lg", "icon"] },
      { key: "disabled", label: "Desabilitado", type: "boolean", default: false },
    ],
  },
  badge: {
    kind: "badge", label: "Badge", layer: "atom", icon: Tag,
    description: "Etiqueta/chip de status.",
    defaultWidth: 140,
    defaults: { children: "Badge", variant: "default" },
    props: [
      { key: "children", label: "Texto", type: "text", default: "Badge" },
      { key: "variant", label: "Variante", type: "select", default: "default", options: ["default", "secondary", "destructive", "outline"] },
    ],
  },
  input: {
    kind: "input", label: "Input", layer: "atom", icon: TextCursorInput,
    description: "Campo de texto de uma linha.",
    defaultWidth: 240,
    defaults: { placeholder: "Digite…", type: "text", disabled: false },
    props: [
      { key: "placeholder", label: "Placeholder", type: "text", default: "Digite…" },
      { key: "type", label: "Tipo", type: "select", default: "text", options: ["text", "email", "password", "number", "search"] },
      { key: "disabled", label: "Desabilitado", type: "boolean", default: false },
    ],
  },
  textarea: {
    kind: "textarea", label: "Textarea", layer: "atom", icon: AlignLeft,
    description: "Campo de texto multi-linha.",
    defaultWidth: 260,
    defaults: { placeholder: "Escreva…", rows: 4 },
    props: [
      { key: "placeholder", label: "Placeholder", type: "text", default: "Escreva…" },
      { key: "rows", label: "Linhas", type: "number", default: 4, min: 1, max: 20, step: 1 },
    ],
  },
  switch: {
    kind: "switch", label: "Switch", layer: "atom", icon: ToggleLeft,
    description: "Toggle on/off.",
    defaultWidth: 120,
    defaults: { checked: true, disabled: false },
    props: [
      { key: "checked", label: "Ativo", type: "boolean", default: true },
      { key: "disabled", label: "Desabilitado", type: "boolean", default: false },
    ],
  },
  checkbox: {
    kind: "checkbox", label: "Checkbox", layer: "atom", icon: CheckSquare,
    description: "Caixa de seleção.",
    defaultWidth: 120,
    defaults: { checked: true, disabled: false, label: "Aceito" },
    props: [
      { key: "checked", label: "Marcado", type: "boolean", default: true },
      { key: "disabled", label: "Desabilitado", type: "boolean", default: false },
      { key: "label", label: "Rótulo", type: "text", default: "Aceito" },
    ],
  },
  select: {
    kind: "select", label: "Select", layer: "atom", icon: ChevronDown,
    description: "Lista suspensa (Radix).",
    defaultWidth: 220,
    defaults: { placeholder: "Selecione…", options: "Opção A, Opção B, Opção C" },
    props: [
      { key: "placeholder", label: "Placeholder", type: "text", default: "Selecione…" },
      { key: "options", label: "Opções (vírgula)", type: "text", default: "Opção A, Opção B, Opção C" },
    ],
  },
  label: {
    kind: "label", label: "Label", layer: "atom", icon: Type,
    description: "Rótulo de campo.",
    defaultWidth: 160,
    defaults: { children: "Rótulo" },
    props: [{ key: "children", label: "Texto", type: "text", default: "Rótulo" }],
  },
  separator: {
    kind: "separator", label: "Separator", layer: "atom", icon: Minus,
    description: "Linha separadora.",
    defaultWidth: 200,
    defaults: { orientation: "horizontal" },
    props: [{ key: "orientation", label: "Orientação", type: "select", default: "horizontal", options: ["horizontal", "vertical"] }],
  },

  // ── Molecules ─────────────────────────────────────────────────────────
  alert: {
    kind: "alert", label: "Alert", layer: "molecule", icon: AlertTriangle,
    description: "Mensagem de alerta com título.",
    defaultWidth: 320,
    defaults: { title: "Atenção", description: "Algo precisa da sua atenção.", variant: "default" },
    props: [
      { key: "title", label: "Título", type: "text", default: "Atenção" },
      { key: "description", label: "Descrição", type: "textarea", default: "Algo precisa da sua atenção." },
      { key: "variant", label: "Variante", type: "select", default: "default", options: ["default", "destructive"] },
    ],
  },
  card: {
    kind: "card", label: "Card", layer: "molecule", icon: CreditCard,
    description: "Cartão com header/content/footer.",
    defaultWidth: 320,
    defaults: { title: "Título do card", description: "Descrição do card.", content: "Conteúdo do cartão.", footer: "Rodapé" },
    props: [
      { key: "title", label: "Título", type: "text", default: "Título do card" },
      { key: "description", label: "Descrição", type: "text", default: "Descrição do card." },
      { key: "content", label: "Conteúdo", type: "textarea", default: "Conteúdo do cartão." },
      { key: "footer", label: "Rodapé", type: "text", default: "Rodapé" },
    ],
  },

  // ── Organisms / Layouts ───────────────────────────────────────────────
  columns2: {
    kind: "columns2", label: "2 Colunas", layer: "layout", icon: Columns2,
    description: "Layout de 2 colunas equilibradas.",
    defaultWidth: 460,
    defaults: { left: "Coluna esquerda", right: "Coluna direita" },
    props: [
      { key: "left", label: "Esquerda", type: "text", default: "Coluna esquerda" },
      { key: "right", label: "Direita", type: "text", default: "Coluna direita" },
    ],
  },
  pageframe: {
    kind: "pageframe", label: "Frame de página", layer: "layout", icon: Monitor,
    description: "Moldura de página com header + conteúdo.",
    defaultWidth: 520,
    defaults: { title: "Nova página", subtitle: "Subtítulo da página" },
    props: [
      { key: "title", label: "Título", type: "text", default: "Nova página" },
      { key: "subtitle", label: "Subtítulo", type: "text", default: "Subtítulo da página" },
    ],
  },
  section: {
    kind: "section", label: "Seção", layer: "layout", icon: LayoutGrid,
    description: "Contêiner de seção (page builder) — agrupa linhas/colunas.",
    defaultWidth: 640,
    defaults: { gap: 16, className: "" },
    props: [
      { key: "gap", label: "Espaçamento (px)", type: "number", default: 16, min: 0, max: 64, step: 2 },
      { key: "className", label: "Classes extra", type: "text", default: "" },
    ],
  },
  row: {
    kind: "row", label: "Linha", layer: "layout", icon: Rows3,
    description: "Linha de colunas (grid responsivo).",
    defaultWidth: 640,
    defaults: { gap: 16, className: "" },
    props: [
      { key: "gap", label: "Espaçamento (px)", type: "number", default: 16, min: 0, max: 64, step: 2 },
      { key: "className", label: "Classes extra", type: "text", default: "" },
    ],
  },

  // ── More shadcn molecules ────────────────────────────────────────────
  tabs: {
    kind: "tabs", label: "Tabs", layer: "molecule", icon: PanelTop,
    description: "Abas com conteúdo (Radix).",
    defaultWidth: 380,
    defaults: { tabs: "Visão geral,Dados,Análises", active: "Visão geral", content: "Conteúdo da aba ativa." },
    props: [
      { key: "tabs", label: "Abas (vírgula)", type: "text", default: "Visão geral,Dados,Análises" },
      { key: "active", label: "Aba ativa", type: "text", default: "Visão geral" },
      { key: "content", label: "Conteúdo", type: "textarea", default: "Conteúdo da aba ativa." },
    ],
  },
  table: {
    kind: "table", label: "Tabela", layer: "molecule", icon: TableIcon,
    description: "Tabela de dados estática (header + linhas).",
    defaultWidth: 420,
    defaults: { headers: "App,Nota,Reviews", rows: "Nubank,4.8,1200|Spotify,4.5,3000" },
    props: [
      { key: "headers", label: "Cabeçalhos (vírgula)", type: "text", default: "App,Nota,Reviews" },
      { key: "rows", label: "Linhas (| separa, vírgula colunas)", type: "textarea", default: "Nubank,4.8,1200|Spotify,4.5,3000" },
    ],
  },
  progress: {
    kind: "progress", label: "Progress", layer: "atom", icon: Activity,
    description: "Barra de progresso.",
    defaultWidth: 200,
    defaults: { value: 60 },
    props: [{ key: "value", label: "Valor (0-100)", type: "number", default: 60, min: 0, max: 100, step: 1 }],
  },
  skeleton: {
    kind: "skeleton", label: "Skeleton", layer: "atom", icon: Square,
    description: "Placeholder de carregamento.",
    defaultWidth: 220, defaults: { height: 32 },
    props: [{ key: "height", label: "Altura (px)", type: "number", default: 32, min: 8, max: 200, step: 2 }],
  },
  accordion: {
    kind: "accordion", label: "Acordeão", layer: "molecule", icon: ChevronRight,
    description: "Lista expansível de itens.",
    defaultWidth: 360,
    defaults: { items: "Item 1:Descrição 1|Item 2:Descrição 2" },
    props: [{ key: "items", label: "Itens (título:descrição, | separa)", type: "textarea", default: "Item 1:Descrição 1|Item 2:Descrição 2" }],
  },
  avatar: {
    kind: "avatar", label: "Avatar", layer: "atom", icon: Users,
    description: "Avatar com fallback de iniciais.",
    defaultWidth: 64, defaults: { initials: "AB" },
    props: [{ key: "initials", label: "Iniciais", type: "text", default: "AB" }],
  },
  slider: {
    kind: "slider", label: "Slider", layer: "atom", icon: SlidersHorizontal,
    description: "Controle deslizante.",
    defaultWidth: 220, defaults: { value: 50 },
    props: [{ key: "value", label: "Valor", type: "number", default: 50, min: 0, max: 100, step: 1 }],
  },
  "toggle-group": {
    kind: "toggle-group", label: "Toggle group", layer: "atom", icon: ToggleLeft,
    description: "Grupo de botões de alternância.",
    defaultWidth: 260,
    defaults: { options: "A,B,C", value: "A" },
    props: [
      { key: "options", label: "Opções (vírgula)", type: "text", default: "A,B,C" },
      { key: "value", label: "Valor ativo", type: "text", default: "A" },
    ],
  },
  tooltip: {
    kind: "tooltip", label: "Tooltip", layer: "atom", icon: ScrollText,
    description: "Dica de contexto (hover).",
    defaultWidth: 200,
    defaults: { trigger: "Passe o mouse", content: "Dica de ajuda" },
    props: [
      { key: "trigger", label: "Gatilho", type: "text", default: "Passe o mouse" },
      { key: "content", label: "Conteúdo", type: "text", default: "Dica de ajuda" },
    ],
  },
  breadcrumb: {
    kind: "breadcrumb", label: "Breadcrumb", layer: "molecule", icon: ChevronRight,
    description: "Trilha de navegação.",
    defaultWidth: 320,
    defaults: { items: "Início,Dashboard,Detalhe" },
    props: [{ key: "items", label: "Itens (vírgula)", type: "text", default: "Início,Dashboard,Detalhe" }],
  },
  pagination: {
    kind: "pagination", label: "Paginação", layer: "molecule", icon: ChevronRight,
    description: "Controles de paginação.",
    defaultWidth: 320, defaults: { page: 2, pages: 10 },
    props: [
      { key: "page", label: "Página", type: "number", default: 2, min: 1, max: 999, step: 1 },
      { key: "pages", label: "Total páginas", type: "number", default: 10, min: 1, max: 999, step: 1 },
    ],
  },
  calendar: {
    kind: "calendar", label: "Calendário", layer: "molecule", icon: Calendar,
    description: "Seletor de data.",
    defaultWidth: 280, defaults: {},
    props: [],
  },
  dialog: {
    kind: "dialog", label: "Dialog", layer: "molecule", icon: PanelTop,
    description: "Diálogo modal (botão abre conteúdo).",
    defaultWidth: 320,
    defaults: { trigger: "Abrir", title: "Título do diálogo", description: "Descrição do diálogo." },
    props: [
      { key: "trigger", label: "Botão", type: "text", default: "Abrir" },
      { key: "title", label: "Título", type: "text", default: "Título do diálogo" },
      { key: "description", label: "Descrição", type: "textarea", default: "Descrição do diálogo." },
    ],
  },
  image: {
    kind: "image", label: "Imagem", layer: "atom", icon: ImageIcon,
    description: "Imagem por URL com ratio.",
    defaultWidth: 260,
    defaults: { src: "", alt: "Imagem", ratio: "1.777" },
    props: [
      { key: "src", label: "URL", type: "text", default: "" },
      { key: "alt", label: "Texto alt", type: "text", default: "Imagem" },
      { key: "ratio", label: "Ratio (w/h)", type: "text", default: "1.777" },
    ],
  },

  // ── Data organisms (bound to real collected dataset) ──────────────────
  "kpi-card": {
    kind: "kpi-card", label: "KPI Card", layer: "organism", icon: LayoutDashboard,
    description: "Cartão de KPI com métricas reais (apps, reviews, nota, % positivo).",
    defaultWidth: 260, dataBound: true,
    defaults: { dataSource: "selected", metric: "totalReviews", title: "Total de reviews" },
    props: [
      { key: "dataSource", label: "Fonte de dados", type: "dataSource", default: "selected" },
      { key: "metric", label: "Métrica", type: "select", default: "totalReviews",
        options: ["totalApps", "totalReviews", "avgRating", "positivePct", "negativePct", "neutralPct"] },
      { key: "title", label: "Título", type: "text", default: "Total de reviews" },
    ],
  },
  "rating-chart": {
    kind: "rating-chart", label: "Gráfico de notas", layer: "organism", icon: BarChart3,
    description: "Distribuição de notas ★1-5 com dados reais.",
    defaultWidth: 340, dataBound: true,
    defaults: { dataSource: "selected" },
    props: [{ key: "dataSource", label: "Fonte de dados", type: "dataSource", default: "selected" }],
  },
  "sentiment-chart": {
    kind: "sentiment-chart", label: "Donut de sentimento", layer: "organism", icon: Activity,
    description: "Pizza de sentimento (positivo/neutro/negativo) com dados reais.",
    defaultWidth: 300, dataBound: true,
    defaults: { dataSource: "selected" },
    props: [{ key: "dataSource", label: "Fonte de dados", type: "dataSource", default: "selected" }],
  },
  "timeline-chart": {
    kind: "timeline-chart", label: "Timeline", layer: "organism", icon: Activity,
    description: "Evolução temporal (nota média + volume) com dados reais.",
    defaultWidth: 460, dataBound: true,
    defaults: { dataSource: "selected" },
    props: [{ key: "dataSource", label: "Fonte de dados", type: "dataSource", default: "selected" }],
  },
  "store-comparison": {
    kind: "store-comparison", label: "Comparar lojas", layer: "organism", icon: Database,
    description: "Comparativo Apple vs Google Play com dados reais.",
    defaultWidth: 460, dataBound: true,
    defaults: { dataSource: "all" },
    props: [{ key: "dataSource", label: "Fonte de dados", type: "dataSource", default: "all" }],
  },
  "word-cloud": {
    kind: "word-cloud", label: "Nuvem de termos", layer: "organism", icon: ListTree,
    description: "Termos frequentes dos reviews (dados reais).",
    defaultWidth: 420, dataBound: true,
    defaults: { dataSource: "selected", limit: 40 },
    props: [
      { key: "dataSource", label: "Fonte de dados", type: "dataSource", default: "selected" },
      { key: "limit", label: "Limite de termos", type: "number", default: 40, min: 5, max: 120, step: 1 },
    ],
  },
  "reviews-list": {
    kind: "reviews-list", label: "Lista de reviews", layer: "organism", icon: MessageSquare,
    description: "Feed de reviews reais (autor, nota, texto, país).",
    defaultWidth: 420, dataBound: true,
    defaults: { dataSource: "selected", limit: 10 },
    props: [
      { key: "dataSource", label: "Fonte de dados", type: "dataSource", default: "selected" },
      { key: "limit", label: "Nº de reviews", type: "number", default: 10, min: 1, max: 200, step: 1 },
    ],
  },
  "app-card": {
    kind: "app-card", label: "Card de app", layer: "organism", icon: ImageIcon,
    description: "Card com ícone, nome, desenvolvedor e nota de um app real.",
    defaultWidth: 280, dataBound: true,
    defaults: { dataSource: "selected", index: 0 },
    props: [
      { key: "dataSource", label: "Fonte de dados", type: "dataSource", default: "selected" },
      { key: "index", label: "Índice do app", type: "number", default: 0, min: 0, max: 99, step: 1 },
    ],
  },
  "per-app-table": {
    kind: "per-app-table", label: "Tabela por app", layer: "organism", icon: TableIcon,
    description: "Tabela de stats por app (nota, reviews, % positivo) — dados reais.",
    defaultWidth: 480, dataBound: true,
    defaults: { dataSource: "selected" },
    props: [{ key: "dataSource", label: "Fonte de dados", type: "dataSource", default: "selected" }],
  },
  "markdown": {
    kind: "markdown", label: "Markdown", layer: "organism", icon: ScrollText,
    description: "Bloco de markdown renderizado (com gráficos fenced).",
    defaultWidth: 460, dataBound: false,
    defaults: { content: "## Título\nTexto em **markdown** com `código`." },
    props: [{ key: "content", label: "Conteúdo", type: "textarea", default: "## Título\nTexto em **markdown**." }],
  },
  "ai-analysis": {
    kind: "ai-analysis", label: "Análise de IA", layer: "organism", icon: Sparkles,
    description: "Gera análise de IA (experiment-analyze) sobre os apps selecionados.",
    defaultWidth: 480, dataBound: true,
    defaults: { dataSource: "selected", section: "summary", content: "" },
    props: [
      { key: "dataSource", label: "Fonte de dados", type: "dataSource", default: "selected" },
      { key: "section", label: "Seção de IA", type: "select", default: "summary",
        options: ["summary", "quantitative", "qualitative", "problems", "requests", "suggestions", "opportunities", "evidence", "strategy", "business", "custom"] },
      { key: "content", label: "Conteúdo gerado", type: "textarea", default: "" },
    ],
  },

  note: {
    kind: "note", label: "Nota", layer: "molecule", icon: Type,
    description: "Anotação livre no canvas (não é um componente).",
    defaultWidth: 240,
    defaults: { text: "Anotação livre. Use para documentar ideias, fluxos ou decisões de design." },
    props: [{ key: "text", label: "Texto", type: "textarea", default: "Anotação livre. Use para documentar ideias, fluxos ou decisões de design." }],
  },
};

export const COMPONENT_LIST: ComponentMeta[] = Object.values(COMPONENT_REGISTRY);

export const LAYER_ORDER: ComponentMeta["layer"][] = [
  "token", "atom", "molecule", "organism", "layout", "template",
];

export const LAYER_LABEL: Record<ComponentMeta["layer"], string> = {
  token: "Tokens",
  atom: "Átomos",
  molecule: "Moléculas",
  organism: "Organismos (dados reais)",
  layout: "Layouts",
  template: "Templates",
};

/** Layers shown in the palette (token layer is handled separately, live). */
export const PALETTE_LAYERS: ComponentMeta["layer"][] = [
  "atom", "molecule", "organism", "layout",
];

/** Resolve a component meta by kind (always falls back to `note`). */
export function resolveMeta(kind: string): ComponentMeta {
  return COMPONENT_REGISTRY[kind] ?? COMPONENT_REGISTRY.note;
}
