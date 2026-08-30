import { Sun, Moon, Monitor, Palette } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { PrimaryColorSwatches } from "@/components/settings/PrimaryColorSwatches";
import { useState, useRef, useEffect } from "react";

export function ThemeToggle() {
  const { theme, setTheme, primaryColors } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
      >
        <Palette className="h-3.5 w-3.5" />
        <span className="text-xs hidden sm:inline">Tema</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-card border border-border rounded-xl shadow-xl p-3 space-y-3 z-50 animate-fade-in-up">
          <div>
            <p className="text-[10px] font-medium text-muted-foreground mb-2 uppercase tracking-wider">Modo</p>
            <div className="flex gap-1">
              {[
                { key: "light" as const, icon: Sun, label: "Claro" },
                { key: "dark" as const, icon: Moon, label: "Escuro" },
                { key: "system" as const, icon: Monitor, label: "Sistema" },
              ].map((m) => (
                <button
                  key={m.key}
                  onClick={() => setTheme(m.key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs transition-colors ${
                    theme === m.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  <m.icon className="h-3.5 w-3.5" />
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-medium text-muted-foreground mb-2 uppercase tracking-wider">Cor principal · {primaryColors.length} opções</p>
            <PrimaryColorSwatches columns={8} />
          </div>
        </div>
      )}
    </div>
  );
}
