/**
 * Unified multi-app view. Renders N columns, each showing the FULL detail
 * of an app (identical section order & structure via AppDetailColumn).
 *
 * Layout rules:
 *  - 1 app  → full width (single column)
 *  - 2 apps → 2 equal columns
 *  - 3 apps → 3 equal columns
 *  - 4+     → horizontal scroll with fixed-width columns
 */
import { TrendingUp, TrendingDown } from "lucide-react";
import type { AppInfo, ReviewEntry, SourceId } from "@/lib/appStoreApi";
import { AppDetailColumn } from "@/components/shared/AppDetailColumn";
import { SectionHeader } from "@/components/SectionHeader";
import { UnifiedComparisonAI } from "@/components/shared/UnifiedComparisonAI";

export interface ComparisonColumn {
  key: string;
  store: SourceId;
  id: string;
  app: AppInfo | null;
  reviews: ReviewEntry[];
  loading: boolean;
  isPrimary?: boolean;
}

interface Props {
  columns: ComparisonColumn[];
  onRemove?: (key: string) => void;
}

export function ComparisonView({ columns, onRemove }: Props) {
  const loaded = columns.filter(c => c.app);
  const count = columns.length;
  const isSingle = count === 1;
  const useScroll = count >= 4;
  const compact = count > 1;

  return (
    <div className="space-y-6">
      {!isSingle && loaded.length > 1 && (
        <section className="space-y-3">
          <SectionHeader
            eyebrow="Resumo comparativo"
            title={`${count} apps lado a lado`}
            description="Visão condensada das métricas-chave. Setas indicam o maior valor de cada linha."
          />
          <SummaryTable columns={loaded} />
        </section>
      )}

      {!isSingle && (
        <SectionHeader
          eyebrow="Análise detalhada"
          title="Todas as informações coletadas"
          description={
            useScroll
              ? "Role horizontalmente para navegar entre os apps — cada coluna traz o dossiê completo."
              : "Cada coluna traz o dossiê completo do app na mesma ordem, para facilitar a leitura cruzada."
          }
        />
      )}

      <div className={useScroll ? "overflow-x-auto -mx-6 px-6 pb-4" : ""}>
        <div
          className={useScroll ? "flex gap-6 min-w-max items-start" : "grid gap-6 items-start"}
          style={
            useScroll
              ? undefined
              : { gridTemplateColumns: `repeat(${Math.max(count, 1)}, minmax(0, 1fr))` }
          }
        >
          {columns.map(col => (
            <div
              key={col.key}
              className={useScroll ? "w-[440px] flex-shrink-0" : "min-w-0"}
            >
              {col.loading || !col.app ? (
                <div className="glass-card rounded-2xl p-8 text-center text-xs text-muted-foreground">
                  {col.loading ? "Carregando…" : "App não encontrado"}
                </div>
              ) : (
                <AppDetailColumn
                  app={col.app}
                  reviews={col.reviews}
                  compact={compact}
                  isPrimary={col.isPrimary}
                  onRemove={onRemove && !col.isPrimary ? () => onRemove(col.key) : undefined}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {loaded.length > 1 && (
        <section className="space-y-3 pt-2">
          <SectionHeader
            eyebrow="IA · Visão unificada"
            title="Análise cruzada de todos os apps"
            description="Depois do dossiê individual de cada app, esta síntese olha todos juntos: diferenciais, riscos compartilhados, oportunidades e ranking com evidências."
          />
          <UnifiedComparisonAI bundles={loaded.map(c => ({ app: c.app!, reviews: c.reviews }))} />
        </section>
      )}
    </div>
  );
}

function SummaryTable({ columns }: { columns: ComparisonColumn[] }) {
  const rows = columns.map(c => {
    const reviews = c.reviews;
    const avgRating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
    const positive = reviews.length ? Math.round((reviews.filter(r => r.rating >= 4).length / reviews.length) * 100) : 0;
    const negative = reviews.length ? Math.round((reviews.filter(r => r.rating <= 2).length / reviews.length) * 100) : 0;
    return { col: c, avgRating, positive, negative };
  });

  const maxAvg = Math.max(...rows.map(r => r.avgRating));
  const maxPos = Math.max(...rows.map(r => r.positive));
  const maxStoreRating = Math.max(...rows.map(r => r.col.app?.rating || 0));
  const maxRatingCount = Math.max(...rows.map(r => r.col.app?.ratingCount || 0));

  const trend = (value: number, max: number, good: boolean) =>
    value === max && value > 0
      ? good
        ? <TrendingUp className="h-3 w-3 text-success inline ml-1" />
        : <TrendingDown className="h-3 w-3 text-destructive inline ml-1" />
      : null;

  return (
    <div className="glass-card rounded-2xl p-4 overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border/50">
            <th className="text-left py-2 px-2 font-medium text-muted-foreground">App</th>
            <th className="text-right py-2 px-2 font-medium text-muted-foreground">Nota Loja</th>
            <th className="text-right py-2 px-2 font-medium text-muted-foreground">Avaliações</th>
            <th className="text-right py-2 px-2 font-medium text-muted-foreground">Reviews</th>
            <th className="text-right py-2 px-2 font-medium text-muted-foreground">Nota Média</th>
            <th className="text-right py-2 px-2 font-medium text-muted-foreground">% Positivos</th>
            <th className="text-right py-2 px-2 font-medium text-muted-foreground">% Negativos</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ col, avgRating, positive, negative }) => (
            <tr key={col.key} className="border-b border-border/20 hover:bg-secondary/30">
              <td className="py-2 px-2">
                <div className="flex items-center gap-2">
                  {col.app?.icon && <img src={col.app.icon} alt="" className="w-6 h-6 rounded" />}
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate max-w-[220px]">{col.app?.name}</p>
                    <span className="text-[9px] text-muted-foreground">{col.store === "apple" ? "App Store" : "Google Play"}{col.isPrimary ? " · foco" : ""}</span>
                  </div>
                </div>
              </td>
              <td className="text-right py-2 px-2 font-medium text-foreground">
                {col.app?.rating ? col.app.rating.toFixed(2) : "—"}
                {trend(col.app?.rating || 0, maxStoreRating, true)}
              </td>
              <td className="text-right py-2 px-2 text-foreground">
                {col.app?.ratingCount?.toLocaleString("pt-BR") || "—"}
                {trend(col.app?.ratingCount || 0, maxRatingCount, true)}
              </td>
              <td className="text-right py-2 px-2 text-foreground">{col.reviews.length}</td>
              <td className="text-right py-2 px-2 font-medium text-foreground">
                {avgRating > 0 ? avgRating.toFixed(2) : "—"}
                {trend(avgRating, maxAvg, true)}
              </td>
              <td className="text-right py-2 px-2 text-success font-medium">
                {positive}%
                {trend(positive, maxPos, true)}
              </td>
              <td className="text-right py-2 px-2 text-destructive font-medium">{negative}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
