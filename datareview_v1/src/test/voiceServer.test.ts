// @vitest-environment jsdom
/**
 * Camada de voz do Chat com voz (`voiceServer.ts` + `useVoiceInput`):
 * escolha de engines STT/TTS (navegador vs servidor local) e tradução de
 * erros de microfone em mensagens acionáveis. jsdom não tem MediaRecorder
 * nem speechSynthesis — as funções puras são testadas direto.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { pickSTTEngine, pickTTSEngine } from "@/lib/voiceServer";
import { sttErrorMessage, pickRecordingMime } from "@/hooks/useVoiceInput";

beforeEach(() => localStorage.clear());

describe("pickSTTEngine — voz → texto", () => {
  it("prefere Web Speech API quando o navegador suporta", () => {
    expect(pickSTTEngine(true, false)).toBe("webspeech");
    expect(pickSTTEngine(true, true)).toBe("webspeech");
  });

  it("cai para o Whisper local quando o navegador não suporta", () => {
    expect(pickSTTEngine(false, true)).toBe("server");
  });

  it("retorna null quando nenhum engine está disponível", () => {
    expect(pickSTTEngine(false, false)).toBeNull();
  });
});

describe("pickTTSEngine — texto → voz", () => {
  it("prefere o navegador quando há vozes instaladas", () => {
    expect(pickTTSEngine(12, false)).toBe("browser");
    expect(pickTTSEngine(1, true)).toBe("browser");
  });

  it("cai para o servidor quando o navegador tem ZERO vozes (Chrome/Linux sem speech-dispatcher)", () => {
    expect(pickTTSEngine(0, true)).toBe("server");
  });

  it("retorna null quando nem navegador nem servidor podem falar", () => {
    expect(pickTTSEngine(0, false)).toBeNull();
  });
});

describe("sttErrorMessage — erros acionáveis em PT-BR", () => {
  it("permissão negada instrui a liberar no navegador", () => {
    expect(sttErrorMessage("not-allowed")).toContain("Permissão de microfone negada");
    expect(sttErrorMessage("NotAllowedError")).toContain("Permissão de microfone negada");
    expect(sttErrorMessage("service-not-allowed")).toContain("Permissão");
  });

  it("sem microfone / mic ocupado / sem fala / idioma", () => {
    expect(sttErrorMessage("audio-capture")).toContain("Nenhum microfone");
    expect(sttErrorMessage("NotFoundError")).toContain("Nenhum microfone");
    expect(sttErrorMessage("NotReadableError")).toContain("ocupado");
    expect(sttErrorMessage("no-speech")).toContain("Não ouvi nada");
    expect(sttErrorMessage("language-not-supported")).toContain("Idioma");
  });

  it("erro de rede do Chrome aponta o Whisper local como saída", () => {
    expect(sttErrorMessage("network")).toContain("Whisper local");
  });

  it("contexto inseguro orienta localhost/HTTPS", () => {
    expect(sttErrorMessage("insecure")).toContain("localhost");
  });

  it("abort é silencioso (vazio) e códigos desconhecidos viram erro genérico", () => {
    expect(sttErrorMessage("aborted")).toBe("");
    expect(sttErrorMessage("weird-code")).toContain("weird-code");
    expect(sttErrorMessage("")).toBe("");
  });
});

describe("pickRecordingMime", () => {
  it("retorna vazio sem MediaRecorder (jsdom/navegadores antigos)", () => {
    expect(pickRecordingMime()).toBe("");
  });
});
