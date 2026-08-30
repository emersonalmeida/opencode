import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * Lightweight UI internationalization (PT/EN).
 *
 * Scope: chrome + key surfaces (nav, home, case page, settings labels).
 * NÃO é o idioma de coleta da loja (esse vive em region.ts / `aso:lang`) —
 * controla o idioma da *interface* exibida ao usuário.
 *
 * Implementação intencionalmente sem dependências: um pequeno mapa de
 * dicionários + uma função `t(key)` com PT como fonte/padrão. Novas strings
 * entram em `DICT` conforme as superfícies crescem; chaves EN ausentes caem
 * com fallback graceful no PT.
 */

export type UILang = "pt" | "en";

const STORAGE_KEY = "aso:ui-lang";

interface I18nValue {
  lang: UILang;
  setLang: (l: UILang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

type Dict = Record<string, string>;

const PT: Dict = {
  "app.title": "App Intelligence",
  "nav.home": "Início",
  "nav.dashboard": "Dashboard",
  "nav.experiments": "Experimentos",
  "nav.chat": "Chat",
  "nav.canvas": "Canvas",
  "nav.decisionCenter": "Decision Center",
  "nav.concept": "Conceito",
  "nav.playground": "Playground",
  "nav.explore": "Explorar",
  "nav.explore.desc": "Como o produto foi construído",
  "nav.atlas": "Analysis Atlas",
  "nav.atlas.desc": "Catálogo de análises (Analysis OS)",
  "nav.os": "Nexus OS",
  "nav.os.desc": "Sistema operacional inteligente (CLI + IA)",
  "settings.appearance": "Aparência",
  "settings.language": "Idioma da interface",
  "settings.language.hint": "Idioma dos textos da interface. Os dados coletados usam o idioma da loja.",
  "settings.language.pt": "Português (Brasil)",
  "settings.language.en": "English",
  "case.back": "Voltar ao produto",
  "case.progress": "Progresso da leitura",
  "case.tryInProduct": "Testar no produto",
};

const EN: Dict = {
  "app.title": "App Intelligence",
  "nav.home": "Home",
  "nav.dashboard": "Dashboard",
  "nav.experiments": "Experiments",
  "nav.chat": "Chat",
  "nav.canvas": "Canvas",
  "nav.decisionCenter": "Decision Center",
  "nav.concept": "Concept",
  "nav.playground": "Playground",
  "nav.explore": "Explore",
  "nav.explore.desc": "How the product was built",
  "nav.atlas": "Analysis Atlas",
  "nav.atlas.desc": "Analysis catalog (Analysis OS)",
  "nav.os": "Nexus OS",
  "nav.os.desc": "Intelligent operating system (CLI + AI)",
  "settings.appearance": "Appearance",
  "settings.language": "Interface language",
  "settings.language.hint": "Language of the interface text. Collected data uses the store language.",
  "settings.language.pt": "Português (Brasil)",
  "settings.language.en": "English",
  "case.back": "Back to product",
  "case.progress": "Reading progress",
  "case.tryInProduct": "Try in the product",
};

const DICTS: Record<UILang, Dict> = { pt: PT, en: EN };

// O idioma PRINCIPAL da interface é pt-BR: sem escolha salva, sempre "pt".
// Inglês é uma OPÇÃO explícita do usuário (seletor PT/EN nas Configurações),
// nunca inferido do navegador.
function detect(): UILang {
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached === "pt" || cached === "en") return cached;
  } catch { /* ignore */ }
  return "pt";
}

function interpolate(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<UILang>(detect);

  const setLang = (l: UILang) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* ignore */ }
  };

  useEffect(() => {
    document.documentElement.lang = lang === "en" ? "en" : "pt-BR";
  }, [lang]);

  const t = (key: string, vars?: Record<string, string | number>): string => {
    const dict = DICTS[lang];
    const v = dict[key] ?? PT[key] ?? key;
    return interpolate(v, vars);
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Fallback para componentes renderizados fora do provider (ex.: testes).
    return {
      lang: "pt",
      setLang: () => {},
      t: (k) => PT[k] ?? k,
    };
  }
  return ctx;
}
