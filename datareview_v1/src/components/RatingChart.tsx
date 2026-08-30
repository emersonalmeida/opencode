import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { ReviewEntry } from "@/lib/appStoreApi";

interface RatingChartProps {
  reviews: ReviewEntry[];
}

const COLORS = [
  "hsl(0, 75%, 55%)",
  "hsl(25, 90%, 55%)",
  "hsl(36, 95%, 55%)",
  "hsl(80, 60%, 45%)",
  "hsl(160, 70%, 45%)",
];

export function RatingChart({ reviews }: RatingChartProps) {
  const distribution = [1, 2, 3, 4, 5].map((star) => ({
    star: `★${star}`,
    count: reviews.filter((r) => r.rating === star).length,
    rating: star,
  }));

  return (
    <div className="glass-card rounded-xl p-6 animate-fade-in-up">
      <h3 className="font-semibold text-card-foreground mb-4">Distribuição de Avaliações</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={distribution} layout="vertical" margin={{ left: 10, right: 20 }}>
            <XAxis type="number" stroke="hsl(220, 10%, 46%)" fontSize={12} />
            <YAxis
              dataKey="star"
              type="category"
              stroke="hsl(220, 10%, 46%)"
              fontSize={14}
              width={40}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(224, 25%, 11%)",
                border: "1px solid hsl(224, 15%, 18%)",
                borderRadius: "8px",
                color: "hsl(210, 20%, 92%)",
              }}
              formatter={(value: number) => [`${value} reviews`, "Quantidade"]}
            />
            <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={28}>
              {distribution.map((entry) => (
                <Cell key={entry.rating} fill={COLORS[entry.rating - 1]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
