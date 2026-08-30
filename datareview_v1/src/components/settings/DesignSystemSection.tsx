/**
 * DesignSystemSection — editor visual COMPLETO do design system global:
 * todos os tokens de cor do sistema (agrupados), por modo (claro/escuro),
 * com color picker nativo + input HSL, presets coesos (aplicáveis ao modo
 * ativo ou aos dois) e preview ao vivo. Overrides aplicados imediatamente
 * no :root via `designTokens.ts` — refletem no app inteiro sem reload.
 */
import { useState } from "react";
import { RotateCcw, SwatchBook, MonitorCog } from "lucide-react";
import {
  TOKEN_CATALOG, TOKEN_GROUP_META, TOKEN_GROUP_ORDER, tokensByGroup,
  TOKEN_PRESETS, countTokenOverrides,
  isValidTokenValue, setDesignToken, clearDesignToken,
  applyTokenPreset, applyTokenPresetBothModes, resetDesignTokens, useDesignTokens,
  effectiveTokenValue,
} from "@/lib/designTokens";
import { useUISettings, setUISettings } from "@/lib/uiSettings";
import { hslTripleToHex, hexToHslTriple, parseHsla, parseAlpha, withAlpha, valueToCss } from "@/lib/colorUtils";

const ALPHA_PRESETS = [100, 75, 50, 30, 15, 0];

/** Fundo xadrez para evidenciar transparência no swatch. */
const CHECKERBOARD = "conic-gradient(hsl(var(--border)) 25%, transparent 0 50%, hsl(var(--border)) 0 75%, transparent 0) 0 0 / 12px 12px";

function AlphaEditor({ mode, cssVar, value, disabled }: { mode: "light" | "dark"; cssVar: string; value: string; disabled: boolean }) {
  const alpha = parseAlpha(value);
  const apply = (a: number) => {
    const next = withAlpha(value, a);
    if (next) setDesignToken(mode, cssVar, next);
  };
  return (
    <div className="flex items-center gap-2 px-3 pb-2 pl-11 -mt-0.5" aria-label="Transparência">
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground shrink-0">Transparência</span>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={alpha}
        disabled={disabled}
        onChange={(e) => apply(Number(e.target.value))}
        aria-label="Transparência (alpha)"
        className="flex-1 min-w-0"
      />
      <span className="text-[9px] font-mono text-muted-foreground w-8 text-right tabular-nums">{alpha}%</span>
      <div className="flex gap-0.5" role="group" aria-label="Predefinições de transparência">
        {ALPHA_PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => apply(p)}
            disabled={disabled}
            aria-pressed={alpha === p}
            title={`${p}% de opacidade`}
            className={`px-1 py-0.5 rounded text-[8px] tabular-nums transition-colors disabled:opacity-40 ${alpha === p ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}
          >
            {p}%
          </button>
        ))}
      </div>
    </div>
  );
}

function TokenRow({ mode, cssVar }: { mode: "light" | "dark"; cssVar: string }) {
  useDesignTokens(); // re-render reativo a qualquer mudança de token
  const spec = TOKEN_CATALOG.find((t) => t.cssVar === cssVar);
  if (!spec) return null;
  const value = effectiveTokenValue(mode, cssVar);
  const isOverride = value !== spec[mode];
  const isColor = spec.kind === "color";
  const invalid = isColor && !parseHsla(value);
  const alpha = isColor ? parseAlpha(value) : 100;

  return (
    <div className="rounded-lg border border-border/40 bg-background">
    <div className="flex items-center gap-2.5 px-3 pt-1.5 pb-1">
      {/* Swatch + color picker nativo (checkerboard evidencia transparência) */}
      <label
        className="relative w-6 h-6 rounded-md border border-border/60 shrink-0 cursor-pointer overflow-hidden"
        style={isColor ? { background: CHECKERBOARD } : { background: "hsl(var(--muted))" }}
        title={`Escolher cor de ${spec.label}`}
      >
        {isColor && (
          <>
            <span
              className="absolute inset-0"
              style={{ background: valueToCss(value) }}
              aria-hidden="true"
            />
            <input
              type="color"
              value={hslTripleToHex(value)}
              onChange={(e) => {
                const triple = hexToHslTriple(e.target.value);
                if (triple) setDesignToken(mode, cssVar, withAlpha(triple, alpha) ?? triple);
              }}
              aria-label={`Seletor de cor de ${spec.label}`}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
          </>
        )}
      </label>
      <div className="w-28 shrink-0 min-w-0">
        <p className="text-[11px] font-medium text-foreground truncate">{spec.label}</p>
        <p className="text-[9px] text-muted-foreground truncate">{spec.description}</p>
      </div>
      <input
        value={value}
        onChange={(e) => setDesignToken(mode, cssVar, e.target.value)}
        aria-label={`${spec.label} (${mode === "light" ? "claro" : "escuro"})`}
        spellCheck={false}
        className={`flex-1 min-w-0 font-mono text-[11px] px-2 py-1 rounded-md border bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 ${
          invalid ? "border-destructive/60" : isOverride ? "border-primary/50" : "border-border/50"
        }`}
      />
      <span className="text-[9px] font-mono text-muted-foreground/70 w-14 hidden lg:inline truncate" aria-hidden="true">
        {spec.kind === "color" ? hslTripleToHex(value, "—") : ""}
      </span>
      {isOverride ? (
        <button
          onClick={() => clearDesignToken(mode, cssVar)}
          title="Voltar ao padrão"
          aria-label={`Redefinir ${spec.label}`}
          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary"
        >
          <RotateCcw className="h-3 w-3" />
        </button>
      ) : (
        <span className="w-5" aria-hidden="true" />
      )}
    </div>
    {isColor && <AlphaEditor mode={mode} cssVar={cssVar} value={value} disabled={invalid} />}
    </div>
  );
}

export function DesignSystemSection() {
  const tokens = useDesignTokens();
  const ui = useUISettings();
  const [mode, setMode] = useState<"light" | "dark">("light");
  const total = countTokenOverrides();

  return (
    <div className="px-4 pb-4 space-y-4">
      {/* Modo editado + status */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1" role="group" aria-label="Modo editado">
          {(["light", "dark"] as const).map((m) => (
            <button
              key={m}
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={`px-2.5 py-1 rounded-md text-[11px] transition-colors ${
                mode === m ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {m === "light" ? "Claro" : "Escuro"}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[10px] text-muted-foreground" role="status">
          {total > 0 ? `${total} token(s) customizado(s)` : "Tema padrão"}
        </span>
        {total > 0 && (
          <button
            onClick={() => { if (confirm("Redefinir TODOS os tokens de design para o padrão?")) resetDesignTokens(); }}
            className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80"
          >
            <RotateCcw className="h-3 w-3" /> Redefinir tudo
          </button>
        )}
      </div>

      {/* Presets */}
      <div>
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Presets</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {TOKEN_PRESETS.map((p) => (
            <div
              key={p.id}
              className="group flex flex-col items-start gap-1.5 px-3 py-2.5 rounded-lg border border-border/50 bg-background hover:border-primary/50 transition-colors"
            >
              <button
                onClick={() => applyTokenPreset(p.id, mode)}
                title={`${p.description} (aplica ao modo ${mode === "light" ? "claro" : "escuro"})`}
                className="flex flex-col items-start gap-1.5 text-left w-full"
              >
                <span
                  className="w-6 h-6 rounded-full border border-border/60 shadow-sm"
                  style={{ background: valueToCss(p.tokens.primary ?? "0 0% 50%") }}
                  aria-hidden="true"
                />
                <span className="text-[11px] font-medium text-foreground group-hover:text-primary transition-colors">{p.label}</span>
                <span className="text-[9px] text-muted-foreground leading-snug">{p.description}</span>
              </button>
              <button
                onClick={() => applyTokenPresetBothModes(p.id)}
                className="text-[9px] text-primary hover:underline"
                title="Aplica o preset aos modos claro E escuro"
              >
                Aplicar aos dois modos
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Tokens agrupados */}
      {TOKEN_GROUP_ORDER.map((groupId) => {
        const group = TOKEN_GROUP_META[groupId];
        const specs = tokensByGroup(groupId);
        const overridden = specs.filter((s) => (tokens[mode][s.cssVar] ?? "") !== "").length;
        return (
          <div key={groupId}>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              {group.label}
              <span className="normal-case font-normal"> — {group.description}</span>
              {overridden > 0 && (
                <span className="ml-1.5 normal-case font-normal text-primary">({overridden} customizado{overridden > 1 ? "s" : ""})</span>
              )}
            </p>
            <div className="space-y-1.5">
              {specs.map((s) => <TokenRow key={s.cssVar} mode={mode} cssVar={s.cssVar} />)}
            </div>
          </div>
        );
      })}

      {/* Preview ao vivo */}
      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <MonitorCog className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Preview ao vivo (modo atual da interface)</p>
        </div>
        <div className="rounded-lg border border-border/50 bg-background p-3 flex flex-wrap items-center gap-2">
          <button className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-[11px] font-medium">Primário</button>
          <button className="px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground text-[11px] font-medium">Secundário</button>
          <button className="px-3 py-1.5 rounded-md bg-destructive text-destructive-foreground text-[11px] font-medium">Destrutivo</button>
          <span className="px-2 py-0.5 rounded-full bg-accent text-accent-foreground text-[10px]">Accent</span>
          <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px]">Muted</span>
          <span className="text-[11px] text-foreground">Texto</span>
          <span className="text-[11px] text-muted-foreground">Secundário</span>
          <span className="text-[11px] text-primary">Link</span>
          <span className="flex gap-1 ml-auto" aria-label="Paleta de gráficos">
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n} className="w-4 h-4 rounded-sm border border-border/40" style={{ background: `hsl(var(--chart-${n}))` }} title={`chart-${n}`} />
            ))}
          </span>
        </div>
      </div>

      {/* Raio + tipografia + espaçamento (delegados ao uiSettings, já aplicados globalmente) */}
      <div className="rounded-lg border border-border/40 bg-background p-3 space-y-3">
        <div className="flex items-center gap-1.5">
          <SwatchBook className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Raio · tipografia · espaçamento</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] text-muted-foreground">Raio de borda</p>
              <span className="text-[10px] font-mono">{ui.radiusScale}%</span>
            </div>
            <input type="range" min={0} max={250} value={ui.radiusScale}
              onChange={(e) => setUISettings({ radiusScale: Number(e.target.value) })}
              aria-label="Raio de borda (escala)" className="w-full" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] text-muted-foreground">Tamanho da fonte</p>
              <span className="text-[10px] font-mono">{ui.fontScale}%</span>
            </div>
            <input type="range" min={80} max={130} value={ui.fontScale}
              onChange={(e) => setUISettings({ fontScale: Number(e.target.value) })}
              aria-label="Escala da fonte" className="w-full" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground mr-1">Espaçamento:</span>
          {(["compact", "normal", "spacious"] as const).map((d) => (
            <button
              key={d}
              aria-pressed={ui.density === d}
              onClick={() => setUISettings({ density: d })}
              className={`px-2 py-1 rounded-md text-[10px] transition-colors ${
                ui.density === d ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {d === "compact" ? "Compacto" : d === "normal" ? "Normal" : "Espaçoso"}
            </button>
          ))}
        </div>
        <p className="text-[9px] text-muted-foreground leading-snug">
          Estes três controles vivem também em Aparência → Interface avançada; são os mesmos tokens globais.
        </p>
      </div>
    </div>
  );
}
