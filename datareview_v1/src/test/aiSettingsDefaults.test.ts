/** Defaults de IA: o sistema nasce em modo AUTO (a IA resolve do hardware
 *  detectado — modelo que cabe + contexto do tier + GPU/Metal). Sem Ollama,
 *  as superfícies de IA mostram estado honesto e o resto funciona sem IA.
 *  A config local manual padrão é concreta: gemma3:4b @ 8192 tokens (leve,
 *  roda em praticamente qualquer máquina); "auto" segue disponível nos
 *  dropdowns. */
import { describe, it, expect } from "vitest";
import { DEFAULT_AI_SETTINGS } from "@/lib/aiSettings";

describe("DEFAULT_AI_SETTINGS — IA automática por padrão (opt-out via none)", () => {
  it("modo auto por padrão (IA resolve do hardware; none = opt-out explícito)", () => {
    expect(DEFAULT_AI_SETTINGS.mode).toBe("auto");
  });

  it("config local padrão concreta: gemma3:4b @ 8192 ctx (GPU ligada)", () => {
    expect(DEFAULT_AI_SETTINGS.local.model).toBe("gemma3:4b");
    expect(DEFAULT_AI_SETTINGS.local.numCtx).toBe(8192);
    expect(DEFAULT_AI_SETTINGS.local.useGpu).toBe(true);
    expect(DEFAULT_AI_SETTINGS.local.ollamaUrl).toBe("http://localhost:11434");
  });

  it("comportamento produtivo por padrão: paralelo, autosave, missão", () => {
    expect(DEFAULT_AI_SETTINGS.concurrencyMode).toBe("parallel");
    expect(DEFAULT_AI_SETTINGS.autoSaveOutputs).toBe(true);
    expect(DEFAULT_AI_SETTINGS.missionInjection).toBe(true);
    expect(DEFAULT_AI_SETTINGS.backgroundRuns).toBe(true);
  });
});
