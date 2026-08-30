/**
 * Componentes de gráfico agregados para o Dashboard.
 * Cada um recebe dados pré-computados (de dashboardAnalytics) e renderiza
 * um gráfico recharts com tooltip estilizado e tema consistente.
 */
import { type LucideIcon } from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import type {
  PerAppStat,
  ReviewReviewWithContext,
} from "@/lib/dashboardAnalytics";
import { RATING_SCALE as RATING_COLORS } from "@/lib/chartColors";

const TOOLTIP_STYLE = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  color: "hsl(var(--card-foreground))",
  fontSize: "11px",
} as const;

const AXIS_STYLE = { stroke: "hsl(var(--muted-foreground))", fontSize: 11 } as const;

const SENTIMENT_COLORS = ["hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--destructive))"];

/* ------------------------------------------------ Rating distribution --- */

export function AggregateRatingChart({ data }: { data: { star: string; count: number }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
        <XAxis dataKey="star" {...AXIS_STYLE} tickLine={false} axisLine={false} />
        <YAxis {...AXIS_STYLE} tickLine={false} axisLine={false} width={36} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
          formatter={(value: number) => [`${value} (${total ? Math.round((value / total) * 100) : 0}%)`, "Reviews"]}
        />
        <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={64}>
          {data.map((_, i) => (
            <Cell key={i} fill={RATING_COLORS[i]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------- Sentiment pie --- */

export function AggregateSentimentChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={80}
          innerRadius={48}
          paddingAngle={3}
          label={({ percent }: { percent?: number }) => (percent ? `${(percent * 100).toFixed(0)}%` : "")}
          labelLine={false}
          fontSize={11}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={SENTIMENT_COLORS[i % SENTIMENT_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: number) => [`${value} reviews`, ""]} />
        <Legend wrapperStyle={{ fontSize: "11px" }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

/* --------------------------------------------------------- Timeline --- */

export function AggregateTimelineChart({
  data,
}: {
  data: { month: string; avgRating: number; count: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
        <defs>
          <linearGradient id="colorRating" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
        <XAxis dataKey="month" {...AXIS_STYLE} tickLine={false} axisLine={false} />
        <YAxis yAxisId="left" domain={[0, 5]} {...AXIS_STYLE} tickLine={false} axisLine={false} width={36} />
        <YAxis yAxisId="right" orientation="right" {...AXIS_STYLE} tickLine={false} axisLine={false} width={36} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: "11px" }} />
        <Area
          yAxisId="left"
          type="monotone"
          dataKey="avgRating"
          name="Nota média"
          stroke="hsl(var(--chart-1))"
          strokeWidth={2}
          fill="url(#colorRating)"
          dot={{ r: 3, fill: "hsl(var(--chart-1))" }}
        />
        <Area
          yAxisId="right"
          type="monotone"
          dataKey="count"
          name="Nº de reviews"
          stroke="hsl(var(--chart-2))"
          strokeWidth={2}
          fill="url(#colorCount)"
          dot={{ r: 3, fill: "hsl(var(--chart-2))" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------- Store comparison --- */

export function StoreComparisonChart({
  data,
}: {
  data: { shortName: string; reviews: number; avgRating: number; positivePct: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
        <XAxis dataKey="shortName" {...AXIS_STYLE} tickLine={false} axisLine={false} />
        <YAxis {...AXIS_STYLE} tickLine={false} axisLine={false} width={40} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
          formatter={(value: number, name: string) => {
            if (name === "avgRating") return [value.toFixed(2) + " ★", "Nota média"];
            if (name === "positivePct") return [value + "%", "% positivo"];
            return [value, "Reviews"];
          }}
        />
        <Legend wrapperStyle={{ fontSize: "11px" }} formatter={(v: string) => (v === "avgRating" ? "Nota média" : v === "positivePct" ? "% positivo" : "Reviews")} />
        <Bar dataKey="reviews" name="Reviews" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} maxBarSize={48} />
        <Bar dataKey="avgRating" name="Nota média" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} maxBarSize={48} />
        <Bar dataKey="positivePct" name="% positivo" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* --------------------------------------------------- Version analysis --- */

export function VersionAnalysisChart({
  data,
}: {
  data: { version: string; count: number; avgRating: number }[];
}) {
  if (data.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} horizontal={false} />
        <XAxis type="number" {...AXIS_STYLE} tickLine={false} axisLine={false} />
        <YAxis dataKey="version" type="category" {...AXIS_STYLE} tickLine={false} axisLine={false} width={80} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
          formatter={(value: number, name: string) =>
            name === "avgRating" ? [value.toFixed(2) + " ★", "Nota média"] : [value, "Reviews"]
          }
        />
        <Legend wrapperStyle={{ fontSize: "11px" }} formatter={(v: string) => (v === "avgRating" ? "Nota média" : "Reviews")} />
        <Bar dataKey="count" name="Reviews" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} maxBarSize={24} />
        <Bar dataKey="avgRating" name="Nota média" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------- KPI card --- */

export function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = "primary",
  delay = 0,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  accent?: "primary" | "success" | "warning" | "destructive";
  delay?: number;
}) {
  const accentClasses = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    destructive: "bg-destructive/10 text-destructive",
  } as const;
  return (
    <div
      className="glass-card rounded-xl p-4 animate-fade-in-up stat-glow"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${accentClasses[accent]}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <p className="text-xl font-bold text-foreground leading-none">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-1.5">{sub}</p>}
    </div>
  );
}

/* ------------------------------------------------ Per-app table row --- */

export function PerAppRow({ stat }: { stat: PerAppStat }) {
  return (
    <tr className="border-b border-border/40 hover:bg-secondary/30 transition-colors">
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <img src={stat.icon} alt="" className="w-7 h-7 rounded-md object-cover shrink-0" />
          <span className="text-xs font-medium text-foreground truncate max-w-[180px]">{stat.name}</span>
        </div>
      </td>
      <td className="px-3 py-2.5 text-center">
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${stat.store === "apple" ? "bg-muted text-foreground" : "bg-primary/10 text-primary"}`}>
          {stat.store === "apple" ? "Apple" : "Google"}
        </span>
      </td>
      <td className="px-3 py-2.5 text-center text-xs text-foreground font-semibold">{stat.rating ? stat.rating.toFixed(1) : "—"}</td>
      <td className="px-3 py-2.5 text-center text-xs text-muted-foreground">{stat.ratingCount ? stat.ratingCount.toLocaleString("pt-BR") : "—"}</td>
      <td className="px-3 py-2.5 text-center text-xs text-foreground font-semibold">{stat.avgCollected ? stat.avgCollected.toFixed(2) : "—"}</td>
      <td className="px-3 py-2.5 text-center">
        <span className="text-xs font-semibold text-success">{stat.positivePct}%</span>
      </td>
      <td className="px-3 py-2.5 text-center">
        <span className="text-xs font-semibold text-destructive">{stat.negativePct}%</span>
      </td>
      <td className="px-3 py-2.5 text-center text-xs text-muted-foreground">{stat.withReply}</td>
      <td className="px-3 py-2.5">
        <div className="flex flex-wrap gap-1 max-w-[200px]">
          {stat.topThemes.slice(0, 3).map(([w, c]) => (
            <span key={w} className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary text-secondary-foreground" title={`${c} menções`}>
              {w}
            </span>
          ))}
        </div>
      </td>
    </tr>
  );
}

/* -------------------------------------------------- Recent review item --- */

export function RecentReviewItem({ review }: { review: ReviewReviewWithContext }) {
  const isPositive = review.rating >= 4;
  const isNegative = review.rating <= 2;
  const date = review.date ? new Date(review.date).toLocaleDateString("pt-BR") : "—";
  return (
    <div className="rounded-lg border border-border/40 p-3 hover:bg-secondary/30 transition-colors">
      <div className="flex items-start gap-2.5">
        <img src={review.appIcon} alt="" className="w-6 h-6 rounded object-cover shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-foreground truncate">{review.appName}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
              isPositive ? "bg-success/10 text-success" : isNegative ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"
            }`}>
              ★{review.rating}
            </span>
            <span className="text-[10px] text-muted-foreground">{date}</span>
            {review.version && <span className="text-[10px] text-muted-foreground">v{review.version}</span>}
          </div>
          {review.title && <p className="text-xs font-medium text-foreground/90 mt-1">{review.title}</p>}
          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{review.text}</p>
          {review.developerReply && (
            <p className="text-[10px] text-primary mt-1.5 italic border-l-2 border-primary/40 pl-2 line-clamp-1">
              ↳ {review.developerReply}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
