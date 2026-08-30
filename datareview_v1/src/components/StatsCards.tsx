import { Star, MessageSquare, TrendingUp, Users } from "lucide-react";
import type { AppInfo, ReviewEntry } from "@/lib/appStoreApi";

interface StatsCardsProps {
  app: AppInfo;
  reviews: ReviewEntry[];
}

export function StatsCards({ app, reviews }: StatsCardsProps) {
  const avgReviewRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  const positivePercent = reviews.length > 0
    ? Math.round((reviews.filter(r => r.rating >= 4).length / reviews.length) * 100)
    : 0;

  const stats = [
    {
      label: "Nota Média (Loja)",
      value: app.rating.toFixed(1),
      icon: Star,
      color: "text-star",
    },
    {
      label: "Total Avaliações",
      value: app.ratingCount.toLocaleString("pt-BR"),
      icon: Users,
      color: "text-primary",
    },
    {
      label: "Nota Reviews Coletados",
      value: avgReviewRating.toFixed(1),
      icon: TrendingUp,
      color: "text-success",
    },
    {
      label: "Reviews Positivos",
      value: `${positivePercent}%`,
      icon: MessageSquare,
      color: "text-warning",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((s, i) => (
        <div
          key={s.label}
          className="glass-card rounded-xl p-4 animate-fade-in-up"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div className="flex items-center gap-2 mb-2">
            <s.icon className={`h-4 w-4 ${s.color}`} />
            <span className="text-xs text-muted-foreground">{s.label}</span>
          </div>
          <p className="text-2xl font-bold text-card-foreground">{s.value}</p>
        </div>
      ))}
    </div>
  );
}
