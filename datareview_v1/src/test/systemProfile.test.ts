import { describe, it, expect } from "vitest";
import {
  GB,
  bestCtxForModel,
  buildProfile,
  chooseModel,
  computeTier,
  estimateKvBytesPerToken,
  findEmbeddingModel,
  isChatModel,
  memoryBudgetBytes,
  parseParameterSize,
  rankModels,
  rankModelsWithCtx,
  recommendedNumCtx,
  type HardwareInfo,
  type OllamaModelInfo,
} from "../../server/lib/systemProfileCore";

function hw(over: Partial<HardwareInfo>): HardwareInfo {
  return {
    platform: "Linux",
    cpuModel: "Test CPU",
    cpuCores: 8,
    totalRamBytes: 16 * GB,
    freeRamBytes: 8 * GB,
    gpus: [],
    ...over,
  };
}

const USER_MODELS: OllamaModelInfo[] = [
  { name: "qwen3:4b", sizeBytes: 2.5 * GB, parameterSize: "4.0B" },
  { name: "gemma4:latest", sizeBytes: 9.6 * GB, parameterSize: "12.9B" },
  { name: "gemma3:12b", sizeBytes: 8.1 * GB, parameterSize: "12.2B" },
  { name: "deepseek-r1:8b", sizeBytes: 5.2 * GB, parameterSize: "8.0B" },
  { name: "llama3.1:8b", sizeBytes: 4.9 * GB, parameterSize: "8.0B" },
  { name: "mistral:7b", sizeBytes: 4.4 * GB, parameterSize: "7.2B" },
  { name: "qwen2.5-coder:1.5b-base", sizeBytes: 0.99 * GB, parameterSize: "1.5B" },
  { name: "qwen3:8b", sizeBytes: 5.2 * GB, parameterSize: "8.2B" },
  { name: "qwen2.5-coder:7b", sizeBytes: 4.7 * GB, parameterSize: "7.6B" },
  { name: "nomic-embed-text:latest", sizeBytes: 0.27 * GB, parameterSize: "137M" },
];

describe("parseParameterSize", () => {
  it("parses billions and millions", () => {
    expect(parseParameterSize("12.2B")).toBeCloseTo(12.2);
    expect(parseParameterSize("7B")).toBeCloseTo(7);
    expect(parseParameterSize("334M")).toBeCloseTo(0.334);
    expect(parseParameterSize(undefined)).toBe(0);
    expect(parseParameterSize("garbage")).toBe(0);
  });
});

describe("isChatModel", () => {
  it("excludes embedding and base models", () => {
    expect(isChatModel({ name: "nomic-embed-text:latest", sizeBytes: 1 })).toBe(false);
    expect(isChatModel({ name: "qwen2.5-coder:1.5b-base", sizeBytes: 1 })).toBe(false);
    expect(isChatModel({ name: "gemma3:12b", sizeBytes: 1 })).toBe(true);
    expect(isChatModel({ name: "x", sizeBytes: 1, family: "bert" })).toBe(false);
  });
});

describe("computeTier + recommendedNumCtx", () => {
  it("GPU 12GB -> high; 24GB -> ultra", () => {
    expect(computeTier(hw({ gpus: [{ name: "RTX 3060", vramBytes: 12 * GB }] }))).toBe("high");
    expect(recommendedNumCtx("high")).toBe(32768);
    expect(computeTier(hw({ gpus: [{ name: "RTX 4090", vramBytes: 24 * GB }] }))).toBe("ultra");
    expect(recommendedNumCtx("ultra")).toBe(65536);
  });
  it("CPU-only falls back to RAM", () => {
    expect(computeTier(hw({ totalRamBytes: 8 * GB }))).toBe("low");
    expect(recommendedNumCtx("low")).toBe(8192);
    expect(computeTier(hw({ totalRamBytes: 16 * GB }))).toBe("medium");
    expect(recommendedNumCtx("medium")).toBe(16384);
    expect(computeTier(hw({ totalRamBytes: 32 * GB }))).toBe("high");
  });
});

describe("memoryBudgetBytes", () => {
  it("uses GPU VRAM when useGpu, else half of RAM", () => {
    const withGpu = hw({ gpus: [{ name: "G", vramBytes: 12 * GB }] });
    expect(memoryBudgetBytes(withGpu, true)).toBeCloseTo(12 * GB * 0.9);
    const noGpu = hw({ totalRamBytes: 16 * GB });
    expect(memoryBudgetBytes(noGpu, false)).toBeCloseTo(16 * GB * 0.5);
  });
});

describe("chooseModel / rankModels", () => {
  // Cenário real do usuário: RTX 3060 12GB → budget 10.8GB
  it("picks gemma3:12b on a 12GB GPU (gemma4 9.6GB não cabe com folga)", () => {
    const budget = 12 * GB * 0.9;
    expect(chooseModel(USER_MODELS, budget)).toBe("gemma3:12b");
  });
  it("picks the biggest model that fits on CPU-only 16GB", () => {
    const budget = 16 * GB * 0.5; // 8GB
    const chosen = chooseModel(USER_MODELS, budget);
    const ranked = rankModels(USER_MODELS, budget);
    expect(ranked.find((m) => m.name === chosen)?.fits).toBe(true);
    // qwen3:8b (5.2GB) cabe; gemma3:12b (8.1GB) não
    expect(ranked.find((m) => m.name === "gemma3:12b")?.fits).toBe(false);
  });
  it("falls back to the smallest chat model when nothing fits", () => {
    const budget = 2 * GB;
    const chosen = chooseModel(USER_MODELS, budget);
    // nomic-embed e 1.5b-base excluídos; menor elegível é qwen3:4b (2.5GB)... mas nada cabe: pega o menor chat
    expect(["qwen3:4b", "mistral:7b", "llama3.1:8b"]).toContain(chosen);
    expect(chooseModel([], budget)).toBe("");
  });
  it("orders fitting models before non-fitting", () => {
    const ranked = rankModels(USER_MODELS, 120 * GB);
    expect(ranked[0]?.fits).toBe(true);
  });
});

describe("otimização conjunta modelo × ctx (não vazar da GPU)", () => {
  it("estima KV por token com desconto de sliding-window p/ gemma3", () => {
    const gemma = estimateKvBytesPerToken({ name: "gemma3:12b", sizeBytes: 8.1 * GB, parameterSize: "12.2B" });
    const qwen = estimateKvBytesPerToken({ name: "qwen3:8b", sizeBytes: 5.2 * GB, parameterSize: "8.2B" });
    // gemma3 12B ≈ 88KB/token (com desconto); qwen3 8B ≈ 128KB/token (denso)
    expect(gemma).toBeGreaterThan(70 * 1024);
    expect(gemma).toBeLessThan(110 * 1024);
    expect(qwen).toBeGreaterThan(110 * 1024);
    expect(qwen).toBeLessThan(150 * 1024);
  });

  it("gemma3:12b cabe com ctx 16k (não 32k) numa RTX 3060 12GB", () => {
    const budget = 12 * GB * 0.9;
    const m = USER_MODELS.find((x) => x.name === "gemma3:12b")!;
    expect(bestCtxForModel(m, budget, 32768)).toBe(16384);
    // qwen3:8b (mais leve) consegue o ctx cheio do tier
    const q = USER_MODELS.find((x) => x.name === "qwen3:8b")!;
    expect(bestCtxForModel(q, budget, 32768)).toBe(32768);
  });

  it("gemma4 9.6GB não cabe nem com ctx mínimo no budget da 3060", () => {
    const budget = 12 * GB * 0.9;
    const m = USER_MODELS.find((x) => x.name === "gemma4:latest")!;
    expect(bestCtxForModel(m, budget, 32768)).toBe(0);
  });

  it("rankModelsWithCtx marca comfortable apenas quando ctx ≥ 8k", () => {
    const budget = 12 * GB * 0.9;
    const fits = rankModelsWithCtx(USER_MODELS, budget, "high");
    expect(fits.find((m) => m.name === "gemma3:12b")?.comfortable).toBe(true);
    expect(fits.find((m) => m.name === "gemma4:latest")?.comfortable).toBe(false);
  });

  it("findEmbeddingModel detecta nomic-embed-text", () => {
    expect(findEmbeddingModel(USER_MODELS)).toBe("nomic-embed-text:latest");
    expect(findEmbeddingModel([{ name: "qwen3:8b", sizeBytes: 1 }])).toBe("");
  });
});

describe("buildProfile (máquina do usuário)", () => {
  it("recommends gemma3:12b + GPU + ctx 16k (sem vazar) on RTX 3060 12GB", () => {
    const hardware = hw({
      cpuModel: "12th Gen Intel Core i5-12400F",
      cpuCores: 12,
      totalRamBytes: 15.8 * GB,
      gpus: [{ name: "NVIDIA GeForce RTX 3060", vramBytes: 12 * GB }],
    });
    const profile = buildProfile(hardware, { available: true, models: USER_MODELS });
    expect(profile.tier).toBe("high");
    expect(profile.recommended.mode).toBe("local");
    expect(profile.recommended.model).toBe("gemma3:12b");
    expect(profile.recommended.useGpu).toBe(true);
    // ctx otimizado: 16k (pesos ~8.7GB + KV ~1.4GB ≤ 10.8GB) em vez de 32k
    // (que vazaria para a RAM e derrubaria a velocidade de geração).
    expect(profile.recommended.numCtx).toBe(16384);
    expect(profile.embeddingModel).toBe("nomic-embed-text:latest");
    expect(profile.rankedModels.length).toBeGreaterThan(0);
    expect(profile.reasons.length).toBeGreaterThan(1);
  });

  it("reports none when Ollama is unavailable or has no chat models", () => {
    const profile = buildProfile(hw({}), { available: false, models: [] });
    expect(profile.recommended.mode).toBe("none");
    expect(profile.recommended.model).toBe("");
    const embedOnly = buildProfile(hw({}), {
      available: true,
      models: [{ name: "nomic-embed-text", sizeBytes: GB }],
    });
    expect(embedOnly.recommended.mode).toBe("none");
  });

  it("works well on a low-end machine (8GB, no GPU)", () => {
    const profile = buildProfile(hw({ totalRamBytes: 8 * GB }), {
      available: true,
      models: [{ name: "qwen3:4b", sizeBytes: 2.5 * GB, parameterSize: "4.0B" }],
    });
    expect(profile.tier).toBe("low");
    expect(profile.recommended.numCtx).toBe(8192);
    expect(profile.recommended.useGpu).toBe(false);
    expect(profile.recommended.model).toBe("qwen3:4b");
  });
});

describe("Apple Silicon (memória unificada)", () => {
  // Cenário real: MacBook Air M1 8GB — modelos instalados no Mac do usuário.
  const MAC_MODELS: OllamaModelInfo[] = [
    { name: "nomic-embed-text:latest", sizeBytes: 0.27 * GB, parameterSize: "137M" },
    { name: "gemma3:4b", sizeBytes: 3.3 * GB, parameterSize: "4.3B" },
    { name: "gemma4:latest", sizeBytes: 9.6 * GB, parameterSize: "12.9B" },
  ];
  const macHw = () =>
    hw({
      platform: "Darwin 25.5.0",
      cpuModel: "Apple M1",
      cpuCores: 8,
      totalRamBytes: 8 * GB,
      freeRamBytes: 5.3 * GB,
      gpus: [{ name: "Apple M1 (Metal, memória unificada)", vramBytes: Math.round(8 * GB * (2 / 3)), unified: true }],
    });

  it("orçamento unificado limita a 55% da RAM (não 90% da 'VRAM')", () => {
    const budget = memoryBudgetBytes(macHw(), true);
    // min(5.33GB × 0.9, 8GB × 0.55) = 4.4GB — folga para macOS + browser.
    expect(budget).toBeCloseTo(8 * GB * 0.55);
    expect(budget).toBeLessThan(Math.round(8 * GB * (2 / 3)) * 0.9);
  });

  it("M1 8GB: recomenda gemma3:4b com Metal ligado e ctx que cabe sem swap", () => {
    const profile = buildProfile(macHw(), { available: true, models: MAC_MODELS });
    expect(profile.tier).toBe("medium");
    expect(profile.recommended.mode).toBe("local");
    expect(profile.recommended.model).toBe("gemma3:4b");
    // Metal (GPU integrada) LIGADO — CPU-only no M1 seria 3-5× mais lento.
    expect(profile.recommended.useGpu).toBe(true);
    // gemma4 9.6GB NÃO cabe no orçamento de 4.4GB em nenhum ctx.
    expect(profile.rankedModels.find((m) => m.name === "gemma4:latest")?.recommendedCtx).toBe(0);
    // ctx ótimo: pesos ~3.6GB + KV ≤ ~0.9GB, sempre ≤ 4.4GB e ≥ 8k (utilizável).
    expect(profile.recommended.numCtx).toBeGreaterThanOrEqual(8192);
    expect(profile.recommended.numCtx).toBeLessThanOrEqual(16384);
    const m = MAC_MODELS.find((x) => x.name === "gemma3:4b")!;
    const total = m.sizeBytes * 1.08 + estimateKvBytesPerToken(m) * profile.recommended.numCtx;
    expect(total).toBeLessThanOrEqual(8 * GB * 0.55);
    expect(profile.embeddingModel).toBe("nomic-embed-text:latest");
    expect(profile.reasons.some((r) => /memória unificada|Metal/i.test(r))).toBe(true);
  });

  it("M1 16GB escala: ctx cheio do tier high sem vazar", () => {
    const hardware = hw({
      cpuModel: "Apple M1",
      totalRamBytes: 16 * GB,
      gpus: [{ name: "Apple M1 (Metal, memória unificada)", vramBytes: Math.round(16 * GB * (2 / 3)), unified: true }],
    });
    const profile = buildProfile(hardware, { available: true, models: MAC_MODELS });
    expect(profile.tier).toBe("high");
    expect(profile.recommended.model).toBe("gemma3:4b");
    expect(profile.recommended.numCtx).toBe(32768);
  });
});
