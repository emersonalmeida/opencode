/**
 * Comparação entre fontes — visão quadro por fonte com KPIs e badges,
 * respondendo visualmente: "todas as fontes são testadas? sabemos o que
 * cada uma retorna e não retorna?"
 */
import { useMemo } from "react";
import {
  type AuditSource,
  IMPL_STATUS_META,
  sourceCounts,
} from "@/lib/audit/auditModel";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Layers,
  Table,
  TrendingUp,
} from "lucide-react";

function ByStatus({ source }: { source: AuditSource }) {
  const counts = sourceCounts(source);
  const all = useMemo(() => [
    ...source.endpoints.map((e) => e.status),
    ...source.parameters.map((p) => p.status),
    ...source.capabilities.map((c) => c.status),
    ...source.outputs.map((o) => o.status),
  ], [source]);
  const total = all.length || 1;
  const implemented = all.filter((s) => s === "implemented").length;
  const available = all.filter((s) => s === "available").length;
  const partial = all.filter((s) => s === "partial").length;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{total} itens</span>
        <span>{Math.round((implemented / total) * 100)}% implementado</span>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-muted/40">
        {implemented > 0 && <div style={{ width: `${(implemented / total) * 100}%` }} className="bg-emerald-500" />}
        {partial > 0 && <div style={{ width: `${(partial / total) * 100}%` }} className="bg-amber-500" />}
        {available > 0 && <div style={{ width: `${(available / total) * 100}%` }} className="bg-sky-500" />}
      </div>
      <div className="flex flex-wrap gap-1 text-xs">
        {implemented > 0 && <Badge variant="outline" className="bg-emerald-500/10">{implemented} impl</Badge>}
        {available > 0 && <Badge variant="outline" className="bg-sky-500/10">{available} disp</Badge>}
        {counts.gaps > 0 && <Badge variant="outline" className="bg-sky-500/10">{counts.gaps} lac</Badge>}
      </div>
    </div>
  );
}

function SourceMini({ source }: { source: AuditSource }) {
  const counts = sourceCounts(source);
  const href = `#auditoria-${source.id}`;
  return (
    <a
      href={href}
      className="block space-y-2 rounded-lg border bg-card p-3 transition-colors hover:border-primary/50"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-xs text-muted-foreground">{String(source.order).padStart(2, "0")}</div>
          <div className="truncate font-medium">{source.name}</div>
          <div className="truncate text-xs text-muted-foreground">{source.category}</div>
        </div>
        <div className="flex flex-col items-end gap-1 text-xs">
          {source.implemented
            ? <Badge variant="outline" className="bg-emerald-500/10">implementada</Badge>
            : <Badge variant="outline" className="bg-muted/40">pendente</Badge>}
          <Badge variant="outline" className="bg-muted/40">{IMPL_STATUS_META[source.status]?.label ?? source.status}</Badge>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Layers className="h-3 w-3" /> {counts.endpoints}</span>
        <span className="inline-flex items-center gap-1"><Table className="h-3 w-3" /> {counts.parameters}</span>
        <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> {counts.fields}</span>
        {counts.gaps > 0 && <span className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-300"><TrendingUp className="h-3 w-3" /> {counts.gaps}</span>}
      </div>
      <ByStatus source={source} />
    </a>
  );
}

interface AuditComparisonProps {
  sources: AuditSource[];
}

export function AuditComparison({ sources }: AuditComparisonProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="list">
      {sources.map((s) => (
        <div key={s.id} role="listitem">
          <SourceMini source={s} />
        </div>
      ))}
    </div>
  );
}
