/**
 * Configurações de interface (UI) — opacidade, raio, tipografia, densidade,
 * velocidade de animação. Persistido em `aso:ui-settings:v1`, aplicado ao
 * vivo via classes + variáveis CSS no <html>/<body>.
 *
 * - panelOpacity: alpha dos painéis/cards (bg-card, bg-popover, bg-secondary).
 * - glassOpacity: alpha dos painéis quando o glassmorphism está ativo.
 * - radiusScale: multiplica o token --radius (arredondamento global).
 * - fontScale: multiplica o font-size raiz (escala toda a tipografia rem).
 * - density: compact | normal | spacious (espaçamentos).
 * - motion: slow | normal | fast (duração global das transições/animações).
 */
import { useEffect, useState } from "react";

export interface UISettings {
  /** 5–100 — alpha (%) dos painéis/cards. */
  panelOpacity: number;
  /** 5–95 — alpha (%) dos painéis em modo glassmorphism. */
  glassOpacity: number;
  /** 0–250 — escala (%) do raio de borda global. */
  radiusScale: number;
  /** 80–130 — escala (%) da fonte raiz. */
  fontScale: number;
  density: "compact" | "normal" | "spacious";
  motion: "slow" | "normal" | "fast";
  /**
   * Modo de superfície global:
   * - "solid": cores sólidas, sem transparência (padrão seguro).
   * - "translucent": skeumorphism/vidro — todo fundo translúcido SEMPRE vem
   *   com backdrop-blur (regra: nunca opacidade sobre conteúdo sem blur).
   */
  surfaceMode: "solid" | "translucent";
  /** Família tipográfica (Google Fonts) — ex.: "Inter", "Roboto".
   *  LEGADO: espelha fontRoles.primary (mantido para consumidores antigos). */
  fontFamily: string;
  /** Papéis tipográficos — cada um com sua família Google Fonts.
   *  secondary/mono vazios herdam da primária. */
  fontRoles: { primary: string; secondary: string; mono: string };
  /** Peso do texto normal (300–700). */
  fontWeightRegular: number;
  /** Peso do texto em destaque/negrito (500–800). */
  fontWeightBold: number;
  /** Escala dos títulos em relação ao corpo (80–150%). */
  headingScale: number;
  /** Altura de linha do texto (120–200%). */
  lineHeight: number;
}

const KEY = "aso:ui-settings:v1";

/** Papéis tipográficos exibidos na UI (label + para que serve). */
export const FONT_ROLE_META: Array<{ key: keyof UISettings["fontRoles"]; label: string; hint: string }> = [
  { key: "primary", label: "Primária", hint: "Textos e interface" },
  { key: "secondary", label: "Secundária", hint: "Títulos (h1–h4)" },
  { key: "mono", label: "Monoespaçada", hint: "Código e dados" },
];

export const DEFAULT_UI: UISettings = {
  panelOpacity: 100,
  glassOpacity: 62,
  radiusScale: 100,
  fontScale: 100,
  density: "normal",
  motion: "normal",
  surfaceMode: "solid",
  fontFamily: "Inter",
  fontRoles: { primary: "Inter", secondary: "", mono: "" },
  fontWeightRegular: 400,
  fontWeightBold: 700,
  headingScale: 100,
  lineHeight: 150,
};

/** Presets de fontes do Google (nome = query da API). */
export const FONT_PRESETS: { label: string; family: string }[] = [
  { label: "Inter (padrão)", family: "Inter" },
  { label: "Roboto", family: "Roboto" },
  { label: "Open Sans", family: "Open Sans" },
  { label: "Lato", family: "Lato" },
  { label: "Montserrat", family: "Montserrat" },
  { label: "Poppins", family: "Poppins" },
  { label: "Nunito", family: "Nunito" },
  { label: "Work Sans", family: "Work Sans" },
  { label: "Source Sans 3", family: "Source Sans 3" },
  { label: "IBM Plex Sans", family: "IBM Plex Sans" },
];

/** Sanitiza um nome de família para a URL do Google Fonts (a-z, espaços, hífen). */
export function sanitizeFontFamily(name: string): string {
  return name.replace(/[^A-Za-z0-9 -]/g, "").trim().slice(0, 60);
}

/** URL do stylesheet do Google Fonts para uma família. */
export function googleFontsUrl(family: string): string {
  const q = family.replace(/ /g, "+");
  return `https://fonts.googleapis.com/css2?family=${q}:wght@300;400;500;600;700;800&display=swap`;
}

/** URL combinada para VÁRIAS famílias (uma requisição só). */
export function googleFontsUrlFor(families: string[]): string {
  const unique = [...new Set(families.filter(Boolean))];
  if (unique.length === 0) return "";
  const q = unique
    .map((f) => `family=${f.replace(/ /g, "+")}:wght@300;400;500;600;700;800`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${q}&display=swap`;
}

let listeners: Array<() => void> = [];
let cache: UISettings | null = null;

export function getUISettings(): UISettings {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<UISettings>;
      cache = { ...DEFAULT_UI, ...parsed };
      // Migração: fontFamily antiga (sem fontRoles) vira a primária.
      if (!parsed.fontRoles) {
        cache.fontRoles = { primary: cache.fontFamily || DEFAULT_UI.fontFamily, secondary: "", mono: "" };
      }
      return cache;
    }
  } catch {
    /* corrompido → default */
  }
  cache = { ...DEFAULT_UI };
  return cache;
}

export function setUISettings(patch: Partial<UISettings>): void {
  cache = { ...getUISettings(), ...patch };
  // Reconcilia legado ↔ papéis nos dois sentidos:
  //  - patch com fontFamily (sem fontRoles) → vira a primária;
  //  - caso contrário, fontFamily (legado) espelha a primária.
  if (patch.fontFamily !== undefined && patch.fontRoles === undefined) {
    cache.fontRoles = { ...cache.fontRoles, primary: sanitizeFontFamily(patch.fontFamily) };
  }
  cache.fontFamily = cache.fontRoles.primary || cache.fontFamily;
  cache.fontWeightRegular = Math.min(700, Math.max(300, Math.round(cache.fontWeightRegular)));
  cache.fontWeightBold = Math.min(800, Math.max(500, Math.round(cache.fontWeightBold)));
  cache.headingScale = Math.min(150, Math.max(80, Math.round(cache.headingScale)));
  cache.lineHeight = Math.min(200, Math.max(120, Math.round(cache.lineHeight)));
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* quota */
  }
  applyUISettings();
  listeners.forEach((l) => l());
}

/** Define a família de UM papel tipográfico (sanitizada). */
export function setFontRole(role: keyof UISettings["fontRoles"], family: string): void {
  const roles = { ...getUISettings().fontRoles, [role]: sanitizeFontFamily(family) };
  setUISettings({ fontRoles: roles });
}

export function resetUISettings(): void {
  cache = { ...DEFAULT_UI };
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
  applyUISettings();
  listeners.forEach((l) => l());
}

/** Zera o cache em memória — a próxima leitura reparseia o storage.
 *  (usado por testes de migração e após imports externos de dados). */
export function clearUICache(): void {
  cache = null;
}

function subscribe(l: () => void): () => void {
  listeners.push(l);
  return () => {
    listeners = listeners.filter((x) => x !== l);
  };
}

export function useUISettings(): UISettings {
  const [s, setS] = useState<UISettings>(getUISettings);
  useEffect(() => subscribe(() => setS(getUISettings())), []);
  return s;
}

/**
 * Aplica as configurações como variáveis CSS + classes no <html>. Idempotente
 * — chamado na montagem do AppShell e a cada setUISettings.
 */
export function applyUISettings(): void {
  if (typeof document === "undefined") return;
  const s = getUISettings();
  const el = document.documentElement;
  el.style.setProperty("--ui-panel-opacity", String(s.panelOpacity / 100));
  el.style.setProperty("--ui-glass-opacity", String(s.glassOpacity / 100));
  el.style.setProperty("--ui-radius-scale", String(s.radiusScale / 100));
  el.style.setProperty("--ui-font-scale", String(s.fontScale / 100));
  el.classList.toggle("density-compact", s.density === "compact");
  el.classList.toggle("density-spacious", s.density === "spacious");
  el.classList.toggle("motion-slow", s.motion === "slow");
  el.classList.toggle("motion-fast", s.motion === "fast");

  // Modo de superfície: solid (cores sólidas) vs translucent (skeumorphism
  // com blur obrigatório). Classes no <html> consumidas pelo index.css.
  el.classList.toggle("ui-surface-solid", s.surfaceMode === "solid");
  el.classList.toggle("ui-surface-translucent", s.surfaceMode === "translucent");

  // Fontes do sistema (Google Fonts) — injeta/atualiza UM <link> combinado
  // com todas as famílias usadas e aplica as variáveis por papel
  // (secondary/mono vazios herdam da primária via CSS).
  const roles = s.fontRoles;
  const primary = sanitizeFontFamily(roles.primary) || DEFAULT_UI.fontFamily;
  const secondary = sanitizeFontFamily(roles.secondary);
  const mono = sanitizeFontFamily(roles.mono);
  el.style.setProperty("--ui-font-family", `'${primary}'`);
  el.style.setProperty("--ui-font-family-secondary", secondary ? `'${secondary}'` : `var(--ui-font-family)`);
  el.style.setProperty("--ui-font-family-mono", mono ? `'${mono}'` : `ui-monospace, SFMono-Regular, Menlo, monospace`);
  el.style.setProperty("--ui-font-weight-regular", String(s.fontWeightRegular));
  el.style.setProperty("--ui-font-weight-bold", String(s.fontWeightBold));
  el.style.setProperty("--ui-heading-scale", String(s.headingScale / 100));
  el.style.setProperty("--ui-line-height", String(s.lineHeight / 100));
  let link = document.getElementById("ui-font-link") as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.id = "ui-font-link";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  const url = googleFontsUrlFor([primary, secondary, mono]);
  if (url && link.href !== url) link.href = url;
}
