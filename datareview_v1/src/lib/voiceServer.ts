/**
 * Voice server bridge — backends de voz LOCAIS via servidor (porta 8787).
 *
 * O navegador nem sempre resolve voz sozinho:
 *  - STT (voz→texto): SpeechRecognition só existe no Chrome/Edge e exige
 *    internet (envia áudio ao Google). Firefox/outros: sem suporte.
 *  - TTS (texto→voz): speechSynthesis no Linux sem speech-dispatcher fica
 *    com ZERO vozes e falha em silêncio.
 *
 * Esta camada pergunta ao servidor local o que está instalado
 * (`/functions/v1/voice-status`) e oferece:
 *  - `transcribeAudio(blob, lang)` — Whisper local (faster-whisper/whisper.cpp);
 *  - `speakViaServer(text, settings)` — Piper/espeak local → WAV → Audio.
 *
 * Com fallback inteligente: `speakSmart` usa o navegador quando tem vozes e
 * o servidor quando não tem (ou quando o usuário preferir).
 */
import { useSyncExternalStore } from "react";
import { apiUrl } from "@/lib/apiBase";
import {
  listVoices,
  registerActiveSpeaker,
  speak,
  speakOnce,
  speakTracked,
  stripForSpeech,
  type VoiceSettings,
} from "@/lib/voice";
import type { StreamEngine } from "@/lib/voiceStream";

const SUPA_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export interface VoiceServerCaps {
  stt: { engine: string | null; available: boolean; detail?: string };
  tts: { engine: string | null; available: boolean; detail?: string };
  hints: { id: string; title: string; commands: string[] }[];
}

let capsCache: VoiceServerCaps | null = null;
let capsAt = 0;
let inflight: Promise<VoiceServerCaps | null> | null = null;
const CAPS_TTL = 20_000;

/** Busca as capacidades de voz do servidor local (cache 20s + dedup). */
export async function getVoiceCapabilities(force = false): Promise<VoiceServerCaps | null> {
  if (!force && capsCache && Date.now() - capsAt < CAPS_TTL) return capsCache;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const resp = await fetch(apiUrl(`/functions/v1/voice-status${force ? "?refresh=1" : ""}`), {
        headers: { Authorization: `Bearer ${SUPA_KEY}` },
        signal: AbortSignal.timeout(15_000),
      });
      if (!resp.ok) return capsCache;
      const data = (await resp.json()) as VoiceServerCaps;
      capsCache = data;
      capsAt = Date.now();
      notifyVoiceCapsChanged();
      return data;
    } catch {
      return capsCache; // servidor fora do ar → null/último cache
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/* ------------------------------------------------------------ STT -------- */

/** Transcreve um blob de áudio (MediaRecorder) via Whisper local. */
export async function transcribeAudio(blob: Blob, lang: string): Promise<string> {
  const resp = await fetch(apiUrl(`/functions/v1/stt?lang=${encodeURIComponent(lang)}`), {
    method: "POST",
    headers: {
      "Content-Type": blob.type || "audio/webm",
      Authorization: `Bearer ${SUPA_KEY}`,
    },
    body: blob,
  });
  const data = (await resp.json().catch(() => ({}))) as { text?: string; error?: string; empty?: boolean };
  if (!resp.ok) throw new Error(data.error || `Erro ${resp.status} na transcrição`);
  return (data.text ?? "").trim();
}

/* ------------------------------------------------------------ TTS -------- */

/** Escolhe o engine de TTS: navegador (se tem vozes) → servidor local. */
export function pickTTSEngine(
  browserVoices: number,
  serverAvailable: boolean,
): "browser" | "server" | null {
  if (browserVoices > 0) return "browser";
  if (serverAvailable) return "server";
  return null;
}

/** Escolhe o engine de STT: Web Speech API (Chrome) → Whisper no servidor. */
export function pickSTTEngine(
  browserSupported: boolean,
  serverAvailable: boolean,
): "webspeech" | "server" | null {
  if (browserSupported) return "webspeech";
  if (serverAvailable) return "server";
  return null;
}

let serverAudio: HTMLAudioElement | null = null;

/** Para qualquer áudio de TTS de servidor em reprodução. */
export function stopServerAudio() {
  if (serverAudio) {
    try { serverAudio.pause(); } catch { /* noop */ }
    serverAudio = null;
  }
}

/** Pausa o áudio de TTS de servidor (HTMLAudioElement). */
export function pauseServerAudio() {
  try { serverAudio?.pause(); } catch { /* noop */ }
}

/** Retoma o áudio de TTS de servidor pausado. */
export function resumeServerAudio() {
  try { void serverAudio?.play().catch(() => { /* noop */ }); } catch { /* noop */ }
}

/** Volume efetivo (0–1) considerando o mudo master. */
function effectiveVolume(settings: VoiceSettings): number {
  if (settings.muted) return 0;
  return Math.min(1, Math.max(0, settings.volume));
}

/**
 * Fala texto via servidor (Piper/espeak → WAV). Retorna cancelador.
 * Chama onError com mensagem amigável quando o backend falta.
 */
export async function speakViaServer(
  text: string,
  settings: VoiceSettings,
  onEnd?: () => void,
  onError?: (msg: string) => void,
): Promise<() => void> {
  const clean = stripForSpeech(text);
  if (!clean.trim()) {
    onEnd?.();
    return () => {};
  }
  stopServerAudio();
  let cancelled = false;
  const ac = new AbortController();
  const cancel = () => {
    cancelled = true;
    ac.abort();
    stopServerAudio();
  };
  try {
    const resp = await fetch(apiUrl("/functions/v1/tts"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPA_KEY}` },
      body: JSON.stringify({ text: clean, lang: settings.lang, speed: settings.rate }),
      signal: ac.signal,
    });
    if (!resp.ok) {
      const data = (await resp.json().catch(() => ({}))) as { error?: string };
      if (!cancelled) {
        onError?.(data.error || "TTS local indisponível — instale piper-tts ou espeak-ng (ver painel Voz).");
        onEnd?.();
      }
      return cancel;
    }
    const blob = await resp.blob();
    if (cancelled) return cancel;
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.volume = effectiveVolume(settings);
    serverAudio = audio;
    audio.onended = () => {
      URL.revokeObjectURL(url);
      if (serverAudio === audio) serverAudio = null;
      if (!cancelled) onEnd?.();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      if (!cancelled) {
        onError?.("Falha ao reproduzir o áudio gerado.");
        onEnd?.();
      }
    };
    await audio.play().catch(() => {
      if (!cancelled) {
        onError?.("Navegador bloqueou a reprodução de áudio — interaja com a página primeiro.");
        onEnd?.();
      }
    });
  } catch (e) {
    if (!cancelled) {
      onError?.(e instanceof Error && e.name === "AbortError" ? "" : "Falha ao gerar voz no servidor local.");
      onEnd?.();
    }
  }
  return cancel;
}

/**
 * TTS inteligente: navegador quando tem vozes, senão servidor local.
 * Retorna cancelador (pode resolver async — o cancel funciona em qualquer ponto).
 */
export function speakSmart(
  text: string,
  settings: VoiceSettings,
  browserVoiceCount: number,
  onEnd?: () => void,
  onError?: (msg: string) => void,
): { cancel: () => void } {
  const engine = pickTTSEngine(browserVoiceCount, false);
  if (engine === "browser") {
    const cancel = speak(text, settings, onEnd);
    return { cancel };
  }
  // Sem vozes no navegador: tenta servidor (verificação assíncrona).
  let cancelFn: (() => void) | null = null;
  let cancelled = false;
  void (async () => {
    const caps = await getVoiceCapabilities();
    if (cancelled) return;
    if (!caps?.tts.available) {
      onError?.("Sem vozes no navegador e nenhum TTS local instalado — veja o painel Voz para instalar (piper-tts).");
      onEnd?.();
      return;
    }
    cancelFn = await speakViaServer(text, settings, onEnd, onError);
  })();
  return {
    cancel: () => {
      cancelled = true;
      cancelFn?.();
      stopServerAudio();
    },
  };
}

/**
 * Fala rastreada com escolha de engine respeitando a PREFERÊNCIA do usuário:
 *  - `engine: "browser"` → sempre speechSynthesis;
 *  - `engine: "server"` → sempre Piper/espeak local;
 *  - `engine: "auto"` → navegador se tiver vozes, senão servidor.
 * Registra no estado global (Play/Pause/Parar do VoiceControls funcionam
 * igual nos dois engines; o servidor pausa de verdade via HTMLAudioElement).
 */
export function speakTrackedSmart(
  id: string,
  text: string,
  settings: VoiceSettings,
  onEnd?: () => void,
  onError?: (msg: string) => void,
): () => void {
  const browserVoices = listVoices().length;
  const useBrowser =
    settings.engine === "browser" ||
    (settings.engine === "auto" && browserVoices > 0);

  if (useBrowser) {
    return speakTracked(id, text, settings, onEnd);
  }

  // Engine servidor (explícito ou fallback sem vozes no navegador).
  let cancelFn: (() => void) | null = null;
  let cancelled = false;
  const unregister = registerActiveSpeaker(
    id,
    () => {
      cancelled = true;
      cancelFn?.();
      stopServerAudio();
    },
    { pause: pauseServerAudio, resume: resumeServerAudio },
  );
  void (async () => {
    const caps = await getVoiceCapabilities();
    if (cancelled) return;
    if (!caps?.tts.available) {
      unregister();
      onError?.(
        settings.engine === "server"
          ? "TTS local (servidor) indisponível — instale com: npm run voice:setup (ver painel Voz)."
          : "Sem vozes no navegador e nenhum TTS local instalado — veja o painel Voz (npm run voice:setup).",
      );
      onEnd?.();
      return;
    }
    cancelFn = await speakViaServer(text, settings, () => {
      unregister();
      onEnd?.();
    }, (msg) => {
      unregister();
      onError?.(msg);
      onEnd?.();
    });
  })();
  return () => {
    cancelled = true;
    cancelFn?.();
    stopServerAudio();
    unregister();
  };
}

/**
 * Engine de streaming para o `StreamingSpeaker` ("ouvir ao vivo"):
 * navegador fala trecho a trecho com `speakOnce`; servidor gera WAV por
 * frase (fila do speaker serializa as chamadas). Pause/resume mapeados.
 */
export function streamEngineFor(settings: VoiceSettings, browserVoiceCount: number): StreamEngine | null {
  const useBrowser =
    settings.engine === "browser" ||
    (settings.engine === "auto" && browserVoiceCount > 0);

  if (useBrowser) {
    return {
      speak: (text, onEnd) => speakOnce(text, settings, onEnd),
      pause: () => {
        try { window.speechSynthesis.pause(); } catch { /* noop */ }
      },
      resume: () => {
        try { window.speechSynthesis.resume(); } catch { /* noop */ }
      },
    };
  }
  // Servidor: cada frase vira um WAV (Piper é rápido após a 1ª carga).
  return {
    speak: (text, onEnd) => {
      let cancelFn: (() => void) | null = null;
      let cancelled = false;
      void (async () => {
        cancelFn = await speakViaServer(text, settings, () => {
          if (!cancelled) onEnd();
        }, () => {
          if (!cancelled) onEnd(); // erro numa frase não mata a fila
        });
      })();
      return () => {
        cancelled = true;
        cancelFn?.();
        stopServerAudio();
      };
    },
    pause: pauseServerAudio,
    resume: resumeServerAudio,
  };
}

/* ------------------------------------------- estado reativo das caps ----- */

const capsListeners = new Set<() => void>();

/** Notifica ouvintes quando as capacidades são re-detectadas. */
export function notifyVoiceCapsChanged() {
  capsListeners.forEach((l) => l());
}

/** Hook leve para forçar re-render quando as caps do servidor mudam. */
export function useVoiceCapsVersion(): number {
  return useSyncExternalStore(
    (cb) => {
      capsListeners.add(cb);
      return () => capsListeners.delete(cb);
    },
    () => capsAt,
    () => capsAt,
  );
}
