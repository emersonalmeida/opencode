/**
 * Design tokens GLOBAIS — overrides do design system aplicados ao app inteiro
 * (diferente do `tokenOverrides` do Design Canvas, que é escopado ao board).
 *
 * Persistido em `aso:design-tokens:v1`. `applyDesignTokens()` injeta as
 * variáveis CSS no <html> (:root), por modo (light/dark), chamado no mount
 * do AppShell e a cada set. Presets prontos em `TOKEN_PRESETS`.
 */
import { useEffect, useState } from "react";
import { DESIGN_TOKENS } from "@/lib/designCanvas/registry";
import { tokenDefault, TOKEN_CATALOG } from "@/lib/tokenDefaults";

export interface DesignTokenState {
  /** overrides por modo: cssVar → valor (HSL triple "H S% L%" ou rem). */
  light: Record<string, string>;
  dark: Record<string, string>;
}

export interface TokenPreset {
  id: string;
  label: string;
  description: string;
  /** Overrides do modo claro. */
  tokens: Record<string, string>;
  /** Overrides do modo escuro (opcional — cai em `tokens` se ausente). */
  darkTokens?: Record<string, string>;
}

const KEY = "aso:design-tokens:v1";

export const DEFAULT_TOKEN_STATE: DesignTokenState = { light: {}, dark: {} };

/** Presets coesos — cada um cobre os dois modos (claro + escuro). */
export const TOKEN_PRESETS: TokenPreset[] = [
  {
    id: "violeta",
    label: "Violeta",
    description: "Primária violeta vibrante, fundos neutros.",
    tokens: { primary: "262 83% 58%", "primary-foreground": "0 0% 100%", ring: "262 83% 58%", accent: "262 40% 96%", "accent-foreground": "262 83% 30%", "sidebar-primary": "262 83% 58%", "sidebar-ring": "262 83% 58%" },
    darkTokens: { primary: "262 83% 68%", "primary-foreground": "240 5.9% 10%", ring: "262 83% 68%", accent: "262 30% 20%", "accent-foreground": "262 83% 88%", "sidebar-primary": "262 83% 68%", "sidebar-ring": "262 83% 68%", "status-info": "262 83% 68%" },
  },
  {
    id: "oceano",
    label: "Oceano",
    description: "Azul profundo com acentos ciano.",
    tokens: { primary: "210 90% 45%", "primary-foreground": "0 0% 100%", ring: "210 90% 45%", accent: "205 60% 95%", "accent-foreground": "210 90% 25%", "sidebar-primary": "210 90% 45%", "sidebar-ring": "210 90% 45%" },
    darkTokens: { primary: "205 90% 62%", "primary-foreground": "222 47% 11%", ring: "205 90% 62%", accent: "210 40% 18%", "accent-foreground": "205 90% 85%", "sidebar-primary": "205 90% 62%", "sidebar-ring": "205 90% 62%", "status-running": "205 90% 62%" },
  },
  {
    id: "floresta",
    label: "Floresta",
    description: "Verde esmeralda, tons orgânicos.",
    tokens: { primary: "152 60% 36%", "primary-foreground": "0 0% 100%", ring: "152 60% 36%", accent: "150 30% 94%", "accent-foreground": "152 60% 20%", "sidebar-primary": "152 60% 36%", "sidebar-ring": "152 60% 36%" },
    darkTokens: { primary: "152 60% 48%", "primary-foreground": "150 60% 8%", ring: "152 60% 48%", accent: "152 25% 18%", "accent-foreground": "152 60% 85%", "sidebar-primary": "152 60% 48%", "sidebar-ring": "152 60% 48%", "status-success": "152 60% 48%" },
  },
  {
    id: "solar",
    label: "Solar",
    description: "Âmbar quente com alto contraste.",
    tokens: { primary: "32 95% 44%", "primary-foreground": "0 0% 100%", ring: "32 95% 44%", accent: "40 60% 94%", "accent-foreground": "32 95% 24%", "sidebar-primary": "32 95% 44%", "sidebar-ring": "32 95% 44%" },
    darkTokens: { primary: "38 95% 55%", "primary-foreground": "30 90% 10%", ring: "38 95% 55%", accent: "35 40% 18%", "accent-foreground": "38 95% 85%", "sidebar-primary": "38 95% 55%", "sidebar-ring": "38 95% 55%", "status-warning": "38 95% 55%" },
  },
];

let cache: DesignTokenState | null = null;
const listeners = new Set<() => void>();

export function getDesignTokens(): DesignTokenState {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DesignTokenState>;
      cache = {
        light: { ...(parsed.light ?? {}) },
        dark: { ...(parsed.dark ?? {}) },
      };
      return cache;
    }
  } catch { /* corrupt → default */ }
  cache = { light: {}, dark: {} };
  return cache;
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* quota */ }
}

function notify() { listeners.forEach((l) => l()); }

/** Valida formato básico: "H S% L%[/ A]" (cor, alpha opcional 0–1) ou "<n>rem" (raio). */
export function isValidTokenValue(cssVar: string, value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (cssVar === "radius") return /^\d*\.?\d+rem$/.test(v);
  return /^\d{1,3}(\.\d+)?\s+\d{1,3}(\.\d+)?%\s+\d{1,3}(\.\d+)?%(\s+\/\s+(\d*\.?\d+))?$/.test(v)
    && (() => { const m = v.match(/\/\s+(\d*\.?\d+)$/); return !m || (Number(m[1]) >= 0 && Number(m[1]) <= 1); })();
}

export function setDesignToken(mode: "light" | "dark", cssVar: string, value: string): void {
  const s = getDesignTokens();
  cache = { ...s, [mode]: { ...s[mode], [cssVar]: value } };
  persist(); applyDesignTokens(); notify();
}

export function clearDesignToken(mode: "light" | "dark", cssVar: string): void {
  const s = getDesignTokens();
  const next = { ...s[mode] };
  delete next[cssVar];
  cache = { ...s, [mode]: next };
  persist(); applyDesignTokens(); notify();
}

/** Aplica vários overrides de uma vez (um único apply+notify). */
export function setDesignTokens(mode: "light" | "dark", tokens: Record<string, string>): void {
  const s = getDesignTokens();
  cache = { ...s, [mode]: { ...s[mode], ...tokens } };
  persist(); applyDesignTokens(); notify();
}

export function applyTokenPreset(presetId: string, mode: "light" | "dark" = "light"): void {
  const preset = TOKEN_PRESETS.find((p) => p.id === presetId);
  if (!preset) return;
  const tokens = mode === "dark" ? (preset.darkTokens ?? preset.tokens) : preset.tokens;
  setDesignTokens(mode, tokens);
}

/** Aplica o preset aos DOIS modos de uma vez. */
export function applyTokenPresetBothModes(presetId: string): void {
  const preset = TOKEN_PRESETS.find((p) => p.id === presetId);
  if (!preset) return;
  const s = getDesignTokens();
  cache = {
    light: { ...s.light, ...preset.tokens },
    dark: { ...s.dark, ...(preset.darkTokens ?? preset.tokens) },
  };
  persist(); applyDesignTokens(); notify();
}

/** Valor EFETIVO de um token: override do usuário ou padrão do catálogo. */
export function effectiveTokenValue(mode: "light" | "dark", cssVar: string): string {
  const s = getDesignTokens();
  return s[mode][cssVar] ?? tokenDefault(mode, cssVar) ?? "";
}

export function resetDesignTokens(): void {
  cache = { light: {}, dark: {} };
  persist(); applyDesignTokens(); notify();
}

export function countTokenOverrides(): number {
  const s = getDesignTokens();
  return Object.keys(s.light).length + Object.keys(s.dark).length;
}

/** Injeta overrides no <html> (escopo por modo via classe .dark). */
export function applyDesignTokens(): void {
  if (typeof document === "undefined") return;
  const s = getDesignTokens();
  let styleEl = document.getElementById("design-token-overrides") as HTMLStyleElement | null;
  const light = Object.entries(s.light).map(([k, v]) => `--${k}: ${v};`).join("\n");
  const dark = Object.entries(s.dark).map(([k, v]) => `--${k}: ${v};`).join("\n");
  const css = `${light ? `:root {\n${light}\n}` : ""}${dark ? `\n.dark {\n${dark}\n}` : ""}`;
  if (!css) {
    styleEl?.remove();
    return;
  }
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "design-token-overrides";
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = css;
}

export function useDesignTokens(): DesignTokenState {
  const [s, setS] = useState<DesignTokenState>(getDesignTokens);
  useEffect(() => {
    const l = () => setS(getDesignTokens());
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return s;
}

/** Lista canônica de tokens editáveis (fonte: registry do Design Canvas). */
export { DESIGN_TOKENS };

/** Catálogo completo (todos os tokens, valores padrão light/dark, grupos). */
export { TOKEN_CATALOG, TOKEN_GROUP_META, TOKEN_GROUP_ORDER, getTokenSpec, tokenDefault, tokensByGroup } from "@/lib/tokenDefaults";
