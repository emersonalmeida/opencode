/**
 * Seção 02 — Selecionar: escolha do universo de análise (seleção global
 * compartilhada com todo o sistema). Seleção vazia = todos os apps.
 */
import { Link } from "react-router-dom";
import { CheckSquare, GitCompare, Database } from "lucide-react";
import { useFlowScope } from "@/components/flow/useFlowScope";
import { useSelection, entryKey } from "@/context/SelectionContext";
import { EmptyState } from "@/components/shared/EmptyState";
import { Panel } from "@/components/Panel";
import { ComparisonView, type ComparisonColumn } from "@/components/shared/ComparisonView";
import { cn } from "@/lib/utils";

export function SectionSelect() {
  const { entries, selected } = useFlowScope();
  const { toggle, selectAll, selectNone } = useSelection();

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={Database}
        title="Nenhum app coletado"
        description="Descubra e colete apps na etapa 01 para montar o universo de análise."
      />
    );
  }

  const allKeys = entries.map((e) => entryKey(e.app.store, e.app.id));

  /** Comparativo inline: os apps selecionados viram colunas completas
   *  (mesma ComparisonView da página /compare) — sem sair do Fluxo. */
  const compareEntries =
    selected.size >= 2
      ? entries.filter((e) => selected.has(entryKey(e.app.store, e.app.id)))
      : [];
  const compareColumns: ComparisonColumn[] = compareEntries.map((e) => ({
    key: entryKey(e.app.store, e.app.id),
    store: e.app.store,
    id: e.app.id,
    app: e.app,
    reviews: e.reviews,
    loading: false,
  }));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-muted-foreground" role="status">
          {selected.size === 0
            ? `Escopo: todos os ${entries.length} app(s)`
            : `Escopo: ${selected.size} de ${entries.length} app(s)`}
        </p>
        <span className="flex-1" />
        <button
          onClick={() => selectAll(allKeys)}
          className="rounded-md border border-border/60 px-2 py-1 text-[11px] hover:bg-secondary"
        >
          Selecionar todos
        </button>
        <button
          onClick={selectNone}
          className="rounded-md border border-border/60 px-2 py-1 text-[11px] hover:bg-secondary"
        >
          Limpar seleção
        </button>
        {selected.size >= 2 && (
          <Link
            to={`/compare?apps=${Array.from(selected).join(",")}`}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground hover:opacity-90"
          >
            <GitCompare className="h-3 w-3" aria-hidden />
            Comparar selecionados
          </Link>
        )}
      </div>

      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label="Apps coletados">
        {entries.map((e) => {
          const k = entryKey(e.app.store, e.app.id);
          const on = selected.has(k);
          return (
            <li key={k}>
              <button
                role="checkbox"
                aria-checked={on}
                onClick={() => toggle(k)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg border p-2.5 text-left transition-colors",
                  on ? "border-primary/50 bg-primary/5" : "border-border/60 bg-background/60 hover:border-primary/30",
                )}
              >
                {e.app.icon ? (
                  <img src={e.app.icon} alt="" className="h-9 w-9 shrink-0 rounded-lg" />
                ) : (
                  <div className="h-9 w-9 shrink-0 rounded-lg bg-secondary" aria-hidden />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium">{e.app.name}</span>
                  <span className="block text-[10px] text-muted-foreground">
                    {e.app.store === "apple" ? "App Store" : "Google Play"} · ★{e.app.rating.toFixed(1)} ·{" "}
                    {e.reviews.length.toLocaleString("pt-BR")} reviews
                  </span>
                </span>
                <CheckSquare
                  className={cn("h-4 w-4 shrink-0", on ? "text-primary" : "text-muted-foreground/30")}
                  aria-hidden
                />
              </button>
            </li>
          );
        })}
      </ul>

      {compareColumns.length >= 2 && (
        <Panel
          title="Comparativo lado a lado"
          subtitle="Resumo comparativo + dossiê completo de cada app selecionado + IA comparativa — o mesmo da página /compare, aqui dentro."
          icon={<GitCompare className="h-4 w-4 text-primary" />}
          defaultOpen={false}
          storageKey="aso:flow-compare"
        >
          <ComparisonView columns={compareColumns} />
          <Link to={`/compare?apps=${Array.from(selected).join(",")}`} className="mt-2 inline-block text-[11px] text-primary hover:underline">
            Abrir página dedicada ↗
          </Link>
        </Panel>
      )}
    </div>
  );
}
