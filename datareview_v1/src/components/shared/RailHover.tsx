/**
 * RailHover — tooltip/flyout universal para itens de RAIL de sidebar
 * recolhida. Implementação própria com `mouseenter/mouseleave` + portal
 * (document.body): NÃO depende da pipeline de pointer events — funciona em
 * qualquer ambiente onde o mouse funciona (incl. Wayland/XWayland).
 *
 * Dois modos:
 *  - TOOLTIP (sem `content`): bolha pequena com label (+ descrição).
 *  - FLYOUT (com `content`): painel flutuante com o CONTEÚDO REAL do recurso
 *    (aba/página) — o mouse pode entrar no painel e interagir sem a sidebar
 *    precisar expandir (hover-intent: close delay ao sair do gatilho).
 *
 * A11y: abre também no foco de teclado; Esc fecha; role=tooltip/dialog.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RailHoverProps {
  /** O botão/ícone do rail (gatilho). */
  trigger: ReactNode;
  /** Texto do tooltip / título do flyout. */
  label: string;
  /** Ícone do header do flyout (opcional). */
  icon?: ReactNode;
  /** Descrição curta (tooltip: 2ª linha; flyout: subtítulo). */
  description?: string;
  /** Conteúdo real do recurso — se presente, vira flyout interativo. */
  content?: ReactNode;
  /** Lado onde abre (rail da esquerda → "right"; rail da direita → "left"). */
  side: "left" | "right";
  /** Largura do flyout (default 360px). */
  width?: number;
  /** Delay de abertura (default: 120ms tooltip / 250ms flyout). */
  openDelay?: number;
  /** Abre o overlay por CLIQUE no gatilho (não por hover/foco) — modo
   *  "rail funcional": o usuário usa o recurso SEM expandir a sidebar.
   *  No modo clique, o flyout ganha botão fechar e clique fora/Esc fecha. */
  openOnClick?: boolean;
}

export function RailHover({
  trigger,
  label,
  icon,
  description,
  content,
  side,
  width = 360,
  openDelay,
  openOnClick = false,
}: RailHoverProps) {
  const isFlyout = content != null;
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const openTimer = useRef(0);
  const closeTimer = useRef(0);

  const clearTimers = useCallback(() => {
    window.clearTimeout(openTimer.current);
    window.clearTimeout(closeTimer.current);
  }, []);

  const computePos = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const w = isFlyout ? width : 260;
    const h = isFlyout ? Math.min(window.innerHeight * 0.72, 560) : 44;
    let left = side === "right" ? r.right + 10 : r.left - w - 10;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    let top = r.top + r.height / 2 - (isFlyout ? 20 : 17);
    top = Math.max(8, Math.min(top, window.innerHeight - h - 8));
    return { left, top };
  }, [side, width, isFlyout]);

  const openNow = useCallback(() => {
    clearTimers();
    setPos(computePos());
    setOpen(true);
  }, [clearTimers, computePos]);

  const scheduleOpen = useCallback(() => {
    clearTimers();
    openTimer.current = window.setTimeout(openNow, openDelay ?? (isFlyout ? 250 : 120));
  }, [clearTimers, openNow, openDelay, isFlyout]);

  const scheduleClose = useCallback(() => {
    clearTimers();
    closeTimer.current = window.setTimeout(() => setOpen(false), 200);
  }, [clearTimers]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  // Fecha em scroll/resize (o rail pode rolar sob o painel) e em Esc.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Modo CLIQUE (openOnClick): abre/fecha pelo clique no gatilho e fecha ao
  // clicar FORA do gatilho + do painel (pointerdown em capture — dispara
  // antes de qualquer onClick interno, sem impedi-los).
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open || !openOnClick) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open, openOnClick]);

  const toggleByClick = useCallback(() => {
    setOpen((o) => {
      if (o) return false;
      setPos(computePos());
      return true;
    });
  }, [computePos]);

  return (
    <>
      {/* inline-flex (NÃO `contents`): o wrapper precisa gerar uma caixa real
          para o getBoundingClientRect posicionar o tooltip/flyout. */}
      <span
        ref={wrapRef}
        className="inline-flex"
        onMouseEnter={openOnClick ? undefined : scheduleOpen}
        onMouseLeave={openOnClick ? undefined : scheduleClose}
        onFocus={openOnClick ? undefined : openNow}
        onBlur={openOnClick ? undefined : scheduleClose}
        onClick={openOnClick ? toggleByClick : undefined}
      >
        {trigger}
      </span>
      {open && pos && createPortal(
        isFlyout ? (
          <div
            ref={panelRef}
            role="dialog"
            aria-label={label}
            className="fixed z-[100] rounded-xl border border-border/60 bg-popover text-popover-foreground shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95"
            style={{ left: pos.left, top: pos.top, width }}
            onMouseEnter={openOnClick ? undefined : clearTimers}
            onMouseLeave={openOnClick ? undefined : scheduleClose}
          >
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-secondary/40">
              {icon && <span className="[&>svg]:h-3.5 [&>svg]:w-3.5 flex text-primary flex-shrink-0">{icon}</span>}
              <p className="text-xs font-semibold text-foreground truncate">{label}</p>
              {openOnClick && (
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Fechar"
                  className="ml-auto p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {description && (
              <p className="px-3 pt-2 text-[10px] text-muted-foreground leading-snug">{description}</p>
            )}
            <div className="max-h-[70vh] overflow-y-auto overscroll-contain">{content}</div>
          </div>
        ) : (
          <div
            role="tooltip"
            className={cn(
              "fixed z-[100] max-w-64 rounded-md border border-border/60 bg-popover px-3 py-1.5 text-xs",
              "text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 pointer-events-none",
            )}
            style={{ left: pos.left, top: pos.top }}
          >
            <span className="font-medium">{label}</span>
            {description && <span className="block text-[10px] text-muted-foreground mt-0.5">{description}</span>}
          </div>
        ),
        document.body,
      )}
    </>
  );
}
