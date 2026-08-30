/**
 * Catálogo da página Design System (`/design-system`) — estrutura inspirada
 * no GitLab Pajamas / Storybook: Foundations (tokens, tipografia, espaçamento,
 * elevação, motion, ícones) → Componentes (átomos → moléculas → organismos →
 * layouts) → Padrões → Conteúdo → Acessibilidade.
 *
 * Puro e testável: seções com âncoras (alimentam a aba "Seções" da sidebar
 * interna) + metadados de cada grupo de componentes. Os previews ao vivo
 * usam o NodeBody do Design Canvas (componentes reais de src/components/ui).
 */

export type DSSectionId =
  | "ds-tokens"
  | "ds-tipografia"
  | "ds-espacamento"
  | "ds-borda-elevacao"
  | "ds-motion"
  | "ds-icones"
  | "ds-atomos"
  | "ds-moleculas"
  | "ds-organismos"
  | "ds-layouts"
  | "ds-padroes"
  | "ds-conteudo"
  | "ds-acessibilidade";

export interface DSSection {
  id: DSSectionId;
  label: string;
  description: string;
}

/** Ordem lógica de leitura (Foundations → Components → Patterns → Content → A11y). */
export const DS_SECTIONS: DSSection[] = [
  { id: "ds-tokens", label: "Tokens de cor", description: "Variáveis CSS HSL que alimentam todo o sistema — incluindo overrides do usuário." },
  { id: "ds-tipografia", label: "Tipografia", description: "Escala tipográfica (display → caption → mono) e hierarquia de texto." },
  { id: "ds-espacamento", label: "Espaçamento", description: "Ritmo de 4px: escala de gaps e paddings consistente." },
  { id: "ds-borda-elevacao", label: "Borda & elevação", description: "Raio de borda (escalável) e níveis de sombra elev-1..4 + glow." },
  { id: "ds-motion", label: "Motion", description: "Durações/velocidades de animação e respeito a prefers-reduced-motion." },
  { id: "ds-icones", label: "Iconografia", description: "Ícones lucide-react usados na navegação e nas superfícies do sistema." },
  { id: "ds-atomos", label: "Átomos", description: "Componentes indivisíveis: botões, inputs, badges, switches…" },
  { id: "ds-moleculas", label: "Moléculas", description: "Composições simples: cards, tabs, tabelas, alertas, diálogos…" },
  { id: "ds-organismos", label: "Organismos", description: "Blocos de dados reais: KPIs, gráficos, listas de reviews, markdown…" },
  { id: "ds-layouts", label: "Layouts", description: "Containers estruturais: página, seção, linha, coluna." },
  { id: "ds-padroes", label: "Padrões", description: "Padrões compostos do produto: estados vazios, saídas de IA, painéis expansíveis, copy/download." },
  { id: "ds-conteudo", label: "Conteúdo & voz", description: "Diretrizes de texto de UI: clareza, honestidade, PT-BR." },
  { id: "ds-acessibilidade", label: "Acessibilidade", description: "Regras aplicadas em todo o sistema: foco, ARIA, teclado, contraste, motion." },
];

export const DS_SECTION_ANCHORS = DS_SECTIONS.map((s) => ({ id: s.id, label: s.label }));

/* ------------------------------------------------------------ tipografia */

export interface TypeSpecimen {
  cls: string;
  label: string;
  spec: string;
  sample: string;
}

export const TYPE_SCALE: TypeSpecimen[] = [
  { cls: "text-display", label: "Display", spec: "2rem · 700 · -0.02em", sample: "Análise de reviews" },
  { cls: "text-title", label: "Título", spec: "1.25rem · 600", sample: "Dashboard de dados" },
  { cls: "text-subtitle", label: "Subtítulo", spec: "0.875rem · 500 · muted", sample: "Métricas agregadas do dataset" },
  { cls: "text-sm", label: "Corpo", spec: "0.875rem · 400", sample: "Reviews coletadas das duas lojas, deduplicadas por id." },
  { cls: "text-xs", label: "Corpo pequeno", spec: "0.75rem · 400", sample: "Atualizado agora há pouco" },
  { cls: "text-caption", label: "Caption", spec: "0.6875rem · muted", sample: "8 apps · 21.432 reviews" },
  { cls: "text-mono-sm", label: "Mono", spec: "ui-monospace · 0.6875rem", sample: "aso:dataset:v1" },
];

/* ------------------------------------------------------------ espaçamento */

export interface SpacingStep {
  cls: string;
  label: string;
  rem: number;
}

export const SPACING_SCALE: SpacingStep[] = [
  { cls: "gap-xs", label: "xs", rem: 0.25 },
  { cls: "gap-sm", label: "sm", rem: 0.5 },
  { cls: "gap-md", label: "md", rem: 0.75 },
  { cls: "gap-lg", label: "lg", rem: 1 },
  { cls: "gap-xl", label: "xl", rem: 1.5 },
  { cls: "gap-2xl", label: "2xl", rem: 2 },
];

/* ------------------------------------------------------------ elevação */

export const ELEVATION_SCALE: { cls: string; label: string; usage: string }[] = [
  { cls: "elev-1", label: "Elev 1", usage: "Cards em repouso" },
  { cls: "elev-2", label: "Elev 2", usage: "Cards hover / popovers" },
  { cls: "elev-3", label: "Elev 3", usage: "Dropdowns / diálogos" },
  { cls: "elev-4", label: "Elev 4", usage: "Modais / overlays" },
  { cls: "elev-glow", label: "Glow", usage: "Destaque primário (CTA ativo)" },
];

/* --------------------------------------------------------------- motion */

export const MOTION_OPTIONS: { value: string; label: string; description: string }[] = [
  { value: "slow", label: "Lento", description: "Transições alongadas — útil para demonstrações." },
  { value: "normal", label: "Normal", description: "Padrão do sistema." },
  { value: "fast", label: "Rápido", description: "Feedback quase instantâneo." },
];

/* --------------------------------------------------------- acessibilidade */

export interface A11yRule {
  title: string;
  detail: string;
}

export const A11Y_RULES: A11yRule[] = [
  { title: "Foco visível", detail: "Todo elemento interativo tem anel :focus-visible (ring-2 ring-primary/60) — navegação por teclado nunca é às cegas." },
  { title: "ARIA completo", detail: "aria-label em botões só-ícone, aria-pressed em toggles, aria-selected/role=tab em abas, role=status/log/progressbar em regiões dinâmicas." },
  { title: "Teclado", detail: "Enter/Espaço em seleções, setas em sliders e ResizeHandle (role=separator), Esc fecha menus, ⌘K abre busca." },
  { title: "Contraste", detail: "Texto sempre sobre tokens de cor (foreground/muted-foreground) — nunca cor absoluta; badges de status têm texto + ícone, nunca só cor." },
  { title: "Motion responsável", detail: "prefers-reduced-motion desativa animações de fundo/reveal; modo bg-no-effects muta todas as transições." },
  { title: "Sem <button> aninhado", detail: "Cards clicáveis com botões internos usam div role=button + keydown." },
  { title: "Alvos generosos", detail: "Áreas de hit invisíveis ampliadas em handles de resize e grips de drag." },
  { title: "Estado anunciado", detail: "Contagens, erros (role=alert) e resultados de busca são anunciados a leitores de tela." },
];

/* -------------------------------------------------------------- conteúdo */

export const CONTENT_RULES: A11yRule[] = [
  { title: "PT-BR por padrão", detail: "Toda UI em português do Brasil; i18n (aso:ui-lang) prepara EN." },
  { title: "Honestidade de dados", detail: "Números sempre sobre o total coletado; quando não há evidência, o sistema diz 'não há evidência' — nunca inventa." },
  { title: "Verbos de ação", detail: "Botões com verbos claros: Coletar, Gerar análise, Baixar tudo — não 'OK'/'Submit'." },
  { title: "Estado vazio útil", detail: "Todo empty state explica o que falta e oferece a próxima ação (CTA)." },
  { title: "Progresso visível", detail: "Tarefas longas mostram status (queued/running/done) no Terminal e no indicador do header." },
];
