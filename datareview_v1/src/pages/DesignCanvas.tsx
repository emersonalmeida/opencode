import { useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Shapes, Monitor, Eye, Code, FilePlus, LayoutTemplate, Sliders } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PageSidebar } from "@/context/PageSidebarsContext";
import { SidebarToolTabs } from "@/components/shared/SidebarToolTabs";
import { DesignCanvasBoard } from "@/components/designCanvas/DesignCanvasBoard";
import { DesignCanvasPalette } from "@/components/designCanvas/DesignCanvasPalette";
import { DesignCanvasInspector, type InspectTab } from "@/components/designCanvas/DesignCanvasInspector";
import { DesignCanvasAICopilot } from "@/components/designCanvas/DesignCanvasAICopilot";
import { DesignCanvasPreview, DesignCanvasCode } from "@/components/designCanvas/DesignCanvasPreview";
import { TemplateGallery } from "@/components/designCanvas/TemplateGallery";
import { PageSwitcher } from "@/components/designCanvas/PageSwitcher";
import { useDesignStore, type ViewMode } from "@/lib/designCanvas/store";
import { useCompare } from "@/context/CompareContext";

/**
 * Design Canvas — a functional page builder (our Figma/Webflow). The user
 * composes structured pages from ALL real design-system components + real-data
 * organisms (charts, reviews, KPIs bound to the collected dataset), edits live
 * through the inspector, previews responsively (desktop/tablet/mobile), views
 * the exportable JSON, and lets the AI copilot generate whole layouts.
 *
 * Layout: system sidebar (LeftSidebar) + [palette | {design|preview|code} |
 * inspector] + system right sidebar (AIAssistantPanel).
 */
function DesignCanvasInner({ embedded = false }: { embedded?: boolean }) {
  const { entries, setPickerOpen } = useCompare();
  const [tab, setTab] = useState<InspectTab>("node");
  const [aiOpen, setAiOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const viewMode = useDesignStore((s) => s.viewMode);
  const setViewMode = useDesignStore((s) => s.setViewMode);
  const activePageId = useDesignStore((s) => s.activePageId);

  const modeBtn = (m: ViewMode, label: string, Icon: typeof Monitor) => (
    <button
      onClick={() => setViewMode(m)}
      aria-pressed={viewMode === m}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] ${viewMode === m ? "bg-primary/10 text-primary" : "hover:bg-secondary text-muted-foreground"}`}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );

  return (
    <div className="flex h-full min-h-0">
      <PageSidebar
        meta={{
          id: "design-components", side: "left",
          title: "Componentes", subtitle: "design system + dados reais",
          icon: <Shapes className="h-4 w-4" />,
          storageKey: "aso:design-left-w", defaultWidth: 240,
          railIcons: <Shapes className="h-4 w-4" aria-hidden />,
        }}
      >
        <div className="p-2 flex items-center justify-between border-b border-border/50">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Paleta de componentes</p>
          <button onClick={() => setGalleryOpen(true)} title="Galeria de templates"
            className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-primary">
            <LayoutTemplate className="h-4 w-4" />
          </button>
        </div>
        <DesignCanvasPalette />
      </PageSidebar>

      <main className="flex-1 min-w-0 flex flex-col h-full">
        {embedded ? (
          <div className="flex items-center gap-1 flex-wrap px-2 py-1.5 border-b border-border/50">
            <PageSwitcher />
            <div className="flex items-center gap-1 rounded-lg bg-muted/40 p-0.5">
              {modeBtn("design", "Design", Shapes)}
              {modeBtn("preview", "Preview", Eye)}
              {modeBtn("code", "Código", Code)}
            </div>
            <button onClick={() => useDesignStore.getState().createPage()} title="Nova página" aria-label="Nova página"
              className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-primary">
              <FilePlus className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <AppHeader
            title="Design Canvas"
            crumb="Page builder funcional"
            compare={{ count: entries.length, onOpen: () => setPickerOpen(true) }}
            showSearch={false}
            extraMenu={
              <div className="flex items-center gap-1">
                <PageSwitcher />
                <div className="flex items-center gap-1 rounded-lg bg-muted/40 p-0.5">
                  {modeBtn("design", "Design", Shapes)}
                  {modeBtn("preview", "Preview", Eye)}
                  {modeBtn("code", "Código", Code)}
                </div>
                <button onClick={() => useDesignStore.getState().createPage()} title="Nova página"
                  className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-primary">
                  <FilePlus className="h-4 w-4" />
                </button>
              </div>
            }
          />
        )}
        <div className="flex-1 min-h-0 relative">
          {viewMode === "design" ? (
            <ReactFlowProvider>
              <DesignCanvasBoard onOpenAI={() => setAiOpen(true)} />
              <DesignCanvasAICopilot open={aiOpen} onClose={() => setAiOpen(false)} />
            </ReactFlowProvider>
          ) : viewMode === "preview" ? (
            <DesignCanvasPreview />
          ) : (
            <DesignCanvasCode />
          )}
          {!activePageId && viewMode !== "design" && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-xs text-muted-foreground bg-card/80 px-3 py-2 rounded-md shadow border border-border/60 pointer-events-auto">
                Crie ou selecione uma página para visualizar.
              </div>
            </div>
          )}
        </div>
      </main>

      <PageSidebar
        meta={{
          id: "design-inspector", side: "right",
          title: "Inspector", subtitle: "props · tokens · página",
          icon: <Sliders className="h-4 w-4" />,
          storageKey: "aso:design-right-w", defaultWidth: 300,
          railIcons: <Sliders className="h-4 w-4" aria-hidden />,
        }}
      >
        <SidebarToolTabs
          toolLabel="Inspector"
          toolIcon={<Sliders className="h-3 w-3" />}
          help={{
            description: "O Design Canvas é um construtor de páginas funcionais estilo Figma: monte telas com componentes reais do design system, vincule dados coletados e pré-visualize em desktop/tablet/mobile.",
            tips: ["Arraste componentes da paleta à esquerda.", "Organismos de dados ligam ao dataset real (gráficos, KPIs, reviews).", "O copiloto de IA constrói a página por você no modo Gerar."],
          }}
        >
          <DesignCanvasInspector tab={tab} setTab={setTab} />
        </SidebarToolTabs>
      </PageSidebar>

      {galleryOpen && <TemplateGallery onClose={() => setGalleryOpen(false)} />}
    </div>
  );
}

export default function DesignCanvas({ embedded = false }: { embedded?: boolean }) {
  return <DesignCanvasInner embedded={embedded} />;
}
