/**
 * UiThemeMenu — menu de customização de tema reutilizável (aberto da
 * toolbar da página UI): modos (claro/escuro/sistema), cor principal,
 * tipografia (Google Fonts por papel) e motion (velocidade das animações).
 *
 * Monta SÓ componentes existentes do sistema (ThemeProvider,
 * PrimaryColorSwatches, CustomPrimaryColor, FontRolePicker, uiSettings).
 * O mesmo bloco se encaixa em qualquer superfície — a página UI é a
 * documentação viva de como compor esses controles.
 */
import { useRef, useEffect, useState } from "react";
import { Sun, Moon, Monitor, Palette, X } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { PrimaryColorSwatches } from "@/components/settings/PrimaryColorSwatches";
import { CustomPrimaryColor } from "@/components/settings/CustomPrimaryColor";
import { FontRolePicker } from "@/components/settings/FontRolePicker";
import { useUISettings, setUISettings, FONT_ROLE_META } from "@/lib/uiSettings";
import { cn } from "@/lib/utils";

/** Opções de motion com descrição honesta. */
const MOTION_OPTIONS = [
  { key: "slow", label: "Lenta", hint: "animações duram ~2× mais (~? )" },
  { key: "normal", label: "Normal", hint: "durações padrão do design system" },
  { key: "fast", label: "Rápida", hint: "animações mais curtas" },
] as const;

export function UiThemeMenu() {
  const { theme, setTheme, primaryColors } = useTheme();
  const ui = useUISettings();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        aria-label="Customizar tema"
        aria-expanded={open}
        title="Customizar tema — modos, cor principal, fonte e motion"
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex-shrink-0"
      >
        <Palette className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">Tema</span>
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Customização de tema"
          className="absolute right-0 top-full mt-2 w-72 max-h-[80vh] overflow-y-auto bg-card border border-border rounded-xl shadow-xl p-3 space-y-3 z-50 animate-fade-in-up"
        >
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tema</p>
            <button
              onClick={() => setOpen(false)}
              aria-label="Fechar"
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <div>
            <p className="text-[9px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Modo</p>
            <div className="flex gap-1" role="group" aria-label="Modo do tema">
              {[
                { key: "light", icon: Sun, label: "Claro" },
                { key: "dark", icon: Moon, label: "Escuro" },
                { key: "system", icon: Monitor, label: "Sistema" },
              ].map((m) => (
                <button
                  key={m.key}
                  onClick={() => setTheme(m.key as "light" | "dark" | "system")}
                  aria-pressed={theme === m.key}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] transition-colors",
                    theme === m.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                  )}
                >
                  <m.icon className="h-3 w-3" /> {m.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[9px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">
              Cor principal · {primaryColors.length} opções
            </p>
            <PrimaryColorSwatches columns={8} />
            <CustomPrimaryColor />
          </div>
          <div className="space-y-2">
            <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">Tipografia</p>
            {FONT_ROLE_META.map((r) => (
              <FontRolePicker key={r.key} role={r.key} label={r.label} hint={r.hint} />
            ))}
            <p className="text-[9px] text-muted-foreground leading-snug">
              Famílias do Google Fonts sob demanda; fallback do sistema na falha de rede.
            </p>
          </div>
          <div>
            <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Motion</p>
            <div className="flex gap-1" role="group" aria-label="Velocidade das animações">
              {MOTION_OPTIONS.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setUISettings({ motion: m.key })}
                  aria-pressed={ui.motion === m.key}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-[10px] transition-colors",
                    ui.motion === m.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
