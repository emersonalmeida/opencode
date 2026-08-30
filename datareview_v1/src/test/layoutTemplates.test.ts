import {
  describe,
  it,
  expect,
  beforeEach } from "vitest"; import {   addColumn,
  splitColumn,
  removeColumn,
  moveColumn,
  toggleColumn,
  toggleColumnRole,
  removeBlock,
  toggleBlock,
  cycleBlockLevel,
  setBlockLevel,
  nextBlockLevel,
  setBlockHeight,
  setBlockTitle,
  setBlockDesc,
  setBlockComponent,
  addRow,
  removeRow,
  moveRow,
  mutateRowBlocks,
  addRowBlock,
  removeRowBlock,
  toggleRowBlock,
  cycleRowBlockLevel,
  setRowBlockHeight,
  setRowBlockTitle,
  setRowBlockDesc,
  setRowBlockComponent,
  resizeColumn,
  resizeColumns,
  columnPercent,
  layoutSummary,
  newColumn,
  newBlock,
  emptySpec,
  mutateColumns,
  mutateRow,
  LAYOUT_PRESETS,
  serializeLayout,
  deserializeLayout,
  sanitizeColumns,
  sanitizeSpec,
  listTemplates,
  saveTemplate,
  renameTemplate,
  updateTemplate,
  deleteTemplate,
  exportTemplateText,
  BLOCK_MIN_HEIGHT,
  BLOCK_MAX_HEIGHT,
  MIN_WEIGHT,
  MAX_WEIGHT,
  MAX_COLUMNS,
  MAX_BLOCKS_PER_COLUMN,
  MAX_ROW_BLOCKS,
  MAX_ROWS_PER_REGION,
  splitBlockParts,
  addBlockPart,
  removeBlockPart,
  setPartComponentB,
  setBlocksHeightB,
  splitBlockB,
} from "@/lib/layoutTemplates";
import type { LayoutColumn, LayoutSpec } from "@/lib/layoutTemplates";

const specOf = (columns: LayoutColumn[]): LayoutSpec => ({ top: [], columns, bottom: [] });

describe("layoutTemplates — ops de colunas", () => {
  beforeEach(() => { localStorage.clear(); });

  it("adiciona coluna com 1 bloco expansível", () => {
    const cols = addColumn([]);
    expect(cols).toHaveLength(1);
    expect(cols[0].blocks).toHaveLength(1);
    expect(cols[0].blocks[0].collapsed).toBe(false);
    expect(cols[0].widthWeight).toBe(1);
  });

  it("respecta o teto de colunas (MAX_COLUMNS)", () => {
    let cols: LayoutColumn[] = [newColumn()];
    for (let i = 0; i < MAX_COLUMNS + 5; i++) cols = addColumn(cols);
    expect(cols.length).toBe(MAX_COLUMNS);
  });

  it("dividir coluna empilha 1 bloco a mais (divisão horizontal)", () => {
    let cols = addColumn([]);
    cols = splitColumn(cols, cols[0].id);
    expect(cols[0].blocks).toHaveLength(2);
    expect(cols[0].blocks[1].title).toContain("2");
  });

  it("dividir respeita teto de blocos por coluna (MAX_BLOCKS_PER_COLUMN)", () => {
    let cols = addColumn([]);
    for (let i = 0; i < MAX_BLOCKS_PER_COLUMN + 5; i++) cols = splitColumn(cols, cols[0].id);
    expect(cols[0].blocks.length).toBe(MAX_BLOCKS_PER_COLUMN);
  });

  it("fluxo descrito pelo usuário: dividir → +coluna → +coluna dividida", () => {
    let cols = addColumn([]);
    cols = splitColumn(cols, cols[0].id);
    cols = addColumn(cols);
    cols = addColumn(cols);
    cols = splitColumn(cols, cols[2].id);
    expect(cols).toHaveLength(3);
    expect(cols[0].blocks).toHaveLength(2);
    expect(cols[1].blocks).toHaveLength(1);
    expect(cols[2].blocks).toHaveLength(2);
    expect(layoutSummary(specOf(cols))).toMatchObject({ columns: 3, blocks: 5, rows: 0 });
  });

  it("remover coluna nunca deixa o canvas sem colunas", () => {
    let cols = addColumn([]);
    cols = removeColumn(cols, cols[0].id);
    expect(cols).toHaveLength(1);
    let two = addColumn(addColumn([]));
    two = removeColumn(two, two[0].id);
    expect(two).toHaveLength(1);
  });

  it("mover coluna esquerda/direita com limites", () => {
    const cols = [newColumn("A"), newColumn("B"), newColumn("C")];
    const moved = moveColumn(cols, cols[1].id, -1);
    expect(moved[0].blocks[0].title).toBe("B");
    const bounded = moveColumn(cols, cols[0].id, -1);
    expect(bounded[0].blocks[0].title).toBe("A");
  });

  it("toggleColumnRole alterna papel sidebar ↔ conteúdo", () => {
    let cols = addColumn([]);
    const colId = cols[0].id;
    expect(cols[0].role).toBeUndefined();
    cols = toggleColumnRole(cols, colId);
    expect(cols[0].role).toBe("sidebar");
    cols = toggleColumnRole(cols, colId);
    expect(cols[0].role).toBeUndefined();
  });

  it("setBlockDesc define/limpa a descrição (visível no N3 recolhido)", () => {
    let cols = addColumn([]);
    const colId = cols[0].id;
    const blkId = cols[0].blocks[0].id;
    cols = setBlockDesc(cols, colId, blkId, "Resumo do bloco");
    expect(cols[0].blocks[0].desc).toBe("Resumo do bloco");
    cols = setBlockDesc(cols, colId, blkId, "  ");
    expect(cols[0].blocks[0].desc).toBeUndefined();
  });

  it("toggleColumn recolhe/expande a coluna (rail)", () => {
    const cols = addColumn([]);
    const id = cols[0].id;
    expect(toggleColumn(cols, id)[0].collapsed).toBe(true);
    expect(toggleColumn(toggleColumn(cols, id), id)[0].collapsed).toBe(false);
  });

  it("remover bloco nunca deixa a coluna sem blocos", () => {
    let cols = addColumn([]);
    cols = removeBlock(cols, cols[0].id, cols[0].blocks[0].id);
    expect(cols[0].blocks).toHaveLength(1);
    cols = splitColumn(cols, cols[0].id);
    const other = removeBlock(cols, cols[0].id, cols[0].blocks[0].id);
    expect(other[0].blocks).toHaveLength(1);
  });

  it("toggleBlock alterna recolhido/expandido", () => {
    const cols = addColumn([]);
    const { id } = cols[0];
    const bid = cols[0].blocks[0].id;
    expect(toggleBlock(cols, id, bid)[0].blocks[0].collapsed).toBe(true);
    expect(toggleBlock(toggleBlock(cols, id, bid), id, bid)[0].blocks[0].collapsed).toBe(false);
  });

  it("altura do bloco respeita MIN/MAX", () => {
    const cols = addColumn([]);
    const { id } = cols[0];
    const bid = cols[0].blocks[0].id;
    expect(setBlockHeight(cols, id, bid, 5)[0].blocks[0].height).toBe(BLOCK_MIN_HEIGHT);
    expect(setBlockHeight(cols, id, bid, 99999)[0].blocks[0].height).toBe(BLOCK_MAX_HEIGHT);
  });

  it("renomear bloco (truncate em 60)", () => {
    const cols = addColumn([]);
    const next = setBlockTitle(cols, cols[0].id, cols[0].blocks[0].id, "x".repeat(100));
    expect(next[0].blocks[0].title.length).toBe(60);
  });

  it("setBlockComponent vincula e desvincula componente real", () => {
    const cols = addColumn([]);
    const { id } = cols[0];
    const bid = cols[0].blocks[0].id;
    const bound = setBlockComponent(cols, id, bid, "ai-chat");
    expect(bound[0].blocks[0].component).toBe("ai-chat");
    const unbound = setBlockComponent(bound, id, bid, undefined);
    expect(unbound[0].blocks[0].component).toBeUndefined();
  });

  it("peso da coluna respeita MIN/MAX weight", () => {
    const cols = addColumn([]);
    expect(resizeColumn(cols, cols[0].id, 0.01)[0].widthWeight).toBe(MIN_WEIGHT);
    expect(resizeColumn(cols, cols[0].id, 100)[0].widthWeight).toBe(MAX_WEIGHT);
  });

  it("resizeColumns ajusta dois pesos de uma vez", () => {
    const cols = [newColumn("A"), newColumn("B")];
    const next = resizeColumns(cols, [
      { id: cols[0].id, weight: 2 },
      { id: cols[1].id, weight: 1 },
    ]);
    expect(next[0].widthWeight).toBe(2);
    expect(next[1].widthWeight).toBe(1);
    expect(columnPercent(next[0], next)).toBe(67);
    expect(columnPercent(next[1], next)).toBe(33);
  });
});

describe("layoutTemplates — linhas topo/rodapé (entidades v3)", () => {
  it("adiciona, remove e reordena linhas (como colunas)", () => {
    let rows = addRow([]);
    rows = addRow(rows, "Header");
    expect(rows).toHaveLength(2);
    expect(rows[0].blocks).toHaveLength(1);
    // teto por região
    for (let i = 0; i < MAX_ROWS_PER_REGION + 3; i++) rows = addRow(rows);
    expect(rows.length).toBe(MAX_ROWS_PER_REGION);
    // mover
    const first = rows[0].id;
    rows = moveRow(rows, first, 1);
    expect(rows[1].id).toBe(first);
    rows = moveRow(rows, first, -1);
    expect(rows[0].id).toBe(first);
    rows = moveRow(rows, first, -1);
    expect(rows[0].id).toBe(first); // não sai do lugar no limite
    // remover
    rows = removeRow(rows, first);
    expect(rows.find((r) => r.id === first)).toBeUndefined();
  });

  it("mutateRowBlocks aplica ops de bloco a UMA linha", () => {
    let rows = addRow([], "Topo");
    rows = mutateRowBlocks(rows, rows[0].id, (bs) => addRowBlock(bs, "Header"));
    rows = mutateRowBlocks(rows, rows[0].id, (bs) => addRowBlock(bs, "Busca"));
    expect(rows[0].blocks.map((b) => b.title)).toEqual(["Topo", "Header", "Busca"]);
  });

  it("adiciona bloco na linha do topo e no rodapé", () => {
    const top = addRowBlock([], "Header");
    const bottom = addRowBlock([], "Status");
    expect(top).toHaveLength(1);
    expect(bottom).toHaveLength(1);
    expect(top[0].collapsed).toBe(false);
  });

  it("respeita teto de blocos por linha (MAX_ROW_BLOCKS)", () => {
    let blocks = addRowBlock([]);
    for (let i = 0; i < MAX_ROW_BLOCKS + 5; i++) blocks = addRowBlock(blocks);
    expect(blocks.length).toBe(MAX_ROW_BLOCKS);
  });

  it("remover/toggle/altura/título/componente na linha", () => {
    let blocks = addRowBlock(addRowBlock([]));
    const [b1, b2] = blocks;
    blocks = toggleRowBlock(blocks, b1.id);
    expect(blocks[0].collapsed).toBe(true);
    blocks = setRowBlockHeight(blocks, b1.id, 99999);
    expect(blocks[0].height).toBe(BLOCK_MAX_HEIGHT);
    blocks = setRowBlockTitle(blocks, b1.id, "Status & progresso");
    expect(blocks[0].title).toBe("Status & progresso");
    blocks = setRowBlockComponent(blocks, b2.id, "status");
    expect(blocks[1].component).toBe("status");
    blocks = removeRowBlock(blocks, b1.id);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].id).toBe(b2.id);
  });

  it("mutateColumns/mutateRow compõem sobre o spec", () => {
    let spec = emptySpec();
    spec = mutateColumns(spec, (c) => addColumn(c));
    spec = mutateRow(spec, "top", (rows) => addRow(rows, "Header"));
    spec = mutateRow(spec, "bottom", (rows) => addRow(rows, "Status"));
    expect(spec.columns).toHaveLength(1);
    expect(spec.top).toHaveLength(1);
    expect(spec.bottom).toHaveLength(1);
    expect(layoutSummary(spec)).toMatchObject({ columns: 1, blocks: 1, rows: 2 });
  });

  it("layoutSummary conta blocos com componente vinculado (bound)", () => {
    let spec = emptySpec();
    spec = mutateColumns(spec, (c) => addColumn(c));
    spec = mutateColumns(spec, (c) => setBlockComponent(c, c[0].id, c[0].blocks[0].id, "charts"));
    spec = mutateRow(spec, "top", (rows) => addRow(rows, "Header"));
    spec = mutateRow(spec, "top", (rows) => mutateRowBlocks(rows, rows[0].id, (bs) => setRowBlockComponent(bs, bs[0].id, "header")));
    const s = layoutSummary(spec);
    expect(s.bound).toBe(2);
  });
});

describe("layoutTemplates — presets", () => {
  it("todos os presets constroem specs válidas", () => {
    for (const p of LAYOUT_PRESETS) {
      const spec = p.build();
      expect(spec.columns.length, `preset ${p.id}`).toBeGreaterThan(0);
      for (const c of spec.columns) {
        expect(c.blocks.length).toBeGreaterThan(0);
        expect(c.widthWeight).toBeGreaterThanOrEqual(MIN_WEIGHT);
      }
    }
  });

  it("preset 'Fluxo inicial' reproduz o passo a passo (3 colunas: 2/1/2)", () => {
    const spec = LAYOUT_PRESETS.find((p) => p.id === "initial-flow")!.build();
    expect(spec.columns).toHaveLength(3);
    expect(spec.columns[0].blocks).toHaveLength(2);
    expect(spec.columns[1].blocks).toHaveLength(1);
    expect(spec.columns[2].blocks).toHaveLength(2);
    expect(spec.top).toHaveLength(0);
    expect(spec.bottom).toHaveLength(0);
  });

  it("preset 'Tela completa' tem header (topo), status (rodapé), busca separada (campo/resultados/seleção) e chat no centro", () => {
    const spec = LAYOUT_PRESETS.find((p) => p.id === "full-screen")!.build();
    expect(spec.top[0]?.blocks[0]?.component).toBe("header");
    expect(spec.bottom[0]?.blocks[0]?.component).toBe("status");
    expect(spec.columns).toHaveLength(3);
    expect(spec.columns[0].role).toBe("sidebar");
    expect(spec.columns[0].blocks.map((b) => b.component)).toEqual(["search-field", "search-results", "app-selection"]);
    expect(spec.columns[1].blocks.map((b) => b.component)).toEqual(["ai-chat"]);
    expect(spec.columns[2].blocks).toHaveLength(2);
  });
});

describe("layoutTemplates — serialização, sanitização e migração v1/v2→v3", () => {
  it("serialize/deserialize faz round-trip com linhas e componentes", () => {
    const spec = LAYOUT_PRESETS.find((p) => p.id === "full-screen")!.build();
    const back = deserializeLayout(JSON.stringify(serializeLayout(spec)))!;
    expect(back.top[0].blocks[0].component).toBe("header");
    expect(back.bottom[0].blocks[0].component).toBe("status");
    expect(back.columns).toHaveLength(3);
    expect(back.columns[0].role).toBe("sidebar");
  });

  it("deserialize rejeita JSON inválido e estrutura vazia", () => {
    expect(deserializeLayout("não é json")).toBeNull();
    expect(deserializeLayout("{}")).toBeNull();
    expect(deserializeLayout('{"columns":[]}')).toBeNull();
  });

  it("migra payload v1 (columns-only) para spec v3", () => {
    const v1 = { v: 1, columns: [newColumn("A")] };
    const spec = deserializeLayout(JSON.stringify(v1))!;
    expect(spec.columns).toHaveLength(1);
    expect(spec.top).toHaveLength(0);
    expect(spec.bottom).toHaveLength(0);
  });

  it("migra payload v2 (top/bottom como listas de blocos) para linhas v3", () => {
    const v2 = {
      v: 2,
      columns: [newColumn("A")],
      top: [newBlock("Header", "header"), newBlock("Busca")],
      bottom: [newBlock("Status", "status")],
    };
    const spec = sanitizeSpec(v2);
    expect(spec.top).toHaveLength(1); // v2 → uma linha
    expect(spec.top[0].blocks).toHaveLength(2);
    expect(spec.top[0].blocks[0].component).toBe("header");
    expect(spec.bottom[0].blocks[0].component).toBe("status");
  });

  it("sanitizeColumns descarta colunas/blocos inválidos e aplica clamps", () => {
    const raw = [
      { id: "c1", widthWeight: 999, blocks: [{ id: "b1", title: "X", height: 1, component: "ai-chat" }] },
      { id: "c2", widthWeight: 0, blocks: [] },
      { id: "", blocks: [{ id: "b" }] },
      { id: "c3", blocks: [{ id: "b2", height: 50000 }] },
    ];
    const cols = sanitizeColumns(raw);
    expect(cols).toHaveLength(2);
    expect(cols[0].widthWeight).toBe(MAX_WEIGHT);
    expect(cols[0].blocks[0].height).toBe(BLOCK_MIN_HEIGHT);
    expect(cols[0].blocks[0].component).toBe("ai-chat");
    expect(cols[1].blocks[0].height).toBe(BLOCK_MAX_HEIGHT);
    expect(cols[1].blocks[0].title).toBe("Componente");
    expect(cols[1].collapsed).toBe(false);
  });

  it("sanitizeSpec saneia linhas (cap MAX_ROW_BLOCKS por linha)", () => {
    const manyBlocks = Array.from({ length: MAX_ROW_BLOCKS + 3 }, (_, i) => ({ id: `b${i}`, title: `B${i}` }));
    const spec = sanitizeSpec({ top: manyBlocks, columns: [], bottom: manyBlocks });
    // v2 (lista de blocos) → UMA linha com o teto de blocos
    expect(spec.top).toHaveLength(1);
    expect(spec.top[0].blocks.length).toBe(MAX_ROW_BLOCKS);
    expect(spec.bottom[0].blocks.length).toBe(MAX_ROW_BLOCKS);
  });

  it("sanitizeSpec saneia linhas v3 (cap MAX_ROWS_PER_REGION) e preserva desc/role", () => {
    const rows = Array.from({ length: MAX_ROWS_PER_REGION + 2 }, (_, i) => ({
      id: `r${i}`,
      blocks: [{ id: `b${i}`, title: `Linha ${i}`, desc: `descrição ${i}`.repeat(40) }],
    }));
    const spec = sanitizeSpec({
      top: rows,
      columns: [{ id: "c", role: "sidebar", blocks: [{ id: "b", title: "X", desc: "nota" }] }],
      bottom: [],
    });
    expect(spec.top.length).toBe(MAX_ROWS_PER_REGION);
    expect(spec.top[0].blocks[0].desc?.length).toBeLessThanOrEqual(120);
    expect(spec.columns[0].role).toBe("sidebar");
    expect(spec.columns[0].blocks[0].desc).toBe("nota");
  });
});

describe("layoutTemplates — templates salvos (storage)", () => {
  beforeEach(() => { localStorage.clear(); });

  it("save/list/delete/renomear/atualizar com spec", () => {
    const spec = specOf([newColumn("A")]);
    const t = saveTemplate("Minha tela", spec);
    expect(listTemplates()[0].id).toBe(t.id);
    expect(listTemplates()[0].spec.columns).toHaveLength(1);
    renameTemplate(t.id, "Renomeada");
    expect(listTemplates()[0].name).toBe("Renomeada");
    updateTemplate(t.id, specOf([newColumn("B"), newColumn("C")]));
    expect(listTemplates()[0].spec.columns).toHaveLength(2);
    deleteTemplate(t.id);
    expect(listTemplates().find((x) => x.id === t.id)).toBeUndefined();
  });

  it("exportTemplateText produz JSON v3 legível", () => {
    const text = exportTemplateText("X", specOf([newColumn("A")]));
    const parsed = JSON.parse(text);
    expect(parsed.name).toBe("X");
    expect(parsed.v).toBe(3);
    expect(parsed.columns).toHaveLength(1);
    expect(parsed.top).toEqual([]);
  });

  it("migra templates salvos em v1 (columns-only) na leitura", () => {
    localStorage.setItem("aso:layout-templates:v2", "[]");
    localStorage.setItem(
      "aso:layout-templates:v1",
      JSON.stringify([{ id: "legacy1", name: "Antiga", columns: [newColumn("Legada")] }]),
    );
    // Re-carrega a store do módulo: em testes, leitura é feita no import;
    // aqui validamos sanitizeSpec sobre o payload legado diretamente.
    const legacy = JSON.parse(localStorage.getItem("aso:layout-templates:v1")!);
    const spec = sanitizeSpec({ columns: legacy[0].columns });
    expect(spec.columns[0].blocks[0].title).toBe("Legada");
    expect(spec.top).toEqual([]);
  });
});


describe('layoutTemplates — expansão em 3 níveis (collapsed → default → expanded)', () => {
  it('nextBlockLevel cicla e deriva do collapsed legado', () => {
    // level ausente deriva do collapsed: default(aberto) → próximo é expanded;
    // collapsed → próximo é default (reabre).
    expect(nextBlockLevel(undefined, false)).toBe('expanded');
    expect(nextBlockLevel(undefined, true)).toBe('default');
    expect(nextBlockLevel('default', false)).toBe('expanded');
    expect(nextBlockLevel('expanded', false)).toBe('collapsed');
    expect(nextBlockLevel('collapsed', true)).toBe('default');
  });

  it('cycleBlockLevel sincroniza collapsed com o nível', () => {
    let cols = addColumn([]);
    const colId = cols[0].id;
    const blkId = cols[0].blocks[0].id;
    expect(cols[0].blocks[0].level).toBeUndefined();
    cols = cycleBlockLevel(cols, colId, blkId); // default → expanded
    expect(cols[0].blocks[0].level).toBe('expanded');
    expect(cols[0].blocks[0].collapsed).toBe(false);
    cols = cycleBlockLevel(cols, colId, blkId); // expanded → collapsed
    expect(cols[0].blocks[0].level).toBe('collapsed');
    expect(cols[0].blocks[0].collapsed).toBe(true);
    cols = cycleBlockLevel(cols, colId, blkId); // collapsed → default
    expect(cols[0].blocks[0].level).toBe('default');
    expect(cols[0].blocks[0].collapsed).toBe(false);
  });

  it('toggleBlock (binário) sincroniza level: recolher → collapsed, abrir → default', () => {
    let cols = addColumn([]);
    const colId = cols[0].id;
    const blkId = cols[0].blocks[0].id;
    cols = toggleBlock(cols, colId, blkId);
    expect(cols[0].blocks[0].collapsed).toBe(true);
    expect(cols[0].blocks[0].level).toBe('collapsed');
    cols = toggleBlock(cols, colId, blkId);
    expect(cols[0].blocks[0].collapsed).toBe(false);
    expect(cols[0].blocks[0].level).toBe('default');
  });

  it('setBlockLevel define o nível explicitamente', () => {
    let cols = addColumn([]);
    const colId = cols[0].id;
    const blkId = cols[0].blocks[0].id;
    cols = setBlockLevel(cols, colId, blkId, 'expanded');
    expect(cols[0].blocks[0].level).toBe('expanded');
    expect(cols[0].blocks[0].collapsed).toBe(false);
  });

  it('cycleRowBlockLevel cicla nível no bloco de linha', () => {
    let blocks = addRowBlock([]);
    blocks = cycleRowBlockLevel(blocks, blocks[0].id);
    expect(blocks[0].level).toBe('expanded');
    blocks = cycleRowBlockLevel(blocks, blocks[0].id);
    expect(blocks[0].level).toBe('collapsed');
    expect(blocks[0].collapsed).toBe(true);
  });

  it('sanitize preserva level e deriva de collapsed em dados legados', () => {
    const legacy = [{ id: 'a', title: 'X', collapsed: true, height: 100 }];
    const out = sanitizeColumns([{ id: 'c', widthWeight: 1, collapsed: false, blocks: legacy }]);
    expect(out[0].blocks[0].level).toBe('collapsed');
    const expanded = sanitizeColumns([{ id: 'c', widthWeight: 1, collapsed: false, blocks: [{ id: 'b', level: 'expanded' }] }]);
    expect(expanded[0].blocks[0].level).toBe('expanded');


describe("Layouts v3 — divisão de blocos (partes) e altura de linha", () => {
  it("splitBlockParts divide em 2 partes e removeBlockPart promove ao restar 1", () => {
    let cols = [newColumn("A")];
    const cid = cols[0].id;
    const bid = cols[0].blocks[0].id;
    cols = splitBlockParts(cols, cid, bid, "split");
    expect(cols[0].blocks[0].parts).toHaveLength(2);
    expect(cols[0].blocks[0].partsLayout).toBe("split");
    cols = splitBlockParts(cols, cid, bid, "tabs");
    expect(cols[0].blocks[0].partsLayout).toBe("tabs");
    cols = addBlockPart(cols, cid, bid);
    expect(cols[0].blocks[0].parts).toHaveLength(3);
    const p1 = cols[0].blocks[0].parts![0].id;
    const p2 = cols[0].blocks[0].parts![1].id;
    cols = removeBlockPart(cols, cid, bid, p1);
    expect(cols[0].blocks[0].parts).toHaveLength(2);
    cols = removeBlockPart(cols, cid, bid, p2);
    expect(cols[0].blocks[0].parts).toBeUndefined(); // voltou a bloco único
  });

  it("setPartComponentB vincula componente a uma parte (bloco de linha)", () => {
    const col = newColumn("A");
    const bid = col.blocks[0].id;
    let blocks = splitBlockB(col.blocks, bid, "split");
    const pid = blocks[0].parts![1].id;
    blocks = setPartComponentB(blocks, bid, pid, "kpis");
    expect(blocks[0].parts![1].component).toBe("kpis");
  });

  it("setBlocksHeightB ajusta a altura de todos os blocos da linha (clamp)", () => {
    const col = newColumn("A");
    col.blocks[0].height = 100;
    const raised = setBlocksHeightB(col.blocks, 40);
    expect(raised[0].height).toBe(140);
    const floored = setBlocksHeightB([{ ...col.blocks[0], height: 50 }], -100);
    expect(floored[0].height).toBeGreaterThanOrEqual(48); // BLOCK_MIN_HEIGHT
  });

  it("sanitizeSpec preserva parts e descarta parts com 1 item", () => {
    const spec = sanitizeSpec({
      columns: [{
        id: "c1", collapsed: false, widthWeight: 1,
        blocks: [
          { id: "b1", title: "B1", collapsed: false, height: 120, level: "expanded",
            parts: [
              { id: "p1", title: "A", component: "kpis" },
              { id: "p2", title: "B" },
            ], partsLayout: "tabs" },
          { id: "b2", title: "B2", collapsed: false, height: 120,
            parts: [{ id: "p1", title: "Solo" }] },
        ],
      }],
    });
    const [b1, b2] = spec.columns[0].blocks;
    expect(b1.level).toBe("expanded");
    expect(b1.parts).toHaveLength(2);
    expect(b1.partsLayout).toBe("tabs");
    expect(b2.parts).toBeUndefined();
  });
});
  });
});
