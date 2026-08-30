/**
 * Modelo de abas/panes do Terminal (puro — usado pela página e testes).
 *
 * Um Tab = um grupo de panes; um Pane = uma sessão CLI independente (id +
 * título próprios). Split horizontal (colunas) ou vertical (linhas) — estilo
 * tmux. A página mantém também `lines` por paneId.
 */
import type { ConsoleLine } from "@/lib/os/types";

export interface TermPane {
  id: string;
  title: string;
}

export interface TermTab {
  id: string;
  label: string;
  direction: "h" | "v";
  panes: TermPane[];
  activePaneId: string;
}

let uid = 0;

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${(uid++).toString(36)}`;
}

export function createTab(index: number): TermTab {
  const pane: TermPane = { id: genId("p"), title: "sessão" };
  return {
    id: genId("t"),
    label: `aba ${index}`,
    direction: "h",
    panes: [pane],
    activePaneId: pane.id,
  };
}

/** Boot banner por pane (ASCII + instruções). */
export function bootLines(paneTitle: string, aiInfo: string): ConsoleLine[] {
  const sys = (text: string): ConsoleLine => ({ kind: "sys", text, ts: Date.now() });
  const out = (text: string): ConsoleLine => ({ kind: "out", text, ts: Date.now() });
  return [
    sys(`┌─ nexterm — ${paneTitle} ────────────────`),
    sys(`│ Shell inteligente do App Intelligence`),
    sys(`│ ${aiInfo}`),
    sys(`└────────────────────────────────────────`),
    out(""),
    out('💡 "/" /help lista todos os comandos — textos sem "/" vão para a IA.'),
    out("💡 Ctrl+T aba nova · Ctrl+S split · Ctrl+W fecha pane · Ctrl+L limpa."),
    out("💡 ↑/↓ histórico · Tab completa comando. Clique num pane p/ focar."),
  ];
}
