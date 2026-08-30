/**
 * LayoutSpecView — renderiza um `LayoutSpec` completo (linhas topo + colunas
 * + linhas rodapé) no modo edição ou preview. Compartilhado entre:
 *
 *  - a página `/layouts` (construtor), e
 *  - as páginas customizadas `/p/:id` (modo "sistema" — tela funcional real).
 *
 * O componente é responsivo por natureza: colunas são flex com peso e vão a
 * wrap/empilham conforme o espaço (minWidth por coluna); linhas empilham
 * blocos com flex-wrap; blocos têm scroll interno no nível N1.
 */
import { useRef } from "react";
import {
  LayoutSpec, LayoutColumn, LayoutRowRegion, LayoutBlock,
  mutateRowBlocks, moveRow, removeRow,
  toggleBlock, cycleBlockLevel, removeBlock, setBlockTitle, setBlockDesc,
  setBlockComponent, setBlockHeight, splitBlockParts, addBlockPart,
  removeBlockPart, setBlockPartTitle, setBlockPartComponent,
} from "@/lib/layoutTemplates";
import { ColumnView, BlockView, RowView } from "./LayoutCanvas";
import { cn } from "@/lib/utils";

export interface LayoutSpecViewProps {
  spec: LayoutSpec;
  mode: "edit" | "preview";
  /** Chamado quando o spec muda (edição estrutural OU ajustes do preview:
   *  recolher coluna/bloco, altura por drag). Ausente = preview read-only. */
  onSpecChange?: (spec: LayoutSpec) => void;
  /** Id do bloco selecionado (só edição). */
  selBlock?: { columnId: string; blockId: string } | null;
  onSelectBlock?: (sel: { columnId: string; blockId: string } | null) => void;
  className?: string;
  /** Preview em tela cheia (modo sistema/fullscreen): ocupa toda a altura
   *  disponível com colunas fluidas e scroll interno por coluna. */
  fillHeight?: boolean;
}

export function LayoutSpecView({
  spec, mode, onSpecChange, selBlock, onSelectBlock, className, fillHeight,
}: LayoutSpecViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const mutateCols = (fn: (cols: LayoutColumn[]) => LayoutColumn[]) => {
    onSpecChange?.({ ...spec, columns: fn(spec.columns) });
  };
  const mutateRows = (region: LayoutRowRegion) => (fn: (rows: LayoutSpec["top"]) => LayoutSpec["top"]) => {
    onSpecChange?.({ ...spec, [region]: fn(spec[region]) });
  };

  const renderRowRegion = (region: LayoutRowRegion) => {
    const rows = spec[region];
    if (rows.length === 0) return null;
    return rows.map((row, i) => (
      <RowView
        key={row.id}
        region={region}
        row={row}
        index={i}
        total={rows.length}
        mode={mode}
        onMutateBlocks={(fn) => mutateRows(region)((rs) => mutateRowBlocks(rs, row.id, fn))}
        onMoveRow={mode === "edit" ? (dir) => mutateRows(region)((rs) => moveRow(rs, row.id, dir)) : undefined}
        onRemoveRow={mode === "edit" ? () => mutateRows(region)((rs) => removeRow(rs, row.id)) : undefined}
      />
    ));
  };

  const renderBlock = (column: LayoutColumn, b: LayoutBlock, isLast: boolean) => (
    <BlockView
      key={b.id}
      block={b}
      mode={mode}
      removable={mode === "edit" && column.blocks.length > 1}
      selected={selBlock?.blockId === b.id}
      renderHandle={(b.level ?? (b.collapsed ? "collapsed" : "default")) === "default"}
      fill={mode === "preview"}
      onSelect={mode === "edit" ? () => onSelectBlock?.({ columnId: column.id, blockId: b.id }) : undefined}
      onToggle={() => mutateCols((cols) => toggleBlock(cols, column.id, b.id))}
      onCycle={() => mutateCols((cols) => cycleBlockLevel(cols, column.id, b.id))}
      onRemove={mode === "edit" ? () => mutateCols((cols) => removeBlock(cols, column.id, b.id)) : undefined}
      onTitle={mode === "edit" ? (t) => mutateCols((cols) => setBlockTitle(cols, column.id, b.id, t)) : undefined}
      onDesc={mode === "edit" ? (d) => mutateCols((cols) => setBlockDesc(cols, column.id, b.id, d)) : undefined}
      onComponent={mode === "edit" ? (c) => mutateCols((cols) => setBlockComponent(cols, column.id, b.id, c)) : undefined}
      onHeightDelta={(d) => mutateCols((cols) => setBlockHeight(cols, column.id, b.id, b.height + d))}
      onSplitLayout={mode === "edit" ? (layout) => mutateCols((cols) => splitBlockParts(cols, column.id, b.id, layout)) : undefined}
      onAddPart={mode === "edit" ? () => mutateCols((cols) => addBlockPart(cols, column.id, b.id)) : undefined}
      onRemovePart={mode === "edit" ? (pid) => mutateCols((cols) => removeBlockPart(cols, column.id, b.id, pid)) : undefined}
      onPartTitle={mode === "edit" ? (pid, t) => mutateCols((cols) => setBlockPartTitle(cols, column.id, b.id, pid, t)) : undefined}
      onPartComponent={mode === "edit" ? (pid, cmp) => mutateCols((cols) => setBlockPartComponent(cols, column.id, b.id, pid, cmp)) : undefined}
    />
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col gap-2",
        fillHeight && "h-full min-h-0",
        className,
      )}
    >
      {renderRowRegion("top")}
      <div
        className={cn(
          "flex flex-wrap items-stretch gap-2",
          fillHeight && "flex-1 min-h-0",
        )}
      >
        {spec.columns.map((column, i) => (
          <ColumnView
            key={column.id}
            columns={spec.columns}
            column={column}
            index={i}
            mode={mode}
            renderRightHandle={i < spec.columns.length - 1}
            containerRef={containerRef}
            onMutate={mutateCols}
            onToggleCollapsed={() => mutateCols((cols) => cols.map((c) => (c.id === column.id ? { ...c, collapsed: !c.collapsed } : c)))}
          >
            {column.blocks.map((b, bi) => renderBlock(column, b, bi === column.blocks.length - 1))}
          </ColumnView>
        ))}
      </div>
      {renderRowRegion("bottom")}
    </div>
  );
}
