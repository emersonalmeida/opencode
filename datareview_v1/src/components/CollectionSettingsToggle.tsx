import { Settings2 } from "lucide-react";
import { useCollectionSettings } from "./CollectionSettingsProvider";
import { useState, useRef, useEffect } from "react";

export function CollectionSettingsToggle() {
  const { settings, setSettings, searchOptions, reviewOptions, reviewSortOptions } = useCollectionSettings();
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
        title="Configurações de coleta"
      >
        <Settings2 className="h-3.5 w-3.5" />
        <span className="text-xs hidden sm:inline">Coleta</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-card border border-border rounded-xl shadow-xl p-4 space-y-4 z-50 animate-fade-in-up">
          <div>
            <p className="text-[10px] font-medium text-muted-foreground mb-2 uppercase tracking-wider">
              Resultados por loja
            </p>
            <div className="flex flex-wrap gap-1.5">
              {searchOptions.map((n) => (
                <button
                  key={n}
                  onClick={() => setSettings({ ...settings, searchLimit: n })}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                    settings.searchLimit === n
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-medium text-muted-foreground mb-2 uppercase tracking-wider">
              Max reviews por app
            </p>
            <div className="flex flex-wrap gap-1.5">
              {reviewOptions.map((n) => (
                <button
                  key={n}
                  onClick={() => setSettings({ ...settings, reviewLimit: n })}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                    settings.reviewLimit === n
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  {n >= 1000 ? `${n / 1000}k` : n}
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider shrink-0" htmlFor="review-limit-custom">
                Personalizado
              </label>
              <input
                id="review-limit-custom"
                type="number"
                min={1}
                max={10000}
                step={50}
                value={settings.reviewLimit}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  if (!Number.isNaN(n)) setSettings({ ...settings, reviewLimit: Math.max(1, Math.min(n, 10000)) });
                }}
                className="w-full text-xs px-2 py-1.5 rounded-lg bg-secondary text-secondary-foreground border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <div>
            <p className="text-[10px] font-medium text-muted-foreground mb-2 uppercase tracking-wider">
              Ordenação dos reviews
            </p>
            <div className="flex flex-wrap gap-1.5">
              {reviewSortOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSettings({ ...settings, reviewSort: opt.value })}
                  title={opt.hint}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                    settings.reviewSort === opt.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-[9px] text-muted-foreground mt-1.5 leading-relaxed">
              Google: escolhe a ordenação da coleta (NEWEST/HELPFUL/RATING). Apple: best-effort (APIs públicas não expõem sort) — a ordenação final é aplicada aos reviews armazenados.
            </p>
          </div>

          <p className="text-[9px] text-muted-foreground leading-relaxed">
            O sistema coleta o máximo possível até o limite configurado. Apple: amp-api + página SSR multi-país (até ~1.000+ para apps globais). Google Play: até 5.000. A IA recebe TODOS os reviews coletados (não amostra).
          </p>
        </div>
      )}
    </div>
  );
}
