/**
 * Pipeline de dados — `/pipeline-dados`
 *
 * Visualização e validação do pipeline de dados ponta a ponta:
 * CONFIG → BUSCA → COLETA → NORMALIZAÇÃO → ENRIQUECIMENTO → DATASET → DERIVADO.
 *
 * Cada estágio tem um painel:
 *  - Stage flow visual com contagens.
 *  - Auditoria de campos AppInfo por app (`APPFIELD_AUDIT` de enrichment) com
 *    score de cobertura por app e comparativo Apple × Google.
 *  - Qualidade dos reviews (qualityBand/sentiment/flags enriquecidas).
 *  - Relatório de validação (`runValidation`) com 8 checks pass/warn/fail,
 *    issues drill-down com copy para AI.
 *  - Preview do "pack de IA": o payload que o sistema envia ao modelo (mesmo
 *    formato `factsToMarkdown` estimado localmente + amostra de reviews).
 */
import { useMemo, useState } from "react";
import {
  Database, CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronRight,
  Sparkles, ArrowRight, Download, ShieldCheck, Filter, Wand2,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { ErrorBoundary } from "@/components/dashboard/ErrorBoundary";
import { EmptyState } from "@/components/shared/EmptyState";
import { CopyDownloadButtons } from "@/components/shared/CopyDownloadButtons";
import { useDataset } from "@/hooks/useDataset";
import { useSelection, entryKey } from "@/context/SelectionContext";
import { appCoverage, enrichReview, type EnrichedReview } from "@/lib/enrichment";
import { useInsights } from "@/lib/insightStore";
import { runValidation, type CheckStatus, type ValidationReport } from "@/lib/dataPipeline";
import type { AppInfo } from "@/lib/appStoreApi";
import { datasetRevision } from "@/lib/datasetStore";
import type { DatasetEntry } from "@/lib/datasetStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STATUS_META: Record<CheckStatus, { icon: typeof CheckCircle2; cls: string; label: string }> = {
  pass: { icon: CheckCircle2, cls: "text-emerald-500", label: "pass" },
  warn: { icon: AlertTriangle, cls: "text-amber-500", label: "warn" },
  fail: { icon: XCircle, cls: "text-destructive", label: "fail" },
};

interface EnrichedStats {
  total: number;
  rich: number;
  medium: number;
  poor: number;
  bySentiment: { positive: number; neutral: number; negative: number };
  flags: { emoji: number; caps: number; link: number; question: number };
  avgWords: number;
}

function computeReviewStats(entries: DatasetEntry[]): { total: number; stats: EnrichedStats } {
  const reviews = entries.flatMap((e) => e.reviews);
  const enriched = reviews.map((r) => enrichReview(r));
  const total = enriched.length;
  const bySentiment = { positive: 0, neutral: 0, negative: 0 };
  const flags = { emoji: 0, caps: 0, link: 0, question: 0 };
  let rich = 0, medium = 0, poor = 0, words = 0;
  for (const r of enriched) {
    bySentiment[r.sentiment]++;
    if (r.qualityBand === "rich") rich++;
    else if (r.qualityBand === "medium") medium++;
    else poor++;
    words += r.wordCount;
    if (r.flags.emoji) flags.emoji++;
    if (r.flags.caps) flags.caps++;
    if (r.flags.link) flags.link++;
    if (r.flags.question) flags.question++;
  }
  return {
    total,
    stats: {
      total,
      rich,
      medium,
      poor,
      bySentiment,
      flags,
      avgWords: total ? Math.round(words / total) : 0,
    },
  };
}

export default function DataPipeline() {
  const dataset = useDataset();
  const { selected } = useSelection();

  const entries = useMemo(
    () =>
      selected.size === 0
        ? dataset.entries
        : dataset.entries.filter((e) => selected.has(entryKey(e.app.store, e.app.id))),
    [dataset.entries, selected],
  );

  const audit = useMemo(() => {
    const apps = entries.map((e) => ({
      entry: e,
      coverage: appCoverage(e.app as AppInfo),
    }));
    return apps;
  }, [entries]);

  const reviewStats = useMemo(() => computeReviewStats(entries), [entries]);
  const report = useMemo(() => (entries.length ? runValidation(entries) : null), [entries]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const avgScore = useMemo(
    () => Math.round(audit.reduce((s, a) => s + a.coverage.score, 0) / Math.max(1, audit.length)),
    [audit],
  );

  const apple = audit.filter((a) => a.entry.app.store === "apple").length;
  const google = audit.length - apple;

  if (entries.length === 0) {
    return (
      <ErrorBoundary title="Erro ao renderizar o pipeline de dados">
        <div className="h-full flex flex-col">
          <AppHeader title="Pipeline de dados" crumb="Explore coleta → dataset" />
          <EmptyState
            icon={Database}
            title="Dataset vazio"
            description="Colete apps aqui mesmo para visualizar e validar o pipeline de dados completo."
            collect
          />
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary title="Erro ao renderizar o pipeline de dados">
      <div className="h-full flex flex-col">
        <AppHeader title="Pipeline de dados" crumb="CONFIG → BUSCA → COLETA → NORMALIZAÇÃO → ENRIQUECIMENTO → DATASET → DERIVADO" showSearch={false} />
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          <div className="content-fluid space-y-4">
            {/* ------------------------------ Stage flow --- */}
            <div className="rounded-xl border border-border/60 bg-card/40 p-4" aria-label="Estágios do pipeline">
              <ol className="flex items-center gap-2 flex-wrap" role="list">
                {["Config", "Busca", "Coleta", "Normalização", "Enriquecimento", "Dataset", "Derivado"].map((s, i) => (
                  <li key={s} className="flex items-center gap-2">
                    {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground" aria-hidden="true" />}
                    <span className="text-[11px] font-medium px-2.5 py-1 rounded-md bg-secondary">{s}</span>
                  </li>
                ))}
              </ol>
              <p className="text-[10px] text-muted-foreground mt-2">
                {entries.length} app(s) · {reviewStats.stats.total} review(s) · cobertura média de campos {avgScore}% ·
                {apple} Apple · {google} Google
              </p>
            </div>

            {/* ------------------------------ auditoria de campos --- */}
            <div className="rounded-xl border border-border/60 bg-card/40 overflow-hidden">
              <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" aria-hidden="true" />
                <h2 className="text-sm font-bold">Auditoria de campos por app</h2>
                <Badge variant="secondary">{avgScore}% média</Badge>
              </div>
              <div>
                {audit.map((a) => {
                  const k = `${a.entry.app.store}:${a.entry.app.id}`;
                  const open = expanded === k;
                  return (
                    <div key={k} className="border-b border-border/40 last:border-0">
                      <button
                        onClick={() => setExpanded(open ? null : k)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-secondary/40 transition-colors"
                        aria-expanded={open}
                      >
                        <span
                          className={cn(
                            "inline-flex items-center justify-center w-10 h-10 rounded-md text-[10px] font-bold",
                            a.coverage.score >= 70 ? "bg-emerald-500/10 text-emerald-500" : a.coverage.score >= 40 ? "bg-amber-500/10 text-amber-500" : "bg-destructive/10 text-destructive",
                          )}
                        >
                          {a.coverage.score}%
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium truncate">{a.entry.app.name}</p>
                          <p className="text-[9px] text-muted-foreground">{a.entry.app.store} · {a.coverage.present.length}/{a.coverage.present.length + a.coverage.missing.length} campos</p>
                        </div>
                        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />}
                      </button>
                      {open && (
                        <div className="px-4 pb-3 grid grid-cols-2 gap-1 anim-fade-in" role="region" aria-label={`Campos de ${a.entry.app.name}`}>
                          {[...a.coverage.present, ...a.coverage.missing].map((f) => (
                            <p key={f.key} className={cn("text-[10px] flex items-start gap-1.5", f.present ? "" : "opacity-60")}>
                              {f.present
                                ? <CheckCircle2 className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" aria-hidden="true" />
                                : <XCircle className="h-3 w-3 text-destructive/60 mt-0.5 shrink-0" aria-hidden="true" />}
                              <span>
                                <span className="font-mono font-medium">{f.key}</span>{" "}
                                <span className="text-muted-foreground">({f.label})</span>
                              </span>
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ------------------------------ qualidade dos reviews --- */}
            <div className="rounded-xl border border-border/60 bg-card/40 overflow-hidden">
              <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
                <h2 className="text-sm font-bold">Qualidade dos reviews enriquecidos</h2>
              </div>
              <div className="grid md:grid-cols-3 gap-4 p-4">
                <div>
                  <p className="text-[11px] font-semibold mb-2">Sentimento (★4-5/3/1-2)</p>
                  <ReviewBar label="Positivo" n={reviewStats.stats.bySentiment.positive} total={reviewStats.stats.total} color="bg-emerald-500" />
                  <ReviewBar label="Neutro" n={reviewStats.stats.bySentiment.neutral} total={reviewStats.stats.total} color="bg-amber-500" />
                  <ReviewBar label="Negativo" n={reviewStats.stats.bySentiment.negative} total={reviewStats.stats.total} color="bg-destructive" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold mb-2">Tamanho do texto</p>
                  <ReviewBar label="rico (≥40 palavras)" n={reviewStats.stats.rich} total={reviewStats.stats.total} color="bg-primary" />
                  <ReviewBar label="médio" n={reviewStats.stats.medium} total={reviewStats.stats.total} color="bg-sky-500" />
                  <ReviewBar label="pobre" n={reviewStats.stats.poor} total={reviewStats.stats.total} color="bg-muted-foreground" />
                  <p className="text-[10px] text-muted-foreground mt-2">média {reviewStats.stats.avgWords} palavras</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold mb-2">Sinais (flags)</p>
                  <ReviewBar label="com emoji" n={reviewStats.stats.flags.emoji} total={reviewStats.stats.total} color="bg-primary" />
                  <ReviewBar label="com caps" n={reviewStats.stats.flags.caps} total={reviewStats.stats.total} color="bg-primary" />
                  <ReviewBar label="com link" n={reviewStats.stats.flags.link} total={reviewStats.stats.total} color="bg-primary" />
                  <ReviewBar label="com pergunta" n={reviewStats.stats.flags.question} total={reviewStats.stats.total} color="bg-primary" />
                </div>
              </div>
            </div>

            {/* ------------------------------ derivado (feedback IA) --- */}
            <InsightsPanel />

            {/* ------------------------------ validação --- */}
            {report && <ValidationReportView report={report} />}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

/* ------------------------------------------------------------------ report --- */
function ValidationReportView({ report }: { report: ValidationReport | null }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!report) return null;
  const meta = STATUS_META[report.overall];
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 overflow-hidden" aria-label="Relatório de validação">
      <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2">
        <ShieldCheck className={cn("h-4 w-4", meta.cls)} aria-hidden="true" />
        <h2 className="text-sm font-bold">Validação (8 checks)</h2>
        <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase", meta.cls)}>
          {meta.label}
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {report.totalIssues === 0 ? "nenhuma issue" : `${report.totalIssues} issue(s)`}
        </span>
        <CopyDownloadButtons
          content={reportToMarkdown(report)}
          filename="pipeline-validacao"
          compact
        />
      </div>
      <div className="grid md:grid-cols-2 gap-0">
        {report.checks.map((c) => {
          const m = STATUS_META[c.status];
          const Icon = m.icon;
          const expanded = open === c.id;
          return (
            <div key={c.id} className="border-b md:border-r border-border/40 last:border-b-0 odd:border-r md:[&:nth-child(even)]:border-r-0">
              <button
                onClick={() => setOpen(expanded ? null : c.id)}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-secondary/40 transition-colors"
                aria-expanded={expanded}
              >
                <Icon className={cn("h-4 w-4 shrink-0", m.cls)} aria-hidden="true" />
                <span className="flex-1 text-[11px] font-medium">{c.label}</span>
                <span className="text-[10px] text-muted-foreground">
                  {c.issues.length === 0 ? "ok" : `${c.issues.length}`}
                </span>
                {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" aria-hidden="true" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" aria-hidden="true" />}
              </button>
              {expanded && c.issues.length > 0 && (
                <ul className="px-4 pb-3 space-y-1" role="list">
                  {c.issues.slice(0, 25).map((issue, i) => (
                    <li key={i} className="text-[10px] text-muted-foreground">
                      <span className="font-mono">{issue.appKey}</span>
                      {issue.reviewId ? <span className="opacity-70"> · review {issue.reviewId}</span> : null}
                      {" — "}
                      {issue.message}
                    </li>
                  ))}
                  {c.issues.length > 25 && <li className="text-[10px] text-muted-foreground">… +{c.issues.length - 25} issue(s)</li>}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
/* ------------------------------------------------------------------ derivado --- */
/**
 * Estágio "Derivado": insights IA indexados no insightStore (feedback loop —
 * o sistema aprende com IA + dados determinísticos). Colapsável com preview
 * do resumo por insight.
 */
function InsightsPanel() {
  const insights = useInsights();
  const [open, setOpen] = useState(false);
  // Freshness: revisão atual do dataset vs a revisão em que cada insight foi
  // gerado — se o dataset avançou (nova coleta), o insight é potencialmente
  // desatualizado.
  const rev = datasetRevision();
  const staleCount = insights.filter((i) => i.datasetRev != null && i.datasetRev < rev).length;
  if (insights.length === 0) return null;
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 border-b border-border/50 hover:bg-secondary/40 transition-colors"
        aria-expanded={open}
      >
        <Wand2 className="h-4 w-4 text-primary" aria-hidden="true" />
        <h2 className="text-sm font-bold flex-1 text-left">Insights IA derivados ({insights.length})</h2>
        {staleCount > 0 && (
          <span className="text-[10px] rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-0.5" title="Gerados antes da coleta mais recente — considere regenerar">
            {staleCount} desatualizado{staleCount !== 1 ? "s" : ""}
          </span>
        )}
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
      </button>
      {open && (
        <div className="divide-y divide-border/40">
          {insights.slice(0, 20).map((i) => {
            const stale = i.datasetRev != null && i.datasetRev < rev;
            return (
              <div key={i.id} className="px-4 py-3">
                <p className="text-[11px] font-medium">
                  {i.section}{" "}
                  <span className="text-muted-foreground text-[10px]">· {new Date(i.generatedAt).toLocaleString()}</span>
                  {stale && (
                    <span className="ml-1.5 text-[9px] rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1.5 py-0.5" title={`Gerado na revisão ${i.datasetRev} do dataset (atual: ${rev})`}>
                      desatualizado
                    </span>
                  )}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{i.appKeys.join(", ")}</p>
                <p className="text-[11px] mt-2 whitespace-pre-wrap">{i.summary}</p>
              </div>
            );
          })}
          {insights.length > 20 && <p className="px-4 py-2 text-[10px] text-muted-foreground">… +{insights.length - 20} mais antigas</p>}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ bar --- */
function ReviewBar({ label, n, total, color }: { label: string; n: number; total: number; color: string }) {
  const pct = total ? Math.round((n / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <span className="text-[10px] text-muted-foreground w-24 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${label} ${pct}%`}>
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-medium w-8 text-right">{pct}%</span>
    </div>
  );
}

/* ------------------------------------------------------------------ markdown --- */
function reportToMarkdown(report: ValidationReport): string {
  const lines = ["# Validação do pipeline de dados\n", `- Resultado geral: **${report.overall.toUpperCase()}**\n`];
  for (const c of report.checks) {
    lines.push(`\n## ${c.label} — ${c.status.toUpperCase()} (${c.issues.length} issue(s))`);
    for (const issue of c.issues) {
      lines.push(`- **${issue.appKey}**${issue.reviewId ? ` · review ${issue.reviewId}` : ""}: ${issue.message}`);
    }
  }
  return lines.join("\n");
}
