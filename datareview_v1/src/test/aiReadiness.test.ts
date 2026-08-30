import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  aiFingerprint, readinessDot, checkAIReadiness, getAIReadiness, resetAIReadiness,
} from "@/lib/aiReadiness";
import { DEFAULT_AI_SETTINGS, type AISettings } from "@/lib/aiSettings";

const base: AISettings = JSON.parse(JSON.stringify(DEFAULT_AI_SETTINGS));

function mockFetchOnce(payload: { ok: boolean; message?: string }) {
  return vi.fn(async () => new Response(JSON.stringify(payload), {
    status: 200, headers: { "Content-Type": "application/json" },
  }));
}

describe("aiReadiness — ativação da IA", () => {
  beforeEach(() => {
    resetAIReadiness();
    vi.useFakeTimers({ now: 1_000_000 });
    vi.stubGlobal("fetch", mockFetchOnce({ ok: true, message: "OK" }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("fingerprint muda por modo/modelo/provider/chave", () => {
    const none = { ...base, mode: "none" as const };
    expect(aiFingerprint(none)).toBe("none");
    const local = { ...base, mode: "local" as const };
    expect(aiFingerprint(local)).toContain("local:");
    const cloud = {
      ...base, mode: "cloud" as const,
      cloud: { ...base.cloud, provider: "openai" as const, model: "gpt-4o", apiKey: "sk-x" },
    };
    expect(aiFingerprint(cloud)).toBe("cloud:openai:gpt-4o:key");
    const noKey = { ...cloud, cloud: { ...cloud.cloud, apiKey: "" } };
    expect(aiFingerprint(noKey)).toBe("cloud:openai:gpt-4o:nokey");
  });

  it("modo none nunca chama a rede e responde pronta", async () => {
    const res = await checkAIReadiness({ ...base, mode: "none" });
    expect(res.ok).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("cache por fingerprint: 2ª chamada dentro do TTL não refaz fetch", async () => {
    const ai = { ...base, mode: "local" as const, local: { ...base.local, model: "gemma3:4b" } };
    const r1 = await checkAIReadiness(ai);
    expect(r1.ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    const r2 = await checkAIReadiness(ai);
    expect(fetch).toHaveBeenCalledTimes(1); // cache
    expect(r2).toBe(r1);
    // fingerprint diferente = nova verificação
    const ai2 = { ...ai, local: { ...ai.local, model: "qwen3:8b" } };
    await checkAIReadiness(ai2);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("dedup de chamadas em voo (mesma fingerprint concorrente)", async () => {
    vi.useRealTimers();
    const ai = { ...base, mode: "local" as const };
    const [a, b] = await Promise.all([checkAIReadiness(ai), checkAIReadiness(ai)]);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("falha do servidor vira resultado ok=false com mensagem", async () => {
    vi.stubGlobal("fetch", mockFetchOnce({ ok: false, message: "Ollama offline" }));
    const ai = { ...base, mode: "auto" as const };
    const res = await checkAIReadiness(ai);
    expect(res.ok).toBe(false);
    expect(res.message).toBe("Ollama offline");
    expect(getAIReadiness()?.ok).toBe(false);
  });

  it("erro de rede vira resultado ok=false", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNREFUSED"); }));
    const res = await checkAIReadiness({ ...base, mode: "local" as const });
    expect(res.ok).toBe(false);
    expect(res.message).toContain("ECONNREFUSED");
  });

  it("readinessDot: none sem ponto, sem resultado = warn, ok = ok", () => {
    expect(readinessDot({ ...base, mode: "none" }, null)).toBe("none");
    expect(readinessDot({ ...base, mode: "local" }, null)).toBe("warn");
    expect(readinessDot({ ...base, mode: "local" }, { ok: true, message: "", checkedAt: 1 })).toBe("ok");
    expect(readinessDot({ ...base, mode: "local" }, { ok: false, message: "", checkedAt: 1 })).toBe("warn");
  });
});
