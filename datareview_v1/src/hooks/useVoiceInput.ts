/**
 * useVoiceInput — STT unificado (voz → texto) para o Chat com voz.
 *
 * Dois engines, escolhidos automaticamente (`pickSTTEngine`):
 *  - "webspeech": Web Speech API (Chrome/Edge) — tempo real com interim,
 *    mas exige Chrome + internet (áudio vai ao Google).
 *  - "server": MediaRecorder grava o áudio → `/functions/v1/stt` transcreve
 *    com Whisper LOCAL (faster-whisper/whisper.cpp) — funciona em qualquer
 *    navegador moderno, 100% offline, usa a GPU da máquina.
 *
 * Erros são traduzidos em mensagens ACIONÁVEIS (`sttErrorMessage`) — o
 * usuário sempre sabe o que fazer (permitir mic, instalar backend etc.).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { isSTTSupported } from "@/lib/voice";
import { getVoiceCapabilities, pickSTTEngine, transcribeAudio } from "@/lib/voiceServer";

export type VoiceInputEngine = "webspeech" | "server";
export type VoiceInputState = "idle" | "listening" | "recording" | "transcribing";

export interface VoiceInputControls {
  /** Engine em uso (null = nenhum disponível). */
  engine: VoiceInputEngine | null;
  state: VoiceInputState;
  /** true enquanto captura (listening ou recording). */
  active: boolean;
  /** Transcrição parcial (só webspeech). */
  interim: string;
  error: string | null;
  /** Começa a captura (mic). No modo server, `start` grava e `stop` transcreve. */
  start: () => void;
  /** Para a captura; no modo server, dispara a transcrição do que foi gravado. */
  stop: () => void;
  /** Re-detecta capacidades (após instalar backend / trocar permissão). */
  refresh: () => Promise<void>;
}

interface Options {
  lang: string;
  onFinal: (text: string) => void;
  onEnd?: () => void;
}

/** Traduz códigos de erro (Web Speech / getUserMedia / rede) para PT-BR acionável. */
export function sttErrorMessage(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
    case "NotAllowedError":
      return "Permissão de microfone negada. Libere o microfone no cadeado da barra de endereço e tente de novo.";
    case "audio-capture":
    case "NotFoundError":
      return "Nenhum microfone encontrado. Conecte um microfone e tente de novo.";
    case "no-speech":
      return "Não ouvi nada — fale mais perto do microfone.";
    case "network":
      return "O reconhecimento do Chrome precisa de internet. Sem internet? Use o Whisper local (painel Voz).";
    case "aborted":
      return "";
    case "language-not-supported":
      return "Idioma não suportado pelo reconhecimento do navegador — troque o idioma no painel Voz.";
    case "NotReadableError":
      return "Microfone ocupado por outro aplicativo — feche-o e tente de novo.";
    case "insecure":
      return "O microfone só funciona em HTTPS ou localhost — acesse por http://localhost ou HTTPS.";
    default:
      return code ? `Erro no microfone: ${code}` : "";
  }
}

/** Escolhe o MIME de gravação suportado pelo navegador. */
export function pickRecordingMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

interface Recog {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: (e: { resultIndex: number; results: { length: number; [i: number]: { isFinal: boolean; [u: number]: { transcript: string } } } }) => void;
  onerror: (e: { error: string }) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export function useVoiceInput({ lang, onFinal, onEnd }: Options): VoiceInputControls {
  const [engine, setEngine] = useState<VoiceInputEngine | null>(() =>
    isSTTSupported() ? "webspeech" : null,
  );
  const [state, setState] = useState<VoiceInputState>("idle");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<Recog | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  const langRef = useRef(lang);
  langRef.current = lang;

  const refresh = useCallback(async () => {
    if (isSTTSupported()) {
      setEngine("webspeech");
      return;
    }
    const caps = await getVoiceCapabilities();
    setEngine(pickSTTEngine(false, Boolean(caps?.stt.available)));
  }, []);

  // Descoberta inicial: sem Web Speech API, pergunta ao servidor se há Whisper.
  useEffect(() => {
    if (!isSTTSupported()) void refresh();
  }, [refresh]);

  const cleanupMic = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  /* ------------------------------------------------ webspeech (Chrome) --- */
  const startWebSpeech = useCallback(() => {
    const w = window as unknown as Record<string, unknown>;
    const Ctor = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as (new () => Recog) | undefined;
    if (!Ctor) return;
    recRef.current?.abort();
    const rec = new Ctor();
    recRef.current = rec;
    rec.lang = langRef.current;
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) {
          setInterim("");
          onFinalRef.current(res[0].transcript);
        } else {
          interimText += res[0].transcript;
        }
      }
      if (interimText) setInterim(interimText);
    };
    rec.onerror = (e) => {
      const msg = sttErrorMessage(e.error);
      if (msg) setError(msg);
    };
    rec.onend = () => {
      setState("idle");
      setInterim("");
      onEndRef.current?.();
    };
    setError(null);
    setState("listening");
    rec.start();
  }, []);

  /* ------------------------------------- server (MediaRecorder → Whisper) */
  const startServerRecording = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError(sttErrorMessage("insecure"));
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setError("Este navegador não grava áudio (MediaRecorder ausente). Use Chrome/Firefox/Edge.");
      return;
    }
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mime = pickRecordingMime();
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        cleanupMic();
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        chunksRef.current = [];
        if (blob.size < 800) {
          // Muito curto: provavelmente toque sem fala — não transcreve.
          setState("idle");
          onEndRef.current?.();
          return;
        }
        setState("transcribing");
        try {
          const text = await transcribeAudio(blob, langRef.current);
          if (text) onFinalRef.current(text);
          else setError(sttErrorMessage("no-speech"));
        } catch (e) {
          setError(e instanceof Error ? e.message : "Falha na transcrição local.");
        } finally {
          setState("idle");
          onEndRef.current?.();
        }
      };
      recorder.start();
      setState("recording");
    } catch (e) {
      cleanupMic();
      const name = e instanceof Error ? e.name : "";
      setError(sttErrorMessage(name || "audio-capture"));
    }
  }, [cleanupMic]);

  const start = useCallback(() => {
    if (engine === "webspeech") startWebSpeech();
    else if (engine === "server") void startServerRecording();
  }, [engine, startWebSpeech, startServerRecording]);

  const stop = useCallback(() => {
    if (engine === "webspeech") {
      recRef.current?.stop();
      setState("idle");
      setInterim("");
    } else if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop(); // onstop transcreve
    }
  }, [engine]);

  useEffect(
    () => () => {
      recRef.current?.abort();
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      cleanupMic();
    },
    [cleanupMic],
  );

  return {
    engine,
    state,
    active: state === "listening" || state === "recording",
    interim,
    error,
    start,
    stop,
    refresh,
  };
}
