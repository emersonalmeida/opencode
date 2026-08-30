/**
 * Personalização visual — fundo da interface de verdade.
 *
 * Abordagem: uma camada de fundo dedicada (`BackgroundLayer`, em
 * `src/components/BackgroundLayer.tsx`, z-index -1) renderizada pelo AppShell
 * atrás de todo o conteúdo. Quando `mode !== "none"`, a classe `has-custom-bg`
 * no <html> torna shells/containers transparentes via CSS (em index.css),
 * deixando o fundo aparecer. Glassmorphism opcional deixa painéis
 * translúcidos com blur.
 *
 * Modos: none | gradient | color | image | video (direta ou YouTube embed).
 * Extras: animação (pan/ken-burns), blur, overlay de legibilidade, glass,
 * efeitos (liga/desliga animações do app), presets de tema completos.
 */
import { useEffect, useState } from "react";

export interface BackgroundSettings {
  mode: "none" | "gradient" | "color" | "image" | "video";
  gradient: string;
  color: string;
  imageUrl: string;
  /** URL de vídeo direta (.mp4/.webm/.ogg) ou YouTube (watch/embed/shorts/youtu.be). */
  videoUrl: string;
  animated: boolean;
  /** Blur aplicado na camada de fundo (px, 0–40). */
  blur: number;
  /** Scrim para legibilidade (0–90%). */
  overlayOpacity: number;
  overlayColor: "dark" | "light";
  /** Painéis translúcidos com backdrop-blur. */
  glass: boolean;
  /** Desliga TODAS as animações/transições do app. */
  noEffects: boolean;
}

const STORAGE_KEY = "aso:appearance-bg:v1";
export const DEFAULT_BG: BackgroundSettings = {
  mode: "none",
  gradient: "linear-gradient(135deg, hsl(260 80% 60%), hsl(210 90% 55%))",
  color: "hsl(230 40% 12%)",
  imageUrl: "",
  videoUrl: "",
  animated: false,
  blur: 0,
  overlayOpacity: 15,
  overlayColor: "dark",
  glass: false,
  noEffects: false,
};

export const GRADIENT_PRESETS: { label: string; css: string }[] = [
  { label: "Violeta azul", css: "linear-gradient(135deg, hsl(260 80% 60%), hsl(210 90% 55%))" },
  { label: "Aurora", css: "linear-gradient(135deg, hsl(160 60% 45%), hsl(200 70% 40%))" },
  { label: "Pôr do sol", css: "linear-gradient(135deg, hsl(20 90% 60%), hsl(320 80% 60%))" },
  { label: "Noite profunda", css: "linear-gradient(135deg, hsl(230 50% 12%), hsl(280 60% 22%))" },
  { label: "Menta", css: "linear-gradient(135deg, hsl(150 60% 40%), hsl(190 70% 45%))" },
  { label: "Fire", css: "linear-gradient(135deg, hsl(40 95% 55%), hsl(5 90% 55%))" },
  { label: "Papel", css: "linear-gradient(135deg, hsl(40 30% 94%), hsl(30 25% 88%))" },
  { label: "Oceano", css: "linear-gradient(135deg, hsl(210 80% 30%), hsl(190 70% 45%))" },
];

/** Presets de tema completos — um clique aplica um conjunto coeso. */
export interface ThemePreset {
  id: string;
  label: string;
  description: string;
  settings: Partial<BackgroundSettings>;
}
export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "aurora-glass",
    label: "Aurora (vidro)",
    description: "Gradiente frio animado + painéis de vidro",
    settings: {
      mode: "gradient",
      gradient: "linear-gradient(135deg, hsl(160 60% 45%), hsl(200 70% 40%))",
      animated: true, glass: true, blur: 0, overlayOpacity: 35, overlayColor: "dark",
    },
  },
  {
    id: "noite",
    label: "Noite profunda",
    description: "Gradiente escuro estático, painéis sólidos",
    settings: {
      mode: "gradient",
      gradient: "linear-gradient(135deg, hsl(230 50% 12%), hsl(280 60% 22%))",
      animated: false, glass: false, blur: 0, overlayOpacity: 20, overlayColor: "dark",
    },
  },
  {
    id: "por-do-sol",
    label: "Pôr do sol",
    description: "Quente + vidro + pan lento",
    settings: {
      mode: "gradient",
      gradient: "linear-gradient(135deg, hsl(20 90% 60%), hsl(320 80% 60%))",
      animated: true, glass: true, blur: 0, overlayOpacity: 30, overlayColor: "dark",
    },
  },
  {
    id: "minimal",
    label: "Minimal",
    description: "Sem fundo — tema padrão do sistema",
    settings: { mode: "none" },
  },
];

let settings: BackgroundSettings = DEFAULT_BG;
const listeners = new Set<() => void>();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) settings = { ...DEFAULT_BG, ...JSON.parse(raw) };
  } catch { /* corrupt → default */ }
}
load();

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  listeners.forEach((l) => l());
}

export function getBackgroundSettings(): BackgroundSettings {
  return settings;
}

export function setBackgroundSettings(patch: Partial<BackgroundSettings>) {
  settings = { ...settings, ...patch };
  persist();
  applyBackground();
}

export function subscribeBackground(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Hook reativo (padrão useDataset). */
export function useBackgroundSettings(): BackgroundSettings {
  const [s, setS] = useState(settings);
  useEffect(() => subscribeBackground(() => setS(settings)), []);
  return s;
}

/**
 * Aplica apenas as classes de estado no <html> — o conteúdo do fundo em si é
 * renderizado pelo <BackgroundLayer />. Classes:
 *  - has-custom-bg   → torna shells transparentes (CSS em index.css)
 *  - bg-glass        → painéis translúcidos (backdrop-blur)
 *  - bg-no-effects   → desliga animações/transições globais
 */
export function applyBackground() {
  const root = document.documentElement;
  root.classList.toggle("has-custom-bg", settings.mode !== "none");
  root.classList.toggle("bg-glass", settings.mode !== "none" && settings.glass);
  root.classList.toggle("bg-no-effects", settings.noEffects);
}

/** Extrai ID de vídeo do YouTube de URLs comuns. */
export function extractYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
}

/** True se videoUrl parece vídeo direto (mp4/webm/ogg/mov). */
export function isDirectVideoUrl(url: string): boolean {
  return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);
}
