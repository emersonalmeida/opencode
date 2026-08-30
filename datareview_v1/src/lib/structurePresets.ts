/**
 * structurePresets — presets ESTRUTURAIS de página (esqueletos sem conteúdo):
 * combinações de colunas, blocos expansíveis e linhas topo/rodapé que o
 * usuário aplica como ponto de partida na página Estrutura (/estrutura).
 *
 * Puro/testável: cada preset devolve um LayoutSpec (layoutTemplates) SEM
 * componentes vinculados — o modo estrutural mostra só a forma; o usuário
 * vincula componentes reais depois (modo dinâmico = preview com dados).
 */
import {
  newColumn, newBlock, newRow, emptySpec,
  type LayoutSpec, type LayoutColumn,
} from "@/lib/layoutTemplates";

export interface StructurePreset {
  id: string;
  name: string;
  description: string;
  build: () => LayoutSpec;
}

/** Coluna com N blocos empilhados (divisões horizontais). */
function col(title: string, blocks = 1, opts?: { weight?: number; sidebar?: boolean }): LayoutColumn {
  const c = newColumn(title, opts?.sidebar ? "sidebar" : "content");
  if (opts?.weight) c.widthWeight = opts.weight;
  while (c.blocks.length < blocks) c.blocks.push(newBlock(`Bloco ${c.blocks.length + 1}`));
  return c;
}

/** Linha (topo/rodapé) com N blocos lado a lado. */
function row(title: string, blocks = 1) {
  const r = newRow(title);
  while (r.blocks.length < blocks) r.blocks.push(newBlock(`Bloco ${r.blocks.length + 1}`));
  return r;
}

export const STRUCTURE_PRESETS: StructurePreset[] = [
  {
    id: "blank",
    name: "Em branco",
    description: "1 coluna · 1 bloco — tela limpa para montar do zero.",
    build: emptySpec,
  },
  {
    id: "grid",
    name: "Grid de cartões",
    description: "2 colunas iguais, cada uma com 2 blocos (grade 2×2 de seções).",
    build: () => ({
      top: [],
      columns: [col("Coluna A", 2), col("Coluna B", 2)],
      bottom: [],
    }),
  },
  {
    id: "one-column",
    name: "Uma coluna",
    description: "Leitura em coluna única com linha de topo e rodapé.",
    build: () => ({
      top: [row("Topo")],
      columns: [col("Conteúdo", 2)],
      bottom: [row("Rodapé")],
    }),
  },
  {
    id: "three-columns",
    name: "3 colunas",
    description: "Laterais auxiliares estreitas + centro largo (padrão clássico).",
    build: () => ({
      top: [],
      columns: [
        col("Lateral esquerda", 1, { sidebar: true }),
        col("Centro", 1, { weight: 2.4 }),
        col("Lateral direita", 1, { sidebar: true }),
      ],
      bottom: [],
    }),
  },
  {
    id: "five-columns",
    name: "5 colunas",
    description: "O modelo do sistema: 2 auxiliares de cada lado + centro largo.",
    build: () => ({
      top: [],
      columns: [
        col("Ext. esquerda", 1, { sidebar: true }),
        col("Int. esquerda", 1, { sidebar: true }),
        col("Centro", 1, { weight: 3 }),
        col("Int. direita", 1, { sidebar: true }),
        col("Ext. direita", 1, { sidebar: true }),
      ],
      bottom: [],
    }),
  },
  {
    id: "five-split-2",
    name: "5 colunas · laterais ÷ 2",
    description: "5 colunas com as 4 laterais divididas em 2 blocos cada.",
    build: () => ({
      top: [],
      columns: [
        col("Ext. esquerda", 2, { sidebar: true }),
        col("Int. esquerda", 2, { sidebar: true }),
        col("Centro", 1, { weight: 3 }),
        col("Int. direita", 2, { sidebar: true }),
        col("Ext. direita", 2, { sidebar: true }),
      ],
      bottom: [],
    }),
  },
  {
    id: "five-split-3",
    name: "5 colunas · laterais ÷ 3",
    description: "5 colunas com as 4 laterais divididas em 3 blocos expansíveis.",
    build: () => ({
      top: [],
      columns: [
        col("Ext. esquerda", 3, { sidebar: true }),
        col("Int. esquerda", 3, { sidebar: true }),
        col("Centro", 1, { weight: 3 }),
        col("Int. direita", 3, { sidebar: true }),
        col("Ext. direita", 3, { sidebar: true }),
      ],
      bottom: [],
    }),
  },
  {
    id: "all-split-2",
    name: "5 colunas · todas ÷ 2",
    description: "5 colunas TODAS divididas em 2 blocos (incluindo o centro).",
    build: () => ({
      top: [],
      columns: [
        col("Ext. esquerda", 2, { sidebar: true }),
        col("Int. esquerda", 2, { sidebar: true }),
        col("Centro", 2, { weight: 3 }),
        col("Int. direita", 2, { sidebar: true }),
        col("Ext. direita", 2, { sidebar: true }),
      ],
      bottom: [],
    }),
  },
  {
    id: "header-footer",
    name: "Topo + 3 colunas + rodapé",
    description: "Linhas de topo/rodapé com 2 blocos cada + corpo em 3 colunas.",
    build: () => ({
      top: [row("Topo", 2)],
      columns: [
        col("Lateral esquerda", 2, { sidebar: true }),
        col("Centro", 2, { weight: 2.4 }),
        col("Lateral direita", 2, { sidebar: true }),
      ],
      bottom: [row("Rodapé", 2)],
    }),
  },
  {
    id: "masonry",
    name: "Colunas assimétricas",
    description: "4 colunas com alturas variadas (1, 3, 2, 4 blocos) — densidade editorial.",
    build: () => ({
      top: [],
      columns: [col("Coluna 1", 1), col("Coluna 2", 3), col("Coluna 3", 2), col("Coluna 4", 4)],
      bottom: [],
    }),
  },
];

export function structurePresetById(id: string): StructurePreset | undefined {
  return STRUCTURE_PRESETS.find((p) => p.id === id);
}

/** Estatísticas de um spec para badges ("5 colunas · 9 blocos"). */
export function specStats(spec: LayoutSpec): { columns: number; blocks: number; rows: number } {
  const rowBlocks = (r: LayoutSpec["top"]) => r.reduce((s, x) => s + x.blocks.length, 0);
  return {
    columns: spec.columns.length,
    blocks: spec.columns.reduce((s, c) => s + c.blocks.length, 0) + rowBlocks(spec.top) + rowBlocks(spec.bottom),
    rows: spec.top.length + spec.bottom.length,
  };
}
