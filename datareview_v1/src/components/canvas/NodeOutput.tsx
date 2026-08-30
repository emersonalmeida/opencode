import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell,
  PieChart, Pie, LineChart, Line, AreaChart, Area, CartesianGrid, Tooltip,
  ScatterChart, Scatter, ZAxis,
} from "recharts";
import { AIOutputCard } from "@/components/shared/AIOutputCard";
import { CHART_SERIES as PALETTE, RATING_COLORS } from "@/lib/chartColors";
import { SelectionExplorer } from "./SelectionExplorer";
import { isFeatureEnabled } from "@/lib/featureFlags";

const TOOLTIP_STYLE = {
  background: "hsl(var(--card))", border: "1px solid hsl(var(--border))",
  borderRadius: "8px", color: "hsl(var(--card-foreground))", fontSize: "11px",
} as const;

/**
 * Renderiza a saída de execução de um nó dentro do card do nó. Suporta vários
 * tipos de gráfico (barra, pizza, linha, área, barra horizontal, nuvem de
 * palavras) além de markdown (IA/prompt/relatório) e tabelas. Tudo se adapta à
 * largura do nó — sem alturas fixas, o nó cresce com o conteúdo (sem scroll
 * interno).
 */
export function NodeOutput({ value, streaming, presentation, nodeId }: { value: unknown; streaming?: boolean; presentation?: boolean; nodeId?: string }) {
  if (value == null) return null;

  // Charts from the chart / analysis nodes.
  if (value && typeof value === "object" && "chart" in (value as object)) {
    return <ChartOutput value={value as { chart: string; data: unknown[]; title?: string; xKey?: string; yKey?: string }} />;
  }

  // Dashboard node: KPIs + multiple charts.
  if (value && typeof value === "object" && "dashboard" in (value as object)) {
    return <DashboardOutput value={value as { kpis: Record<string, number | string | null>; charts: { chart: string; data: unknown[]; title?: string; xKey?: string; yKey?: string }[] }} />;
  }

  // Analysis nodes (statistics/reviews-analysis) produce markdown + maybe kpis/table.
  if (value && typeof value === "object" && "markdown" in (value as object)) {
    const md = String((value as { markdown: string }).markdown ?? "");
    if (!md) return <p className="text-[10px] italic text-muted-foreground">Gerando…</p>;
    const inner = (
      <div className={`relative rounded-md bg-background/60 prose-sm ${presentation ? "border border-border/40 p-2" : ""}`}>
        {streaming && <span className="mr-1 inline-block h-2 w-2 animate-pulse rounded-full bg-primary align-middle" />}
        <AIOutputCard bare content={md} filename="canvas-node" streaming={streaming} storageKey={nodeId ? `canvas-node-${nodeId}` : undefined} />
      </div>
    );
    // Só ativa seleção de texto → explorar quando sabemos qual nó produziu a
    // saída E a feature flag está ligada.
    return (nodeId && isFeatureEnabled("canvas.selection-explore")) ? <SelectionExplorer nodeId={nodeId}>{inner}</SelectionExplorer> : inner;
  }

  // Table from the table/reviews-analysis node.
  if (value && typeof value === "object" && "columns" in (value as object) && Array.isArray((value as { rows: unknown[] }).rows)) {
    const v = value as { columns: string[]; rows: Record<string, unknown>[] };
    return (
      <div className="rounded-md border border-border/40 overflow-hidden">
        <table className="w-full text-[9px]">
          <thead className="bg-secondary/60">
            <tr>{v.columns.map((c) => <th key={c} className="px-1.5 py-1 text-left font-medium text-muted-foreground">{c}</th>)}</tr>
          </thead>
          <tbody>
            {v.rows.slice(0, 50).map((r, i) => (
              <tr key={i} className="border-t border-border/30">
                {v.columns.map((c) => <td key={c} className="px-1.5 py-0.5 truncate max-w-[80px]">{String(r[c] ?? "—")}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Plain text from the display node.
  if (value && typeof value === "object" && "text" in (value as object) && !Array.isArray(value)) {
    const t = String((value as { text: string }).text ?? "");
    return <pre className="whitespace-pre-wrap break-words text-[9px] leading-relaxed font-mono">{t}</pre>;
  }

  // Dataset entries (array or single) -> compact summary + count.
  const entries = asEntries(value);
  if (entries.length > 0) {
    const totalReviews = entries.reduce((s, e) => s + (e.reviews?.length ?? 0), 0);
    return (
      <div className="space-y-1">
        <p className="text-[9px] font-medium text-foreground">{entries.length} app(s) · {totalReviews} reviews</p>
        <ul className="space-y-0.5">
          {entries.slice(0, 12).map((e) => (
            <li key={`${e.app.store}:${e.app.id}`} className="flex items-center gap-1 text-[9px]">
              <span className={`h-1.5 w-1.5 rounded-full ${e.app.store === "apple" ? "bg-sky-500" : "bg-emerald-500"}`} />
              <span className="truncate">{e.app.name}</span>
              <span className="text-muted-foreground/60 shrink-0">{e.reviews.length}</span>
            </li>
          ))}
          {entries.length > 12 && <li className="text-[9px] text-muted-foreground italic">+{entries.length - 12}…</li>}
        </ul>
      </div>
    );
  }

  // Fallback: raw JSON preview.
  return (
    <pre className="whitespace-pre-wrap break-words text-[9px] leading-relaxed font-mono">
      {safeStringify(value)}
    </pre>
  );
}

function ChartTitle({ children }: { children?: string }) {
  if (!children) return null;
  return <p className="text-[9px] font-medium text-muted-foreground mb-1">{children}</p>;
}

function ChartOutput({ value }: { value: { chart: string; data: unknown[]; title?: string; xKey?: string; yKey?: string } }) {
  const { chart, data, title, xKey, yKey } = value;
  if (!Array.isArray(data) || data.length === 0) return <p className="text-[10px] italic text-muted-foreground">Sem dados.</p>;

  if (chart === "wordcloud") {
    const words = (data as { text: string; value: number }[]).filter((d) => d.text);
    if (words.length === 0) return <p className="text-[10px] italic text-muted-foreground">Sem termos.</p>;
    const max = Math.max(...words.map((w) => w.value));
    return (
      <div>
        <ChartTitle>{title}</ChartTitle>
        <div className="flex flex-wrap gap-x-2 gap-y-1 items-baseline">
          {words.map((w, i) => (
            <span key={w.text + i} style={{ fontSize: `${10 + (w.value / max) * 14}px` }} className="text-foreground/80 font-medium leading-none">
              {w.text}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (chart === "pie") {
    const rows = data as { name: string; value: number }[];
    return (
      <div>
        <ChartTitle>{title}</ChartTitle>
        <div className="h-44 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={rows} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false} fontSize={8}>
                {rows.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  if (chart === "line") {
    const rows = data as Record<string, unknown>[];
    const xk = xKey ?? Object.keys(rows[0] ?? {}).find((k) => k !== "avgRating") ?? "month";
    return (
      <div>
        <ChartTitle>{title}</ChartTitle>
        <div className="h-44 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
              <defs>
                <linearGradient id="cnvGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={PALETTE[0]} stopOpacity={0.6} />
                  <stop offset="95%" stopColor={PALETTE[0]} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis dataKey={xk} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} width={28} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Area type="monotone" dataKey="avgRating" stroke={PALETTE[0]} fill="url(#cnvGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="count" stroke={PALETTE[1]} fill="transparent" strokeWidth={1.5} strokeDasharray="3 3" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  if (chart === "bar-h") {
    const rows = data as Record<string, unknown>[];
    const lk = xKey ?? "name";
    const vk = yKey ?? "reviews";
    return (
      <div>
        <ChartTitle>{title}</ChartTitle>
        <div className="h-44 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={rows} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey={lk} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} width={70} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey={vk} radius={[0, 3, 3, 0]}>
                {rows.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  if (chart === "scatter") {
    const rows = data as { name?: string; x: number; y: number; z?: number }[];
    return (
      <div>
        <ChartTitle>{title}</ChartTitle>
        <div className="h-44 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis type="number" dataKey="x" name="x" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis type="number" dataKey="y" name="y" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} width={28} />
              <ZAxis type="number" dataKey="z" range={[40, 200]} name="reviews" />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ strokeDasharray: "3 3" }} />
              <Scatter data={rows} fill={PALETTE[0]}>
                {rows.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  if (chart === "heatmap") {
    // data: [{ label: "App", "1★": n, "2★": n, ... }] — cells colored by intensity.
    const rows = data as Record<string, unknown>[];
    if (rows.length === 0) return <p className="text-[10px] italic text-muted-foreground">Sem dados.</p>;
    const cols = Object.keys(rows[0]).filter((k) => k !== "label");
    const max = Math.max(1, ...rows.flatMap((r) => cols.map((c) => Number(r[c]) || 0)));
    const heat = (v: number) => {
      const t = v / max;
      // violet intensity
      return `rgba(167, 139, 250, ${0.1 + t * 0.85})`;
    };
    return (
      <div>
        <ChartTitle>{title}</ChartTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-[9px] border-collapse">
            <thead>
              <tr>
                <th className="px-1 py-0.5 text-left font-medium text-muted-foreground sticky left-0 bg-card">App</th>
                {cols.map((c) => <th key={c} className="px-1 py-0.5 text-center font-medium text-muted-foreground">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="px-1 py-0.5 truncate max-w-[70px] text-foreground/80 sticky left-0 bg-card">{String(r.label ?? "—")}</td>
                  {cols.map((c) => {
                    const v = Number(r[c]) || 0;
                    return (
                      <td key={c} className="px-1 py-0.5 text-center" style={{ background: heat(v) }} title={`${r.label} · ${c}: ${v}`}>
                        {v || ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (chart === "country") {
    // Horizontal bar of reviews by country.
    const rows = (data as { country: string; count: number }[]).slice(0, 15);
    return (
      <div>
        <ChartTitle>{title}</ChartTitle>
        <div className="h-44 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={rows} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="country" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} width={40} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                {rows.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  // Default: vertical bar (rating distribution, version breakdown).
  const rows = data as Record<string, unknown>[];
  const xk = xKey ?? "rating";
  const vk = yKey ?? "count";
  const useRatingColors = rows.every((r) => typeof r[xk] === "string" && String(r[xk]).includes("★"));
  return (
    <div>
      <ChartTitle>{title}</ChartTitle>
      <div className="h-44 -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
            <XAxis dataKey={xk} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} width={24} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey={vk} radius={[2, 2, 0, 0]}>
              {rows.map((r, i) => {
                const key = String(r[xk] ?? i);
                const fill = useRatingColors ? (RATING_COLORS[key] ?? PALETTE[i % PALETTE.length]) : PALETTE[i % PALETTE.length];
                return <Cell key={i} fill={fill} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function DashboardOutput({ value }: { value: { kpis: Record<string, number | string | null>; charts: { chart: string; data: unknown[]; title?: string; xKey?: string; yKey?: string }[] } }) {
  const k = value.kpis;
  const kpiRows: { label: string; v: string | number | null }[] = [
    { label: "Apps", v: k.totalApps },
    { label: "Reviews", v: k.totalReviews },
    { label: "Nota média", v: k.avgRating },
    { label: "Positivo %", v: k.positivePct },
    { label: "Negativo %", v: k.negativePct },
    { label: "Lojas", v: k.storeCount },
  ].filter((r) => r.v != null);
  return (
    <div className="space-y-2">
      {kpiRows.length > 0 && (
        <div className="grid grid-cols-3 gap-1">
          {kpiRows.map((r) => (
            <div key={r.label} className="rounded-md border border-border/40 bg-background/50 px-1.5 py-1 text-center">
              <p className="text-[8px] uppercase tracking-wide text-muted-foreground">{r.label}</p>
              <p className="text-sm font-semibold text-foreground">{String(r.v)}</p>
            </div>
          ))}
        </div>
      )}
      {value.charts.map((c, i) => (
        <ChartOutput key={i} value={c} />
      ))}
    </div>
  );
}

type Entry = { app: { store: string; id: string; name: string }; reviews: unknown[] };

function asEntries(v: unknown): Entry[] {
  const wrap = (e: unknown): Entry[] => (e && typeof e === "object" && "app" in (e as object) ? [e as Entry] : []);
  if (Array.isArray(v)) return v.flatMap((x) => wrap(x));
  return wrap(v);
}

function safeStringify(v: unknown): string {
  try {
    const s = JSON.stringify(v, null, 2);
    return s.length > 800 ? s.slice(0, 800) + "\n…" : s;
  } catch {
    return String(v);
  }
}
