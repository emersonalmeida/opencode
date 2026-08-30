import { ExternalLink } from "lucide-react";
import { formatScore, type DiscoverItem } from "@/lib/discover/discoverApi";

/**
 * Card padronizado de um item de qualquer fonte da Descoberta.
 * Layout: rank/opcional + imagem opcional + título/subtítulo + métrica + link.
 * O card inteiro é um link quando há URL (área de clique generosa, a11y).
 */
export function DiscoverItemCard({ item, rank }: { item: DiscoverItem; rank?: number }) {
  const score = formatScore(item);
  const body = (
    <div className="flex items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-accent/40">
      {rank != null && (
        <span
          aria-label={`posição ${rank}`}
          className="mt-0.5 w-7 shrink-0 text-right text-sm font-semibold tabular-nums text-muted-foreground"
        >
          {rank}
        </span>
      )}
      {item.image && (
        <img
          src={item.image}
          alt=""
          loading="lazy"
          className="h-12 w-12 shrink-0 rounded-md object-cover"
          onError={(e) => {
            // Imagem quebrada some em vez de mostrar o ícone de erro do browser.
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-snug" title={item.title}>
          {item.title}
        </p>
        {item.subtitle && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground" title={item.subtitle}>
            {item.subtitle}
          </p>
        )}
        {item.publishedAt && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {new Date(item.publishedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
          </p>
        )}
      </div>
      {score && (
        <span className="shrink-0 self-center rounded-md bg-secondary px-2 py-1 text-xs font-medium tabular-nums text-secondary-foreground">
          {score}
        </span>
      )}
      {item.url && (
        <ExternalLink aria-hidden className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}
    </div>
  );

  if (!item.url) return body;
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      aria-label={`${item.title} (abre em nova aba)`}
    >
      {body}
    </a>
  );
}
