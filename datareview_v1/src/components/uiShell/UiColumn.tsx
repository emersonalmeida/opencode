/**
 * UiColumn — UMA coluna lateral da página UI (estrutural, sem conteúdo).
 *
 * Dois estados:
 *  - RAIL (recolhida, 56px): ícones das 2 abas abrem OVERLAYS por clique
 *    (RailHover openOnClick) com o conteúdo da aba — a sidebar NÃO expande,
 *    efeito "funcional mesmo fechada". Expandir só pelo botão de toggle.
 *  - EXPANDIDA: header (título + o MESMO botão de toggle), strip de 2 abas,
 *    corpo com blocos expansíveis (ExpandableBlock) e ResizeHandle na borda
 *    interna (drag, teclado com setas, duplo-clique = reset da largura).
 *
 * Recolher/expandir acontece APENAS pelo mesmo botão de toggle (regra da
 * página): clicar num ícone do rail nunca abre a sidebar.
 */
import { useState } from "react";
import {
  PanelLeftOpen, PanelLeftClose, PanelRightOpen, PanelRightClose,
  LayoutList, Blocks, Sparkles, Wrench,
} from "lucide-react";
import { ResizeHandle } from "@/components/ResizeHandle";
import { RailHover } from "@/components/shared/RailHover";
import { SidebarTabStrip, type SidebarTabDef } from "@/components/shared/SidebarTabStrip";
import { ExpandableBlock } from "@/components/shared/ExpandableBlock";
import {
  UI_RAIL_WIDTH, type UiColumnId, type UiColumnSpec, type UiColumnState,
} from "@/lib/uiShell/layout";
import {
  resizeColumn, resetColumn, toggleColumnCollapsed,
} from "@/lib/uiShell/store";
import { cn } from "@/lib/utils";

/** Conteúdo estrutural das 2 abas por coluna (sem dados — só a forma). */
function columnTabs(id: UiColumnId): { tabs: SidebarTabDef[]; blocks: string[][] } {
  if (id === "left-outer" || id === "right-outer") {
    return {
      tabs: [
        { id: "painéis", label: "Painéis", icon: <LayoutList className="h-3.5 w-3.5" /> },
        { id: "blocos", label: "Blocos", icon: <Blocks className="h-3.5 w-3.5" /> },
      ],
      blocks: [["Bloco expansível 1", "Bloco expansível 2", "Bloco expansível 3"], ["Bloco expansível 4", "Bloco expansível 5"]],
    };
  }
  return {
    tabs: [
      { id: "contexto", label: "Contexto", icon: <Sparkles className="h-3.5 w-3.5" /> },
      { id: "ferramentas", label: "Ferramentas", icon: <Wrench className="h-3.5 w-3.5" /> },
    ],
    blocks: [["Bloco expansível 1", "Bloco expansível 2"], ["Bloco expansível 3", "Bloco expansível 4"]],
  };
}

/** Corpo de uma aba: a pilha de blocos expansíveis (estrutural). */
function ColumnBlocks({ columnId, tabIndex }: { columnId: UiColumnId; tabIndex: number }) {
  const { blocks } = columnTabs(columnId);
  return (
    <div className="p-2 space-y-2">
      {blocks[tabIndex]?.map((b, i) => (
        <ExpandableBlock
          key={b}
          storageKey={`ui-shell/${columnId}/${tabIndex}/${i}`}
          title={b}
          subtitle="estrutura — sem conteúdo"
        >
          <p className="px-1 py-1 text-[11px] text-muted-foreground">
            Espaço reservado para o conteúdo deste bloco.
          </p>
        </ExpandableBlock>
      ))}
    </div>
  );
}

export interface UiColumnProps {
  spec: UiColumnSpec;
  state: UiColumnState;
  /** Fechada automaticamente por falta de espaço (rail com indicador). */
  autoCollapsed?: boolean;
}

export function UiColumn({ spec, state, autoCollapsed = false }: UiColumnProps) {
  const isLeft = spec.side === "left";
  const { tabs } = columnTabs(spec.id);
  const [activeTab, setActiveTab] = useState(0);
  const collapsed = state.collapsed || autoCollapsed;
  const ToggleOpen = isLeft ? PanelLeftOpen : PanelRightOpen;
  const ToggleClose = isLeft ? PanelLeftClose : PanelRightClose;
  const hoverSide = isLeft ? "right" : "left";

  if (collapsed) {
    return (
      <aside
        aria-label={`Coluna ${spec.label}${autoCollapsed && !state.collapsed ? " (fechada automaticamente por espaço)" : ""}`}
        className={cn(
          "flex flex-col items-center gap-1 py-2 bg-card/40 backdrop-blur-sm flex-shrink-0 h-full",
          isLeft ? "border-r border-border/50" : "border-l border-border/50",
        )}
        style={{ width: UI_RAIL_WIDTH, minWidth: UI_RAIL_WIDTH }}
        data-auto-collapsed={autoCollapsed && !state.collapsed ? "true" : undefined}
      >
        <RailHover
          side={hoverSide}
          label={`Expandir coluna ${spec.label}`}
          description={
            autoCollapsed && !state.collapsed
              ? "Fechada automaticamente por falta de espaço"
              : spec.description
          }
          trigger={
            <button
              onClick={() => toggleColumnCollapsed(spec.id)}
              aria-label={`Expandir coluna ${spec.label}`}
              aria-expanded={false}
              className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <ToggleOpen className="h-4 w-4" />
            </button>
          }
        />
        <div className="w-8 h-px bg-border/40 my-0.5" aria-hidden="true" />
        {/* Ícones das abas: CLIQUE abre overlay funcional SEM expandir a
            sidebar (openOnClick). Expandir/recolher = só o botão acima. */}
        {tabs.map((t, i) => (
          <RailHover
            key={t.id}
            side={hoverSide}
            openOnClick
            label={`${spec.label} · ${t.label}`}
            icon={t.icon}
            width={320}
            content={<ColumnBlocks columnId={spec.id} tabIndex={i} />}
            trigger={
              <button
                aria-label={`Abrir ${t.label} da coluna ${spec.label} em overlay`}
                aria-haspopup="dialog"
                className="p-2 rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                {t.icon}
              </button>
            }
          />
        ))}
        <div className="flex-1" />
      </aside>
    );
  }

  return (
    <div className="relative flex-shrink-0 h-full" style={{ width: state.width }}>
      {!isLeft && (
        <ResizeHandle
          side="left"
          onResize={(d) => resizeColumn(spec.id, d)}
          onReset={() => resetColumn(spec.id)}
          value={state.width}
          min={spec.minWidth}
          max={spec.maxWidth}
          ariaLabel={`Largura da coluna ${spec.label}`}
        />
      )}
      <aside
        aria-label={`Coluna ${spec.label}`}
        className={cn(
          "h-full w-full flex flex-col bg-card/40 backdrop-blur-sm",
          isLeft ? "border-r border-border/50" : "border-l border-border/50",
        )}
      >
        <header className="flex items-center gap-2 px-3 py-2 border-b border-border/50 flex-shrink-0">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-foreground truncate">{spec.label}</p>
            <p className="text-[9px] text-muted-foreground truncate">sidebar · 2 abas</p>
          </div>
          <button
            onClick={() => toggleColumnCollapsed(spec.id)}
            title="Recolher em rail"
            aria-label={`Recolher coluna ${spec.label}`}
            aria-expanded={true}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex-shrink-0"
          >
            <ToggleClose className="h-3.5 w-3.5" />
          </button>
        </header>
        <SidebarTabStrip
          tabs={tabs}
          active={tabs[activeTab]?.id ?? tabs[0].id}
          onChange={(id) => setActiveTab(Math.max(0, tabs.findIndex((t) => t.id === id)))}
          ariaLabel={`Abas da coluna ${spec.label}`}
        />
        <div className="flex-1 min-h-0 overflow-y-auto">
          <ColumnBlocks columnId={spec.id} tabIndex={activeTab} />
        </div>
      </aside>
      {isLeft && (
        <ResizeHandle
          side="right"
          onResize={(d) => resizeColumn(spec.id, d)}
          onReset={() => resetColumn(spec.id)}
          value={state.width}
          min={spec.minWidth}
          max={spec.maxWidth}
          ariaLabel={`Largura da coluna ${spec.label}`}
        />
      )}
    </div>
  );
}
