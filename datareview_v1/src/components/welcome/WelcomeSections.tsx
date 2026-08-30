import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Download, Layers, Gauge, Sparkles, Waypoints, Presentation, ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { useCountUp, useReveal } from "@/lib/pageFeatures";
import { useDataset } from "@/hooks/useDataset";
import { PAGES } from "@/lib/pages";
import { UNI_SOURCE_META } from "@/lib/uni/types";
import { WELCOME_CAPABILITIES, welcomeStats, type WelcomeCapability } from "@/lib/welcome/welcomeCapabilities";

const CAP_ICON: Record<string, LucideIcon> = {
  collect: Download,
  multisource: Layers,
  noai: Gauge,
  ai: Sparkles,
  flow: Waypoints,
  present: Presentation,
};

function StatCell({ label, value, emptyHint }: { label: string; value: number; emptyHint?: string }) {
  const animated = useCountUp(value, 900);
  return (
    <div className="rounded-xl border border-border bg-card/60 px-4 py-3 text-center">
      <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground sm:text-3xl">
        {animated.toLocaleString("pt-BR")}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {label}
        {value === 0 && emptyHint ? <span className="block text-[11px] opacity-80">({emptyHint})</span> : null}
      </p>
    </div>
  );
}

/** Números vivos do sistema — apps/reviews do dataset + contagens dos registries. */
export function WelcomeLiveStats() {
  const dataset = useDataset();
  const totalReviews = useMemo(
    () => dataset.entries.reduce((s, e) => s + e.reviews.length, 0),
    [dataset.entries],
  );
  const stats = welcomeStats({
    apps: dataset.entries.length,
    reviews: totalReviews,
    pages: PAGES.filter((p) => !p.external).length,
    sources: Object.keys(UNI_SOURCE_META).length,
  });
  return (
    <section id="welcome-stats" className="w-full max-w-3xl scroll-mt-20" aria-label="O sistema em números">
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
        O sistema em números — ao vivo
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" role="status">
        {stats.map((s) => (
          <StatCell key={s.id} label={s.label} value={s.value} emptyHint={s.emptyHint} />
        ))}
      </div>
    </section>
  );
}

function CapabilityCard({ cap, index }: { cap: WelcomeCapability; index: number }) {
  const navigate = useNavigate();
  const { ref, shown } = useReveal<HTMLButtonElement>(0.1);
  const Icon = CAP_ICON[cap.id] ?? Sparkles;
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => navigate(cap.path)}
      className={`interactive group flex flex-col gap-2 rounded-xl border border-border bg-card/60 p-4 text-left transition-all duration-500 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
        shown ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
      }`}
      style={{ transitionDelay: shown ? `${index * 70}ms` : "0ms" }}
      aria-label={`${cap.title} — abrir página`}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/12 text-primary" aria-hidden="true">
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-sm font-medium text-foreground">{cap.title}</span>
      <span className="text-xs leading-relaxed text-muted-foreground">{cap.desc}</span>
      <span className="mt-auto inline-flex items-center gap-1 pt-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        Explorar
        <ChevronRight className="h-3 w-3" aria-hidden="true" />
      </span>
    </button>
  );
}

/** Tour das 6 capacidades vitrine — cards que revelam ao entrar na tela. */
export function WelcomeCapabilityTour() {
  return (
    <section id="welcome-tour" className="w-full max-w-3xl scroll-mt-20" aria-label="Tour de capacidades">
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
        O que este sistema faz de melhor
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {WELCOME_CAPABILITIES.map((cap, i) => (
          <CapabilityCard key={cap.id} cap={cap} index={i} />
        ))}
      </div>
    </section>
  );
}
