import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * ScrollableArea — container com scroll vertical nativo que coopera com o
 * zoom/pan do React Flow.
 *
 * Comportamento do wheel:
 * - Quando há conteúdo para rolar na direção do gesto, o evento é consumido
 *   (stopPropagation) para que o React Flow NÃO faça zoom — a rolagem fica
 *   dentro do nó.
 * - Quando o conteúdo não pode mais rolar naquela direção (topo/bottom), o
 *   evento propaga para o React Flow, permitindo zoom/pan do canvas.
 *
 * Assim o usuário rola o conteúdo do nó com o scroll do mouse quando há o que
 * rolar, e faz zoom do canvas quando chega ao limite (ou está sobre área não
 * rolável). Funciona com nó selecionado ou não.
 *
 * O listener é nativo (não-passive) para poder impedir o zoom do React Flow,
 * que também escuta `wheel` nativamente no pane/viewport.
 */
export function ScrollableArea({
  children,
  className,
  maxHeight,
  onScrollBottom,
}: {
  children: ReactNode;
  className?: string;
  /** Classe de altura máxima (ex: "max-h-40"). Quando ausente, cresce livre. */
  maxHeight?: string;
  /** Callback opcional ao atingir o fundo (auto-load, etc.). */
  onScrollBottom?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      // deltaMode 1 = linha, 0 = pixel. Normaliza para pixel.
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
      const goingDown = dy > 0;
      const canScrollDown = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
      const canScrollUp = el.scrollTop > 0;
      if ((goingDown && canScrollDown) || (!goingDown && canScrollUp)) {
        // Há conteúdo para rolar: impede o zoom do React Flow.
        e.stopPropagation();
      }
      // Caso contrário: deixa propagar -> React Flow faz zoom/pan.
    };
    // Capture para garantir que interceptamos antes do listener do React Flow.
    el.addEventListener("wheel", onWheel, { passive: true, capture: true });
    return () => el.removeEventListener("wheel", onWheel, { capture: true });
  }, []);

  const handleScroll = () => {
    if (!onScrollBottom) return;
    const el = ref.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) onScrollBottom();
  };

  return (
    <div
      ref={ref}
      onScroll={handleScroll}
      className={cn("overflow-y-auto", maxHeight, className)}
      // Ajuda leitores de tela e foco por teclado.
      tabIndex={0}
      role="region"
      aria-label="Conteúdo rolável"
    >
      {children}
    </div>
  );
}
