import { useState } from "react";
import { Star, Filter } from "lucide-react";
import type { ReviewEntry } from "@/lib/appStoreApi";

interface ReviewsListProps {
  reviews: ReviewEntry[];
}

export function ReviewsList({ reviews }: ReviewsListProps) {
  const [filterRating, setFilterRating] = useState<number | null>(null);

  const filtered = filterRating
    ? reviews.filter((r) => r.rating === filterRating)
    : reviews;

  return (
    <div className="glass-card rounded-xl p-6 animate-fade-in-up">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="font-semibold text-card-foreground">
          Reviews ({filtered.length})
        </h3>
        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <button
            onClick={() => setFilterRating(null)}
            className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
              filterRating === null
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            Todos
          </button>
          {[5, 4, 3, 2, 1].map((r) => (
            <button
              key={r}
              onClick={() => setFilterRating(filterRating === r ? null : r)}
              className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                filterRating === r
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              ★{r}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">
            Nenhum review encontrado
          </p>
        ) : (
          filtered.slice(0, 100).map((review) => (
            <div
              key={review.id}
              className="p-3 rounded-lg bg-secondary/50 border border-border/30"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`h-3 w-3 ${
                          s <= review.rating
                            ? "fill-star text-star"
                            : "text-muted-foreground/30"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-medium text-card-foreground">
                    {review.author}
                  </span>
                </div>
                {review.date && (
                  <span className="text-xs text-muted-foreground">
                    {new Date(review.date).toLocaleDateString("pt-BR")}
                  </span>
                )}
              </div>
              {review.title && (
                <p className="text-sm font-medium text-card-foreground mb-0.5">
                  {review.title}
                </p>
              )}
              <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                {review.text}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
