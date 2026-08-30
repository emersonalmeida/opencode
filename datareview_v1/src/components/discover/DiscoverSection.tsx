import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, ChevronDown, Loader2, Play, RefreshCw } from "lucide-react";
import { fetchDiscover, type DiscoverItem } from "@/lib/discover/discoverApi";
import { sectionParams, type DiscoverSectionDef } from "@/lib/discover/discoverSections";
import { DiscoverItemCard } from "./DiscoverItemCard";

type SectionStatus = "idle" | "loading" | "done" | "error";

/**
 * Seção de uma fonte da Descoberta: cabeçalho expansível + parâmetros +
 * coleta sob demanda + lista de itens. Cada seção é independente (coleta,
 * erro e cache próprios) — uma fonte lenta não bloqueia as outras.
 */
export function DiscoverSection({
  def,
  autoRun,
  onItems,
}: {
  def: DiscoverSectionDef;
  /** coleta automaticamente ao montar (seções sem parâmetro obrigatório). */
  autoRun?: boolean;
  onItems?: (source: string, items: DiscoverItem[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(def.fields.map((f) => [f.key, f.default])),
  );
  const [status, setStatus] = useState<SectionStatus>("idle");
  const [items, setItems] = useState<DiscoverItem[]>([]);
  const [note, setNote] = useState<string>();
  const [cached, setCached] = useState(false);
  const [error, setError] = useState<string>();
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setStatus("loading");
    setError(undefined);
    try {
      const res = await fetchDiscover(def.id, sectionParams(def, values), ac.signal);
      if (ac.signal.aborted) return;
      if (!res.ok) {
        setStatus("error");
        setError(res.error || "Erro desconhecido");
        return;
      }
      setItems(res.items);
      setNote(res.note);
      setCached(res.cached);
      setStatus("done");
      onItems?.(def.id, res.items);
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      setStatus("error");
      setError(String((err as Error)?.message || err));
    }
  }, [def, values, onItems]);

  // Auto-coleta ao montar (uma vez). Seções com parâmetro obrigatório
  // esperam o usuário preencher (autoRun=false).
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRun && !autoRan.current) {
      autoRan.current = true;
      void run();
    }
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- autoRun é intencionalmente só no mount
  }, []);

  const Icon = def.icon;
  return (
    <section
      id={`discover-${def.id}`}
      aria-labelledby={`discover-${def.id}-title`}
      className="scroll-mt-24 rounded-xl border bg-card"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={`discover-${def.id}-body`}
        className="flex w-full items-center gap-3 rounded-t-xl p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span id={`discover-${def.id}-title`} className="block truncate text-sm font-semibold">
            {def.title}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {status === "done"
              ? `${items.length} itens${cached ? " · cache do servidor" : ""}`
              : status === "loading"
                ? "Coletando…"
                : status === "error"
                  ? "Erro na coleta"
                  : "Pronta para coletar"}
          </span>
        </span>
        {status === "loading" && <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />}
        <ChevronDown
          aria-hidden
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div id={`discover-${def.id}-body`} className="border-t p-4">
          <p className="text-xs leading-relaxed text-muted-foreground">{def.description}</p>
          {note && (
            <p role="note" className="mt-2 rounded-md bg-amber-500/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-400">
              {note}
            </p>
          )}

          {def.fields.length > 0 && (
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {def.fields.map((f) => (
                <label key={f.key} className="block">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">{f.label}</span>
                  {f.kind === "select" ? (
                    <select
                      value={values[f.key] ?? f.default}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      className="h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                    >
                      {f.options?.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={f.kind === "date" ? "date" : f.kind === "number" ? "number" : "text"}
                      value={values[f.key] ?? f.default}
                      placeholder={f.placeholder}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      className="h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                    />
                  )}
                </label>
              ))}
            </div>
          )}

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void run()}
              disabled={status === "loading"}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary/60 disabled:opacity-50"
            >
              {status === "loading" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : status === "done" ? (
                <RefreshCw className="h-4 w-4" aria-hidden />
              ) : (
                <Play className="h-4 w-4" aria-hidden />
              )}
              {status === "loading" ? "Coletando…" : status === "done" ? "Atualizar" : "Coletar"}
            </button>
            {status === "done" && (
              <span role="status" className="text-xs text-muted-foreground">
                {items.length} itens coletados{cached ? " · cache" : ""}
              </span>
            )}
          </div>

          {status === "error" && (
            <div role="alert" className="mt-3 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-destructive">Não foi possível coletar desta fonte</p>
                <p className="mt-0.5 break-words text-xs text-destructive/90">{error}</p>
              </div>
            </div>
          )}

          {status === "done" && items.length === 0 && (
            <p role="status" className="mt-3 rounded-md bg-secondary/60 p-3 text-xs text-muted-foreground">
              A fonte respondeu, mas sem itens para estes parâmetros. Ajuste os campos e tente novamente.
            </p>
          )}

          {items.length > 0 && (
            <ol className="mt-3 space-y-2" aria-label={`Itens de ${def.title}`}>
              {items.map((item, i) => (
                <li key={item.id}>
                  <DiscoverItemCard item={item} rank={i + 1} />
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}
