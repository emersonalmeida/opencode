import { useMemo } from "react";
import { Link2 } from "lucide-react";
import type { DatasetEntry } from "@/lib/datasetStore";
import { crossStoreGroups, type LinkedGroup } from "@/lib/linkedStores";
import { useCompare } from "@/context/CompareContext";

/**
 * Card no Dashboard que lista apps detectados em mais de uma loja
 * (Apple ↔ Google). Botão abre o comparador com as entries pré-selecionadas.
 */
export function LinkedStoresCard({ entries }: { entries: DatasetEntry[] }) {
  const groups = useMemo(() => crossStoreGroups(entries, 0.4), [entries]);
  const { setPickerOpen } = useCompare();
  if (!groups.length) return null;
  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden" data-testid="linked-stores-card">
      <div className="flex items-center gap-2 p-4 border-b border-border/40">
        <Link2 className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Lojas vinculadas do mesmo app</h3>
        <span className="text-xs text-muted-foreground">{groups.length} grupo(s)</span>
      </div>
      <ul className="divide-y divide-border/40 text-xs">
        {groups.map((g) => (
          <LinkedRow key={g.name} group={g} onCompare={() => setPickerOpen(true)} />
        ))}
      </ul>
    </div>
  );
}

function LinkedRow({ group, onCompare }: { group: LinkedGroup; onCompare: () => void }) {
  const entries = group.entries;
  const total = entries.reduce((s, e) => s + e.reviews.length, 0);
  const confidence =
    group.confidence >= 0.85 ? "alta" : group.confidence >= 0.7 ? "média" : "fraca";
  return (
    <li className="flex items-center justify-between gap-2 px-4 py-2">
      <div className="min-w-0">
        <p className="font-medium truncate">{group.entries[0].app.name}</p>
        <p className="text-muted-foreground text-[11px]">
          {group.stores.join(" + ")} · {total} reviews · confiança {confidence}
        </p>
      </div>
      <button
        type="button"
        onClick={onCompare}
        className="shrink-0 text-primary hover:underline"
        aria-label={`Comparar ${group.entries[0].app.name} entre lojas`}
      >
        Comparar
      </button>
    </li>
  );
}
