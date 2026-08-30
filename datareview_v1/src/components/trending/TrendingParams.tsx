/**
 * Painel de parâmetros do extrator Trending: região × modo (rápida/24h ou
 * matriz de janelas) × janelas — orçamento real ANTES de rodar e erro
 * acionável. Fonte única de chips: TRENDING_REGIONS/TRENDING_HOURS do core.
 */
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Play, Square, AlertTriangle, RefreshCw, ExternalLink } from "lucide-react";
import {
  TRENDING_REGIONS,
  TRENDING_HOURS,
  trendingPageUrl,
} from "../../../server/lib/trendingCore";
import { cn } from "@/lib/utils";

export type TrendingMode = "quick" | "gather";

export interface TrendingParamsValue {
  geo: string;
  /** "quick" coleta só hours; "gather" une hoursList com dedup. */
  mode: TrendingMode;
  hours: number;
  hoursList: number[];
}

export const DEFAULT_TRENDING_PARAMS: TrendingParamsValue = {
  geo: "br",
  mode: "quick",
  hours: 24,
  hoursList: TRENDING_HOURS.map((h) => h.id),
};

export function computeBudget(value: TrendingParamsValue): number {
  return value.mode === "quick" ? 1 : value.hoursList.length;
}

/** Combos precisam estar dentro do teto do servidor (4 janelas máx.). */
export function budgetError(value: TrendingParamsValue): string {
  if (value.mode === "gather" && !value.hoursList.length) {
    return "Selecione ao menos uma janela de tempo.";
  }
  return "";
}

interface TrendingParamsProps {
  value: TrendingParamsValue;
  onChange: (next: Partial<TrendingParamsValue>) => void;
  running: boolean;
  onRun: () => void;
  onStop: () => void;
}

export function TrendingParams({ value, onChange, running, onRun, onStop }: TrendingParamsProps) {
  const fieldsetId = useId();
  const budget = computeBudget(value);
  const err = budgetError(value);
  const toggleHour = (h: number) => {
    const list = value.hoursList.includes(h)
      ? value.hoursList.filter((x) => x !== h)
      : [...value.hoursList, h];
    onChange({ hoursList: list });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor={`${fieldsetId}-geo`} className="text-xs text-muted-foreground">
          Região
        </Label>
        <Input
          id={`${fieldsetId}-geo`}
          value={value.geo.toUpperCase()}
          onChange={(e) => onChange({ geo: e.target.value.toLowerCase().replace(/[^a-z]/g, "").slice(0, 2) })}
          className="h-8 w-20 text-xs uppercase"
          maxLength={2}
          aria-describedby={`${fieldsetId}-geo-hint`}
        />
        <span id={`${fieldsetId}-geo-hint`} className="sr-only">
          Código do país com 2 letras (ex.: BR, US, PT)
        </span>
        <div role="group" aria-label="Preset de região" className="flex flex-wrap gap-1">
          {TRENDING_REGIONS.slice(0, 8).map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onChange({ geo: r.id })}
              aria-pressed={value.geo === r.id}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                value.geo === r.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        <a
          href={trendingPageUrl(value.geo || "br")}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          Página original no Google <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Modo de coleta">
        <span className="text-xs text-muted-foreground">Modo</span>
        {(
          [
            { id: "quick", label: "Rápida (1 janela)" },
            { id: "gather", label: "Completa (todas as janelas)" },
          ] as const
        ).map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange({ mode: m.id })}
            aria-pressed={value.mode === m.id}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs transition-colors",
              value.mode === m.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {value.mode === "quick" ? (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Janela de tempo">
          <span className="text-xs text-muted-foreground">Janela</span>
          {TRENDING_HOURS.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => onChange({ hours: h.id })}
              aria-pressed={value.hours === h.id}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs transition-colors",
                value.hours === h.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {h.short}
            </button>
          ))}
          <span className="text-xs text-muted-foreground">4h ≈ 25 trends · 24h ≈ 230 · 48h ≈ 630 · 7d ≈ 1.800</span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Janelas da matriz">
          <span className="text-xs text-muted-foreground">Janelas</span>
          {TRENDING_HOURS.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => toggleHour(h.id)}
              aria-pressed={value.hoursList.includes(h.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs transition-colors",
                value.hoursList.includes(h.id)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {h.short}
            </button>
          ))}
        </div>
      )}

      {err && (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> {err}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {running ? (
          <Button variant="destructive" size="sm" onClick={onStop} aria-label="Parar coleta">
            <Square className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Parar
          </Button>
        ) : (
          <Button size="sm" onClick={onRun} disabled={!!err} aria-label="Coletar trends">
            <Play className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Coletar
          </Button>
        )}
        <span role="status" className="text-xs text-muted-foreground">
          {budget} {budget === 1 ? "janela" : "janelas"} a coletar
        </span>
        {running && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            <RefreshCw className="sr-only" /> Coletando…
          </span>
        )}
      </div>
    </div>
  );
}
