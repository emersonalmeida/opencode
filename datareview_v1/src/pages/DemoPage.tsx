/**
 * Demo pública (Onda 3.3): a "demo de 90s" — carrega o dataset de exemplo
 * (sem rede, sem IA, sem cadastro) e mostra o sistema funcionando: KPIs,
 * charts determinísticos e a narrativa do loop. Ao final, o visitante pode
 * manter o demo como base ou começar a coletar apps reais.
 */
import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Play, Trash2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { loadDemoDataset, removeDemoDataset, hasDemoDataset } from "@/lib/demoDataset";
import { useDataset } from "@/hooks/useDataset";
import {
  computeKPIs, computeRatingDistribution, computeSentiment, computePerAppStats,
  computeVersionBreakdown, computeWordCloud,
} from "@/lib/dashboardAnalytics";
import { VersionDiffCard } from "@/components/dashboard/VersionDiffCard";
import { EmptyState } from "@/components/shared/EmptyState";

export default function DemoPage() {
  // Carrega o demo ao abrir (idempotente — não duplica se já existe).
  useEffect(() => {
    if (!hasDemoDataset()) loadDemoDataset();
  }, []);

  const { entries } = useDataset();
  const allReviews = useMemo(() => entries.flatMap((e) => e.reviews), [entries]);
  const kpis = useMemo(() => computeKPIs(allReviews, entries), [entries, allReviews]);
  const dist = useMemo(() => computeRatingDistribution(allReviews), [allReviews]);
  const sentimentArr = useMemo(() => computeSentiment(allReviews), [allReviews]);
  const sentiment = useMemo(() => ({
    positive: sentimentArr[0]?.value ?? 0,
    neutral: sentimentArr[1]?.value ?? 0,
    negative: sentimentArr[2]?.value ?? 0,
  }), [sentimentArr]);
  const perApp = useMemo(() => computePerAppStats(entries), [entries]);
  const versions = useMemo(() => computeVersionBreakdown(allReviews), [allReviews]);
  const words = useMemo(() => computeWordCloud(allReviews, 12), [allReviews]);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Demo de 90s" />
      <main id="content" className="content-fluid py-8 space-y-6" role="main">
        <section className="rounded-2xl border border-primary/25 bg-primary/5 p-5">
          <h1 className="text-lg font-bold">O sistema funcionando — sem cadastro, sem rede, sem IA</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Esta página carregou um dataset de exemplo (1 app · 40 reviews sintéticas) e rodou
            todas as análises determinísticas localmente. É o que acontece quando você coleta
            apps de verdade — tudo abaixo sai dos dados, não de IA.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to="/" className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
              <Play className="h-3.5 w-3.5" aria-hidden /> Começar a usar de verdade
            </Link>
            <button
              onClick={() => removeDemoDataset()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs hover:bg-secondary"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden /> Remover dados de exemplo
            </button>
          </div>
        </section>

        {entries.length === 0 ? (
          <EmptyState
            icon={Trash2}
            title="Demo removido"
            description="Os dados de exemplo foram removidos. Recarregue a página para recriar o demo, ou colete um app real na página inicial."
          />
        ) : (
          <>
            {/* KPIs */}
            <section aria-label="Indicadores" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: "Apps", value: kpis.totalApps },
                { label: "Reviews", value: kpis.totalReviews },
                { label: "Nota média coletada", value: kpis.avgRating.toFixed(2) },
                { label: "% positivos", value: `${kpis.positivePct}%` },
              ].map((k) => (
                <div key={k.label} className="rounded-xl border border-border/60 bg-card p-3 text-center">
                  <p className="text-xl font-bold">{k.value}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{k.label}</p>
                </div>
              ))}
            </section>

            {/* Distribuição + sentimento */}
            <section aria-label="Distribuição e sentimento" className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border/60 bg-card p-4">
                <h2 className="text-sm font-semibold">Distribuição de notas</h2>
                <div className="mt-2 space-y-1.5">
                  {dist.map((d) => (
                    <div key={d.rating} className="flex items-center gap-2 text-xs">
                      <span className="w-8 font-mono">★{d.rating}</span>
                      <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${(d.count / Math.max(1, kpis.totalReviews)) * 100}%` }}
                        />
                      </div>
                      <span className="w-8 text-right font-mono">{d.count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-border/60 bg-card p-4">
                <h2 className="text-sm font-semibold">Sentimento (determinístico)</h2>
                <p className="mt-2 text-xs text-muted-foreground">
                  Positivo {sentiment.positive} · Neutro {sentiment.neutral} · Negativo {sentiment.negative}
                </p>
                <div className="mt-2 flex h-3 w-full overflow-hidden rounded-full">
                  <div className="bg-emerald-500" style={{ width: `${(sentiment.positive / Math.max(1, allReviews.length)) * 100}%` }} />
                  <div className="bg-muted" style={{ width: `${(sentiment.neutral / Math.max(1, allReviews.length)) * 100}%` }} />
                  <div className="bg-red-500" style={{ width: `${(sentiment.negative / Math.max(1, allReviews.length)) * 100}%` }} />
                </div>
              </div>
            </section>

            {/* Versões + termos */}
            <section aria-label="Versões e termos" className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border/60 bg-card p-4">
                <h2 className="text-sm font-semibold">Nota por versão</h2>
                <ul className="mt-2 space-y-1 text-xs" role="list">
                  {versions.map((v) => (
                    <li key={v.version} className="flex justify-between">
                      <span className="font-mono">v{v.version}</span>
                      <span className="text-muted-foreground">{v.avgRating} ★ · {v.count} reviews</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-border/60 bg-card p-4">
                <h2 className="text-sm font-semibold">Termos frequentes</h2>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {words.map(([w, n]) => (
                    <span key={w} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px]">
                      {w} <span className="font-mono text-muted-foreground">{n}</span>
                    </span>
                  ))}
                </div>
              </div>
            </section>

            {/* Diff de versões (Onda 4.2) */}
            <VersionDiffCard reviews={allReviews} />

            {/* Per-app */}
            <section aria-label="Por app" className="rounded-xl border border-border/60 bg-card p-4">
              <h2 className="text-sm font-semibold">Apps no dataset</h2>
              <ul className="mt-2 space-y-1 text-xs" role="list">
                {perApp.map((p) => (
                  <li key={p.key} className="flex justify-between">
                    <span>{p.name}</span>
                    <span className="text-muted-foreground">
                      {p.reviewCount} reviews · {p.avgCollected} ★ · {p.positivePct}% positivos
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <p className="text-center text-xs text-muted-foreground">
              Fim da demo — isso foi <strong>sem IA</strong>. Com IA ativada (local ou sua própria
              chave), cada número acima vira análise com evidência citada.{" "}
              <Link to="/configuracoes" className="text-primary underline">Configurar IA</Link>
            </p>
          </>
        )}
      </main>
    </div>
  );
}
