import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { ReviewEntry } from "@/lib/appStoreApi";

interface ReviewTimelineProps {
  reviews: ReviewEntry[];
}

export function ReviewTimeline({ reviews }: ReviewTimelineProps) {
  const dated = reviews
    .filter(r => r.date)
    .map(r => ({ ...r, dateObj: new Date(r.date) }))
    .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

  if (dated.length < 3) return null;

  // Group by month
  const byMonth: Record<string, { ratings: number[]; count: number }> = {};
  dated.forEach(r => {
    const key = `${r.dateObj.getFullYear()}-${String(r.dateObj.getMonth() + 1).padStart(2, "0")}`;
    if (!byMonth[key]) byMonth[key] = { ratings: [], count: 0 };
    byMonth[key].ratings.push(r.rating);
    byMonth[key].count++;
  });

  const data = Object.entries(byMonth).map(([month, d]) => ({
    month,
    avgRating: +(d.ratings.reduce((a, b) => a + b, 0) / d.ratings.length).toFixed(2),
    count: d.count,
  }));

  return (
    <div className="glass-card rounded-xl p-6 animate-fade-in-up">
      <h3 className="font-semibold text-card-foreground mb-4">Evolução Temporal das Avaliações</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 0, right: 20, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
            <YAxis domain={[0, 5]} stroke="hsl(var(--muted-foreground))" fontSize={11} />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                color: "hsl(var(--card-foreground))",
              }}
              formatter={(value: number, name: string) => [
                name === "avgRating" ? `${value} ★` : value,
                name === "avgRating" ? "Nota Média" : "Reviews",
              ]}
            />
            <Line type="monotone" dataKey="avgRating" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3, fill: "hsl(var(--primary))" }} />
            <Line type="monotone" dataKey="count" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ r: 3, fill: "hsl(var(--accent))" }} yAxisId={0} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
