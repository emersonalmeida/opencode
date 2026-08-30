// @vitest-environment jsdom
/**
 * Estado de fala rastreado do TTS (`voice.ts`): speakTracked/stop/pause/resume
 * com speechSynthesis mockado (jsdom não tem TTS). Prova a semântica
 * "um falante por vez" e o cancelamento tardio seguro.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  speakTracked, stopTrackedSpeech, pauseTrackedSpeech, resumeTrackedSpeech,
  getSpeechState, getVoiceSettings,
} from "@/lib/voice";

type Listener = (() => void) | null;

class FakeUtterance {
  static instances: FakeUtterance[] = [];
  text: string;
  onend: Listener = null;
  onerror: Listener = null;
  constructor(text: string) {
    this.text = text;
    FakeUtterance.instances.push(this);
  }
}

const synthMock = {
  speak: vi.fn(),
  cancel: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  getVoices: () => [],
};

beforeEach(() => {
  FakeUtterance.instances = [];
  vi.clearAllMocks();
  stopTrackedSpeech();
  Object.defineProperty(window, "speechSynthesis", { value: synthMock, configurable: true });
  Object.defineProperty(window, "SpeechSynthesisUtterance", { value: FakeUtterance, configurable: true });
});

const settings = () => ({ ...getVoiceSettings() });

describe("speakTracked — estado rastreado por origem", () => {
  it("registra o id ao falar e limpa ao concluir (onend de todos os chunks)", () => {
    speakTracked("card:1", "Olá mundo.", settings());
    expect(getSpeechState().id).toBe("card:1");
    expect(synthMock.speak).toHaveBeenCalled();
    // Conclui o primeiro (e único) chunk
    FakeUtterance.instances[0].onend?.();
    expect(getSpeechState().id).toBeNull();
  });

  it("falar de uma nova origem cancela a anterior (um falante por vez)", () => {
    speakTracked("card:1", "Primeira fala.", settings());
    speakTracked("card:2", "Segunda fala.", settings());
    expect(getSpeechState().id).toBe("card:2");
    expect(synthMock.cancel).toHaveBeenCalled();
  });

  it("cancel tardio de origem antiga NÃO interrompe a fala nova", () => {
    const cancelA = speakTracked("card:1", "Primeira fala.", settings());
    speakTracked("card:2", "Segunda fala.", settings());
    expect(getSpeechState().id).toBe("card:2");
    cancelA(); // tardio — a fala atual é do card:2
    expect(getSpeechState().id).toBe("card:2");
  });

  it("stopTrackedSpeech limpa o estado e cancela no synth", () => {
    speakTracked("card:1", "Texto.", settings());
    stopTrackedSpeech();
    expect(getSpeechState().id).toBeNull();
    expect(getSpeechState().paused).toBe(false);
    expect(synthMock.cancel).toHaveBeenCalled();
  });

  it("pause/resume alternam o estado paused", () => {
    speakTracked("card:1", "Texto.", settings());
    pauseTrackedSpeech();
    expect(getSpeechState().paused).toBe(true);
    expect(synthMock.pause).toHaveBeenCalled();
    resumeTrackedSpeech();
    expect(getSpeechState().paused).toBe(false);
    expect(synthMock.resume).toHaveBeenCalled();
  });

  it("pause sem fala ativa é no-op", () => {
    pauseTrackedSpeech();
    expect(synthMock.pause).not.toHaveBeenCalled();
    expect(getSpeechState().paused).toBe(false);
  });

  it("texto vazio/markdown-only: não inicia fala nem registra estado", () => {
    speakTracked("card:1", "```chart-pie\ndata\n```", settings());
    expect(getSpeechState().id).toBeNull();
    expect(synthMock.speak).not.toHaveBeenCalled();
  });

  it("onEnd do chamador é invocado ao concluir", () => {
    let ended = 0;
    speakTracked("card:1", "Fim.", settings(), () => ended++);
    FakeUtterance.instances[0].onend?.();
    expect(ended).toBe(1);
  });
});
