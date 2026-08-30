/**
 * Configurações de EXIBIÇÃO da saída de IA (AIOutputCard) — escala de
 * leitura e barra de status da geração. Persistido em
 * `aso:ai-output-settings:v1`, pub/sub padrão do sistema.
 *
 * A escala destaca o conteúdo gerado por IA do restante da interface:
 * por padrão o texto renderizado é 25% maior (125%). O usuário pode
 * ajustar globalmente (Configurações) ou por card (botões A−/A+ no
 * próprio componente — override persistido por `storageKey`).
 */
import { useEffect, useState } from "react";

export interface AIOutputSettings {
  /** 75–250 — escala (%) do conteúdo renderizado (default 125). */
  fontScale: number;
  /** Exibe a barra de status da geração (tempo, tokens, palavras). */
  showStatusBar: boolean;
}

const KEY = "aso:ai-output-settings:v1";
const OVERRIDE_PREFIX = "aso:ai-output-scale:";

export const DEFAULT_AI_OUTPUT: AIOutputSettings = {
  fontScale: 125,
  showStatusBar: true,
};

/** Limites de escala permitidos (global e por card). */
export const SCALE_MIN = 75;
export const SCALE_MAX = 250;
/** Passo dos botões A−/A+. */
export const SCALE_STEP = 25;
/** Presets exibidos na UI de configuração. */
export const SCALE_PRESETS = [100, 125, 150, 175, 200] as const;

export function clampScale(v: number): number {
  if (!Number.isFinite(v)) return DEFAULT_AI_OUTPUT.fontScale;
  return Math.min(SCALE_MAX, Math.max(SCALE_MIN, Math.round(v)));
}

let listeners: Array<() => void> = [];
let cache: AIOutputSettings | null = null;

export function getAIOutputSettings(): AIOutputSettings {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AIOutputSettings>;
      cache = {
        fontScale: clampScale(parsed.fontScale ?? DEFAULT_AI_OUTPUT.fontScale),
        showStatusBar: parsed.showStatusBar ?? DEFAULT_AI_OUTPUT.showStatusBar,
      };
      return cache;
    }
  } catch {
    /* corrompido → default */
  }
  cache = { ...DEFAULT_AI_OUTPUT };
  return cache;
}

function notify() {
  for (const l of listeners) l();
}

export function setAIOutputSettings(patch: Partial<AIOutputSettings>): void {
  const next = { ...getAIOutputSettings(), ...patch };
  next.fontScale = clampScale(next.fontScale);
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  notify();
}

export function resetAIOutputSettings(): void {
  cache = { ...DEFAULT_AI_OUTPUT };
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  notify();
}

export function subscribeAIOutputSettings(fn: () => void): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

/* ------------------------------------------------- override por card --- */

/** Lê o override de escala de um card específico (null = segue o global). */
export function getCardScaleOverride(storageKey: string): number | null {
  try {
    const raw = localStorage.getItem(OVERRIDE_PREFIX + storageKey);
    if (raw == null) return null;
    const v = Number(raw);
    return Number.isFinite(v) ? clampScale(v) : null;
  } catch {
    return null;
  }
}

/** Persiste (ou limpa, com null) o override de escala de um card. */
export function setCardScaleOverride(storageKey: string, scale: number | null): void {
  try {
    if (scale == null) localStorage.removeItem(OVERRIDE_PREFIX + storageKey);
    else localStorage.setItem(OVERRIDE_PREFIX + storageKey, String(clampScale(scale)));
  } catch {
    /* ignore */
  }
  notify();
}

/** Escala efetiva de um card: override próprio ou o global. */
export function effectiveScale(storageKey?: string): number {
  if (storageKey) {
    const o = getCardScaleOverride(storageKey);
    if (o != null) return o;
  }
  return getAIOutputSettings().fontScale;
}

/* ------------------------------------------------------------- hook --- */

export function useAIOutputSettings(): AIOutputSettings {
  const [s, setS] = useState<AIOutputSettings>(getAIOutputSettings);
  useEffect(() => subscribeAIOutputSettings(() => setS(getAIOutputSettings())), []);
  return s;
}

/* --------------------------------------------------- estimativa de uso --- */

export interface GenerationStats {
  words: number;
  chars: number;
  /** Estimativa de tokens (~4 chars/token, regra prática pt/en). */
  tokensEst: number;
  /** Duração da geração (s) — 0 se desconhecida. */
  seconds: number;
  /** Tokens/segundo (0 se sem duração). */
  tokensPerSec: number;
  /** Tempo de leitura estimado (min, ~200 palavras/min). */
  readingMin: number;
}

export function generationStats(content: string, seconds: number): GenerationStats {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  const chars = content.length;
  const tokensEst = Math.round(chars / 4);
  return {
    words,
    chars,
    tokensEst,
    seconds,
    tokensPerSec: seconds > 0 ? Math.round(tokensEst / seconds) : 0,
    readingMin: Math.max(1, Math.ceil(words / 200)),
  };
}

export function formatDuration(seconds: number): string {
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
  if (seconds < 60) return `${seconds.toFixed(1).replace(/\.0$/, "")}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}min ${s}s`;
}
