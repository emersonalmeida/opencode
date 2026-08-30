/**
 * Card de trend do extrator — hierarquia visual clara: título do trend,
 * volume de buscas e crescimento em destaque, status (ativo/encerrado),
 * tópicos, tempo relativo, avatar com imagem da notícia quando existe,
 * e expansão com notícias vinculadas + consultas relacionadas. A11y: tudo
 * com texto alternativo e região nomeada; expansão via aria-expanded.
 */
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Flame,
  Hourglass,
  ImageOff,
  Newspaper,
  Search,
} from "lucide-react";
import {
  exploreUrl,
  formatTraffic,
  hoursShort,
  relativeTime,
  topicLabel,
  type TrendingItem,
} from "../../../server/lib/trendingCore";

export function TrendCard({ item, geo }: { item: TrendingItem; geo: string }) {
  const [open, setOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const expandable = item.news.length > 0 || item.relatedQueries.length > 0;
  const growth = item.growthPct;

  return (
    <article
      aria-label={`Trend: ${item.title}`}
      className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-xs transition-colors",
        item.active && "border-primary/25",
      )}
    >
      <div className="flex items-start gap-3 p-3">
        {item.picture && !imgError ? (
          <img
            src={item.picture}
            alt={item.pictureSource ? `Imagem: ${item.pictureSource}` : ""}
            loading="lazy"
            onError={() => setImgError(true)}
            className="h-14 w-14 shrink-0 rounded-md border object-cover"
          />
        ) : (
          <div
            aria-hidden
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground"
          >
            <ImageOff className="h-4 w-4" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-sm font-semibold leading-snug text-foreground">{item.title}</h3>
            {item.active ? (
              <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary">
                <Flame className="h-3 w-3" aria-hidden /> Em alta agora
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-muted-foreground">
                <Hourglass className="h-3 w-3" aria-hidden /> Encerrado
              </Badge>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="font-bold tabular-nums" title={`${item.traffic.toLocaleString("pt-BR")} buscas`}>
              {formatTraffic(item.traffic)}
              <span className="ml-1 font-normal text-muted-foreground">buscas</span>
            </span>
            {growth > 0 && (
              <span
                className="flex items-center gap-0.5 tabular-nums text-status-success"
                title={`+${growth}% de crescimento no período`}
              >
                <ArrowUp className="h-3 w-3" aria-hidden />
                {growth}%
              </span>
            )}
            {growth < 0 && (
              <span className="flex items-center gap-0.5 tabular-nums text-status-error" title={`${growth}% no período`}>
                <ArrowDown className="h-3 w-3" aria-hidden />
                {Math.abs(growth)}%
              </span>
            )}
            {item.startedAt && (
              <span className="text-muted-foreground" title={new Date(item.startedAt).toLocaleString("pt-BR")}>
                {relativeTime(item.startedAt)}
              </span>
            )}
            {item.news.length > 0 && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Newspaper className="h-3 w-3" aria-hidden />
                {item.news.length} {item.news.length === 1 ? "notícia" : "notícias"}
              </span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {item.topicIds.map((t) => (
              <Badge key={t} variant="outline" className="text-[10px] text-muted-foreground">
                {topicLabel(t)}
              </Badge>
            ))}
            {item.provenance.hours.map((h) => (
              <Badge key={h} className="text-[10px]" variant="secondary" title={`Aparece na janela de ${h} horas`}>
                {hoursShort(h)}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Button variant="ghost" size="sm" asChild className="h-7 px-2 text-xs">
            <a
              href={exploreUrl(item.title, geo)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Explorar ${item.title} no Google Trends (nova aba)`}
            >
              <Search className="h-3.5 w-3.5" aria-hidden /> Explorar
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          </Button>
          {expandable && (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-label={open ? "Recolher detalhes" : "Expandir detalhes"}
              className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              {open ? "Menos detalhes" : "Mais detalhes"}
            </button>
          )}
        </div>
      </div>

      {open && expandable && (
        <div className="border-t px-3 py-2.5 anim-fade-in">
          {item.news.length > 0 && (
            <>
              <h4 className="mb-1 text-xs font-medium text-muted-foreground">Notícias vinculadas</h4>
              <ul className="space-y-1">
                {item.news.map((n) => (
                  <li key={n.url} className="text-xs">
                    <a
                      href={n.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-baseline gap-1 hover:underline"
                    >
                      {n.title}
                      <ExternalLink className="h-2.5 w-2.5 shrink-0 translate-y-px" aria-hidden />
                    </a>
                    <span className="ml-1.5 text-muted-foreground">({n.source})</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {item.relatedQueries.length > 0 && (
            <>
              <h4 className="mb-1 mt-2 text-xs font-medium text-muted-foreground">Consultas relacionadas</h4>
              <div className="flex flex-wrap gap-1">
                {item.relatedQueries.map((q) => (
                  <Badge key={q} variant="secondary" className="text-[10px]">
                    {q}
                  </Badge>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </article>
  );
}
