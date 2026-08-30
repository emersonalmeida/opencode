/**
 * UniSourcePicker — seletor interativo de fontes Uni + modo de coleta.
 *
 * O componente auxiliar que o chat exibe quando o usuário quer configurar a
 * coleta passo a passo ("selecione as fontes", "configure a coleta"): marca
 * as fontes desejadas, escolhe o modo (rápida/normal/máxima) e dispara a
 * coleta multifonte — tudo renderizado direto na conversa (EmbeddedSurface).
 *
 * Também usável standalone (página Uni, modais).
 */
import { useMemo, useState } from "react";
import { Check, Globe, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PIPELINE_SOURCES, collectFromCustomSource, collectFromSource, sourceSkipReason } from "@/lib/uni/sourceRunner";
import { useCustomSources } from "@/lib/uni/customSources";
import { UNI_SOURCE_META, type UniSourceId } from "@/lib/uni/types";
import { saveCollection } from "@/lib/uni/uniStore";
import { logActivity } from "@/lib/activityStore";
import { recordGeneration } from "@/lib/sessionStore";
import { cn } from "@/lib/utils";

export interface UniSourcePickerProps {
  /** Termo inicial de pesquisa (editável). */
  initialTerm?: string;
  /** Fontes pré-selecionadas (default: todas). */
  initialSources?: UniSourceId[];
  /** Callback ao concluir a coleta (total de itens). */
  onDone?: (total: number) => void;
}

const MODES = [
  { id: "fast", label: "Rápida" },
  { id: "normal", label: "Normal" },
  { id: "max", label: "Máxima" },
] as const;

export function UniSourcePicker({ initialTerm = "", initialSources, onDone }: UniSourcePickerProps) {
  const [term, setTerm] = useState(initialTerm);
  const [selected, setSelected] = useState<Set<UniSourceId>>(
    () => new Set(initialSources ?? PIPELINE_SOURCES),
  );
  const [selectedCustom, setSelectedCustom] = useState<Set<string>>(() => new Set());
  const customDefs = useCustomSources();
  const [mode, setMode] = useState<"fast" | "normal" | "max">("normal");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<string>("");

  const runnable = useMemo(
    () => [...selected].filter((s) => !sourceSkipReason(s, term)),
    [selected, term],
  );
  const skipped = useMemo(
    () => [...selected].filter((s) => sourceSkipReason(s, term)),
    [selected, term],
  );

  const toggle = (s: UniSourceId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  };
  const toggleCustom = (id: string) => {
    setSelectedCustom((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const run = async () => {
    const q = term.trim();
    if (!q || (runnable.length === 0 && selectedCustom.size === 0) || running) return;
    setRunning(true);
    setResult("");
    logActivity("chat", "start", `Coleta multifonte configurada: ${q}`, `${runnable.length + selectedCustom.size} fontes`);
    let total = 0;
    const ok: string[] = [];
    for (let i = 0; i < runnable.length; i++) {
      const src = runnable[i];
      const label = UNI_SOURCE_META[src]?.label ?? src;
      setProgress(`${label} (${i + 1}/${runnable.length})…`);
      try {
        const out = await collectFromSource(src, q, mode);
        if (out.ok && out.items.length > 0) {
          saveCollection({ label: `${label} · ${q}`, source: src, query: q, items: out.items });
          ok.push(`${label} (${out.items.length})`);
          total += out.items.length;
        }
      } catch { /* fonte falhou — continua nas demais */ }
    }
    for (const defId of selectedCustom) {
      const def = customDefs.find((d) => d.id === defId);
      if (!def) continue;
      setProgress(`${def.label} (custom)…`);
      try {
        const out = await collectFromCustomSource(def, q, mode);
        if (out.ok && out.items.length > 0) {
          saveCollection({ label: `${def.label} · ${q}`, source: "custom", query: q, items: out.items });
          ok.push(`${def.label} (${out.items.length})`);
          total += out.items.length;
        }
      } catch { /* def falhou — continua */ }
    }
    setProgress("");
    setRunning(false);
    logActivity("chat", "done", `Coleta multifonte concluída: ${q}`, `${total} itens`);
    recordGeneration({
      type: "collect",
      title: `Multifonte configurada · ${q}`,
      appKeys: [],
      summary: `${total} itens de ${ok.length} fontes`,
      source: "chat",
    });
    setResult(
      total > 0
        ? `✓ **${total} itens** coletados de ${ok.length} fonte(s): ${ok.join(", ")}. Salvos nas coleções da página /00.`
        : "Nenhum item retornado pelas fontes selecionadas para este termo.",
    );
    onDone?.(total);
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card/60 p-3">
      <div className="flex items-center gap-2">
        <Globe className="h-4 w-4 text-primary" aria-hidden="true" />
        <p className="text-sm font-medium">Selecione as fontes e configure a coleta</p>
      </div>

      <input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Termo de pesquisa (ex.: bitcoin, autocustódia)…"
        aria-label="Termo de pesquisa"
        className="w-full rounded-md border border-border/50 bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
      />

      <div className="flex flex-wrap gap-1" role="group" aria-label="Modo de coleta">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            aria-pressed={mode === m.id}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-[11px]",
              mode === m.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border/60 text-muted-foreground hover:border-primary/40",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Toda lista selecionável tem "Todas"/"Nenhuma" (padrão do sistema). */}
      <div className="flex items-center gap-2 text-[10px]" role="group" aria-label="Seleção de fontes em massa">
        <span className="text-muted-foreground">
          {selected.size + selectedCustom.size}/{PIPELINE_SOURCES.length + customDefs.length} fontes
        </span>
        <button
          type="button"
          onClick={() => { setSelected(new Set(PIPELINE_SOURCES)); setSelectedCustom(new Set(customDefs.map((d) => d.id))); }}
          disabled={selected.size === PIPELINE_SOURCES.length && selectedCustom.size === customDefs.length}
          className="text-primary hover:underline disabled:opacity-40"
        >
          Todas
        </button>
        <button
          type="button"
          onClick={() => { setSelected(new Set()); setSelectedCustom(new Set()); }}
          disabled={selected.size === 0 && selectedCustom.size === 0}
          className="text-primary hover:underline disabled:opacity-40"
        >
          Nenhuma
        </button>
      </div>

      <div className="grid max-h-48 grid-cols-2 gap-1 overflow-y-auto pr-1" role="group" aria-label="Fontes de dados">
        {PIPELINE_SOURCES.map((s) => {
          const meta = UNI_SOURCE_META[s];
          const on = selected.has(s);
          const skipReason = sourceSkipReason(s, term);
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggle(s)}
              role="checkbox"
              aria-checked={on}
              title={skipReason ?? meta?.description ?? meta?.label ?? s}
              className={cn(
                "flex items-center gap-1.5 rounded-md border px-2 py-1 text-left text-[11px]",
                on
                  ? "border-primary/50 bg-primary/5 text-foreground"
                  : "border-border/40 text-muted-foreground hover:border-primary/30",
              )}
            >
              <span className={cn(
                "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border",
                on ? "border-primary bg-primary text-primary-foreground" : "border-border/60",
              )}>
                {on && <Check className="h-2.5 w-2.5" />}
              </span>
              <span className="truncate">{meta?.label ?? s}</span>
            </button>
          );
        })}
        {customDefs.map((d) => {
          const on = selectedCustom.has(d.id);
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => toggleCustom(d.id)}
              role="checkbox"
              aria-checked={on}
              title={`Fonte customizada (${d.urlTemplate})`}
              className={cn(
                "flex items-center gap-1.5 rounded-md border border-dashed px-2 py-1 text-left text-[11px]",
                on
                  ? "border-primary/50 bg-primary/5 text-foreground"
                  : "border-border/40 text-muted-foreground hover:border-primary/30",
              )}
            >
              <span className={cn(
                "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border",
                on ? "border-primary bg-primary text-primary-foreground" : "border-border/60",
              )}>
                {on && <Check className="h-2.5 w-2.5" />}
              </span>
              <span className="truncate">✏️ {d.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground" role="status">
        <span>{runnable.length + selectedCustom.size} fonte(s) prontas</span>
        {skipped.length > 0 && (
          <span title="Fontes puladas (ex.: Web/RSS precisam de URL)">
            · {skipped.length} pulada(s)
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={run} disabled={running || !term.trim() || (runnable.length === 0 && selectedCustom.size === 0)}>
          {running ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}
          {running ? "Coletando…" : "Rodar coleta"}
        </Button>
        {progress && <span className="text-[11px] text-muted-foreground">{progress}</span>}
      </div>

      {result && (
        <p className="rounded-md border border-border/40 bg-background/60 px-2.5 py-1.5 text-[11px] text-muted-foreground">
          {result}
        </p>
      )}
    </div>
  );
}
