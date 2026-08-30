/**
 * Metodologias (`/metodologias`) — catálogo de métodos de pesquisa/análise
 * por área (pesquisa, UX, design, produto, negócio, marketing, tech, suporte)
 * + composer de pipelines executados pela IA.
 *
 * - Rodar UMA metodologia independentemente (botão por item) OU o pipeline
 *   completo de uma vez (fila global iaRunner: continua ao navegar, pausa,
 *   retoma de onde parou ou recomeça do zero via IAQueueBar).
 * - Cada execução gera um artefato persistido (saveAIOutput `met:<pid>:<mid>`)
 *   — recarregar a página não perde nada; tudo copiável/baixável.
 * - Pipelines customizados são salvos localmente e reexecutáveis.
 */
import { useEffect, useMemo, useState } from "react";
import { confirmDestructive } from "@/lib/ux";
import {
  BookOpenCheck, Search as SearchIcon, Plus, Play, ArrowUp, ArrowDown, X,
  Save, Trash2, Download, Loader2, Check, AlertCircle, BrainCircuit, Database,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { IAQueueBar } from "@/components/shared/IAQueueBar";
import { AIOutputCard } from "@/components/shared/AIOutputCard";
import { useDataset } from "@/hooks/useDataset";
import { useSelection } from "@/context/SelectionContext";
import { useAISettings, isAIEnabled } from "@/lib/aiSettings";
import {
  METHODOLOGIES, METHOD_CATEGORY_LABELS, METHOD_CATEGORY_ORDER,
  getMethodology, methodologyJobs, PRESET_PIPELINES,
  listMethodPipelines, saveMethodPipeline, deleteMethodPipeline, useMethodPipelines,
  type MethodCategory, type MethodPipeline,
} from "@/lib/methodologies";
import {
  enqueueJobs, startQueue, restartQueue, useIAQueue, subscribeRunnerEvents,
} from "@/lib/iaRunner";
import { getAIOutput } from "@/lib/aiOutputStore";
import { downloadFile } from "@/lib/pageFeatures";
import { cn } from "@/lib/utils";
import { AIDisabledEmptyState } from "@/components/shared/AIDisabledNotice";

export default function Methodologies({ embedded = false }: { embedded?: boolean }) {
  const { entries } = useDataset();
  const { selected } = useSelection();
  const ai = useAISettings();
  const queue = useIAQueue();
  const pipelines = useMethodPipelines();

  const scoped = useMemo(() => {
    if (selected.size === 0) return entries;
    const filtered = entries.filter((e) => selected.has(`${e.app.store}:${e.app.id}`));
    return filtered.length > 0 ? filtered : entries;
  }, [entries, selected]);

  const [category, setCategory] = useState<MethodCategory | "all">("all");
  const [query, setQuery] = useState("");
  const [composer, setComposer] = useState<string[]>([]);
  const [pipelineName, setPipelineName] = useState("");
  const [activePipelineId, setActivePipelineId] = useState("scratch");
  const [liveText, setLiveText] = useState<Record<string, string>>({});

  // Streaming ao vivo da fila → preview do job em execução.
  useEffect(() => {
    return subscribeRunnerEvents((ev) => {
      if (!ev.jobId?.startsWith("met:")) return;
      if (ev.type === "token" && ev.text != null) {
        setLiveText((prev) => ({ ...prev, [ev.jobId!]: ev.text! }));
      } else if (ev.type === "done" || ev.type === "error") {
        setLiveText((prev) => {
          const next = { ...prev };
          delete next[ev.jobId!];
          return next;
        });
      }
    });
  }, []);

  const catalog = useMemo(() => {
    let list = METHODOLOGIES;
    if (category !== "all") list = list.filter((m) => m.category === category);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((m) =>
        m.name.toLowerCase().includes(q) ||
        m.goal.toLowerCase().includes(q) ||
        m.deliverable.toLowerCase().includes(q),
      );
    }
    return list;
  }, [category, query]);

  const aiOk = isAIEnabled(ai);
  const hasData = scoped.length > 0;

  const runPipeline = (methodIds: string[], pipelineId: string) => {
    const jobs = methodologyJobs(pipelineId, methodIds);
    if (jobs.length === 0) return;
    const allDone = jobs.every((j) => queue.results[j.id] === "done");
    enqueueJobs(jobs, "replace");
    if (allDone) restartQueue(); else void startQueue();
  };

  const runSingle = (methodId: string) => {
    const m = getMethodology(methodId);
    if (!m) return;
    runPipeline([methodId], `solo-${methodId}`);
  };

  const loadPipeline = (p: MethodPipeline) => {
    setComposer(p.methodIds);
    setPipelineName(p.name);
    setActivePipelineId(p.id);
  };

  const exportResults = () => {
    const parts = composer.map((id) => {
      const m = getMethodology(id);
      const rec = getAIOutput(`met:${activePipelineId}:${id}`);
      return `## ${m?.name ?? id}\n\n${rec?.markdown?.trim() || "_Pendente_"}`;
    });
    downloadFile("pipeline-metodologias.md", `# ${pipelineName || "Pipeline de metodologias"}\n\n${parts.join("\n\n---\n\n")}`, "text/markdown");
  };

  return (
    <div className={embedded ? "bg-background" : "min-h-screen bg-background"}>
      {!embedded && <AppHeader backTo="/" title="Metodologias" crumb="Métodos & pipelines de IA" />}

      <main className="content-fluid py-6 space-y-5">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BookOpenCheck className="h-5 w-5 text-primary" aria-hidden />
            Metodologias
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {METHODOLOGIES.length} métodos de pesquisa e análise em {METHOD_CATEGORY_ORDER.length} áreas.
            Monte pipelines na ordem que precisar e execute tudo de uma vez — cada método gera um artefato reutilizável.
            Escopo atual: <strong>{scoped.length} app(s)</strong> · {scoped.reduce((s, e) => s + e.reviews.length, 0).toLocaleString("pt-BR")} reviews.
          </p>
        </div>

        {!hasData && (
          <EmptyState
            icon={Database}
            title="Sem dados no escopo"
            description="Colete apps aqui mesmo para executar metodologias de IA sobre reviews reais."
            collect
          />
        )}
        {!aiOk && hasData && (
<AIDisabledEmptyState />
        )}

        <IAQueueBar origin="metodologias" />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* Catálogo */}
          <section aria-label="Catálogo de metodologias" className="rounded-xl border border-border/60 bg-card/60 p-3 space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <SearchIcon className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar metodologia…"
                  aria-label="Buscar metodologia"
                  className="w-full rounded-lg border border-border/60 bg-secondary/50 py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-1" role="group" aria-label="Filtrar por área">
              <button
                onClick={() => setCategory("all")}
                aria-pressed={category === "all"}
                className={cn("rounded-md px-2 py-1 text-[10px]", category === "all" ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/80")}
              >
                Todas
              </button>
              {METHOD_CATEGORY_ORDER.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  aria-pressed={category === c}
                  className={cn("rounded-md px-2 py-1 text-[10px]", category === c ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/80")}
                >
                  {METHOD_CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>
            <ul className="space-y-1.5 max-h-[480px] overflow-y-auto pr-1" aria-label="Metodologias">
              {catalog.map((m) => (
                <li key={m.id} className="rounded-lg border border-border/60 bg-background/60 p-2.5">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium">{m.name}</p>
                      <p className="text-[10px] text-muted-foreground">{m.goal}</p>
                      <p className="text-[9px] text-muted-foreground/70 mt-0.5">
                        <span className="font-medium">{METHOD_CATEGORY_LABELS[m.category]}</span> · entrega: {m.deliverable}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <button
                        onClick={() => setComposer((c) => (c.includes(m.id) ? c : [...c, m.id]))}
                        aria-label={`Adicionar ${m.name} ao pipeline`}
                        title="Adicionar ao pipeline"
                        className="rounded-md border border-border/60 p-1 hover:bg-secondary"
                      >
                        <Plus className="h-3 w-3" aria-hidden />
                      </button>
                      <button
                        onClick={() => runSingle(m.id)}
                        disabled={!aiOk || !hasData}
                        aria-label={`Executar só ${m.name}`}
                        title="Executar independentemente"
                        className="rounded-md border border-border/60 p-1 hover:bg-secondary disabled:opacity-40"
                      >
                        <Play className="h-3 w-3" aria-hidden />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
              {catalog.length === 0 && (
                <li className="py-6 text-center text-xs text-muted-foreground">Nenhuma metodologia corresponde à busca.</li>
              )}
            </ul>
          </section>

          {/* Composer + pipelines salvos */}
          <section aria-label="Pipeline de metodologias" className="rounded-xl border border-border/60 bg-card/60 p-3 space-y-3">
            <div className="flex items-center gap-2">
              <input
                value={pipelineName}
                onChange={(e) => setPipelineName(e.target.value)}
                placeholder="Nome do pipeline…"
                aria-label="Nome do pipeline"
                className="flex-1 rounded-lg border border-border/60 bg-secondary/50 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <button
                onClick={() => { if (composer.length > 0) saveMethodPipeline(pipelineName, composer); }}
                disabled={composer.length === 0}
                aria-label="Salvar pipeline"
                title="Salvar pipeline"
                className="rounded-md border border-border/60 p-1.5 hover:bg-secondary disabled:opacity-40"
              >
                <Save className="h-3.5 w-3.5" aria-hidden />
              </button>
              <button
                onClick={() => { setActivePipelineId("scratch"); runPipeline(composer, "scratch"); }}
                disabled={!aiOk || !hasData || composer.length === 0}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                <Play className="h-3 w-3" aria-hidden /> Executar pipeline ({composer.length})
              </button>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap gap-1" role="group" aria-label="Pipelines prontos">
              {PRESET_PIPELINES.map((p) => (
                <button
                  key={p.name}
                  onClick={() => { setComposer(p.methodIds); setPipelineName(p.name); setActivePipelineId("scratch"); }}
                  className="rounded-full border border-border/60 px-2.5 py-1 text-[10px] hover:bg-secondary"
                >
                  {p.name}
                </button>
              ))}
            </div>

            {/* Composer */}
            <ol className="space-y-1" aria-label="Ordem do pipeline">
              {composer.map((id, i) => {
                const m = getMethodology(id);
                if (!m) return null;
                const jobId = `met:${activePipelineId}:${id}`;
                const st = queue.results[jobId];
                return (
                  <li key={id} className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/60 px-2 py-1.5">
                    <span className="w-5 text-center text-[10px] font-mono text-muted-foreground">{i + 1}</span>
                    {st === "running" && <Loader2 className="h-3 w-3 animate-spin text-status-info" aria-hidden />}
                    {st === "done" && <Check className="h-3 w-3 text-status-success" aria-hidden />}
                    {st === "error" && <AlertCircle className="h-3 w-3 text-destructive" aria-hidden />}
                    <span className="flex-1 truncate text-xs font-medium">{m.name}</span>
                    <span className="text-[9px] text-muted-foreground hidden sm:inline">{METHOD_CATEGORY_LABELS[m.category]}</span>
                    <button onClick={() => setComposer((c) => { const n = [...c]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; })} disabled={i === 0} aria-label="Mover para cima" className="p-0.5 rounded hover:bg-secondary disabled:opacity-30"><ArrowUp className="h-3 w-3" aria-hidden /></button>
                    <button onClick={() => setComposer((c) => { const n = [...c]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; return n; })} disabled={i === composer.length - 1} aria-label="Mover para baixo" className="p-0.5 rounded hover:bg-secondary disabled:opacity-30"><ArrowDown className="h-3 w-3" aria-hidden /></button>
                    <button onClick={() => setComposer((c) => c.filter((x) => x !== id))} aria-label={`Remover ${m.name}`} className="p-0.5 rounded hover:bg-secondary text-muted-foreground hover:text-destructive"><X className="h-3 w-3" aria-hidden /></button>
                  </li>
                );
              })}
              {composer.length === 0 && (
                <li className="rounded-lg border border-dashed border-border/60 py-6 text-center text-xs text-muted-foreground">
                  Adicione metodologias do catálogo ou carregue um preset. A execução segue esta ordem.
                </li>
              )}
            </ol>

            {composer.length > 0 && (
              <button
                onClick={exportResults}
                className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2.5 py-1 text-[11px] hover:bg-secondary"
              >
                <Download className="h-3 w-3" aria-hidden /> Exportar resultados (.md)
              </button>
            )}

            {/* Pipelines salvos */}
            {pipelines.length > 0 && (
              <div className="space-y-1 border-t border-border/40 pt-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Pipelines salvos</p>
                <ul className="space-y-1">
                  {pipelines.map((p) => (
                    <li key={p.id} className="flex items-center gap-2 rounded-md bg-secondary/40 px-2 py-1">
                      <button onClick={() => loadPipeline(p)} className="flex-1 truncate text-left text-xs hover:text-primary">
                        {p.name} <span className="text-muted-foreground">({p.methodIds.length})</span>
                      </button>
                      <button onClick={() => runPipeline(p.methodIds, p.id)} disabled={!aiOk || !hasData} aria-label={`Executar ${p.name}`} className="p-1 rounded hover:bg-secondary disabled:opacity-40"><Play className="h-3 w-3" aria-hidden /></button>
                      <button onClick={() => { if (confirmDestructive(`Excluir pipeline "${p.name}"?`)) deleteMethodPipeline(p.id); }} aria-label={`Excluir ${p.name}`} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" aria-hidden /></button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>

        {/* Resultados (artefatos) */}
        {composer.length > 0 && (
          <section aria-label="Artefatos gerados" className="space-y-3">
            <h2 className="text-sm font-semibold">Artefatos do pipeline</h2>
            <div className="grid gap-3 lg:grid-cols-2">
              {composer.map((id) => {
                const m = getMethodology(id);
                if (!m) return null;
                const jobId = `met:${activePipelineId}:${id}`;
                const live = liveText[jobId];
                const saved = getAIOutput(jobId)?.markdown ?? "";
                const text = live ?? saved;
                return (
                  <div key={id} className="space-y-1">
                    <p className="text-xs font-semibold flex items-center gap-1.5">
                      {m.name}
                      <span className="text-[9px] font-normal text-muted-foreground">· {m.deliverable}</span>
                    </p>
                    {text ? (
                      <AIOutputCard
                        title={m.name}
                        description={m.deliverable}
                        storageKey={`met-${activePipelineId}-${id}`}
                        content={text}
                        streaming={!!live}
                        filename={`metodologia-${id}`}
                        className="rounded-lg border border-border/60 bg-background/60 p-3"
                        onRegenerate={live || !aiOk || !hasData ? undefined : () => runSingle(id)}
                      />
                    ) : (
                      <div className="rounded-lg border border-dashed border-border/60 px-3 py-4 text-center text-[11px] text-muted-foreground">
                        Pendente — execute o pipeline ou a metodologia individualmente.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
