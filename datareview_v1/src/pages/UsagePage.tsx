/**
 * Página /uso — "Uso do sistema" (Onda 1.3 do PROXIMA-VERSAO).
 *
 * Telemetria 100% LOCAL (zero rede) agregando os stores do sistema:
 * os/memory (page views, comandos, análises, agentes), sessionStore
 * (coletas + gerações de IA) e activityStore (log de atividade).
 *
 * Propósito: dar ao usuário e ao desenvolvedor DADOS reais de uso para
 * decidir consolidações (one-in-one-out, flags órfãs) — nunca por intuição.
 */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Activity, BarChart3, BrainCircuit, Clock, Compass, Download,
  Eye, Flag, LayoutGrid, MousePointerClick, Sparkles, TerminalSquare, Trash2,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ExpandableBlock } from "@/components/shared/ExpandableBlock";
import { CopyDownloadButtons } from "@/components/shared/CopyDownloadButtons";
import { Button } from "@/components/ui/button";
import { useOSEvents, clearOSMemory } from "@/lib/os/memory";
import { useGenerations } from "@/hooks/useSessions";
import { useActivityEvents } from "@/lib/activityStore";
import { useDestructiveAction } from "@/hooks/useUx";
import {
  buildUsageMarkdown, generationSourceFrequency, generationTypeFrequency,
  kindFrequency, neverOpenedPages, pageLabel, pageViewFrequency,
  usageSummary, activitySourceFrequency,
} from "@/lib/usage";

/** Barra horizontal proporcional (CSS puro, sem recharts — leve). */
function FrequencyBars({ rows, label }: { rows: Array<[string, number]>; label?: (k: string) => string }) {
  if (rows.length === 0) return <p className="text-xs text-muted-foreground">Nenhum registro ainda.</p>;
  const max = Math.max(...rows.map(([, v]) => v), 1);
  return (
    <div className="space-y-1.5">
      {rows.map(([key, value]) => (
        <div key={key} className="flex items-center gap-2">
          <span className="w-40 truncate text-[11px] text-muted-foreground" title={key}>
            {label ? label(key) : key}
          </span>
          <div className="flex-1 h-3.5 rounded bg-secondary/70 overflow-hidden">
            <div
              className="h-full rounded bg-primary/80"
              style={{ width: `${Math.max((value / max) * 100, 3)}%` }}
              role="progressbar"
              aria-valuenow={value}
              aria-valuemin={0}
              aria-valuemax={max}
              aria-label={`${label ? label(key) : key}: ${value}`}
            />
          </div>
          <span className="w-8 text-right text-[11px] font-medium text-foreground tabular-nums">{value}</span>
        </div>
      ))}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, hint }: { icon: typeof Eye; label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/60 p-3.5">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="text-[10px] uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1 text-2xl font-semibold text-foreground tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function UsagePage() {
  const events = useOSEvents();
  const generations = useGenerations();
  const activities = useActivityEvents();
  const destroy = useDestructiveAction();

  const summary = useMemo(() => usageSummary(events, generations, activities), [events, generations, activities]);
  const topPages = useMemo(() => pageViewFrequency(events), [events]);
  const topCommands = useMemo(() => kindFrequency(events, "command"), [events]);
  const topActions = useMemo(() => kindFrequency(events, "analysis"), [events]);
  const genByType = useMemo(() => generationTypeFrequency(generations), [generations]);
  const genBySource = useMemo(() => generationSourceFrequency(generations), [generations]);
  const actBySource = useMemo(() => activitySourceFrequency(activities), [activities]);
  const neverOpened = useMemo(() => neverOpenedPages(events), [events]);
  const markdown = useMemo(
    () => buildUsageMarkdown(summary, topPages, topCommands, genByType, neverOpened),
    [summary, topPages, topCommands, genByType, neverOpened],
  );

  const clearUsage = () =>
    destroy({
      confirm: "Limpar a telemetria de uso?",
      detail: "Apaga o histórico de uso (page views, comandos e aprendizado do OS). Não afeta dados coletados nem gerações.",
      action: () => clearOSMemory(),
      toast: "Telemetria de uso apagada",
    });

  const empty = events.length === 0 && generations.length === 0 && activities.length === 0;
  const period = summary.firstEventAt
    ? `${new Date(summary.firstEventAt).toLocaleDateString()} → ${new Date(summary.lastEventAt ?? Date.now()).toLocaleDateString()}`
    : "—";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <AppHeader
        title="Uso do sistema"
        crumb="telemetria local"
        extraMenu={
          <div className="flex items-center gap-1">
            <CopyDownloadButtons content={markdown} filename="uso-do-sistema" />
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={clearUsage} aria-label="Limpar telemetria de uso">
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Limpar
            </Button>
          </div>
        }
      />
      <main className="flex-1 min-h-0 overflow-y-auto">
        <div className="content-fluid space-y-5 py-5">
          <p className="text-xs text-muted-foreground max-w-3xl">
            Telemetria 100% local (nada sai da máquina): quais páginas você abre, quais comandos usa,
            o que gera com IA e de onde vêm as atividades. Estes dados alimentam as decisões de
            consolidação do sistema (o que fundir, o que desligar por padrão).
          </p>

          {empty ? (
            <EmptyState
              icon={Activity}
              title="Nenhum uso registrado ainda"
              description="Navegue pelas páginas, colete apps e gere análises — esta página começa a mostrar estatísticas a partir do primeiro uso."
            />
          ) : (
            <>
              <section aria-label="Indicadores de uso" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
                <Kpi icon={Eye} label="Page views" value={summary.pageViews} hint={`${summary.distinctPages} páginas distintas`} />
                <Kpi icon={TerminalSquare} label="Comandos" value={summary.commands} hint="CLI + paletas" />
                <Kpi icon={Sparkles} label="Análises IA" value={summary.analyses} />
                <Kpi icon={Download} label="Coletas" value={summary.collects} />
                <Kpi icon={BrainCircuit} label="Gerações" value={summary.generations} hint={`${summary.aiGenerations} com IA`} />
                <Kpi icon={Clock} label="Período" value={period} hint={`${summary.activities} eventos de atividade`} />
              </section>

              <div className="grid gap-4 lg:grid-cols-2">
                <ExpandableBlock id="uso-paginas" storageKey="uso-paginas" title="Páginas mais abertas" subtitle="por page view (rota)" icon={<LayoutGrid className="h-4 w-4 text-primary" />}>
                  <div className="px-4 pb-4">
                    <FrequencyBars rows={topPages} label={pageLabel} />
                  </div>
                </ExpandableBlock>

                <ExpandableBlock id="uso-comandos" storageKey="uso-comandos" title="Comandos e ações" subtitle="CLI, paletas e análises de IA" icon={<MousePointerClick className="h-4 w-4 text-primary" />}>
                  <div className="px-4 pb-4 space-y-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Comandos</p>
                      <FrequencyBars rows={topCommands} />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Seções de IA geradas</p>
                      <FrequencyBars rows={topActions} />
                    </div>
                  </div>
                </ExpandableBlock>

                <ExpandableBlock id="uso-geracoes" storageKey="uso-geracoes" title="Gerações" subtitle="coletas + saídas de IA por tipo e origem" icon={<Sparkles className="h-4 w-4 text-primary" />}>
                  <div className="px-4 pb-4 space-y-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Por tipo</p>
                      <FrequencyBars rows={genByType} />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Por origem (superfície)</p>
                      <FrequencyBars rows={genBySource} />
                    </div>
                  </div>
                </ExpandableBlock>

                <ExpandableBlock id="uso-atividade" storageKey="uso-atividade" title="Atividade por origem" subtitle="log de tarefas do sistema" icon={<Activity className="h-4 w-4 text-primary" />}>
                  <div className="px-4 pb-4">
                    <FrequencyBars rows={actBySource} />
                  </div>
                </ExpandableBlock>
              </div>

              <ExpandableBlock id="uso-cobertura" storageKey="uso-cobertura" title="Cobertura de páginas" subtitle="o que nunca foi aberto" icon={<Compass className="h-4 w-4 text-primary" />}>
                <div className="px-4 pb-4">
                  {neverOpened.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Todas as páginas do sistema já foram abertas. ✓</p>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground mb-2">
                        {neverOpened.length} página(s) nunca abertas nesta instalação — candidatas a revisão:
                      </p>
                      <ul className="flex flex-wrap gap-1.5">
                        {neverOpened.map((p) => (
                          <li key={p}>
                            <Link
                              to={p}
                              className="inline-flex items-center gap-1 rounded-md border border-border/50 bg-secondary/50 px-2 py-1 text-[11px] text-foreground hover:border-primary/50"
                            >
                              <Flag className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                              {pageLabel(p)}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </ExpandableBlock>

              <ExpandableBlock id="uso-relatorio" storageKey="uso-relatorio" title="Relatório completo" subtitle="markdown exportável" icon={<BarChart3 className="h-4 w-4 text-primary" />}>
                <div className="px-4 pb-4">
                  <pre className="max-h-96 overflow-auto rounded-lg border border-border/40 bg-secondary/40 p-3 text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap">{markdown}</pre>
                  <div className="mt-2">
                    <CopyDownloadButtons content={markdown} filename="uso-do-sistema" />
                  </div>
                </div>
              </ExpandableBlock>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
