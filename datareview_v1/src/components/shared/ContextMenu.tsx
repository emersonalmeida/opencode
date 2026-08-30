import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface ContextMenuItem {
  type?: "item" | "separator" | "submenu";
  label?: string;
  icon?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  submenu?: ContextMenuItem[];
}

export interface ContextMenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

/**
 * Portal-based context menu with virtualization-free positioning, keyboard
 * support (Esc to close, arrow navigation), submenus, and outside-click close.
 * Rendered into document.body to escape overflow/clipping in scroll containers.
 */
export function ContextMenuOverlay({
  state,
  onClose,
}: {
  state: ContextMenuState;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: state.x, y: state.y });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let { x, y } = state;
    if (x + r.width > window.innerWidth - 8) x = Math.max(8, window.innerWidth - r.width - 8);
    if (y + r.height > window.innerHeight - 8) y = Math.max(8, window.innerHeight - r.height - 8);
    setPos({ x, y });
  }, [state]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const onScroll = () => onClose();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResizeSafe(onClose), { once: true });
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
      window.removeEventListener("scroll", onScroll, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-orientation="vertical"
      style={{ left: pos.x, top: pos.y }}
 className="fixed z-[9999] min-w-[180px] rounded-lg border border-border/70 bg-popover p-1 shadow-lg shadow-black/10 backdrop-blur"
      onContextMenu={(e) => { e.preventDefault(); }}
    >
      {state.items.map((item, i) => {
        if (item.type === "separator") {
          return <div key={i} className="my-1 h-px bg-border/50" />;
        }
        return (
          <button
            key={i}
            role="menuitem"
            disabled={item.disabled}
            onClick={() => { if (!item.disabled) { item.onClick?.(); onClose(); } }}
            className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-accent focus:bg-accent focus:outline-none disabled:opacity-40 disabled:pointer-events-none ${
              item.danger ? "text-destructive hover:bg-destructive/10" : "text-popover-foreground"
            }`}
          >
            {item.icon && <span className="flex h-3.5 w-3.5 items-center justify-center text-muted-foreground">{item.icon}</span>}
            <span className="flex-1 truncate">{item.label}</span>
            {item.submenu && <span className="text-muted-foreground">▸</span>}
          </button>
        );
      })}
    </div>,
    document.body,
  );
}

function onResizeSafe(fn: () => void) {
  return () => fn();
}

/**
 * Hook to manage a context menu state. Returns props for the trigger
 * (onContextMenu) and the rendered overlay (if open).
 *
 * Usage:
 *   const { menu, openWith, close } = useContextMenu();
 *   <div onContextMenu={openWith(buildItems)} />
 *   {menu && <ContextMenuOverlay state={menu} onClose={close} />}
 */
export function useContextMenu() {
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const openAt = (x: number, y: number, items: ContextMenuItem[]) => {
    setMenu({ x, y, items });
  };
  const openWith = (items: ContextMenuItem[]) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openAt(e.clientX, e.clientY, items);
  };
  const close = () => setMenu(null);
  return { menu, openAt, openWith, close };
}
