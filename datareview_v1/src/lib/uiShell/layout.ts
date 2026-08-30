/**
 * uiShell/layout.ts — núcleo PURO do layout estrutural da página UI.
 *
 * Modelo de 5 colunas dentro da página (além das sidebars EXTERNAS do
 * sistema, que seguem visíveis):
 *
 *   [Esquerda EXTERNA] [Esquerda INTERNA] [CENTRO] [Direita INTERNA] [Direita EXTERNA]
 *
 * Contrato:
 *  - Cada coluna lateral tem largura expandida persistida, clamp [min,max],
 *    recolhimento para um rail estreito (56px) e reset individual.
 *  - O PADRÃO ("reset") é o layout dividido em 3 colunas: externas abertas,
 *    internas recolhidas em rail, centro fluido.
 *  - Colunas são INTELIGENTES: quando o container fica estreito, as colunas
 *    expandidas fecham sozinhas (auto-collapse) numa ordem de prioridade
 *    determinística, e reabrem quando há espaço de volta (com histerese —
 *    margem extra — para não "flapar" na fronteira).
 *  - Abaixo do breakpoint mobile, as laterais saem do fluxo e abrem como
 *    gavetas overlay (ver a página).
 *
 * Tudo aqui é puro/testável — nada de React/DOM (a medição do container e a
 * persistência ficam em store.ts / na página).
 */

export type UiColumnId = "left-outer" | "left-inner" | "right-inner" | "right-outer";
export type UiColumnSide = "left" | "right";
export type UiColumnTier = "outer" | "inner";
export type UiShellMode = "columns" | "overlay";

export interface UiColumnSpec {
  id: UiColumnId;
  side: UiColumnSide;
  tier: UiColumnTier;
  /** Rótulo acessível (PT-BR) da coluna. */
  label: string;
  /** Descrição curta (dicas/tooltip). */
  description: string;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  /** Recolhida no layout padrão (3 colunas)? */
  defaultCollapsed: boolean;
  /** Ordem de auto-collapse quando falta espaço: MENOR fecha PRIMEIRO. */
  collapsePriority: number;
}

/** Largura do rail recolhido (px). */
export const UI_RAIL_WIDTH = 56;
/** Largura mínima legível do centro (px) — o centro nunca é esmagado abaixo disso. */
export const UI_CENTER_MIN = 320;
/** Abaixo desta largura de container, as laterais viram gavetas overlay. */
export const UI_OVERLAY_BREAKPOINT = 768;
/** Margem de histerese (px): reabrir uma coluna auto-fechada exige folga extra. */
export const UI_EXPAND_MARGIN = 48;

/**
 * Prioridades de auto-collapse (menor fecha primeiro): o centro e a lateral
 * principal (esquerda externa) são os últimos a fechar; internas (contexto)
 * fecham antes das externas; em empate de tier, a direita fecha antes da
 * esquerda (leitura LTR: esquerda = primária).
 */
export const UI_COLUMNS: readonly UiColumnSpec[] = [
  {
    id: "left-outer", side: "left", tier: "outer",
    label: "Esquerda externa",
    description: "Sidebar externa esquerda — abas e blocos expansíveis.",
    defaultWidth: 260, minWidth: 200, maxWidth: 480,
    defaultCollapsed: false, collapsePriority: 4,
  },
  {
    id: "left-inner", side: "left", tier: "inner",
    label: "Esquerda interna",
    description: "Sidebar interna esquerda — contexto ao lado do centro.",
    defaultWidth: 280, minWidth: 200, maxWidth: 480,
    defaultCollapsed: true, collapsePriority: 2,
  },
  {
    id: "right-inner", side: "right", tier: "inner",
    label: "Direita interna",
    description: "Sidebar interna direita — contexto ao lado do centro.",
    defaultWidth: 300, minWidth: 200, maxWidth: 480,
    defaultCollapsed: true, collapsePriority: 1,
  },
  {
    id: "right-outer", side: "right", tier: "outer",
    label: "Direita externa",
    description: "Sidebar externa direita — abas e blocos expansíveis.",
    defaultWidth: 280, minWidth: 200, maxWidth: 480,
    defaultCollapsed: false, collapsePriority: 3,
  },
];

/** Ordem VISUAL das colunas na página: [esq-externa][esq-interna][centro][dir-interna][dir-externa]. */
export const UI_COLUMN_ORDER: readonly UiColumnId[] = [
  "left-outer", "left-inner", "right-inner", "right-outer",
];

export interface UiColumnState {
  /** Largura expandida (px, já clampada). */
  width: number;
  /** Recolhida pelo USUÁRIO (rail). Auto-collapse NÃO grava aqui. */
  collapsed: boolean;
}

export type UiShellState = Record<UiColumnId, UiColumnState>;

export function getColumnSpec(id: UiColumnId): UiColumnSpec {
  return UI_COLUMNS.find((c) => c.id === id)!;
}

/** Estado padrão = layout dividido em 3 colunas (externas abertas, internas em rail). */
export function defaultShellState(): UiShellState {
  return Object.fromEntries(
    UI_COLUMNS.map((c) => [c.id, { width: c.defaultWidth, collapsed: c.defaultCollapsed }]),
  ) as UiShellState;
}

export function clampWidth(spec: UiColumnSpec, w: number): number {
  return Math.min(Math.max(Math.round(w), spec.minWidth), spec.maxWidth);
}

/** Sanitiza estado vindo do storage: campos ausentes/inválidos caem no default. */
export function sanitizeShellState(raw: unknown): UiShellState {
  const base = defaultShellState();
  if (!raw || typeof raw !== "object") return base;
  const obj = raw as Record<string, Partial<UiColumnState>>;
  for (const spec of UI_COLUMNS) {
    const s = obj[spec.id];
    if (!s || typeof s !== "object") continue;
    if (typeof s.width === "number" && Number.isFinite(s.width)) {
      base[spec.id].width = clampWidth(spec, s.width);
    }
    if (typeof s.collapsed === "boolean") base[spec.id].collapsed = s.collapsed;
  }
  return base;
}

export function serializeShellState(state: UiShellState): string {
  return JSON.stringify(state);
}

export function parseShellState(raw: string | null): UiShellState {
  if (!raw) return defaultShellState();
  try {
    return sanitizeShellState(JSON.parse(raw));
  } catch {
    return defaultShellState();
  }
}

/** Modo do shell conforme a largura do CONTAINER (não do viewport): abaixo do
 *  breakpoint, laterais viram gavetas overlay (mobile-first). */
export function shellMode(containerWidth: number): UiShellMode {
  return containerWidth < UI_OVERLAY_BREAKPOINT ? "overlay" : "columns";
}

/** Largura efetiva de uma coluna: rail quando recolhida (pelo usuário OU auto). */
export function effectiveWidth(spec: UiColumnSpec, st: UiColumnState, autoCollapsed: boolean): number {
  return st.collapsed || autoCollapsed ? UI_RAIL_WIDTH : st.width;
}

/** Soma das larguras efetivas de todas as laterais. */
export function totalColumnsWidth(state: UiShellState, auto: ReadonlySet<UiColumnId>): number {
  return UI_COLUMNS.reduce(
    (sum, spec) => sum + effectiveWidth(spec, state[spec.id], auto.has(spec.id)),
    0,
  );
}

/** Cabe no container com centro legível? */
export function fitsIn(containerWidth: number, state: UiShellState, auto: ReadonlySet<UiColumnId>): boolean {
  return containerWidth - totalColumnsWidth(state, auto) >= UI_CENTER_MIN;
}

/**
 * Calcula quais colunas EXPANDIDAS precisam fechar para o centro caber.
 * Determinístico e com histerese:
 *  - Percorre as colunas expandidas da MAIS importante para a menos
 *    (collapsePriority desc), mantendo as que cabem.
 *  - Reabrir uma coluna que ESTAVA auto-fechada (`prevAuto`) exige
 *    UI_EXPAND_MARGIN de folga extra — evita flapping na fronteira.
 *  - Colunas recolhidas pelo usuário nunca entram no conjunto (o rail delas
 *    já está na conta base).
 */
export function resolveAutoCollapsed(
  containerWidth: number,
  state: UiShellState,
  prevAuto: ReadonlySet<UiColumnId> = new Set<UiColumnId>(),
): Set<UiColumnId> {
  const auto = new Set<UiColumnId>();
  // Base: centro mínimo + rails das colunas recolhidas pelo usuário.
  let used = UI_CENTER_MIN;
  for (const spec of UI_COLUMNS) {
    if (state[spec.id].collapsed) used += UI_RAIL_WIDTH;
  }
  const byImportance = [...UI_COLUMNS]
    .filter((spec) => !state[spec.id].collapsed)
    .sort((a, b) => b.collapsePriority - a.collapsePriority);
  for (const spec of byImportance) {
    const st = state[spec.id];
    const margin = prevAuto.has(spec.id) ? UI_EXPAND_MARGIN : 0;
    if (used + st.width + margin <= containerWidth) {
      used += st.width;
    } else {
      auto.add(spec.id);
      used += UI_RAIL_WIDTH;
    }
  }
  return auto;
}

/** Quantas colunas estão VISÍVEIS expandidas (para indicadores de status). */
export function expandedCount(state: UiShellState, auto: ReadonlySet<UiColumnId>): number {
  return UI_COLUMNS.filter((c) => !state[c.id].collapsed && !auto.has(c.id)).length;
}
