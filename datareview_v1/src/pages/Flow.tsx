/**
 * `/fluxo` — a "Intelligence Journey": reúne TODAS as páginas do sistema em
 * um pipeline de 16 seções expansíveis/recolhíveis/redimensionáveis, na ordem
 * lógica de uso (missão → descobrir → … → monitorar), com:
 *
 *  - status vivo por seção derivado do estado real do sistema (Nielsen #1);
 *  - barra de missão fixa com progresso, sinais e próximo passo sugerido;
 *  - navegador de âncoras na sidebar direita (aba dinâmica "Jornada");
 *  - tríade ENTRADA → PROCESSAMENTO → SAÍDA em cada seção;
 *  - CTA "Avançar" apontando a próxima etapa — fluxo guiado de ponta a ponta.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";
import { FlowSection, type FlowIO } from "@/components/flow/FlowSection";
import { FlowMissionBar } from "@/components/flow/FlowMissionBar";
import { FlowNavigator } from "@/components/flow/FlowNavigator";
import { FlowContextPanel } from "@/components/flow/FlowContextPanel";
import { setFocusedSection } from "@/lib/flow/flowFocus";
import { PageSidebar } from "@/context/PageSidebarsContext";
import { SidebarToolTabs } from "@/components/shared/SidebarToolTabs";
import { Route, SlidersHorizontal } from "lucide-react";
import { useFlowScope } from "@/components/flow/useFlowScope";
import { SectionMission } from "@/components/flow/sections/SectionMission";
import { SectionDiscover } from "@/components/flow/sections/SectionDiscover";
import { SectionSelect } from "@/components/flow/sections/SectionSelect";
import { SectionCollect } from "@/components/flow/sections/SectionCollect";
import { SectionData } from "@/components/flow/sections/SectionData";
import { SectionVisualize } from "@/components/flow/sections/SectionVisualize";
import { SectionSignals } from "@/components/flow/sections/SectionSignals";
import { SectionInvestigate } from "@/components/flow/sections/SectionInvestigate";
import { SectionAgents } from "@/components/flow/sections/SectionAgents";
import { SectionKnowledge } from "@/components/flow/sections/SectionKnowledge";
import { SectionDecide } from "@/components/flow/sections/SectionDecide";
import { SectionOpportunities } from "@/components/flow/sections/SectionOpportunities";
import { SectionExperiment } from "@/components/flow/sections/SectionExperiment";
import { SectionArtifacts } from "@/components/flow/sections/SectionArtifacts";
import { SectionPresent } from "@/components/flow/sections/SectionPresent";
import { SectionMonitor } from "@/components/flow/sections/SectionMonitor";
import {
  FLOW_SECTIONS, allSectionStates, flowProgress, nextSuggestedSection, sectionForTask,
  type FlowSectionId, type FlowSectionState, type FlowSnapshot, type FlowStatus,
} from "@/lib/flow/flowModel";
import { useInsights } from "@/lib/insightStore";
import { useArtifacts } from "@/lib/pipeline/artifactStore";
import { useLabFindings, useLabProductCandidates } from "@/lib/lab/hooks";
import { useAIOutputs } from "@/lib/aiOutputStore";
import { useGenerations } from "@/hooks/useSessions";
import { useCanvasStore } from "@/lib/canvasStore";
import { useDesignStore } from "@/lib/designCanvas/store";
import { useActiveTaskCount, useTrackedTasks } from "@/lib/activityStore";
import { listDecks, subscribePresentations, type Deck } from "@/lib/presentations";

/** Rola até a seção, expande e marca o foco (alimenta a direita contextual). */
function goToSection(id: string) {
  window.dispatchEvent(new CustomEvent("flow:open", { detail: id }));
  setFocusedSection(id as FlowSectionId);
  requestAnimationFrame(() => {
    document.getElementById(`flow-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

export default function Flow() {
  const { entries, selected, totalReviews } = useFlowScope();
  const insights = useInsights();
  const artifacts = useArtifacts();
  const findings = useLabFindings();
  const candidates = useLabProductCandidates();
  const outputs = useAIOutputs();
  const generations = useGenerations();
  const canvasNodes = useCanvasStore((s) => s.nodes);
  const designPages = useDesignStore((s) => s.pages);
  const runningTasks = useActiveTaskCount();
  const [decks, setDecks] = useState<Deck[]>(() => listDecks());
  useEffect(() => subscribePresentations(() => setDecks(listDecks())), []);

  const snapshot: FlowSnapshot = useMemo(
    () => ({
      apps: entries.length,
      reviews: totalReviews,
      selected: selected.size,
      insights: insights.length,
      artifacts: artifacts.length,
      findings: findings.length,
      candidates: candidates.length,
      decks: decks.length,
      outputs: outputs.length,
      generations: generations.length,
      canvasNodes: canvasNodes.length,
      designPages: designPages.length,
    }),
    [entries, totalReviews, selected, insights, artifacts, findings, candidates, decks, outputs, generations, canvasNodes, designPages],
  );

  const baseStates = useMemo(() => allSectionStates(snapshot), [snapshot]);

  /**
   * Override por atividade viva: tarefas running/streaming mapeiam para sua
   * seção pelo vocabulário determinístico (`sectionForTask`). streaming =
   * "processing" (IA gerando), running = "executando".
   */
  const trackedTasks = useTrackedTasks();
  const states = useMemo(() => {
    const out = { ...baseStates } as Record<FlowSectionId, FlowSectionState>;
    const active = trackedTasks.filter(
      (t) => t.status === "running" || t.status === "streaming" || t.status === "queued",
    );
    for (const t of active) {
      const secId = sectionForTask(t);
      if (!secId) continue;
      const base = out[secId];
      if (!base || base.status === "done" || base.status === "done-warning") continue;
      const ov: FlowStatus =
        t.status === "streaming" ? "processing" : t.status === "queued" ? "running" : "running";
      out[secId] = { status: ov, detail: t.detail ?? base.detail };
    }
    return out;
  }, [baseStates, trackedTasks]);

  const progress = useMemo(() => flowProgress(states), [states]);
  const next = useMemo(() => nextSuggestedSection(states), [states]);

  /**
   * Auto-avanço: quando uma etapa é concluída e uma nova seção vira o
   * "próximo passo", expande+rola até ela automaticamente. Não dispara no
   * mount (ref inicia com o id atual) — só em transições posteriores.
   */
  const prevNextRef = useRef<string | null>(null);
  useEffect(() => {
    if (!next) return;
    if (prevNextRef.current !== null && prevNextRef.current !== next.id) {
      goToSection(next.id);
    }
    prevNextRef.current = next.id;
  }, [next]);

  const renderers: Record<FlowSectionId, ReactNode> = {
    missao: <SectionMission />,
    descobrir: <SectionDiscover />,
    selecionar: <SectionSelect />,
    coletar: <SectionCollect />,
    dados: <SectionData />,
    visualizar: <SectionVisualize />,
    sinais: <SectionSignals />,
    investigar: <SectionInvestigate />,
    agentes: <SectionAgents />,
    conhecimento: <SectionKnowledge />,
    decidir: <SectionDecide />,
    oportunidades: <SectionOpportunities />,
    experimentar: <SectionExperiment />,
    artefatos: <SectionArtifacts />,
    apresentar: <SectionPresent />,
    monitorar: <SectionMonitor onRestart={() => goToSection("descobrir")} />,
  };

  const io = useCallback(
    (id: FlowSectionId): FlowIO => {
      const s = snapshot;
      const fmt = (n: number) => n.toLocaleString("pt-BR");
      const map: Record<FlowSectionId, FlowIO> = {
        missao: { input: "objetivo", processing: "configuração", output: "escopo definido" },
        descobrir: { input: "busca + top charts", processing: "Apple + Google", output: `${fmt(s.apps)} app(s)` },
        selecionar: { input: `${fmt(s.apps)} app(s)`, processing: "escopo", output: s.selected > 0 ? `${s.selected} selecionado(s)` : "todos" },
        coletar: { input: `${fmt(s.apps)} app(s)`, processing: "download (dedup)", output: `${fmt(s.reviews)} reviews` },
        dados: { input: `${fmt(s.reviews)} reviews`, processing: "validação + exportação", output: "dataset auditado" },
        visualizar: { input: `${fmt(s.reviews)} reviews`, processing: "analytics determinístico", output: "KPIs + gráficos" },
        sinais: { input: "dataset", processing: "fatos + anomalias", output: s.artifacts > 0 ? `${s.artifacts} artefato(s)` : "sinais" },
        investigar: { input: "dataset", processing: "IA (seções/Atlas)", output: `${s.outputs + s.insights} saída(s)` },
        agentes: { input: "dataset", processing: "pipelines de etapas", output: "lentes especializadas" },
        conhecimento: { input: "saídas de IA", processing: "consolidação", output: `${s.insights + s.artifacts + s.findings} registro(s)` },
        decidir: { input: "conhecimento", processing: "personas (lentes)", output: `${s.outputs} análise(s)` },
        oportunidades: { input: "findings", processing: "Lab", output: `${s.candidates} candidato(s)` },
        experimentar: { input: "ideias", processing: "protótipos", output: `${s.canvasNodes} nós · ${s.designPages} página(s)` },
        artefatos: { input: "gerações", processing: "inventário", output: `${s.generations} sessão(ões)` },
        apresentar: { input: "dataset", processing: "deck builder", output: `${s.decks} deck(s)` },
        monitorar: { input: "atividade", processing: "tempo real", output: "próximo ciclo" },
      };
      return map[id];
    },
    [snapshot],
  );

  return (
    <>
      <AppHeader title="System Flow" crumb="jornada de inteligência de ponta a ponta" showSearch={false} />
      {/* Sidebars INTERNAS da página: esquerda = mapa da jornada; direita =
          painel contextual da seção em foco. (Modelo de 5 colunas.) */}
      <PageSidebar
        meta={{
          id: "flow-nav", side: "left",
          title: "System Flow", subtitle: "mapa da jornada",
          icon: <Route className="h-4 w-4" />,
          storageKey: "aso:flow-left-w", defaultWidth: 240,
          railIcons: <Route className="h-4 w-4" aria-hidden />,
        }}
      >
        <FlowNavigator states={states} progress={progress} onGoTo={goToSection} />
      </PageSidebar>
      <PageSidebar
        meta={{
          id: "flow-contexto", side: "right",
          title: "Contexto", subtitle: "seção em foco",
          icon: <SlidersHorizontal className="h-4 w-4" />,
          storageKey: "aso:flow-right-w", defaultWidth: 300,
          railIcons: <SlidersHorizontal className="h-4 w-4" aria-hidden />,
        }}
      >
        <SidebarToolTabs
          toolLabel="Contexto"
          toolIcon={<SlidersHorizontal className="h-3 w-3" />}
          help={{
            description: "O Fluxo é a jornada completa do sistema em 16 seções guiadas: da missão e descoberta de apps até decisões e apresentação. Cada seção mostra entrada, processamento e saída.",
            tips: ["Siga o CTA 'Próximo passo' — a jornada avança sozinha.", "O mapa à esquerda mostra o estado de cada seção.", "Cada seção abre a página especializada correspondente."],
          }}
        >
          <FlowContextPanel fallback={next?.id ?? null} states={states} />
        </SidebarToolTabs>
      </PageSidebar>
      <div className="content-fluid mx-auto max-w-6xl space-y-4 px-1 pb-20">
        <FlowMissionBar
          snapshot={snapshot}
          progress={progress}
          next={next}
          runningTasks={runningTasks}
          onGoTo={goToSection}
        />
        <p className="text-xs text-muted-foreground" role="doc-tip">
          As 16 etapas abaixo incorporam as capacidades de todas as páginas do sistema,
          na ordem lógica de uso. Cada etapa é expansível, recolhível e redimensionável —
          e tem atalho para a página completa.
        </p>
        {FLOW_SECTIONS.map((def, idx) => (
          <FlowSection
            key={def.id}
            def={def}
            state={states[def.id]}
            io={io(def.id)}
            next={
              idx + 1 < FLOW_SECTIONS.length
                ? { id: FLOW_SECTIONS[idx + 1].id, title: FLOW_SECTIONS[idx + 1].title }
                : null
            }
            onGoTo={goToSection}
          >
            {renderers[def.id]}
          </FlowSection>
        ))}
      </div>
    </>
  );
}
