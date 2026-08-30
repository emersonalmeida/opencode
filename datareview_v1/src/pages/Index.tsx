import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Database, MessageSquare, Apple, ShoppingBag, Sparkles, ArrowRight,
  Clock, Zap, Cpu, CloudOff, FlaskConical, Trash2, Waypoints, Play } from "lucide-react";
import { useSetAIContext } from "@/context/AIContext";
import { TopCharts } from "@/components/TopCharts";
import { HeroSection } from "@/components/HeroSection";
import { AppHeader } from "@/components/AppHeader";
import { useCompare } from "@/context/CompareContext";
import { Button } from "@/components/ui/button";
import { useDataset } from "@/hooks/useDataset";
import { useAISettings } from "@/lib/aiSettings";
import { getHistory } from "@/lib/history";
import { useCountUp, useHotkey, StatPill, useRecentItems } from "@/lib/pageFeatures";
import { EmptyState } from "@/components/shared/EmptyState";
import { loadDemoDataset, removeDemoDataset, isDemoEntry } from "@/lib/demoDataset";
import { JOURNEY_STEPS } from "@/lib/journey";
import { toastSuccess } from "@/lib/ux";
import { PAGES } from "@/lib/pages";
import { useFeatureFlags, pagePathToFlag } from "@/lib/featureFlags";

export default function Index() {
  const { entries, setPickerOpen } = useCompare();
  const navigate = useNavigate();
  const dataset = useDataset();
  const demoLoaded = dataset.entries.some((e) => isDemoEntry(e));
  const ai = useAISettings();

  const totalReviews = useMemo(
    () => dataset.entries.reduce((s, e) => s + e.reviews.length, 0),
    [dataset.entries],
  );
  const appleCount = dataset.entries.filter((e) => e.app.store === "apple").length;
  const googleCount = dataset.entries.filter((e) => e.app.store === "google").length;
  const animatedReviews = useCountUp(totalReviews);
  const animatedApps = useCountUp(dataset.entries.length);

  // Recent searches from localStorage
  const { items: recentSearchItems } = useRecentItems("aso:recent-searches:v1", 8);

  // Recently viewed from history sidebar
  const recentHistory = useMemo(() => getHistory().slice(0, 5), []);

  // F7: Keyboard shortcuts for quick navigation — one per hinted quick action.
  useHotkey("f", () => navigate("/fluxo"), []);
  useHotkey("h", () => navigate("/dashboard"), []);
  useHotkey("e", () => navigate("/experiments"), []);
  useHotkey("c", () => navigate("/chat"), []);
  useHotkey("a", () => navigate("/atlas"), []);
  useHotkey("v", () => navigate("/canvas"), []);
  useHotkey("d", () => navigate("/decision-center"), []);
  useHotkey("o", () => navigate("/concept"), []);
  useHotkey("j", () => navigate("/jornada"), []);
  useHotkey("p", () => navigate("/apresentacoes"), []);

  const aiStatus = ai.mode === "none" ? { label: "IA off", color: "text-muted-foreground", icon: CloudOff }
    : ai.mode === "auto" ? { label: "IA auto", color: "text-violet-500", icon: Sparkles }
    : ai.mode === "local" ? { label: "IA local", color: "text-emerald-500", icon: Cpu }
    : { label: "IA cloud", color: "text-sky-500", icon: Zap };

  const flags = useFeatureFlags();
  // Acesso rápido = TODAS as páginas do registry (exceto a própria Home),
  // filtradas pelas feature flags. Adicionar uma página ao registry PAGES a
  // faz aparecer aqui automaticamente — nenhuma lista duplicada para manter.
  const quickActions = useMemo(
    () =>
      PAGES.filter((p) => p.path !== "/").filter((p) => {
        const fk = pagePathToFlag(p.path);
        return !fk || flags[fk] !== false;
      }),
    [flags],
  );

  useSetAIContext(
    {
      scope: entries.length > 0 ? "compare" : "home",
      title: entries.length > 0 ? `Seleção · ${entries.length} app${entries.length > 1 ? "s" : ""}` : "Início",
      apps: entries.map(e => ({ app: e.app, reviews: e.reviews })),
    },
    [entries.length, entries.map(e => e.reviews.length).join(",")]
  );

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title="Início"
        compare={{ count: entries.length, onOpen: () => setPickerOpen(true) }}
      />
      <div className="py-10 px-8 space-y-14">
        <HeroSection />

        {/* Core loop: o produto em 6 passos (Onda 2.1). Dataset vazio = CTA
            da jornada guiada (com demo se quiser); com dados = avançar. */}
        {dataset.entries.length === 0 ? (
          <section aria-label="Como funciona" className="anim-fade-in">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Waypoints className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> O loop do sistema
              </h2>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => { loadDemoDataset(); navigate("/jornada"); }}
                >
                  <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
                  Começar com dados de exemplo
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate("/jornada")}>
                  <Play className="h-3.5 w-3.5" aria-hidden="true" /> Iniciar a jornada guiada
                </Button>
              </div>
            </div>
            <ol className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2" role="list">
              {JOURNEY_STEPS.map((step, i) => (
                <li key={step.id}>
                  <button
                    onClick={() => navigate(step.deepLink)}
                    title={`${step.desc} — Abrir: ${step.deepLinkLabel}`}
                    className="group w-full h-full flex flex-col items-start gap-1 rounded-xl border border-border/50 bg-card/60 p-3 text-left hover:border-primary/50 hover:bg-card transition-colors anim-row-in"
                    style={{ animationDelay: `${Math.min(i * 40, 240)}ms` }}
                  >
                    <span className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">{i + 1}</span>
                      {step.label}
                    </span>
                    <span className="text-[11px] leading-snug text-muted-foreground group-hover:text-foreground">{step.desc}</span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        ) : (
          <section aria-label="Próximo passo do loop" className="anim-fade-in">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm">
                <Waypoints className="mr-1.5 inline h-4 w-4 text-primary" aria-hidden="true" />
                <strong>Seu loop:</strong> dados coletados → agora <strong>analyse</strong>, <strong>visualize</strong> e <strong>decida</strong> — tudo com os mesmos dados, sem recolher.
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>Visualizar</Button>
                <Button size="sm" className="gap-1.5" onClick={() => navigate("/jornada")}>
                  <Play className="h-3.5 w-3.5" aria-hidden="true" /> Continuar o loop
                </Button>
              </div>
            </div>
          </section>
        )}

        {/* F1: Quick stats bar */}
        {dataset.entries.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 anim-fade-in">
            <StatPill icon={Database} label="apps" value={animatedApps} />
            <StatPill icon={MessageSquare} label="reviews" value={animatedReviews.toLocaleString("pt-BR")} />
            <StatPill icon={Apple} label="App Store" value={appleCount} color="var(--foreground)" />
            <StatPill icon={ShoppingBag} label="Google Play" value={googleCount} color="hsl(var(--chart-2))" />
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/60 text-xs">
              <aiStatus.icon className={`h-3 w-3 ${aiStatus.color}`} />
              <span className="text-muted-foreground">{aiStatus.label}</span>
            </span>
          </div>
        )}

        {/* F3: Quick action shortcuts */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Acesso rápido</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {quickActions.map((a, i) => (
              <button
                key={a.path}
                onClick={() => navigate(a.path)}
                title={a.hint ? `${a.label} — ${a.desc} — atalho: ${a.hint.toUpperCase()}` : `${a.label} — ${a.desc}`}
                className="group flex flex-col items-center gap-2 p-3 rounded-xl border border-border/50 bg-card/60 hover:border-primary/50 hover:bg-card hover:-translate-y-0.5 transition-all anim-row-in"
                style={{ animationDelay: `${Math.min(i * 30, 240)}ms` }}
              >
                <a.icon className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" aria-hidden="true" />
                <span className="text-xs font-medium">{a.label}</span>
                {a.hint ? (
                  <kbd className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground font-mono" aria-label={`Atalho ${a.hint}`}>{a.hint}</kbd>
                ) : (
                  <span className="h-[15px]" aria-hidden="true" />
                )}
              </button>
            ))}
          </div>
        </section>

        {/* F4: Continue de onde parou — recent history */}
        {recentHistory.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" /> Continue de onde parou
            </h2>
            <div className="flex flex-wrap gap-2">
              {recentHistory.map((h, i) => {
                const isCompare = h.type === "compare";
                const firstApp = isCompare ? h.apps[0] : { store: h.store, id: h.id, name: h.name, icon: h.icon };
                if (!firstApp) return null;
                return (
                  <button
                    key={i}
                    onClick={() => navigate(`/app/${firstApp.store}/${firstApp.id}`)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/50 bg-card/60 hover:border-primary/50 transition-colors text-xs"
                  >
                    {firstApp.icon && <img src={firstApp.icon} alt="" className="h-4 w-4 rounded" />}
                    <span className="font-medium truncate max-w-[120px]">{firstApp.name}</span>
                    {isCompare && h.apps.length > 1 && (
                      <span className="text-[9px] px-1 rounded bg-primary/15 text-primary">×{h.apps.length}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* F5: Trending/recent searches */}
        {recentSearchItems.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Buscas recentes</h2>
            <div className="flex flex-wrap gap-1.5">
              {recentSearchItems.map((s) => (
                <button
                  key={s}
                  onClick={() => navigate(`/search?q=${encodeURIComponent(s)}`)}
                  className="px-2.5 py-1 rounded-full bg-secondary/60 hover:bg-secondary text-xs transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </section>
        )}

        <TopCharts />

        {/* F6: Empty state CTA when no data — coleta inline OU demo instantâneo */}
        {dataset.entries.length === 0 && (
          <section className="rounded-2xl border border-dashed border-border/60 bg-card/30">
            <EmptyState
              icon={Database}
              title="Comece coletando apps"
              description="Busque um app aqui mesmo ou explore os Top Charts. Os dados coletados alimentam o Dashboard, Experimentos e a IA."
              collect
            />
            <div className="-mt-3 pb-5 text-center">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => { loadDemoDataset(); toastSuccess("Dados de exemplo carregados", { description: "40 reviews sintéticas do app Nubank (exemplo) — explore Dashboard, Pipeline e Fluxo sem coletar nada." }); }}
              >
                <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
                Explorar com dados de exemplo
              </Button>
            </div>
          </section>
        )}

        {/* Demo ativo: aviso + opt-out em um gesto */}
        {demoLoaded && (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-1.5 text-[11px] text-muted-foreground" role="status">
            <span>
              <FlaskConical className="mr-1 inline h-3 w-3 text-amber-500" aria-hidden="true" />
              Você está explorando com <strong>dados de exemplo</strong> (reviews sintéticas).
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
              onClick={() => { removeDemoDataset(); toastSuccess("Exemplo removido", { description: "O app demo saiu do dataset." }); }}
              aria-label="Remover dados de exemplo"
            >
              <Trash2 className="h-3 w-3" aria-hidden="true" /> Remover exemplo
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
