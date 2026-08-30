/**
 * CustomPrimaryColor — cor principal customizada do usuário: aceita QUALQUER
 * formato (triple HSL, hsl()/hsla(), hex, rgb()/rgba()) + color picker nativo.
 * Mostra o foreground derivado automaticamente (contraste WCAG) — o sistema
 * de cores é inteligente: texto sobre a cor principal sempre legível.
 */
import { useMemo, useState } from "react";
import { useTheme } from "@/components/ThemeProvider";
import {
  normalizeColor, parseColor, contrastForeground, hslTripleToHex, valueToCss,
  formatHsl, hslToHex,
} from "@/lib/colorUtils";
import { Slider } from "@/components/ui/slider";

export function CustomPrimaryColor() {
  const { primaryColor, setPrimaryColor } = useTheme();
  const [draft, setDraft] = useState("");
  const [touched, setTouched] = useState(false);

  const normalized = normalizeColor(draft);
  const invalid = touched && draft.trim() !== "" && !normalized;
  const previewColor = normalized ?? primaryColor;
  const previewFg = contrastForeground(previewColor);

  const apply = () => {
    if (!normalized) return;
    setPrimaryColor(normalized);
    setDraft("");
    setTouched(false);
  };

  return (
    <div className="mt-2 space-y-1.5">
      <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">
        Cor custom (hsl / hex / rgb)
      </p>
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={hslTripleToHex(previewColor)}
          onChange={(e) => setPrimaryColor(e.target.value)}
          aria-label="Escolher cor principal (seletor visual)"
          title="Seletor visual de cor"
          className="h-7 w-9 shrink-0 cursor-pointer rounded-md border border-border/60 bg-transparent p-0.5"
        />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => setTouched(true)}
          onKeyDown={(e) => e.key === "Enter" && apply()}
          placeholder="262 80% 60% · #8b5cf6 · rgb(139,92,246)"
          aria-label="Cor principal customizada (hsl, hex ou rgb)"
          aria-invalid={invalid}
          className="min-w-0 flex-1 rounded-md border border-border/60 bg-background px-2 py-1.5 text-[11px] font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 aria-[invalid=true]:border-destructive/60"
        />
        <button
          onClick={apply}
          disabled={!normalized}
          className="shrink-0 rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
        >
          Aplicar
        </button>
      </div>
      {invalid && (
        <p role="alert" className="text-[10px] text-destructive">
          Formato não reconhecido — use hsl ("262 80% 60%"), hex ("#8b5cf6") ou rgb ("rgb(139, 92, 246)").
        </p>
      )}
      {/* Preview: botão primário com foreground derivado por contraste. */}
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-medium"
          style={{ backgroundColor: valueToCss(previewColor), color: valueToCss(previewFg) }}
        >
          Botão primário
        </span>
        <span className="text-[9px] text-muted-foreground">
          Texto sobre a cor ajustado automaticamente p/ contraste (WCAG).
        </span>
      </div>
      <HslaEditor color={primaryColor} onChange={setPrimaryColor} />
    </div>
  );
}

/** Editor HSLA/RGBA por sliders — matiz, saturação, luminosidade e alpha. */
function HslaEditor({ color, onChange }: { color: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const parsed = useMemo(() => parseColor(color) ?? { h: 220, s: 90, l: 56, a: 1 }, [color]);
  const set = (patch: Partial<{ h: number; s: number; l: number; a: number }>) => {
    const next = { ...parsed, ...patch };
    onChange(formatHsl(next.h, next.s, next.l, Math.round(next.a * 100)));
  };
  const rows: Array<{ label: string; value: number; min: number; max: number; step: number; fmt: (v: number) => string; set: (v: number) => void; aria: string }> = [
    { label: "Matiz (H)", value: parsed.h, min: 0, max: 360, step: 1, fmt: (v) => `${Math.round(v)}°`, set: (v) => set({ h: v }), aria: "Matiz da cor principal" },
    { label: "Saturação (S)", value: parsed.s, min: 0, max: 100, step: 1, fmt: (v) => `${Math.round(v)}%`, set: (v) => set({ s: v }), aria: "Saturação da cor principal" },
    { label: "Luz (L)", value: parsed.l, min: 0, max: 100, step: 1, fmt: (v) => `${Math.round(v)}%`, set: (v) => set({ l: v }), aria: "Luminosidade da cor principal" },
    { label: "Opacidade (A)", value: parsed.a * 100, min: 10, max: 100, step: 1, fmt: (v) => `${Math.round(v)}%`, set: (v) => set({ a: v / 100 }), aria: "Opacidade da cor principal" },
  ];
  return (
    <div className="rounded-md border border-border/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-2 py-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground"
      >
        <span>
          Editor RGBA/HSLA — hsl({Math.round(parsed.h)}° {Math.round(parsed.s)}% {Math.round(parsed.l)}%
          {parsed.a < 1 ? ` / ${Math.round(parsed.a * 100)}%` : ""}) · {hslToHex(parsed.h, parsed.s, parsed.l)}
        </span>
        <span aria-hidden>{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="space-y-2 border-t border-border/40 px-2.5 py-2.5">
          {rows.map((r) => (
            <div key={r.label} className="space-y-1">
              <div className="flex justify-between text-[10px]">
                <span className="text-muted-foreground">{r.label}</span>
                <span className="font-mono">{r.fmt(r.value)}</span>
              </div>
              <Slider
                value={[r.value]}
                min={r.min}
                max={r.max}
                step={r.step}
                onValueChange={([v]) => r.set(v)}
                aria-label={r.aria}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
