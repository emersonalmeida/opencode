import { useMemo } from "react";
import { BarChart3, Quote } from "lucide-react";
import type { AppInfo, ReviewEntry } from "@/lib/appStoreApi";

interface Props {
  app: AppInfo;
  reviews: ReviewEntry[];
  compact?: boolean;
}

const STOP = new Set([
  "a","o","e","de","da","do","que","em","para","com","não","um","uma","os","as","no","na","por","mais","se","mas",
  "ao","ele","ela","das","dos","ou","ser","quando","muito","há","nos","já","eu","também","é","foi","esse","essa",
  "está","são","tem","seu","sua","isso","este","me","meu","minha","ter","como","app","aplicativo","pra","pro","tá","vai","bem","só","nem","sem","the","and","for","this","that",
]);

function topThemes(reviews: ReviewEntry[], n: number) {
  const freq: Record<string, number> = {};
  for (const r of reviews) {
    const words = `${r.title} ${r.text}`.toLowerCase().split(/[\s,.!?;:()"\-/]+/);
    const seen = new Set<string>();
    for (const w of words) {
      if (w.length < 4 || STOP.has(w) || seen.has(w)) continue;
      seen.add(w);
      freq[w] = (freq[w] || 0) + 1;
    }
  }
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, n);
}

export function QuantiQualiFindings({ app, reviews, compact }: Props) {
  const data = useMemo(() => {
    const total = reviews.length;
    const positives = reviews.filter(r => r.rating >= 4);
    const negatives = reviews.filter(r => r.rating <= 2);
    const withReply = reviews.filter(r => r.developerReply).length;
    const avg = total ? reviews.reduce((s, r) => s + r.rating, 0) / total : 0;
    const median = total ? [...reviews].sort((a, b) => a.rating - b.rating)[Math.floor(total / 2)].rating : 0;
    const themesPos = topThemes(positives, compact ? 5 : 8);
    const themesNeg = topThemes(negatives, compact ? 5 : 8);
    const quotePos = positives.sort((a, b) => b.text.length - a.text.length)[0];
    const quoteNeg = negatives.sort((a, b) => b.text.length - a.text.length)[0];
    return {
      total, positives: positives.length, negatives: negatives.length, withReply,
      avg, median, themesPos, themesNeg, quotePos, quoteNeg,
    };
  }, [reviews, compact]);

  const quanti = [
    { label: "Nota da loja", value: app.rating > 0 ? app.rating.toFixed(2) : "—" },
    { label: "Avaliações totais", value: app.ratingCount ? app.ratingCount.toLocaleString("pt-BR") : "—" },
    { label: "Reviews coletados", value: String(data.total) },
    { label: "Nota média coletada", value: data.avg ? data.avg.toFixed(2) : "—" },
    { label: "Mediana", value: data.median ? `★${data.median}` : "—" },
    { label: "% positivos", value: data.total ? `${Math.round((data.positives / data.total) * 100)}%` : "—" },
    { label: "% negativos", value: data.total ? `${Math.round((data.negatives / data.total) * 100)}%` : "—" },
    { label: "Respostas do dev", value: String(data.withReply) },
  ];

  return (
    <div className="glass-card rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-primary" />
        <h3 className={compact ? "text-xs font-semibold text-foreground" : "text-sm font-semibold text-foreground"}>
          Descobertas quantitativas e qualitativas
        </h3>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-2">Quantitativas</p>
        <div className={`grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
          {quanti.map(k => (
            <div key={k.label} className="rounded-lg bg-secondary/40 p-2">
              <p className="text-sm font-bold text-foreground">{k.value}</p>
              <p className="text-[10px] text-muted-foreground">{k.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-success mb-2">Temas positivos</p>
          <div className="flex flex-wrap gap-1">
            {data.themesPos.length === 0 && <span className="text-[11px] text-muted-foreground">—</span>}
            {data.themesPos.map(([w, c]) => (
              <span key={w} className="text-[10px] px-2 py-0.5 rounded-full bg-success/10 text-success">{w} · {c}</span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-destructive mb-2">Temas negativos</p>
          <div className="flex flex-wrap gap-1">
            {data.themesNeg.length === 0 && <span className="text-[11px] text-muted-foreground">—</span>}
            {data.themesNeg.map(([w, c]) => (
              <span key={w} className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">{w} · {c}</span>
            ))}
          </div>
        </div>
      </div>

      {(data.quotePos || data.quoteNeg) && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70">Citações representativas</p>
          {data.quotePos && (
            <blockquote className="text-[11px] text-foreground border-l-2 border-success/50 pl-3 flex gap-2">
              <Quote className="h-3 w-3 text-success flex-shrink-0 mt-0.5" />
              <span className="line-clamp-3">{data.quotePos.text}</span>
            </blockquote>
          )}
          {data.quoteNeg && (
            <blockquote className="text-[11px] text-foreground border-l-2 border-destructive/50 pl-3 flex gap-2">
              <Quote className="h-3 w-3 text-destructive flex-shrink-0 mt-0.5" />
              <span className="line-clamp-3">{data.quoteNeg.text}</span>
            </blockquote>
          )}
        </div>
      )}
    </div>
  );
}
