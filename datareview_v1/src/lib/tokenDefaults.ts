/**
 * Catálogo CANÔNICO de design tokens editáveis — TODA variável CSS de tema
 * definida em `src/index.css` (:root e .dark) está aqui, com valor padrão
 * por modo, grupo e metadados para o editor visual.
 *
 * Fonte única de verdade: o editor de tokens (Configurações → Design System),
 * o registry do Design Canvas e a página Design System derivam deste catálogo.
 * Manter sincronizado com `src/index.css` — o teste tokenDefaults.test.ts
 * garante que todo valor bate com o CSS.
 */

export type TokenGroupId =
  | "surfaces" | "text" | "actions" | "charts" | "status" | "sidebar" | "shape";

export interface TokenSpec {
  /** Nome da variável sem o prefixo "--". */
  cssVar: string;
  label: string;
  description: string;
  group: TokenGroupId;
  kind: "color" | "size";
  /** Valor padrão no modo claro (HSL triple ou rem). */
  light: string;
  /** Valor padrão no modo escuro. */
  dark: string;
}

export const TOKEN_GROUP_META: Record<TokenGroupId, { label: string; description: string }> = {
  surfaces: { label: "Superfícies", description: "Fundos de página, cards, popovers e bordas" },
  text: { label: "Texto", description: "Cores de texto sobre cada superfície" },
  actions: { label: "Ações & ênfase", description: "Primária, destrutiva, foco e estados de nota" },
  charts: { label: "Gráficos", description: "Paleta dos gráficos (recharts)" },
  status: { label: "Status", description: "Estados semânticos de tarefas e do sistema" },
  sidebar: { label: "Sidebar", description: "Cores das barras laterais" },
  shape: { label: "Forma", description: "Raio de borda base" },
};

export const TOKEN_GROUP_ORDER: TokenGroupId[] = [
  "surfaces", "text", "actions", "charts", "status", "sidebar", "shape",
];

export const TOKEN_CATALOG: TokenSpec[] = [
  // ── Superfícies ──────────────────────────────────────────────────────
  { cssVar: "background", label: "Background", description: "Fundo da página", group: "surfaces", kind: "color", light: "0 0% 100%", dark: "240 10% 10%" },
  { cssVar: "card", label: "Card", description: "Superfícies/card", group: "surfaces", kind: "color", light: "0 0% 100%", dark: "240 10% 10%" },
  { cssVar: "popover", label: "Popover", description: "Menus e popovers", group: "surfaces", kind: "color", light: "0 0% 100%", dark: "240 10% 10%" },
  { cssVar: "secondary", label: "Secondary", description: "Botões secundários, chips", group: "surfaces", kind: "color", light: "240 4.8% 95.9%", dark: "240 3.7% 18%" },
  { cssVar: "muted", label: "Muted", description: "Fundos discretos", group: "surfaces", kind: "color", light: "240 4.8% 95.9%", dark: "240 3.7% 18%" },
  { cssVar: "accent", label: "Accent", description: "Hover/destaque sutil", group: "surfaces", kind: "color", light: "240 4.8% 95.9%", dark: "240 3.7% 18%" },
  { cssVar: "border", label: "Border", description: "Bordas", group: "surfaces", kind: "color", light: "240 5.9% 86%", dark: "240 3.7% 22%" },
  { cssVar: "input", label: "Input", description: "Borda de campos", group: "surfaces", kind: "color", light: "240 5.9% 86%", dark: "240 3.7% 22%" },

  // ── Texto ────────────────────────────────────────────────────────────
  { cssVar: "foreground", label: "Foreground", description: "Texto principal", group: "text", kind: "color", light: "240 10% 3.9%", dark: "0 0% 98%" },
  { cssVar: "card-foreground", label: "Card fg", description: "Texto sobre card", group: "text", kind: "color", light: "240 10% 3.9%", dark: "0 0% 98%" },
  { cssVar: "popover-foreground", label: "Popover fg", description: "Texto sobre popover", group: "text", kind: "color", light: "240 10% 3.9%", dark: "0 0% 98%" },
  { cssVar: "secondary-foreground", label: "Secondary fg", description: "Texto sobre secondary", group: "text", kind: "color", light: "240 5.9% 10%", dark: "0 0% 98%" },
  { cssVar: "muted-foreground", label: "Muted fg", description: "Texto secundário", group: "text", kind: "color", light: "240 3.8% 42%", dark: "240 5% 68%" },
  { cssVar: "accent-foreground", label: "Accent fg", description: "Texto sobre accent", group: "text", kind: "color", light: "240 5.9% 10%", dark: "0 0% 98%" },
  { cssVar: "primary-foreground", label: "Primary fg", description: "Texto sobre primary", group: "text", kind: "color", light: "0 0% 98%", dark: "240 5.9% 10%" },
  { cssVar: "destructive-foreground", label: "Destructive fg", description: "Texto sobre destructive", group: "text", kind: "color", light: "0 0% 98%", dark: "0 0% 98%" },

  // ── Ações & ênfase ───────────────────────────────────────────────────
  { cssVar: "primary", label: "Primary", description: "Ações primárias, links", group: "actions", kind: "color", light: "240 5.9% 10%", dark: "0 0% 98%" },
  { cssVar: "destructive", label: "Destructive", description: "Erros, excluir", group: "actions", kind: "color", light: "0 84.2% 60.2%", dark: "0 62.8% 30.6%" },
  { cssVar: "ring", label: "Ring", description: "Indicador de foco", group: "actions", kind: "color", light: "240 10% 3.9%", dark: "240 4.9% 83.9%" },
  { cssVar: "success", label: "Success", description: "Estados positivos", group: "actions", kind: "color", light: "142 71% 45%", dark: "142 71% 45%" },
  { cssVar: "warning", label: "Warning", description: "Avisos", group: "actions", kind: "color", light: "38 92% 50%", dark: "38 92% 50%" },
  { cssVar: "star", label: "Star", description: "Estrelas de nota", group: "actions", kind: "color", light: "45 100% 51%", dark: "45 100% 51%" },

  // ── Gráficos ─────────────────────────────────────────────────────────
  { cssVar: "chart-1", label: "Chart 1", description: "Cor de gráfico 1", group: "charts", kind: "color", light: "12 76% 61%", dark: "220 70% 50%" },
  { cssVar: "chart-2", label: "Chart 2", description: "Cor de gráfico 2", group: "charts", kind: "color", light: "173 58% 39%", dark: "160 60% 45%" },
  { cssVar: "chart-3", label: "Chart 3", description: "Cor de gráfico 3", group: "charts", kind: "color", light: "197 37% 24%", dark: "30 80% 55%" },
  { cssVar: "chart-4", label: "Chart 4", description: "Cor de gráfico 4", group: "charts", kind: "color", light: "43 74% 66%", dark: "280 65% 60%" },
  { cssVar: "chart-5", label: "Chart 5", description: "Cor de gráfico 5", group: "charts", kind: "color", light: "27 87% 67%", dark: "340 75% 55%" },

  // ── Status semânticos ────────────────────────────────────────────────
  { cssVar: "status-running", label: "Executando", description: "Tarefa em execução", group: "status", kind: "color", light: "217 91% 60%", dark: "217.2 91.2% 59.8%" },
  { cssVar: "status-success", label: "Sucesso", description: "Tarefa concluída", group: "status", kind: "color", light: "142 71% 45%", dark: "142 71% 45%" },
  { cssVar: "status-error", label: "Erro", description: "Tarefa com erro", group: "status", kind: "color", light: "0 72% 51%", dark: "0 84% 62%" },
  { cssVar: "status-warning", label: "Alerta", description: "Tarefa em alerta", group: "status", kind: "color", light: "38 92% 50%", dark: "38 92% 50%" },
  { cssVar: "status-info", label: "Info", description: "Informação/IA", group: "status", kind: "color", light: "262 83% 58%", dark: "262 83% 68%" },
  { cssVar: "status-idle", label: "Ocioso", description: "Sem atividade", group: "status", kind: "color", light: "240 4% 46%", dark: "240 5% 64.9%" },
  { cssVar: "status-skipped", label: "Pulado", description: "Etapa pulada", group: "status", kind: "color", light: "25 60% 42%", dark: "30 60% 56%" },

  // ── Sidebar ──────────────────────────────────────────────────────────
  { cssVar: "sidebar-background", label: "Sidebar bg", description: "Fundo das sidebars", group: "sidebar", kind: "color", light: "0 0% 98%", dark: "240 10% 12%" },
  { cssVar: "sidebar-foreground", label: "Sidebar fg", description: "Texto das sidebars", group: "sidebar", kind: "color", light: "240 5.3% 22%", dark: "240 4.8% 95.9%" },
  { cssVar: "sidebar-primary", label: "Sidebar primary", description: "Ação primária na sidebar", group: "sidebar", kind: "color", light: "240 5.9% 10%", dark: "224.3 76.3% 48%" },
  { cssVar: "sidebar-primary-foreground", label: "Sidebar primary fg", description: "Texto sobre primary da sidebar", group: "sidebar", kind: "color", light: "0 0% 98%", dark: "0 0% 100%" },
  { cssVar: "sidebar-accent", label: "Sidebar accent", description: "Hover na sidebar", group: "sidebar", kind: "color", light: "240 4.8% 95.9%", dark: "240 3.7% 18%" },
  { cssVar: "sidebar-accent-foreground", label: "Sidebar accent fg", description: "Texto sobre accent da sidebar", group: "sidebar", kind: "color", light: "240 5.9% 10%", dark: "240 4.8% 95.9%" },
  { cssVar: "sidebar-border", label: "Sidebar border", description: "Borda das sidebars", group: "sidebar", kind: "color", light: "220 13% 87%", dark: "240 3.7% 22%" },
  { cssVar: "sidebar-ring", label: "Sidebar ring", description: "Foco na sidebar", group: "sidebar", kind: "color", light: "217.2 91.2% 59.8%", dark: "217.2 91.2% 59.8%" },

  // ── Forma ────────────────────────────────────────────────────────────
  { cssVar: "radius", label: "Radius", description: "Raio base (rem)", group: "shape", kind: "size", light: "0.5rem", dark: "0.5rem" },
];

const BY_VAR = new Map(TOKEN_CATALOG.map((t) => [t.cssVar, t]));

export function getTokenSpec(cssVar: string): TokenSpec | undefined {
  return BY_VAR.get(cssVar);
}

/** Valor padrão de um token por modo (undefined se var desconhecida). */
export function tokenDefault(mode: "light" | "dark", cssVar: string): string | undefined {
  return BY_VAR.get(cssVar)?.[mode];
}

/** Todos os tokens de um grupo, na ordem do catálogo. */
export function tokensByGroup(group: TokenGroupId): TokenSpec[] {
  return TOKEN_CATALOG.filter((t) => t.group === group);
}
