/**
 * HomeMobileFirst — a Home real, mobile-first, da plataforma..
 *
 * Conteúdo verdadeiro(saudação pela hora do dia, KPIs ao vivo do dataset
 * local, empty state honesto com QuickCollect embutida, ações rápidas
 * tocáveis e seções de navegação por área). Coluna única no mobile,
 * grids responsivos no maior..
 *
 * A11y: landmarks(top-level `main`/`nav`), aria-labels contextuais,
 * foco visível(`:focus-visible` do design system) e motion que respeita
 * `prefers-reduced-motion`(via useReveal/useCountUp do sistema)..
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, Download, Gauge, MessageSquare, ChevronRight, Settings2,
  Smartphone, Database, Star, ThumbsUp, Clock, Sparkles, Zap,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { useDataset } from "@/hooks/useDataset";
import { computeKPIs, type DashboardKPIs } from "@/lib/dashboardAnalytics";
import {
  greetingForDate, formatCompact, quickActions, homeSections,
  type QuickActionSpec, type HomeLinkSectionSpec,
} from "@/lib/home/homeMobileFirst";
import { useCountUp, useReveal } from "@/lib/pageFeatures";
const ACTION_ICONS: Record<string, LucideIcon> = {
  download: Download,
  search: Search, gauge: Gauge, message: MessageSquare,
};

function ClockIcon() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <Clock className="h-3 w-3" />
      {now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
    </span>
  );
}
function QuickActionCard({ action }: { action: QuickActionSpec }) {
  const navigate = useNavigate();
  const Icon = ACTION_ICONS[action.icon] ?? Search;
  const cls = action.primary
    ? "border-primary/30 bg-primary/5 text-foreground"
    : "border-border bg-card text-muted-foreground";
  return (
    <button
      type="button"
      onClick={() => navigate(action.path)}
      className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring ${cls}`}
      aria-label={`${action.title} — ${action.desc}`}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="text-sm font-semibold text-foreground">{action.title}</span>
      {action.desc ? (
        <span className="text-xs text-muted-foreground leading-snug">{action.desc}</span>
      ) : null}
    </button>
  );
}

interface KpiCardProps {
  label: string;
  value: number;
  sub?: string;
  icon: LucideIcon;
  accent?: "primary" | "success" | "warning" | "neutral";
}
function KpiCard({ label, value, sub, icon: Icon, accent = "neutral" }: KpiCardProps) {
  const animated = useCountUp(value);
  const accents = {
    primary: "text-primary",
    success: "text-emerald-600 dark:text-emerald-400",
    warning: "text-amber-600 dark:text-amber-400",
    neutral: "text-foreground",
  };
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex h-full flex-col justify-between gap-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
          <Icon className={`h-4 w-4 shrink-0 ${accents[accent]}`} aria-hidden="true" />
        </div>
        <p className="text-lg font-bold leading-none text-foreground tabular-nums">
          {formatCompact(animated)}
        </p>
        {sub ? <p className="text-[11px] leading-snug text-muted-foreground">{sub}</p> : null}
      </CardContent>
    </Card>
  );
}
export function HomeMobileFirst() {
  const { entries } = useDataset();
  const reviews = useMemo(() => entries.flatMap((e) => e.reviews), [entries]);
  const kpis = useMemo(() => computeKPIs(reviews, entries), [reviews, entries]);
  const total = entries.length;
  const today = new Date();
  const dateLabel = today.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const empty = total === 0;

  const countLabel = empty
    ? "Seu espaço de análise de apps"
    : total ===  1
      ? "1 app coletado — tudo pronto para explorar"
      : `${total} apps coletados — tudo pronto para explorar`;
  const cards =
    empty || kpis.totalReviews === 0
      ? []
      : [
          { label: "Apps", value: kpis.totalApps, sub: kpis.storeCount > 0 ? `${kpis.storeCount} ${kpis.storeCount === 1 ? "loja" : "lojas"}` : "Apple e Google", icon: Smartphone, accent: "primary" as const },
          { label: "Reviews", value: kpis.totalReviews, sub: "guardados no seu navegador", icon: Database, accent: "success" as const },
          { label: "Nota média", value: Math.round(kpis.avgRating * 20) / 20, sub: "de 1 a 5", icon: Star, accent: "warning" as const },
          { label: "Positividade", value: kpis.positivePct, sub: "avaliações 4-5", icon: ThumbsUp, accent: "primary" as const },
        ];

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-10 pt-4 anim-fade-in" aria-label="Página inicial">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {dateLabel}
          </p>
          <h1 className="mt-0.5 truncate text-xl font-semibold text-foreground">
            {greetingForDate(today)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{countLabel}</p>
        </div>
        <ClockIcon aria-hidden="true" />
      </header>
      {empty ? (
        <section aria-label="Comece por aqui" className="mt-6">
          <EmptyState
            icon={Sparkles}
            title="Nada coletado ainda"
            description="Colete seus primeiros reviews da Apple App Store e do Google Play para ver KPIs, gráficos e análises de IA aqui."
            collect
          />
        </section>
      ) : (
        <section aria-label="Métricas do seu dataset" className="mt-6">
          <div className="grid grid-cols-2 gap-3">
            {cards.map((c) => (
              <KpiCard key={c.label} label={c.label} value={c.value} sub={c.sub} icon={c.icon} accent={c.accent} />
            ))}
          </div>
        </section>
      )}
      <section aria-label="Ações rápidas" className="mt-8">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Zap className="h-4 w-4" aria-hidden="true" />
          Ações rápidas
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {quickActions().map((action) => (
            <QuickActionCard key={action.id} action={action} />
          ))}
        </div>
      </section>
      <section aria-label="Navegação por área" className="mt-8 space-y-6">
        {homeSections().map((section) => (
          <div key={section.id}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {section.title}
            </h2>
            <ul className="mt-2 divide-y divide-border rounded-xl border border-border bg-card">
              {section.links.map((link) => (
                <li key={link.path}>
                  <a
                    href={link.path}
                    className="flex items-center justify-between gap-2 px-4 py-3 active:bg-muted/50"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">{link.label}</span>
                      {link.hint ? (
                        <span className="block truncate text-xs text-muted-foreground">{link.hint}</span>
                      ) : null}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </main>
  );
}
