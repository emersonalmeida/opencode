/**
 * useSmartAutoScroll — auto-scroll inteligente e unificado para QUALQUER
 * container que cresce durante uma geração (chat, console, log, bottombar).
 *
 * Contrato (o mesmo da página /chat):
 *  - Só puxa a rolagem para o fim quando o usuário JÁ ESTÁ perto do fim —
 *    rolar para cima durante a geração NUNCA é interrompido (scroll livre).
 *  - A leitura de "está no fim" usa um ref (atualizado no evento de scroll)
 *    para o efeito não re-executar a cada delta de stream — zero disputa
 *    entre o auto-scroll e a rolagem manual.
 *  - `atBottom` reativo alimenta o chip "Ir para o fim" (resumeFollow).
 *
 * Uso:
 *   const chat = useSmartAutoScroll<HTMLDivElement>([messages]);
 *   <div ref={chat.ref} onScroll={chat.onScroll}>…</div>
 *   {chat.showJump && <button onClick={chat.resumeFollow}>Recentes</button>}
 */
import { useCallback, useEffect, useRef, useState } from "react";

export interface SmartAutoScroll<T extends HTMLElement> {
  /** Anexe ao elemento rolável. */
  ref: React.RefObject<T | null>;
  /** Anexe ao onScroll do elemento rolável. */
  onScroll: () => void;
  /** Estado reativo "usuário está perto do fim" (para chips/overlays). */
  atBottom: boolean;
  /** true quando NÃO está no fim e há o que rolar (mostrar chip flutuante). */
  showJump: boolean;
  /** Rola ao fim e retoma o follow (usado pelo chip). */
  resumeFollow: () => void;
  /** Rola ao fim imediatamente (smooth opcional). */
  scrollToBottom: (smooth?: boolean) => void;
}

const THRESHOLD_PX = 60;

export function useSmartAutoScroll<T extends HTMLElement = HTMLDivElement>(
  deps: readonly unknown[],
  thresholdPx = THRESHOLD_PX,
): SmartAutoScroll<T> {
  const ref = useRef<T | null>(null);
  const atBottomRef = useRef(true);
  const [atBottom, setAtBottom] = useState(true);
  const [canScroll, setCanScroll] = useState(false);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < thresholdPx;
    atBottomRef.current = near;
    setAtBottom(near);
    setCanScroll(el.scrollHeight > el.clientHeight + 4);
  }, [thresholdPx]);

  const onScroll = useCallback(() => measure(), [measure]);

  const scrollToBottom = useCallback((smooth = true) => {
    const el = ref.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  const resumeFollow = useCallback(() => {
    atBottomRef.current = true;
    setAtBottom(true);
    scrollToBottom(true);
  }, [scrollToBottom]);

  // Quando o conteúdo muda: segue o fim SOMENTE se o usuário já estava lá.
  // A decisão usa o ref (não o estado) — o efeito não re-dispara por causa do
  // próprio auto-scroll e nunca disputa com a rolagem manual do usuário.
  // IMPORTANTE: não medir "atBottom" aqui — o conteúdo JÁ cresceu quando o
  // efeito roda, então medir agora marcaria "fora do fim" e apagaria a
  // intenção do usuário. O ref só muda no onScroll (gesto real do usuário).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setCanScroll(el.scrollHeight > el.clientHeight + 4);
    if (atBottomRef.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return {
    ref,
    onScroll,
    atBottom,
    showJump: !atBottom && canScroll,
    resumeFollow,
    scrollToBottom,
  };
}
