import { CheckCircle2, Circle } from "lucide-react";
import { useDataset } from "@/hooks/useDataset";
import { useSelection, entryKey } from "@/context/SelectionContext";
import { EmptyState } from "@/components/shared/EmptyState";
import { Database } from "lucide-react";

/**
 * Etapa 2 — Coletar: revisão do dataset e da seleção que será analisada.
 * A seleção aqui é a seleção GLOBAL (mesma das outras páginas).
 */
export function StageCollect() {
  const { entries } = useDataset();
  const { selected, toggle, selectAll, selectNone } = useSelection();

  const keys = entries.map((e) => entryKey(e.app.store, e.app.id));
  const selectedCount = keys.filter((k) => selected.has(k)).length;
  const totalReviews = entries.reduce((s, e) => s + e.reviews.length, 0);

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={Database}
        title="Dataset vazio"
        description="Volte para Descobrir e colete pelo menos um app para continuar a jornada."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Revise o que será analisado</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {entries.length} app(s) no dataset · {totalReviews.toLocaleString("pt-BR")} reviews.
            Marque os apps que entram nas próximas etapas.
          </p>
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => selectAll(keys)} className="text-[11px] px-2 py-1 rounded-md bg-secondary hover:bg-secondary/80">Todos</button>
          <button onClick={selectNone} className="text-[11px] px-2 py-1 rounded-md bg-secondary hover:bg-secondary/80">Nenhum</button>
        </div>
      </div>

      <p className="text-xs" role="status">
        <strong>{selectedCount === 0 ? entries.length : selectedCount}</strong> app(s) no escopo
        {selectedCount === 0 ? " (seleção vazia = dataset inteiro)" : ""}.
      </p>

      <ul className="grid sm:grid-cols-2 gap-2" aria-label="Apps coletados">
        {entries.map((e) => {
          const k = entryKey(e.app.store, e.app.id);
          const on = selected.has(k);
          return (
            <li key={k}>
              <button
                role="checkbox"
                aria-checked={on}
                onClick={() => toggle(k)}
                className={`w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                  on ? "border-primary bg-primary/5" : "border-border/60 hover:bg-secondary/50"
                }`}
              >
                {e.app.icon ? (
                  <img src={e.app.icon} alt="" className="w-9 h-9 rounded-lg shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-secondary shrink-0" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{e.app.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {e.app.store === "apple" ? "App Store" : "Google Play"} · {e.reviews.length.toLocaleString("pt-BR")} reviews
                  </p>
                </div>
                {on
                  ? <CheckCircle2 className="h-4 w-4 text-primary shrink-0" aria-hidden />
                  : <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" aria-hidden />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
