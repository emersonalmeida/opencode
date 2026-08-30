import { useEffect, useState } from "react";
import { Star, ExternalLink, Apple, ShoppingBag, Check } from "lucide-react";
import type { AppInfo } from "@/lib/appStoreApi";
import { hasDataset, subscribeDataset } from "@/lib/datasetStore";

interface AppCardProps {
  app: AppInfo;
  isSelected: boolean;
  onClick: () => void;
}

export function AppCard({ app, isSelected, onClick }: AppCardProps) {
  const [collected, setCollected] = useState<boolean>(() => hasDataset(app.store, app.id));
  useEffect(() => subscribeDataset(() => setCollected(hasDataset(app.store, app.id))), [app.store, app.id]);

  return (
    <button
      onClick={onClick}
      className={`glass-card rounded-xl p-4 text-left transition-all duration-200 hover:shadow-md w-full ${
        isSelected ? "ring-2 ring-primary stat-glow" : "hover:border-primary/30"
      }`}
    >
      <div className="flex gap-3 items-start">
        {app.icon ? (
          <img
            src={app.icon}
            alt={app.name}
            className="w-14 h-14 rounded-xl shadow-sm flex-shrink-0"
          />
        ) : (
          <div className="w-14 h-14 rounded-xl shadow-sm flex-shrink-0 bg-secondary flex items-center justify-center">
            {app.store === "apple" ? (
              <Apple className="h-6 w-6 text-muted-foreground" />
            ) : (
              <ShoppingBag className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="font-semibold text-card-foreground truncate">{app.name}</h3>
            {collected && (
              <span
                title="Já coletado — reviews disponíveis localmente"
                className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full shrink-0"
              >
                <Check className="h-2.5 w-2.5" /> Coletado
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground truncate">{app.developer || "—"}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-star text-star" />
              <span className="text-sm font-medium text-card-foreground">
                {app.rating > 0 ? app.rating.toFixed(1) : "—"}
              </span>
            </div>
            {app.ratingCount > 0 && (
              <span className="text-xs text-muted-foreground">
                ({app.ratingCount.toLocaleString("pt-BR")} avaliações)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              app.store === "apple"
                ? "bg-secondary text-secondary-foreground"
                : "bg-accent/10 text-accent"
            }`}>
              {app.store === "apple" ? "App Store" : "Google Play"}
            </span>
            {app.genre && (
              <span className="text-xs text-muted-foreground">{app.genre}</span>
            )}
            <span className="text-xs text-muted-foreground">{app.price}</span>
          </div>
        </div>
        <a
          href={app.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-muted-foreground hover:text-primary transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </button>
  );
}
