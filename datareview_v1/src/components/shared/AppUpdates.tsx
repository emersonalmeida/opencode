import { useMemo } from "react";
import { RefreshCcw, Calendar } from "lucide-react";
import type { AppInfo, ReviewEntry } from "@/lib/appStoreApi";

interface Props {
  app: AppInfo;
  reviews: ReviewEntry[];
  compact?: boolean;
}

/** Aggregates version history from reviews and shows the current release notes / recent changes. */
export function AppUpdates({ app, reviews, compact }: Props) {
  const versions = useMemo(() => {
    const map = new Map<string, { count: number; firstSeen: string; lastSeen: string; avgRating: number; ratings: number[] }>();
    for (const r of reviews) {
      const v = r.version?.trim();
      if (!v) continue;
      const cur = map.get(v) || { count: 0, firstSeen: r.date, lastSeen: r.date, avgRating: 0, ratings: [] };
      cur.count += 1;
      cur.ratings.push(r.rating);
      if (r.date < cur.firstSeen) cur.firstSeen = r.date;
      if (r.date > cur.lastSeen) cur.lastSeen = r.date;
      map.set(v, cur);
    }
    return Array.from(map.entries())
      .map(([version, d]) => ({
        version,
        count: d.count,
        lastSeen: d.lastSeen,
        avgRating: d.ratings.reduce((s, x) => s + x, 0) / d.ratings.length,
      }))
      .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen))
      .slice(0, compact ? 4 : 10);
  }, [reviews, compact]);

  const currentNotes = app.releaseNotes || app.recentChanges;
  const currentVersion = app.version;
  const currentDate = app.currentVersionReleaseDate || app.lastUpdated;

  return (
    <div className="glass-card rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <RefreshCcw className="h-4 w-4 text-primary" />
        <h3 className={compact ? "text-xs font-semibold text-foreground" : "text-sm font-semibold text-foreground"}>
          Atualizações
        </h3>
      </div>

      {currentNotes ? (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">Versão {currentVersion || "atual"}</span>
            {currentDate && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(currentDate).toLocaleDateString("pt-BR")}
              </span>
            )}
          </div>
          <p className="text-xs text-foreground whitespace-pre-line leading-relaxed line-clamp-[10]">{currentNotes}</p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Sem notas de versão publicadas pela loja.</p>
      )}

      {versions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70">Versões vistas nos reviews</p>
          <div className="space-y-1">
            {versions.map(v => (
              <div key={v.version} className="flex items-center justify-between gap-2 text-[11px] px-2 py-1.5 rounded-md bg-secondary/40">
                <span className="font-medium text-foreground">v{v.version}</span>
                <span className="text-muted-foreground">{v.count} reviews · ★{v.avgRating.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
