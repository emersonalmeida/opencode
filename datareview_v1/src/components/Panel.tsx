import {
  useCallback, useEffect, useRef, useState, type ReactNode,
} from "react";
import { ChevronDown, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Panel — o bloco de construção expansível/redimensionável do sistema.
 *
 * Princípio (UX de desktop OS / window tiling): todo conteúdo nasce ABERTO e
 * com altura completa; o usuário pode recolher, expandir e redimensionar a
 * vontade. Quando o conteúdo excede a altura visível, há scroll interno (o
 * painel nunca estoura o layout).
 *
 *  - `defaultOpen` (true): nasce expandido mostrando todo o conteúdo.
 *  - `resizable` (true): drag handle na borda inferior ajusta a altura.
 *  - Persistência opcional via `storageKey` (estado aberto + altura).
 *  - Header com título + subtítulo + slot de ações + botão recolher.
 */
export interface PanelProps {
  /** Título do painel (header). */
  title?: ReactNode;
  /** Subtítulo discreto sob o título. */
  subtitle?: ReactNode;
  /** Ícone à esquerda do título. */
  icon?: ReactNode;
  /** Ações no canto direito do header (botões, badges). */
  actions?: ReactNode;
  /** Corpo do painel. */
  children: ReactNode;
  /** Classe extra no conteúdo. */
  contentClassName?: string;
  /** Classe extra no wrapper externo. */
  className?: string;
  /** Nasce aberto? Default true. */
  defaultOpen?: boolean;
  /** Permite redimensionar a altura arrastando a borda inferior. Default true. */
  resizable?: boolean;
  /** Altura inicial (px) quando redimensionável. Default: altura do conteúdo. */
  defaultHeight?: number;
  /** Altura mínima (px). */
  minHeight?: number;
  /** Altura máxima (px). Default 70vh. */
  maxHeight?: number;
  /** Persistir estado aberto + altura em localStorage. */
  storageKey?: string;
  /** Compact header (padding menor). */
  compact?: boolean;
  /** Sem borda/card — só o conteúdo. */
  bare?: boolean;
}

function loadNum(key: string, fb: number): number {
  try {
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) && v > 0 ? v : fb;
  } catch { return fb; }
}
function loadBool(key: string, fb: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fb : v === "1";
  } catch { return fb; }
}

export function Panel({
  title, subtitle, icon, actions, children, contentClassName, className,
  defaultOpen = true, resizable = true, defaultHeight,
  minHeight = 120, maxHeight,
  storageKey, compact, bare,
}: PanelProps) {
  const [open, setOpen] = useState<boolean>(() =>
    storageKey ? loadBool(`${storageKey}-open`, defaultOpen) : defaultOpen);
  const [height, setHeight] = useState<number | null>(() =>
    storageKey && resizable ? loadNum(`${storageKey}-h`, defaultHeight ?? 0) || null : defaultHeight ?? null);
  const dragRef = useRef(false);
  const startY = useRef(0);
  const startH = useRef(0);

  const maxH = maxHeight ?? Math.floor((typeof window === "undefined" ? 600 : window.innerHeight) * 0.7);

  const persistOpen = useCallback((o: boolean) => {
    setOpen(o);
    if (storageKey) try { localStorage.setItem(`${storageKey}-open`, o ? "1" : "0"); } catch { /* ignore */ }
  }, [storageKey]);

  const persistHeight = useCallback((h: number) => {
    setHeight(h);
    if (storageKey) try { localStorage.setItem(`${storageKey}-h`, String(h)); } catch { /* ignore */ }
  }, [storageKey]);

  useEffect(() => {
    if (!resizable) return;
    const move = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const dy = e.clientY - startY.current;
      const next = Math.min(Math.max(startH.current + dy, minHeight), maxH);
      setHeight(next);
    };
    const up = () => {
      if (!dragRef.current) return;
      dragRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      if (storageKey) try { localStorage.setItem(`${storageKey}-h`, String(height)); } catch { /* ignore */ }
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [resizable, minHeight, maxH, storageKey, height]);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = true;
    startY.current = e.clientY;
    startH.current = height ?? (e.currentTarget.parentElement?.getBoundingClientRect().height ?? 320);
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  };

  const resetHeight = () => {
    setHeight(null);
    if (storageKey) try { localStorage.removeItem(`${storageKey}-h`); } catch { /* ignore */ }
  };

  const Wrapper = bare ? "div" : "div";
  return (
    <Wrapper
      className={cn(
        "flex flex-col min-h-0",
        !bare && "rounded-lg border border-border/50 bg-card/40 backdrop-blur-sm",
        className,
      )}
    >
      {title && (
        <header
          className={cn(
            "flex items-center gap-2 flex-shrink-0 select-none",
            compact ? "px-2.5 py-1.5" : "px-3 py-2.5",
            !bare && "border-b border-border/50",
          )}
        >
          {icon && (
            <div className={cn(
              "flex items-center justify-center flex-shrink-0 rounded-md text-primary",
              compact ? "w-5 h-5" : "w-6 h-6",
            )}>
              {icon}
            </div>
          )}
          <div className="min-w-0 flex-1">
            {title && (
              <p className={cn(
                "font-semibold text-foreground truncate leading-tight",
                compact ? "text-xs" : "text-sm",
              )}>{title}</p>
            )}
            {subtitle && (
              <p className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">{subtitle}</p>
            )}
          </div>
          {actions}
          <button
            onClick={() => persistOpen(!open)}
            title={open ? "Recolher" : "Expandir"}
            aria-label={open ? "Recolher" : "Expandir"}
            aria-expanded={open}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex-shrink-0"
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", !open && "-rotate-90")} />
          </button>
        </header>
      )}
      {open && (
        <div
          className={cn("min-h-0 relative", contentClassName)}
          style={resizable && height != null ? { height, overflow: "auto" } : { maxHeight: maxH, overflow: "auto" }}
        >
          {children}
          {resizable && (
            <div
              onMouseDown={startResize}
              onDoubleClick={resetHeight}
              title="Arraste para redimensionar a altura · duplo-clique para redefinir"
              className="group/resize absolute left-0 right-0 bottom-0 h-1.5 cursor-row-resize flex items-center justify-center"
            >
              <div className="absolute left-1/2 -translate-x-1/2 w-px h-full bg-border/60 group-hover/resize:bg-primary/60 transition-colors" />
              <div className="absolute left-1/2 -translate-x-1/2 flex gap-[2px] opacity-0 group-hover/resize:opacity-100 transition-opacity">
                <span className="w-0.5 h-0.5 rounded-full bg-primary" />
                <span className="w-0.5 h-0.5 rounded-full bg-primary" />
              </div>
              <div className="absolute inset-x-0 -top-1 -bottom-1" />
            </div>
          )}
        </div>
      )}
      {!title && resizable && open && (
        <Maximize2 className="hidden" />
      )}
    </Wrapper>
  );
}
