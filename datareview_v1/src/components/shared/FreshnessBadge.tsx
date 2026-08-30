/**
 * Badge de freshness do dataset (todo.md P1): mostra "dados de X dias" com
 * tom (fresh/aging/stale) e tooltip com a data completa. Renderiza `null`
 * quando não há coleta.
 */
import { CalendarDays } from "lucide-react";
import { freshness } from "@/lib/datasetFreshness";
import { cn } from "@/lib/utils";

const TONE_CLASS: Record<string, string> = {
  fresh: "text-emerald-600 dark:text-emerald-400",
  aging: "text-amber-600 dark:text-amber-400",
  stale: "text-red-500",
};

export function FreshnessBadge({ collectedAt, ttlDays, className }: { collectedAt?: number; ttlDays?: number; className?: string }) {
  const f = collectedAt ? freshness(collectedAt, Date.now(), ttlDays ?? 7) : null;
  if (!f || !collectedAt) return null;
  const date = new Date(collectedAt).toLocaleString("pt-BR");
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", TONE_CLASS[f.tone], className)}
      title={`Coletado em ${date}${f.stale ? " — acima do TTL" : ""}`}
    >
      <CalendarDays className="h-3 w-3" /> {f.label}
    </span>
  );
}
