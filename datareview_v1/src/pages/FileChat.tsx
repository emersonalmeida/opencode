import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Paperclip, Send, Square, FileText,
  FolderOpen, MessageSquare,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PageTabsSidebar } from "@/components/PageTabsSidebar";
import { AIOutputCard } from "@/components/shared/AIOutputCard";
import { OriginBadge } from "@/components/shared/OriginBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { FilesPanel } from "@/components/shared/FilesPanel";
import { useSmartAutoScroll } from "@/hooks/useSmartAutoScroll";
import { streamExperimentChat, type ChatMessage } from "@/lib/experimentChatApi";
import { getAISettings, isAIEnabled } from "@/lib/aiSettings";
import { useDataset } from "@/hooks/useDataset";
import { useSelection, entryKey } from "@/context/SelectionContext";
import { useUserFiles, filesContextBlock, fileToUserFile, addUserFile } from "@/lib/userFiles";
import { saveSession, getSession } from "@/lib/chatHistoryStore";
import { toast } from "sonner";

/**
 * Chat com arquivos (`/chat-arquivos`) — conversa com a IA enriquecida pelos
 * arquivos do usuário (CSV/TXT/MD/JSON…). Os arquivos ficam guardados na
 * aba Apps (dado do usuário) e entram como contexto em cada pergunta.
 */
export default function FileChat() {
  const { entries: dataset } = useDataset();
  const { selected } = useSelection();
  const files = useUserFiles();
  const [searchParams, setSearchParams] = useSearchParams();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { ref: scrollRef, onScroll, atBottom, showJump, resumeFollow, scrollToBottom } = useSmartAutoScroll<HTMLDivElement>([messages.length, streaming]);

  const ai = getAISettings();
  const scope = useMemo(() => {
    if (selected.size === 0) return dataset;
    return dataset.filter((e) => selected.has(entryKey(e.app.store, e.app.id)));
  }, [dataset, selected]);

  // Restaura sessão salva via ?session=<id> (só sessões origin="files").
  useEffect(() => {
    const sid = searchParams.get("session");
    if (!sid || sid === sessionId) return;
    const s = getSession(sid);
    if (s && (s.origin === "files")) {
      setMessages(s.messages);
      setSessionId(s.id);
    }
  }, [searchParams, sessionId]);

  // Persiste a conversa completa (após cada resposta finalizada).
  useEffect(() => {
    if (streaming || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.role !== "assistant") return;
    const sid = saveSession(sessionId, messages, Array.from(selected), "files");
    if (sid !== sessionId) setSessionId(sid);
  }, [messages, streaming]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = useCallback(async (text: string) => {
    const t = text.trim();
    if (!t || streaming) return;
    if (!isAIEnabled(ai)) {
      toast.error("IA desativada — ative em Configurações → Inteligência Artificial.");
      return;
    }
    resumeFollow();
    const next: ChatMessage[] = [...messages, { role: "user", content: t }];
    setMessages(next);
    setInput("");
    setStreaming(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const ctx = filesContextBlock(files);
    let acc = "";
    await streamExperimentChat(scope, next, {
      onToken: (full) => {
        acc = full;
        setMessages([...next, { role: "assistant", content: full }]);
      },
      onDone: (full) => {
        setMessages([...next, { role: "assistant", content: full }]);
        setStreaming(false);
      },
      onError: (err) => {
        setMessages([...next, { role: "assistant", content: `⚠️ ${err}` }]);
        setStreaming(false);
      },
    }, ctrl.signal, ai, "custom", ctx || undefined);
    void acc;
  }, [messages, streaming, ai, scope, files, resumeFollow]);

  const stop = () => {
    abortRef.current?.abort();
    setStreaming(false);
  };

  const newChat = () => {
    setMessages([]);
    setSessionId(null);
    setSearchParams({});
  };

  const onPickFiles = async (list: FileList | null) => {
    if (!list) return;
    for (const f of Array.from(list)) {
      const parsed = await fileToUserFile(f);
      addUserFile(parsed);
      toast.success(`Arquivo "${f.name}" adicionado`, { description: parsed.note ?? "Texto extraído para a IA." });
    }
  };

  return (
    <div className="h-screen flex flex-col min-h-0">
      <AppHeader
        title="Chat com arquivos"
        crumb={files.length > 0 ? `${files.length} arquivo(s) no contexto` : "anexe arquivos para dar contexto à IA"}
      />
      <PageTabsSidebar
        id="filechat"
        side="right"
        title="Chat com arquivos"
        icon={<FolderOpen className="h-4 w-4" />}
        storageKey="aso:filechat-right-w"
        defaultWidth={300}
        helpTab={{
          description: "Converse com a IA usando seus arquivos como contexto.",
          tips: [
            "Anexe CSV, TXT, MD ou JSON — o texto é extraído e enviado junto da pergunta.",
            "Os arquivos ficam guardados na aba Apps (dado do usuário) e podem ser removidos a qualquer momento.",
            "As conversas ficam no histórico global, marcadas como 'Arquivos'.",
          ],
        }}
        tabs={[
          { id: "arquivos", label: "Arquivos", icon: <FileText className="h-3.5 w-3.5" />, content: <FilesPanel /> },
        ]}
      />
      <div className="flex-1 min-h-0 flex flex-col max-w-3xl w-full mx-auto px-4">
        {messages.length === 0 ? (
          <div className="flex-1 grid place-items-center">
            <EmptyState
              icon={MessageSquare}
              title="Converse com a IA sobre seus arquivos"
              description="Anexe arquivos (painel Arquivos à direita) e pergunte — a IA lê o conteúdo extraído como contexto. Apps coletados também entram no escopo."
            />
          </div>
        ) : (
          <div className="flex-1 min-h-0 relative">
            <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto py-4 space-y-4" role="log" aria-live="polite" aria-label="Conversa">
              {messages.map((m, i) => (
                <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
                  {m.role === "user" ? (
                    <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary/10 border border-primary/20 px-4 py-2.5">
                      <div className="flex items-center gap-2 mb-1">
                        <OriginBadge origin="user" short />
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                    </div>
                  ) : (
                    <AIOutputCard
                      bare
                      content={m.content}
                      streaming={streaming && i === messages.length - 1}
                      filename={`chat-arquivos-${i}`}
                      storageKey={`filechat:${sessionId ?? "draft"}:${i}`}
                    />
                  )}
                </div>
              ))}
            </div>
            {showJump && (
              <button
                onClick={() => scrollToBottom(true)}
                className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-secondary border border-border px-3 py-1 text-[10px] shadow-lg"
              >
                ↓ Recentes
              </button>
            )}
          </div>
        )}

        <div className="flex-shrink-0 border-t border-border/50 py-3">
          {files.length > 0 && (
            <p className="text-[10px] text-muted-foreground mb-1.5 flex items-center gap-1.5" role="status">
              <Paperclip className="h-3 w-3" /> {files.length} arquivo(s) entram como contexto
            </p>
          )}
          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              aria-label="Anexar arquivos"
              onChange={(e) => { void onPickFiles(e.target.files); e.target.value = ""; }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 rounded-xl border border-border/60 hover:bg-secondary transition-colors"
              title="Anexar arquivos ao contexto"
              aria-label="Anexar arquivos ao contexto"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(input); } }}
              placeholder={files.length > 0 ? "Pergunte sobre seus arquivos…" : "Anexe arquivos ou pergunte sobre os apps coletados…"}
              rows={1}
              className="flex-1 resize-none rounded-xl border border-border/60 bg-secondary/40 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
              aria-label="Mensagem"
            />
            {streaming ? (
              <button onClick={stop} className="p-2.5 rounded-xl bg-destructive/10 text-destructive border border-destructive/30" title="Parar" aria-label="Parar geração">
                <Square className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={() => void send(input)}
                disabled={!input.trim()}
                className="p-2.5 rounded-xl bg-primary text-primary-foreground disabled:opacity-40"
                title="Enviar"
                aria-label="Enviar mensagem"
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <button onClick={newChat} className="text-[10px] text-muted-foreground hover:text-foreground">Nova conversa</button>
            <span className="text-[10px] text-muted-foreground">{scope.length} app(s) no escopo</span>
          </div>
        </div>
      </div>
    </div>
  );
}
