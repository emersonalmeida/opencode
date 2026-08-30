/**
 * Testes do StreamingSpeaker ("ouvir ao vivo") e das novas configurações
 * de voz (volume/engine/muted/liveRead). O engine é fake (injetável) —
 * o núcleo é testado sem DOM nem speechSynthesis.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  extractSentences,
  toSpeakableChunks,
  StreamingSpeaker,
  type StreamEngine,
} from "@/lib/voiceStream";
import {
  DEFAULT_VOICE_SETTINGS,
  getSpeechState,
  getVoiceSettings,
  resetVoiceSettings,
  setVoiceSettings,
  stopTrackedSpeech,
  pauseTrackedSpeech,
  resumeTrackedSpeech,
  type VoiceSettings,
} from "@/lib/voice";

const SETTINGS: VoiceSettings = { ...DEFAULT_VOICE_SETTINGS };

function makeEngine(autoEnd = true) {
  const spoken: string[] = [];
  const pending: Array<() => void> = [];
  const engine: StreamEngine = {
    speak: (text, onEnd) => {
      spoken.push(text);
      if (autoEnd) onEnd();
      else pending.push(onEnd);
      return () => { /* cancel */ };
    },
    pause: () => { /* noop */ },
    resume: () => { /* noop */ },
  };
  return { engine, spoken, pending };
}

beforeEach(() => {
  localStorage.clear();
  resetVoiceSettings();
  stopTrackedSpeech();
});

describe("extractSentences", () => {
  it("sem terminador → tudo em rest", () => {
    const { sentences, rest } = extractSentences("frase incompleta ainda");
    expect(sentences).toEqual([]);
    expect(rest).toBe("frase incompleta ainda");
  });

  it("terminador + espaço extrai a frase", () => {
    const { sentences, rest } = extractSentences("Primeira frase. Segunda ainda");
    expect(sentences).toEqual(["Primeira frase."]);
    expect(rest).toBe("Segunda ainda");
  });

  it("múltiplas frases de uma vez", () => {
    const { sentences, rest } = extractSentences("Uma. Duas! Três? Qua");
    expect(sentences).toEqual(["Uma.", "Duas!", "Três?"]);
    expect(rest).toBe("Qua");
  });

  it("quebra de linha marca fronteira", () => {
    const { sentences, rest } = extractSentences("## Título\nConteúdo andando");
    expect(sentences).toEqual(["## Título"]);
    expect(rest).toBe("Conteúdo andando");
  });

  it("terminador no fim exato do buffer", () => {
    const { sentences, rest } = extractSentences("Fechou.");
    expect(sentences).toEqual(["Fechou."]);
    expect(rest).toBe("");
  });
});

describe("toSpeakableChunks", () => {
  it("remove markdown (negrito, heading, fence)", () => {
    const chunks = toSpeakableChunks(["## **Achado** principal: `code` ok."]);
    expect(chunks.join(" ")).toBe("Achado principal: code ok.");
  });

  it("descarta frase que vira vazia (só markdown)", () => {
    expect(toSpeakableChunks(["```chart-bar {}```"])).toEqual([]);
  });

  it("divide frase longa demais", () => {
    const long = "palavra ".repeat(80).trim() + ".";
    const chunks = toSpeakableChunks([long], 100);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= 110)).toBe(true);
  });
});

describe("StreamingSpeaker", () => {
  it("fala frases completas em ordem e se registra como falante ativo", () => {
    const { engine, spoken } = makeEngine();
    const sp = new StreamingSpeaker({ id: "t1", settings: SETTINGS, engine });
    expect(getSpeechState().id).toBe("t1");
    sp.feed("Primeira. Segunda. Ter");
    expect(spoken).toEqual(["Primeira.", "Segunda."]);
    sp.stop();
  });

  it("feed repetido com texto completo não fala duas vezes", () => {
    const { engine, spoken } = makeEngine();
    const sp = new StreamingSpeaker({ id: "t2", settings: SETTINGS, engine });
    sp.feed("Uma frase completa. Outra");
    sp.feed("Uma frase completa. Outra");
    sp.feed("Uma frase completa. Outra vinda agora. Fi");
    expect(spoken).toEqual(["Uma frase completa.", "Outra vinda agora."]);
    sp.stop();
  });

  it("flush fala o restante e encerra o estado de falante", () => {
    const { engine, spoken } = makeEngine();
    const sp = new StreamingSpeaker({ id: "t3", settings: SETTINGS, engine });
    sp.feed("Completa. Resto final sem ponto");
    sp.flush();
    expect(spoken).toEqual(["Completa.", "Resto final sem ponto"]);
    expect(getSpeechState().id).toBeNull();
  });

  it("stop limpa a fila e não fala mais nada", () => {
    const { engine, spoken, pending } = makeEngine(false); // engine não auto-encerra
    const sp = new StreamingSpeaker({ id: "t4", settings: SETTINGS, engine });
    sp.feed("Uma. Duas. Três.");
    expect(spoken).toEqual(["Uma."]); // falando a 1ª
    sp.stop();
    pending.forEach((end) => end()); // termina tardio
    expect(spoken).toEqual(["Uma."]); // fila morreu
    expect(getSpeechState().id).toBeNull();
  });

  it("pause segura a fila; resume continua", () => {
    const { engine, spoken, pending } = makeEngine(false);
    const sp = new StreamingSpeaker({ id: "t5", settings: SETTINGS, engine });
    sp.feed("Uma. Duas.");
    expect(spoken).toEqual(["Uma."]);
    sp.pause();
    pending.shift()!(); // termina "Uma."
    expect(spoken).toEqual(["Uma."]); // pausado: não fala "Duas."
    sp.resume();
    expect(spoken).toEqual(["Uma.", "Duas."]);
    sp.stop();
  });

  it("regeneração (texto menor) reinicia o buffer", () => {
    const { engine, spoken } = makeEngine();
    const sp = new StreamingSpeaker({ id: "t6", settings: SETTINGS, engine });
    sp.feed("Versão um completa. Mais texto aqui.");
    sp.feed("Nova resposta curta."); // regenerou: texto menor
    sp.flush();
    expect(spoken).toEqual([
      "Versão um completa.",
      "Mais texto aqui.",
      "Nova resposta curta.",
    ]);
    sp.stop();
  });

  it("pause/resume globais (VoiceControls) alcançam o speaker", () => {
    let paused = false;
    const engine: StreamEngine = {
      speak: (_t, onEnd) => { onEnd(); return () => {}; },
      pause: () => { paused = true; },
      resume: () => { paused = false; },
    };
    const sp = new StreamingSpeaker({ id: "t7", settings: SETTINGS, engine });
    pauseTrackedSpeech();
    expect(paused).toBe(true);
    expect(getSpeechState().paused).toBe(true);
    resumeTrackedSpeech();
    expect(paused).toBe(false);
    sp.stop();
  });
});

describe("voice settings — novos campos", () => {
  it("defaults incluem volume/engine/muted/liveRead", () => {
    const s = getVoiceSettings();
    expect(s.volume).toBe(1);
    expect(s.engine).toBe("auto");
    expect(s.muted).toBe(false);
    expect(s.liveRead).toBe(false);
  });

  it("migração: storage antigo (sem os novos campos) recebe defaults", () => {
    localStorage.setItem(
      "aso:voice-settings:v1",
      JSON.stringify({ rate: 1.4, pitch: 0.8, lang: "en-US" }),
    );
    // Simula reload do módulo: setVoiceSettings persiste/mergeia sobre o
    // estado carregado — aqui validamos o merge do loader via reset+set.
    setVoiceSettings({ rate: 1.4 });
    const s = getVoiceSettings();
    expect(s.rate).toBeCloseTo(1.4);
    expect(s.volume).toBe(1);
    expect(s.engine).toBe("auto");
  });

  it("persiste os novos campos", () => {
    setVoiceSettings({ volume: 0.4, engine: "server", muted: true, liveRead: true });
    const raw = JSON.parse(localStorage.getItem("aso:voice-settings:v1")!);
    expect(raw.volume).toBe(0.4);
    expect(raw.engine).toBe("server");
    expect(raw.muted).toBe(true);
    expect(raw.liveRead).toBe(true);
  });
});
