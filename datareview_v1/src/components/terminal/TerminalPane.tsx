/**
 * TerminalPane — uma sessão CLI completa (log + input com autocomplete e
 * histórico). O Terminal renderiza N panes lado a lado (tmux-style splits)
 * ou como abas (tabs). A execução delega para `onExecute`, que roda o motor
 * de comandos do OS (`src/lib/os/commands.ts`) e escreve no buffer do pane.
 */
import { useEffect, useRef, useState } from "react";
import { Square, X, Columns2, Rows2 } from "lucide-react";
import { matchCommands } from "@/lib/os/commands";
import type { ConsoleLine } from "@/lib/os/types";
import { useSmartAutoScroll } from "@/hooks/useSmartAutoScroll";

export interface PaneProps {
  paneId: string;
  title: string;
  lines: ConsoleLine[];
  busy: boolean;
  prompt: string;
  onExecute: (input: string) => void;
  onClear: () => void;
  onClosePane: () => void;
  onSplitH: () => void;
  onSplitV: () => void;
  autoFocus: boolean;
}

const KIND_COLOR: Record<ConsoleLine["kind"], string> = {
  in: "text-cyan-300",
  out: "text-slate-300",
  ok: "text-emerald-400",
  err: "text-rose-400",
  sys: "text-amber-300",
};

export function TerminalPane({
  paneId,
  title,
  lines,
  busy,
  prompt,
  onExecute,
  onClear,
  onClosePane,
  onSplitH,
  onSplitV,
  autoFocus,
}: PaneProps) {
  const [input, setInput] = useState("");
  const [matches, setMatches] = useState<ReturnType<typeof matchCommands>>([]);
  const [mIndex, setMIndex] = useState(0);
  const [history, setHistory] = useState<string[]>([]);
  const [hIndex, setHIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const { ref: logRef, onScroll: handleLogScroll } = useSmartAutoScroll<HTMLDivElement>([lines]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // Auto-scroll inteligente: só acompanha o fim se o usuário já estiver lá.

  // Autocomplete só sobre "/<prefixo>"
  useEffect(() => {
    if (input.startsWith("/")) {
      setMatches(matchCommands(input));
      setMIndex(0);
    } else if (matches.length > 0) {
      setMatches([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  function submit(value?: string) {
    const v = (value ?? input).trim();
    if (!v) return;
    setHistory((h) => [...h, v]);
    setHIndex(-1);
    setInput("");
    setMatches([]);
    onExecute(v);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (matches.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMIndex((i) => (i + 1) % matches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMIndex((i) => (i - 1 + matches.length) % matches.length);
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        setInput(`${matches[mIndex].usage.split(" ")[0]} `);
        return;
      }
    }
    if (matches.length === 0 && e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length === 0) return;
      const next = hIndex < 0 ? history.length - 1 : Math.max(0, hIndex - 1);
      setHIndex(next);
      setInput(history[next]);
      return;
    }
    if (matches.length === 0 && e.key === "ArrowDown") {
      e.preventDefault();
      if (hIndex < 0) return;
      const next = hIndex + 1;
      if (next >= history.length) {
        setHIndex(-1);
        setInput("");
      } else {
        setHIndex(next);
        setInput(history[next]);
      }
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
      return;
    }
    if (e.ctrlKey && e.key.toLowerCase() === "l") {
      e.preventDefault();
      onClear();
    }
  }

  return (
    <div
      className="flex flex-col h-full min-h-0 min-w-0 bg-card border border-slate-700/60 rounded-lg overflow-hidden shadow-lg"
      onClick={() => inputRef.current?.focus()}
    >
      {/* header estilo tmux */}
      <div
        className="flex items-center gap-1 px-2 py-1 bg-slate-800/80 border-b border-slate-700/50 text-[11px] font-mono select-none"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-cyan-400 font-semibold">{prompt}</span>
        <span className="truncate text-slate-400">{title}</span>
        <span className="flex-1" />
        <button
          onClick={onSplitH}
          title="Dividir horizontalmente"
          aria-label="Dividir horizontalmente"
          className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-cyan-300"
        >
          <Columns2 className="h-3 w-3" />
        </button>
        <button
          onClick={onSplitV}
          title="Dividir verticalmente"
          aria-label="Dividir verticalmente"
          className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-cyan-300"
        >
          <Rows2 className="h-3 w-3" />
        </button>
        <button
          onClick={onClosePane}
          title="Fechar pane"
          aria-label="Fechar pane"
          className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-300"
        >
          <X className="h-3 w-3" />
        </button>
        <Square className="h-2.5 w-2.5 text-slate-600" aria-hidden="true" />
      </div>

      {/* log */}
      <div
        ref={logRef}
        onScroll={handleLogScroll}
        className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-[1.5] space-y-[1px]"
        role="log"
        aria-live="polite"
      >
        {lines.map((l, i) => (
          <p key={i} className={`${KIND_COLOR[l.kind]} whitespace-pre-wrap break-words`}>
            {l.kind === "in" ? `${prompt} ${l.text}` : l.text}
          </p>
        ))}
        {busy && (
          <p className="text-slate-500">
            <span className="inline-block animate-spin">⠾</span> executando…
          </p>
        )}
      </div>

      {/* input */}
      <div
        className="relative flex items-center gap-1 px-3 py-1.5 border-t border-slate-700/50 bg-slate-900/60"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-cyan-400 font-mono text-[11px] shrink-0">{prompt}</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          spellCheck={false}
          autoComplete="off"
          autoFocus={autoFocus}
          aria-label="Entrada do terminal"
          className="flex-1 bg-transparent outline-none border-none font-mono text-[11px] text-slate-100 caret-cyan-300 min-w-0"
          placeholder='digite "/" p/ comando ou texto p/ IA (Enter roda)'
        />
      </div>

      {/* autocomplete */}
      {matches.length > 0 && (
        <div
          className="absolute bottom-full mb-0.5 left-3 right-3 bg-slate-800/95 border border-slate-600/60 rounded-md p-1 shadow-xl z-10"
          role="listbox"
          aria-label="Sugestões de comandos"
        >
          {matches.slice(0, 6).map((m, i) => (
            <button
              key={m.id}
              role="option"
              aria-selected={i === mIndex}
              onMouseDown={(e) => {
                e.preventDefault();
                submit(m.usage.split(" ")[0]);
              }}
              className={`w-full text-left px-2 py-1 rounded font-mono text-[10px] flex items-baseline gap-2 ${
                i === mIndex ? "bg-cyan-500/20 text-cyan-200" : "text-slate-300 hover:bg-slate-700/70"
              }`}
            >
              <span className="text-cyan-400">{m.usage}</span>
              <span className="text-[9px] text-slate-500">{m.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
