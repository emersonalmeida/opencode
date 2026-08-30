/**
 * Dashboard visual da auditoria de UMA fonte.
 *
 * Mostra visualmente e interativamente o que a fonte retorna/não retorna,
 * o que pode coletar, o que pode gerar, com KPIs, barras por status,
 * presença de campos e lacunas explícitas. Usado dentro de
 * AuditSourceSection (antes da tríade documental).
 */
import { useMemo } from "react";
import {
  type AuditSource,
  IMPL_STATUS_META,
  PRESENCE_META,
  sourceCounts,
  type ImplStatus,
  type FieldPresence,
} from "@/lib/audit/auditModel";
import { seriesColor } from "@/lib/chartColors";
import { Badge } from "@/components/ui/badge";
import { AuditVisualCharts } from "@/components/audit/AuditVisualCharts";

import {
  BarChart3,
  CheckCircle2,
  Eye,
  Layers,
  ShieldCheck,
  Table,
  TrendingUp,
  XCircle,
} from "lucide-react";

const STATUS_TONE: Record<ImplStatus, string> = {
  implemented: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  partial: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  available: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  unavailable: "bg-muted/40 text-muted-foreground",
};

const PRESENCE_TONE: Record<FieldPresence, string> = {
  always: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  common: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  conditional: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  rare: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  absent: "bg-muted/40 text-muted-foreground",
};

const PRESENCE_ORDER: FieldPresence[] = ["always", "common", "conditional", "rare", "absent"];
const STATUS_ORDER: ImplStatus[] = ["implemented", "partial", "available", "unavailable"];

function KpiChip({ icon: Icon, value, label, tone }: {
  icon: React.ComponentType<{ className?: string }>;
  value: number | string;
  label: string;
  tone?: string;
}) {
  return (
    <div title={label} className={`flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-1 ${tone ?? "bg-muted/40"}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate text-xs">
        <span className="font-semibold">{value}</span> <span className="text-muted-foreground">{label}</span>
      </span>
    </div>
  );
}

function StatusRow({ items, kind }: { items: { label: string; status: ImplStatus }[]; kind: "capabilities" | "parameters" | "outputs" | "endpoints" }) {
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item, i) => (
        <Badge key={i} variant="outline" className={STATUS_TONE[item.status]}>
          {item.label}{kind === "outputs" && <span className="ml-1 text-muted-foreground">({item.status})</span>}
        </Badge>
      ))}
    </div>
  );
}

export function AuditSourceVisual({ source }: { source: AuditSource }) {
  const counts = sourceCounts(source);
  const allItems = useMemo(() => [
    ...source.endpoints.map((e) => ({ label: e.label, status: e.status })),
    ...source.parameters.map((p) => ({ label: p.name, status: p.status })),
    ...source.capabilities.map((c) => ({ label: c.label, status: c.status })),
    ...source.outputs.map((o) => ({ label: o.name, status: o.status })),
  ], [source]);

  const statusCounts = useMemo(() => {
    const m: Record<ImplStatus, number> = { implemented: 0, partial: 0, available: 0, unavailable: 0 };
    allItems.forEach((i) => m[i.status]++);
    return m;
  }, [allItems]);
  const total = allItems.length || 1;

  const presenceCounts = useMemo(() => {
    const m: Record<FieldPresence, number> = { always: 0, common: 0, conditional: 0, rare: 0, absent: 0 };
    source.outputs.forEach((o) => m[o.presence]++);
    return m;
  }, [source.outputs]);

  const alwaysItems = source.outputs.filter((o) => o.presence === "always");
  const availableItems = allItems.filter((i) => i.status === "available");

  return (
    <section className="rounded-lg border bg-card p-4 space-y-4">
      {/* KPIs */}
      <div className="flex flex-wrap gap-2">
        <KpiChip icon={Layers} value={counts.endpoints} label="endpoints" />
        <KpiChip icon={Table} value={counts.parameters} label="parâmetros" />
        <KpiChip icon={BarChart3} value={counts.fields} label="campos" />
        <KpiChip icon={CheckCircle2} value={statusCounts.implemented} label="implementados" tone="bg-emerald-500/10" />
        {counts.gaps > 0 && <KpiChip icon={TrendingUp} value={counts.gaps} label="lacunas" tone="bg-sky-500/10" />}
        <KpiChip icon={ShieldCheck} value={source.reliability.risks.length} label="riscos" />
      </div>

      {/* Barra por status */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Status dos {total} itens</span>
          <span>{Math.round((statusCounts.implemented / total) * 100)}% implementado</span>
        </div>
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted/40">
          {STATUS_ORDER.map((k, i) => {
            const v = statusCounts[k];
            if (!v) return null;
            return (
              <div
                key={k}
                className="block"
                style={{ width: `${(v / total) * 100}%`, background: seriesColor(i) }}
                title={`${IMPL_STATUS_META[k].label}: ${v}`}
              />
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_ORDER.map((k) => (
            statusCounts[k] ? (
              <Badge key={k} variant="outline" className={STATUS_TONE[k]}>
                {IMPL_STATUS_META[k].label}: {statusCounts[k]}
              </Badge>
            ) : null
          ))}
        </div>
      </div>

      {/* Carmpos */}
      {source.outputs.length > 0 && (
        <div>
          <div className="text-xs font-medium mb-1">Campos ({source.outputs.length})</div>
          <div className="flex flex-wrap gap-1">
            {source.outputs.map((o, i) => (
              <Badge key={i} variant="outline" className={PRESENCE_TONE[o.presence]} title={`${o.presence}: ${o.description}`}>
                {o.name} <span className="text-muted-foreground">({PRESENCE_META[o.presence].label})</span>
              </Badge>
            ))}
          </div>
        </div>
      )}

      <AuditVisualCharts source={source} />

      {/* Presenças */}
      {source.outputs.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <span className="text-xs text-muted-foreground">Presença:</span>
          {PRESENCE_ORDER.map((p) => (
            presenceCounts[p] ? (
              <Badge key={p} variant="outline" className={PRESENCE_TONE[p]}>{PRESENCE_META[p].label}: {presenceCounts[p]}</Badge>
            ) : null
          ))}
        </div>
      )}

      {/* Lacunas */}
      {availableItems.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs">
            <Eye className="h-3.5 w-3.5 text-sky-600 dark:text-sky-300" />
            <span className="font-medium">Lacunas documentadas (o que a fonte OFERECE e ainda não coletamos)</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {availableItems.slice(0, 6).map((item, i) => (
              <Badge key={i} variant="outline" className={STATUS_TONE.available}>{item.label}</Badge>
            ))}
            {availableItems.length > 6 && <Badge variant="outline" className="bg-muted/40">…+{availableItems.length - 6}</Badge>}
          </div>
        </div>
      )}

      {/* Campos always */}
      {alwaysItems.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" />
            <span className="font-medium">Sempre presentes ({alwaysItems.length})</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {alwaysItems.map((o, i) => (
              <Badge key={i} variant="outline" className={PRESENCE_TONE.always}>{o.name}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Limites */}
      {source.reliability.risks.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs">
            <XCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-300" />
            <span className="font-medium">Riscos ({source.reliability.risks.length})</span>
          </div>
          <ul className="list-disc pl-5 text-xs text-muted-foreground">
            {source.reliability.risks.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
}
