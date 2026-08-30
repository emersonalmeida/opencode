import { type ReactNode } from "react";
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";
import { ResizeHandle } from "@/components/ResizeHandle";
import { RailHover } from "@/components/shared/RailHover";
import { useColumnSize } from "@/lib/useColumnSize";
import { cn } from "@/lib/utils";

export type ColumnSide = "left" | "right";

/**
 * Standardized collapsible/resizable column used by EVERY sidebar/column in
 * the app — external (system) and internal (page) alike. Provides a single UX:
 *
 *  - Expanded: header (brand/title + collapse button), scrollable body.
 *  - Collapsed: a narrow rail with an expand button + optional rail icons.
 *  - Resizable via a drag handle on the inner edge (double-click = reset).
 *  - Width clamped to max 25% of the viewport (via `useColumnSize`).
 *
 * Pass `railIcons` to render contextual quick-actions in the collapsed rail
 * (e.g. tab shortcuts). The `headerRight` slot lets each column add its own
 * contextual controls (search, actions) next to the collapse button.
 */
export interface CollapsibleColumnProps {
  /** Which edge the resize handle sits on: right edge for a left column. */
  side: ColumnSide;
  /** localStorage key prefix for width + collapsed state. */
  storageKey: string;
  /** Default expanded width in px. */
  defaultWidth: number;
  /** Min/max px (max defaults to 25% of viewport). */
  minWidth?: number;
  maxWidth?: number;
  /** Default collapsed state. */
  defaultCollapsed?: boolean;
  /** Column title shown in the expanded header. */
  title?: ReactNode;
  /** Small subtitle shown under the title. */
  subtitle?: ReactNode;
  /** Icon shown in the header brand slot. */
  icon?: ReactNode;
  /** Extra controls rendered in the expanded header (right of collapse btn). */
  headerRight?: ReactNode;
  /** Quick-action icons rendered in the collapsed rail. */
  railIcons?: ReactNode;
  /** Column body. */
  children: ReactNode;
  /** Override the header entirely (for custom brand layouts). */
  renderHeader?: (toggle: () => void) => ReactNode;
  /** Preenche 100% do container pai (modo widget do layout composer):
   *  sem largura própria, sem resize handles e sem botão de recolher. */
  fill?: boolean;
  /** Extra className on the outer wrapper. */
  className?: string;
  /** Aria label for the expand/collapse buttons. */
  expandLabel?: string;
  collapseLabel?: string;
}

export function CollapsibleColumn({
  side,
  storageKey,
  defaultWidth,
  minWidth,
  maxWidth,
  defaultCollapsed,
  fill = false,
  title,
  subtitle,
  icon,
  headerRight,
  railIcons,
  children,
  renderHeader,
  className,
  expandLabel,
  collapseLabel,
}: CollapsibleColumnProps) {
  const col = useColumnSize({ storageKey, defaultWidth, minWidth, maxWidth, defaultCollapsed });
  const isLeft = side === "left";
  const rail = 56;
  const ExpandIcon = isLeft ? PanelLeftOpen : PanelRightOpen;
  const CollapseIcon = isLeft ? PanelLeftClose : PanelRightClose;

  if (col.collapsed && !fill) {
    const tooltipSide = isLeft ? "right" : "left";
    return (
      <aside
        className={cn(
          "hidden md:flex h-full flex-col items-center gap-2 py-3 bg-card/40 backdrop-blur-sm flex-shrink-0",
          isLeft ? "border-r border-border/50" : "border-l border-border/50",
          className,
        )}
        style={{ width: rail, minWidth: rail }}
      >
        <RailHover
          side={tooltipSide}
          label={expandLabel ?? "Expandir"}
          description={typeof title === "string" ? title : undefined}
          trigger={
            <button
              onClick={col.toggleCollapsed}
              aria-label={expandLabel ?? "Expandir"}
              className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <ExpandIcon className="h-4 w-4" />
            </button>
          }
        />
        {/* Clicar em QUALQUER ícone do rail expande a coluna (o clique também
            chega ao próprio ícone — ex.: seleciona a aba correspondente).
            Wrapper sem role: os elementos internos são os interativos; o
            botão "Expandir" acima cobre teclado/leitores de tela. */}
        {railIcons && (
          <div
            onClick={() => col.setCollapsed(false)}
            className="flex flex-col items-center gap-2 cursor-pointer"
          >
            {railIcons}
          </div>
        )}
        <div className="flex-1" />
      </aside>
    );
  }

  return (
    <div
      className={cn("relative flex-shrink-0 h-full", fill && "w-full min-w-0", className)}
      style={fill ? undefined : { width: col.width }}
    >
      {!isLeft && !fill && (
        <ResizeHandle
          side="left"
          onResize={col.resize}
          onReset={col.reset}
        />
      )}
      <aside
        className={cn(
          "hidden md:flex h-full w-full flex-col bg-card/40 backdrop-blur-sm",
          isLeft ? "border-r border-border/50" : "border-l border-border/50",
        )}
      >
        {renderHeader ? (
          renderHeader(col.toggleCollapsed)
        ) : (
          <header className="flex items-center gap-2 p-3 border-b border-border/50 flex-shrink-0">
            {icon && (
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0 text-primary-foreground">
                {icon}
              </div>
            )}
            <div className="min-w-0 flex-1">
              {title && <p className="text-xs font-semibold text-foreground truncate">{title}</p>}
              {subtitle && <p className="text-[10px] text-muted-foreground truncate">{subtitle}</p>}
            </div>
            {headerRight}
            {!fill && (
              <button
                onClick={col.toggleCollapsed}
                title={collapseLabel ?? "Recolher"}
                aria-label={collapseLabel ?? "Recolher"}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex-shrink-0"
              >
                <CollapseIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </header>
        )}
        <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
      </aside>
      {isLeft && !fill && (
        <ResizeHandle
          side="right"
          onResize={col.resize}
          onReset={col.reset}
        />
      )}
    </div>
  );
}

/** The scrollable body to place inside a CollapsibleColumn. */
export function ColumnBody({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("h-full overflow-y-auto", className)}>{children}</div>
  );
}
