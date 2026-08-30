import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  MessageSquare, Send, Loader2, Trash2,
  AlertCircle, Square, Sparkles, Database,
  Copy, Check, RefreshCw,
  Download, Search, Clock, Settings2,
  Mic, MicOff,
} from "lucide-react";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { useVoiceSettings } from "@/lib/voice";
import { toastError, setDocumentTitle } from "@/lib/ux";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChatMessageBlock } from "@/components/shared/ChatMessageBlock";
import { ChatScrollGroup } from "@/components/shared/ChatScrollGroup";
import { AIChatShortcuts } from "@/components/shared/AIChatShortcuts";
import { useDataset } from "@/hooks/useDataset";
import { useCompare } from "@/context/CompareContext";
import { useSelection, entryKey } from "@/context/SelectionContext";
import { streamExperimentChat, type ChatMessage } from "@/lib/experimentChatApi";
import { streamExperiment } from "@/lib/experimentApi";
import type { SectionDef } from "@/lib/experimentSections";
import type { PipelineShortcut } from "@/lib/aiChatShared";
import { saveSession, getSession, listSessions } from "@/lib/chatHistoryStore";
import { isAIEnabled, getAISettings, isParallelIA } from "@/lib/aiSettings";
import { appendPlaceholder, patchIndex } from "@/lib/chatStream";
import { downloadFile, useHotkey } from "@/lib/pageFeatures";
import { detectChatIntent } from "@/lib/chatCommands";
import { suggestQuickReplies } from "@/lib/quickReplies";

/** Mensagem do chat estendida com componente embutido (ação sem IA). */
type ChatMsg = ChatMessage & {
  surfaceId?: string; surfaceLabel?: string;
  /** Página real embutida na conversa (intent goto — iframe same-origin). */
  page?: { path: string; label: string };
};

export default function Chat({ embedded = false }: { embedded?: boolean }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { entries } = useDataset();
  const compare = useCompare();
  const { selected, setSelected } = useSelection();

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [isAiDisabled, setIsAiDisabled] = useState(false);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [msgSearch, setMsgSearch] = useState("");

  // Ditado por voz no composer: Web Speech (Chrome) → fallback Whisper local.
  // O texto final entra no input (o usuário revisa antes de enviar).
  const voiceSettings = useVoiceSettings();
  const dictationBaseRef = useRef("");
  const stt = useVoiceInput({
    lang: voiceSettings.lang,
    onFinal: (text) => {
      const base = dictationBaseRef.current;
      setInput((base ? `${base} ` : "") + text);
    },
  });
  useEffect(() => {
    if (stt.error) toastError(stt.error);
  }, [stt.error]);
  // Interim (só webspeech) aparece no input enquanto o usuário fala.
  useEffect(() => {
    if (stt.active && stt.interim) {
      const base = dictationBaseRef.current;
      setInput((base ? `${base} ` : "") + stt.interim);
    }
  }, [stt.active, stt.interim]);
  const toggleDictation = () => {
    if (stt.active) {
      stt.stop();
    } else {
      dictationBaseRef.current = input.trim();
      stt.start();
    }
  };

  // F3: Export conversation
  const exportConversation = useCallback(() => {
    if (messages.length === 0) return;
    const parts: string[] = [`# Conversa — ${new Date().toLocaleString("pt-BR")}`, ""];
    for (const m of messages) {
      parts.push(`## ${m.role === "user" ? "Você" : "Assistente"}`, "", m.content, "");
    }
    downloadFile("conversa-chat.md", parts.join("\n"), "text/markdown");
  }, [messages]);

  // F6: Keyboard shortcut — focus input with "/"
  useHotkey("/", () => textareaRef.current?.focus(), []);

  // F1: Filter messages by search
  const filteredMessages = useMemo(() => {
    if (!msgSearch.trim()) return messages;
    const q = msgSearch.toLowerCase();
    return messages.filter((m) => m.content.toLowerCase().includes(q));
  }, [messages, msgSearch]);

  /** Modo de concorrência: paralelo (vários streams ao mesmo tempo) ou sequencial. */
  const parallel = isParallelIA(getAISettings());
  /** Nº de streams em voo — vários no modo parallel; UI lê `loading` derivado. */
  const [inFlight, setInFlight] = useState(0);
  const loading = inFlight > 0;
  const inFlightRef = useRef(0);
  useEffect(() => { inFlightRef.current = inFlight; }, [inFlight]);
  const incFlight = useCallback(() => setInFlight((n) => n + 1), []);
  const decFlight = useCallback(() => setInFlight((n) => Math.max(0, n - 1)), []);
  /** Todos os AbortController em voo — "Parar" aborta todas as gerações. */
  const abortsRef = useRef<Set<AbortController>>(new Set());
  const abortAll = useCallback(() => {
    for (const c of abortsRef.current) c.abort();
    abortsRef.current.clear();
    setInFlight(0);
  }, []);
  /** Fila FIFO local (thunks) — só usada no modo sequencial. */
  const queueRef = useRef<Array<() => void>>([]);
  /** Drena a fila: modo sequencial + nenhum stream em voo → dispara o próximo. */
  useEffect(() => {
    if (parallel) return;
    if (inFlight === 0 && queueRef.current.length > 0) {
      const t = queueRef.current.shift();
      t?.();
    }
  });
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  // Smart auto-scroll (hook compartilhado): só puxa ao fim quando o usuário
  // JÁ está perto do fim — rolar para cima durante a geração nunca é
  // interrompido. A decisão usa ref, então o stream não re-dispara o efeito.
  // Envio/sugestão/seção dispara o "ir ao fim" via followTrigger do grupo.
  const [followTick, setFollowTick] = useState(0);
  const resumeFollow = useCallback(() => setFollowTick((t) => t + 1), []);

  // Container-aware: o chat adapta a densidade pela LARGURA REAL da coluna
  // central (que encolhe conforme as sidebars abrem), não pelo viewport.
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [chatWidth, setChatWidth] = useState(1200);
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((es) => {
      const w = es[0]?.contentRect.width;
      if (w) setChatWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const tight = chatWidth < 640;

  // Título da aba do navegador reflete a conversa ativa ("Chat · <título>") —
  // volta ao título padrão da página ao iniciar conversa nova/sair do chat.
  const activeTitle = useMemo(() => {
    if (!activeChatId) return null;
    return listSessions().find((sess) => sess.id === activeChatId)?.title ?? null;
  }, [activeChatId, messages.length]);
  useEffect(() => {
    setDocumentTitle(activeTitle ? `Chat · ${activeTitle}` : "Chat");
    return () => setDocumentTitle("Chat");
  }, [activeTitle]);

  const selectedEntries = entries.filter((e) => selected.has(entryKey(e.app.store, e.app.id)));
  const totalReviews = selectedEntries.reduce((s, e) => s + e.reviews.length, 0);

  // Restaura uma conversa salva ao chegar via ?session=<id> (ex.: clicada na
  // aba Chats da sidebar esquerda). Restaura mensagens + a seleção de apps que
  // a conversa usava (apenas keys ainda presentes no dataset).
  useEffect(() => {
    const sid = searchParams.get("session");
    if (!sid) return;
    const session = getSession(sid);
    if (!session) return;
    abortAll();
    queueRef.current = [];
    setError("");
    setMessages(session.messages);
    setActiveChatId(session.id);
    const valid = new Set(entries.map((e) => entryKey(e.app.store, e.app.id)));
    setSelected(session.selectedAppKeys.filter((k) => valid.has(k)));
    // Limpa o param para um refresh não re-disparar um restore obsoleto.
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Auto-grow textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [input]);

  // Persist current conversation to the history store (debounced). A session is
  // only saved once there is at least one user message + a completed assistant
  // reply (not while streaming/loading) to avoid storing partial answers.
  useEffect(() => {
    if (loading) return; // don't persist mid-stream
    if (messages.length === 0) return;
    const hasUser = messages.some((m) => m.role === "user");
    if (!hasUser) return;
    const last = messages[messages.length - 1];
    if (last.role === "assistant" && !last.content) return; // still empty
    const keys = Array.from(selected);
    const id = saveSession(activeChatId, messages, keys);
    if (id !== activeChatId) setActiveChatId(id);
  }, [messages, loading, selected, activeChatId]);

  const runChat = useCallback(
    async (history: ChatMessage[]) => {
      if (selectedEntries.length === 0) return;
      setIsAiDisabled(!isAIEnabled(getAISettings()));
      setError("");
      const controller = new AbortController();
      abortsRef.current.add(controller);
      const idxRef = { current: -1 };
      // Preserva mensagens de streams concorrentes que chegaram depois da
      // montagem deste histórico (extras além do comprimento do history).
      setMessages((prev) => {
        const extras = prev.length > history.length ? prev.slice(history.length) : [];
        return appendPlaceholder([...history, ...extras], idxRef);
      });
      incFlight();
      await streamExperimentChat(
        selectedEntries,
        history,
        {
          onToken: (full) => setMessages((prev) => patchIndex(prev, idxRef.current, full)),
          onDone: (full) => setMessages((prev) => patchIndex(prev, idxRef.current, full)),
          onError: (err) => {
            setError(err);
            setMessages((prev) => patchIndex(prev, idxRef.current, `⚠️ ${err}`));
          },
        },
        controller.signal,
      );
      abortsRef.current.delete(controller);
      decFlight();
      textareaRef.current?.focus();
    },
    [selectedEntries, incFlight, decFlight],
  );

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text) return;
    // Intenção sem IA ("exiba a página de pipeline", "mostre os gráficos"):
    // exibe o componente real do sistema direto na conversa — funciona com e
    // sem IA e NÃO exige apps selecionados.
    const intent = detectChatIntent(text);
    if (intent?.kind === "show") {
      setMessages((prev) => [
        ...prev,
        { role: "user", content: text },
        {
          role: "assistant",
          content: `Aqui está **${intent.label}** — o componente real, pronto para usar:`,
          surfaceId: intent.surfaceId,
          surfaceLabel: intent.label,
        },
      ]);
      setInput("");
      resumeFollow();
      return;
    }
    // Navegação "vá para o dashboard": a página real abre DENTRO da
    // conversa (iframe same-origin) — sem sair do chat.
    if (intent?.kind === "goto") {
      setMessages((prev) => [
        ...prev,
        { role: "user", content: text },
        {
          role: "assistant",
          content: `Aqui está a página **${intent.label}** — funcional dentro do chat:`,
          page: { path: intent.path, label: intent.label },
        },
      ]);
      setInput("");
      resumeFollow();
      return;
    }
    if (selectedEntries.length === 0) return;
    if (!parallel && inFlight > 0) {
      // Modo sequencial: guarda a intenção na fila FIFO local.
      const history = [...messages, { role: "user", content: text } as ChatMessage];
      queueRef.current.push(() => runChat(history));
      setInput("");
      return;
    }
    const userMsg: ChatMessage = { role: "user", content: text };
    const history = [...messages, userMsg];
    setInput("");
    resumeFollow(); // sending always jumps to the latest exchange
    await runChat(history);
  }, [input, selectedEntries, parallel, inFlight, messages, runChat, resumeFollow]);

  const sendSuggestion = async (s: string) => {
    if (selectedEntries.length === 0) return;
    if (!parallel && inFlight > 0) return;
    const history = [...messages, { role: "user", content: s } as ChatMessage];
    resumeFollow();
    await runChat(history);
  };

  const regenerate = async () => {
    if (inFlight > 0) return;
    // Find last user message
    let lastUserIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") { lastUserIdx = i; break; }
    }
    if (lastUserIdx < 0) return;
    const history = messages.slice(0, lastUserIdx + 1);
    await runChat(history);
  };

  /**
   * Atalho de análise (12 seções do sistema): roda a seção oficial do
   * experiment-analyze (prompt metodológico do servidor) e entrega o resultado
   * como mensagem do chat — a conversa vira um centro de comando de análises.
   */
  const runSection = useCallback(
    async (section: SectionDef) => {
      if (selectedEntries.length === 0) return;
      if (!parallel && inFlight > 0) return;
      const userMsg: ChatMessage = { role: "user", content: `⚡ ${section.label}` };
      const history = [...messages, userMsg];
      setInput("");
      resumeFollow();
      setError("");
      const controller = new AbortController();
      abortsRef.current.add(controller);
      const idxRef = { current: -1 };
      setMessages((prev) => {
        const extras = prev.length > history.length ? prev.slice(history.length) : [];
        return appendPlaceholder([...history, ...extras], idxRef);
      });
      incFlight();
      const write = (full: string) => setMessages((prev) => patchIndex(prev, idxRef.current, full));
      await streamExperiment(
        section.id,
        selectedEntries,
        {
          onToken: write,
          onDone: write,
          onError: (err) => {
            setError(err);
            setMessages((prev) => patchIndex(prev, idxRef.current, `⚠️ ${err}`));
          },
        },
        controller.signal,
      );
      abortsRef.current.delete(controller);
      decFlight();
      textareaRef.current?.focus();
    },
    [selectedEntries, messages, parallel, inFlight, incFlight, decFlight],
  );

  /**
   * Atalho de pipeline (agentes): executa as etapas em sequência, cada uma
   * virando uma mensagem de assistente — o usuário acompanha etapa a etapa.
   * Em modo paralelo, outros chats podem rodar ao mesmo tempo (o pipeline
   * usa um único controller e não aborta ninguém).
   */
  const runPipeline = useCallback(
    async (pipeline: PipelineShortcut) => {
      if (selectedEntries.length === 0) return;
      if (!parallel && inFlight > 0) return;
      const userMsg: ChatMessage = {
        role: "user",
        content: `🔁 Pipeline: ${pipeline.label} (${pipeline.steps.map((s) => s.label).join(" → ")})`,
      };
      const controller = new AbortController();
      abortsRef.current.add(controller);
      const idxRef = { current: -1 };
      setMessages((prev) => appendPlaceholder([...prev, userMsg], idxRef));
      setInput("");
      resumeFollow();
      setError("");
      incFlight();
      try {
        for (let i = 0; i < pipeline.steps.length; i++) {
          if (controller.signal.aborted) break;
          const step = pipeline.steps[i];
          const prefix = `**Etapa ${i + 1}/${pipeline.steps.length} — ${step.label}**\n\n`;
          const stepIdx = { current: -1 };
          setMessages((prev) => {
            const nxt = appendPlaceholder(prev, stepIdx);
            nxt[stepIdx.current] = { role: "assistant", content: prefix };
            return nxt;
          });
          const write = (full: string) => setMessages((prev) => patchIndex(prev, stepIdx.current, full));
          if (step.section === "custom" && step.prompt) {
            await streamExperimentChat(
              selectedEntries,
              [{ role: "user", content: step.prompt }],
              {
                onToken: write,
                onDone: write,
                onError: (err) => setError(err),
              },
              controller.signal,
            );
          } else {
            await streamExperiment(
              step.section,
              selectedEntries,
              {
                onToken: write,
                onDone: write,
                onError: (err) => setError(err),
              },
              controller.signal,
            );
          }
        }
        // Remove o placeholder vazio inicial (as etapas são as mensagens reais).
        setMessages((prev) => {
          const nxt = [...prev];
          if (idxRef.current >= 0 && idxRef.current < nxt.length && nxt[idxRef.current].content === "") {
            nxt.splice(idxRef.current, 1);
          }
          return nxt;
        });
      } finally {
        abortsRef.current.delete(controller);
        decFlight();
        textareaRef.current?.focus();
      }
    },
    [selectedEntries, parallel, inFlight, incFlight, decFlight],
  );

  const stop = () => {
    queueRef.current = [];
    abortAll();
  };

  const clearChat = () => {
    queueRef.current = [];
    abortAll();
    setMessages([]);
    setError("");
    setActiveChatId(null);
  };

  const newChat = () => {
    queueRef.current = [];
    abortAll();
    setMessages([]);
    setError("");
    setActiveChatId(null);
    setInput("");
  };

  return (
    <div ref={rootRef} className={embedded ? "h-full flex flex-col bg-background overflow-hidden" : "h-screen flex flex-col bg-background overflow-hidden"}>
      {!embedded && (
        <AppHeader
          backTo="/"
          title="Chat com IA"
          crumb="Chat com IA"
          compare={{ count: compare.entries.length, onOpen: () => compare.setPickerOpen(true) }}
        />
      )}

      <div className="flex-1 flex overflow-hidden relative">

        {/* Main chat area */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Top bar with selected apps context + clear */}
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border/60">
            <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
              <MessageSquare className="h-4 w-4 text-primary shrink-0" />
              <h1 className="text-sm font-semibold shrink-0">Chat com IA local</h1>
              {selectedEntries.length > 0 && !tight && (
                <div className="flex items-center gap-1 overflow-hidden">
                  <span className="text-[11px] text-muted-foreground shrink-0">·</span>
                  <div className="flex items-center gap-1 overflow-hidden">
                    {selectedEntries.slice(0, 4).map((e) => (
                      <span
                        key={entryKey(e.app.store, e.app.id)}
                        className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-secondary-foreground max-w-[120px]"
                      >
                        <img src={e.app.icon} alt="" className="w-3 h-3 rounded-sm shrink-0" />
                        <span className="truncate">{e.app.name}</span>
                      </span>
                    ))}
                    {selectedEntries.length > 4 && (
                      <span className="text-[10px] text-muted-foreground">
                        +{selectedEntries.length - 4}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
            {messages.length > 0 && (
              <div className="flex items-center gap-1.5 shrink-0">
                {/* F1: Search within messages */}
                <div className={tight ? "hidden" : "relative"}>
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <input
                    type="search"
                    value={msgSearch}
                    onChange={(e) => setMsgSearch(e.target.value)}
                    placeholder="Buscar…"
                    className="pl-6 pr-2 py-1 rounded-md border border-border/60 bg-card/60 text-xs w-28 focus:outline-none focus:ring-2 focus:ring-primary/40"
                    aria-label="Buscar nas mensagens"
                  />
                </div>
                {/* F3: Export conversation */}
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs shrink-0" onClick={exportConversation} aria-label="Exportar conversa">
                  <Download className="h-3.5 w-3.5" />
                  {!tight && <span>Exportar</span>}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs text-destructive hover:text-destructive shrink-0"
                  onClick={clearChat}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {!tight && <span>Limpar</span>}
                </Button>
              </div>
            )}
          </div>

          {/* Messages — grupo expansivo padrão (rolagem + chip Recentes). */}
          <div className="flex-1 relative min-h-0 flex flex-col">
          <ChatScrollGroup
            empty={messages.length === 0}
            emptyLabel={
              <EmptyChat
                selectedCount={selected.size}
                totalReviews={totalReviews}
                entries={selectedEntries}
                onSuggestion={sendSuggestion}
                onRunSection={runSection}
                onRunPipeline={runPipeline}
                disabled={!parallel && loading}
              />
            }
            deps={[messages]}
            followTrigger={followTick}
          >
            {messages.length === 0 ? null : (
              <div className={`w-full max-w-[min(100%,70rem)] mx-auto ${tight ? "px-2 py-4 space-y-4" : "px-4 py-6 space-y-6"}`}>
                {filteredMessages.map((m, i) => (
                  <MessageBubble
                    key={i}
                    index={i}
                    message={m}
                    streaming={loading && i === messages.length - 1 && m.role === "assistant"}
                    onRegenerate={regenerate}
                    canRegenerate={!loading && i === messages.length - 1 && m.role === "assistant"}
                    onResend={(text) => setInput(text)}
                    quickReplies={
                      !loading && i === messages.length - 1 && m.role === "assistant"
                        ? suggestQuickReplies(m.content) : undefined
                    }
                    onQuickReply={
                      !loading && i === messages.length - 1 && m.role === "assistant"
                        ? (text) => void sendSuggestion(text) : undefined
                    }
                    compact={tight}
                  />
                ))}
                {msgSearch.trim() && filteredMessages.length === 0 && (
                  <div className="text-center text-sm text-muted-foreground py-8">
                    Nenhuma mensagem encontrada para “{msgSearch}”.
                  </div>
                )}
                {error && (
                  <div className="flex items-center gap-2 text-sm text-destructive animate-msg-in" role="alert">
                    {isAiDisabled ? (
                      <Link
                        to="/configuracoes"
                        className="inline-flex items-center gap-1.5 text-primary hover:underline"
                        onClick={() => setError("")}
                      >
                        <Settings2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                        {error} (clique para abrir Configurações)
                      </Link>
                    ) : (
                      <>
                        <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                        {error}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </ChatScrollGroup>
          </div>

          {/* Input bar */}
          <div className="border-t border-border/60 bg-background">
            <div className="w-full max-w-[min(100%,70rem)] mx-auto p-3">
              {/* Atalhos sempre acessíveis: com conversa rolando, mostra só as
                  análises/pipelines (sugestões ficam no empty state). */}
              {messages.length > 0 && selectedEntries.length > 0 && (
                <div className="mb-2">
                  <AIChatShortcuts
                    entries={selectedEntries}
                    disabled={!parallel && loading}
                    onRunSection={runSection}
                    onRunPipeline={runPipeline}
                    onSuggestion={sendSuggestion}
                    showSuggestions={false}
                  />
                </div>
              )}
              {selected.size === 0 && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 text-center mb-2 flex items-center justify-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Selecione ao menos um app na barra lateral para conversar com a IA.
                </p>
              )}
              <div className="relative flex items-end gap-2 rounded-2xl border border-border/60 bg-card focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 transition-colors px-3 py-2">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder={
                    selected.size === 0
                      ? "Selecione apps na barra lateral..."
                      : "Pergunte sobre os dados coletados... (Enter envia, Shift+Enter quebra linha)"
                  }
                  disabled={selected.size === 0}
                  rows={1}
                  className="flex-1 resize-none border-0 bg-transparent min-h-[24px] max-h-[200px] px-0 py-1 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                {voiceSettings.sttEnabled && (
                  <Button
                    variant={stt.active ? "destructive" : "ghost"}
                    size="icon"
                    className="h-8 w-8 rounded-lg shrink-0"
                    onClick={toggleDictation}
                    disabled={!stt.engine}
                    title={
                      !stt.engine
                        ? "Ditado indisponível — veja o painel Voz (Chat com voz)"
                        : stt.active
                          ? "Parar ditado"
                          : "Ditar por voz (o texto entra aqui para revisão)"
                    }
                    aria-label={stt.active ? "Parar ditado por voz" : "Ditar por voz"}
                    aria-pressed={stt.active}
                  >
                    {stt.state === "transcribing" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : stt.active ? (
                      <MicOff className="h-4 w-4 animate-pulse" />
                    ) : (
                      <Mic className="h-4 w-4" />
                    )}
                  </Button>
                )}
                {loading ? (
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8 rounded-lg shrink-0"
                    onClick={stop}
                    title="Parar geração"
                  >
                    <Square className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    className="h-8 w-8 rounded-lg shrink-0"
                    onClick={send}
                    disabled={!input.trim() || selected.size === 0}
                    title="Enviar"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground text-center mt-2">
                A IA analisa os reviews dos apps selecionados e responde com gráficos, tabelas e evidências.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

/** Bolha de mensagem da página Chat — bloco padronizado (ChatMessageBlock):
 *  header com título/origem/ações, níveis de expansão persistidos, barra de
 *  status da geração e superfícies reais embutidas. A mensagem do usuário
 *  ganha copiar/reenviar/modal; a do assistente, regenerar + AIOutputCard. */
function MessageBubble({
  message,
  streaming,
  onRegenerate,
  canRegenerate,
  onResend,
  quickReplies,
  onQuickReply,
  index,
  compact,
}: {
  message: ChatMsg;
  streaming?: boolean;
  onRegenerate: () => void;
  canRegenerate?: boolean;
  onResend?: (text: string) => void;
  /** Quick replies contextuais (só na última resposta da IA). */
  quickReplies?: string[];
  onQuickReply?: (text: string) => void;
  index: number;
  /** Coluna estreita (ex.: /01 com sidebars abertas): sem avatar, mais espaço. */
  compact?: boolean;
}) {
  return (
    <ChatMessageBlock
      role={message.role}
      content={message.content}
      streaming={streaming}
      surfaceId={message.surfaceId}
      surfaceLabel={message.surfaceLabel}
      page={message.page}
      storageKey={`chat-msg-${index}`}
      onRegenerate={message.role === "assistant" && canRegenerate ? onRegenerate : undefined}
      onResend={message.role === "user" ? onResend : undefined}
      quickReplies={quickReplies}
      onQuickReply={onQuickReply}
      compact={compact}
      className={compact ? "" : "sm:max-w-[92%]"}
    />
  );
}

function EmptyChat({
  selectedCount,
  totalReviews,
  entries,
  onSuggestion,
  onRunSection,
  onRunPipeline,
  disabled,
}: {
  selectedCount: number;
  totalReviews: number;
  entries: import("@/lib/datasetStore").DatasetEntry[];
  onSuggestion: (s: string) => void;
  onRunSection: (s: SectionDef) => void;
  onRunPipeline: (p: PipelineShortcut) => void;
  disabled: boolean;
}) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center max-w-2xl mx-auto px-4 py-8 overflow-y-auto">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/15 to-primary/15 border border-primary/20 flex items-center justify-center mb-5 shrink-0">
        <Sparkles className="h-8 w-8 text-primary" />
      </div>
      <h2 className="text-xl font-semibold tracking-tight">Converse com a IA sobre seus dados</h2>
      <p className="text-sm text-muted-foreground mt-2 max-w-md">
        Selecione apps na barra lateral e faça perguntas — ou dispare uma análise/pipeline pronta.
        A IA analisa todos os reviews coletados e responde com gráficos, tabelas e evidências.
      </p>
      {selectedCount > 0 ? (
        <p className="text-xs text-primary mt-4 font-medium flex items-center gap-1.5">
          <Database className="h-3.5 w-3.5" />
          {selectedCount} app(s) selecionado(s) · {totalReviews} reviews prontos para análise
        </p>
      ) : (
        <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5" />
          Nenhum app selecionado. Use a barra lateral para buscar e coletar apps.
        </p>
      )}

      {selectedCount > 0 && (
        <div className="mt-6 w-full text-left">
          <AIChatShortcuts
            entries={entries}
            disabled={disabled}
            onRunSection={onRunSection}
            onRunPipeline={onRunPipeline}
            onSuggestion={onSuggestion}
            maxSuggestions={6}
          />
        </div>
      )}
    </div>
  );
}
