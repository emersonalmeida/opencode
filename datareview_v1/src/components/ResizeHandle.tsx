import { useEffect, useRef, type KeyboardEvent } from "react";

interface Props {
  side: "left" | "right"; // which edge of the sidebar the handle sits on
  onResize: (deltaPx: number) => void;
  onCommit?: () => void;
  /** Reset width to default on double-click. */
  onReset?: () => void;
  /** A11y do slider: largura atual e faixa (para aria-valuenow/min/max). */
  value?: number;
  min?: number;
  max?: number;
  ariaLabel?: string;
}

/**
 * Drag handle for resizing adjacent sidebars. Emits pixel deltas relative to
 * the start of the drag. Hover/drag reveals a visible grip; double-click resets
 * the sidebar to its default width (when onReset is provided).
 */
export function ResizeHandle({ side, onResize, onCommit, onReset, value, min, max, ariaLabel }: Props) {
  const startX = useRef(0);
  const dragging = useRef(false);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - startX.current;
      startX.current = e.clientX;
      onResize(side === "left" ? -dx : dx);
    };
    const up = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      onCommit?.();
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [onResize, onCommit, side]);

  const onKeyDown = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 40 : 16;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const dir = e.key === "ArrowRight" ? 1 : -1;
      // Mesma convenção do drag: side="right" cresce para a direita.
      onResize((side === "right" ? 1 : -1) * dir * step);
      onCommit?.();
    } else if (e.key === "Home") {
      e.preventDefault();
      onReset?.();
    }
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel ?? "Redimensionar sidebar"}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseDown={(e) => {
        e.preventDefault();
        dragging.current = true;
        startX.current = e.clientX;
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
      }}
      onDoubleClick={() => onReset?.()}
      className={`group/handle hidden md:flex absolute top-0 bottom-0 w-1.5 z-20 cursor-col-resize items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
        side === "left" ? "-right-[3px]" : "-left-[3px]"
      }`}
      title="Arraste para redimensionar · duplo-clique para redefinir · ←/→ ajusta (Shift = mais rápido)"
    >
      {/* Track */}
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-border/60 group-hover/handle:w-0.5 group-hover/handle:bg-primary/60 transition-all" />
      {/* Visible grip dots — appear on hover */}
      <div className="absolute left-1/2 -translate-x-1/2 flex flex-col gap-[3px] opacity-0 group-hover/handle:opacity-100 transition-opacity">
        {[0, 1, 2].map((i) => (
          <span key={i} className="w-0.5 h-0.5 rounded-full bg-primary" />
        ))}
      </div>
      {/* Wider invisible hit area for easier grabbing */}
      <div className="absolute inset-y-0 -left-1 -right-1" />
    </div>
  );
}
