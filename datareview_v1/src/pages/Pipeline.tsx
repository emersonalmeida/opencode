/**
 * Pipeline — `/pipeline` — Motor de Conhecimento (pipeline analítico recursivo).
 *
 * Implementa o briefing: separa FATO CALCULADO (camada determinística) de
 * INTERPRETAÇÃO DE IA, deixando ambos alimentarem os próximos estágios:
 *
 *   DATASET → COMPUTE (fatos) → IA#1 EXTRAÇÃO → IA#2 RACIOCÍNIO → IA#3 ESTRATÉGIA
 *
 * …com três diferenciais:
 *  1. ORQUESTRADOR que pontua cada análise (potencial × evidência × custo) e
 *     decide o que rodar — o fluxo não é linear, é um grafo de conhecimento.
 *  2. LOOP DE DESCOBERTA: a IA pode pedir `next_analysis` e o orquestrador
 *     executa, recursivamente, até nada mais justificar o custo.
 *  3. ARTEFATOS COM LINEAGE: cada etapa grava um artefato com seus inputs;
 *     de qualquer insight dá para subir até os fatos e descer até os reviews.
 *
 * Layout: modelo de 5 slots — sidebars INTERNAS da página:
 *  ESQUERDA: escopo + ações (computar fatos / loop) + StageFlow + log vivo.
 *  CENTRO: Orquestrador (tabela de scores) + detalhe do artefato.
 *  DIREITA: Vault de artefatos + Data lineage.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calculator, Database, GitBranch, Loader2, Network, Play, Square,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { PageSidebar } from "@/context/PageSidebarsContext";
import { SidebarToolTabs } from "@/components/shared/SidebarToolTabs";
import { StageFlow } from "@/components/pipeline/StageFlow";
import { OrchestratorPanel } from "@/components/pipeline/OrchestratorPanel";
import { PipelineLog, type LogLine } from "@/components/pipeline/PipelineLog";
import { ArtifactVault } from "@/components/pipeline/ArtifactVault";
import { ArtifactDetail } from "@/components/pipeline/ArtifactDetail";
import { LineagePanel } from "@/components/pipeline/LineagePanel";
import { useDataset } from "@/hooks/useDataset";
import { useSelection, entryKey } from "@/context/SelectionContext";
import { useAISettings, isAIEnabled } from "@/lib/aiSettings";
import { computeFacts } from "@/lib/pipeline/facts";
import { taskStart, taskEnd } from "@/lib/activityStore";
import { detectAnomalies } from "@/lib/pipeline/anomalies";
import { scoreAnalyses } from "@/lib/pipeline/orchestrator";
import { getAnalysis, ANALYSES } from "@/lib/pipeline/analyses";
import { AIDisabledNotice } from "@/components/shared/AIDisabledNotice";
import {
  runAnalysis, runDeterministic, runDiscoveryLoop, reanalyzeArtifact, type LoopEvent,
} from "@/lib/pipeline/runner";
import {
  useArtifacts, removeArtifact, clearArtifacts, getArtifact, listArtifacts,
} from "@/lib/pipeline/artifactStore";

export default function Pipeline({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const dataset = useDataset();
  const { selected: selectedApps } = useSelection();
  const artifacts = useArtifacts();
  const ai = useAISettings();
  const aiOn = isAIEnabled(ai);

  // Escopo: honra a seleção global (vazio = todo o dataset).
  const entries = useMemo(() => {
    if (selectedApps.size === 0) return dataset.entries;
    return dataset.entries.filter((e) => selectedApps.has(entryKey(e.app.store, e.app.id)));
  }, [dataset.entries, selectedApps]);

  const totalReviews = useMemo(() => entries.reduce((s, e) => s + e.reviews.length, 0), [entries]);

  // Orquestrador: scores reagem a dataset + artefatos (anomalias recomputadas).
  const scores = useMemo(() => {
    if (entries.length === 0) return [];
    const facts = computeFacts(entries);
    return scoreAnalyses(entries, artifacts, detectAnomalies(entries, facts));
  }, [entries, artifacts]);

  // Estado de execução
  const [log, setLog] = useState<LogLine[]>([]);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [loopRunning, setLoopRunning] = useState(false);
  const [liveText, setLiveText] = useState<string | null>(null);
  const [liveLabel, setLiveLabel] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const busy = loopRunning || runningId !== null;

  const pushEvent = useCallback((event: LoopEvent) => {
    setLog((l) => [...l.slice(-199), { ts: Date.now(), event }]);
    if (event.type === "start") {
      setRunningId(event.analysisId);
      if (event.engine === "ai") { setLiveText(""); setLiveLabel(event.label); }
    }
    if (event.type === "artifact") {
      setRunningId(null);
      setLiveText(null);
      setLiveLabel(null);
      setSelectedId(event.artifact.id);
    }
    if (event.type === "error" || event.type === "done") {
      setRunningId(null);
      setLiveText(null);
      setLiveLabel(null);
    }
  }, []);

  /** Executa UMA análise (determinística ou IA). */
  const runOne = useCallback(async (analysisId: string, parameters?: Record<string, unknown>) => {
    const spec = getAnalysis(analysisId);
    if (!spec || busy || entries.length === 0) return;
    const ac = new AbortController();
    abortRef.current = ac;
    const tid = taskStart(null, `Pipeline: ${spec.label}`, "pipeline");
    pushEvent({ type: "start", analysisId: spec.id, label: spec.label, engine: spec.engine });
    const artifact = await runAnalysis(spec, entries, {
      signal: ac.signal,
      parameters,
      onToken: (t) => setLiveText(t),
      onEvent: pushEvent,
    });
    if (artifact) {
      pushEvent({ type: "artifact", artifact });
      taskEnd(tid, "done", artifact.title);
    } else {
      setRunningId(null); setLiveText(null); setLiveLabel(null);
      taskEnd(tid, ac.signal.aborted ? "cancelled" : "error");
    }
    abortRef.current = null;
  }, [busy, entries, pushEvent]);

  /** Camada determinística completa — todas as análises COMPUTE de uma vez
   *  (rápido, sem IA). É o "Pipeline 1" do briefing. */
  const runComputeLayer = useCallback(() => {
    if (busy || entries.length === 0) return;
    const detSpecs = ANALYSES.filter((a) => a.engine === "deterministic");
    const tid = taskStart(null, `Pipeline: camada determinística (${detSpecs.length} análises)`, "pipeline");
    for (const spec of detSpecs) {
      pushEvent({ type: "start", analysisId: spec.id, label: spec.label, engine: spec.engine });
      pushEvent({ type: "artifact", artifact: runDeterministic(spec, entries, listArtifacts()) });
    }
    pushEvent({ type: "done", iterations: detSpecs.length, reason: "camada determinística concluída — fatos prontos para alimentar a IA" });
    taskEnd(tid, "done", `${detSpecs.length} artefatos de fatos`);
    setRunningId(null);
  }, [busy, entries, pushEvent]);

  /** Loop de descoberta autônomo. */
  const runLoop = useCallback(async () => {
    if (busy || entries.length === 0) return;
    setLoopRunning(true);
    const ac = new AbortController();
    abortRef.current = ac;
    const tid = taskStart(null, "Pipeline: loop de descoberta (IA)", "pipeline");
    try {
      await runDiscoveryLoop(entries, {
        signal: ac.signal,
        maxIterations: 6,
        onToken: (t) => setLiveText(t),
        onEvent: pushEvent,
      });
      taskEnd(tid, ac.signal.aborted ? "cancelled" : "done");
    } finally {
      setLoopRunning(false);
      setRunningId(null);
      setLiveText(null);
      setLiveLabel(null);
      abortRef.current = null;
    }
  }, [busy, entries, pushEvent]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setLoopRunning(false);
    setRunningId(null);
    setLiveText(null);
    setLiveLabel(null);
  }, []);

  const selectedArtifact = selectedId ? getArtifact(selectedId) ?? null : null;
  const activeStage = runningId ? getAnalysis(runningId)?.stage ?? null : null;

  if (dataset.entries.length === 0) {
    return (
      <div className="h-full flex flex-col">
        {!embedded && <AppHeader title="Pipeline" crumb="Motor de conhecimento recursivo" showSearch={false} />}
        <EmptyState
          icon={Database}
          title="O pipeline precisa de dados"
          description="Colete apps aqui mesmo para alimentar o motor: os reviews viram fatos determinísticos, que viram conhecimento de IA, que vira decisão — tudo com lineage."
          className="flex-1"
          collect
        />
      </div>
    );
  }

  return (
    <div className="h-full flex bg-background">
      {/* ---------------------------------------------------- ESQUERDA --- */}
      <PageSidebar
        meta={{
          id: "pipeline-controls", side: "left",
          title: "Pipeline", subtitle: "escopo · ações · log",
          icon: <Network className="h-4 w-4" />,
          storageKey: "aso:pipeline-left-w", defaultWidth: 300,
          railIcons: <Network className="h-4 w-4" aria-hidden />,
        }}
      >
        <div className="flex flex-col gap-2 p-2 h-full min-h-0">
          {/* Escopo */}
          <div className="rounded-lg border border-border/60 bg-card/40 px-3 py-2 flex-shrink-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Escopo</p>
            <p className="text-xs text-foreground mt-0.5">
              <strong>{entries.length}</strong> app(s) · <strong>{totalReviews}</strong> reviews
              {selectedApps.size > 0 && <span className="text-muted-foreground"> (seleção)</span>}
            </p>
          </div>

          {/* Ações */}
          <div className="space-y-1.5 flex-shrink-0">
            <button
              onClick={runComputeLayer}
              disabled={busy}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md border border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400 text-xs font-medium hover:bg-sky-500/20 transition-colors disabled:opacity-50"
            >
              <Calculator className="h-3.5 w-3.5" />
              Computar fatos (sem IA)
            </button>
            {loopRunning ? (
              <button
                onClick={stop}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md border border-destructive/40 bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors"
              >
                <Square className="h-3.5 w-3.5" />
                Parar loop
              </button>
            ) : (
              <button
                onClick={runLoop}
                disabled={busy || !aiOn}
                title={aiOn ? "O orquestrador decide e executa análises até nada mais justificar o custo" : "Ative a IA em Configurações para rodar o loop"}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                Loop de descoberta
              </button>
            )}
{!aiOn && <AIDisabledNotice compact />}
          </div>

          {/* Grafo de estágios */}
          <div className="flex-shrink-0">
            <StageFlow entries={entries} artifacts={artifacts} activeStage={activeStage} />
          </div>

          {/* Log vivo */}
          <div className="flex-1 min-h-0">
            <PipelineLog lines={log} />
          </div>
        </div>
      </PageSidebar>

      {/* ------------------------------------------------------ CENTRO --- */}
      <div className="flex-1 min-w-0 flex flex-col">
        {!embedded && (
          <AppHeader
            title="Pipeline"
            crumb="fatos → extração IA → raciocínio → estratégia · com lineage"
            showSearch={false}
            extraMenu={
              <div className="hidden md:flex items-center gap-1.5 text-[10px] text-muted-foreground py-1">
                <GitBranch className="h-3.5 w-3.5" />
                <span>{artifacts.length} artefato(s)</span>
              </div>
            }
          />
        )}
        <div className="flex-1 min-h-0 flex flex-col p-3 gap-3">
          <div className="h-[46%] min-h-[220px] flex-shrink-0">
            <OrchestratorPanel
              scores={scores}
              runningId={runningId}
              disabled={busy || entries.length === 0}
              onRun={(id) => runOne(id)}
            />
          </div>
          <div className="flex-1 min-h-0 rounded-lg border border-border/60 bg-card/40 overflow-hidden">
            <ArtifactDetail
              artifact={selectedArtifact}
              liveText={liveText}
              liveLabel={liveLabel}
              onRunAnalysis={(id, params) => runOne(id, params)}
              onReanalyze={async (artifact) => {
                if (busy) return;
                setLiveText(null);
                setLiveLabel(`Reanalisando: ${artifact.title}`);
                const ac = new AbortController();
                abortRef.current = ac;
                const novo = await reanalyzeArtifact(artifact, entries, {
                  signal: ac.signal,
                  onToken: (t) => setLiveText(t),
                  onEvent: pushEvent,
                });
                abortRef.current = null;
                setLiveText(null);
                setLiveLabel(null);
                if (novo) setSelectedId(novo.id); // mostra o novo artefato
              }}
              reanalyzing={busy}
            />
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------ DIREITA --- */}
      <PageSidebar
        meta={{
          id: "pipeline-knowledge", side: "right",
          title: "Conhecimento", subtitle: "vault · lineage",
          icon: <GitBranch className="h-4 w-4" />,
          storageKey: "aso:pipeline-right-w", defaultWidth: 320,
          railIcons: <GitBranch className="h-4 w-4" aria-hidden />,
        }}
      >
        <SidebarToolTabs
          toolLabel="Conhecimento"
          toolIcon={<GitBranch className="h-3 w-3" />}
          help={{
            description: "O Pipeline é o motor de conhecimento recursivo: separa fato calculado (determinístico) de interpretação de IA, e deixa ambos alimentarem os próximos estágios — grafo de conhecimento, não fluxo linear.",
            tips: ["Compute os fatos primeiro (sem IA, instantâneo).", "O loop de descoberta escolhe a próxima análise pelo maior potencial.", "Todo artefato guarda lineage até os reviews originais."],
          }}
        >
        <div className="flex flex-col h-full min-h-0">
          <div className="flex-1 min-h-0">
            <ArtifactVault
              artifacts={artifacts}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onRemove={removeArtifact}
              onClear={() => { clearArtifacts(); setSelectedId(null); }}
            />
          </div>
          <div className="h-[38%] min-h-[160px] flex-shrink-0 border-t border-border/50 overflow-y-auto">
            <LineagePanel
              artifact={selectedArtifact}
              entries={entries}
              onSelect={setSelectedId}
            />
          </div>
        </div>
        </SidebarToolTabs>
</PageSidebar>
    </div>
  );
}
