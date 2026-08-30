/**
 * Chat com voz (`/chat-voz`) — assistente completo estilo ChatGPT/Gemini/Siri/Jarvis.
 *
 * O chat centraliza TUDO o que as outras páginas fazem, por VOZ ou texto:
 *  - VOZ → TEXTO (STT): Web Speech API (Chrome) com fallback para Whisper
 *    LOCAL no servidor (faster-whisper/whisper.cpp — funciona em qualquer
 *    navegador, 100% offline, usa a GPU). Engine escolhido automaticamente
 *    (`useVoiceInput`) com erros ACIONÁVEIS (permissão, mic ausente, rede).
 *  - TEXTO → VOZ (TTS): navegador (speechSynthesis) com fallback para Piper/
 *    espeak no servidor (`speakSmart`) — Chrome/Linux sem vozes no sistema
 *    deixa de ser beco sem saída.
 *  - DIAGNÓSTICO: painel "Voz" (sidebar direita) checa ao vivo contexto
 *    seguro, permissão do mic, STT/TTS navegador e servidor, com comandos
 *    de instalação copiáveis (AssistantVoiceDiagnostics).
 *  - COMANDOS: registry do Nexus OS (/collect, /analyze, /agent, /stats,
 *    /export, /goto). Frases PT-BR viram comandos (`detectVoiceIntent`).
 *  - IA: chat (streamExperimentChat), seções (streamExperiment) e agentes
 *    (agentRunner) — saída sempre em AIOutputCard (com Ouvir e Analisar).
 *  - CONCORRÊNCIA: parallel (várias gerações ao mesmo tempo) vs sequential
 *    (fila FIFO local) — mesmo mecanismo das outras superfícies de chat.
 *  - CONVERSAS: threads persistidos no histórico global (aba Chats).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Mic, MicOff, Send, Volume2, VolumeX, Loader2, Square,
  Database, SlidersHorizontal, Activity, BarChart3,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { ChatMessageBlock } from "@/components/shared/ChatMessageBlock";
import { ChatScrollGroup } from "@/components/shared/ChatScrollGroup";
import { suggestQuickReplies } from "@/lib/quickReplies";
import { PageTabsSidebar } from "@/components/PageTabsSidebar";
import {
  AssistantContextPanel, AssistantActionsPanel, AssistantVoicePanel, AssistantStatusPanel,
} from "@/components/assistant/AssistantPanels";
import { VoiceDiagnostics } from "@/components/assistant/VoiceDiagnostics";
import { VoiceOrb, type OrbState } from "@/components/assistant/VoiceOrb";
import { useDataset } from "@/hooks/useDataset";
import type { DatasetEntry } from "@/lib/datasetStore";
import { useSelection, entryKey } from "@/context/SelectionContext";
import { useAISettings, isAIEnabled, isParallelIA } from "@/lib/aiSettings";
import { useCollectionSettings } from "@/components/CollectionSettingsProvider";
import { executeCLI, type OSCommandContext, matchCommands } from "@/lib/os/commands";
import { streamExperiment } from "@/lib/experimentApi";
import { streamExperimentChat, type ChatMessage } from "@/lib/experimentChatApi";
import { appendPlaceholder, patchIndex, type StreamIndex } from "@/lib/chatStream";
import { detectChatIntent } from "@/lib/chatCommands";
import { runAgent, type StepState } from "@/lib/agentRunner";
import { BUILTIN_AGENTS, type GeneratorAgent } from "@/lib/agents";
import { collectApp } from "@/lib/collect";
import { searchApps, type AppInfo } from "@/lib/appStoreApi";
import { searchGooglePlayApps } from "@/lib/googlePlayApi";
import { getUserRegion } from "@/lib/region";
import { recordGeneration } from "@/lib/sessionStore";
import { saveSession } from "@/lib/chatHistoryStore";
import {
  useVoiceSettings, stopSpeaking, detectVoiceIntent, isTTSSupported, listVoices, stripForSpeech,
} from "@/lib/voice";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { speakSmart, stopServerAudio } from "@/lib/voiceServer";
import { downloadFile } from "@/lib/pageFeatures";
import { toastInfo, toastError } from "@/lib/ux";

import { cn } from "@/lib/utils";


/** Mensagem do chat estendida com componente embutido (ação sem IA). */
type VoiceMsg = ChatMessage & {
  surfaceId?: string; surfaceLabel?: string;
  /** Página real embutida na conversa (intent goto — iframe same-origin). */
  page?: { path: string; label: string };
};

export default function ChatVoz() {
  const navigate = useNavigate();
  const { entries } = useDataset();
  const { selected } = useSelection();
  const ai = useAISettings();
  const aiOn = isAIEnabled(ai);
  const parallel = isParallelIA(ai);
  const { settings: collection } = useCollectionSettings();
  const vs = useVoiceSettings();

  const scope = useMemo<DatasetEntry[]>(() => {
    if (selected.size === 0) return entries;
    return entries.filter((e) => selected.has(entryKey(e.app.store, e.app.id)));
  }, [entries, selected]);

  /* --------------------------------------------------------- estado chat -- */
  const [messages, setMessages] = useState<VoiceMsg[]>([]);
  const [inFlight, setInFlight] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const abortsRef = useRef<Set<AbortController>>(new Set());
  const queueRef = useRef<string[]>([]);
  const streamingIdxRef = useRef<Set<number>>(new Set());
  const inFlightRef = useRef(0);
  const messagesRef = useRef<VoiceMsg[]>([]);
  useEffect(() => { inFlightRef.current = inFlight; }, [inFlight]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  // Auto-scroll/rolagem vivem no ChatScrollGroup abaixo.
  const [input, setInput] = useState("");
  /** Diagnóstico inline (quando mic não tem engine disponível). */
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const incFlight = useCallback(() => setInFlight((n) => n + 1), []);
  const decFlight = useCallback(() => setInFlight((n) => Math.max(0, n - 1)), []);

  const persist = useCallback((id: string | null, msgs: ChatMessage[]) => {
    try {
      if (msgs.filter((m) => m.role === "user").length > 0 && msgs.some((m) => m.role === "assistant" && m.content)) {
        const nextId = saveSession(id, msgs.filter((m) => m.content || m.role === "user"), Array.from(selected));
        if (nextId !== id) setSessionId(nextId);
      }
    } catch { /* persistir nunca quebra */ }
  }, [selected]);

  /* ----------------------------------------------------------- TTS ------- */
  const cancelSpeechRef = useRef<(() => void) | null>(null);
  const [speakEnabled, setSpeakEnabled] = useState(vs.autoSpeak);
  const [speaking, setSpeaking] = useState(false);
  const sttRef = useRef<{ start: () => void } | null>(null);
  useEffect(() => setSpeakEnabled(vs.autoSpeak), [vs.autoSpeak]);

  /** Vozes do navegador carregam assíncrono — escuta voiceschanged. */
  const [browserVoiceCount, setBrowserVoiceCount] = useState(() => listVoices().length);
  useEffect(() => {
    if (!isTTSSupported()) return;
    const update = () => setBrowserVoiceCount(listVoices().length);
    window.speechSynthesis.addEventListener?.("voiceschanged", update);
    update();
    return () => window.speechSynthesis.removeEventListener?.("voiceschanged", update);
  }, []);

  const speakText = useCallback((text: string) => {
    if (!speakEnabled || !stripForSpeech(text).trim()) return;
    cancelSpeechRef.current?.();
    setSpeaking(true);
    const handle = speakSmart(text, vs, browserVoiceCount, () => {
      setSpeaking(false);
      cancelSpeechRef.current = null;
      if (vs.continuous) sttRef.current?.start();
    }, (msg) => {
      if (msg) toastError(msg);
    });
    cancelSpeechRef.current = handle.cancel;
  }, [speakEnabled, vs, browserVoiceCount]);

  /* ----------------------------------------------------------- STT ------- */
  const submitRef = useRef<(text: string) => void>(() => {});
  const stt = useVoiceInput({
    lang: vs.lang,
    onFinal: (text) => submitRef.current(text),
  });
  useEffect(() => { sttRef.current = stt; }, [stt]);
  useEffect(() => {
    if (stt.error) toastError(stt.error);
  }, [stt.error]);

  /* --------------------------------------------- factory de handlers ----- */
  const makeStream = useCallback(() => {
    const ac = new AbortController();
    abortsRef.current.add(ac);
    const idxRef: StreamIndex = { current: -1 };
    setMessages((prev) => appendPlaceholder(prev, idxRef));
    incFlight();
    const finish = (content: string, ok: boolean) => {
      abortsRef.current.delete(ac);
      if (idxRef.current >= 0) streamingIdxRef.current.delete(idxRef.current);
      setMessages((prev) => {
        if (!ok) return patchIndex(prev, idxRef.current, `⚠️ ${content}`);
        const done = patchIndex(prev, idxRef.current, content);
        persist(sessionId, done);
        return done;
      });
      decFlight();
    };
    return { ac, idxRef, finish };
  }, [incFlight, decFlight, persist, sessionId]);

  /* ---------------------------------------------------- ações (ctx CLI) -- */
  const runSection = useCallback((id: string) => {
    if (scope.length === 0) {
      toastInfo("Dataset vazio — colete um app primeiro (ex.: /collect nubank).");
      return;
    }
    const { ac, idxRef, finish } = makeStream();
    streamExperiment(id, scope, {
      onToken: (acc) => setMessages((prev) => {
        if (idxRef.current >= 0) streamingIdxRef.current.add(idxRef.current);
        return patchIndex(prev, idxRef.current, acc);
      }),
      onDone: (acc) => {
        finish(acc, true);
        try {
          recordGeneration({
            type: "ai-section",
            title: `Chat voz: ${id}`,
            appKeys: scope.map((e) => entryKey(e.app.store, e.app.id)),
            markdown: acc,
            summary: `Seção ${id}`,
            source: "chat-voz",
          });
        } catch { /* ok */ }
        speakText(acc);
      },
      onError: (err) => {
        toastError(err);
        finish(err, false);
      },
    }, ac.signal, ai);
  }, [scope, ai, makeStream, speakText]);

  const runAgentById = useCallback((id: string) => {
    const agent = BUILTIN_AGENTS.find((a) => a.id === id) as GeneratorAgent | undefined;
    if (!agent) return;
    if (scope.length === 0) {
      toastInfo("Dataset vazio — colete um app primeiro (ex.: /collect nubank).");
      return;
    }
    const { ac, idxRef, finish } = makeStream();
    setMessages((prev) => patchIndex(prev, idxRef.current,
      `### Agente: ${agent.label}\n${agent.pipeline.map((s, i) => `${i + 1}. ○ ${s.label}`).join("\n")}`));
    const steps: StepState[] = agent.pipeline.map(() => ({ status: "pending", output: "" }));
    runAgent(agent, scope, {
      onStep: (idx, state) => {
        steps[idx] = state;
        const body = agent.pipeline.map((s, i) => {
          const st = steps[i];
          const mark = st.status === "done" ? "✓" : st.status === "error" ? "✗" : st.status === "running" ? "…" : "○";
          return `${i + 1}. ${mark} ${s.label}`;
        }).join("\n");
        setMessages((prev) => patchIndex(prev, idxRef.current, `### Agente: ${agent.label}\n${body}`));
      },
      onDone: () => {
        const body = agent.pipeline.map((s, i) => `${i + 1}. ✓ ${s.label}\n\n${steps[i].output}`).join("\n\n");
        finish(`### Agente: ${agent.label}\n${body}`, true);
      },
      onError: (err) => {
        toastError(err);
        finish(err, false);
      },
    }, { signal: ac.signal, ai });
  }, [scope, ai, makeStream]);

  const collectTerm = useCallback(async (term: string): Promise<string> => {
    const region = getUserRegion();
    try {
      const [apple, google] = await Promise.all([
        searchApps(term, region, 5).catch(() => [] as AppInfo[]),
        searchGooglePlayApps(term, region, 5).catch(() => [] as AppInfo[]),
      ]);
      const results = [...google, ...apple];
      if (results.length === 0) return `Nenhum app encontrado para "${term}".`;
      const app = results[0];
      const { entry, reused } = await collectApp(app, region, collection.reviewLimit, collection.reviewSort);
      return `✓ ${entry.app.name} (${entry.app.store === "apple" ? "Apple" : "Google"}) — ${entry.reviews.length} reviews ${reused ? "(cache)" : "coletados"}`;
    } catch (e) {
      return e instanceof Error ? e.message : "Falha na coleta";
    }
  }, [collection.reviewLimit, collection.reviewSort]);

  const exportDataset = useCallback((fmt: "json" | "md"): string => {
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `chat-voz-dataset-${stamp}.${fmt}`;
    if (scope.length === 0) return filename;
    if (fmt === "json") {
      const payload = {
        exportedAt: new Date().toISOString(),
        totalApps: scope.length,
        totalReviews: scope.reduce((s, e) => s + e.reviews.length, 0),
        apps: scope,
      };
      downloadFile(filename, JSON.stringify(payload, null, 2), "application/json", { silent: true });
    } else {
      const md = scope.map((e) => {
        const head = `# ${e.app.name} (${e.app.store === "apple" ? "Apple" : "Google"})\n\n` +
          `- Reviews coletados: ${e.reviews.length}\n- Nota da loja: ${e.app.rating ?? "—"}\n\n`;
        return head + e.reviews.map((r, i) =>
          `### ${i + 1}. ${"★".repeat(r.rating)} — ${r.title || r.author}\n> ${r.text}`,
        ).join("\n\n");
      }).join("\n\n---\n\n");
      downloadFile(filename, md, "text/markdown", { silent: true });
    }
    return `arquivo ${filename} baixado (${scope.length} apps)`;
  }, [scope]);

  const ctx: OSCommandContext = useMemo(() => ({
    entries: scope,
    aiEnabled: aiOn,
    navigate,
    setView: () => { /* o chat não tem views */ },
    runSection,
    runAgent: runAgentById,
    collectTerm,
    exportDataset,
  }), [scope, aiOn, navigate, runSection, runAgentById, collectTerm, exportDataset]);

  const askAI = useCallback((history: ChatMessage[]) => {
    if (!aiOn) {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "⚠️ IA desativada. Ative em Configurações → Inteligência Artificial — ou use comandos de dados (/collect, /stats, /apps).",
      }]);
      return;
    }
    if (scope.length === 0) {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "⚠️ O dataset está vazio. Colete um app (ex.: /collect nubank) para eu responder sobre os dados.",
      }]);
      return;
    }
    const { ac, idxRef, finish } = makeStream();
    streamExperimentChat(scope, history, {
      onToken: (acc) => setMessages((prev) => {
        if (idxRef.current >= 0) streamingIdxRef.current.add(idxRef.current);
        return patchIndex(prev, idxRef.current, acc);
      }),
      onDone: (acc) => {
        finish(acc, true);
        speakText(acc);
      },
      onError: (err) => {
        toastError(err);
        finish(err, false);
      },
    }, ac.signal, ai);
  }, [aiOn, scope, ai, makeStream, speakText]);

  /* --------------------------------------------------------- submit ------ */
  const submitNow = useCallback((raw: string) => {
    const text = raw.trim();
    if (!text) return;
    // Intenção sem IA ("exiba os gráficos", "selecione as fontes"): exibe o
    // componente real do sistema na conversa — funciona com e sem IA/voz.
    const surfaceIntent = text.startsWith("/") ? null : detectChatIntent(text);
    if (surfaceIntent?.kind === "show" || surfaceIntent?.kind === "goto") {
      const goto = surfaceIntent.kind === "goto";
      setMessages((prev) => {
        const next: VoiceMsg[] = [
          ...prev,
          { role: "user", content: text },
          {
            role: "assistant",
            content: goto
              ? `Aqui está a página **${surfaceIntent.label}** — funcional dentro do chat:`
              : `Aqui está **${surfaceIntent.label}** — o componente real, pronto para usar:`,
            surfaceId: goto ? undefined : surfaceIntent.surfaceId,
            page: goto ? { path: surfaceIntent.path, label: surfaceIntent.label } : undefined,
          },
        ];
        persist(sessionId, next);
        return next;
      });
      speakText(goto ? `Abrindo a página ${surfaceIntent.label}.` : `Aqui está ${surfaceIntent.label}.`);
      return;
    }
    const intended = text.startsWith("/") ? text : (detectVoiceIntent(text) ?? null);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    if (intended) {
      void executeCLI(intended, ctx).then((res) => {
        setMessages((prev) => {
          const next = [
            ...prev,
            ...res.lines.map((l) => ({ role: "assistant" as const, content: l.text })),
          ];
          persist(sessionId, next);
          return next;
        });
        speakText(res.lines.map((l) => l.text).join("\n"));
      });
      return;
    }
    askAI([...messagesRef.current, { role: "user", content: text }]);
  }, [ctx, sessionId, persist, speakText, askAI]);

  const submit = useCallback((raw: string) => {
    const text = raw.trim();
    if (!text) return;
    setInput("");
    if (!parallel && inFlightRef.current > 0) {
      queueRef.current.push(text);
      toastInfo("Gerando resposta — sua mensagem entrou na fila (modo sequencial).");
      return;
    }
    submitNow(text);
  }, [parallel, submitNow]);

  /* Drena a fila FIFO (no modo paralelo nunca enche). */
  useEffect(() => {
    if (parallel) return;
    if (inFlight === 0 && queueRef.current.length > 0) {
      const next = queueRef.current.shift();
      if (next) submitNow(next);
    }
  });

  useEffect(() => {
    submitRef.current = submit;
  });

  // Auto-scroll inteligente: só acompanha o fim se o usuário já estiver lá —
  // rolar para cima durante a geração por voz nunca é sobrescrito.

  const suggestions = useMemo(() =>
    matchCommands("").filter((c) => ["collect", "analyze", "stats", "goto"].includes(c.id)), []);

  const busy = inFlight > 0;
  const queued = !parallel && queueRef.current.length > 0;

  const stopAll = useCallback(() => {
    queueRef.current = [];
    for (const c of abortsRef.current) c.abort();
    abortsRef.current.clear();
    streamingIdxRef.current.clear();
    setInFlight(0);
    stt.stop();
    stopSpeaking();
    stopServerAudio();
    cancelSpeechRef.current?.();
    cancelSpeechRef.current = null;
    setSpeaking(false);
  }, [stt]);

  const newChat = useCallback(() => {
    stopAll();
    setMessages([]);
    setSessionId(null);
  }, [stopAll]);

  /* ------------------------------------------------------------ render --- */
  const orbState: OrbState = speaking
    ? "speaking"
    : busy
      ? "thinking"
      : stt.active
        ? "listening"
        : "idle";

  const micAvailable = vs.sttEnabled && stt.engine !== null;
  const micUnavailable = vs.sttEnabled && stt.engine === null;

  const tabsLeft = [
    { id: "contexto", label: "Contexto", icon: <Database className="h-3.5 w-3.5" />, content: <AssistantContextPanel /> },
    {
      id: "acoes", label: "Ações", icon: <SlidersHorizontal className="h-3.5 w-3.5" />,
      content: (
        <AssistantActionsPanel
          onCommand={submit}
          onRunSection={runSection}
          onRunAgent={runAgentById}
          disabled={false}
        />
      ),
    },
  ];
  const tabsRight = [
    {
      id: "voz", label: "Voz", icon: <Volume2 className="h-3.5 w-3.5" />,
      content: (
        <div className="space-y-4">
          <AssistantVoicePanel />
          <div className="px-3">
            <VoiceDiagnostics />
          </div>
        </div>
      ),
    },
    { id: "status", label: "Status", icon: <BarChart3 className="h-3.5 w-3.5" />, content: <AssistantStatusPanel /> },
  ];

  const sttStateLabel = stt.state === "listening"
    ? "Ouvindo…"
    : stt.state === "recording"
      ? "Gravando áudio…"
      : stt.state === "transcribing"
        ? "Transcrevendo com Whisper local…"
        : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <AppHeader title="Chat com voz" crumb="fale, ouça e execute tudo" showSearch={false} />
      <PageTabsSidebar
        id="chatvoz:left"
        side="left"
        title="Chat com voz"
        subtitle="contexto e ações"
        icon={<Mic className="h-4 w-4" />}
        storageKey="aso:chatvoz-left-w"
        defaultWidth={280}
        tabs={tabsLeft}
        defaultTab="contexto"
      />
      <PageTabsSidebar
        id="chatvoz:right"
        side="right"
        title="Voz & status"
        icon={<Activity className="h-4 w-4" />}
        storageKey="aso:chatvoz-right-w"
        defaultWidth={300}
        helpTab={{
          description: "O Chat com voz é o assistente completo estilo ChatGPT/Jarvis: fale ou digite, a IA responde com voz, executa comandos do sistema (/collect, /analyze, agentes) e usa os apps selecionados como contexto.",
          tips: ['Sem "/" o texto vira pergunta para a IA; com "/" vira comando.', "A voz local (Whisper + Piper) roda 100% offline após o setup.", "O diagnóstico de voz mostra exatamente o que falta instalar."],
        }}
        tabs={tabsRight}
      />
      <div className="mx-auto flex w-full max-w-3xl flex-1 min-h-0 flex-col px-4">
        <div className="flex items-center justify-center gap-3 py-3 flex-wrap">
          <VoiceOrb state={orbState} size="sm" />
          <p className="text-xs text-muted-foreground">
            {scope.length > 0
              ? `Escopo: ${selected.size === 0 ? `${scope.length} app(s)` : `${scope.length} selecionado(s)`}`
              : "Dataset vazio — /collect <termo> coleta aqui mesmo"}
          </p>
          {stt.engine && (
            <span
              className="rounded-full bg-secondary/70 px-2 py-0.5 text-[10px] text-muted-foreground"
              title={stt.engine === "webspeech"
                ? "Voz → texto pelo navegador (Chrome envia áudio ao Google)"
                : "Voz → texto local (Whisper no servidor — offline)"}
            >
              🎙 {stt.engine === "webspeech" ? "STT navegador" : "Whisper local"}
            </span>
          )}
          <button
            onClick={newChat}
            className="rounded-md border border-border px-2 py-1 text-xs hover:bg-secondary"
            aria-label="Nova conversa"
          >
            Nova conversa
          </button>
        </div>

        <ChatScrollGroup
          empty={messages.length === 0}
          emptyLabel={
            <div className="mx-auto max-w-lg space-y-5 py-8 text-center">
              <VoiceOrb state="idle" size="lg" />
              <div>
                <h2 className="text-lg font-semibold">O sistema inteiro por voz ou texto</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pesquise, colete, analise, rode seções de IA, agentes e exporte — sem sair desta conversa.
                  Comandos começam com <code className="rounded bg-muted px-1">/</code>;
                  frases como "colete nubank" ou "abra dashboard" também funcionam, faladas ou digitadas.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {parallel
                    ? "Várias gerações rodam ao mesmo tempo — envie a próxima pergunta sem esperar."
                    : "Modo sequencial: enquanto uma resposta gera, a próxima entra na fila."}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-left sm:grid-cols-4">
                {suggestions.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setInput(c.usage)}
                    className="rounded-lg border border-border p-2 text-xs hover:bg-secondary"
                  >
                    <span className="block font-mono text-primary">{c.usage}</span>
                    <span className="mt-0.5 block text-muted-foreground">{c.description}</span>
                  </button>
                ))}
              </div>
            </div>
          }
          deps={[messages]}
        >
          <div className="space-y-4 py-2">
            {messages.map((m, i) => {
              const isLastAssistant = m.role === "assistant" && i === messages.length - 1 && !busy && !m.page;
              return (
                <ChatMessageBlock
                  key={i}
                  role={m.role}
                  content={m.content}
                  streaming={m.role === "assistant" && busy && streamingIdxRef.current.has(i) && !m.page}
                  surfaceId={m.surfaceId}
                  surfaceLabel={m.surfaceLabel}
                  page={m.page}
                  storageKey={`chatvoz-${i}`}
                  filename="chat-com-voz"
                  onResend={m.role === "user" ? (text) => setInput(text) : undefined}
                  quickReplies={isLastAssistant ? suggestQuickReplies(m.content) : undefined}
                  onQuickReply={isLastAssistant ? (text) => submit(text) : undefined}
                />
              );
            })}
            {stt.interim && (
              <div className="flex justify-end" role="status">
                <div className="rounded-2xl bg-muted px-4 py-2 text-sm italic opacity-70">{stt.interim}</div>
              </div>
            )}
            {(stt.state === "recording" || stt.state === "transcribing") && (
              <div className="flex justify-end" role="status">
                <div className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-2 text-sm italic opacity-80">
                  {stt.state === "recording"
                    ? <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" aria-hidden="true" />
                    : <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                  {stt.state === "recording" ? "Gravando… toque no ⏹ para transcrever" : "Transcrevendo com Whisper local…"}
                </div>
              </div>
            )}
          </div>
        </ChatScrollGroup>

        <div className="py-3">
          {showDiagnostics && (
            <div className="mb-2 rounded-2xl border border-border bg-card p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold">Por que o microfone não está pronto?</p>
                <button
                  onClick={() => setShowDiagnostics(false)}
                  className="rounded px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-secondary"
                >
                  fechar
                </button>
              </div>
              <VoiceDiagnostics />
            </div>
          )}
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm">
            {micAvailable && (
              <button
                onClick={() => (stt.active ? stt.stop() : stt.start())}
                className={cn(
                  "rounded-full p-2.5 transition-colors",
                  stt.active ? "bg-red-500 text-white" : "bg-secondary hover:bg-secondary/80",
                )}
                aria-label={stt.active ? "Parar e transcrever" : "Falar por voz"}
                aria-pressed={stt.active}
                title={stt.engine === "server" ? "Gravar áudio → Whisper local" : "Reconhecimento de voz do navegador"}
              >
                {stt.state === "transcribing"
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : stt.active
                    ? <Square className="h-4 w-4" />
                    : <Mic className="h-4 w-4" />}
              </button>
            )}
            {micUnavailable && (
              <button
                onClick={() => setShowDiagnostics((v) => !v)}
                className="rounded-full bg-secondary/60 p-2.5 hover:bg-secondary"
                aria-label="Voz → texto indisponível — abrir diagnóstico"
                aria-expanded={showDiagnostics}
                title="Voz → texto indisponível aqui — clique para diagnosticar e resolver"
              >
                <MicOff className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </button>
            )}
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit(input);
                }
              }}
              placeholder={parallel
                ? "Digite, fale ou use comando — várias respostas em paralelo…"
                : "Digite ou fale — em sequência (nova entra na fila)…"}
              rows={1}
              className="flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground"
              aria-label="Mensagem para o chat com voz"
            />
            <button
              onClick={stopAll}
              disabled={!busy && !queued && !speaking}
              className="rounded-full bg-secondary p-2.5 hover:bg-secondary/80 disabled:opacity-40"
              aria-label="Parar gerações e fala"
            >
              <Square className="h-4 w-4" />
            </button>
            <button
              onClick={() => submit(input)}
              disabled={!input.trim()}
              className="rounded-full bg-primary p-2.5 text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
              aria-label="Enviar mensagem"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
            <span role="status">
              {sttStateLabel
                ?? (busy
                  ? `Gerando ${inFlight} resposta(s)…${queued ? ` (+${queueRef.current.length} na fila)` : ""}`
                  : queued
                    ? `${queueRef.current.length} mensagem(ns) na fila`
                    : speaking ? "Falando…" : "Pronto")}
            </span>
            <button
              onClick={() => setSpeakEnabled((v) => !v)}
              className="flex items-center gap-1 rounded px-1 py-0.5 hover:bg-secondary"
              aria-pressed={speakEnabled}
              aria-label={speakEnabled ? "Desativar leitura em voz alta" : "Ativar leitura em voz alta"}
            >
              {speakEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
              {speakEnabled ? "voz on" : "voz off"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
