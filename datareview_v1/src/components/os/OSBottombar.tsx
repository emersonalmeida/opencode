/**
 * Nexus OS — bottombar: dock de chat com IA + ferramentas da IA.
 *
 * É o canal de linguagem natural do OS (o console é o canal CLI). Mostra:
 *  - chips proativos (sugestões geradas pelo motor de aprendizado);
 *  - histórico da conversa com streaming ao vivo (Markdown + copiar/baixar);
 *  - composer com botão de parar durante o streaming;
 *  - escopo atual (quantos apps/reviews a IA está vendo).
 *
 * Colapsável (persistido em `aso:os-bottombar-open`) — nasce aberta.
 */
import { useEffect, useState } from "react";
import {
  ChevronDown, ChevronUp, Loader2, Send, Sparkles, Square, Trash2,
} from "lucide-react";
import { AIOutputCard } from "@/components/shared/AIOutputCard";
import { useSmartAutoScroll } from "@/hooks/useSmartAutoScroll";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/experimentChatApi";

const OPEN_KEY = "aso:os-bottombar-open";

function loadOpen(): boolean {
  try { return localStorage.getItem(OPEN_KEY) !== "0"; } catch { return true; }
}

export interface OSBottombarProps {
  messages: ChatMessage[];
  streaming: boolean;
  aiOn: boolean;
  /** Chips proativos (insights/comandos frequentes) — clicável envia/roda. */
  suggestions: string[];
  scopeLabel: string;
  onSend: (text: string) => void;
  onStop: () => void;
  onClear: () => void;
  /** Chamado quando um chip de comando ("/…") é clicado — vai para o console. */
  onCommand: (cmd: string) => void;
}

export function OSBottombar({
  messages, streaming, aiOn, suggestions, scopeLabel, onSend, onStop, onClear, onCommand,
}: OSBottombarProps) {
  const [open, setOpen] = useState(loadOpen);
  const [value, setValue] = useState("");
  // Auto-scroll inteligente (hook compartilhado): o usuário pode rolar para
  // cima durante a geração sem ser puxado de volta ao fim.
  const chatScroll = useSmartAutoScroll<HTMLDivElement>([messages, streaming]);

  useEffect(() => {
    try { localStorage.setItem(OPEN_KEY, open ? "1" : "0"); } catch { /* ignore */ }
  }, [open]);

  const send = () => {
    const t = value.trim();
    if (!t || streaming) return;
    onSend(t);
    setValue("");
    if (!open) setOpen(true);
  };

  return (
    <footer className="border-t border-border/50 bg-card/60 backdrop-blur-sm flex-shrink-0">
      {/* Header do dock */}
      <div className="flex items-center gap-2 px-3 h-9">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-[11px] font-semibold text-foreground">Assistente do OS</span>
          <span className="text-[9px] text-muted-foreground hidden sm:inline">{scopeLabel}</span>
        </div>

        {/* Chips proativos */}
        <div className="flex-1 flex items-center gap-1 overflow-x-auto px-2" aria-label="Sugestões proativas">
          {suggestions.slice(0, 4).map((s) => (
            <button
              key={s}
              onClick={() => (s.startsWith("/") ? onCommand(s) : (setValue(s), setOpen(true)))}
              className="flex-shrink-0 px-2 py-0.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-[10px] hover:bg-primary/10 transition-colors"
              title={s.startsWith("/") ? "Executar no console" : "Perguntar à IA"}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-0.5">
          {streaming && (
            <button
              onClick={onStop}
              aria-label="Parar geração"
              title="Parar"
              className="p-1.5 rounded-md text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Square className="h-3.5 w-3.5" />
            </button>
          )}
          {messages.length > 0 && !streaming && (
            <button
              onClick={onClear}
              aria-label="Limpar conversa"
              title="Limpar conversa"
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Recolher assistente" : "Expandir assistente"}
            aria-expanded={open}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border/40">
          {/* Mensagens */}
          <div ref={chatScroll.ref} onScroll={chatScroll.onScroll} className="h-44 overflow-y-auto px-3 py-2 space-y-2" role="log" aria-label="Conversa com o assistente">
            {messages.length === 0 ? (
              <p className="text-[11px] text-muted-foreground py-3 text-center">
                {aiOn
                  ? "Pergunte qualquer coisa sobre os dados coletados — ou digite /comandos no console (⌃K)."
                  : "IA desativada. Ative em Configurações → Inteligência Artificial para conversar."}
              </p>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "relative max-w-[80%] rounded-xl px-3 py-2",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary/60 border border-border/50",
                    )}
                  >
                    {m.role === "user" ? (
                      <p className="text-xs whitespace-pre-wrap">{m.content}</p>
                    ) : (
                      <AIOutputCard bare content={m.content} filename="resposta-os" storageKey={`os-chat-${i}`} />
                    )}
                  </div>
                </div>
              ))
            )}
            {streaming && (
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> gerando…
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="flex items-center gap-1.5 px-3 py-2 border-t border-border/40">
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              disabled={!aiOn || streaming}
              aria-label="Mensagem para o assistente de IA"
              placeholder={aiOn ? "Pergunte à IA sobre os apps e reviews…" : "Ative a IA para conversar"}
              className="flex-1 px-3 py-1.5 rounded-md border border-border/60 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            />
            <button
              onClick={send}
              disabled={!aiOn || streaming || !value.trim()}
              aria-label="Enviar mensagem"
              className="p-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </footer>
  );
}
