/**
 * Gráficos (recharts) do dashboard visual da auditoria: distribuição
 * de status e presença por fonte, com cores do chartColors.
 */
import { useMemo } from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  type AuditSource,
  IMPL_STATUS_META,
  PRESENCE_META,
  type ImplStatus,
  type FieldPresence,
} from "@/lib/audit/auditModel";
import { seriesColor } from "@/lib/chartColors";

const STATUS_TONES: Record<ImplStatus, string> = {
  implemented: "hsl(var(--chart-2))",
  partial: "hsl(var(--chart-4))",
  available: "hsl(var(--chart-1))",
  unavailable: "hsl(var(--muted-foreground) / 0.4)",
};

const PRESENCE_TONES: Record<FieldPresence, string> = {
  always: "hsl(var(--chart-2))",
  common: "hsl(var(--chart-1))",
  conditional: "hsl(var(--chart-4))",
  rare: "hsl(var(--chart-5))",
  absent: "hsl(var(--muted-foreground) / 0.4)",
};

interface AuditVisualChartsProps {
  source: AuditSource;
}

export function AuditVisualCharts({ source }: AuditVisualChartsProps) {
  const statusData = useMemo(() => {
    const counts: Record<ImplStatus, number> = { implemented: 0, partial: 0, available: 0, unavailable: 0 };
    [
      ...source.endpoints.map((e) => e.status),
      ...source.parameters.map((p) => p.status),
      ...source.capabilities.map((c) => c.status),
      ...source.outputs.map((o) => o.status),
    ].forEach((st) => counts[st]++);
    return (Object.entries(counts) as [ImplStatus, number][])
      .filter(([_, v]) => v > 0)
      .map(([k, v]) => ({ name: IMPL_STATUS_META[k]?.label ?? k, value: v, fill: STATUS_TONES[k] }));
  }, [source]);

  const presenceData = useMemo(() => {
    const counts: Record<FieldPresence, number> = { always: 0, common: 0, conditional: 0, rare: 0, absent: 0 };
    source.outputs.forEach((o) => counts[o.presence]++);
    return (Object.entries(counts) as [FieldPresence, number][])
      .filter(([_, v]) => v > 0)
      .map(([k, v]) => ({ name: PRESENCE_META[k]?.label ?? k, value: v, fill: PRESENCE_TONES[k] }));
  }, [source]);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* Distribuição por status */}
      <div className="space-y-1">
        <div className="text-xs font-medium">Distribuição por status</div>
        <div className="h-36">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={40} paddingAngle={2}>
                {statusData.map((d, i) => (
                  <Cell key={i} fill={d.fill ?? seriesColor(i)} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number | string | undefined, n: string) => [`${v} itens`, n]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap gap-1">
          {statusData.map((d, i) => (
            <span key={i} className="inline-flex items-center gap-1 text-xs">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.fill }} />
              {d.name}: {d.value}
            </span>
          ))}
        </div>
      </div>

      {/* Presença de campos */}
      {source.outputs.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-medium">Presença de campos</div>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={presenceData} layout="vertical" margin={{ left: 8, right: 20 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={76} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number | string | undefined, n: string) => [`${v} campos`, n]} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {presenceData.map((d, i) => (
                    <Cell key={i} fill={d.fill ?? seriesColor(i)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
