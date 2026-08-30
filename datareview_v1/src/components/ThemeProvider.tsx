import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { contrastForeground, normalizeColor } from "@/lib/colorUtils";

type Theme = "light" | "dark" | "system";

/**
 * Paleta da cor principal: famílias coloridas em escalas (vívida/suave/
 * profunda) + monocromáticas. `group` organiza a UI; a lista flat
 * (`primaryColors`) mantém retrocompat com consumidores existentes.
 */
export interface PrimaryColorOption {
  name: string;
  hsl: string;
  group: "colorida" | "monocromatica";
}

const PRIMARY_COLORS: PrimaryColorOption[] = [
  // — Coloridas (escala vívida) —
  { name: "Azul", hsl: "220 90% 56%", group: "colorida" },
  { name: "Violeta", hsl: "262 80% 60%", group: "colorida" },
  { name: "Verde", hsl: "160 70% 45%", group: "colorida" },
  { name: "Rosa", hsl: "340 80% 55%", group: "colorida" },
  { name: "Laranja", hsl: "25 95% 55%", group: "colorida" },
  { name: "Vermelho", hsl: "0 75% 55%", group: "colorida" },
  { name: "Ciano", hsl: "190 85% 45%", group: "colorida" },
  { name: "Âmbar", hsl: "45 95% 50%", group: "colorida" },
  // — Coloridas (suaves) —
  { name: "Azul suave", hsl: "220 70% 60%", group: "colorida" },
  { name: "Violeta suave", hsl: "262 60% 66%", group: "colorida" },
  { name: "Verde suave", hsl: "160 50% 50%", group: "colorida" },
  { name: "Rosa suave", hsl: "340 60% 62%", group: "colorida" },
  { name: "Laranja suave", hsl: "25 80% 60%", group: "colorida" },
  { name: "Vermelho suave", hsl: "0 60% 60%", group: "colorida" },
  { name: "Ciano suave", hsl: "190 60% 52%", group: "colorida" },
  { name: "Âmbar suave", hsl: "45 80% 55%", group: "colorida" },
  // — Coloridas (profundas) —
  { name: "Azul profundo", hsl: "225 85% 42%", group: "colorida" },
  { name: "Violeta profundo", hsl: "265 70% 45%", group: "colorida" },
  { name: "Verde profundo", hsl: "160 75% 32%", group: "colorida" },
  { name: "Rosa profundo", hsl: "340 75% 42%", group: "colorida" },
  { name: "Laranja profundo", hsl: "22 90% 42%", group: "colorida" },
  { name: "Vermelho profundo", hsl: "0 70% 42%", group: "colorida" },
  { name: "Ciano profundo", hsl: "190 80% 35%", group: "colorida" },
  { name: "Âmbar profundo", hsl: "42 90% 38%", group: "colorida" },
  // — Monocromáticas —
  { name: "Grafite", hsl: "240 6% 45%", group: "monocromatica" },
  { name: "Cinza azulado", hsl: "220 12% 50%", group: "monocromatica" },
  { name: "Cinza neutro", hsl: "0 0% 45%", group: "monocromatica" },
  { name: "Carvão", hsl: "240 5% 26%", group: "monocromatica" },
  { name: "Prata", hsl: "220 8% 65%", group: "monocromatica" },
  { name: "Marrom", hsl: "25 25% 40%", group: "monocromatica" },
];

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
  primaryColor: string;
  setPrimaryColor: (hsl: string) => void;
  primaryColors: typeof PRIMARY_COLORS;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  setTheme: () => {},
  primaryColor: PRIMARY_COLORS[0].hsl,
  setPrimaryColor: () => {},
  primaryColors: PRIMARY_COLORS,
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem("app-theme");
    return (stored as Theme) || "system";
  });
  const [primaryColor, setPrimaryColorState] = useState(() => {
    return localStorage.getItem("app-primary-color") || PRIMARY_COLORS[0].hsl;
  });

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      root.classList.remove("light", "dark");
      if (theme === "system") {
        const sys = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        root.classList.add(sys);
      } else {
        root.classList.add(theme);
      }
    };
    apply();
    localStorage.setItem("app-theme", theme);
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => apply();
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [theme]);

  useEffect(() => {
    // Normaliza (aceita hsl/hex/rgb do input manual) e deriva o foreground
    // com MELHOR CONTRASTE sobre a cor principal — o sistema é inteligente:
    // fundo claro → texto escuro; fundo escuro → texto claro (WCAG 4.5+).
    const normalized = normalizeColor(primaryColor) ?? primaryColor;
    const root = document.documentElement;
    root.style.setProperty("--primary", normalized);
    root.style.setProperty("--primary-foreground", contrastForeground(normalized));
    root.style.setProperty("--ring", normalized);
    root.style.setProperty("--chart-1", normalized);
    localStorage.setItem("app-primary-color", normalized);
  }, [primaryColor]);

  const setTheme = (t: Theme) => setThemeState(t);
  /** Aceita triple HSL ("262 80% 60%"), hex (#8b5cf6) ou rgb()/rgba()/hsl(). */
  const setPrimaryColor = (color: string) => {
    const normalized = normalizeColor(color);
    if (normalized) setPrimaryColorState(normalized);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, primaryColor, setPrimaryColor, primaryColors: PRIMARY_COLORS }}>
      {children}
    </ThemeContext.Provider>
  );
}
