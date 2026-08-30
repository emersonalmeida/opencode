/**
 * WidgetColumn — coluna do Layout Composer (modo customizado).
 *
 * Renderiza a lista ordenada de widgets de um slot (split vertical), cada um
 * com seu próprio chrome: header com drag handle (arrastar/soltar entre
 * colunas), menu "Mover para" (acessível por clique/teclado), colapso
 * persistido e corpo com scroll próprio. A coluna inteira é drop target
 * (inclusive quando vazia).
 */
import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, GripVertical, MoveRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  move, SLOT_ORDER, SLOT_LABEL, WIDGETS,
  type LayoutSlot, type WidgetId,
} from "@/lib/layoutComposer";

export const DND_MIME = "application/x-app-widget";

function loadCollapsed(key: string): boolean {
  try { return localStorage.getItem(key) === "1"; } catch { return false; }
}

interface WidgetChromeProps {
  id: WidgetId;
  slot: LayoutSlot;
  children: ReactNode;
}

export function WidgetChrome({ id, slot, children }: WidgetChromeProps) {
  const meta = WIDGETS.find((w) => w.id === id)!;
  const storeKey = `aso:widget:${slot}:${id}`;
  const [collapsed, setCollapsed] = useState(() => loadCollapsed(`${storeKey}-open`));
  const [moveOpen, setMoveOpen] = useState(false);

  const toggle = () => {
    setCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem(`${storeKey}-open`, next ? "1" : "0"); } catch { /* quota */ }
      return next;
    });
  };

  return (
    <section
      aria-label={meta.label}
      className={cn(
        "flex flex-col border-b border-border/50 min-h-0",
        collapsed ? "flex-shrink-0" : "flex-1",
      )}
      onDragOver={(e) => { if (e.dataTransfer.types.includes(DND_MIME)) e.preventDefault(); e.stopPropagation(); }}
      onDrop={(e) => {
        const dragged = e.dataTransfer.getData(DND_MIME) as WidgetId;
        if (dragged && dragged !== id) { e.preventDefault(); e.stopPropagation(); move(dragged, slot); }
      }}
    >
      <header className="flex items-center gap-1 px-2 py-1.5 border-b border-border/40 bg-card/70 flex-shrink-0">
        <span
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(DND_MIME, id);
            e.dataTransfer.effectAllowed = "move";
          }}
          title="Arraste para mover entre colunas"
          aria-label={`Arrastar ${meta.label}`}
          className="cursor-grab active:cursor-grabbing p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </span>
        <button
          onClick={toggle}
          aria-expanded={!collapsed}
          className="flex-1 min-w-0 flex items-center gap-1.5 text-left"
          title={collapsed ? "Expandir" : "Recolher"}
        >
          <span className="text-[11px] font-semibold text-foreground truncate">{meta.label}</span>
          {collapsed ? <ChevronRight className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
        </button>
        <div className="relative">
          <button
            onClick={() => setMoveOpen((v) => !v)}
            aria-expanded={moveOpen}
            aria-label={`Mover ${meta.label} para outra coluna`}
            title="Mover para…"
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            <MoveRight className="h-3.5 w-3.5" />
          </button>
          {moveOpen && (
            <div role="menu" className="absolute right-0 top-full mt-1 z-50 w-44 rounded-lg border border-border bg-popover shadow-lg p-1 anim-scale-in">
              {SLOT_ORDER.filter((s) => s !== slot).map((s) => (
                <button
                  key={s}
                  role="menuitem"
                  onClick={() => { move(id, s); setMoveOpen(false); }}
                  className="w-full text-left text-[11px] px-2 py-1.5 rounded hover:bg-secondary"
                >
                  {SLOT_LABEL[s]}
                </button>
              ))}
              <button
                role="menuitem"
                onClick={() => setMoveOpen(false)}
                className="w-full text-left text-[11px] px-2 py-1.5 rounded hover:bg-secondary text-muted-foreground inline-flex items-center gap-1"
              >
                <X className="h-3 w-3" /> Cancelar
              </button>
            </div>
          )}
        </div>
      </header>
      {!collapsed && (
        <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
      )}
    </section>
  );
}

interface WidgetColumnProps {
  slot: LayoutSlot;
  widgetIds: WidgetId[];
  width: number;
  isLeft: boolean;
  renderWidget: (id: WidgetId) => ReactNode;
}

export function WidgetColumn({ slot, widgetIds, width, isLeft, renderWidget }: WidgetColumnProps) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <div
      data-slot={slot}
      className={cn(
        "hidden md:flex h-full flex-col flex-shrink-0 bg-card/40 backdrop-blur-sm overflow-hidden transition-shadow",
        isLeft ? "border-r border-border/50" : "border-l border-border/50",
        dragOver && "ring-2 ring-inset ring-primary/50",
      )}
      style={{ width }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(DND_MIME)) { e.preventDefault(); setDragOver(true); }
      }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false); }}
      onDrop={(e) => {
        const dragged = e.dataTransfer.getData(DND_MIME) as WidgetId;
        setDragOver(false);
        if (dragged) { e.preventDefault(); move(dragged, slot); }
      }}
    >
      {widgetIds.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-3">
          <p className="text-[10px] text-muted-foreground text-center leading-snug">
            Arraste um widget<br />para cá
          </p>
        </div>
      ) : (
        widgetIds.map((id) => (
          <WidgetChrome key={id} id={id} slot={slot}>
            {renderWidget(id)}
          </WidgetChrome>
        ))
      )}
    </div>
  );
}
