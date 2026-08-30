/**
 * Hooks de UX compartilhados — atalhos de teclado, confirmação destrutiva
 * e ações com desfazer. Reutilizáveis em todas as páginas para manter
 * consistência (mesmo comportamento em todo o sistema).
 */
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  matchShortcut, toastDestructive, confirmDestructive,
  type ShortcutDef,
} from "@/lib/ux";

/**
 * Registra atalhos de teclado globais. `shortcuts` é memoizado pelo caller
 * (ou definido fora do componente) — o listener é único e lê a ref mais
 * recente, então não há re-registro a cada render.
 */
export function useKeyboardShortcuts(shortcuts: ShortcutDef[], enabled = true) {
  const ref = useRef(shortcuts);
  ref.current = shortcuts;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      for (const s of ref.current) {
        if (matchShortcut(e, s)) {
          e.preventDefault();
          s.run();
          return;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}

/**
 * Executa uma ação destrutiva com confirmação (prevenção de erros) e, se
 * `undo` for fornecido, exibe um toast com "Desfazer" (controle/liberdade).
 *
 * Uso:
 *   const destroy = useDestructiveAction();
 *   destroy({
 *     confirm: "Apagar o dataset inteiro?",
 *     detail: "5 apps · 1.230 reviews",
 *     action: () => clearDataset(),
 *     toast: "Dataset apagado",
 *     undo: () => restoreDataset(backup),
 *   });
 */
export function useDestructiveAction() {
  return useCallback(
    (opts: {
      /** Mensagem de confirmação (omitir = sem confirmação). */
      confirm?: string;
      /** Linha de contexto na confirmação (contagens, consequência). */
      detail?: string;
      /** Executa a ação destrutiva (retorna um "backup" opcional p/ undo). */
      action: () => void | (() => void);
      /** Título do toast de feedback. */
      toast?: string;
      /** Descrição do toast. */
      toastDescription?: string;
      /** Função de desfazer (usa o retorno de `action` se `undo` ausente). */
      undo?: () => void;
    }) => {
      if (opts.confirm && !confirmDestructive(opts.confirm, opts.detail)) return;
      const maybeUndo = opts.action();
      const undoFn = opts.undo ?? (typeof maybeUndo === "function" ? maybeUndo : undefined);
      if (opts.toast) {
        toastDestructive(opts.toast, { description: opts.toastDescription, onUndo: undoFn });
      }
    },
    [],
  );
}

/**
 * Estado de "ocupado" com rótulo — visibilidade de status consistente para
 * ações demoradas. Retorna `[busy, run]`; `run(label, fn)` marca ocupado,
 * executa e libera ao final (mesmo em erro).
 */
export function useBusyAction(): [string | null, <T>(label: string, fn: () => Promise<T> | T) => Promise<T>] {
  const [busy, setBusy] = useState<string | null>(null);
  const run = useCallback(
    async <T,>(label: string, fn: () => Promise<T> | T): Promise<T> => {
      setBusy(label);
      try {
        return await fn();
      } finally {
        setBusy(null);
      }
    },
    [],
  );
  return [busy, run];
}

/**
 * Valor com "pending" otimista — feedback imediato em toggles que disparam
 * trabalho assíncrono (ex.: selecionar app coleta em background). A UI
 * reflete a intenção na hora; em caso de erro, reverte.
 */
export function useOptimistic<T extends string | number | boolean>(initial: T) {
  const [value, setValue] = useState<T>(initial);
  const commit = useCallback(
    (next: T, work?: () => Promise<unknown>) => {
      const prev = value;
      setValue(next);
      work?.().catch(() => setValue(prev));
    },
    [value],
  );
  return useMemo(() => ({ value, set: setValue, commit }), [value, commit]);
}
