import type { ReviewEntry } from "@/lib/appStoreApi";

interface RatingBreakdownProps {
  reviews: ReviewEntry[];
}

const BAR_COLORS = [
  "bg-destructive",
  "bg-warning",
  "bg-warning",
  "bg-success",
  "bg-success",
];

export function RatingBreakdown({ reviews }: RatingBreakdownProps) {
  const total = reviews.length;
  const dist = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));
  const max = Math.max(...dist.map((d) => d.count), 1);

  return (
    <div className="glass-card rounded-xl p-6 animate-fade-in-up">
      <h3 className="font-semibold text-card-foreground mb-4">Breakdown por Nota</h3>
      <div className="space-y-3">
        {dist.map((d) => (
          <div key={d.star} className="flex items-center gap-3">
            <span className="text-sm font-medium text-card-foreground w-8">★{d.star}</span>
            <div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${BAR_COLORS[d.star - 1]}`}
                style={{ width: `${(d.count / max) * 100}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground w-16 text-right">
              {d.count} ({total > 0 ? Math.round((d.count / total) * 100) : 0}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
