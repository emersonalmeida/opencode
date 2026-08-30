import { useSyncExternalStore } from "react";

/**
 * AI provider configuration (user-selectable).
 *
 * O app suporta quatro modos de operação:
 *  - "none":  sem IA. É O PADRÃO — o sistema funciona completo sem IA (coleta,
 *             dashboards, pipeline determinístico, exports). Botões de geração
 *             mostram empty state explicativo ensinando a ativar a IA nas
 *             Configurações, quando e se o usuário quiser.
 *  - "auto":  o servidor detecta o hardware da máquina (CPU/RAM/GPU, incluindo
 *             Apple Silicon) e os modelos Ollama instalados, e escolhe a
 *             melhor configuração local (modelo que cabe na memória, offload
 *             de GPU/Metal, janela de contexto). Modo recomendado ao ativar.
 *  - "local": roda inteiramente na máquina do usuário via Ollama. Modelo, toggle
 *             de GPU e janela de contexto podem ser "auto" (resolvidos do perfil
 *             de sistema detectado) ou sobrescritos manualmente.
 *  - "cloud": o usuário traz sua própria API key de OpenAI, Anthropic, Gemini
 *             ou qualquer endpoint OpenAI-compatível. Modelos por provider.
 *
 * As configurações vivem no localStorage (`aso:ai-settings:v1`) e são enviadas
 * ao servidor local no body de cada chamada de IA, para o dispatcher do
 * servidor rotear ao backend certo. Chaves de API cloud nunca saem do navegador
 * exceto na requisição autenticada ao provider escolhido (proxied pelo servidor
 * local para evitar CORS e manter a conversão de streaming no servidor).
 */

export type AIMode = "auto" | "none" | "local" | "cloud";

export type CloudProvider = "openai" | "anthropic" | "gemini" | "openai-compatible";

export interface LocalAIConfig {
  ollamaUrl: string;
  /** "auto" = o servidor escolhe o melhor modelo instalado para o hardware. */
  model: string;
  useGpu: boolean;
  /** "auto" = num_ctx recomendado pelo perfil de hardware detectado. */
  numCtx: number | "auto";
}

export interface CloudAIConfig {
  provider: CloudProvider;
  apiKey: string;
  /** Override base URL (required for openai-compatible, optional otherwise). */
  baseUrl: string;
  model: string;
}

export interface AISettings {
  mode: AIMode;
  local: LocalAIConfig;
  cloud: CloudAIConfig;
  /**
   * Retroalimentação (opcional, default OFF): quando ativa, toda chamada de IA
   * recebe um digest do conhecimento gerado por análises anteriores
   * (artefatos do pipeline, findings do Lab, sessões) como contexto — o
   * sistema fica progressivamente mais inteligente e rápido. O usuário
   * escolhe; os dados brutos sempre prevalecem sobre o conhecimento gerado.
   */
  feedbackEnabled: boolean;
  /**
   * Processos de IA em segundo plano (default ON): filas de geração
   * (Investigar, Decision Center, Experimentos, Metodologias) continuam
   * rodando quando o usuário navega para outra página. Quando OFF, a página
   * pausa a fila ao desmontar.
   */
  backgroundRuns: boolean;
  /**
   * Injeção de missão (default ON): o objetivo definido em Fluxo → Missão é
   * incluído automaticamente nos prompts de IA de todas as superfícies.
   */
  missionInjection: boolean;
  /**
   * Autosave de saídas (default ON): toda geração concluída é persistida no
   * inventário de saídas (aiOutputStore) — recarregar a página não apaga.
   */
  autoSaveOutputs: boolean;
  /**
   * Modo de concorrência de IA (default "parallel"): "parallel" permite que
   * várias gerações rodem ao mesmo tempo (até `maxConcurrent` streams
   * simultâneos no runner/fila e sem abort de mensagem anterior no chat);
   * "sequential" força um stream por vez (comportamento clássico).
   */
  concurrencyMode: "parallel" | "sequential";
  /** Máximo de streams paralelos (1–8; usado quando concurrencyMode=parallel). */
  maxConcurrent: number;
}

export const DEFAULT_AI_SETTINGS: AISettings = {
  // Padrão AUTO: a IA resolve do hardware detectado no servidor (modelo que
  // cabe na VRAM/RAM + contexto do tier + GPU/Metal quando houver). Sem
  // Ollama instalado, as superfícies de IA mostram estado honesto e TUDO o
  // resto continua funcionando (coleta, dashboards, pipeline determinístico,
  // exports) — desligar de vez é opt-out via modo "none".
  mode: "auto",
  feedbackEnabled: false,
  backgroundRuns: true,
  missionInjection: true,
  autoSaveOutputs: true,
  concurrencyMode: "parallel",
  maxConcurrent: 3,
  local: {
    ollamaUrl: "http://localhost:11434",
    // Default concreto do modo local manual: gemma3:4b @ 8192 tokens (leve,
    // roda em praticamente qualquer máquina). "auto" segue disponível nos
    // dropdowns e resolve do perfil (RTX 3060 → gemma3:12b@16k; Mac M1 8GB →
    // gemma3:4b@16k via Metal; sem GPU → CPU).
    model: "gemma3:4b",
    useGpu: true,
    numCtx: 8192,
  },
  cloud: {
    provider: "openai",
    apiKey: "",
    baseUrl: "",
    model: "gpt-4o-mini",
  },
};

const STORAGE_KEY = "aso:ai-settings:v1";

let cachedSnapshot: AISettings = DEFAULT_AI_SETTINGS;
let cachedFingerprint = "";

function fingerprint(s: AISettings): string {
  return JSON.stringify(s);
}

function read(): AISettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_AI_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      mode: parsed.mode ?? "local",
      feedbackEnabled: parsed.feedbackEnabled === true,
      backgroundRuns: parsed.backgroundRuns !== false,
      missionInjection: parsed.missionInjection !== false,
      autoSaveOutputs: parsed.autoSaveOutputs !== false,
      concurrencyMode: parsed.concurrencyMode === "sequential" ? "sequential" : "parallel",
      maxConcurrent: clampMaxConcurrent(parsed.maxConcurrent),
      local: { ...DEFAULT_AI_SETTINGS.local, ...(parsed.local ?? {}) },
      cloud: { ...DEFAULT_AI_SETTINGS.cloud, ...(parsed.cloud ?? {}) },
    };
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

function refreshCache(): void {
  const s = read();
  const fp = fingerprint(s);
  if (fp !== cachedFingerprint) {
    cachedSnapshot = s;
    cachedFingerprint = fp;
  }
}

refreshCache();

// --- pub/sub ---
const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function notify(): void {
  refreshCache();
  for (const cb of listeners) cb();
}

function persist(s: AISettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch { /* quota / disabled */ }
  cachedSnapshot = s;
  cachedFingerprint = fingerprint(s);
  for (const cb of listeners) cb();
}

export function getAISettings(): AISettings {
  refreshCache();
  return cachedSnapshot;
}

export function setAISettings(patch: Partial<AISettings>): void {
  persist({ ...getAISettings(), ...patch });
}

export function setLocalAIConfig(patch: Partial<LocalAIConfig>): void {
  const cur = getAISettings();
  persist({ ...cur, local: { ...cur.local, ...patch } });
}

export function setCloudAIConfig(patch: Partial<CloudAIConfig>): void {
  const cur = getAISettings();
  persist({ ...cur, cloud: { ...cur.cloud, ...patch } });
}

export function setAIMode(mode: AIMode): void {
  persist({ ...getAISettings(), mode });
}

export function setFeedbackEnabled(enabled: boolean): void {
  persist({ ...getAISettings(), feedbackEnabled: enabled });
}

export function setBackgroundRuns(enabled: boolean): void {
  persist({ ...getAISettings(), backgroundRuns: enabled });
}

export function setMissionInjection(enabled: boolean): void {
  persist({ ...getAISettings(), missionInjection: enabled });
}

export function setAutoSaveOutputs(enabled: boolean): void {
  persist({ ...getAISettings(), autoSaveOutputs: enabled });
}

const MAX_CONCURRENT_LIMITS = { min: 1, max: 8 } as const;

/** Puro (exportado p/ testes): clamp 1–8, default 3. */
export function clampMaxConcurrent(v: unknown): number {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : DEFAULT_AI_SETTINGS.maxConcurrent;
  return Math.min(MAX_CONCURRENT_LIMITS.max, Math.max(MAX_CONCURRENT_LIMITS.min, n));
}

export function setConcurrencyMode(mode: "parallel" | "sequential"): void {
  persist({ ...getAISettings(), concurrencyMode: mode });
}

export function setMaxConcurrent(n: number): void {
  persist({ ...getAISettings(), maxConcurrent: clampMaxConcurrent(n) });
}

/** True quando a config atual permite mais de um stream simultâneo. */
export function isParallelIA(s: AISettings = getAISettings()): boolean {
  return s.concurrencyMode !== "sequential" && s.maxConcurrent > 1;
}

function getSnapshot(): AISettings {
  return cachedSnapshot;
}

export function useAISettings(): AISettings {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** True when the current configuration is usable for AI generation. */
export function isAIEnabled(s: AISettings = getAISettings()): boolean {
  if (s.mode === "none") return false;
  // Auto/local só precisam da URL do Ollama — o modelo pode ser "auto"
  // (resolvido no servidor a partir do hardware + modelos instalados).
  if (s.mode === "auto") return Boolean(s.local.ollamaUrl);
  if (s.mode === "local") return Boolean(s.local.ollamaUrl && s.local.model);
  if (s.mode === "cloud") return Boolean(s.cloud.apiKey && s.cloud.model);
  return false;
}

/**
 * String curta de proveniência ("local · gemma3:4b", "cloud · openai ·
 * gpt-4o-mini", "local · auto") para badges no AIOutputCard. Helper único
 * para TODAS as superfícies exibirem a mesma proveniência do pipeline
 * atual (mode cloud mostra provider+modelo).
 */
export function aiProvenance(s: AISettings = getAISettings()): string {
  if (s.mode === "cloud") {
    return `cloud · ${s.cloud.provider}${s.cloud.model ? " · " + s.cloud.model : ""}`;
  }
  if (s.mode === "auto") return "local · auto";
  if (s.mode === "local") {
    const model = s.local.model === "auto" ? "modelo automático" : s.local.model;
    return `local · ${model}`;
  }
  return "ia off";
}

// --- provider metadata for the UI ---

export interface ProviderMeta {
  id: CloudProvider;
  label: string;
  description: string;
  defaultBaseUrl: string;
  defaultModel: string;
  models: string[];
  keyUrl: string;
}

export const PROVIDER_META: Record<CloudProvider, ProviderMeta> = {
  openai: {
    id: "openai",
    label: "OpenAI (ChatGPT)",
    description: "GPT-4o, GPT-4.1, o-series. Pago por uso via API key.",
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1", "gpt-4.1-mini", "o4-mini"],
    keyUrl: "https://platform.openai.com/api-keys",
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic (Claude)",
    description: "Claude Sonnet/Opus. Pago por uso via API key.",
    defaultBaseUrl: "https://api.anthropic.com",
    defaultModel: "claude-3-5-sonnet-latest",
    models: ["claude-3-5-sonnet-latest", "claude-3-5-haiku-latest", "claude-sonnet-4-20250514"],
    keyUrl: "https://console.anthropic.com/settings/keys",
  },
  gemini: {
    id: "gemini",
    label: "Google (Gemini)",
    description: "Gemini 1.5/2.0. Free tier limitado + planos pagos.",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-1.5-flash",
    models: ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash", "gemini-2.5-flash"],
    keyUrl: "https://aistudio.google.com/app/apikey",
  },
  "openai-compatible": {
    id: "openai-compatible",
    label: "OpenAI-compatible (custom)",
    description: "Qualquer endpoint compatível: Groq, Together, OpenRouter, LM Studio, etc.",
    defaultBaseUrl: "",
    defaultModel: "",
    models: [],
    keyUrl: "",
  },
};

export const CLOUD_PROVIDERS: CloudProvider[] = ["openai", "anthropic", "gemini", "openai-compatible"];
