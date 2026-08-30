/**
 * Diff de versões como cidadão de primeira classe (Onda 4.2): seleciona duas
 * versões (A → B) e responde deterministicamente "o que mudou" — nota, %,
 * volume, termos em ascensão/queda + narrativa pronta para copiar/exportar.
 * Sem IA: tudo computado dos reviews pelo versionDiff.
 */
import { useMemo, useState } from "react";
import { GitCompare, TrendingDown, TrendingUp, Minus, CircleHelp } from "lucide-react";
import { diffVersions, listVersions } from "@/lib/versionDiff";
import type { ReviewEntry } from "@/lib/appStoreApi";
import { CopyDownloadButtons } from "@/components/shared/CopyDownloadButtons";

const VERDICT_META = {
  melhora: { label: "MELHORA", icon: TrendingUp, className: "text-emerald-600 dark:text-emerald-400" },
  regressao: { label: "REGRESSÃO", icon: TrendingDown, className: "text-red-600 dark:text-red-400" },
  estavel: { label: "ESTÁVEL", icon: Minus, className: "text-muted-foreground" },
  "dados-insuficientes": { label: "DADOS INSUFICIENTES", icon: CircleHelp, className: "text-amber-600 dark:text-amber-400" },
} as const;

export function VersionDiffCard({ reviews }: { reviews: ReviewEntry[] }) {
  const versions = useMemo(() => listVersions(reviews), [reviews]);
  const [versionA, setVersionA] = useState<string>("");
  const [versionB, setVersionB] = useState<string>("");

  // Default: primeira etapa do loop de versões (1ª → última disponível).
  const a = versionA || versions[0] || "";
  const b = versionB || versions[versions.length - 1] || "";

  const diff = useMemo(
    () => (a && b && a !== b ? diffVersions(reviews, a, b) : null),
    [reviews, a, b],
  );

  const meta = diff ? VERDICT_META[diff.verdict] : null;
  const VerdictIcon = meta?.icon;

  return (
    <section
      aria-label="Diff de versões"
      className="rounded-xl border border-border/60 bg-card p-4 space-y-3"
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <GitCompare className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
          <h3 className="text-sm font-semibold">Diff de Versões</h3>
          <span className="text-xs text-muted-foreground truncate">
            o que mudou entre uma versão e outra — determinístico, sem IA
          </span>
        </div>
        {diff && (
          <CopyDownloadButtons
            content={diff.narrative.join("\n\n")}
            filename={`diff-v${a}-v${b}`}
          />
        )}
      </div>

      {versions.length < 2 ? (
        <p className="text-xs text-muted-foreground">
          Colete reviews com informação de versão (pelo menos 2 versões distintas) para comparar.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Selecionar versões">
            <label className="text-xs text-muted-foreground">
              De
              <select
                className="ml-1.5 h-8 rounded-md border border-input bg-background px-2 text-xs"
                value={a}
                onChange={(e) => setVersionA(e.target.value)}
                aria-label="Versão A"
              >
                {versions.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </label>
            <span className="text-xs text-muted-foreground" aria-hidden="true">→</span>
            <label className="text-xs text-muted-foreground">
              Para
              <select
                className="ml-1.5 h-8 rounded-md border border-input bg-background px-2 text-xs"
                value={b}
                onChange={(e) => setVersionB(e.target.value)}
                aria-label="Versão B"
              >
                {versions.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </label>
          </div>

          {diff && meta && VerdictIcon && (
            <div className="space-y-3">
              <p className={`flex items-center gap-1.5 text-xs font-semibold ${meta.className}`} role="status">
                <VerdictIcon className="h-3.5 w-3.5" aria-hidden="true" />
                {meta.label} em {b} · {diff.b.count} reviews vs {diff.a.count} em {a}
              </p>

              {/* Stats lado a lado */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center" role="list" aria-label="Comparação de métricas">
                {[
                  { label: "Nota média", va: diff.a.avgRating, vb: diff.b.avgRating },
                  { label: "% positivos", va: `${diff.a.pctPositive}%`, vb: `${diff.b.pctPositive}%` },
                  { label: "% negativos", va: `${diff.a.pctNegative}%`, vb: `${diff.b.pctNegative}%` },
                  { label: "Reviews", va: diff.a.count, vb: diff.b.count },
                ].map((m) => (
                  <div key={m.label} className="rounded-lg border border-border/40 p-2" role="listitem">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{m.label}</p>
                    <p className="text-xs font-mono">
                      {String(m.va)} <span aria-hidden="true">→</span> <strong>{String(m.vb)}</strong>
                    </p>
                  </div>
                ))}
              </div>

              {/* Narrativa */}
              <ol className="space-y-1.5 text-xs leading-relaxed" role="list">
                {diff.narrative.map((line, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-muted-foreground select-none" aria-hidden="true">{i + 1}.</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ol>

              {/* Termos */}
              {(diff.rising.length > 0 || diff.falling.length > 0) && (
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-red-600 dark:text-red-400 mb-1">
                      Em ascensão em {b}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {diff.rising.map((t) => (
                        <span key={t.term} className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px]">
                          {t.term} <span className="font-mono">+{t.delta}</span>
                        </span>
                      ))}
                      {diff.rising.length === 0 && <span className="text-[10px] text-muted-foreground">nenhum</span>}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-1">
                      Que sumiram em {b}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {diff.falling.map((t) => (
                        <span key={t.term} className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px]">
                          {t.term} <span className="font-mono">{t.delta}</span>
                        </span>
                      ))}
                      {diff.falling.length === 0 && <span className="text-[10px] text-muted-foreground">nenhum</span>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
