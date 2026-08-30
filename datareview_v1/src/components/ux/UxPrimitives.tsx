/**
 * Primitivos de UX compartilhados — acessibilidade e feedback consistentes.
 */
import { type ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, AlertCircle, RefreshCw, Keyboard, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { shortcutLabel, type ShortcutDef } from "@/lib/ux";

/**
 * Skip link — primeiro elemento focável da página. Permite que usuários de
 * teclado/leitor de tela pulem a navegação direto para o conteúdo (WCAG
 * 2.4.1 Bypass Blocks). Fica invisível até receber foco.
 */
export function SkipLink() {
  return (
    <a
      href="#conteudo-principal"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-md focus:bg-primary focus:text-primary-foreground focus:text-sm focus:font-medium focus:shadow-lg focus:outline-none"
    >
      Pular para o conteúdo
    </a>
  );
}

/**
 * Região de status acessível — anuncia mudanças para leitores de tela sem
 * tirar o foco. Use para contagens, resultados de busca e feedbacks.
 */
export function LiveStatus({ message, className }: { message: string; className?: string }) {
  return (
    <p role="status" aria-live="polite" className={cn("text-xs text-muted-foreground", className)}>
      {message}
    </p>
  );
}

/**
 * Estado de carregamento com rótulo — visibilidade de status consistente.
 */
export function BusyIndicator({ label, className }: { label: string; className?: string }) {
  return (
    <span role="status" className={cn("inline-flex items-center gap-2 text-sm text-muted-foreground", className)}>
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

interface ErrorBoxProps {
  /** O que aconteceu (diagnóstico claro). */
  message: string;
  /** Como resolver (recuperação). */
  hint?: string;
  /** Tenta de novo (recuperação de erro). */
  onRetry?: () => void;
  className?: string;
}

/**
 * Caixa de erro acionável — explica o problema e indica como resolver
 * (reconhecer, diagnosticar e recuperar-se de erros).
 */
export function ErrorBox({ message, hint, onRetry, className }: ErrorBoxProps) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-lg border border-destructive/40 bg-destructive/10 p-3 flex items-start gap-2.5",
        className,
      )}
    >
      <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-destructive">{message}</p>
        {hint && <p className="text-xs text-destructive/80 mt-0.5">{hint}</p>}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-destructive hover:underline"
        >
          <RefreshCw className="h-3 w-3" aria-hidden="true" /> Tentar novamente
        </button>
      )}
    </div>
  );
}

interface ShortcutsDialogProps {
  shortcuts: ShortcutDef[];
  open: boolean;
  onClose: () => void;
  title?: string;
}

/**
 * Central de atalhos — ajuda/descobribilidade: lista tudo que o usuário
 * avançado pode fazer pelo teclado. Aberta com "?".
 */
export function ShortcutsDialog({ shortcuts, open, onClose, title = "Atalhos de teclado" }: ShortcutsDialogProps) {
  if (!open) return null;
  const groups = new Map<string, ShortcutDef[]>();
  for (const s of shortcuts) {
    const g = s.group ?? "Geral";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(s);
  }
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-primary" aria-hidden="true" /> {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Fechar atalhos"
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {Array.from(groups.entries()).map(([group, items]) => (
            <div key={group}>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1.5">{group}</p>
              <div className="space-y-1">
                {items.map((s) => (
                  <div key={s.key + (s.mod ? "+mod" : "") + (s.shift ? "+shift" : "")} className="flex items-center justify-between gap-3 py-1">
                    <span className="text-sm text-muted-foreground">{s.label}</span>
                    <kbd className="shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono">
                      {shortcutLabel(s)}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground/70 mt-3 pt-2 border-t border-border/50">
          Pressione <kbd className="rounded border border-border bg-muted px-1 font-mono">?</kbd> a qualquer momento para abrir/fechar.
        </p>
      </div>
    </div>
  );
}

/** Botão de link consistente para CTAs de empty state. */
export function EmptyAction({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
    >
      {children}
    </Link>
  );
}

/** Hook de estado para a central de atalhos ("?"). */
export function useShortcutsDialogState(): [boolean, () => void, () => void] {
  const [open, setOpen] = useState(false);
  return [open, () => setOpen((v) => !v), () => setOpen(false)];
}
