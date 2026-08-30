/**
 * voiceStream — fala DURANTE a geração da IA ("ouvir ao vivo").
 *
 * O texto chega token a token; o `StreamingSpeaker` acumula um buffer,
 * extrai frases COMPLETAS assim que terminam (pontuação final / quebra de
 * parágrafo), limpa markdown e enfileira para um engine de TTS sequencial.
 * No fim do stream, `flush()` fala o restante.
 *
 * O engine é injetável (`StreamEngine`) — navegador (speechSynthesis) ou
 * servidor local (Piper) — o que torna o núcleo 100% testável sem DOM.
 *
 * Coordenação global: o speaker se registra como falante ativo via
 * `registerActiveSpeaker`, então Play/Pause/Parar do `VoiceControls` e a
 * regra de "um falante por vez" funcionam igual para fala ao vivo.
 */
import {
  chunkForSpeech,
  registerActiveSpeaker,
  stripForSpeech,
  type VoiceSettings,
} from "@/lib/voice";

/** Engine de fala por trecho (injetável/testável). */
export interface StreamEngine {
  /** Fala o trecho; chama onEnd ao terminar (sucesso ou erro). Retorna cancelador. */
  speak(text: string, onEnd: () => void): () => void;
  pause(): void;
  resume(): void;
}

/**
 * Extrai frases completas de um buffer incremental.
 * Uma frase está completa quando termina em `. ! ? … ; :` seguido de
 * espaço/quebra, ou em quebra de linha. O resto (frase incompleta) volta
 * em `rest` para a próxima rodada.
 */
export function extractSentences(buffer: string): { sentences: string[]; rest: string } {
  const sentences: string[] = [];
  let rest = buffer;
  // Procura o fim da ÚLTIMA frase completa no buffer.
  let cut = -1;
  const re = /[.!?…;:]\s|\n+|(?:[.!?…;:])$/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(buffer)) !== null) {
    cut = m.index + m[0].length;
  }
  if (cut > 0) {
    const done = buffer.slice(0, cut);
    rest = buffer.slice(cut);
    // Re-divide a parte completa em frases individuais.
    for (const piece of done.split(/(?<=[.!?…;:])\s+|\n+/u)) {
      const clean = piece.trim();
      if (clean) sentences.push(clean);
    }
  }
  return { sentences, rest };
}

/** Limpa markdown e divide frases longas demais para o TTS. */
export function toSpeakableChunks(sentences: string[], limit = 220): string[] {
  const out: string[] = [];
  for (const s of sentences) {
    const clean = stripForSpeech(s);
    if (!clean) continue;
    out.push(...chunkForSpeech(clean, limit));
  }
  return out;
}

interface Options {
  /** Id do falante (ex.: id do AIOutputCard) — regra de um falante por vez. */
  id: string;
  settings: VoiceSettings;
  engine: StreamEngine;
  /** Aviso de erro (ex.: backend de voz faltando) — a fala para. */
  onError?: (msg: string) => void;
}

export class StreamingSpeaker {
  private buffer = "";
  private consumed = 0;
  private queue: string[] = [];
  private speaking = false;
  private stopped = false;
  private paused = false;
  private flushed = false;
  private cancelCurrent: (() => void) | null = null;
  private unregister: () => void;
  readonly id: string;

  constructor(private opts: Options) {
    this.id = opts.id;
    this.unregister = registerActiveSpeaker(
      opts.id,
      () => this.stop(),
      {
        pause: () => this.pauseFromGlobal(),
        resume: () => this.resumeFromGlobal(),
      },
    );
  }

  /**
   * Alimenta o texto COMPLETO gerado até agora (o componente passa o
   * conteúdo inteiro a cada atualização; o speaker só consome o delta).
   */
  feed(fullText: string) {
    if (this.stopped) return;
    // Stream reiniciado (regeneração): descarta o que já foi falado.
    if (fullText.length < this.consumed) {
      this.buffer = fullText;
      this.consumed = 0;
      this.queue = [];
    }
    this.buffer = fullText;
    const pending = this.buffer.slice(this.consumed);
    const { sentences, rest } = extractSentences(pending);
    if (sentences.length === 0) return;
    this.consumed = this.buffer.length - rest.length;
    const chunks = toSpeakableChunks(sentences);
    if (chunks.length > 0) {
      this.queue.push(...chunks);
      this.pump();
    }
  }

  /** Fim do stream: fala o que sobrou no buffer (frase final incompleta). */
  flush() {
    if (this.stopped) return;
    this.flushed = true;
    const pending = this.buffer.slice(this.consumed);
    this.consumed = this.buffer.length;
    const chunks = toSpeakableChunks([pending]);
    if (chunks.length > 0) {
      this.queue.push(...chunks);
      this.pump();
    }
  }

  /** Para tudo e libera o estado global de falante. */
  stop() {
    if (this.stopped) return;
    this.stopped = true;
    this.queue = [];
    this.cancelCurrent?.();
    this.cancelCurrent = null;
    this.unregister();
  }

  pause() {
    if (this.stopped || this.paused) return;
    this.paused = true;
    this.opts.engine.pause();
  }

  resume() {
    if (this.stopped || !this.paused) return;
    this.paused = false;
    this.opts.engine.resume();
    this.pump();
  }

  get isPaused() {
    return this.paused;
  }

  private pauseFromGlobal() {
    this.pause();
  }

  private resumeFromGlobal() {
    this.resume();
  }

  private pump() {
    if (this.stopped || this.paused || this.speaking) return;
    const next = this.queue.shift();
    if (next === undefined) {
      // Fila vazia: se o stream já ACABOU (flush) e tudo foi falado, encerra.
      if (this.flushed && this.consumed >= this.buffer.length) this.unregisterQuiet();
      return;
    }
    this.speaking = true;
    this.cancelCurrent = this.opts.engine.speak(next, () => {
      this.speaking = false;
      this.cancelCurrent = null;
      this.pump();
    });
  }

  /** Fila esvaziou naturalmente: libera o estado global sem "stop". */
  private unregisterQuiet() {
    if (this.stopped) return;
    this.stopped = true;
    this.unregister();
  }
}
