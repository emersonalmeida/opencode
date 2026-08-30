import { useState, useRef, useEffect } from "react";
import { Sparkles, X, Send, Loader2, Wand2 } from "lucide-react";
import { useDesignStore, useVisibleNodes, useVisibleEdges } from "@/lib/designCanvas/store";
import { resolveMeta } from "@/lib/designCanvas/registry";
import { streamExperimentChat, type ChatMessage } from "@/lib/experimentChatApi";
import { isAIEnabled, useAISettings } from "@/lib/aiSettings";
import { AIOutputCard } from "@/components/shared/AIOutputCard";
import { GENERATE_SYSTEM_PROMPT, parseGenerateResult } from "@/lib/designCanvas/aiOps";
import { useSmartAutoScroll } from "@/hooks/useSmartAutoScroll";
import { AIDisabledNotice } from "@/components/shared/AIDisabledNotice";

const SUGGESTIONS = [
  "Crie um dashboard com 4 KPIs e um gráfico de notas.",
  "Adicione uma lista de reviews recentes + word cloud.",
  "Monte um comparativo com cards de 3 apps e análise de IA.",
  "Avalie acessibilidade dos componentes no board.",
];

/** Builds a compact textual description of the current board for the AI. */
function buildBoardContext(): string {
  const nodes = useVisibleNodes.length ? useDesignStore.getState().nodes.filter((n) => (n.data.board ?? "board_main") === useDesignStore.getState().activeBoard) : [];
  const edges = useVisibleEdges.length ? useDesignStore.getState().edges : [];
  const lines = nodes.map((n) => {
    const meta = resolveMeta(n.data.kind);
    const props = Object.entries(n.data.props).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(", ");
    return `- ${n.data.label ?? meta.label} [${meta.kind}] ${props}`;
  });
  const flows = edges.map((e) => `${e.source.slice(0, 6)}→${e.target.slice(0, 6)} (${e.label ?? "navigate"})`);
  return `Board atual:\nComponentes:\n${lines.join("\n") || "(vazio)"}\nFluxos:\n${flows.join("\n") || "(nenhum)"}`;
}

/**
 * Floating AI copilot dock for the design canvas. Two modes:
 *  - Chat: answers design questions (knows the board state).
 *  - Gerar (build): streams a JSON ops payload that the store applies to add
 *    nodes + wire edges — the copilot doesn't just talk, it BUILDS the page.
 */
export function DesignCanvasAICopilot({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ai = useAISettings();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState("");
  const [busy, setBusy] = useState(false);
  const [buildMode, setBuildMode] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const { ref: scrollRef, onScroll: handleScroll } = useSmartAutoScroll<HTMLDivElement>([messages, streaming]);
  const applyGenerateOps = useDesignStore((s) => s.applyGenerateOps);

  // Auto-scroll inteligente: só acompanha o fim se o usuário já estiver lá.

  if (!open) return null;

  const enabled = isAIEnabled(ai);

  const send = async (text: string) => {
    if (!text.trim() || busy || !enabled) return;
    const userMsg: ChatMessage = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setBusy(true);
    setStreaming("");
    const ac = new AbortController();
    abortRef.current = ac;
    const ctx = buildBoardContext();
    const sysPrompt = buildMode
      ? { role: "user" as const, content: `${GENERATE_SYSTEM_PROMPT}\n\n${ctx}\n\nPedido: ${text}` }
      : { role: "user" as const, content: `Contexto do canvas de design:\n${ctx}\n\nPergunta do designer: ${text}` };
    let acc = "";
    await streamExperimentChat([], [sysPrompt], {
      onToken: (full) => { acc = full; setStreaming(full); },
      onDone: (full) => {
        setStreaming("");
        setBusy(false);
        const final = full || acc;
        if (buildMode) {
          // Faz o parse + aplica as ops, e então resume o que foi construído.
          const { ops, prose } = parseGenerateResult(final);
          const ids = applyGenerateOps(ops);
          const summary = prose || `Construí ${ids.length} elemento(s).`;
          setMessages([...next, { role: "assistant", content: `✅ ${summary}\n\nForam adicionados ${ops.length} componentes ao canvas/página.` }]);
        } else {
          setMessages([...next, { role: "assistant", content: final }]);
        }
      },
      onError: (err) => {
        setStreaming("");
        setBusy(false);
        setMessages([...next, { role: "assistant", content: `⚠️ ${err}` }]);
      },
    }, ac.signal, ai);
  };

  return (
    <div className="absolute top-14 left-3 z-30 w-[340px] max-w-[calc(100vw-1.5rem)] rounded-xl border border-border/70 bg-card shadow-xl flex flex-col max-h-[70vh]">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-primary/5">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-xs font-medium flex-1">Copiloto de design</span>
        <button onClick={() => setBuildMode((b) => !b)} title={buildMode ? "Modo construir ativo" : "Modo construir"}
          aria-pressed={buildMode}
          className={`p-1 rounded-md ${buildMode ? "bg-primary/20 text-primary" : "hover:bg-secondary text-muted-foreground"}`}>
          <Wand2 className="h-3.5 w-3.5" />
        </button>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground rounded p-0.5 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50" aria-label="Fechar copiloto">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {buildMode && (
        <div className="px-3 py-1.5 bg-primary/5 border-b border-border/50 text-[10px] text-primary/90">
          Modo construir: peça para criar páginas/componentes e o copiloto adiciona ao canvas automaticamente.
        </div>
      )}

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2">
        {messages.length === 0 && !streaming && (
          <div className="text-xs text-muted-foreground">
            <p className="mb-2">{buildMode ? "Peça para construir: “crie um dashboard com KPIs e gráfico de notas”." : "Pergunte sobre o design, fluxos, acessibilidade ou peça sugestões."}</p>
            {!enabled && <AIDisabledNotice compact className="mt-2" />}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`text-xs rounded-lg px-2.5 py-1.5 relative ${m.role === "user" ? "bg-primary text-primary-foreground ml-6" : "bg-secondary mr-6"}`}>
            {m.role === "assistant"
              ? <AIOutputCard bare content={m.content} filename={`design-copilot-${i}`} storageKey={`design-copilot-${i}`} />
              : m.content}
          </div>
        ))}
        {streaming && (
          <div className="text-xs rounded-lg px-2.5 py-1.5 bg-secondary mr-6">
            <AIOutputCard bare content={streaming} filename="design-copilot-stream" streaming />
          </div>
        )}
      </div>

      <div className="px-2.5 pt-1.5 border-t border-border/50">
        <div className="flex flex-wrap gap-1 mb-1.5">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => send(s)} disabled={busy || !enabled}
              className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary hover:bg-primary/10 hover:text-primary disabled:opacity-40 transition-colors text-muted-foreground text-left">
              {s.length > 32 ? s.slice(0, 32) + "…" : s}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-1.5 pb-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder={buildMode ? "Peça para construir…" : "Pergunte sobre o design…"}
            rows={1}
            className="flex-1 resize-none text-xs rounded-md border border-border bg-background px-2 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 max-h-24"
            aria-label="Entrada do copiloto de design"
          />
          <button
            onClick={() => send(input)}
            disabled={busy || !enabled || !input.trim()}
            className="h-8 w-8 flex items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            aria-label="Enviar"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
