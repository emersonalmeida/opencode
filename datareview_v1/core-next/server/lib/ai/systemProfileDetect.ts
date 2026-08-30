/**
 * Detecção server-side do perfil de sistema (roda na máquina onde o servidor
 * local está — tipicamente a mesma do usuário em modo local).
 *
 * - CPU/RAM via `node:os`.
 * - GPU via `nvidia-smi` (quando presente). Em Apple Silicon (darwin/arm64)
 *   a GPU integrada é detectada via CPU model + memória unificada (Metal) —
 *   o Ollama usa Metal automaticamente, então o offload deve ficar LIGADO.
 *   AMD/ROCm segue no caminho "sem GPU detectada" → CPU.
 * - Modelos Ollama via `GET /api/tags` (com timeout curto para não travar).
 *
 * O resultado é cacheado por 15s: resolver a config "auto" acontece em toda
 * chamada de IA, e spawnar nvidia-smi / bater no Ollama a cada token seria
 * desperdício. `invalidateProfileCache()` força re-detecção.
 */

import os from "node:os";
import { execFile } from "node:child_process";
import {
  buildProfile,
  GB,
  type GpuInfo,
  type HardwareInfo,
  type OllamaModelInfo,
  type SystemProfile,
} from "./systemProfileCore.js";

const CACHE_TTL_MS = 15_000;
let cached: { profile: SystemProfile; at: number } | null = null;

export function invalidateProfileCache(): void {
  cached = null;
}

function detectHardwareBase(): HardwareInfo {
  const cpus = os.cpus();
  return {
    platform: `${os.type()} ${os.release()}`,
    cpuModel: cpus[0]?.model?.trim() || "CPU desconhecida",
    cpuCores: cpus.length || 1,
    totalRamBytes: os.totalmem(),
    freeRamBytes: os.freemem(),
    gpus: [],
  };
}

/** nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits */
function detectGpus(): Promise<GpuInfo[]> {
  return new Promise((resolve) => {
    execFile(
      "nvidia-smi",
      ["--query-gpu=name,memory.total", "--format=csv,noheader,nounits"],
      { timeout: 3000 },
      (err, stdout) => {
        if (err || !stdout) return resolve([]);
        const gpus: GpuInfo[] = [];
        for (const line of stdout.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const idx = trimmed.lastIndexOf(",");
          if (idx < 0) continue;
          const name = trimmed.slice(0, idx).trim();
          const mib = Number(trimmed.slice(idx + 1).trim());
          if (!name || !Number.isFinite(mib)) continue;
          gpus.push({ name, vramBytes: Math.round(mib * 1024 * 1024) });
        }
        resolve(gpus);
      },
    );
  });
}

/**
 * Apple Silicon (M1/M2/M3/M4): a GPU integrada usa memória unificada — o
 * Metal recomenda ~2/3 da RAM como working set máximo da GPU
 * (recommendedMaxWorkingSetSize; num Mac 8GB ≈ 5.3GB). O Ollama acelera via
 * Metal automaticamente nessas máquinas, então reportamos uma "GPU" para o
 * perfil recomendar offload ligado.
 */
function detectAppleSiliconGpu(hw: HardwareInfo): GpuInfo[] {
  if (os.platform() !== "darwin" || os.arch() !== "arm64") return [];
  const vramBytes = Math.round(hw.totalRamBytes * (2 / 3));
  return [{ name: `${hw.cpuModel} (Metal, memória unificada)`, vramBytes, unified: true }];
}

interface OllamaTagsResponse {
  models?: {
    name?: string;
    model?: string;
    size?: number;
    details?: { parameter_size?: string; family?: string; families?: string[] };
  }[];
}

export async function listOllamaModels(ollamaUrl: string): Promise<OllamaModelInfo[]> {
  const base = (ollamaUrl || "http://localhost:11434").replace(/\/$/, "");
  const r = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(4000) });
  if (!r.ok) throw new Error(`Ollama respondeu ${r.status}`);
  const data = (await r.json()) as OllamaTagsResponse;
  return (data.models ?? [])
    .map((m) => ({
      name: m.name || m.model || "",
      sizeBytes: typeof m.size === "number" ? m.size : 0,
      parameterSize: m.details?.parameter_size,
      family: m.details?.family ?? m.details?.families?.[0],
    }))
    .filter((m) => m.name);
}

export async function detectSystemProfile(ollamaUrl?: string): Promise<SystemProfile> {
  const url = ollamaUrl || process.env.OLLAMA_URL || "http://localhost:11434";
  if (cached && Date.now() - cached.at < CACHE_TTL_MS && !ollamaUrl) {
    return cached.profile;
  }

  const hw = detectHardwareBase();
  const [nvidiaGpus, ollama] = await Promise.all([
    detectGpus().catch(() => [] as GpuInfo[]),
    listOllamaModels(url)
      .then((models) => ({ available: true, models }))
      .catch(() => ({ available: false, models: [] as OllamaModelInfo[] })),
  ]);
  // NVIDIA dedicada tem prioridade; sem ela, tenta a GPU integrada Apple Silicon.
  hw.gpus = nvidiaGpus.length > 0 ? nvidiaGpus : detectAppleSiliconGpu(hw);

  const profile = buildProfile(hw, ollama);
  if (!ollamaUrl) cached = { profile, at: Date.now() };
  return profile;
}

export { GB };
