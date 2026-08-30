/**
 * Concorrência de streams de chat — helpers puros e genéricos.
 *
 * Quando várias gerações de IA rodam ao mesmo tempo (modo "parallel"), cada
 * stream precisa escrever na SUA própria mensagem de assistente — abordagem
 * por índice capturado no momento do append (em vez de "última mensagem",
 * que colide entre streams concorrentes). Genérico sobre o shape da mensagem
 * de cada superfície (Chat page, Assistente, AIAssistantPanel "search"…).
 */

/** Referência mutável que guarda o índice do placeholder do stream. */
export interface StreamIndex {
  current: number;
}

/**
 * Anexa um placeholder de assistente e captura o índice em `idx`.
 * Uso: `const idx = { current: -1 }; setMessages(prev => appendPlaceholder(prev, idx));`
 */
export function appendPlaceholder<M extends { role: string; content: string }>(
  prev: M[],
  idx: StreamIndex,
): M[] {
  idx.current = prev.length;
  return [...prev, { role: "assistant", content: "" } as M];
}

/**
 * Substitui o conteúdo do placeholder do stream pelo texto acumulado.
 * Idempotente por índice — seguro entre streams concorrentes.
 */
export function patchIndex<M extends { role: string; content: string }>(
  prev: M[],
  idx: number,
  content: string,
): M[] {
  const next = [...prev];
  if (idx >= 0 && idx < next.length) {
    next[idx] = { role: "assistant", content } as M;
  } else {
    next.push({ role: "assistant", content } as M);
  }
  return next;
}

/**
 * Remove o placeholder do stream (erro antes do primeiro token) — restrito
 * à mensagem DESTE stream, sem tocar nas de streams concorrentes.
 */
export function dropIndex<M>(prev: M[], idx: number): M[] {
  if (idx < 0) return prev;
  const next = [...prev];
  next.splice(idx, 1);
  return next;
}
