/**
 * Página 01 (`/01`) — hub analítico completo: TUDO do sistema num só lugar.
 *
 * 3 colunas responsivas (além das sidebars EXTERNAS do sistema, que voltaram
 * a aparecer nesta rota): 2 sidebars internas divididas em blocos verticais
 * + o chat com IA no centro fluido.
 *
 *  ┌────────────────────┬──────────────────────┬────────────────────┐
 *  │ ESQ superior       │ CENTRO               │ DIR superior       │
 *  │ ▸ Coleta           │ Chat com IA completo │ ▸ IA (modo/modelo) │
 *  │ ▸ Configuração     │ (<Chat embedded/>)   │ ▸ Prompts          │
 *  │ ▸ Histórico        │ análises · pipelines │ ▸ Voz              │
 *  │ ────────────────── │ · voz · sugestões    │ ▸ Recursos (flags) │
 *  │ ESQ inferior       │                      │ ────────────────── │
 *  │ ▸ Coletados        │                      │ DIR inferior       │
 *  │ ▸ Qualidade        │                      │ ▸ Análises         │
 *  │ ▸ Atividade        │                      │ ▸ Pipeline         │
 *  │                    │                      │ ▸ Gerações         │
 *  │                    │                      │ ▸ Insights         │
 *  └────────────────────┴──────────────────────┴────────────────────┘
 *  TOP bar: AppHeader · BOTTOM bar: escopo + status do sistema + fila de IA.
 *
 * Cada bloco: abas próprias, recolhível, divisor arrastável (persistido) e
 * largura da coluna ajustável (ResizeHandle do PageSidebar). Todas as
 * superfícies honram a seleção global (escopo vazio = dataset todo).
 *
 * A sidebar esquerda responde à jornada mental do usuário:
 *  - Superior (Coleta/Config/Histórico): "o que eu tenho que fazer? o que
 *    posso fazer? quais as possibilidades?" — pesquisar, configurar e rever
 *    tudo que já foi feito no sistema.
 *  - Inferior (Coletados/Qualidade/Atividade): "o que foi feito? o que foi
 *    coletado? o que posso fazer com isso?" — os dados organizados por loja.
 */
import { useMemo, useState } from "react";
import {
  Search, History, Database, ShieldCheck, Activity, Columns3,
  BrainCircuit, MessageSquareCode, Volume2, ToggleRight, BarChart3,
  Workflow, Archive, Lightbulb, Settings2, Layers,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PageSidebar } from "@/context/PageSidebarsContext";
import { SplitColumn, TabsBlock, type SplitTab } from "@/components/page01/SplitColumn";
import {
  CollectedListPanel, CollectionConfigPanel, SystemHistoryPanel,
  DataQualityPanel, FeatureFlagsPanel, PipelineArtifactsPanel,
} from "@/components/page01/panels";
import { AppsPanel } from "@/components/AppsPanel";
import { SidebarChartsPanel } from "@/components/SidebarChartsPanel";
import { SessionsPanel } from "@/components/SessionsPanel";
import { InsightsPanel, ActivityPanel } from "@/components/pageSidebars/kit";
import { AISettingsPanel } from "@/components/AISettingsPanel";
import { AIBehaviorToggles, PromptsEditor } from "@/components/SettingsPanel";
import { AssistantVoicePanel } from "@/components/assistant/AssistantPanels";
import { VoiceDiagnostics } from "@/components/assistant/VoiceDiagnostics";
import { SystemStatusIndicator } from "@/components/SystemStatusIndicator";
import { IAQueueBar } from "@/components/shared/IAQueueBar";
import Chat from "@/pages/Chat";
import { useDataset } from "@/hooks/useDataset";
import { useSelection } from "@/context/SelectionContext";

const ic = "h-3.5 w-3.5";

export default function Page01() {
  const { entries } = useDataset();
  const { selected } = useSelection();
  /** Remonta o Chat quando a rota ganha/perde ?session= (restore de conversa). */
  const [chatKey] = useState(0);

  const scopeLabel = useMemo(() => {
    if (entries.length === 0) return "Dataset vazio — busque e colete na aba Coleta";
    if (selected.size === 0) return `Escopo: todos os ${entries.length} app(s)`;
    return `Escopo: ${selected.size} de ${entries.length} app(s)`;
  }, [entries, selected]);

  /* -------------------------------------------------------- abas ESQ sup ---
   * Coleta (busca→resultados→coletar) · Config (todas as configs de coleta) ·
   * Histórico (tudo que já foi feito no sistema). */
  const leftTopTabs: SplitTab[] = [
    {
      id: "coleta", label: "Coleta", icon: <Search className={ic} />,
      content: <AppsPanel />,
    },
    {
      id: "config", label: "Config", icon: <Settings2 className={ic} />,
      content: <CollectionConfigPanel />,
    },
    {
      id: "historico", label: "Histórico", icon: <History className={ic} />,
      content: <SystemHistoryPanel />,
    },
  ];

  /* -------------------------------------------------------- abas ESQ inf ---
   * Coletados (lista organizada por loja) · Qualidade · Atividade. */
  const leftBottomTabs: SplitTab[] = [
    {
      id: "coletados", label: "Coletados", icon: <Layers className={ic} />,
      content: <CollectedListPanel />,
    },
    {
      id: "qualidade", label: "Qualidade", icon: <ShieldCheck className={ic} />,
      content: <DataQualityPanel />,
    },
    {
      id: "atividade", label: "Atividade", icon: <Activity className={ic} />,
      content: <ActivityPanel />,
    },
  ];

  /* -------------------------------------------------------- abas DIR sup --- */
  const rightTopTabs: SplitTab[] = [
    {
      id: "ia", label: "IA", icon: <BrainCircuit className={ic} />,
      content: (
        <div className="space-y-1 p-1">
          <AISettingsPanel />
          <div className="px-2">
            <AIBehaviorToggles />
          </div>
        </div>
      ),
    },
    {
      id: "prompts", label: "Prompts", icon: <MessageSquareCode className={ic} />,
      content: <div className="p-2"><PromptsEditor /></div>,
    },
    {
      id: "voz", label: "Voz", icon: <Volume2 className={ic} />,
      content: (
        <div className="space-y-4">
          <AssistantVoicePanel />
          <div className="px-3"><VoiceDiagnostics /></div>
        </div>
      ),
    },
    {
      id: "recursos", label: "Recursos", icon: <ToggleRight className={ic} />,
      content: <FeatureFlagsPanel />,
    },
  ];

  /* -------------------------------------------------------- abas DIR inf --- */
  const rightBottomTabs: SplitTab[] = [
    {
      id: "analises", label: "Análises", icon: <BarChart3 className={ic} />,
      content: <SidebarChartsPanel />,
    },
    {
      id: "pipeline", label: "Pipeline", icon: <Workflow className={ic} />,
      content: <PipelineArtifactsPanel />,
    },
    {
      id: "geracoes", label: "Gerações", icon: <Archive className={ic} />,
      content: <SessionsPanel embedded />,
    },
    {
      id: "insights", label: "Insights", icon: <Lightbulb className={ic} />,
      content: <InsightsPanel />,
    },
  ];

  const railLeft = (
    <>
      <Search className="h-4 w-4 text-muted-foreground" aria-label="Coleta" />
      <Settings2 className="h-4 w-4 text-muted-foreground" aria-label="Configuração de coleta" />
      <History className="h-4 w-4 text-muted-foreground" aria-label="Histórico" />
      <Layers className="h-4 w-4 text-muted-foreground" aria-label="Coletados" />
      <Database className="h-4 w-4 text-muted-foreground" aria-label="Dados" />
    </>
  );
  const railRight = (
    <>
      <BrainCircuit className="h-4 w-4 text-muted-foreground" aria-label="Configurações de IA" />
      <BarChart3 className="h-4 w-4 text-muted-foreground" aria-label="Análises" />
      <Archive className="h-4 w-4 text-muted-foreground" aria-label="Gerações" />
    </>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* TOP BAR */}
      <AppHeader title="01" crumb="hub analítico completo" />

      {/* Coluna ESQUERDA — 2 blocos verticais: coleta/config/histórico + dados */}
      <PageSidebar
        id="page01:left"
        side="left"
        title="01 · Coleta"
        subtitle="buscar · configurar · revisar"
        icon={<Columns3 className="h-4 w-4" />}
        storageKey="aso:page01-left-w"
        defaultWidth={290}
        railIcons={railLeft}
        content={
          <SplitColumn
            storageKey="aso:page01-split-left"
            top={<TabsBlock tabs={leftTopTabs} storageKey="aso:page01-left-top" defaultTab="coleta" className="h-full" />}
            bottom={<TabsBlock tabs={leftBottomTabs} storageKey="aso:page01-left-bottom" defaultTab="coletados" className="h-full" />}
          />
        }
      />

      {/* Coluna DIREITA — 2 blocos verticais: config de IA + saídas/dados gerados */}
      <PageSidebar
        id="page01:right"
        side="right"
        title="IA & saídas"
        subtitle="config · análises · gerações"
        icon={<Settings2 className="h-4 w-4" />}
        storageKey="aso:page01-right-w"
        defaultWidth={330}
        railIcons={railRight}
        content={
          <SplitColumn
            storageKey="aso:page01-split-right"
            top={<TabsBlock tabs={rightTopTabs} storageKey="aso:page01-right-top" defaultTab="ia" className="h-full" />}
            bottom={<TabsBlock tabs={rightBottomTabs} storageKey="aso:page01-right-bottom" defaultTab="analises" className="h-full" />}
          />
        }
      />

      {/* CENTRO — o chat completo com IA (rota /chat embutida) */}
      <Chat embedded key={chatKey} />

      {/* BOTTOM BAR — escopo, status do sistema e fila global de IA */}
      <div
        role="contentinfo"
        className="shrink-0 border-t border-border/50 bg-card/50 px-3 py-1.5 flex flex-wrap items-center gap-2 text-[11px]"
      >
        <span className="text-muted-foreground" role="status">
          <Database className="mr-1 inline h-3 w-3" aria-hidden="true" />
          {scopeLabel}
        </span>
        <SystemStatusIndicator />
        <IAQueueBar />
      </div>
    </div>
  );
}
