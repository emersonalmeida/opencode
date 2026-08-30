import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import type { ReviewEntry } from "@/lib/appStoreApi";

interface Props {
  reviews: ReviewEntry[];
  compact?: boolean;
}

const ISSUE_KEYWORDS = [
  "bug", "crash", "trava", "travando", "erro", "falha", "problema", "não funciona", "nao funciona",
  "não abre", "nao abre", "lento", "quebrou", "quebrado", "buggy", "não carrega", "nao carrega",
  "não entra", "nao entra", "não consigo", "nao consigo", "tela preta", "loop", "não atualiza",
];

function isIssue(text: string, rating: number): boolean {
  if (rating > 2) return false;
  const t = text.toLowerCase();
  return ISSUE_KEYWORDS.some(k => t.includes(k));
}

export function UpdateIssues({ reviews, compact }: Props) {
  const groups = useMemo(() => {
    const map = new Map<string, ReviewEntry[]>();
    for (const r of reviews) {
      if (!isIssue(`${r.title} ${r.text}`, r.rating)) continue;
      const v = r.version?.trim() || "sem versão";
      const arr = map.get(v) || [];
      arr.push(r);
      map.set(v, arr);
    }
    return Array.from(map.entries())
      .map(([version, revs]) => ({ version, revs: revs.sort((a, b) => b.date.localeCompare(a.date)) }))
      .sort((a, b) => (b.revs[0]?.date || "").localeCompare(a.revs[0]?.date || ""))
      .slice(0, compact ? 3 : 8);
  }, [reviews, compact]);

  return (
    <div className="glass-card rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <h3 className={compact ? "text-xs font-semibold text-foreground" : "text-sm font-semibold text-foreground"}>
          Problemas por versão
        </h3>
      </div>

      {groups.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum problema recorrente identificado nos reviews coletados.</p>
      ) : (
        <div className="space-y-3">
          {groups.map(g => (
            <div key={g.version} className="border-l-2 border-destructive/40 pl-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">v{g.version}</span>
                <span className="text-[10px] text-muted-foreground">{g.revs.length} relato{g.revs.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="space-y-1">
                {g.revs.slice(0, compact ? 2 : 4).map(r => (
                  <div key={r.id} className="text-[11px] text-muted-foreground line-clamp-2">
                    <span className="text-destructive font-medium">★{r.rating}</span> · {r.title || r.text.slice(0, 120)}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
