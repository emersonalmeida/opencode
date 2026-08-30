/**
 * Nexus OS — console/CLI compartilhado (sidebar direita + foco via Ctrl+K).
 *
 * Renderiza o histórico de linhas (entrada do usuário, saída, ok, erro,
 * sistema) com cores por tipo, e um input com AUTOCOMPLETE de comandos:
 * digitando "/" lista os comandos que batem com o prefixo (setas navegam,
 * Tab/Enter completa, Esc fecha). Entrada sem "/" vai para a IA.
 *
 * Micro interações: auto-scroll para a última linha, "⌘K" para focar,
 * placeholder orientativo. Acessível: role="log" no histórico, aria-label
 * no input, navegação por teclado no autocomplete.
 */
import { forwardRef, useMemo, useRef, useState } from "react";
import { ChevronRight, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSmartAutoScroll } from "@/hooks/useSmartAutoScroll";
import { matchCommands } from "@/lib/os/commands";
import type { ConsoleLine } from "@/lib/os/types";

const KIND_CLASS: Record<ConsoleLine["kind"], string> = {
  in: "text-foreground font-medium",
  out: "text-muted-foreground",
  ok: "text-emerald-600 dark:text-emerald-400",
  err: "text-destructive",
  sys: "text-primary/80 italic",
};

export interface OSConsoleProps {
  lines: ConsoleLine[];
  onSubmit: (text: string) => void;
  busy?: boolean;
  compact?: boolean;
}

export const OSConsole = forwardRef<HTMLInputElement, OSConsoleProps>(function OSConsole(
  { lines, onSubmit, busy, compact },
  inputRef,
) {
  const [value, setValue] = useState("");
  const [selIdx, setSelIdx] = useState(0);
  const [open, setOpen] = useState(false);
  const localRef = useRef<HTMLInputElement>(null);
  const ref = (inputRef as React.RefObject<HTMLInputElement>) ?? localRef;

  const suggestions = useMemo(
    () => (value.startsWith("/") ? matchCommands(value).slice(0, 6) : []),
    [value],
  );

  // Auto-scroll inteligente: segue a última linha só se o usuário já estava
  // no fim — rolar para cima (lendo saídas antigas) nunca é interrompido.
  const scroll = useSmartAutoScroll<HTMLDivElement>([lines]);

  const submit = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    onSubmit(t);
    setValue("");
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (open && suggestions.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSelIdx((i) => (i + 1) % suggestions.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setSelIdx((i) => (i - 1 + suggestions.length) % suggestions.length); return; }
      if (e.key === "Tab" || (e.key === "Enter" && !suggestions[selIdx].usage.includes("<"))) {
        // Tab sempre completa; Enter completa comandos sem argumentos.
        e.preventDefault();
        const cmd = suggestions[selIdx];
        setValue(cmd.usage.includes("<") ? `/${cmd.id} ` : `/${cmd.id}`);
        setOpen(false);
        if (!cmd.usage.includes("<")) submit(`/${cmd.id}`);
        return;
      }
      if (e.key === "Escape") { setOpen(false); return; }
    }
    if (e.key === "Enter") submit(value);
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-background/60">
      {/* Histórico */}
      <div
        ref={scroll.ref}
        onScroll={scroll.onScroll}
        role="log"
        aria-label="Histórico do console"
        className="flex-1 min-h-0 overflow-y-auto px-2.5 py-2 font-mono text-[11px] leading-relaxed space-y-0.5"
      >
        {lines.map((l, i) => (
          <div key={`${l.ts}-${i}`} className={cn("whitespace-pre-wrap break-words", KIND_CLASS[l.kind])}>
            {l.kind === "in" && <span className="text-primary mr-1">❯</span>}
            {l.text}
          </div>
        ))}
        {busy && (
          <div className="text-muted-foreground animate-pulse">processando…</div>
        )}
      </div>

      {/* Input + autocomplete */}
      <div className="relative border-t border-border/50 flex-shrink-0">
        {open && suggestions.length > 0 && (
          <div
            role="listbox"
            aria-label="Sugestões de comando"
            className="absolute bottom-full left-0 right-0 mb-1 mx-2 rounded-lg border border-border bg-popover shadow-xl overflow-hidden z-20"
          >
            {suggestions.map((c, i) => (
              <button
                key={c.id}
                role="option"
                aria-selected={i === selIdx}
                onMouseDown={(e) => { e.preventDefault(); setValue(`/${c.id} `); setOpen(false); ref.current?.focus(); }}
                className={cn(
                  "w-full flex items-center gap-2 px-2.5 py-1.5 text-left transition-colors",
                  i === selIdx ? "bg-primary/10" : "hover:bg-secondary/60",
                )}
              >
                <Terminal className="h-3 w-3 text-primary flex-shrink-0" />
                <span className="font-mono text-[11px] text-foreground">{c.usage}</span>
                <span className="text-[10px] text-muted-foreground truncate">{c.description}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1.5 px-2.5 py-2">
          <ChevronRight className="h-3.5 w-3.5 text-primary flex-shrink-0" aria-hidden />
          <input
            ref={ref}
            value={value}
            onChange={(e) => { setValue(e.target.value); setOpen(true); setSelIdx(0); }}
            onKeyDown={onKeyDown}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            disabled={busy}
            aria-label="Console do OS — digite / para comandos ou texto para a IA"
            placeholder={compact ? "/comando ou pergunta…" : "Digite /help, /stats, /analyze problems… ou pergunte à IA"}
            className="flex-1 bg-transparent font-mono text-[11px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none disabled:opacity-50"
          />
          <kbd className="hidden sm:block text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground font-mono" title="Atalho para focar o console">⌃K</kbd>
        </div>
      </div>
    </div>
  );
});
