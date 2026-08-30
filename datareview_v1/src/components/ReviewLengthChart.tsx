import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { ReviewEntry } from "@/lib/appStoreApi";

interface Props {
  reviews: ReviewEntry[];
}

export function ReviewLengthChart({ reviews }: Props) {
  if (reviews.length === 0) return null;

  const buckets = [
    { label: "< 50 chars", min: 0, max: 50 },
    { label: "50-150", min: 50, max: 150 },
    { label: "150-300", min: 150, max: 300 },
    { label: "300-500", min: 300, max: 500 },
    { label: "> 500", min: 500, max: Infinity },
  ];

  const data = buckets.map(b => ({
    label: b.label,
    count: reviews.filter(r => r.text.length >= b.min && r.text.length < b.max).length,
  }));

  return (
    <div className="glass-card rounded-xl p-6 animate-fade-in-up">
      <h3 className="font-semibold text-card-foreground mb-4">Tamanho dos Reviews</h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: 0, right: 10 }}>
            <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                color: "hsl(var(--card-foreground))",
              }}
            />
            <Bar dataKey="count" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
