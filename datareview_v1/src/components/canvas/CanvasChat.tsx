import { useEffect, useRef, useState } from "react";
import { Send, Loader2, Sparkles, X, Wand2 } from "lucide-react";
import { useCanvasStore } from "@/lib/canvasStore";
import { listDataset, type DatasetEntry } from "@/lib/datasetStore";
import { streamExperiment } from "@/lib/experimentApi";
import { isAIEnabled, useAISettings } from "@/lib/aiSettings";
import { AIOutputCard } from "@/components/shared/AIOutputCard";
import { useSmartAutoScroll } from "@/hooks/useSmartAutoScroll";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * In-canvas AI chat docked on the left edge. It can query the canvas state
 * (selected node outputs, full dataset) and answer questions about the data.
 *
 * O chat monta um resumo compacto do contexto do canvas (tipos de nó, saídas,
 * nó selecionado) mais o dataset coletado, e streama a resposta via a seção
 * "custom" do experiment-analyze. Ações rápidas permitem inserir um nó de
 * relatório ou perguntar sobre o nó selecionado.
 */
export function CanvasChat({ open, onClose }: Props) {
  const { nodes, edges, output, status, selectedNodeId, addNode, runSingleNode } = useCanvasStore();
  const ai = useAISettings();
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "assistant", content: "Olá! Posso responder perguntas sobre o canvas e os dados coletados, ou gerar um relatório. Selecione um nó e pergunte sobre ele, ou peça um relatório executivo." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const { ref: scrollRef, onScroll: handleScroll } = useSmartAutoScroll<HTMLDivElement>([messages, busy]);

  // Auto-scroll inteligente: só puxa para o fim se o usuário já estiver lá —
  // rolar para cima durante a geração nunca é sobrescrito.

  if (!open) return null;

  const enabled = isAIEnabled(ai);

  const buildContext = (question: string): { summary: string; entries: DatasetEntry[] } => {
    const dataset = listDataset();
    const selNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : null;
    const selOutput = selectedNodeId ? output[selectedNodeId] : null;
    const nodeSummary = nodes.map((n) => `${n.data.label} (${n.data.kind})`).join(", ") || "(canvas vazio)";
    const statusSummary = Object.entries(status).map(([id, st]) => {
      const n = nodes.find((x) => x.id === id);
      return n ? `${n.data.label}: ${st}` : null;
    }).filter(Boolean).join("; ");
    const selText = selNode
      ? `Nó selecionado: "${selNode.data.label}" (${selNode.data.kind}). Saída: ${selOutput == null ? "nenhuma" : JSON.stringify(selOutput).slice(0, 400)}`
      : "Nenhum nó selecionado.";
    const summary = `Canvas: ${nodes.length} nó(s) [${nodeSummary}]. Conexões: ${edges.length}. Status: ${statusSummary}. ${selText}\n\nPergunta do usuário: ${question}`;
    return { summary, entries: dataset };
  };

  const send = async (question: string) => {
    if (!question.trim() || busy || !enabled) return;
    const next = [...messages, { role: "user" as const, content: question }];
    setMessages(next);
    setInput("");
    setBusy(true);
    const { summary, entries } = buildContext(question);
    // Se há dados no dataset, usa o endpoint de experimento com streaming;
    // senão, responde apenas com base no resumo do estado do canvas.
    let answer = "";
    const assistantMsg = { role: "assistant" as const, content: "" };
    setMessages([...next, assistantMsg]);
    try {
      if (entries.length > 0) {
        await streamExperiment("custom", entries, {
          onToken: (full) => { answer = full; setMessages((m) => { const copy = [...m]; copy[copy.length - 1] = { ...assistantMsg, content: answer }; return copy; }); },
          onDone: (full) => { answer = full; },
          onError: (err) => { throw new Error(err); },
        });
      } else {
        // No dataset — answer generically about the canvas state.
        answer = `Não há apps coletados no dataset ainda para eu analisar. O canvas tem ${nodes.length} nó(s). Colete apps (nó Buscar → Coletar) ou adicione um nó Dataset, e poderei responder com base nos dados.\n\nEstado do canvas: ${summary}`;
        setMessages((m) => { const copy = [...m]; copy[copy.length - 1] = { ...assistantMsg, content: answer }; return copy; });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao gerar resposta.";
      setMessages((m) => { const copy = [...m]; copy[copy.length - 1] = { ...assistantMsg, content: `⚠️ ${msg}` }; return copy; });
    } finally {
      setBusy(false);
    }
  };

  const insertReportNode = () => {
    addNode("report", { x: 80 + Math.random() * 100, y: 80 + Math.random() * 100 });
  };

  return (
    <div className="absolute top-3 left-3 z-20 w-80 max-w-[80vw] max-h-[70vh] flex flex-col rounded-xl border border-border/60 bg-card shadow-xl" role="region" aria-label="Chat de IA do canvas">
      <header className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-xs font-semibold text-foreground flex-1">Chat IA do canvas</h3>
        <button onClick={insertReportNode} className="text-[10px] flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20" title="Adicionar nó de Relatório IA">
          <Wand2 className="h-3 w-3" /> Relatório
        </button>
        <button onClick={onClose} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary" aria-label="Fechar chat">
          <X className="h-3.5 w-3.5" />
        </button>
      </header>

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2.5">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[88%] rounded-lg px-2.5 py-1.5 text-[11px] leading-relaxed ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
              {m.role === "assistant"
                ? <AIOutputCard bare content={m.content} filename={`canvas-chat-${i}`} storageKey={`canvas-chat-${i}`} />
                : m.content}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-lg px-2.5 py-1.5 bg-secondary text-secondary-foreground flex items-center gap-1 text-[11px]">
              <Loader2 className="h-3 w-3 animate-spin" /> Gerando…
            </div>
          </div>
        )}
      </div>

      <div className="p-2.5 border-t border-border/50">
        {!enabled && <p className="text-[10px] text-muted-foreground mb-1.5">Ative a IA em Configurações → Inteligência Artificial para conversar.</p>}
        <div className="flex items-end gap-1.5">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder={enabled ? "Pergunte sobre o canvas ou os dados…" : "IA desativada"}
            disabled={!enabled || busy}
            rows={1}
            className="flex-1 min-h-[36px] max-h-24 text-[11px] px-2 py-1.5 rounded-md bg-background border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none disabled:opacity-50"
          />
          <button
            onClick={() => send(input)}
            disabled={!enabled || busy || !input.trim()}
            className="p-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 shrink-0"
            aria-label="Enviar pergunta"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
