/**
 * Region auto-detection.
 * Usa navigator.language + um pequeno mapa locale→país. Fallback "br".
 * O resultado é memoizado no localStorage — a primeira chamada é o único custo
 * de detecção.
 */

const KEY = "aso:region";
const LANG_KEY = "aso:lang";

export const REGION_OPTIONS: { code: string; label: string; flag: string }[] = [
  { code: "br", label: "Brasil", flag: "🇧🇷" },
  { code: "pt", label: "Portugal", flag: "🇵🇹" },
  { code: "us", label: "Estados Unidos", flag: "🇺🇸" },
  { code: "gb", label: "Reino Unido", flag: "🇬🇧" },
  { code: "es", label: "Espanha", flag: "🇪🇸" },
  { code: "mx", label: "México", flag: "🇲🇽" },
  { code: "ar", label: "Argentina", flag: "🇦🇷" },
  { code: "fr", label: "França", flag: "🇫🇷" },
  { code: "de", label: "Alemanha", flag: "🇩🇪" },
  { code: "it", label: "Itália", flag: "🇮🇹" },
  { code: "ca", label: "Canadá", flag: "🇨🇦" },
  { code: "jp", label: "Japão", flag: "🇯🇵" },
  { code: "kr", label: "Coreia do Sul", flag: "🇰🇷" },
  { code: "in", label: "Índia", flag: "🇮🇳" },
  { code: "au", label: "Austrália", flag: "🇦🇺" },
];

export const LANGUAGE_OPTIONS: { code: string; label: string }[] = [
  { code: "pt_BR", label: "Português (Brasil)" },
  { code: "pt_PT", label: "Português (Portugal)" },
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "zh_CN", label: "中文 (简体)" },
];


function detect(): string {
  // Padrão do sistema: Brasil / pt-BR.
  return "br";
}

export function getUserRegion(): string {
  try {
    const cached = localStorage.getItem(KEY);
    if (cached) return cached;
  } catch { /* ignore */ }
  const r = detect();
  try { localStorage.setItem(KEY, r); } catch { /* ignore */ }
  return r;
}

export function setUserRegion(r: string) {
  try { localStorage.setItem(KEY, r); } catch { /* ignore */ }
}

export function getUserLanguage(): string {
  try {
    const cached = localStorage.getItem(LANG_KEY);
    if (cached) return cached;
  } catch { /* ignore */ }
  return "pt_BR";
}

export function setUserLanguage(l: string) {
  try { localStorage.setItem(LANG_KEY, l); } catch { /* ignore */ }
}

export function langForCountry(country: string): string {
  // Se o usuário fixou um idioma manualmente, ele tem prioridade sobre a heurística por país.
  try {
    const override = localStorage.getItem(LANG_KEY);
    if (override) return override;
  } catch { /* ignore */ }
  const c = country.toLowerCase();
  if (c === "br") return "pt_BR";
  if (c === "pt") return "pt_PT";
  if (c === "us" || c === "gb" || c === "au" || c === "ca" || c === "in") return "en";
  if (c === "es" || c === "mx" || c === "ar") return "es";
  if (c === "fr") return "fr";
  if (c === "de") return "de";
  if (c === "it") return "it";
  if (c === "jp") return "ja";
  if (c === "kr") return "ko";
  if (c === "cn") return "zh_CN";
  if (c === "tw") return "zh_TW";
  return "en";
}
