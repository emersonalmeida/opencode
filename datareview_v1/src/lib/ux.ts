/**
 * Fundamentos de UX compartilhados (lib pura, sem UI) — aplicados em todas
 * as páginas. Implementa, de forma testável, os princípios de:
 *  - feedback imediato e visibilidade de status (toasts),
 *  - controle e liberdade do usuário (desfazer),
 *  - prevenção de erros (confirmação),
 *  - eficiência/flexibilidade (atalhos),
 *  - ajuda/descobribilidade (textos padrão).
 *
 * O feedback usa `sonner` (já montado no App). Toasts destrutivos trazem a
 * ação "Desfazer" quando uma função `onUndo` é fornecida.
 */
import { toast } from "sonner";

/* ------------------------------------------------------------ tipos --- */

export interface ToastOptions {
  /** Descrição complementar (contexto, contagem). */
  description?: string;
  /** Ação de desfazer — exibe o botão "Desfazer" no toast. */
  onUndo?: () => void;
  /** Duração custom (ms). Padrão: 4s (6s quando há Desfazer). */
  duration?: number;
}

/* ------------------------------------------------------- feedback --- */

/** Sucesso — feedback imediato de que a ação funcionou. */
export function toastSuccess(title: string, opts: ToastOptions = {}) {
  toast.success(title, { description: opts.description, duration: opts.duration });
}

/** Info — status neutro (ex.: "coleta iniciada", "usando cache"). */
export function toastInfo(title: string, opts: ToastOptions = {}) {
  toast(title, { description: opts.description, duration: opts.duration });
}

/** Erro — explica o problema e como resolver (recuperação de erro). */
export function toastError(title: string, opts: ToastOptions = {}) {
  toast.error(title, { description: opts.description, duration: opts.duration ?? 6000 });
}

/**
 * Ação destrutiva executada — com **Desfazer** quando `onUndo` é fornecido.
 * Garante "controle e liberdade do usuário": excluir nunca é irreversível
 * sem aviso.
 */
export function toastDestructive(title: string, opts: ToastOptions = {}) {
  toast(title, {
    description: opts.description,
    duration: opts.duration ?? (opts.onUndo ? 6000 : 4000),
    action: opts.onUndo
      ? { label: "Desfazer", onClick: () => opts.onUndo!() }
      : undefined,
  });
}

/** Promessa com ciclo de vida (loading → sucesso/erro) — visibilidade de status. */
export function toastPromise<T>(
  promise: Promise<T>,
  msgs: { loading: string; success: string | ((v: T) => string); error: string | ((e: unknown) => string) },
): Promise<T> {
  toast.promise(promise, {
    loading: msgs.loading,
    success: (v) => (typeof msgs.success === "function" ? msgs.success(v) : msgs.success),
    error: (e) => (typeof msgs.error === "function" ? msgs.error(e) : msgs.error),
  });
  return promise;
}

/* ----------------------------------------------- prevenção de erros --- */

/**
 * Confirmação padrão para ações destrutivas. Retorna `true` se o usuário
 * confirmou. Centraliza a redação (consistência) e evita o erro de
 * esquecer a confirmação.
 */
export function confirmDestructive(message: string, detail?: string): boolean {
  return window.confirm(detail ? `${message}\n\n${detail}` : message);
}

/** Rótulos de confirmação consistentes por tipo de ação. */
export function confirmLabel(kind: "excluir" | "limpar" | "resetar" | "apagar", what: string, count?: number): string {
  const n = count !== undefined ? ` (${count} ${count === 1 ? "item" : "itens"})` : "";
  const verbs: Record<string, string> = {
    excluir: `Excluir ${what}${n}?`,
    limpar: `Limpar ${what}${n}?`,
    resetar: `Resetar ${what}${n}?`,
    apagar: `Apagar ${what}${n}?`,
  };
  return `${verbs[kind]} Esta ação pode ser desfeita quando houver a opção "Desfazer".`;
}

/* ------------------------------------------------------- atalhos --- */

export interface ShortcutDef {
  /** Tecla (ex.: "k", "d", "?"). */
  key: string;
  /** Requer Ctrl/Cmd. */
  mod?: boolean;
  /** Requer Shift. */
  shift?: boolean;
  /** Descrição legível (lista de ajuda). */
  label: string;
  /** Grupo para a central de atalhos. */
  group?: string;
  /** Executa a ação. */
  run: () => void;
  /** Se definido, o atalho só dispara quando `when()` é true. */
  when?: () => boolean;
}

/**
 * Normaliza um evento de teclado para comparação. Ignora quando o foco está
 * em campo de texto (input/textarea/contentEditable) — exceto atalhos com
 * `mod` (ex.: Ctrl+K), que funcionam mesmo com o foco em input.
 */
export function matchShortcut(e: KeyboardEvent, s: ShortcutDef): boolean {
  const key = e.key.toLowerCase();
  if (key !== s.key.toLowerCase()) return false;
  const mod = e.ctrlKey || e.metaKey;
  if (!!s.mod !== mod) return false;
  if (!!s.shift !== e.shiftKey) return false;
  if (s.when && !s.when()) return false;
  const target = e.target as HTMLElement | null;
  const inField =
    target &&
    (target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      target.isContentEditable);
  if (inField && !s.mod) return false;
  return true;
}

/** Descrição legível de um atalho (ex.: "Ctrl+K", "Shift+D", "?"). */
export function shortcutLabel(s: ShortcutDef): string {
  const parts: string[] = [];
  if (s.mod) parts.push(navigator.platform.toLowerCase().includes("mac") ? "⌘" : "Ctrl");
  if (s.shift) parts.push("Shift");
  parts.push(s.key.length === 1 ? s.key.toUpperCase() : s.key);
  return parts.join("+");
}

/* ----------------------------------------------------- textos padrão --- */

/** Mensagens de erro acionáveis (diagnosticar + recuperar). */
export const UX_COPY = {
  network: "Não foi possível conectar. Verifique sua internet e tente novamente.",
  serverDown: "O servidor local não respondeu. Inicie-o com `npm run dev:server` e tente novamente.",
  aiDisabled: "A IA está desativada. Ative-a em Configurações → Inteligência Artificial.",
  noApps: "Nenhum app no escopo. Colete apps pela busca ou selecione na aba Apps.",
  emptyDataset: "Nada coletado ainda. Busque um app para começar.",
  cancelled: "Ação cancelada.",
} as const;

/**
 * `document.title` dinâmico por página — o usuário sempre sabe onde está,
 * inclusive com várias abas abertas (visibilidade de status do sistema).
 * `running=true` mostra um ● indicador quando há tarefa em andamento.
 */
export function setDocumentTitle(title?: string, opts?: { running?: boolean }): void {
  if (typeof document === "undefined") return;
  const base = "App Review Intelligence";
  const dot = opts?.running ? "● " : "";
  document.title = title ? `${dot}${title} · ${base}` : base;
}
