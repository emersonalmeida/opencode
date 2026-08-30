/**
 * Uni — gráficos determinísticos sobre os itens coletados (recharts).
 */
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer,
} from "recharts";
import type { TrendsData } from "@/lib/uni/uniApi";
import { uniKindDist, uniSourceDist, uniTopScored, uniWordFreq } from "@/lib/uni/uniAnalytics";
import type { UniItem } from "@/lib/uni/types";

const CHART_COLORS = [
  "hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))",
  "hsl(var(--chart-4))", "hsl(var(--chart-5))",
];

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="mb-2 text-sm font-medium">{title}</p>
      <div className="h-56">{children}</div>
    </div>
  );
}

/** Interesse ao longo do tempo (Trends) — multi-termo. */
export function UniTrendsChart({ trends }: { trends: TrendsData }) {
  if (!trends.timeline.length) return null;
  const data = trends.timeline.map((p) => {
    const row: Record<string, string | number> = { date: p.date.slice(5) }; // MM-DD
    trends.terms.forEach((t, i) => { row[t] = p.values[i] ?? 0; });
    return row;
  });
  return (
    <ChartCard title="Interesse ao longo do tempo">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {trends.terms.map((t, i) => (
            <Line key={t} type="monotone" dataKey={t} stroke={CHART_COLORS[i % CHART_COLORS.length]} dot={false} strokeWidth={2} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/** Regiões com maior interesse (Trends). */
export function UniRegionsChart({ trends }: { trends: TrendsData }) {
  if (!trends.regions.length) return null;
  const data = trends.regions
    .map((r) => ({ label: r.region, value: Math.max(...r.values, 0) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);
  return (
    <ChartCard title="Interesse por região">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis type="number" tick={{ fontSize: 10 }} />
          <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 10 }} />
          <Tooltip />
          <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/** Termos mais frequentes nos itens. */
export function UniTermsChart({ items }: { items: UniItem[] }) {
  const data = uniWordFreq(items, 15);
  if (!data.length) return null;
  return (
    <ChartCard title="Termos mais frequentes">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis type="number" tick={{ fontSize: 10 }} />
          <YAxis type="category" dataKey="text" width={110} tick={{ fontSize: 10 }} />
          <Tooltip />
          <Bar dataKey="value" fill={CHART_COLORS[1]} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/** Distribuição por fonte. */
export function UniSourceChart({ items }: { items: UniItem[] }) {
  const data = uniSourceDist(items);
  if (data.length < 2) return null;
  return (
    <ChartCard title="Itens por fonte">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="label" outerRadius={80} label={({ label, value }) => `${label}: ${value}`}>
            {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/** Top itens por engajamento (score). */
export function UniTopScoredChart({ items }: { items: UniItem[] }) {
  const data = uniTopScored(items, 10);
  if (!data.length) return null;
  return (
    <ChartCard title="Maior engajamento (score)">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis type="number" tick={{ fontSize: 10 }} />
          <YAxis type="category" dataKey="label" width={180} tick={{ fontSize: 10 }} />
          <Tooltip />
          <Bar dataKey="value" fill={CHART_COLORS[2]} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export { uniKindDist };
