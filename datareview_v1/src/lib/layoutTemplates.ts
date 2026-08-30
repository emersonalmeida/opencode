/**
 * Layout Templates — construtor de modelos de layout de página e telas
 * customizadas funcionais.
 *
 * Modelo (v3):
 *
 *   LayoutSpec
 *   ├── top:    LayoutRow[]     — linhas horizontais no topo (ex.: header),
 *   │              cada uma com blocos expansíveis lado a lado
 *   ├── columns: LayoutColumn[] — 1..N colunas responsivas (peso flex
 *   │              ajustável, recolhível, papel "sidebar" opcional), cada
 *   │              uma com blocos empilhados (a "divisão horizontal")
 *   └── bottom: LayoutRow[]     — linhas horizontais no rodapé (ex.: status)
 *
 * Linhas são entidades (`LayoutRow { id, blocks }`) — dá para ADICIONAR,
 * remover e reordenar linhas, assim como colunas.
 *
 * Persistência: templates/telas em `aso:layout-templates:v3` (cap 30) com
 * pub/sub; v1 (columns-only) e v2 (top/bottom como listas de blocos) são
 * migrados na leitura.
 *
 * Cada `LayoutBlock` é um componente expansível/recolhível/redimensionável
 * que pode estar **vazio** (placeholder estrutural) ou **vinculado** a um
 * componente real do sistema (`component?: string` — ver
 * `src/lib/layoutComponents.ts`) — nesse caso o bloco renderiza o componente
 * com dados reais coletados (dataset/seleção global), tornando o layout uma
 * tela funcional customizada.
 *
 * Persistência: templates/telas em `aso:layout-templates:v2` (cap 30) com
 * pub/sub; v1 (`aso:layout-templates:v1`, columns-only) é migrada na leitura.
 * Toda a lógica é pura/testável (sem React/DOM além de localStorage).
 */

import { useSyncExternalStore } from "react";

// ---------------------------------------------------------------------------
// Modelo
// ---------------------------------------------------------------------------

/** Nível de expansão do bloco: collapsed (só header) → default (altura
 *  fixa) → expanded (cresce com o conteúdo). O campo legado `collapsed`
 *  continua sendo gravado (retrocompat de storage), mas `level` manda. */
export type BlockLevel = "collapsed" | "default" | "expanded";

/** Sub-bloco de um bloco dividido verticalmente (lado a lado) ou em abas. */
export interface LayoutPart {
  id: string;
  title: string;
  component?: string;
}

export interface LayoutBlock {
  id: string;
  /** Rótulo do bloco (nome do contêiner). */
  title: string;
  /** Descrição curta do bloco (visível no nível 3 "recolhido": título+desc). */
  desc?: string;
  /** Recolhido = só o header (legado; derivado de `level`). */
  collapsed: boolean;
  /** Nível de expansão padronizado:
   *  - "default"  (N1): altura fixa, conteúdo com scroll interno;
   *  - "expanded" (N2): cresce com o conteúdo (sem scroll/corte);
   *  - "collapsed"(N3): só título + descrição.
   *  Default: "default". */
  level?: BlockLevel;
  /** Altura do corpo em px (nível 1; ajustável por drag/teclado). */
  height: number;
  /** Componente real do sistema vinculado (id do registry); ausente = vazio. */
  component?: string;
  /** Divisão interna: sub-blocos lado a lado ("split") ou em abas ("tabs"). */
  parts?: LayoutPart[];
  partsLayout?: "split" | "tabs";
}

export interface LayoutColumn {
  id: string;
  /** Peso flex da coluna (proporção relativa; ≥ MIN_WEIGHT). */
  widthWeight: number;
  /** Coluna recolhida (vira rail estreita no preview). */
  collapsed: boolean;
  /** Papel da coluna: "sidebar" renderiza estreita (max-width) no preview. */
  role?: "sidebar" | "content";
  /** Blocos empilhados (divisões horizontais da coluna). */
  blocks: LayoutBlock[];
}

/** Linha horizontal (topo/rodapé): blocos expansíveis lado a lado. */
export interface LayoutRow {
  id: string;
  blocks: LayoutBlock[];
}

export type LayoutRowRegion = "top" | "bottom";

export interface LayoutSpec {
  top: LayoutRow[];
  columns: LayoutColumn[];
  bottom: LayoutRow[];
}

export const BLOCK_MIN_HEIGHT = 48;
export const BLOCK_MAX_HEIGHT = 900;
export const BLOCK_DEFAULT_HEIGHT = 160;
export const MIN_WEIGHT = 0.25;
export const MAX_WEIGHT = 12;
export const MAX_BLOCKS_PER_COLUMN = 8;
export const MAX_COLUMNS = 12;
export const MAX_ROW_BLOCKS = 4;
export const MAX_ROWS_PER_REGION = 4;
export const MAX_PARTS_PER_BLOCK = 6;

let seq = 0;
function genId(prefix: string): string {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${seq}`;
}

export function newBlock(title?: string, component?: string): LayoutBlock {
  return {
    id: genId("bl"),
    title: title ?? "Componente",
    collapsed: false,
    height: BLOCK_DEFAULT_HEIGHT,
    ...(component ? { component } : {}),
  };
}

export function newColumn(title?: string, role?: LayoutColumn["role"]): LayoutColumn {
  return { id: genId("col"), widthWeight: 1, collapsed: false, ...(role ? { role } : {}), blocks: [newBlock(title)] };
}

export function newRow(title?: string): LayoutRow {
  return { id: genId("row"), blocks: [newBlock(title ?? "Linha")] };
}

export function emptySpec(): LayoutSpec {
  return { top: [], columns: [], bottom: [] };
}

// ---------------------------------------------------------------------------
// Ops puras — colunas (imutáveis)
// ---------------------------------------------------------------------------

export function clampWeight(w: number): number {
  return Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, w));
}

export function clampHeight(h: number): number {
  return Math.min(BLOCK_MAX_HEIGHT, Math.max(BLOCK_MIN_HEIGHT, h));
}

function blockTitleAt(n: number): string {
  return `Componente ${n}`;
}

/** Adiciona uma coluna ao final (com 1 bloco). */
export function addColumn(columns: LayoutColumn[], title?: string): LayoutColumn[] {
  if (columns.length >= MAX_COLUMNS) return columns;
  return [...columns, newColumn(title)];
}

/** Divide a coluna horizontalmente: empilha 1 bloco expansível a mais. */
export function splitColumn(columns: LayoutColumn[], columnId: string): LayoutColumn[] {
  return columns.map((c) => {
    if (c.id !== columnId) return c;
    if (c.blocks.length >= MAX_BLOCKS_PER_COLUMN) return c;
    return { ...c, blocks: [...c.blocks, newBlock(blockTitleAt(c.blocks.length + 1))] };
  });
}

/** Remove coluna (nunca deixa sem colunas se houver só 1 e sem linhas). */
export function removeColumn(columns: LayoutColumn[], columnId: string): LayoutColumn[] {
  if (columns.length <= 1) return columns;
  return columns.filter((c) => c.id !== columnId);
}

/** Move coluna ±1 posição. */
export function moveColumn(columns: LayoutColumn[], columnId: string, dir: -1 | 1): LayoutColumn[] {
  const idx = columns.findIndex((c) => c.id === columnId);
  const to = idx + dir;
  if (idx < 0 || to < 0 || to >= columns.length) return columns;
  const next = [...columns];
  [next[idx], next[to]] = [next[to], next[idx]];
  return next;
}

/** Recolhe/expande a coluna (rail no preview). */
export function toggleColumn(columns: LayoutColumn[], columnId: string): LayoutColumn[] {
  return columns.map((c) => (c.id === columnId ? { ...c, collapsed: !c.collapsed } : c));
}

/** Alterna o papel da coluna: "sidebar" (estreita) ↔ "content" (fluida). */
export function toggleColumnRole(columns: LayoutColumn[], columnId: string): LayoutColumn[] {
  return columns.map((c) => {
    if (c.id !== columnId) return c;
    const next = { ...c };
    if (next.role === "sidebar") delete next.role;
    else next.role = "sidebar";
    return next;
  });
}

/** Remove bloco (a coluna nunca fica com 0 blocos). */
export function removeBlock(columns: LayoutColumn[], columnId: string, blockId: string): LayoutColumn[] {
  return columns.map((c) => {
    if (c.id !== columnId) return c;
    if (c.blocks.length <= 1) return c;
    return { ...c, blocks: c.blocks.filter((b) => b.id !== blockId) };
  });
}

/** Próximo nível do ciclo collapsed → default → expanded → collapsed. */
export function nextBlockLevel(level: BlockLevel | undefined, collapsed: boolean): BlockLevel {
  const cur: BlockLevel = level ?? (collapsed ? "collapsed" : "default");
  return cur === "collapsed" ? "default" : cur === "default" ? "expanded" : "collapsed";
}

function withLevel(b: LayoutBlock, level: BlockLevel): LayoutBlock {
  return { ...b, level, collapsed: level === "collapsed" };
}

/** Alterna recolhido/expandido do bloco (binário — preservado p/ teclas e
 *  compat: volta ao "default" quando recolhido). */
export function toggleBlock(columns: LayoutColumn[], columnId: string, blockId: string): LayoutColumn[] {
  return columns.map((c) => {
    if (c.id !== columnId) return c;
    return { ...c, blocks: c.blocks.map((b) => (b.id === blockId ? { ...b, collapsed: !b.collapsed, level: b.collapsed ? "default" : "collapsed" } : b)) };
  });
}

/** Cicla o bloco pelos 3 níveis de expansão. */
export function cycleBlockLevel(columns: LayoutColumn[], columnId: string, blockId: string): LayoutColumn[] {
  return columns.map((c) => {
    if (c.id !== columnId) return c;
    return { ...c, blocks: c.blocks.map((b) => (b.id === blockId ? withLevel(b, nextBlockLevel(b.level, b.collapsed)) : b)) };
  });
}

/** Define o nível explicitamente. */
export function setBlockLevel(columns: LayoutColumn[], columnId: string, blockId: string, level: BlockLevel): LayoutColumn[] {
  return columns.map((c) => {
    if (c.id !== columnId) return c;
    return { ...c, blocks: c.blocks.map((b) => (b.id === blockId ? withLevel(b, level) : b)) };
  });
}

/** Ajusta a altura do bloco (px, clamped). */
export function setBlockHeight(columns: LayoutColumn[], columnId: string, blockId: string, height: number): LayoutColumn[] {
  return columns.map((c) => {
    if (c.id !== columnId) return c;
    return {
      ...c,
      blocks: c.blocks.map((b) => (b.id === blockId ? { ...b, height: clampHeight(height) } : b)),
    };
  });
}

/** Renomeia o bloco. */
export function setBlockTitle(columns: LayoutColumn[], columnId: string, blockId: string, title: string): LayoutColumn[] {
  return columns.map((c) => {
    if (c.id !== columnId) return c;
    return { ...c, blocks: c.blocks.map((b) => (b.id === blockId ? { ...b, title: title.slice(0, 60) } : b)) };
  });
}

/** Define a descrição curta do bloco (visível no nível 3 recolhido). */
export function setBlockDesc(columns: LayoutColumn[], columnId: string, blockId: string, desc: string): LayoutColumn[] {
  return columns.map((c) => {
    if (c.id !== columnId) return c;
    return { ...c, blocks: c.blocks.map((b) => (b.id === blockId ? withDesc(b, desc) : b)) };
  });
}

function withDesc(b: LayoutBlock, desc: string): LayoutBlock {
  const next = { ...b };
  const trimmed = desc.trim().slice(0, 120);
  if (trimmed) next.desc = trimmed;
  else delete next.desc;
  return next;
}

/** Vincula/desvincula o componente real do bloco (undefined = vazio). */
export function setBlockComponent(columns: LayoutColumn[], columnId: string, blockId: string, component: string | undefined): LayoutColumn[] {
  return columns.map((c) => {
    if (c.id !== columnId) return c;
    return {
      ...c,
      blocks: c.blocks.map((b) => {
        if (b.id !== blockId) return b;
        const next = { ...b };
        if (component) next.component = component;
        else delete next.component;
        return next;
      }),
    };
  });
}

/** Ajusta o peso da coluna (proporção relativa, clamped). */
export function resizeColumn(columns: LayoutColumn[], columnId: string, weight: number): LayoutColumn[] {
  return columns.map((c) => (c.id === columnId ? { ...c, widthWeight: clampWeight(weight) } : c));
}

/** Aplica `fn` ao bloco `blockId` dentro de uma lista de blocos (genérico:
 *  serve para blocos de coluna e para blocos de linha topo/rodapé). */
export function updateBlockIn(blocks: LayoutBlock[], blockId: string, fn: (b: LayoutBlock) => LayoutBlock): LayoutBlock[] {
  return blocks.map((b) => (b.id === blockId ? fn(b) : b));
}

export function newPart(title?: string, component?: string): LayoutPart {
  return { id: genId("part"), title: (title ?? "Parte").slice(0, 40), ...(component ? { component } : {}) };
}

/** Divide o bloco em sub-blocos ("split" = lado a lado, "tabs" = abas). */
export function splitBlockB(blocks: LayoutBlock[], blockId: string, layout: "split" | "tabs"): LayoutBlock[] {
  return updateBlockIn(blocks, blockId, (b) => {
    if (b.parts && b.parts.length > 1) return { ...b, partsLayout: layout };
    return {
      ...b,
      partsLayout: layout,
      parts: [newPart(b.title, b.component), newPart(`${b.title} 2`)],
    };
  });
}
export function splitBlockParts(columns: LayoutColumn[], columnId: string, blockId: string, layout: "split" | "tabs"): LayoutColumn[] {
  return columns.map((c) => (c.id === columnId ? { ...c, blocks: splitBlockB(c.blocks, blockId, layout) } : c));
}

/** Adiciona um sub-bloco (aba/coluna interna) ao bloco dividido. */
export function addBlockPartB(blocks: LayoutBlock[], blockId: string): LayoutBlock[] {
  return updateBlockIn(blocks, blockId, (b) => {
    const parts = b.parts ?? [newPart(b.title, b.component)];
    if (parts.length >= MAX_PARTS_PER_BLOCK) return b;
    return {
      ...b,
      partsLayout: b.partsLayout ?? "split",
      parts: [...parts, newPart(`${b.title} ${parts.length + 1}`)],
    };
  });
}
export function addBlockPart(columns: LayoutColumn[], columnId: string, blockId: string): LayoutColumn[] {
  return columns.map((c) => (c.id === columnId ? { ...c, blocks: addBlockPartB(c.blocks, blockId) } : c));
}

/** Remove um sub-bloco; ao restar 1, o bloco volta a ser único (promove). */
export function removeBlockPartB(blocks: LayoutBlock[], blockId: string, partId: string): LayoutBlock[] {
  return updateBlockIn(blocks, blockId, (b) => {
    if (!b.parts) return b;
    const parts = b.parts.filter((p) => p.id !== partId);
    if (parts.length > 1) return { ...b, parts };
    if (parts.length === 1) {
      const only = parts[0];
      const next = { ...b };
      delete next.parts;
      delete next.partsLayout;
      if (only.component) next.component = only.component;
      else delete next.component;
      return next;
    }
    return b;
  });
}
export function removeBlockPart(columns: LayoutColumn[], columnId: string, blockId: string, partId: string): LayoutColumn[] {
  return columns.map((c) => (c.id === columnId ? { ...c, blocks: removeBlockPartB(c.blocks, blockId, partId) } : c));
}

export function setPartTitleB(blocks: LayoutBlock[], blockId: string, partId: string, title: string): LayoutBlock[] {
  return updateBlockIn(blocks, blockId, (b) => ({
    ...b,
    parts: b.parts?.map((p) => (p.id === partId ? { ...p, title: title.slice(0, 40) } : p)),
  }));
}
export function setBlockPartTitle(columns: LayoutColumn[], columnId: string, blockId: string, partId: string, title: string): LayoutColumn[] {
  return columns.map((c) => (c.id === columnId ? { ...c, blocks: setPartTitleB(c.blocks, blockId, partId, title) } : c));
}

export function setPartComponentB(blocks: LayoutBlock[], blockId: string, partId: string, component: string | undefined): LayoutBlock[] {
  return updateBlockIn(blocks, blockId, (b) => ({
    ...b,
    parts: b.parts?.map((p) => {
      if (p.id !== partId) return p;
      const next = { ...p };
      if (component) next.component = component;
      else delete next.component;
      return next;
    }),
  }));
}
export function setBlockPartComponent(columns: LayoutColumn[], columnId: string, blockId: string, partId: string, component: string | undefined): LayoutColumn[] {
  return columns.map((c) => (c.id === columnId ? { ...c, blocks: setPartComponentB(c.blocks, blockId, partId, component) } : c));
}

export function setPartsLayoutB(blocks: LayoutBlock[], blockId: string, layout: "split" | "tabs"): LayoutBlock[] {
  return updateBlockIn(blocks, blockId, (b) => (b.parts ? { ...b, partsLayout: layout } : b));
}
export function setBlockPartsLayout(columns: LayoutColumn[], columnId: string, blockId: string, layout: "split" | "tabs"): LayoutColumn[] {
  return columns.map((c) => (c.id === columnId ? { ...c, blocks: setPartsLayoutB(c.blocks, blockId, layout) } : c));
}

/** Ajusta a altura de TODOS os blocos da lista (altura da linha, por drag). */
export function setBlocksHeightB(blocks: LayoutBlock[], deltaPx: number): LayoutBlock[] {
  return blocks.map((b) => ({ ...b, height: clampHeight(b.height + deltaPx) }));
}

/** Ajusta dois pesos de uma vez (drag entre duas colunas). */
export function resizeColumns(columns: LayoutColumn[], updates: { id: string; weight: number }[]): LayoutColumn[] {
  const map = new Map(updates.map((u) => [u.id, clampWeight(u.weight)]));
  return columns.map((c) => (map.has(c.id) ? { ...c, widthWeight: map.get(c.id)! } : c));
}

/** % de largura de uma coluna (para exibição/aria-valuetext). */
export function columnPercent(column: LayoutColumn, columns: LayoutColumn[]): number {
  const total = columns.reduce((s, c) => s + c.widthWeight, 0);
  return total > 0 ? Math.round((column.widthWeight / total) * 100) : 100;
}

// ---------------------------------------------------------------------------
// Ops puras — linhas topo/rodapé (ENTIDADES LayoutRow: adicionar/remover/
// reordenar linhas, como colunas) + ops de blocos dentro de uma linha
// ---------------------------------------------------------------------------

/** Adiciona uma linha vazia (1 bloco) à região (topo/rodapé). */
export function addRow(rows: LayoutRow[], title?: string): LayoutRow[] {
  if (rows.length >= MAX_ROWS_PER_REGION) return rows;
  return [...rows, newRow(title)];
}

export function removeRow(rows: LayoutRow[], rowId: string): LayoutRow[] {
  return rows.filter((r) => r.id !== rowId);
}

/** Move a linha ±1 posição dentro da região. */
export function moveRow(rows: LayoutRow[], rowId: string, dir: -1 | 1): LayoutRow[] {
  const idx = rows.findIndex((r) => r.id === rowId);
  const to = idx + dir;
  if (idx < 0 || to < 0 || to >= rows.length) return rows;
  const next = [...rows];
  [next[idx], next[to]] = [next[to], next[idx]];
  return next;
}

/** Aplica `fn` aos blocos de UMA linha (as ops de bloco de linha abaixo). */
export function mutateRowBlocks(rows: LayoutRow[], rowId: string, fn: (blocks: LayoutBlock[]) => LayoutBlock[]): LayoutRow[] {
  return rows.map((r) => (r.id === rowId ? { ...r, blocks: fn(r.blocks) } : r));
}

/** Adiciona 1 bloco expansível à linha (topo ou rodapé). */
export function addRowBlock(blocks: LayoutBlock[], title?: string): LayoutBlock[] {
  if (blocks.length >= MAX_ROW_BLOCKS) return blocks;
  return [...blocks, newBlock(title ?? blockTitleAt(blocks.length + 1))];
}

export function removeRowBlock(blocks: LayoutBlock[], blockId: string): LayoutBlock[] {
  return blocks.filter((b) => b.id !== blockId);
}

export function toggleRowBlock(blocks: LayoutBlock[], blockId: string): LayoutBlock[] {
  return blocks.map((b) => (b.id === blockId ? { ...b, collapsed: !b.collapsed, level: b.collapsed ? "default" : "collapsed" } : b));
}

export function cycleRowBlockLevel(blocks: LayoutBlock[], blockId: string): LayoutBlock[] {
  return blocks.map((b) => (b.id === blockId ? withLevel(b, nextBlockLevel(b.level, b.collapsed)) : b));
}

export function setRowBlockHeight(blocks: LayoutBlock[], blockId: string, height: number): LayoutBlock[] {
  return blocks.map((b) => (b.id === blockId ? { ...b, height: clampHeight(height) } : b));
}

export function setRowBlockTitle(blocks: LayoutBlock[], blockId: string, title: string): LayoutBlock[] {
  return blocks.map((b) => (b.id === blockId ? { ...b, title: title.slice(0, 60) } : b));
}

/** Define a descrição curta de um bloco de linha. */
export function setRowBlockDesc(blocks: LayoutBlock[], blockId: string, desc: string): LayoutBlock[] {
  return blocks.map((b) => (b.id === blockId ? withDesc(b, desc) : b));
}

export function setRowBlockComponent(blocks: LayoutBlock[], blockId: string, component: string | undefined): LayoutBlock[] {
  return blocks.map((b) => {
    if (b.id !== blockId) return b;
    const next = { ...b };
    if (component) next.component = component;
    else delete next.component;
    return next;
  });
}

// ---------------------------------------------------------------------------
// LayoutSpec — mutadores compostos
// ---------------------------------------------------------------------------

export function mutateColumns(spec: LayoutSpec, fn: (cols: LayoutColumn[]) => LayoutColumn[]): LayoutSpec {
  return { ...spec, columns: fn(spec.columns) };
}

export function mutateRow(spec: LayoutSpec, region: LayoutRowRegion, fn: (rows: LayoutRow[]) => LayoutRow[]): LayoutSpec {
  return { ...spec, [region]: fn(spec[region]) };
}

/** Todos os blocos do spec (colunas + linhas), para varreduras. */
export function allBlocks(spec: LayoutSpec): LayoutBlock[] {
  return [
    ...spec.top.flatMap((r) => r.blocks),
    ...spec.bottom.flatMap((r) => r.blocks),
    ...spec.columns.flatMap((c) => c.blocks),
  ];
}

/** Resumo "3 colunas · 5 blocos · 2 linhas". */
export function layoutSummary(spec: LayoutSpec): { columns: number; blocks: number; rows: number; bound: number } {
  const colBlocks = spec.columns.reduce((s, c) => s + c.blocks.length, 0);
  return {
    columns: spec.columns.length,
    blocks: colBlocks,
    rows: spec.top.length + spec.bottom.length,
    bound: allBlocks(spec).filter((b) => b.component).length,
  };
}

// ---------------------------------------------------------------------------
// Presets builtin (estruturas prontas — incluindo o fluxo descrito pelo
// usuário e uma "tela completa" com linhas topo/rodapé + componentes reais)
// ---------------------------------------------------------------------------

export interface LayoutPreset {
  id: string;
  name: string;
  description: string;
  build: () => LayoutSpec;
}

/** Preset do fluxo inicial descrito: [2 blocos] · [1 bloco] · [2 blocos]. */
function initialFlowSpec(): LayoutSpec {
  let cols: LayoutColumn[] = [];
  cols = addColumn(cols);
  cols = splitColumn(cols, cols[0].id);
  cols = addColumn(cols);
  cols = addColumn(cols);
  cols = splitColumn(cols, cols[2].id);
  return { top: [], columns: cols, bottom: [] };
}

/** Tela completa: header no topo, status no rodapé, laterais divididas e
 *  centro com chat de IA — com componentes reais vinculados. */
function fullScreenSpec(): LayoutSpec {
  const left: LayoutColumn = {
    id: genId("col"), widthWeight: 0.7, collapsed: false, role: "sidebar",
    blocks: [newBlock("Campo de busca", "search-field"), newBlock("Resultados", "search-results"), newBlock("Selecionados", "app-selection")],
  };
  const center: LayoutColumn = {
    id: genId("col"), widthWeight: 2, collapsed: false,
    blocks: [newBlock("Chat com IA", "ai-chat")],
  };
  const right: LayoutColumn = {
    id: genId("col"), widthWeight: 0.8, collapsed: false, role: "sidebar",
    blocks: [newBlock("Gráficos", "charts"), newBlock("Insights", "insights")],
  };
  return {
    top: [{ id: genId("row"), blocks: [newBlock("Cabeçalho", "header")] }],
    columns: [left, center, right],
    bottom: [{ id: genId("row"), blocks: [newBlock("Status & progresso", "status")] }],
  };
}

export const LAYOUT_PRESETS: LayoutPreset[] = [
  {
    id: "initial-flow",
    name: "Fluxo inicial",
    description: "3 colunas: a 1ª dividida em 2, a do meio simples e a 3ª dividida em 2 — o passo a passo descrito.",
    build: initialFlowSpec,
  },
  {
    id: "full-screen",
    name: "Tela completa",
    description: "Linha de topo (header) + rodapé (status) + laterais divididas em 2 e centro com chat de IA — já com componentes reais.",
    build: fullScreenSpec,
  },
  {
    id: "single",
    name: "Uma coluna",
    description: "1 coluna · 1 componente (página de leitura).",
    build: () => ({ top: [], columns: [newColumn("Conteúdo")], bottom: [] }),
  },
  {
    id: "dashboard",
    name: "Dashboard 3 colunas",
    description: "Lateral estreita · centro largo com 2 blocos · lateral estreita.",
    build: () => {
      const a = { ...newColumn("Lateral esquerda"), widthWeight: 0.5 };
      const mid = newColumn("Central");
      mid.widthWeight = 2;
      mid.blocks.push(newBlock("Bloco 2"));
      const b = { ...newColumn("Lateral direita"), widthWeight: 0.5 };
      return { top: [], columns: [a, mid, b], bottom: [] };
    },
  },
  {
    id: "split-50",
    name: "Duas colunas iguais",
    description: "2 colunas com 2 blocos cada (comparativo lado a lado).",
    build: () => {
      const a = newColumn("Coluna A");
      a.blocks.push(newBlock("Bloco 2"));
      const b = newColumn("Coluna B");
      b.blocks.push(newBlock("Bloco 2"));
      return { top: [], columns: [a, b], bottom: [] };
    },
  },
  {
    id: "article",
    name: "Conteúdo + complementos",
    description: "Centro largo de leitura com colunas finas de apoio nas pontas.",
    build: () => {
      const a = { ...newColumn("Apoio"), widthWeight: 0.4 };
      const mid = { ...newColumn("Leitura"), widthWeight: 2.4 };
      const b = { ...newColumn("Extras"), widthWeight: 0.4 };
      return { top: [], columns: [a, mid, b], bottom: [] };
    },
  },
];

// ---------------------------------------------------------------------------
// Serialização (export/import) + migração v1 (columns-only) → v2
// ---------------------------------------------------------------------------

export function serializeLayout(spec: LayoutSpec): { v: number; top: LayoutRow[]; columns: LayoutColumn[]; bottom: LayoutRow[] } {
  return { v: 3, top: spec.top, columns: spec.columns, bottom: spec.bottom };
}

function sanitizeLevel(raw: unknown, collapsed: boolean): BlockLevel {
  if (raw === "collapsed" || raw === "default" || raw === "expanded") return raw;
  return collapsed ? "collapsed" : "default";
}

function sanitizeParts(raw: unknown): LayoutPart[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const parts = (raw as Partial<LayoutPart>[])
    .filter((p) => typeof p?.id === "string" && p.id)
    .slice(0, MAX_PARTS_PER_BLOCK)
    .map((p) => ({
      id: p!.id!,
      title: typeof p?.title === "string" && p.title.trim() ? p.title.slice(0, 40) : "Parte",
      ...(typeof p?.component === "string" && p.component ? { component: p.component } : {}),
    }));
  return parts.length > 0 ? parts : undefined;
}

function sanitizeBlocks(raw: unknown): LayoutBlock[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Partial<LayoutBlock>[])
    .filter((b) => typeof b?.id === "string" && b.id)
    .map((b) => {
      const collapsed = b?.collapsed === true;
      const parts = sanitizeParts(b?.parts);
      return {
        id: b!.id!,
        title: typeof b?.title === "string" && b.title.trim() ? b.title.slice(0, 60) : "Componente",
        ...(typeof b?.desc === "string" && b.desc.trim() ? { desc: b.desc.trim().slice(0, 120) } : {}),
        collapsed,
        level: sanitizeLevel(b?.level, collapsed),
        height: clampHeight(typeof b?.height === "number" ? b.height : BLOCK_DEFAULT_HEIGHT),
        ...(typeof b?.component === "string" && b.component ? { component: b.component } : {}),
        ...(parts && parts.length > 1
          ? { parts, partsLayout: b?.partsLayout === "tabs" ? ("tabs" as const) : ("split" as const) }
          : {}),
      };
    });
}

/** Saneia uma região de linhas aceitando v3 (LayoutRow[]) e v2 (LayoutBlock[]
 *  — vira UMA linha). */
function sanitizeRows(raw: unknown): LayoutRow[] {
  if (!Array.isArray(raw)) return [];
  const isV3 = raw.some((r) => r && typeof r === "object" && Array.isArray((r as Partial<LayoutRow>).blocks));
  if (isV3) {
    const rows: LayoutRow[] = [];
    for (const r of raw as Partial<LayoutRow>[]) {
      const blocks = sanitizeBlocks(r?.blocks).slice(0, MAX_ROW_BLOCKS);
      if (blocks.length === 0) continue;
      rows.push({ id: typeof r?.id === "string" && r.id ? r.id : genId("row"), blocks });
      if (rows.length >= MAX_ROWS_PER_REGION) break;
    }
    return rows;
  }
  // v2: lista de blocos → uma linha
  const blocks = sanitizeBlocks(raw).slice(0, MAX_ROW_BLOCKS);
  return blocks.length > 0 ? [{ id: genId("row"), blocks }] : [];
}

export function sanitizeColumns(raw: unknown): LayoutColumn[] {
  if (!Array.isArray(raw)) return [];
  const cols: LayoutColumn[] = [];
  for (const c of raw as Partial<LayoutColumn>[]) {
    if (typeof c?.id !== "string" || !c.id) continue;
    const blocks = sanitizeBlocks(c.blocks);
    if (blocks.length === 0) continue;
    cols.push({
      id: c.id,
      widthWeight: clampWeight(typeof c.widthWeight === "number" ? c.widthWeight : 1),
      collapsed: c.collapsed === true,
      ...(c.role === "sidebar" ? { role: "sidebar" as const } : {}),
      blocks: blocks.slice(0, MAX_BLOCKS_PER_COLUMN),
    });
    if (cols.length >= MAX_COLUMNS) break;
  }
  return cols;
}

/** Saneia qualquer payload (v1 columns-only, v2 top/bottom de blocos ou v3
 *  completo) em um LayoutSpec. */
export function sanitizeSpec(raw: unknown): LayoutSpec {
  const obj = (raw ?? {}) as { top?: unknown; columns?: unknown; bottom?: unknown };
  return {
    top: sanitizeRows(obj.top),
    columns: sanitizeColumns(obj.columns),
    bottom: sanitizeRows(obj.bottom),
  };
}

export function deserializeLayout(text: string): LayoutSpec | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    const spec = sanitizeSpec(parsed);
    const hasContent = spec.columns.length > 0 || spec.top.length > 0 || spec.bottom.length > 0;
    return hasContent ? spec : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Templates/telas salvos (pub/sub — padrão pageGroups/sessionStore)
// ---------------------------------------------------------------------------

const STORAGE_KEY = "aso:layout-templates:v3";
const LEGACY_KEYS = ["aso:layout-templates:v2", "aso:layout-templates:v1"];
const MAX_TEMPLATES = 30;

export interface SavedTemplate {
  id: string;
  name: string;
  spec: LayoutSpec;
  createdAt: number;
  updatedAt: number;
}

let templates: SavedTemplate[] = loadTemplates();
const listeners = new Set<() => void>();

function loadTemplates(): SavedTemplate[] {
  const out: SavedTemplate[] = [];
  // Migra v1 (columns-only) e v2 (top/bottom como listas de blocos) na leitura.
  for (const legacyKey of LEGACY_KEYS) {
    try {
      const legacyRaw = localStorage.getItem(legacyKey);
      if (legacyRaw) {
        const parsed = JSON.parse(legacyRaw) as unknown;
        if (Array.isArray(parsed)) {
          for (const t of parsed as { id?: unknown; name?: unknown; spec?: unknown; columns?: unknown; createdAt?: unknown; updatedAt?: unknown }[]) {
            if (typeof t?.id !== "string" || !t.id || typeof t?.name !== "string" || !t.name.trim()) continue;
            const spec = sanitizeSpec(t.spec ?? { columns: t.columns });
            if (spec.columns.length === 0 && spec.top.length === 0 && spec.bottom.length === 0) continue;
            out.push({
              id: t.id,
              name: t.name.trim().slice(0, 60),
              spec,
              createdAt: typeof t.createdAt === "number" ? t.createdAt : Date.now(),
              updatedAt: typeof t.updatedAt === "number" ? t.updatedAt : Date.now(),
            });
          }
        }
      }
    } catch { /* legado corrompido — ignora */ }
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        for (const t of parsed as Partial<SavedTemplate>[]) {
          if (typeof t?.id !== "string" || !t.id || typeof t?.name !== "string" || !t.name.trim()) continue;
          const spec = sanitizeSpec(t.spec);
          if (spec.columns.length === 0 && spec.top.length === 0 && spec.bottom.length === 0) continue;
          out.push({
            id: t.id,
            name: t.name.trim().slice(0, 60),
            spec,
            createdAt: typeof t.createdAt === "number" ? t.createdAt : Date.now(),
            updatedAt: typeof t.updatedAt === "number" ? t.updatedAt : Date.now(),
          });
        }
      }
    }
  } catch { /* v2 corrompido — ignora */ }

  // Dedup por id (v2 vence) e cap.
  const seen = new Set<string>();
  return out.filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true))).slice(0, MAX_TEMPLATES);
}

function persist() {
  fingerprint = computeFingerprint();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
    // v1/v2 já migrados — remove para não duplicar em próximas leituras.
    for (const k of LEGACY_KEYS) localStorage.removeItem(k);
  } catch { /* quota */ }
  listeners.forEach((l) => l());
}

export function subscribeTemplates(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function listTemplates(): SavedTemplate[] {
  return [...templates].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function saveTemplate(name: string, spec: LayoutSpec): SavedTemplate {
  const t: SavedTemplate = {
    id: genId("tpl"),
    name: name.trim().slice(0, 60) || "Sem nome",
    spec: sanitizeSpec(spec),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  templates = [t, ...templates].slice(0, MAX_TEMPLATES);
  persist();
  return t;
}

export function renameTemplate(id: string, name: string): void {
  templates = templates.map((t) => (t.id === id ? { ...t, name: name.trim().slice(0, 60) || t.name, updatedAt: Date.now() } : t));
  persist();
}

export function updateTemplate(id: string, spec: LayoutSpec): void {
  templates = templates.map((t) => (t.id === id ? { ...t, spec: sanitizeSpec(spec), updatedAt: Date.now() } : t));
  persist();
}

export function deleteTemplate(id: string): void {
  templates = templates.filter((t) => t.id !== id);
  persist();
}

export function exportTemplateText(name: string, spec: LayoutSpec): string {
  return JSON.stringify({ name, ...serializeLayout(spec) }, null, 2);
}

// Snapshot memoizado (string) para useSyncExternalStore — anti-loop igual ao
// padrão do useChatHistory: a referência só muda quando templates mudam.
let fingerprint = computeFingerprint();

function computeFingerprint(): string {
  return templates.map((t) => `${t.id}@${t.updatedAt}`).join("|");
}

/** Hook reativo dos templates salvos. */
export function useLayoutTemplates(): SavedTemplate[] {
  useSyncExternalStore(subscribeTemplates, () => fingerprint);
  return listTemplates();
}
