import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle, ChevronDown, ChevronUp, ExternalLink, Loader2, MessageCircle, Play, RefreshCw, Save, Search, X,
} from "lucide-react";
import type { UniItem } from "@/lib/uni/types";
import { fetchOneSection, fetchOneDrill } from "@/lib/one/oneFetchers";
import { resolveDrill, type DrillTarget } from "@/lib/one/oneDrills";
import { oneSectionParams, type OneSectionDef } from "@/lib/one/oneSources";
import { saveCollection } from "@/lib/uni/uniStore";
import { toastSuccess } from "@/lib/ux";

type Level = "collapsed" | "default" | "expanded";
type Status = "idle" | "loading" | "done" | "error";

const LEVEL_LABEL: Record<Level, string> = {
  collapsed: "Recolhido",
  default: "Altura fixa",
  expanded: "Altura do conteúdo",
};

/**
 * Uma seção-fonte da One Page: ocupa 100% da área do slide, com header
 * (título + pergunta-guia + busca + nível de expansão), corpo com params +
 * resultados (seleção, ações) e estados honestos. Três níveis de altura:
 * default (fixa + rolagem interna), expanded (cresce com o conteúdo),
 * collapsed (só o título).
 */
export function OneSourceSection({
  def,
  globalQuery,
  onItems,
  registerRunner,
}: {
  def: OneSectionDef;
  /** termo global digitado no header da página (busca em todas). */
  globalQuery: string;
  onItems?: (id: string, items: UniItem[]) => void;
  /** registra o runner local p/ o botão "pesquisar em todas" da página. */
  registerRunner?: (id: string, run: (q: string) => void) => void;
}) {
  const [level, setLevel] = useState<Level>("default");
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(def.fields.map((f) => [f.key, f.default])),
  );
  const [localQuery, setLocalQuery] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [items, setItems] = useState<UniItem[]>([]);
  const [error, setError] = useState<string>();
  const [note, setNote] = useState<string>();
  const [cached, setCached] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);
  // Drill-down: item aberto + resultado do drill
  const [drill, setDrill] = useState<{ target: DrillTarget; title: string; items: UniItem[]; loading: boolean; error?: string } | null>(null);
  const drillAbort = useRef<AbortController | null>(null);

  const openDrill = useCallback(async (item: UniItem) => {
    const target = resolveDrill(def.id, item);
    if (!target) return;
    drillAbort.current?.abort();
    const ac = new AbortController();
    drillAbort.current = ac;
    setDrill({ target, title: item.title, items: [], loading: true });
    try {
      const res = await fetchOneDrill(target, (values.lang as string) || "pt", ac.signal);
      if (ac.signal.aborted) return;
      setDrill({ target, title: item.title, items: res.items, loading: false, error: res.ok ? undefined : res.error });
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      setDrill((d) => (d ? { ...d, loading: false, error: String((err as Error)?.message || err) } : d));
    }
  }, [def.id, values.lang]);

  const effectiveQuery = (globalQuery || localQuery).trim();

  const run = useCallback(async (q?: string) => {
    const term = (q ?? effectiveQuery).trim();
    const params = oneSectionParams(def, values);
    // Fontes que precisam de URL/texto usam o campo próprio, não o termo.
    if (def.caps.needsUrl && !params.url && !params.text) {
      setStatus("error");
      setError(def.id === "paste" ? "Cole o texto no campo abaixo." : "Cole a URL no campo abaixo.");
      return;
    }
    // Fontes sem termo (trending, clima…) coletam o momento — nunca exigem query.
    if (!def.caps.needsUrl && !def.caps.noQuery && !term) {
      setStatus("error");
      setError("Digite um termo para pesquisar nesta fonte.");
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setStatus("loading");
    setError(undefined);
    try {
      const res = await fetchOneSection(def, term, params, ac.signal);
      if (ac.signal.aborted) return;
      if (!res.ok) {
        setStatus("error");
        setError(res.error || "Erro desconhecido");
        return;
      }
      setItems(res.items);
      setNote(res.note);
      setCached(Boolean(res.cached));
      setStatus("done");
      setSelected(new Set());
      setDrill(null);
      onItems?.(def.id, res.items);
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      setStatus("error");
      setError(String((err as Error)?.message || err));
    }
  }, [def, values, effectiveQuery, onItems]);

  // Expõe o runner para a página (busca global em todas as fontes).
  useEffect(() => {
    registerRunner?.(def.id, (q) => void run(q));
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- registrar uma vez por def
  }, [def.id, registerRunner, run]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selItems = useMemo(() => items.filter((i) => selected.has(i.id)), [items, selected]);

  const handleSave = () => {
    const toSave = selItems.length ? selItems : items;
    if (!toSave.length) return;
    saveCollection({
      label: `One · ${def.title}`,
      source: def.uniSource ?? "custom",
      query: effectiveQuery || def.title,
      items: toSave,
      params: { oneSection: def.id, selected: selItems.length || undefined },
    });
    toastSuccess("Coleção salva na Uni", {
      description: `${toSave.length} itens de "${def.title}"${selItems.length ? ` (${selItems.length} selecionados)` : ""} — abra a /00.`,
    });
  };

  const cycleLevel = () => {
    setLevel((l) => (l === "default" ? "expanded" : l === "expanded" ? "collapsed" : "default"));
  };

  const bodyHeight =
    level === "expanded" ? "max-h-none" : level === "collapsed" ? "max-h-0 overflow-hidden" : "";

  return (
    <div className="flex h-full flex-col">
      {/* Header da seção */}
      <header className="shrink-0 border-b bg-card/60 px-4 py-3 backdrop-blur sm:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-bold tracking-tight sm:text-lg">{def.title}</h2>
            <p className="truncate text-xs text-muted-foreground sm:text-sm">{def.question}</p>
          </div>
          <div className="flex items-center gap-2">
            {!def.caps.needsUrl && !def.caps.noQuery && (
              <form
              className="flex items-center gap-1.5"
              onSubmit={(e) => { e.preventDefault(); void run(); }}
              >
                <label htmlFor={`one-q-${def.id}`} className="sr-only">Termo em {def.title}</label>
                <input
                  id={`one-q-${def.id}`}
                  type="search"
                  value={localQuery}
                  onChange={(e) => setLocalQuery(e.target.value)}
                  placeholder={globalQuery ? `“${globalQuery}” (global)` : "Termo…"}
                  className="h-9 w-40 rounded-md border bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/60 sm:w-52"
                />
                <button
                  type="submit"
                  disabled={status === "loading"}
                  aria-label={`Pesquisar em ${def.title}`}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary/60 disabled:opacity-50"
                >
                  {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Search className="h-4 w-4" aria-hidden />}
                </button>
              </form>
            )}
            <button
              type="button"
              onClick={cycleLevel}
              aria-label={`Nível de expansão: ${LEVEL_LABEL[level]}. Clique para alternar.`}
              title={`Nível: ${LEVEL_LABEL[level]}`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              {level === "collapsed" ? <ChevronDown className="h-4 w-4" aria-hidden /> : level === "expanded" ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4 rotate-180" aria-hidden />}
            </button>
          </div>
        </div>
      </header>

      {/* Corpo (rolável) */}
      <div className={`one-snap-body px-4 py-4 sm:px-6 ${bodyHeight}`}>
        {level !== "collapsed" && (
          <>
            <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground sm:text-sm">{def.description}</p>
            {(def.caps.note || note) && (
              <p role="note" className="mt-2 max-w-3xl rounded-md bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-700 dark:text-amber-400">
                {note ?? def.caps.note}
              </p>
            )}

            {/* Params da fonte */}
            {def.fields.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {def.fields.map((f) => (
                  <label key={f.key} className="block">
                    <span className="mb-1 block text-xs font-medium text-muted-foreground">{f.label}</span>
                    {f.kind === "select" ? (
                      <select
                        value={values[f.key] ?? f.default}
                        onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                        className="h-9 rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                      >
                        {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={values[f.key] ?? f.default}
                        placeholder={f.placeholder}
                        onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                        className="h-9 w-56 rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                      />
                    )}
                  </label>
                ))}
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => void run()}
                    disabled={status === "loading"}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary/60 disabled:opacity-50"
                  >
                    {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : status === "done" ? <RefreshCw className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
                    {status === "loading" ? "Coletando…" : status === "done" ? "Atualizar" : "Coletar"}
                  </button>
                </div>
              </div>
            )}

            {/* Erro */}
            {status === "error" && (
              <div role="alert" className="mt-3 flex max-w-3xl items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
                <p className="break-words text-xs text-destructive">{error}</p>
              </div>
            )}

            {/* Status / ações */}
            {status === "done" && (
              <div role="status" className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  <strong className="text-foreground">{items.length}</strong> itens
                  {cached ? " · cache do servidor" : ""}
                  {selected.size > 0 ? ` · ${selected.size} selecionados` : ""}
                </span>
                {items.length > 0 && (
                  <>
                    <button type="button" onClick={() => setSelected(new Set(items.map((i) => i.id)))} className="text-xs font-medium text-primary underline-offset-2 hover:underline">
                      Todos
                    </button>
                    <button type="button" onClick={() => setSelected(new Set())} className="text-xs font-medium text-primary underline-offset-2 hover:underline">
                      Nenhum
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary outline-none hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-primary/60"
                    >
                      <Save className="h-3 w-3" aria-hidden />
                      Salvar na Uni{selected.size > 0 ? ` (${selected.size})` : ""}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Resultados */}
            {items.length > 0 && (
              <ol className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2 2xl:grid-cols-3" aria-label={`Itens de ${def.title}`}>
                {items.map((item) => (
                  <li key={item.id}>
                    <div className={`flex h-full items-start gap-2.5 rounded-lg border bg-card p-3 transition-colors ${selected.has(item.id) ? "border-primary/60 bg-primary/5" : "hover:border-primary/30"}`}>
                      <input
                        type="checkbox"
                        checked={selected.has(item.id)}
                        onChange={() => toggle(item.id)}
                        aria-label={`Selecionar ${item.title}`}
                        className="mt-1 h-4 w-4 shrink-0 accent-primary"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug">{item.title}</p>
                        {item.text && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.text}</p>}
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          {item.author && <span>{item.author}</span>}
                          {item.score != null && <span className="tabular-nums">{item.score.toLocaleString("pt-BR")}</span>}
                          {item.date && <span>{new Date(item.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>}
                          {resolveDrill(def.id, item) && (
                            <button
                              type="button"
                              onClick={() => void openDrill(item)}
                              className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/60"
                              aria-label={`${resolveDrill(def.id, item)!.label} de ${item.title}`}
                            >
                              <MessageCircle className="h-3 w-3" aria-hidden />
                              {resolveDrill(def.id, item)!.label}
                            </button>
                          )}
                        </div>
                      </div>
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Abrir ${item.title} em nova aba`}
                          className="shrink-0 rounded p-1 text-muted-foreground outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/60"
                        >
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}

            {status === "done" && items.length === 0 && (
              <p role="status" className="mt-3 max-w-3xl rounded-md bg-secondary/60 p-3 text-xs text-muted-foreground">
                A fonte respondeu, mas sem itens para estes parâmetros. Ajuste o termo/campos e tente novamente.
              </p>
            )}

            {/* Drill-down do item selecionado */}
            {drill && (
              <div role="dialog" aria-label={`${drill.target.label} de ${drill.title}`} className="mt-4 rounded-xl border bg-card">
                <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-primary">{drill.target.label}</p>
                    <p className="truncate text-sm font-medium">{drill.title}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDrill(null)}
                    aria-label="Fechar detalhes"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary/60"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto p-3">
                  {drill.loading && (
                    <p role="status" className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Carregando…
                    </p>
                  )}
                  {drill.error && (
                    <p role="alert" className="flex items-start gap-2 p-3 text-xs text-destructive">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {drill.error}
                    </p>
                  )}
                  {!drill.loading && !drill.error && (
                    <ol className="space-y-2" aria-label={drill.target.label}>
                      {drill.items.map((c) => (
                        <li key={c.id} className="rounded-md bg-secondary/50 p-2.5">
                          <p className="text-sm leading-snug">{c.text ?? c.title}</p>
                          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                            {c.author && <span>{c.author}</span>}
                            {c.score != null && <span className="tabular-nums">{c.score.toLocaleString("pt-BR")}</span>}
                            {c.date && <span>{new Date(c.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>}
                          </div>
                        </li>
                      ))}
                      {drill.items.length === 0 && (
                        <p role="status" className="p-3 text-xs text-muted-foreground">Nenhum item retornado pelo drill.</p>
                      )}
                    </ol>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
