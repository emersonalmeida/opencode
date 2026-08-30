/**
 * AppSearchPanels — painéis SEPARADOS do fluxo de busca/coleta de apps.
 *
 * O QuickCollect original era tudo-em-um (campo + resultados + seleção).
 * Aqui cada parte vira um componente independente que compartilha estado via
 * `searchStore` — assim no construtor `/layouts` (e em qualquer página) o
 * campo de busca, os resultados e a seleção podem ficar em blocos/colunas
 * distintos:
 *
 *   SearchFieldPanel   → só o campo de busca (+ botão)
 *   SearchResultsPanel → resultados da última busca com coleta 1-clique
 *   AppSelectionPanel  → apps coletados com seleção global (chips)
 *
 * Nenhum painel faz rede no render: só ao submeter a busca ou coletar.
 */
import { useState } from "react";
import {
  Search, Loader2, Download, Star, CheckCircle2, AlertCircle, Package, X,
} from "lucide-react";
import type { AppInfo } from "@/lib/appStoreApi";
import { collectAndSelect } from "@/lib/collectAndSelect";
import { useDataset } from "@/hooks/useDataset";
import { useSelection, entryKey } from "@/context/SelectionContext";
import {
  runSearch, clearSearch, useSearchState,
} from "@/lib/searchStore";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------- campo de busca --- */

export interface SearchFieldPanelProps {
  placeholder?: string;
  className?: string;
  /** Chamado após uma busca completar (ex.: para destacar o bloco de resultados). */
  onSearched?: () => void;
}

/** Apenas o campo de busca + botão. Escreve no searchStore compartilhado. */
export function SearchFieldPanel({ placeholder, className, onSearched }: SearchFieldPanelProps) {
  const { searching, term: searchedTerm } = useSearchState();
  const [term, setTerm] = useState("");

  const submit = async () => {
    await runSearch(term);
    onSearched?.();
  };

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); void submit(); }}
      role="search"
      aria-label="Buscar apps nas lojas"
      className={cn("flex gap-2", className)}
    >
      <input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder={placeholder ?? "Ex.: nubank, spotify, whatsapp…"}
        aria-label="Buscar app nas lojas"
        type="search"
        className="flex-1 min-w-0 text-sm px-3 py-2 rounded-lg bg-secondary border border-border/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      {term && !searching && (
        <button
          type="button"
          onClick={() => { setTerm(""); if (searchedTerm) clearSearch(); }}
          aria-label="Limpar busca"
          title="Limpar busca e resultados"
          className="inline-flex items-center px-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary shrink-0"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      )}
      <button
        type="submit"
        disabled={searching || !term.trim()}
        className="inline-flex items-center gap-1.5 text-sm px-3.5 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 shrink-0"
      >
        {searching ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Search className="h-4 w-4" aria-hidden />}
        Buscar
      </button>
    </form>
  );
}

/* ------------------------------------------------------------ resultados --- */

function ResultRow({ app }: { app: AppInfo }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);

  const collect = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const ok = await collectAndSelect(app);
      if (ok) setDone(true);
      else setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="flex items-center gap-2.5 px-3 py-2">
      {app.icon
        ? <img src={app.icon} alt="" className="h-7 w-7 rounded-md shrink-0" loading="lazy" />
        : <Package className="h-5 w-5 text-muted-foreground shrink-0" aria-hidden />}
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium text-foreground truncate">{app.name}</p>
        <p className="text-[10px] text-muted-foreground truncate">
          {app.store === "apple" ? "Apple" : "Google"}
          {app.rating != null && (
            <span className="inline-flex items-center gap-0.5 ml-1.5">
              · <Star className="h-2.5 w-2.5 inline" aria-hidden /> {app.rating.toFixed(1)}
            </span>
          )}
        </p>
      </div>
      <button
        onClick={() => void collect()}
        disabled={busy || done}
        aria-label={done ? `${app.name} coletado` : `Coletar ${app.name}`}
        title={failed ? "Falhou — clique para tentar de novo" : undefined}
        className={cn(
          "inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-md shrink-0 transition-colors",
          done
            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 cursor-default"
            : failed
              ? "bg-destructive/15 text-destructive hover:bg-destructive/25"
              : "bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-60",
        )}
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          : done ? <CheckCircle2 className="h-3 w-3" aria-hidden />
          : failed ? <AlertCircle className="h-3 w-3" aria-hidden />
          : <Download className="h-3 w-3" aria-hidden />}
        {busy ? "Coletando…" : done ? "Coletado" : failed ? "Tentar de novo" : "Coletar"}
      </button>
    </li>
  );
}

/** Resultados da última busca (lê o searchStore). Fecha/limpa via `clearSearch`. */
export function SearchResultsPanel({ className }: { className?: string }) {
  const { results, searching, error, term, searchedAt } = useSearchState();

  if (error) {
    return (
      <p role="alert" className={cn("flex items-center gap-1.5 text-[11px] text-destructive", className)}>
        <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden /> {error}
      </p>
    );
  }
  if (searching) {
    return (
      <p role="status" className={cn("flex items-center gap-1.5 text-[11px] text-muted-foreground", className)}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Buscando na Apple App Store e no Google Play…
      </p>
    );
  }
  if (!results || searchedAt === 0) {
    return (
      <p className={cn("text-[11px] text-muted-foreground", className)}>
        Os resultados da busca aparecem aqui — use o campo de busca.
      </p>
    );
  }
  if (results.length === 0) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <p role="status" className="flex-1 text-[11px] text-muted-foreground">
          Nenhum app encontrado nas duas lojas para “{term}”.
        </p>
        <button
          onClick={clearSearch}
          className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 shrink-0"
        >
          Limpar
        </button>
      </div>
    );
  }
  return (
    <div className={cn("flex flex-col min-h-0", className)}>
      <div className="flex items-center gap-2 mb-1 shrink-0">
        <p role="status" className="flex-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          Resultados · {results.length} · “{term}”
        </p>
        <button
          onClick={clearSearch}
          aria-label="Fechar resultados"
          title="Fechar resultados"
          className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-secondary"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
      <ul role="listbox" aria-label="Resultados da busca" className="divide-y divide-border/50 rounded-lg border border-border/50 bg-card overflow-y-auto min-h-0">
        {results.map((app) => (
          <ResultRow key={entryKey(app.store, app.id)} app={app} />
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------- seleção --- */

/** Apps coletados no dataset com toggles de seleção global (chips). */
export function AppSelectionPanel({ className }: { className?: string }) {
  const { entries } = useDataset();
  const { selected, toggle, selectAll, selectNone } = useSelection();
  const allKeys = entries.map((e) => entryKey(e.app.store, e.app.id));

  if (entries.length === 0) {
    return (
      <p className={cn("text-[11px] text-muted-foreground", className)}>
        Nenhum app coletado ainda — os apps coletados aparecem aqui para seleção.
      </p>
    );
  }
  return (
    <div className={cn("rounded-lg border border-border/50 bg-card p-2.5", className)} role="group" aria-label="Apps coletados no dataset">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Dataset — {entries.length} app(s) · {selected.size} selecionado(s)
        </p>
        <div className="flex gap-1.5">
          <button onClick={() => selectAll(allKeys)} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80">
            Todos
          </button>
          <button onClick={selectNone} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80">
            Nenhum
          </button>
        </div>
      </div>
      <ul className="flex flex-wrap gap-1.5" role="group" aria-label="Seleção de apps">
        {entries.map((e) => {
          const key = entryKey(e.app.store, e.app.id);
          const on = selected.has(key);
          return (
            <li key={key}>
              <button
                role="checkbox"
                aria-checked={on}
                onClick={() => toggle(key)}
                className={cn(
                  "text-[11px] px-2 py-1 rounded-md border transition-colors",
                  on
                    ? "bg-primary/10 border-primary/40 text-foreground"
                    : "bg-secondary/60 border-border/50 text-muted-foreground hover:text-foreground",
                )}
                title={`${e.app.store === "apple" ? "Apple" : "Google"} · ${e.reviews.length} reviews`}
              >
                {e.app.name}
                <span className="ml-1 text-[9px] opacity-70">{e.reviews.length}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
