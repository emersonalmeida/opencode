/**
 * Voice — fundação do Chat com voz (`/chat-voz`).
 *
 * Dois subsistemas browser-native (sem dependências):
 *  - TTS (texto → voz): `speechSynthesis`, com chunking por frases (Chrome
 *    corta utterances longas) e seleção de voz por idioma.
 *  - Configurações de voz persistidas (`aso:voice-settings:v1`) com pub/sub.
 *
 * Também inclui `stripForSpeech` (markdown → texto falável) e
 * `detectVoiceIntent` (frases PT-BR → slash commands do OS), ambos puros e
 * testáveis. O STT (voz → texto) vive no hook `useVoiceInput` (Web Speech API → fallback Whisper local).
 */
import { useSyncExternalStore } from "react";

export interface VoiceSettings {
  /** Falar respostas da IA automaticamente. */
  autoSpeak: boolean;
  /** Microfone habilitado (botão de voz visível). */
  sttEnabled: boolean;
  /** Após falar a resposta, volta a ouvir (modo hands-free). */
  continuous: boolean;
  /** Velocidade da fala (0.5–2). */
  rate: number;
  /** Tom da fala (0–2). */
  pitch: number;
  /** Volume da fala (0–1). */
  volume: number;
  /** Mudo master (atalho sem perder o volume escolhido). */
  muted: boolean;
  /** Engine de TTS: auto (navegador se tiver voz, senão servidor local),
   *  browser (speechSynthesis) ou server (Piper/espeak local). */
  engine: "auto" | "browser" | "server";
  /** Ouvir a resposta da IA ENQUANTO ela é gerada (streaming). */
  liveRead: boolean;
  /** `voiceURI` da voz escolhida (null = padrão do sistema). */
  voiceURI: string | null;
  /** Idioma BCP-47 do reconhecimento/fala (ex.: pt-BR). */
  lang: string;
}

const STORAGE_KEY = "aso:voice-settings:v1";

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  autoSpeak: true,
  sttEnabled: true,
  continuous: false,
  rate: 1,
  pitch: 1,
  volume: 1,
  muted: false,
  engine: "auto",
  liveRead: false,
  voiceURI: null,
  lang: "pt-BR",
};

export const RATE_LIMITS = { min: 0.5, max: 2 } as const;
export const PITCH_LIMITS = { min: 0, max: 2 } as const;
export const VOLUME_LIMITS = { min: 0, max: 1 } as const;

let current: VoiceSettings = load();
const listeners = new Set<() => void>();

function load(): VoiceSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_VOICE_SETTINGS };
    return { ...DEFAULT_VOICE_SETTINGS, ...(JSON.parse(raw) as Partial<VoiceSettings>) };
  } catch {
    return { ...DEFAULT_VOICE_SETTINGS };
  }
}

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(current)); } catch { /* quota */ }
}

function emit() {
  listeners.forEach((l) => l());
}

export function getVoiceSettings(): VoiceSettings {
  return current;
}

export function setVoiceSettings(patch: Partial<VoiceSettings>) {
  current = { ...current, ...patch };
  persist();
  emit();
}

export function resetVoiceSettings() {
  current = { ...DEFAULT_VOICE_SETTINGS };
  persist();
  emit();
}

export function useVoiceSettings(): VoiceSettings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => current,
  );
}

/* ------------------------------------------------------------ detecção --- */

export function isTTSSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function isSTTSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as Record<string, unknown>;
  return typeof w.SpeechRecognition === "function" || typeof w.webkitSpeechRecognition === "function";
}

/* ---------------------------------------------------------------- TTS --- */

export function listVoices(): SpeechSynthesisVoice[] {
  if (!isTTSSupported()) return [];
  return window.speechSynthesis.getVoices();
}

/** Escolhe a melhor voz: URI explícita → idioma exato → prefixo do idioma. */
export function pickVoice(
  voices: SpeechSynthesisVoice[],
  lang: string,
  voiceURI?: string | null,
): SpeechSynthesisVoice | null {
  if (voiceURI) {
    const byURI = voices.find((v) => v.voiceURI === voiceURI);
    if (byURI) return byURI;
  }
  const exact = voices.find((v) => v.lang === lang);
  if (exact) return exact;
  const prefix = voices.find((v) => v.lang.toLowerCase().startsWith(lang.split("-")[0].toLowerCase()));
  return prefix ?? null;
}

const CHUNK_LIMIT = 220;

/** Divide texto em pedaços por frase (Chrome corta utterances longas). */
export function chunkForSpeech(text: string, limit = CHUNK_LIMIT): string[] {
  const sentences = text.split(/(?<=[.!?…:;])\s+/u).filter(Boolean);
  const chunks: string[] = [];
  let acc = "";
  for (const s of sentences) {
    if ((acc ? acc.length + 1 + s.length : s.length) > limit && acc) {
      chunks.push(acc);
      acc = "";
    }
    // Frase longa demais sozinha: corta em espaços.
    let piece = s;
    while (piece.length > limit) {
      const cut = piece.lastIndexOf(" ", limit);
      const idx = cut > 0 ? cut : limit;
      chunks.push(piece.slice(0, idx));
      piece = piece.slice(idx).trimStart();
    }
    // O split acima consome o espaço após a pontuação — repõe na junção.
    acc = acc ? `${acc} ${piece}` : piece;
  }
  if (acc) chunks.push(acc);
  return chunks;
}

/** Fala o texto (cancela a fala anterior). Retorna função de cancelamento. */
export function speak(rawText: string, settings: VoiceSettings, onEnd?: () => void): () => void {
  if (!isTTSSupported()) return () => onEnd?.();
  const text = stripForSpeech(rawText);
  if (!text.trim()) return () => onEnd?.();
  const synth = window.speechSynthesis;
  synth.cancel();
  const chunks = chunkForSpeech(text);
  const volume = settings.muted ? 0 : Math.min(VOLUME_LIMITS.max, Math.max(VOLUME_LIMITS.min, settings.volume));
  let idx = 0;
  let cancelled = false;
  const next = () => {
    if (cancelled) return;
    if (idx >= chunks.length) {
      onEnd?.();
      return;
    }
    const u = new SpeechSynthesisUtterance(chunks[idx++]);
    u.lang = settings.lang;
    u.rate = settings.rate;
    u.pitch = settings.pitch;
    u.volume = volume;
    const voice = pickVoice(listVoices(), settings.lang, settings.voiceURI);
    if (voice) u.voice = voice;
    u.onend = next;
    u.onerror = next;
    synth.speak(u);
  };
  next();
  return () => {
    cancelled = true;
    synth.cancel();
  };
}

export function stopSpeaking() {
  if (isTTSSupported()) window.speechSynthesis.cancel();
}

/**
 * Fala UM trecho SEM cancelar o que está tocando (para filas sequenciais,
 * ex.: StreamingSpeaker). Retorna cancelador do trecho.
 */
export function speakOnce(rawText: string, settings: VoiceSettings, onEnd?: () => void): () => void {
  if (!isTTSSupported()) return () => onEnd?.();
  const text = stripForSpeech(rawText);
  if (!text.trim()) return () => onEnd?.();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = settings.lang;
  u.rate = settings.rate;
  u.pitch = settings.pitch;
  u.volume = settings.muted ? 0 : Math.min(VOLUME_LIMITS.max, Math.max(VOLUME_LIMITS.min, settings.volume));
  const voice = pickVoice(listVoices(), settings.lang, settings.voiceURI);
  if (voice) u.voice = voice;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    onEnd?.();
  };
  u.onend = finish;
  u.onerror = finish;
  window.speechSynthesis.speak(u);
  return () => {
    if (done) return;
    done = true;
    try { window.speechSynthesis.cancel(); } catch { /* noop */ }
  };
}

/* --------------------------------------- fala rastreada (por origem) ----- */

/**
 * Estado global do TTS: QUAL componente está falando agora (e se está
 * pausado). Um único falante por vez (o speechSynthesis do navegador é
 * serial) — `speakTracked` de um novo id cancela o anterior.
 */
export interface SpeechState {
  /** Identificador da origem falando (ex.: id do AIOutputCard) ou null. */
  id: string | null;
  /** Fala pausada (Chrome desktop; Android ignora pause/resume). */
  paused: boolean;
}

let speechState: SpeechState = { id: null, paused: false };
let activeCancel: (() => void) | null = null;
let activePauseResume: { pause: () => void; resume: () => void } | null = null;
const speechListeners = new Set<() => void>();

function setSpeechState(next: SpeechState) {
  speechState = next;
  speechListeners.forEach((l) => l());
}

export function getSpeechState(): SpeechState {
  return speechState;
}

export function useSpeechState(): SpeechState {
  return useSyncExternalStore(
    (cb) => {
      speechListeners.add(cb);
      return () => speechListeners.delete(cb);
    },
    () => speechState,
    () => speechState,
  );
}

/**
 * Registra um falante customizado como o ativo (ex.: StreamingSpeaker ou
 * TTS de servidor): para o anterior, marca o estado e guarda cancel +
 * pause/resume (para engines sem speechSynthesis, ex.: HTMLAudioElement).
 * Retorna `unregister` — chame quando a fala terminar.
 */
export function registerActiveSpeaker(
  id: string,
  cancel: () => void,
  pauseResume?: { pause: () => void; resume: () => void },
): () => void {
  stopTrackedSpeech();
  setSpeechState({ id, paused: false });
  activeCancel = cancel;
  activePauseResume = pauseResume ?? null;
  return () => {
    if (activeCancel === cancel) {
      activeCancel = null;
      activePauseResume = null;
      if (speechState.id === id) setSpeechState({ id: null, paused: false });
    }
  };
}

/**
 * Fala o texto registrando a origem (`id`). Retorna função de cancelamento
 * — cancela SÓ se este id ainda for o falante ativo (um cancel tardio de um
 * stream antigo não interrompe a fala de um componente mais novo).
 */
export function speakTracked(
  id: string,
  rawText: string,
  settings: VoiceSettings,
  onEnd?: () => void,
): () => void {
  stopTrackedSpeech();
  if (!isTTSSupported() || !stripForSpeech(rawText).trim()) {
    onEnd?.();
    return () => { /* no-op */ };
  }
  setSpeechState({ id, paused: false });
  const cancel = speak(rawText, settings, () => {
    if (speechState.id === id) setSpeechState({ id: null, paused: false });
    if (activeCancel === wrappedCancel) activeCancel = null;
    onEnd?.();
  });
  const wrappedCancel = () => {
    if (speechState.id === id) setSpeechState({ id: null, paused: false });
    if (activeCancel === wrappedCancel) activeCancel = null;
    cancel();
  };
  activeCancel = wrappedCancel;
  return wrappedCancel;
}

/** Para a fala rastreada atual (se houver) e limpa o estado. */
export function stopTrackedSpeech() {
  activeCancel?.();
  activeCancel = null;
  activePauseResume = null;
  stopSpeaking();
  if (speechState.id !== null || speechState.paused) setSpeechState({ id: null, paused: false });
}

/** Pausa a fala em andamento (falante customizado ou speechSynthesis). */
export function pauseTrackedSpeech() {
  if (speechState.id === null || speechState.paused) return;
  if (activePauseResume) activePauseResume.pause();
  else if (isTTSSupported()) {
    try { window.speechSynthesis.pause(); } catch { /* Android ignora */ }
  }
  setSpeechState({ id: speechState.id, paused: true });
}

/** Retoma a fala pausada. */
export function resumeTrackedSpeech() {
  if (speechState.id === null || !speechState.paused) return;
  if (activePauseResume) activePauseResume.resume();
  else if (isTTSSupported()) {
    try { window.speechSynthesis.resume(); } catch { /* Android ignora */ }
  }
  setSpeechState({ id: speechState.id, paused: false });
}

/* ------------------------------------------- markdown → texto falável --- */

/**
 * Remove marcação de markdown antes de enviar ao TTS: blocos fenced
 * (código/charts), imagens, links viram texto, cabeçalhos/listas/blockquote
 * perdem símbolos, tabelas viram frases separadas por vírgulas.
 */
export function stripForSpeech(md: string): string {
  let t = md;
  t = t.replace(/```[\s\S]*?```/g, " ");
  t = t.replace(/`([^`]*)`/g, "$1");
  t = t.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  t = t.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
  t = t.replace(/^#{1,6}\s+/gm, "");
  t = t.replace(/^>\s?/gm, "");
  t = t.replace(/^[\s]*[-*+]\s+/gm, "");
  t = t.replace(/^[\s]*\d+\.\s+/gm, "");
  t = t.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1");
  t = t.replace(/__([^_]+)__/g, "$1").replace(/_([^_]+)_/g, "$1");
  t = t.replace(/\|/g, ", ");
  t = t.replace(/-{3,}|={3,}/g, " ");
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

/* ------------------------------------------------- intents de voz --------- */

/**
 * Mapeia frases PT-BR faladas para slash commands do OS (`/collect`, `/analyze`,
 * `/agent`, `/goto`, `/export`, `/stats`, `/apps`, `/memory`, `/forget`).
 * Retorna null quando a frase é linguagem natural (vai para o chat de IA).
 */
export function detectVoiceIntent(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  const rules: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
    [/^(?:colete|coletar|coleta|baixe|buscar)\s+(?:o app|o aplicativo|app)?\s*(.+)$/i,
      (m) => `/collect ${m[1]}`],
    [/^(?:analis[ei]|analisar|gerar an[aá]lise)\s+(?:de|sobre|a se[cç][aã]o)?\s*(.+)$/i,
      (m) => `/analyze ${m[1]}`],
    [/^(?:rode|rodar|execute|executar)\s+(?:o agente|agente)?\s*(.+)$/i,
      (m) => `/agent ${m[1]}`],
    [/^(?:abra|abrir|v[aá](?: para)?|ir para|navegue para)\s+(?:a p[aá]gina|o)?\s*(.+)$/i,
      (m) => `/goto ${m[1]}`],
    [/^(?:export[ei]|exportar)\s*(json|markdown|md)?/i,
      (m) => `/export ${(m[1] ?? "").toLowerCase() === "md" ? "md" : (m[1] ?? "json")}`],
    [/^(?:estat[íi]sticas|status|fatos)($|\s)/i, () => "/stats"],
    [/^(?:quais apps|liste apps|listar apps|meus apps)($|\s)/i, () => "/apps"],
    [/^(?:mem[oó]ria|o que voc[êe] aprendeu)($|\s)/i, () => "/memory"],
    [/^(?:esquecer|esque[çc]a|limpar mem[oó]ria)($|\s)/i, () => "/forget"],
    [/^(?:ajuda|comandos|o que voc[êe] pode fazer)($|\s)/i, () => "/help"],
  ];
  for (const [re, build] of rules) {
    const m = t.match(re);
    if (m) return build(m);
  }
  return null;
}
