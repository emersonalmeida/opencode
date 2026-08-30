/**
 * Núcleo puro (sem dependências de Node/DOM) do perfil de sistema.
 *
 * Usado pelo servidor (detecção real do hardware + Ollama) e pelo cliente
 * (exibição e fallback). Decide, a partir do hardware detectado e dos modelos
 * instalados, o melhor modo de operação da IA local: qual modelo cabe na
 * memória disponível, se a GPU compensa, e qual janela de contexto (num_ctx)
 * a máquina aguenta sem swap/truncamento.
 *
 * O objetivo é funcionar bem em qualquer máquina: de um notebook sem GPU com
 * 8GB de RAM (tier low, ctx 8k, modelo pequeno) até uma workstation com GPU
 * de 24GB (tier ultra, ctx 64k, modelo grande).
 */

export interface GpuInfo {
  name: string;
  vramBytes: number;
  /**
   * Memória unificada (Apple Silicon): a "VRAM" é a própria RAM do sistema
   * compartilhada com CPU/SO — o orçamento de modelo precisa deixar folga
   * maior para o restante do sistema do que numa GPU dedicada.
   */
  unified?: boolean;
}

export interface HardwareInfo {
  platform: string;
  cpuModel: string;
  cpuCores: number;
  totalRamBytes: number;
  freeRamBytes: number;
  gpus: GpuInfo[];
}

export interface OllamaModelInfo {
  name: string;
  sizeBytes: number;
  /** ex.: "12.2B", "7.6B", "334M" (vem de details.parameter_size) */
  parameterSize?: string;
  family?: string;
}

export type PerfTier = "low" | "medium" | "high" | "ultra";

export interface ProfileRecommendation {
  /** Modo efetivo sugerido. "none" quando não há Ollama/modelos utilizáveis. */
  mode: "local" | "none";
  /** Nome do modelo recomendado ("" quando nenhum disponível). */
  model: string;
  useGpu: boolean;
  numCtx: number;
}

export interface SystemProfile {
  hardware: HardwareInfo;
  ollama: { available: boolean; models: OllamaModelInfo[] };
  tier: PerfTier;
  recommended: ProfileRecommendation;
  /** Ranking completo dos modelos instalados com o num_ctx que cabe sem swap. */
  rankedModels: ModelFit[];
  /** Modelo de embedding instalado (ex.: nomic-embed-text) — usado p/ busca
   *  semântica/dedup; "" quando nenhum instalado. */
  embeddingModel: string;
  /** Explicações legíveis (pt-BR) do porquê de cada escolha. */
  reasons: string[];
  detectedAt: number;
}

export const GB = 1024 ** 3;

/** "12.2B" → 12.2 · "334M" → 0.334 · "7B" → 7 */
export function parseParameterSize(p?: string): number {
  if (!p) return 0;
  const m = /^([\d.]+)\s*([BMK])/i.exec(p.trim());
  if (!m) return 0;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return 0;
  const unit = m[2].toUpperCase();
  if (unit === "B") return n;
  if (unit === "M") return n / 1000;
  return n / 1_000_000; // K
}

/**
 * Modelos de embedding (nomic-embed-text) e modelos base (não-instruct, ex.:
 * qwen2.5-coder:1.5b-base) não servem para análise de reviews — excluídos da
 * recomendação automática (continuam selecionáveis manualmente).
 */
export function isChatModel(m: OllamaModelInfo): boolean {
  const name = m.name.toLowerCase();
  if (/embed/.test(name)) return false;
  if (/-base\b|:.*-base$/.test(name)) return false;
  if (m.family && /bert/i.test(m.family)) return false;
  return true;
}

/** Tier de performance a partir do melhor recurso disponível (VRAM ou RAM). */
export function computeTier(hw: HardwareInfo): PerfTier {
  const vramGB = Math.max(0, ...hw.gpus.map((g) => g.vramBytes)) / GB;
  const ramGB = hw.totalRamBytes / GB;
  if (vramGB >= 20 || ramGB >= 64) return "ultra";
  if (vramGB >= 10 || ramGB >= 32) return "high";
  if (vramGB >= 5 || ramGB >= 16) return "medium";
  return "low";
}

/**
 * Janela de contexto (num_ctx) que o tier aguenta com folga. É o limite usado
 * tanto no Ollama quanto no orçamento de reviews do experiment-analyze.
 */
export function recommendedNumCtx(tier: PerfTier): number {
  switch (tier) {
    case "ultra": return 65536;
    case "high": return 32768;
    case "medium": return 16384;
    case "low": return 8192;
  }
}

/**
 * Orçamento de memória para o modelo (pesos + KV cache). Com GPU, usa a VRAM
 * da maior placa (90% — o restante fica para o sistema/compositor). Sem GPU,
 * metade da RAM total (inferência em CPU disputa com SO + browser).
 * Memória unificada (Apple Silicon): a "VRAM" compartilha a RAM com o SO —
 * o orçamento é limitado a 55% da RAM total para não derrubar o macOS em swap.
 */
export function memoryBudgetBytes(hw: HardwareInfo, useGpu: boolean): number {
  const maxVram = Math.max(0, ...hw.gpus.map((g) => g.vramBytes));
  if (useGpu && maxVram > 0) {
    const best = hw.gpus.reduce((a, b) => (b.vramBytes > a.vramBytes ? b : a));
    if (best.unified) return Math.min(maxVram * 0.9, hw.totalRamBytes * 0.55);
    return maxVram * 0.9;
  }
  return hw.totalRamBytes * 0.5;
}

/** Folga sobre o tamanho em disco do modelo (KV cache do ctx + overhead). */
const MODEL_HEADROOM = 1.15;

/* ------------------------- otimização conjunta modelo × ctx --------------- */

/**
 * Estimativa de bytes de KV cache POR TOKEN de contexto. Arquiteturas GQA
 * modernas (qwen3, llama3.1, mistral, deepseek-r1) gastam ~16KB/token por
 * bilhão de parâmetros. gemma3 usa sliding-window attention (5 camadas locais
 * p/ 1 global), reduzindo bastante o footprint efetivo (~45%).
 */
export function estimateKvBytesPerToken(m: OllamaModelInfo): number {
  const params = parseParameterSize(m.parameterSize) || m.sizeBytes / GB;
  const slidingWindow = /^gemma3/i.test(m.name) ? 0.45 : 1;
  return params * 16 * 1024 * slidingWindow;
}

/** Overhead de runtime sobre o tamanho em disco (buffers, compute, mmap). */
const WEIGHTS_OVERHEAD = 1.08;
/** num_ctx mínimo para a análise de dataset ser útil (budget de reviews). */
export const MIN_USABLE_CTX = 8192;
/** Ladder de contextos candidatos (maior → menor). */
const CTX_LADDER = [65536, 49152, 32768, 24576, 16384, 12288, 8192, 4096];

/**
 * Maior num_ctx (≤ tierMax) tal que PESOS + KV cache caibam no orçamento de
 * memória — garante que o modelo roda 100% na GPU sem vazar para a RAM (o
 * "spill" derruba a velocidade de geração em 5-10×). 0 = não cabe nem no mínimo.
 */
export function bestCtxForModel(
  m: OllamaModelInfo,
  budgetBytes: number,
  tierMaxCtx: number,
): number {
  const weights = m.sizeBytes * WEIGHTS_OVERHEAD;
  const kvPerToken = estimateKvBytesPerToken(m);
  for (const ctx of CTX_LADDER) {
    if (ctx > tierMaxCtx) continue;
    if (weights + kvPerToken * ctx <= budgetBytes) return ctx;
  }
  return 0;
}

export interface ModelFit extends RankedModel {
  /** Maior num_ctx que cabe no orçamento sem swap (0 = não cabe). */
  recommendedCtx: number;
  /** true quando cabe com ctx ≥ MIN_USABLE_CTX (experiência boa). */
  comfortable: boolean;
}

/**
 * Ranking enriquecido: para cada modelo, o num_ctx ótimo para ESTE hardware.
 * É a base da recomendação "auto": escolhe o melhor modelo que roda inteiro
 * na memória disponível, com o maior contexto possível.
 */
export function rankModelsWithCtx(
  models: OllamaModelInfo[],
  budgetBytes: number,
  tier: PerfTier,
): ModelFit[] {
  const tierMax = recommendedNumCtx(tier);
  return rankModels(models, budgetBytes).map((m) => {
    const ctx = bestCtxForModel(m, budgetBytes, tierMax);
    return { ...m, recommendedCtx: ctx, comfortable: ctx >= MIN_USABLE_CTX };
  });
}

export interface RankedModel extends OllamaModelInfo {
  fits: boolean;
  paramBillions: number;
  score: number;
}

/**
 * Ordena os modelos instalados do melhor para o pior para ESTE hardware.
 * Score = parâmetros (qualidade) com leve penalidade para modelos coder
 * (a tarefa aqui é análise de texto, não código). Modelos que não cabem no
 * orçamento ficam no fim (fits=false) como fallback.
 */
export function rankModels(models: OllamaModelInfo[], budgetBytes: number): RankedModel[] {
  const ranked = models.filter(isChatModel).map((m) => {
    const paramBillions = parseParameterSize(m.parameterSize);
    const fits = m.sizeBytes > 0 && m.sizeBytes * MODEL_HEADROOM <= budgetBytes;
    const coderPenalty = /coder/i.test(m.name) ? 0.75 : 1;
    // Modelos de raciocínio (deepseek-r1 etc.) emitem "thinking" longo antes da
    // resposta — lentos e verbosos p/ streaming de análise; leve penalidade.
    const reasoningPenalty = /r1|reasoning|think/i.test(m.name) ? 0.85 : 1;
    return { ...m, fits, paramBillions, score: paramBillions * coderPenalty * reasoningPenalty };
  });
  ranked.sort((a, b) => {
    if (a.fits !== b.fits) return a.fits ? -1 : 1;
    if (a.score !== b.score) return b.score - a.score;
    return a.name.localeCompare(b.name);
  });
  return ranked;
}

/**
 * Escolhe o melhor modelo instalado para o orçamento de memória. Prefere o
 * maior (em parâmetros) que CAIBA com folga; se nenhum couber, pega o menor
 * modelo de chat (melhor um pequeno funcionando do que um grande em swap).
 */
export function chooseModel(models: OllamaModelInfo[], budgetBytes: number): string {
  const ranked = rankModels(models, budgetBytes);
  if (ranked.length === 0) return "";
  const fitting = ranked.find((m) => m.fits);
  if (fitting) return fitting.name;
  // Nada cabe: menor arquivo de modelo de chat disponível.
  return [...ranked].sort((a, b) => a.sizeBytes - b.sizeBytes)[0]?.name ?? "";
}

/** Primeiro modelo de embedding instalado (nomic-embed-text etc.), "" se nenhum. */
export function findEmbeddingModel(models: OllamaModelInfo[]): string {
  return models.find((m) => /embed/i.test(m.name))?.name ?? "";
}

/** Monta o perfil completo: tier + recomendação + razões legíveis. */
export function buildProfile(
  hw: HardwareInfo,
  ollama: { available: boolean; models: OllamaModelInfo[] },
): SystemProfile {
  const tier = computeTier(hw);
  const hasGpu = hw.gpus.length > 0;
  const useGpu = hasGpu;
  const budget = memoryBudgetBytes(hw, useGpu);
  const fits = rankModelsWithCtx(ollama.models, budget, tier);
  const embeddingModel = findEmbeddingModel(ollama.models);

  // Escolha conjunta modelo × contexto: o melhor modelo que roda INTEIRO na
  // memória (pesos + KV) com ctx utilizável; senão o melhor que cabe no mínimo;
  // senão o menor modelo de chat (melhor pequeno funcionando que grande em swap).
  const comfortable = fits.find((m) => m.comfortable);
  const minimal = fits.find((m) => m.recommendedCtx > 0);
  const chosen = comfortable ?? minimal ?? null;
  const model = chosen?.name ?? chooseModel(ollama.models, budget);
  const numCtx = chosen?.recommendedCtx || recommendedNumCtx(tier);

  const reasons: string[] = [];
  const ramGB = (hw.totalRamBytes / GB).toFixed(0);
  if (hasGpu) {
    const g = hw.gpus.reduce((a, b) => (b.vramBytes > a.vramBytes ? b : a));
    if (g.unified) {
      reasons.push(`GPU integrada: ${g.name} — memória unificada de ${(g.vramBytes / GB).toFixed(1)}GB (aceleração Metal ativada; orçamento limitado a 55% da RAM para não pressionar o sistema).`);
    } else {
      reasons.push(`GPU detectada: ${g.name} com ${(g.vramBytes / GB).toFixed(0)}GB de VRAM — offload na GPU ativado.`);
    }
  } else {
    reasons.push(`Nenhuma GPU dedicada detectada — inferência via CPU (${hw.cpuCores} threads).`);
  }
  reasons.push(`RAM total: ${ramGB}GB → tier "${tier}" (contexto máximo do tier: ${recommendedNumCtx(tier)} tokens).`);
  if (!ollama.available) {
    reasons.push("Ollama não está acessível — inicie com `ollama serve` para habilitar a IA local.");
  } else if (!model) {
    reasons.push("Ollama acessível, mas nenhum modelo de chat instalado. Ex.: `ollama pull qwen3:4b`.");
  } else {
    const info = ollama.models.find((m) => m.name === model);
    const sizeGB = info ? (info.sizeBytes / GB).toFixed(1) : "?";
    reasons.push(`Melhor modelo instalado para este hardware: ${model} (${sizeGB}GB em disco).`);
    if (chosen) {
      const weightsGB = ((info?.sizeBytes ?? 0) * WEIGHTS_OVERHEAD) / GB;
      const kvGB = (estimateKvBytesPerToken(chosen) * chosen.recommendedCtx) / GB;
      reasons.push(
        `Contexto ${numCtx} tokens: pesos ~${weightsGB.toFixed(1)}GB + KV cache ~${kvGB.toFixed(1)}GB = ~${(weightsGB + kvGB).toFixed(1)}GB de ${(budget / GB).toFixed(1)}GB disponíveis — roda 100% na ${useGpu ? "GPU" : "RAM"} sem swap (geração rápida).`,
      );
      if (numCtx < recommendedNumCtx(tier)) {
        reasons.push(`Contexto reduzido de ${recommendedNumCtx(tier)} para ${numCtx} tokens propositalmente: manter o modelo inteiro na memória sem vazar — o sistema compensa com amostragem estratificada dos reviews.`);
      }
    }
  }
  if (embeddingModel) {
    reasons.push(`Modelo de embeddings disponível: ${embeddingModel} (busca semântica/dedup futuros).`);
  }

  return {
    hardware: hw,
    ollama,
    tier,
    recommended: {
      mode: ollama.available && model ? "local" : "none",
      model,
      useGpu,
      numCtx,
    },
    rankedModels: fits,
    embeddingModel,
    reasons,
    detectedAt: Date.now(),
  };
}
