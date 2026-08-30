/**
 * EmbeddedSurface — renderiza uma superfície REAL do sistema dentro de outra
 * superfície (chat, saída de IA, modal). O componente embutido é o mesmo das
 * páginas — totalmente interativo, sem simulação.
 *
 * O registry de metadados (id/label/keywords) é puro e vive em
 * `src/lib/embeddableSurfaces.ts`; aqui fica o mapeamento id → componente.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronsUpDown, ChevronsDownUp, ExternalLink, Maximize2, Minus } from "lucide-react";
import { EMBEDDABLE_SURFACES, type EmbeddableSurfaceDef } from "@/lib/embeddableSurfaces";
import { FeatureModal } from "@/components/shared/FeatureModal";
import { ErrorBoundary } from "@/components/dashboard/ErrorBoundary";
import { PipelineArtifactsPanel } from "@/components/page01/panels";
import { SidebarChartsPanel } from "@/components/SidebarChartsPanel";
import { CollectedDataPanel, DataQualityPanel, FeatureFlagsPanel, CollectionConfigPanel } from "@/components/page01/panels";
import { SessionsPanel } from "@/components/SessionsPanel";
import { InsightsPanel, ActivityPanel } from "@/components/pageSidebars/kit";
import { AppsPanel } from "@/components/AppsPanel";
import { AISettingsPanel } from "@/components/AISettingsPanel";
import { TopCharts } from "@/components/TopCharts";
import { AIOutputCard } from "@/components/shared/AIOutputCard";
import { UniSourcePicker } from "@/components/shared/UniSourcePicker";
import { useAIOutputs } from "@/lib/aiOutputStore";
import { UniOutputPanel } from "@/components/uni/UniOutputPanel";

/** Relatório: últimas saídas de IA do sistema (todas as superfícies). */
function ReportPanel() {
  const outputs = useAIOutputs();
  const recent = outputs.slice(0, 5);
  if (recent.length === 0) {
    return (
      <p className="text-muted-foreground p-3 text-xs">
        Nenhum relatório gerado ainda. Peça uma análise no chat ou rode uma
        seção na página Experimentos.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3 p-1">
      {recent.map((r) => (
        <AIOutputCard
          key={r.key}
          title={r.section}
          content={r.markdown}
          filename={`relatorio-${r.section}`}
          provenance={r.provenance}
          defaultLevel="collapsed"
          storageKey={`embedded:${r.key}`}
          analyzeWithAI={false}
        />
      ))}
    </div>
  );
}

/** Mapa id → componente real. Toda entrada do registry tem renderer. */
const SURFACE_RENDERERS: Record<string, () => ReactNode> = {
  pipeline: () => <PipelineArtifactsPanel />,
  charts: () => <SidebarChartsPanel />,
  dataset: () => <CollectedDataPanel />,
  "data-quality": () => <DataQualityPanel />,
  generations: () => <SessionsPanel embedded />,
  insights: () => <InsightsPanel />,
  activity: () => <ActivityPanel />,
  apps: () => <AppsPanel />,
  "collection-config": () => <CollectionConfigPanel />,
  "feature-flags": () => <FeatureFlagsPanel />,
  "ai-settings": () => <AISettingsPanel />,
  "top-charts": () => <TopCharts />,
  "uni-sources": () => <UniOutputPanel />,
  "uni-picker": () => <UniSourcePicker />,
  report: () => <ReportPanel />,
};

export function surfaceRendererExists(id: string): boolean {
  return id in SURFACE_RENDERERS;
}

type SurfaceLevel = "collapsed" | "default" | "expanded";
const LEVEL_ORDER: SurfaceLevel[] = ["collapsed", "default", "expanded"];

interface Props {
  /** Id da superfície (do registry). */
  id: string;
  /** Começa recolhida (default false — conteúdo sempre visível). */
  defaultCollapsed?: boolean;
}

/**
 * Bloco de componente embutido: header (label + descrição + link p/ a página
 * de origem + níveis + modal) + corpo com o componente real dentro de
 * ErrorBoundary. Níveis (persistidos por superfície):
 *   collapsed → só o header · default → altura limitada + scroll ·
 *   expanded → conteúdo completo (cresce com o componente).
 * O botão Maximizar abre a MESMA superfície num modal — o usuário usa o
 * componente em tela cheia sem sair do chat.
 */
export function EmbeddedSurface({ id, defaultCollapsed = false }: Props) {
  const def: EmbeddableSurfaceDef | undefined = EMBEDDABLE_SURFACES.find((s) => s.id === id);
  const [level, setLevel] = useState<SurfaceLevel>(() => {
    if (defaultCollapsed) return "collapsed";
    try {
      const v = localStorage.getItem(`aso:embedded-level:${id}`);
      return v === "collapsed" || v === "default" || v === "expanded" ? v : "default";
    } catch { return "default"; }
  });
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(`aso:embedded-level:${id}`, level); } catch { /* quota */ }
  }, [id, level]);

  if (!def || !surfaceRendererExists(id)) {
    return (
      <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground" role="alert">
        Superfície desconhecida: <code>{id}</code>. Disponíveis:{" "}
        {EMBEDDABLE_SURFACES.map((s) => s.id).join(", ")}.
      </div>
    );
  }

  const cycle = () => setLevel(LEVEL_ORDER[(LEVEL_ORDER.indexOf(level) + 1) % LEVEL_ORDER.length]);
  const levelLabel =
    level === "expanded" ? "Recolher para altura padrão"
    : level === "default" ? "Expandir conteúdo completo"
    : "Expandir";

  return (
    <section
      className="not-prose my-2 overflow-hidden rounded-lg border border-primary/30 bg-card/80"
      aria-label={`Componente embutido: ${def.label}`}
      aria-expanded={level !== "collapsed"}
    >
      <header className="flex items-center gap-2 border-b border-border/40 bg-secondary/40 px-2.5 py-1.5">
        <button
          type="button"
          onClick={cycle}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
          aria-expanded={level !== "collapsed"}
          aria-label={level === "collapsed" ? `Expandir ${def.label}` : `Recolher ${def.label}`}
        >
          {level === "collapsed" ? (
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
          ) : (
            <ChevronsDownUp className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
          )}
          <span className="truncate text-xs font-semibold">{def.label}</span>
          <span className="hidden truncate text-[10px] text-muted-foreground sm:inline">
            — {def.description}
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button" onClick={() => setModalOpen(true)}
            title="Abrir em tela cheia (modal)" aria-label={`Abrir ${def.label} em tela cheia`}
            className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <Maximize2 className="h-3 w-3" aria-hidden="true" />
          </button>
          {level !== "collapsed" && (
            <button
              type="button" onClick={() => setLevel("collapsed")}
              title="Recolher (só título)" aria-label={`Recolher ${def.label} (só título)`}
              className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              <Minus className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
          <Link
            to={def.originPath}
            className="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-secondary hover:text-foreground"
            title={`Abrir ${def.label} na página ${def.originPath}`}
          >
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
            <span className="hidden sm:inline">Abrir página</span>
          </Link>
        </div>
      </header>
      {level !== "collapsed" && (
        <div className={level === "default" ? "max-h-[480px] overflow-y-auto p-2" : "p-2"}>
          <ErrorBoundary title={`Erro ao renderizar ${def.label}`}>
            {SURFACE_RENDERERS[id]()}
          </ErrorBoundary>
        </div>
      )}

      {modalOpen && (
        <FeatureModal
          open={modalOpen} onOpenChange={setModalOpen}
          title={def.label} description={def.description} size="lg"
        >
          <ErrorBoundary title={`Erro ao renderizar ${def.label}`}>
            {SURFACE_RENDERERS[id]()}
          </ErrorBoundary>
        </FeatureModal>
      )}
    </section>
  );
}
