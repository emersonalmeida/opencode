import type { ReactNode } from "react";
import type { Slide, DeckTheme } from "@/lib/presentations";
import type { DatasetEntry } from "@/lib/datasetStore";
import {
  computeRatingDistribution, computeSentiment, computeStoreComparison,
  computePerAppStats, computeWordCloud, entryKey,
} from "@/lib/dashboardAnalytics";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

/**
 * Renderiza um slide em preview (editor) e em modo apresentar.
 * É puro: depende só do slide, tema e entries do dataset no escopo.
 */
export function SlideView({
  slide, theme, entries, index, total,
}: {
  slide: Slide;
  theme: DeckTheme;
  entries: DatasetEntry[];
  index: number;
  total: number;
}) {
  const scoped = slide.appKeys?.length
    ? entries.filter((e) => slide.appKeys!.includes(entryKey(e.app.store, e.app.id)))
    : entries;
  const reviews = scoped.flatMap((e) => e.reviews);
  const fs = theme.fontScale;

  const wrap = (children: ReactNode) => (
    <div
      className="w-full h-full flex flex-col justify-center relative overflow-hidden"
      style={{ background: theme.bg, color: theme.fg, padding: "6% 8%", fontSize: `${fs}em` }}
    >
      <span
        className="absolute top-4 right-6 text-xs"
        style={{ color: theme.muted }}
        aria-hidden="true"
      >
        {index + 1}/{total}
      </span>
      {children}
    </div>
  );

  const H1 = ({ children }: { children: ReactNode }) => (
    <h1 className="font-bold leading-tight" style={{ color: theme.accent, fontSize: "2.6em" }}>{children}</h1>
  );
  const H2 = ({ children }: { children: ReactNode }) => (
    <h2 className="font-semibold" style={{ color: theme.accent, fontSize: "1.7em", marginBottom: "0.6em" }}>{children}</h2>
  );

  if (slide.type === "title" || slide.type === "section") {
    return wrap(
      <div>
        <H1>{slide.title}</H1>
        {slide.subtitle && (
          <p style={{ color: theme.muted, fontSize: "1.1em", marginTop: "0.9em" }}>{slide.subtitle}</p>
        )}
      </div>,
    );
  }

  if (slide.type === "bullets") {
    const lines = (slide.body ?? "").split("\n").filter(Boolean);
    return wrap(
      <div>
        <H2>{slide.title}</H2>
        <ul className="list-disc" style={{ fontSize: "1.05em", lineHeight: 1.8, paddingLeft: "1.3em" }}>
          {lines.map((l, i) => <li key={i}>{l}</li>)}
        </ul>
        {lines.length === 0 && <p style={{ color: theme.muted }}>Sem conteúdo.</p>}
      </div>,
    );
  }

  if (slide.type === "text") {
    return wrap(
      <div>
        <H2>{slide.title}</H2>
        <p style={{ fontSize: "0.95em", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{slide.body}</p>
      </div>,
    );
  }

  if (slide.type === "quotes") {
    const quotes = (slide.body ?? "").split("\n").filter(Boolean);
    return wrap(
      <div>
        <H2>{slide.title}</H2>
        {quotes.map((q, i) => (
          <blockquote
            key={i}
            style={{
              borderLeft: `4px solid ${theme.accent}`, paddingLeft: "1em",
              margin: "0.6em 0", fontSize: "0.92em", lineHeight: 1.55,
            }}
          >
            {q}
          </blockquote>
        ))}
      </div>,
    );
  }

  if (slide.type === "kpis") {
    const parts = Object.fromEntries(
      (slide.body ?? "").split("|").map((kv) => kv.split(":") as [string, string]),
    );
    return wrap(
      <div>
        <H2>{slide.title}</H2>
        <div className="flex flex-wrap gap-8">
          {Object.entries(parts).map(([k, v]) => (
            <div key={k} className="flex flex-col">
              <span className="font-extrabold" style={{ color: theme.accent, fontSize: "2.2em" }}>{v}</span>
              <span style={{ color: theme.muted, fontSize: "0.75em", textTransform: "uppercase", letterSpacing: "0.08em" }}>{k}</span>
            </div>
          ))}
        </div>
      </div>,
    );
  }

  if (slide.type === "chart") {
    let inner: ReactNode = null;
    if (slide.chart === "rating") {
      inner = (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={computeRatingDistribution(reviews)}>
            <XAxis dataKey="star" stroke={theme.muted} fontSize={12} />
            <YAxis stroke={theme.muted} fontSize={12} allowDecimals={false} />
            <Tooltip contentStyle={{ background: theme.bg, border: `1px solid ${theme.muted}`, color: theme.fg }} />
            <Bar dataKey="count" fill={theme.accent} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    } else if (slide.chart === "sentiment") {
      const data = computeSentiment(reviews);
      const COLORS = ["#4ade80", "#fbbf24", "#f87171"];
      inner = (
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} label>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={{ background: theme.bg, border: `1px solid ${theme.muted}`, color: theme.fg }} />
          </PieChart>
        </ResponsiveContainer>
      );
    } else if (slide.chart === "store") {
      inner = (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={computeStoreComparison(scoped)} layout="vertical">
            <XAxis type="number" stroke={theme.muted} fontSize={12} allowDecimals={false} />
            <YAxis type="category" dataKey="shortName" stroke={theme.muted} fontSize={12} width={70} />
            <Tooltip contentStyle={{ background: theme.bg, border: `1px solid ${theme.muted}`, color: theme.fg }} />
            <Bar dataKey="reviews" fill={theme.accent} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    } else if (slide.chart === "wordcloud") {
      const words = computeWordCloud(reviews, 24);
      const max = Math.max(1, ...words.map(([, c]) => c));
      inner = (
        <div className="flex flex-wrap gap-3 items-center">
          {words.map(([word, count]) => (
            <span key={word} style={{ fontSize: `${0.7 + (count / max) * 1.1}em` }}>{word}</span>
          ))}
        </div>
      );
    }
    return wrap(
      <div>
        <H2>{slide.title}</H2>
        {reviews.length === 0
          ? <p style={{ color: theme.muted }}>Sem reviews no escopo — colete apps primeiro.</p>
          : inner}
      </div>,
    );
  }

  if (slide.type === "table") {
    const stats = computePerAppStats(scoped);
    return wrap(
      <div>
        <H2>{slide.title}</H2>
        <table className="w-full" style={{ fontSize: "0.85em", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ color: theme.accent }}>
              <th className="text-left py-1.5 pr-3">App</th>
              <th className="text-right py-1.5 pr-3">Reviews</th>
              <th className="text-right py-1.5 pr-3">Nota</th>
              <th className="text-right py-1.5 pr-3">% Positivo</th>
              <th className="text-right py-1.5">% Negativo</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((st) => (
              <tr key={st.key} style={{ borderTop: `1px solid ${theme.muted}33` }}>
                <td className="py-1.5 pr-3">{st.name}</td>
                <td className="text-right py-1.5 pr-3">{st.reviewCount}</td>
                <td className="text-right py-1.5 pr-3">{st.avgCollected.toFixed(2)}</td>
                <td className="text-right py-1.5 pr-3">{st.positivePct}%</td>
                <td className="text-right py-1.5">{st.negativePct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>,
    );
  }

  return wrap(<p style={{ color: theme.muted }}>Tipo de slide desconhecido.</p>);
}
