/**
 * Analysis Atlas — `/atlas`
 *
 * Um "Analysis OS" para App Intelligence. Catálogo/registry de módulos de
 * análise onde cada um declara um contrato completo (input → processamento →
 * output → evidência → confiança → score → visualização). A página funciona
 * como um EXPLORER dessas análises, permitindo combinar módulos em pipelines
 * que são materializados no Canvas existente.
 *
 * Princípio do briefing (ponto 73): NÃO uma página com 100 botões de
 * análises — um catálogo onde cada metodologia declara seu contrato, e a
 * página permite explorar e compor.
 *
 * Colunas (modelo de 5 slots — sidebars INTERNAS da página):
 *  - ESQUERDA: AtlasTree (árvore DATA LAB: 10 domínios → módulos) + busca.
 *  - CENTRO: ModuleContract (contrato do módulo selecionado + executar +
 *    enviar ao canvas + resultado IA).
 *  - DIREITA: PipelineComposer (módulos combinados → carregar no Canvas).
 *
 * Reuso: dataset + seleção global (useSelection) + IA (experiment-analyze) +
 * Canvas (useCanvasStore.appendGraph). Sem modelo paralelo.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { Search, Workflow, Rocket } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PageSidebar } from "@/context/PageSidebarsContext";
import { SidebarToolTabs } from "@/components/shared/SidebarToolTabs";
import { AtlasTree } from "@/components/analysisAtlas/AtlasTree";
import { ModuleContract } from "@/components/analysisAtlas/ModuleContract";
import { PipelineComposer } from "@/components/analysisAtlas/PipelineComposer";
import { ANALYSIS_MODULES, moduleStats, modulesByGroup } from "@/lib/analysisAtlas/registry";
import { runModules } from "@/lib/analysisAtlas/canvasBridge";
import { recordGeneration } from "@/lib/sessionStore";
import { useSelection, entryKey } from "@/context/SelectionContext";
import { useDataset } from "@/hooks/useDataset";
import type { AnalysisModule } from "@/lib/analysisAtlas/types";

const FIRST_MODULE = ANALYSIS_MODULES[0];

export default function AnalysisAtlas({ embedded = false }: { embedded?: boolean }) {
  const [selected, setSelected] = useState<AnalysisModule | null>(FIRST_MODULE);
  const [pipeline, setPipeline] = useState<AnalysisModule[]>([]);
  const stats = useMemo(() => moduleStats(), []);
  const { selected: selectedApps } = useSelection();
  const dataset = useDataset();

  // Effective entries: honra a seleção global (vazio = todo o dataset).
  const effectiveEntries = useMemo(() => {
    if (selectedApps.size === 0) return dataset.entries;
    return dataset.entries.filter((e) => selectedApps.has(entryKey(e.app.store, e.app.id)));
  }, [dataset.entries, selectedApps]);

  // Multi-module run state (pipeline / category / full). Owned here so the
  // result panel can live in the center column regardless of trigger source.
  const [runTitle, setRunTitle] = useState<string | null>(null);
  const [runResult, setRunResult] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ idx: number; total: number; label: string } | null>(null);
  const [runErr, setRunErr] = useState<string | null>(null);
  const [runNote, setRunNote] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const select = useCallback((m: AnalysisModule) => setSelected(m), []);

  const addToPipeline = useCallback((m: AnalysisModule) => {
    setPipeline((p) => {
      if (p.some((x) => x.id === m.id)) return p;
      return [...p, m];
    });
  }, []);

  const removeFromPipeline = useCallback((id: string) => {
    setPipeline((p) => p.filter((x) => x.id !== id));
  }, []);

  const inPipeline = selected ? pipeline.some((x) => x.id === selected.id) : false;

  /** Executa um conjunto de módulos (individual / categoria / pipeline / tudo). */
  const execute = useCallback(async (mods: AnalysisModule[], title: string) => {
    if (running || mods.length === 0) return;
    if (effectiveEntries.length === 0) {
      setRunTitle(title);
      setRunResult("");
      setRunErr("Colete ou selecione apps para rodar a análise.");
      return;
    }
    setRunning(true);
    setRunTitle(title);
    setRunResult("");
    setRunErr(null);
    setRunNote(null);
    setProgress(null);
    const ac = new AbortController();
    abortRef.current = ac;
    let finalMarkdown = "";
    try {
      const { skipped } = await runModules(mods, effectiveEntries, {
        onToken: (full) => { finalMarkdown = full; setRunResult(full); },
        onDone: (full) => { finalMarkdown = full; setRunResult(full); },
        onError: (e) => setRunErr(e),
        onProgress: (idx, total, mod) => setProgress({ idx: idx + 1, total, label: mod.label }),
      }, ac.signal);
      if (skipped.length > 0) {
        setRunNote(`${skipped.length} módulo(s) determinístico(s) pulado(s) — rodam no Canvas (envie-os via "Enviar ao Canvas").`);
      }
      // Persiste a geração para o histórico de sessões (nunca se perde).
      try {
        recordGeneration({
          type: "atlas-run",
          title,
          appKeys: effectiveEntries.map((e) => `${e.app.store}:${e.app.id}`),
          markdown: finalMarkdown,
          source: "atlas",
        });
      } catch { /* logging never breaks the run */ }
    } catch (e) {
      setRunErr(e instanceof Error ? e.message : "Falha ao executar.");
    } finally {
      setRunning(false);
      setProgress(null);
      abortRef.current = null;
    }
  }, [running, effectiveEntries]);

  const cancelRun = useCallback(() => {
    abortRef.current?.abort();
    setRunning(false);
    setProgress(null);
  }, []);

  return (
    <div className="h-full flex bg-background">
      {/* LEFT — árvore de módulos (sidebar interna da página) */}
      <PageSidebar
        meta={{
          id: "atlas-modules", side: "left",
          title: "Atlas", subtitle: "Módulos de análise",
          icon: <Search className="h-4 w-4" />,
          storageKey: "aso:atlas-left-w", defaultWidth: 280,
          railIcons: <Search className="h-4 w-4" aria-hidden />,
        }}
      >
        <AtlasTree
          selectedId={selected?.id ?? null}
          onSelect={select}
          pipelineIds={pipeline.map((p) => p.id)}
          onRunGroup={(g) => execute(modulesByGroup(g), `Categoria: ${g}`)}
          onRunAll={() => execute(ANALYSIS_MODULES, "Pipeline completo (todos os módulos)")}
          running={running}
        />
      </PageSidebar>

      {/* CENTER — contract + run results */}
      <div className="flex-1 min-w-0 flex flex-col">
        {!embedded && (
          <AppHeader
            title="Analysis Atlas"
            crumb="Analysis OS · input → output → evidência → score"
            showSearch={false}
            extraMenu={
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground py-1">
                <Workflow className="h-3.5 w-3.5" />
                <span>{pipeline.length} no pipeline</span>
                <Rocket className="h-3.5 w-3.5 ml-1" />
                <span>{stats.total} módulos</span>
              </div>
            }
          />
        )}
        <div className="flex-1 min-h-0">
          <ModuleContract
            module={selected}
            onAddToPipeline={addToPipeline}
            inPipeline={inPipeline}
            runTitle={runTitle}
            runResult={runResult}
            running={running}
            progress={progress}
            runErr={runErr}
            runNote={runNote}
            onCancelRun={cancelRun}
            onRunPipeline={() => execute(pipeline, `Pipeline (${pipeline.length} módulos)`)}
            hasPipeline={pipeline.length > 0}
          />
        </div>
      </div>

      {/* RIGHT — compositor de pipeline (sidebar interna da página) */}
      <PageSidebar
        meta={{
          id: "atlas-pipeline", side: "right",
          title: "Pipeline", subtitle: "Compor e executar",
          icon: <Workflow className="h-4 w-4" />,
          storageKey: "aso:atlas-right-w", defaultWidth: 280,
          railIcons: <Workflow className="h-4 w-4" aria-hidden />,
        }}
      >
        <SidebarToolTabs
          toolLabel="Pipeline"
          toolIcon={<Workflow className="h-3 w-3" />}
          help={{
            description: "O Atlas é o catálogo de módulos de análise: cada módulo declara o contrato input → processamento → evidência → score. Selecione módulos na árvore, execute individualmente ou componha um pipeline e envie ao Canvas.",
            tips: ["Execute um módulo ou uma categoria inteira pela árvore à esquerda.", "O pipeline à direita encadeia módulos e roda em sequência.", "Cada módulo mostra evidências reais do dataset coletado."],
          }}
        >
          <PipelineComposer
            pipeline={pipeline}
            onReorder={setPipeline}
            onRemove={removeFromPipeline}
            onClear={() => setPipeline([])}
            onRun={() => execute(pipeline, `Pipeline (${pipeline.length} módulos)`)}
            running={running}
          />
        </SidebarToolTabs>
      </PageSidebar>
    </div>
  );
}
