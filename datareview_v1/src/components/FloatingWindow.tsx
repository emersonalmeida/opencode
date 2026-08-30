import { useEffect, useRef, type ReactNode } from "react";
import {
  X, Minus, Square, Copy, RotateCcw, Pin,
} from "lucide-react";
import {
  ContextMenu, ContextMenuTrigger, ContextMenuContent,
  ContextMenuItem, ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { useWM, type WindowState } from "@/lib/windowManager";
import { cn } from "@/lib/utils";

/**
 * FloatingWindow — janela flutuante estilo desktop OS.
 *
 * Renderizada em camada (absolute) dentro de um <Workspace/> (relativo).
 * Suporta:
 *  - Drag pelo header (move x/y com snap-to-grid),
 *  - Resize por 8 handles (cantos + bordas),
 *  - Botões header: minimizar / maximizar / fechar,
 *  - Context menu (botão direito no header): focar, maximizar, restaurar,
 *    duplicar (clone), redefinir, fechar.
 *  - z-index no foco (click traz para frente).
 *  - Minimizada = só header.
 *  - Maximizada = preenche o workspace.
 *
 * O conteúdo vem da prop `children` (o renderizador decide o que mostrar
 * conforme `window.kind`).
 */
interface Props {
  window: WindowState;
  children: ReactNode;
}

interface DragState {
  startX: number;
  startY: number;
  mode: "move" | "resize";
  edge: string;
}

export function FloatingWindow({ window: win, children }: Props) {
  const { focus, dragDelta, resizeDelta, toggleMin, toggleMax, close, restore, open } = useWM();
  const drag = useRef<DragState | null>(null);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      const st = drag.current;
      if (!st) return;
      const dx = e.clientX - st.startX;
      const dy = e.clientY - st.startY;
      st.startX = e.clientX;
      st.startY = e.clientY;
      if (st.mode === "move") dragDelta(win.id, dx, dy);
      else resizeDelta(win.id, dx, dy, st.edge);
    };
    const up = () => { drag.current = null; document.body.style.cursor = ""; document.body.style.userSelect = ""; };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [win.id, dragDelta, resizeDelta]);

  const startMove = (e: React.MouseEvent) => {
    if (win.maximized) return;
    focus(win.id);
    drag.current = { startX: e.clientX, startY: e.clientY, mode: "move", edge: "" };
    document.body.style.cursor = "move";
    document.body.style.userSelect = "none";
  };

  const startResize = (e: React.MouseEvent, edge: string) => {
    if (win.maximized) return;
    e.stopPropagation();
    focus(win.id);
    drag.current = { startX: e.clientX, startY: e.clientY, mode: "resize", edge };
    const cursors: Record<string, string> = {
      e: "ew-resize", w: "ew-resize", s: "ns-resize", n: "ns-resize",
      se: "nwse-resize", sw: "nesw-resize", ne: "nesw-resize", nw: "nwse-resize",
    };
    document.body.style.cursor = cursors[edge] ?? "default";
    document.body.style.userSelect = "none";
  };

  const clone = () => {
    open({
      id: `${win.id}_copy_${Date.now().toString(36)}`,
      title: win.title, kind: win.kind,
      rect: { x: win.rect.x + 40, y: win.rect.y + 40, w: win.rect.w, h: win.rect.h },
    });
  };

  const style = win.maximized
    ? { left: 0, top: 0, width: "100%", height: "100%", zIndex: win.z }
    : {
        left: win.rect.x, top: win.rect.y,
        width: win.rect.w, height: win.minimized ? "auto" : win.rect.h,
        zIndex: win.z,
      };

  const edges = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];
  const edgeClasses: Record<string, string> = {
    n: "top-0 left-2 right-2 h-1.5 cursor-ns-resize",
    s: "bottom-0 left-2 right-2 h-1.5 cursor-ns-resize",
    e: "right-0 top-2 bottom-2 w-1.5 cursor-ew-resize",
    w: "left-0 top-2 bottom-2 w-1.5 cursor-ew-resize",
    ne: "top-0 right-0 w-3 h-3 cursor-nesw-resize",
    nw: "top-0 left-0 w-3 h-3 cursor-nwse-resize",
    se: "bottom-0 right-0 w-3 h-3 cursor-nwse-resize",
    sw: "bottom-0 left-0 w-3 h-3 cursor-nesw-resize",
  };

  return (
    <div
      className={cn(
        "absolute flex flex-col rounded-lg border bg-card/80 backdrop-blur-md shadow-2xl",
        "data-[active=true]:border-primary/50",
      )}
      style={style}
      data-active={win.id === useWM.getState().activeId}
      onMouseDown={() => focus(win.id)}
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <header
            onMouseDown={startMove}
            onDoubleClick={() => toggleMax(win.id)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 border-b border-border/50 flex-shrink-0 select-none cursor-move",
              win.minimized && "border-b-0 rounded-lg",
            )}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-primary/70 flex-shrink-0" />
            <span className="text-xs font-semibold text-foreground truncate flex-1">{win.title}</span>
            <button onClick={(e) => { e.stopPropagation(); toggleMin(win.id); }} title="Minimizar" aria-label="Minimizar" className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"><Minus className="h-3.5 w-3.5" /></button>
            <button onClick={(e) => { e.stopPropagation(); toggleMax(win.id); }} title="Maximizar" aria-label="Maximizar" className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"><Square className="h-3 w-3" /></button>
            <button onClick={(e) => { e.stopPropagation(); close(win.id); }} title="Fechar" aria-label="Fechar" className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
          </header>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => focus(win.id)}><Pin className="h-4 w-4 mr-2" /> Trazer para frente</ContextMenuItem>
          <ContextMenuItem onClick={() => toggleMax(win.id)}><Square className="h-4 w-4 mr-2" /> {win.maximized ? "Restaurar" : "Maximizar"}</ContextMenuItem>
          <ContextMenuItem onClick={() => toggleMin(win.id)}><Minus className="h-4 w-4 mr-2" /> {win.minimized ? "Expandir" : "Minimizar"}</ContextMenuItem>
          <ContextMenuItem onClick={() => restore(win.id)}><RotateCcw className="h-4 w-4 mr-2" /> Restaurar tamanho</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={clone}><Copy className="h-4 w-4 mr-2" /> Duplicar janela</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => close(win.id)} className="text-destructive"><X className="h-4 w-4 mr-2" /> Fechar</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {!win.minimized && (
        <div className="flex-1 min-h-0 overflow-hidden relative">
          {children}
        </div>
      )}

      {!win.maximized && !win.minimized && edges.map((e) => (
        <div
          key={e}
          onMouseDown={(ev) => startResize(ev, e)}
          className={cn("absolute z-10", edgeClasses[e])}
        />
      ))}
    </div>
  );
}
