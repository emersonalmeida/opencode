import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ChevronsUpDown, ChevronsDownUp, Minus, Loader2, Maximize2, X, RefreshCw,
  ZoomIn, ZoomOut, Timer, Zap, BookOpen, FileText, ArrowDown, BrainCircuit,
  AudioLines,
} from "lucide-react";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { CopyDownloadButtons } from "@/components/shared/CopyDownloadButtons";
import {
  useAIOutputSettings, getCardScaleOverride, setCardScaleOverride,
  subscribeAIOutputSettings, clampScale, generationStats, formatDuration,
  SCALE_MIN, SCALE_MAX, SCALE_STEP, type GenerationStats,
} from "@/lib/aiOutputSettings";
import { listVoices, useSpeechState, useVoiceSettings } from "@/lib/voice";
import { streamEngineFor } from "@/lib/voiceServer";
import { StreamingSpeaker } from "@/lib/voiceStream";
import { useAISettings, aiProvenance, isAIEnabled } from "@/lib/aiSettings";
import { VoiceControls } from "@/components/shared/VoiceControls";
import { streamExperimentChat } from "@/lib/experimentChatApi";
import { useDataset } from "@/hooks/useDataset";
import { useSelection, entryKey } from "@/context/SelectionContext";
import { toastError } from "@/lib/ux";

export type AIOutputLevel = "collapsed" | "default" | "expanded";

interface Props {
  /** Título do card (ex.: "Resumo executivo"). Opcional no modo bare. */
  title?: string;
  /** Subtítulo/descrição curta (visível também no nível recolhido). */
  description?: string;
  /** Conteúdo markdown gerado ("" enquanto não gerou). */
  content: string;
  /** Streaming em andamento (mostra spinner e força nível expandido). */
  streaming?: boolean;
  /** Base do nome do arquivo p/ baixar. */
  filename?: string;
  /** Nível inicial (padrão "expanded" — conteúdo sempre completo). */
  defaultLevel?: AIOutputLevel;
  /** Se definido, persiste o nível escolhido em localStorage. */
  storageKey?: string;
  /** Ícone à esquerda do título. */
  icon?: ReactNode;
  /** Sem header próprio: só o conteúdo + barra de controles flutuante.
   *  Usar quando o card já tem header ou é bolha de chat. */
  bare?: boolean;
  /** Proveniência (ex.: "local · gemma3:12b") — badge no header. Quando
   *  ausente, o card resolve da config de IA atual (modo+modelo+provider). */
  provenance?: string;
  /** Callback de regeneração — botão RefreshCw no header. */
  onRegenerate?: () => void;
  /** Habilita blocos de chart fenced (chart-pie/bar/line/area). Default true. */
  enableCharts?: boolean;
  /** Habilita blocos fenced ```component <id>``` — renderiza superfícies
   *  REAIS do sistema dentro da resposta. Default true. */
  enableComponents?: boolean;
  /** Botões "ouvir em voz alta" + configurações de TTS no header. Default true. */
  speak?: boolean;
  /** Botão "Analisar com IA" (IA analisa IA) no header. Default true fora do
   *  modo bare (bolhas de chat já têm conversa para aprofundar). */
  analyzeWithAI?: boolean;
  /** Durante o streaming, a PÁGINA acompanha o fim do conteúdo gerado
   *  (scroll automático até o usuário rolar manualmente). Default: true
   *  fora do modo bare (bolhas de chat têm seu próprio auto-scroll). */
  followStreaming?: boolean;
  className?: string;
}

const LEVEL_ORDER: AIOutputLevel[] = ["collapsed", "default", "expanded"];

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * COMPONENTE PADRÃO de exibição de conteúdo gerado por IA — TODA saída de IA
 * no sistema deve passar por aqui (padronização 2026-08-19). Recursos
 * uniformes em todas as páginas:
 *   - Copiar (clipboard) + Baixar (.md) — CopyDownloadButtons.
 *   - 3 níveis de expansão: expanded (completo, sem scroll — PADRÃO) /
 *     default (max-h-72 + scroll interno) / collapsed (só título+controles).
 *   - Nível persistido em localStorage quando `storageKey` é passado.
 *   - Markdown + HTML embutido + charts fenced (enableCharts, default true).
 *   - Maximizar (overlay tela cheia, Esc fecha).
 *   - Badge de proveniência (provider/modelo) e botão regenerar (opcionais).
 *   - Streaming: força nível expandido (a página cresce com o conteúdo) e a
 *     janela acompanha o fim da geração até o usuário rolar manualmente.
 *   - ESCALA DE LEITURA (A−/%/A+): o conteúdo é renderizado ampliado por
 *     padrão (125%) para facilitar a leitura e destacar a saída de IA.
 *     Ajuste por card (persistido via storageKey) ou global (Configurações
 *     → "Saída de IA"). Reset clicando no % (volta ao padrão global).
 *   - BARRA DE STATUS: durante o streaming mostra tempo decorrido, ~tokens,
 *     palavras e velocidade ao vivo; ao concluir, congela as métricas
 *     (duração, tokens, tok/s, tempo de leitura). Desligável nas configs.
 *   - Acento visual: borda esquerda em `primary` distingue o conteúdo
 *     gerado por IA do restante da página.
 *   - LEITURA EM VOZ ALTA (TTS): botões Ouvir/Pausar/Parar + popover de
 *     configurações (velocidade, tom, idioma, voz) — `VoiceControls`, estado
 *     global em `voice.ts` (um falante por vez; config compartilhada com o
 *     Assistente de voz). Também disponível no modo tela cheia.
 *   - IA ANALISA IA: botão "Analisar com IA" audita criticamente a própria
 *     resposta (evidência, vieses, lacunas, confiabilidade) num card aninhado
 *     (sem recursão — o aninhado não oferece nova análise).
 */
export function AIOutputCard({
  title,
  description,
  content,
  streaming = false,
  filename,
  defaultLevel = "expanded",
  storageKey,
  icon,
  bare = false,
  provenance,
  onRegenerate,
  enableCharts = true,
  enableComponents = true,
  speak = true,
  analyzeWithAI = true,
  followStreaming,
  className = "",
}: Props) {
  const [level, setLevel] = useState<AIOutputLevel>(() => {
    if (storageKey) {
      try {
        const v = localStorage.getItem(`aso:ai-output-level:${storageKey}`);
        if (v === "collapsed" || v === "default" || v === "expanded") return v;
      } catch { /* ignore */ }
    }
    return defaultLevel;
  });
  const [fullscreen, setFullscreen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const followRef = useRef(true);
  const rafRef = useRef(0);
  // Quando o usuário rola para cima durante o streaming, o auto-follow pausa
  // (botão flutuante "Acompanhar geração" aparece para retomar).
  const [followPaused, setFollowPaused] = useState(false);

  // Escala de leitura: override do card (persistido por storageKey) > global.
  const aiOut = useAIOutputSettings();
  const [overrideScale, setOverrideScale] = useState<number | null>(() =>
    storageKey ? getCardScaleOverride(storageKey) : null,
  );
  const [localScale, setLocalScale] = useState<number | null>(null);
  useEffect(() => subscribeAIOutputSettings(() => {
    if (storageKey) setOverrideScale(getCardScaleOverride(storageKey));
  }), [storageKey]);
  const scale = overrideScale ?? localScale ?? aiOut.fontScale;
  const setScale = (v: number | null) => {
    const next = v == null ? null : clampScale(v);
    if (storageKey) {
      setCardScaleOverride(storageKey, next);
      setOverrideScale(next);
    } else {
      setLocalScale(next);
    }
  };

  // Cronômetro da geração: mede o streaming e congela as métricas ao fim.
  const [elapsed, setElapsed] = useState(0);
  const [finalStats, setFinalStats] = useState<GenerationStats | null>(null);
  const startRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wasStreamingRef = useRef(false);
  useEffect(() => {
    if (streaming && !wasStreamingRef.current) {
      startRef.current = Date.now();
      setElapsed(0);
      setFinalStats(null);
      intervalRef.current = setInterval(() => {
        setElapsed((Date.now() - startRef.current) / 1000);
      }, 500);
    } else if (!streaming && wasStreamingRef.current) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      const secs = (Date.now() - startRef.current) / 1000;
      setElapsed(secs);
      if (content) setFinalStats(generationStats(content, secs));
    }
    wasStreamingRef.current = streaming;
  }, [streaming, content]);
  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const follow = followStreaming ?? !bare;

  // Proveniência: se não passada, resolve do modo/config de IA atual (o
  // usuário vê de onde veio a resposta em todas as superfícies).
  const aiSettings = useAISettings();
  const effectiveProvenance = provenance ?? (aiSettings.mode === "none" ? undefined : aiProvenance(aiSettings));

  /* ------------------------------ leitura em voz alta (TTS) -------------- */
  // Id estável desta instância: um falante por vez no app (estado global de
  // fala em voice.ts) — clicar "Ouvir" aqui pausa/cancela outras leituras.
  const speechIdRef = useRef(`aiout:${Math.random().toString(36).slice(2)}`);

  /* --------------------- ouvir AO VIVO (durante a geração) --------------- */
  // StreamingSpeaker: fala frase a frase conforme o texto chega. O usuário
  // decide: toggle no header (override local) ou preferência global
  // `liveRead` (Config de voz). Parar = Square do VoiceControls / toggle off.
  const voiceSettings = useVoiceSettings();
  const speechState = useSpeechState();
  const liveSpeechId = `${speechIdRef.current}:live`;
  const liveActive = speechState.id === liveSpeechId;
  const [liveOverride, setLiveOverride] = useState<boolean | null>(null);
  const liveWanted = liveOverride ?? voiceSettings.liveRead;
  const liveSpeakerRef = useRef<StreamingSpeaker | null>(null);
  const wasStreamingLiveRef = useRef(false);

  const stopLive = useCallback(() => {
    liveSpeakerRef.current?.stop();
    liveSpeakerRef.current = null;
  }, []);

  // Alimenta o speaker a cada atualização do conteúdo durante o streaming.
  useEffect(() => {
    if (!streaming || !liveWanted || !speak) return;
    if (!liveSpeakerRef.current) {
      const engine = streamEngineFor(voiceSettings, listVoices().length);
      if (!engine) return;
      liveSpeakerRef.current = new StreamingSpeaker({
        id: liveSpeechId,
        settings: voiceSettings,
        engine,
      });
    }
    liveSpeakerRef.current.feed(content);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, streaming, liveWanted, speak]);

  // Fim do stream → fala o restante; toggle off / desmontagem → para tudo.
  useEffect(() => {
    if (!streaming && wasStreamingLiveRef.current) liveSpeakerRef.current?.flush();
    wasStreamingLiveRef.current = streaming;
  }, [streaming]);
  useEffect(() => {
    if (!liveWanted) stopLive();
  }, [liveWanted, stopLive]);
  useEffect(() => () => stopLive(), [stopLive]);

  /* ------------------------------ IA analisa IA -------------------------- */
  const { entries } = useDataset();
  const { selected } = useSelection();
  const [analysis, setAnalysis] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const analyzeAbortRef = useRef<AbortController | null>(null);
  useEffect(() => () => analyzeAbortRef.current?.abort(), []);

  const analyzeContent = useCallback(() => {
    if (!content) return;
    if (!isAIEnabled(aiSettings)) {
      toastError("IA desativada — ative em Configurações → Inteligência Artificial para a IA analisar a própria resposta.");
      return;
    }
    analyzeAbortRef.current?.abort();
    const ac = new AbortController();
    analyzeAbortRef.current = ac;
    setAnalyzing(true);
    setAnalysis("");
    const scope = selected.size === 0
      ? entries
      : entries.filter((e) => selected.has(entryKey(e.app.store, e.app.id)));
    const clipped = content.length > 12000 ? `${content.slice(0, 12000)}\n\n[...recortado — resposta original mais longa]` : content;
    const prompt = [
      "Analise criticamente a resposta de IA abaixo, gerada sobre os dados coletados (reviews de apps).",
      "Avalie: (1) quais afirmações têm evidência nos dados e quais parecem não ter; (2) vieses ou generalizações arriscadas;",
      "(3) lacunas — o que a análise deixou de cobrir; (4) confiabilidade geral (baixa/média/alta) e por quê;",
      "(5) próximas análises ou ações recomendadas. Responda em markdown estruturado, direto, em PT-BR.",
      "Seja honesto: se uma afirmação não tem suporte nos dados, diga explicitamente.",
      "",
      "--- RESPOSTA A ANALISAR ---",
      clipped,
    ].join("\n");
    streamExperimentChat(scope, [{ role: "user", content: prompt }], {
      onToken: (acc) => setAnalysis(acc),
      onDone: (acc) => { setAnalysis(acc); setAnalyzing(false); },
      onError: (err) => {
        setAnalyzing(false);
        setAnalysis("");
        if (err && err !== "AbortError" && !ac.signal.aborted) toastError(`Falha na análise: ${err}`);
      },
    }, ac.signal, aiSettings, scope.length > 0 ? "custom" : "os");
  }, [content, aiSettings, entries, selected]);

  const showAnalyze = analyzeWithAI && !bare && Boolean(content) && !streaming;
  const showSpeak = speak && Boolean(content) && !streaming;

  useEffect(() => {
    if (!storageKey) return;
    try { localStorage.setItem(`aso:ai-output-level:${storageKey}`, level); } catch { /* ignore */ }
  }, [level, storageKey]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFullscreen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  // Auto-follow com scroll livre: durante o streaming a página acompanha o
  // fim do conteúdo, MAS o usuário pode rolar para cima livremente — nesse
  // caso o auto-follow pausa (um clique no chip flutuante ou rolar de volta
  // ao fim retoma). Reage à GESTÃO do usuário (wheel para cima = pausa;
  // wheel até o fim = retoma), não apenas à posição — isso elimina a disputa
  // entre o auto-scroll e a rolagem manual que prendia a página embaixo.
  useEffect(() => {
    if (!streaming || !follow) return;
    followRef.current = true;
    setFollowPaused(false);
    const endVisible = () => {
      const el = endRef.current;
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.top <= window.innerHeight + 120 && r.bottom > -120;
    };
    const onWheel = (e: WheelEvent) => {
      if (!endRef.current) return;
      if (e.deltaY < -4) {
        followRef.current = false;
        setFollowPaused(true);
      } else if (endVisible()) {
        followRef.current = true;
        setFollowPaused(false);
      }
    };
    // wheel borbulha → document raiz recebe mesmo com container rolável
    // (scroll interior do AppShell é <main>, não window).
    document.addEventListener("wheel", onWheel, { passive: true });
    return () => document.removeEventListener("wheel", onWheel);
  }, [streaming, follow]);

  useEffect(() => {
    if (!streaming || !follow || !followRef.current) return;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ block: "end", inline: "nearest" });
    });
    return () => cancelAnimationFrame(rafRef.current);
  }, [content, streaming, follow]);

  const resumeFollow = () => {
    followRef.current = true;
    setFollowPaused(false);
    endRef.current?.scrollIntoView({ block: "end", inline: "nearest" });
  };

  if (!content && !streaming) return null;

  // Durante o streaming o card SEMPRE fica expandido: a página cresce com o
  // conteúdo e o usuário acompanha a geração sem rolar (auto-follow).
  const effectiveLevel: AIOutputLevel = streaming ? "expanded" : level;

  const cycle = () => {
    const idx = LEVEL_ORDER.indexOf(effectiveLevel);
    setLevel(LEVEL_ORDER[(idx + 1) % LEVEL_ORDER.length]);
  };
  const collapse = () => setLevel("collapsed");

  const levelLabel =
    effectiveLevel === "expanded" ? "Recolher para altura padrão"
    : effectiveLevel === "default" ? "Expandir conteúdo completo"
    : "Expandir";

  const fileBase = filename ?? title ?? "resposta-ia";
  const words = content ? countWords(content) : 0;

  const controls = (
    <>
      {showSpeak && (
        <VoiceControls text={content} id={speechIdRef.current} className="mr-0.5" />
      )}
      {speak && Boolean(content) && (streaming || liveActive) && (
        <button
          onClick={() => setLiveOverride(liveWanted ? false : true)}
          title={
            liveWanted
              ? "Parar de ouvir ao vivo (a IA continua gerando o texto)"
              : "Ouvir ao vivo — a IA fala enquanto gera"
          }
          aria-label={liveWanted ? "Parar leitura ao vivo" : "Ouvir enquanto a IA gera"}
          aria-pressed={liveActive}
          className={`p-1 rounded-md mr-0.5 transition-colors ${
            liveActive
              ? "text-primary bg-primary/10 hover:bg-primary/20"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary"
          }`}
        >
          <AudioLines className={`h-3.5 w-3.5 ${liveActive ? "animate-pulse" : ""}`} />
        </button>
      )}
      {showAnalyze && (
        <button
          onClick={analyzeContent}
          disabled={analyzing}
          title="Analisar esta resposta com IA (IA analisa IA)"
          aria-label="Analisar esta resposta com IA"
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-40"
        >
          <BrainCircuit className={`h-3.5 w-3.5 ${analyzing ? "animate-pulse text-primary" : ""}`} />
        </button>
      )}
      <div
        className="flex items-center rounded-md border border-border/40 mr-0.5"
        role="group"
        aria-label="Tamanho do texto do conteúdo"
      >
        <button
          onClick={() => setScale(scale - SCALE_STEP)}
          disabled={scale <= SCALE_MIN}
          title="Diminuir fonte do conteúdo"
          aria-label="Diminuir fonte do conteúdo"
          className="p-1 rounded-l-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-40"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setScale(null)}
          title={`Texto em ${scale}% — clique para voltar ao padrão (${aiOut.fontScale}%)`}
          aria-label={`Tamanho do texto ${scale}%. Redefinir para o padrão.`}
          className="px-0.5 min-w-8 text-center text-[9px] font-semibold tabular-nums text-muted-foreground hover:text-foreground transition-colors"
        >
          {scale}%
        </button>
        <button
          onClick={() => setScale(scale + SCALE_STEP)}
          disabled={scale >= SCALE_MAX}
          title="Aumentar fonte do conteúdo"
          aria-label="Aumentar fonte do conteúdo"
          className="p-1 rounded-r-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-40"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
      </div>
      {onRegenerate && (
        <button
          onClick={onRegenerate}
          title="Regenerar"
          aria-label="Regenerar análise"
          disabled={streaming}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${streaming ? "animate-spin" : ""}`} />
        </button>
      )}
      {content && <CopyDownloadButtons content={content} filename={fileBase} />}
      {content && (
        <button
          onClick={() => setFullscreen(true)}
          title="Maximizar (tela cheia)"
          aria-label="Maximizar conteúdo"
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      )}
      {effectiveLevel !== "collapsed" && (
        <button
          onClick={collapse}
          title="Recolher (só título)"
          aria-label="Recolher (só título)"
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        onClick={cycle}
        title={levelLabel}
        aria-label={levelLabel}
        className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
      >
        {effectiveLevel === "expanded"
          ? <ChevronsDownUp className="h-3.5 w-3.5" />
          : <ChevronsUpDown className="h-3.5 w-3.5" />}
      </button>
    </>
  );

  // Barra de status da geração: durante o streaming mostra métricas ao
  // vivo; ao concluir, congela duração/tokens/velocidade; em conteúdo
  // reidratado mostra só quantidades (sem tempo).
  const liveTokens = Math.round(content.length / 4);
  const statusBar = !aiOut.showStatusBar || effectiveLevel === "collapsed" ? null : (
    streaming ? (
      <div
        className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground border-t border-border/40 pt-1.5"
        role="status"
        aria-label="Status da geração"
      >
        <span className="inline-flex items-center gap-1 font-medium text-primary">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          {content ? "Gerando" : "Aguardando IA"} há {formatDuration(elapsed)}
        </span>
        {content && (
          <>
            <span className="inline-flex items-center gap-1"><Zap className="h-2.5 w-2.5" aria-hidden="true" />~{liveTokens} tokens</span>
            <span className="inline-flex items-center gap-1"><FileText className="h-2.5 w-2.5" aria-hidden="true" />{countWords(content)} palavras</span>
            {elapsed > 1 && <span>~{Math.max(1, Math.round(liveTokens / elapsed))} tok/s</span>}
          </>
        )}
      </div>
    ) : content ? (
      <div
        className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[9px] text-muted-foreground/80 border-t border-border/40 pt-1.5"
        role="status"
        aria-label="Métricas do conteúdo"
      >
        {finalStats && finalStats.seconds > 0 && (
          <span className="inline-flex items-center gap-1"><Timer className="h-2.5 w-2.5" aria-hidden="true" />gerado em {formatDuration(finalStats.seconds)}</span>
        )}
        <span className="inline-flex items-center gap-1"><Zap className="h-2.5 w-2.5" aria-hidden="true" />~{liveTokens} tokens</span>
        <span className="inline-flex items-center gap-1"><FileText className="h-2.5 w-2.5" aria-hidden="true" />{words} palavras</span>
        <span>{content.length} caracteres</span>
        {finalStats && finalStats.tokensPerSec > 0 && <span>~{finalStats.tokensPerSec} tok/s</span>}
        <span className="inline-flex items-center gap-1"><BookOpen className="h-2.5 w-2.5" aria-hidden="true" />leitura ~{Math.max(1, Math.ceil(words / 200))} min</span>
      </div>
    ) : null
  );

  const bodyRegion = (
    <div
      className={effectiveLevel === "expanded" ? "" : "max-h-72 overflow-y-auto scrollbar-thin"}
      role="region"
      aria-label={`Conteúdo de ${title ?? "IA"}`}
      aria-live={streaming ? "polite" : undefined}
    >
      {/* zoom: escala REAL de leitura (fonte, espaçamento, charts) — destaca
          o conteúdo gerado por IA do restante da interface. */}
      <div style={{ zoom: scale / 100 }} className="border-l-2 border-primary/30 pl-2.5">
        <MarkdownRenderer content={content} enableCharts={enableCharts} enableComponents={enableComponents} />
        {streaming && (
          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-2">
            {content && <span className="inline-block w-1.5 h-3.5 bg-primary/70 animate-pulse rounded-sm" aria-hidden="true" />}
          </p>
        )}
        <div ref={endRef} aria-hidden="true" />
      </div>
      {statusBar}
    </div>
  );

  // Chip flutuante "Acompanhar geração" — aparece quando o usuário pausou o
  // auto-follow rolando para cima durante o streaming. Clique retoma.
  const followChip = streaming && follow && followPaused && effectiveLevel !== "collapsed" ? (
    <button
      type="button"
      onClick={resumeFollow}
      aria-label="Acompanhar a geração (voltar ao fim)"
      className="fixed bottom-5 right-5 z-40 flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90 transition-colors animate-fade-in"
    >
      <ArrowDown className="h-3 w-3 animate-bounce" aria-hidden="true" />
      Acompanhar geração
    </button>
  ) : null;

  const overlay = fullscreen && content ? (
    <div
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={`${title ?? "Conteúdo"} em tela cheia`}
    >
      <div className="flex items-center gap-2 border-b border-border/50 px-4 py-2.5">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <h3 className="text-sm font-semibold flex-1 truncate">{title ?? "Conteúdo gerado por IA"}</h3>
        <span className="text-[10px] text-muted-foreground hidden sm:inline">{words} palavras</span>
        {speak && <VoiceControls text={content} id={`${speechIdRef.current}:fs`} withSettings={false} />}
        <CopyDownloadButtons content={content} filename={fileBase} />
        <button
          onClick={() => setFullscreen(false)}
          aria-label="Fechar tela cheia"
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4 max-w-4xl w-full mx-auto">
        <div style={{ zoom: scale / 100 }} className="border-l-2 border-primary/30 pl-3">
          <MarkdownRenderer content={content} enableCharts={enableCharts} enableComponents={enableComponents} compact={false} />
        </div>
        {statusBar}
      </div>
    </div>
  ) : null;

  if (bare) {
    return (
      <div className={className} aria-expanded={effectiveLevel !== "collapsed"}>
        {/* Header de controles: fica SEMPRE no topo do bloco (sticky), sem
            sobrepor o conteúdo — resolve o caso "ícones por cima do texto". */}
        <div className="sticky top-0 z-10 -mx-2 mb-1 flex items-center gap-0.5 border-b border-border/40 bg-card/90 px-2 py-1 backdrop-blur-sm">
          <span className="sr-only">Opções da resposta</span>
          {controls}
        </div>
        {effectiveLevel === "collapsed" ? (
          <button
            onClick={cycle}
            className="w-full text-left text-[11px] text-muted-foreground hover:text-foreground py-1.5 flex items-center gap-1.5"
          >
            <ChevronsUpDown className="h-3 w-3" /> Conteúdo recolhido — clique para expandir ({Math.round(content.length / 100) / 10}k caracteres)
          </button>
        ) : (
          bodyRegion
        )}
        {overlay}
        {followChip}
      </div>
    );
  }

  return (
    <section
      className={`rounded-lg border border-border/50 bg-card/60 ${className}`}
      aria-label={title ?? "Conteúdo gerado por IA"}
      aria-expanded={effectiveLevel !== "collapsed"}
    >
      <header className="flex items-start gap-2 px-3 py-2 flex-wrap">
        {icon && <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>}
        <div className="min-w-0 flex-1 basis-40">
          <h3 className="text-xs font-semibold text-foreground truncate flex items-center gap-1.5">
            {title ?? "Resposta"}
            {streaming && <Loader2 className="h-3 w-3 animate-spin text-primary" aria-label="Gerando" />}
          </h3>
          {description && (
            <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2">{description}</p>
          )}
        </div>
        {words > 0 && (
          <span className="shrink-0 text-[9px] text-muted-foreground/80 hidden sm:inline" title={`${words} palavras · ${content.length} caracteres`}>
            {words} palavras
          </span>
        )}
        {effectiveProvenance && (
          <span
            className="shrink-0 text-[9px] rounded-full bg-secondary/70 text-muted-foreground px-1.5 py-0.5 max-w-32 truncate"
            title={`Gerado por ${effectiveProvenance}`}
          >
            {effectiveProvenance}
          </span>
        )}
        <div className="flex items-center gap-0.5 shrink-0">{controls}</div>
      </header>

      {effectiveLevel !== "collapsed" && <div className="px-3 pb-3">{bodyRegion}</div>}
      {(analyzing || analysis) && (
        <div className="px-3 pb-3">
          <AIOutputCard
            title="Análise da resposta (IA analisa IA)"
            description="Auditoria da análise acima: evidências, vieses, lacunas e confiabilidade."
            content={analysis}
            streaming={analyzing}
            filename={`${fileBase}-analise`}
            analyzeWithAI={false}
            onRegenerate={!analyzing ? analyzeContent : undefined}
          />
        </div>
      )}
      {overlay}
      {followChip}
    </section>
  );
}
