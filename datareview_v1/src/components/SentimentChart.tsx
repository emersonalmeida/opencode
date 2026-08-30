import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import type { ReviewEntry } from "@/lib/appStoreApi";

interface SentimentChartProps {
  reviews: ReviewEntry[];
}

export function SentimentChart({ reviews }: SentimentChartProps) {
  if (reviews.length === 0) return null;

  const positive = reviews.filter(r => r.rating >= 4).length;
  const neutral = reviews.filter(r => r.rating === 3).length;
  const negative = reviews.filter(r => r.rating <= 2).length;

  const data = [
    { name: "Positivo (★4-5)", value: positive, color: "hsl(var(--success))" },
    { name: "Neutro (★3)", value: neutral, color: "hsl(var(--warning))" },
    { name: "Negativo (★1-2)", value: negative, color: "hsl(var(--destructive))" },
  ].filter(d => d.value > 0);

  return (
    <div className="glass-card rounded-xl p-6 animate-fade-in-up">
      <h3 className="font-semibold text-card-foreground mb-4">Sentimento dos Reviews</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={3} label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={12}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                color: "hsl(var(--card-foreground))",
              }}
              formatter={(value: number) => [`${value} reviews`, ""]}
            />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
