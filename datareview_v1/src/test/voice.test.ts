/**
 * Testes da fundação de voz do Chat com voz (`/chat-voz`) — configurações,
 * TTS helpers, markdown → texto falável e intents de voz → comandos.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_VOICE_SETTINGS,
  getVoiceSettings,
  setVoiceSettings,
  resetVoiceSettings,
  detectVoiceIntent,
  stripForSpeech,
  pickVoice,
  chunkForSpeech,
  isSTTSupported,
} from "@/lib/voice";

beforeEach(() => {
  localStorage.clear();
  resetVoiceSettings();
});

describe("voice settings", () => {
  it("defaults (auto-falar on, STT on, hands-free off)", () => {
    const s = getVoiceSettings();
    expect(s.autoSpeak).toBe(true);
    expect(s.sttEnabled).toBe(true);
    expect(s.continuous).toBe(false);
    expect(s.lang).toBe("pt-BR");
  });

  it("set + persist + get", () => {
    setVoiceSettings({ rate: 1.5, voiceURI: "x", autoSpeak: false });
    const s = getVoiceSettings();
    expect(s.rate).toBe(1.5);
    expect(s.voiceURI).toBe("x");
    expect(s.autoSpeak).toBe(false);
    expect(JSON.parse(localStorage.getItem("aso:voice-settings:v1") ?? "{}").rate).toBe(1.5);
  });

  it("storage corrompido → defaults", () => {
    localStorage.setItem("aso:voice-settings:v1", "{broken");
    resetVoiceSettings();
    expect(getVoiceSettings()).toEqual(DEFAULT_VOICE_SETTINGS);
  });
});

describe("pickVoice", () => {
  const voices = [
    { lang: "pt-BR", name: "pt", voiceURI: "pt-voice" },
    { lang: "en-US", name: "en", voiceURI: "en-voice" },
  ] as SpeechSynthesisVoice[];

  it("voiceURI explícita vence", () => {
    expect(pickVoice(voices, "en-US", "pt-voice")?.lang).toBe("pt-BR");
  });
  it("idioma exato → prefixo → null quando vazio", () => {
    expect(pickVoice(voices, "en-US")?.lang).toBe("en-US");
    expect(pickVoice(voices, "en-GB")?.lang).toBe("en-US");
    expect(pickVoice([], "pt-BR")).toBeNull();
  });
});

describe("chunkForSpeech", () => {
  it("divide por frases respeitando o limite", () => {
    const chunks = chunkForSpeech("Ola mundo. " + "Texto longo. ".repeat(60), 220);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(220);
  });
  it("texto curto permanece um chunk", () => {
    expect(chunkForSpeech("Uma frase curta.").length).toBe(1);
  });
});

describe("stripForSpeech", () => {
  it("remove código fenced e inline", () => {
    expect(stripForSpeech("```\nconst x = 1;\n```\nTexto com `codigo`.")).toBe("Texto com codigo.");
  });
  it("remove cabeçalhos/listas/blockquote/links/imagens", () => {
    const out = stripForSpeech("## Titulo\n> citação\n- item\n1. um\n[link](http://x)\n![img](http://y)");
    expect(out).toBe("Titulo citação item um link img");
  });
  it("tabelas: pipes viram separadores lexicais", () => {
    const out = stripForSpeech("| colA | colB |");
    expect(out).toContain("colA");
    expect(out).not.toContain("|");
  });
  it("enfases (**/__/*/_ ) somem", () => {
    expect(stripForSpeech("**negrito** e **outro**")).toBe("negrito e outro");
  });
});

describe("detectVoiceIntent (voz → comando)", () => {
  it("frases de coleta", () => {
    expect(detectVoiceIntent("colete nubank")).toBe("/collect nubank");
    expect(detectVoiceIntent("coletar spotify")).toBe("/collect spotify");
  });
  it("frases de análise/agente/navegação", () => {
    expect(detectVoiceIntent("analise problemas")).toBe("/analyze problemas");
    expect(detectVoiceIntent("rode o agente produto")).toBe("/agent produto");
    expect(detectVoiceIntent("abra dashboard")).toBe("/goto dashboard");
    expect(detectVoiceIntent("vamos para o chat")).toBeNull();
  });
  it("atalhos sem argumento", () => {
    expect(detectVoiceIntent("estatisticas")).toBe("/stats");
    expect(detectVoiceIntent("quais apps")).toBe("/apps");
    expect(detectVoiceIntent("memória")).toBe("/memory");
    expect(detectVoiceIntent("ajuda")).toBe("/help");
    expect(detectVoiceIntent("esquecer")).toBe("/forget");
  });
  it("exportação com/sem formato", () => {
    expect(detectVoiceIntent("exportar json")).toBe("/export json");
    expect(detectVoiceIntent("exportar md")).toBe("/export md");
    expect(detectVoiceIntent("exportar")).toBe("/export json");
  });
  it("linguagem natural → null (vai para o chat de IA)", () => {
    expect(detectVoiceIntent("quais são os principais problemas do app?")).toBeNull();
    expect(detectVoiceIntent("")).toBeNull();
  });
});

describe("isSTTSupported", () => {
  it("false quando o navegador não expõe SpeechRecognition", () => {
    expect(isSTTSupported()).toBe(false);
  });
});
