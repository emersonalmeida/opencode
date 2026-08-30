/**
 * LayoutCanvas — blocos de montagem do construtor `/layouts`:
 *
 *  - `ResizeHandle` — separador a11y (drag pointer + teclado setas/Shift).
 *  - `BlockView` — componente expansível/recolhível/redimensionável com
 *    NÍVEIS DE EXPANSÃO PADRONIZADOS:
 *      N1 "default"  → altura fixa (ajustável por handle), conteúdo com
 *                      scroll interno quando excede;
 *      N2 "expanded" → cresce com o conteúdo (sem scroll/corte);
 *      N3 "collapsed"→ só título + descrição.
 *    A altura é ajustável no modo edição E no preview (persiste no spec).
 *  - `ColumnView` — coluna com peso flex ajustável; recolhível (rail) no
 *    preview; papel "sidebar" (estreita) alternável; no modo edição tem
 *    dividir/mover/remover.
 *  - `RowView` — linha horizontal (topo/rodapé) como ENTIDADE: adicionar/
 *    remover/reordenar linhas, blocos expansíveis lado a lado.
 *
 * A11y: regiões nomeadas, aria-expanded/aria-pressed, teclado em todos os
 * handles e controles, tooltips em português.
 */
import { useCallback, useRef, useState } from "react";
import {
  ChevronDown, ChevronLeft, ChevronRight, ChevronsDownUp, ChevronsUpDown,
  Columns2, LayoutGrid, Minus, PanelLeft, PanelLeftClose, PanelLeftOpen,
  Plus, ArrowUp, ArrowDown, SquareStack, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LayoutColumn, LayoutBlock, LayoutPart, LayoutRow, LayoutRowRegion, columnPercent,
  resizeColumns, splitColumn, removeColumn, moveColumn, toggleColumnRole,
  addRowBlock, removeRowBlock, toggleRowBlock, cycleRowBlockLevel,
  setRowBlockTitle, setRowBlockDesc, setRowBlockComponent,
  splitBlockB, addBlockPartB, removeBlockPartB,
  setPartTitleB, setPartComponentB, setBlocksHeightB,
  MIN_WEIGHT, MAX_WEIGHT, MAX_ROW_BLOCKS,
} from "@/lib/layoutTemplates";
import { layoutComponentMeta, publicComponentFile } from "@/lib/layoutComponents";
import { LayoutComponentBody } from "./LayoutComponents";
import { ComponentGallery } from "./ComponentGallery";

// ---------------------------------------------------------------------------
// Handle de redimensionamento (a11y): drag pointer + teclado
// ---------------------------------------------------------------------------

export interface ResizeHandleProps {
  orientation: "vertical" | "horizontal";
  label: string;
  valueText: string;
  /** Passo do teclado. Shift multiplica por 4. */
  step: number;
  onDelta: (delta: number) => void;
  onPointerDelta: (deltaPx: number) => void;
}

export function ResizeHandle({
  orientation, label, valueText, step, onDelta, onPointerDelta,
}: ResizeHandleProps) {
  const dragging = useRef<number | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = orientation === "vertical" ? e.clientX : e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragging.current == null) return;
    const pos = orientation === "vertical" ? e.clientX : e.clientY;
    const delta = pos - dragging.current;
    dragging.current = pos;
    onPointerDelta(delta);
  };
  const end = () => { dragging.current = null; };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const s = e.shiftKey ? step * 4 : step;
    let delta = 0;
    if (orientation === "vertical") {
      if (e.key === "ArrowLeft") delta = -s;
      else if (e.key === "ArrowRight") delta = s;
    } else {
      if (e.key === "ArrowUp") delta = -s;
      else if (e.key === "ArrowDown") delta = s;
    }
    if (delta !== 0) {
      e.preventDefault();
      onDelta(delta);
    }
  };

  return (
    <div
      role="separator"
      aria-label={label}
      aria-valuetext={valueText}
      aria-orientation={orientation}
      tabIndex={0}
      title={`${label} — arraste ou use as setas (Shift = passo maior)`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onKeyDown={onKeyDown}
      className={cn(
        "shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
        orientation === "vertical" ? "w-2 cursor-col-resize" : "h-2 cursor-row-resize",
        "bg-border/60 hover:bg-primary/70 active:bg-primary transition-colors z-10",
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Helpers de meta (registry ou prefixo cat:<arquivo> do catálogo completo)
// ---------------------------------------------------------------------------

function blockComponentMeta(value?: string) {
  const catFile = publicComponentFile(value);
  if (catFile) {
    return { label: catFile.split("/").pop() ?? value, desc: "Componente do catálogo completo", icon: LayoutGrid, id: value ?? "", group: "dados" as const, originPage: "—" };
  }
  return layoutComponentMeta(value);
}

// ---------------------------------------------------------------------------
// Botão que abre a galeria de componentes (modo edição)
// ---------------------------------------------------------------------------

export function ComponentPickerButton({
  value, onChange, blockTitle,
}: { value: string | undefined; onChange: (v: string | undefined) => void; blockTitle: string }) {
  const [open, setOpen] = useState(false);
  const meta = blockComponentMeta(value);
  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        aria-label={`Componente do bloco ${blockTitle}`}
        title="Vincular um componente real do sistema a este bloco (galeria)"
        className={cn(
          "inline-flex max-w-[150px] items-center gap-1 truncate rounded border px-1.5 py-0.5 text-[10px] transition-colors focus-visible:ring-2 focus-visible:ring-primary/60",
          meta
            ? "border-primary/40 bg-primary/10 text-primary"
            : "border-border/60 bg-background text-muted-foreground hover:text-foreground",
        )}
      >
        <LayoutGrid className="h-3 w-3 shrink-0" aria-hidden />
        <span className="truncate">{meta ? meta.label : "Vazio"}</span>
      </button>
      <ComponentGallery open={open} onOpenChange={setOpen} onPick={onChange} blockTitle={blockTitle} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Bloco expansível (contêiner base / componente real)
// ---------------------------------------------------------------------------

export interface BlockViewProps {
  block: LayoutBlock;
  /** edit = controles de estrutura; preview = conteúdo real funcional. */
  mode: "edit" | "preview";
  removable: boolean;
  selected: boolean;
  /** Handle de altura abaixo do bloco (nível N1, edição e preview). */
  renderHandle: boolean;
  /** Preview: bloco cresce para preencher a coluna (flex-1). */
  fill?: boolean;
  onSelect?: () => void;
  onToggle: () => void;
  /** Cicla 3 níveis: N1 default → N2 expanded → N3 collapsed. */
  onCycle?: () => void;
  onRemove?: () => void;
  onTitle?: (t: string) => void;
  onDesc?: (d: string) => void;
  onComponent?: (c: string | undefined) => void;
  onHeightDelta?: (deltaPx: number) => void;
  /** Divisão interna do bloco: lado a lado ("split") ou em abas ("tabs"). */
  onSplitLayout?: (layout: "split" | "tabs") => void;
  onAddPart?: () => void;
  onRemovePart?: (partId: string) => void;
  onPartTitle?: (partId: string, title: string) => void;
  onPartComponent?: (partId: string, component: string | undefined) => void;
}

/** Conteúdo de UM sub-bloco (parte de divisão vertical ou aba). */
function PartBody({
  block, part, mode, onPartTitle, onPartComponent, onRemovePart, removable,
}: {
  block: LayoutBlock;
  part: LayoutPart;
  mode: "edit" | "preview";
  removable: boolean;
  onPartTitle?: (partId: string, title: string) => void;
  onPartComponent?: (partId: string, component: string | undefined) => void;
  onRemovePart?: (partId: string) => void;
}) {
  return (
    <div className="min-w-0 flex-1 flex flex-col rounded-md border border-border/40 bg-background/60 overflow-hidden" style={{ minWidth: 140 }}>
      <div className="flex items-center gap-1 px-1.5 py-1 border-b border-border/40 bg-muted/20">
        {mode === "edit" && onPartTitle ? (
          <input
            value={part.title}
            onChange={(e) => onPartTitle(part.id, e.target.value)}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Nome da parte em ${block.title}`}
            className="min-w-0 flex-1 bg-transparent text-[10px] font-medium text-foreground outline-none border-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded"
          />
        ) : (
          <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-muted-foreground">{part.title}</span>
        )}
        {mode === "edit" && onPartComponent && (
          <ComponentPickerButton value={part.component} onChange={(v) => onPartComponent(part.id, v)} blockTitle={part.title} />
        )}
        {mode === "edit" && removable && onRemovePart && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemovePart(part.id); }}
            aria-label={`Remover parte ${part.title}`}
            title="Remover parte"
            className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-1">
        <LayoutComponentBody component={part.component} />
      </div>
    </div>
  );
}

/** Sub-blocos em abas (tab strip + conteúdo da aba ativa). */
function PartsTabs(props: {
  block: LayoutBlock;
  mode: "edit" | "preview";
  onPartTitle?: (partId: string, title: string) => void;
  onPartComponent?: (partId: string, component: string | undefined) => void;
  onRemovePart?: (partId: string) => void;
}) {
  const parts = props.block.parts ?? [];
  const [active, setActive] = useState(parts[0]?.id ?? "");
  const current = parts.find((p) => p.id === active) ?? parts[0];
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div role="tablist" aria-label={`Partes de ${props.block.title}`} className="flex shrink-0 flex-wrap items-stretch border-b border-border/40">
        {parts.map((p) => (
          <button
            key={p.id}
            role="tab"
            aria-selected={current?.id === p.id}
            onClick={(e) => { e.stopPropagation(); setActive(p.id); }}
            className={cn(
              "border-b-2 px-2 py-1 text-[10px] transition-colors focus-visible:ring-2 focus-visible:ring-primary/60",
              current?.id === p.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {p.title}
          </button>
        ))}
      </div>
      {current && (
        <div role="tabpanel" className="min-h-0 flex-1 overflow-hidden flex flex-col">
          <PartBody {...props} part={current} removable={parts.length > 1} />
        </div>
      )}
    </div>
  );
}

/** Ícone + rótulo do nível de expansão atual (N1/N2/N3 padronizados). */
function levelMeta(block: LayoutBlock): { label: string; hint: string; Icon: typeof ChevronsUpDown } {
  const level = block.level ?? (block.collapsed ? "collapsed" : "default");
  if (level === "collapsed") return { label: "N3 · Recolhido", hint: "só título e descrição", Icon: ChevronDown };
  if (level === "expanded") return { label: "N2 · Expandido", hint: "cresce com o conteúdo", Icon: ChevronsUpDown };
  return { label: "N1 · Padrão", hint: "altura fixa com scroll", Icon: ChevronsDownUp };
}

export function BlockView({
  block, mode, removable, selected, renderHandle, fill,
  onSelect, onToggle, onCycle, onRemove, onTitle, onDesc, onComponent, onHeightDelta,
  onSplitLayout, onAddPart, onRemovePart, onPartTitle, onPartComponent,
}: BlockViewProps) {
  const meta = blockComponentMeta(block.component);
  const MetaIcon = meta?.icon;
  const { label: levelLabel, hint: levelHint, Icon: LevelIcon } = levelMeta(block);
  const hasParts = (block.parts?.length ?? 0) > 1;
  const level = block.level ?? (block.collapsed ? "collapsed" : "default");
  const collapsed = level === "collapsed";
  const expanded = level === "expanded";
  return (
    <div className={cn("min-w-0 flex flex-col", fill && "flex-1 min-h-0")}>
      <section
        aria-label={block.title}
        onClick={onSelect}
        className={cn(
          "rounded-lg border overflow-hidden transition-shadow bg-card/60 flex flex-col",
          mode === "edit" && "cursor-pointer",
          mode === "edit" && (selected
            ? "border-primary/60 ring-2 ring-primary/30 shadow-sm"
            : "border-border/70 hover:border-primary/40"),
          mode === "preview" && "border-border/70",
          fill && !collapsed && "flex-1 min-h-0",
        )}
      >
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-border/50 bg-muted/20 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            aria-expanded={!collapsed}
            aria-label={`${!collapsed ? "Recolher" : "Expandir"} ${block.title}`}
            title={!collapsed ? "Recolher (N3: só título e descrição)" : "Expandir"}
            className="rounded p-0.5 hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            {collapsed
              ? <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
              : <ChevronsDownUp className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
          {onCycle && (
            <button
              onClick={(e) => { e.stopPropagation(); onCycle(); }}
              aria-label={`Nível de ${block.title}: ${levelLabel} (clique para o próximo)`}
              title={`${levelLabel} — ${levelHint}. Clique p/ ciclar (N1 → N2 → N3)`}
              className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] text-muted-foreground hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <LevelIcon className="h-3 w-3" />
              <span className="hidden xl:inline">{levelLabel}</span>
            </button>
          )}
          {MetaIcon && <MetaIcon className="h-3 w-3 text-primary/70 shrink-0" aria-hidden />}
          {mode === "edit" && onTitle ? (
            <input
              value={block.title}
              onChange={(e) => onTitle(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              aria-label="Nome do bloco"
              className="min-w-0 flex-1 bg-transparent text-xs font-medium text-foreground outline-none border-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded"
            />
          ) : (
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{block.title}</span>
          )}
          {mode === "edit" && !hasParts && onComponent && (
            <ComponentPickerButton value={block.component} onChange={onComponent} blockTitle={block.title} />
          )}
          {mode === "edit" && onSplitLayout && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); onSplitLayout(hasParts && block.partsLayout === "split" ? "tabs" : "split"); }}
                aria-label={hasParts ? `Alternar divisão de ${block.title} (split/abas)` : `Dividir ${block.title} na vertical`}
                title={hasParts ? "Alternar entre lado a lado e abas" : "Dividir na vertical (2 partes lado a lado)"}
                aria-pressed={hasParts}
                className={cn(
                  "rounded p-0.5 focus-visible:ring-2 focus-visible:ring-primary/60",
                  hasParts ? "text-primary bg-primary/10" : "text-muted-foreground hover:bg-muted/60",
                )}
              >
                {hasParts && block.partsLayout === "tabs" ? <SquareStack className="h-3.5 w-3.5" /> : <Columns2 className="h-3.5 w-3.5" />}
              </button>
              {hasParts && onAddPart && (
                <button
                  onClick={(e) => { e.stopPropagation(); onAddPart(); }}
                  aria-label={`Adicionar ${block.partsLayout === "tabs" ? "aba" : "parte"} em ${block.title}`}
                  title={block.partsLayout === "tabs" ? "Adicionar aba" : "Adicionar parte lado a lado"}
                  className="rounded p-0.5 text-muted-foreground hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-primary/60"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              )}
            </>
          )}
          {mode === "edit" && removable && onRemove && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              aria-label={`Remover bloco ${block.title}`}
              title="Remover bloco"
              className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* N3 (recolhido): só título (header acima) + descrição. */}
        {collapsed && (mode === "edit" && onDesc ? (
          <input
            value={block.desc ?? ""}
            onChange={(e) => onDesc(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Descrição de ${block.title}`}
            placeholder="Descrição curta (visível no nível N3)…"
            className="border-none bg-transparent px-2.5 py-1.5 text-[11px] text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          />
        ) : block.desc ? (
          <p className="px-2.5 py-1.5 text-[11px] text-muted-foreground">{block.desc}</p>
        ) : null)}

        {!collapsed && (
          <div
            style={!expanded ? { height: block.height } : undefined}
            className={cn(
              "relative p-1.5 flex flex-col min-h-0",
              expanded
                ? "overflow-visible" // N2: cresce com o conteúdo
                : "overflow-y-auto flex-1", // N1: altura fixa + scroll interno
            )}
          >
            {mode === "edit" && onDesc && (
              <input
                value={block.desc ?? ""}
                onChange={(e) => onDesc(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Descrição de ${block.title}`}
                placeholder="Descrição curta (visível no nível N3 recolhido)…"
                className="mb-1 shrink-0 rounded border border-border/40 bg-transparent px-1.5 py-1 text-[10px] text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              />
            )}
            <div className="min-h-0 flex-1">
              {hasParts ? (
                block.partsLayout === "tabs" ? (
                  <PartsTabs
                    block={block}
                    mode={mode}
                    onPartTitle={onPartTitle}
                    onPartComponent={onPartComponent}
                    onRemovePart={onRemovePart}
                  />
                ) : (
                  <div className="flex flex-wrap items-stretch gap-1.5">
                    {(block.parts ?? []).map((part) => (
                      <PartBody
                        key={part.id}
                        block={block}
                        part={part}
                        mode={mode}
                        removable={(block.parts?.length ?? 0) > 1}
                        onPartTitle={onPartTitle}
                        onPartComponent={onPartComponent}
                        onRemovePart={onRemovePart}
                      />
                    ))}
                  </div>
                )
              ) : (
                <LayoutComponentBody component={block.component} />
              )}
            </div>
          </div>
        )}
      </section>
      {/* Handle de altura: N1 (altura fixa) em edição E preview. */}
      {renderHandle && !collapsed && !expanded && onHeightDelta && (
        <ResizeHandle
          orientation="horizontal"
          label={`Altura de ${block.title}`}
          valueText={`${block.height} px`}
          step={8}
          onDelta={(d) => onHeightDelta(d)}
          onPointerDelta={(d) => onHeightDelta(d)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Linha horizontal (topo/rodapé) — ENTIDADE: mover/remover + blocos
// ---------------------------------------------------------------------------

export interface RowViewProps {
  region: LayoutRowRegion;
  row: LayoutRow;
  /** Índice da linha na região (para label e limites de mover). */
  index: number;
  /** Total de linhas na região. */
  total: number;
  mode: "edit" | "preview";
  /** Muta os blocos DESTA linha. */
  onMutateBlocks: (fn: (blocks: LayoutBlock[]) => LayoutBlock[]) => void;
  /** Move a linha ±1 dentro da região (só edição). */
  onMoveRow?: (dir: -1 | 1) => void;
  /** Remove a linha inteira (só edição). */
  onRemoveRow?: () => void;
}

export function RowView({ region, row, index, total, mode, onMutateBlocks, onMoveRow, onRemoveRow }: RowViewProps) {
  const base = region === "top" ? "Linha do topo" : "Linha do rodapé";
  const label = total > 1 ? `${base} ${index + 1}` : base;
  const blocks = row.blocks;
  if (blocks.length === 0) return null;
  return (
    <section aria-label={label} className="min-w-0">
      {mode === "edit" && (
        <div className="flex items-center gap-1 px-1 pb-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {label} · {blocks.length} bloco{blocks.length > 1 ? "s" : ""}
          </p>
          <span className="flex-1" />
          <button
            onClick={() => onMutateBlocks((bs) => addRowBlock(bs))}
            disabled={blocks.length >= MAX_ROW_BLOCKS}
            aria-label={`Adicionar bloco na ${label}`}
            title="Adicionar bloco lado a lado nesta linha"
            className="rounded p-1 hover:bg-muted/60 text-muted-foreground disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <Plus className="h-3 w-3" />
          </button>
          {onMoveRow && (
            <>
              <button
                onClick={() => onMoveRow(-1)}
                disabled={index === 0}
                aria-label={`Mover ${label} para cima`}
                title="Mover linha para cima"
                className="rounded p-1 hover:bg-muted/60 text-muted-foreground disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <ArrowUp className="h-3 w-3" />
              </button>
              <button
                onClick={() => onMoveRow(1)}
                disabled={index >= total - 1}
                aria-label={`Mover ${label} para baixo`}
                title="Mover linha para baixo"
                className="rounded p-1 hover:bg-muted/60 text-muted-foreground disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <ArrowDown className="h-3 w-3" />
              </button>
            </>
          )}
          {onRemoveRow && (
            <button
              onClick={onRemoveRow}
              aria-label={`Remover ${label}`}
              title="Remover a linha inteira"
              className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <Minus className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-stretch gap-2">
        {blocks.map((b) => (
          <div key={b.id} className="min-w-0 flex-1" style={{ minWidth: 200 }}>
            <BlockView
              block={b}
              mode={mode}
              removable={mode === "edit"}
              selected={false}
              renderHandle={(b.level ?? (b.collapsed ? "collapsed" : "default")) === "default"}
              onToggle={() => onMutateBlocks((bs) => toggleRowBlock(bs, b.id))}
              onCycle={() => onMutateBlocks((bs) => cycleRowBlockLevel(bs, b.id))}
              onRemove={mode === "edit" ? () => onMutateBlocks((bs) => removeRowBlock(bs, b.id)) : undefined}
              onTitle={mode === "edit" ? (t) => onMutateBlocks((bs) => setRowBlockTitle(bs, b.id, t)) : undefined}
              onDesc={mode === "edit" ? (d) => onMutateBlocks((bs) => setRowBlockDesc(bs, b.id, d)) : undefined}
              onComponent={mode === "edit" ? (c) => onMutateBlocks((bs) => setRowBlockComponent(bs, b.id, c)) : undefined}
              onHeightDelta={(d) => onMutateBlocks((bs) => setBlocksHeightB(bs, d))}
              onSplitLayout={mode === "edit" ? (layout) => onMutateBlocks((bs) => splitBlockB(bs, b.id, layout)) : undefined}
              onAddPart={mode === "edit" ? () => onMutateBlocks((bs) => addBlockPartB(bs, b.id)) : undefined}
              onRemovePart={mode === "edit" ? (pid) => onMutateBlocks((bs) => removeBlockPartB(bs, b.id, pid)) : undefined}
              onPartTitle={mode === "edit" ? (pid, t) => onMutateBlocks((bs) => setPartTitleB(bs, b.id, pid, t)) : undefined}
              onPartComponent={mode === "edit" ? (pid, cmp) => onMutateBlocks((bs) => setPartComponentB(bs, b.id, pid, cmp)) : undefined}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Coluna (largura ajustável, recolhível, papel sidebar, blocos empilhados)
// ---------------------------------------------------------------------------

export interface ColumnViewProps {
  columns: LayoutColumn[];
  column: LayoutColumn;
  index: number;
  mode: "edit" | "preview";
  renderRightHandle: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onMutate: (fn: (cols: LayoutColumn[]) => LayoutColumn[]) => void;
  onToggleCollapsed: () => void;
  children: React.ReactNode;
}

export function ColumnView({
  columns, column, index, mode, renderRightHandle, containerRef, onMutate, onToggleCollapsed, children,
}: ColumnViewProps) {
  const canMoveLeft = index > 0;
  const canMoveRight = index < columns.length - 1;
  const canRemove = columns.length > 1;
  const isSidebar = column.role === "sidebar";
  const colLabel = isSidebar ? `Coluna ${index + 1} (sidebar)` : `Coluna ${index + 1}`;

  // Drag na borda direita: ajusta o peso desta coluna e da próxima,
  // mantendo o total (troca de proporção entre vizinhos).
  const adjustWeights = useCallback(
    (deltaPx: number) => {
      const container = containerRef.current;
      const next = columns[index + 1];
      if (!container || !next) return;
      const totalWeight = columns.reduce((s, c) => s + c.widthWeight, 0);
      const pxPerWeight = container.getBoundingClientRect().width / totalWeight;
      if (pxPerWeight <= 0) return;
      const deltaW = deltaPx / pxPerWeight;
      const w1 = Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, column.widthWeight + deltaW));
      const w2 = Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, next.widthWeight - deltaW));
      onMutate((cols) => resizeColumns(cols, [
        { id: column.id, weight: w1 },
        { id: next.id, weight: w2 },
      ]));
    },
    [columns, column, index, containerRef, onMutate],
  );

  const adjustWeightsKeyboard = useCallback(
    (deltaW: number) => {
      const next = columns[index + 1];
      if (!next) return;
      const w1 = Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, column.widthWeight + deltaW));
      const w2 = Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, next.widthWeight - deltaW));
      onMutate((cols) => resizeColumns(cols, [
        { id: column.id, weight: w1 },
        { id: next.id, weight: w2 },
      ]));
    },
    [columns, column, index, onMutate],
  );

  // Rail colapsada (preview): botão fino para expandir de volta.
  if (mode === "preview" && column.collapsed) {
    return (
      <section
        aria-label={`Coluna ${index + 1} (recolhida)`}
        className="flex w-11 shrink-0 flex-col items-center gap-2 rounded-xl border border-border/60 bg-muted/10 py-2"
      >
        <button
          onClick={onToggleCollapsed}
          aria-label={`Expandir Coluna ${index + 1}`}
          title={`Expandir Coluna ${index + 1}`}
          className="rounded p-1 hover:bg-muted/60 text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          <PanelLeftOpen className="h-3.5 w-3.5" />
        </button>
        <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground [writing-mode:vertical-rl]">
          Coluna {index + 1}
        </span>
      </section>
    );
  }

  return (
    <>
      <section
        aria-label={`Coluna ${index + 1}`}
        className={cn(
          "min-w-0 rounded-xl border overflow-hidden flex flex-col",
          isSidebar
            ? "border-border/70 bg-muted/25"
            : "border-border/60 bg-muted/10",
        )}
        style={{
          flexGrow: column.widthWeight,
          flexBasis: 0,
          // Papel sidebar: estreita como uma sidebar de verdade no preview.
          ...(mode === "preview" && isSidebar ? { maxWidth: 300, minWidth: 200 } : { minWidth: 0 }),
        }}
      >
        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border/50 bg-card/40 shrink-0">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {colLabel} · {columnPercent(column, columns)}%
          </span>
          <span className="flex-1" />
          {mode === "edit" && (
            <button
              onClick={() => onMutate((cols) => toggleColumnRole(cols, column.id))}
              aria-pressed={isSidebar}
              aria-label={`Papel da Coluna ${index + 1}: ${isSidebar ? "sidebar" : "conteúdo"} (clique para alternar)`}
              title={isSidebar ? "Papel: sidebar (estreita no preview) — clique para virar conteúdo" : "Papel: conteúdo (fluida) — clique para virar sidebar"}
              className={cn(
                "rounded p-1 focus-visible:ring-2 focus-visible:ring-primary/60",
                isSidebar ? "text-primary bg-primary/10" : "text-muted-foreground hover:bg-muted/60",
              )}
            >
              <PanelLeft className="h-3 w-3" />
            </button>
          )}
          <button
            onClick={onToggleCollapsed}
            aria-pressed={column.collapsed}
            aria-label={column.collapsed ? `Expandir Coluna ${index + 1}` : `Recolher Coluna ${index + 1}`}
            title={column.collapsed ? "Expandir coluna" : "Recolher coluna"}
            className="rounded p-1 hover:bg-muted/60 text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <PanelLeftClose className="h-3 w-3" />
          </button>
          {mode === "edit" && (
            <>
              <button
                onClick={() => onMutate((cols) => splitColumn(cols, column.id))}
                aria-label={`Dividir Coluna ${index + 1} horizontalmente`}
                title="Dividir horizontalmente (adiciona componente expansível)"
                className="rounded p-1 hover:bg-muted/60 text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <Plus className="h-3 w-3" />
              </button>
              <button
                onClick={() => onMutate((cols) => moveColumn(cols, column.id, -1))}
                disabled={!canMoveLeft}
                aria-label={`Mover Coluna ${index + 1} para a esquerda`}
                title="Mover para a esquerda"
                className="rounded p-1 hover:bg-muted/60 text-muted-foreground disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <ChevronLeft className="h-3 w-3" />
              </button>
              <button
                onClick={() => onMutate((cols) => moveColumn(cols, column.id, 1))}
                disabled={!canMoveRight}
                aria-label={`Mover Coluna ${index + 1} para a direita`}
                title="Mover para a direita"
                className="rounded p-1 hover:bg-muted/60 text-muted-foreground disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <ChevronRight className="h-3 w-3" />
              </button>
              <button
                onClick={() => onMutate((cols) => removeColumn(cols, column.id))}
                disabled={!canRemove}
                aria-label={`Remover Coluna ${index + 1}`}
                title="Remover coluna"
                className="rounded p-1 hover:bg-destructive/10 hover:text-destructive text-muted-foreground disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <Minus className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
        <div className={cn("p-2 flex flex-col gap-1.5", mode === "preview" && "flex-1 min-h-0 overflow-hidden")}>
          {children}
        </div>
      </section>
      {renderRightHandle && (
        <ResizeHandle
          orientation="vertical"
          label={`Largura: Coluna ${index + 1} / Coluna ${index + 2}`}
          valueText={`${columnPercent(column, columns)}%`}
          step={0.25}
          onDelta={(d) => adjustWeightsKeyboard(d)}
          onPointerDelta={(d) => adjustWeights(d)}
        />
      )}
    </>
  );
}
