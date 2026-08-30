/**
 * CanvasSidebarTabs — sidebars INTERNAS do /canvas (modelo de 5 colunas):
 *  - ESQUERDA: "Paleta" (catálogo de nós);
 *  - DIREITA: abas "Canvas" (tools + opções do nó selecionado) e "Terminal"
 *    (logs da execução), via PageTabsSidebar (abas internas + rail de ícones).
 * O conteúdo permanece montado entre trocas de aba (estado preservado).
 */
import { Boxes, Workflow, TerminalSquare } from "lucide-react";
import { PageSidebar } from "@/context/PageSidebarsContext";
import { PageTabsSidebar, type PageTab } from "@/components/PageTabsSidebar";
import { CanvasPalette } from "@/components/canvas/CanvasPalette";
import { CanvasOptionsPanel } from "@/components/canvas/CanvasOptionsPanel";
import { CanvasToolsPanel } from "@/components/canvas/CanvasToolsPanel";
import { CanvasTerminal } from "@/components/canvas/CanvasTerminal";
import { ErrorBoundary } from "@/components/dashboard/ErrorBoundary";

export function CanvasSidebarTabs() {
  const openGallery = () => {
    window.dispatchEvent(new CustomEvent("canvas:open-templates"));
  };

  const tabs: PageTab[] = [
    {
      id: "canvas",
      label: "Canvas",
      icon: <Workflow className="h-3 w-3" aria-hidden />,
      content: (
        <ErrorBoundary>
          <div className="flex flex-col h-full">
            <div className="flex-1 min-h-0 overflow-y-auto">
              <CanvasToolsPanel onOpenGallery={openGallery} />
              <div className="border-t border-border/50">
                <CanvasOptionsPanel />
              </div>
            </div>
          </div>
        </ErrorBoundary>
      ),
    },
    {
      id: "terminal",
      label: "Terminal",
      icon: <TerminalSquare className="h-3 w-3" aria-hidden />,
      content: <CanvasTerminal />,
    },
  ];

  return (
    <>
      <PageSidebar
        meta={{
          id: "canvas-palette", side: "left",
          title: "Paleta", subtitle: "catálogo de nós",
          icon: <Boxes className="h-4 w-4" />,
          storageKey: "aso:canvas-left-w", defaultWidth: 240,
          railIcons: <Boxes className="h-4 w-4" aria-hidden />,
        }}
      >
        <CanvasPalette />
      </PageSidebar>
      <PageTabsSidebar
        id="canvas-tools"
        side="right"
        title="Canvas"
        subtitle="ferramentas · nó selecionado · logs"
        icon={<Workflow className="h-4 w-4" />}
        storageKey="aso:canvas-right-w"
        defaultWidth={320}
        helpTab={{
          description: "O Canvas é o construtor de pipelines visuais: conecte nós de busca, coleta, análise (com e sem IA), gráficos e relatórios — a saída de um nó alimenta o próximo.",
          tips: ["Adicione nós pela paleta à esquerda e conecte arrastando.", "Comece por um template (botão Templates no topo do canvas).", "O Terminal mostra os logs de execução de cada nó."],
        }}
        tabs={tabs}
        collapseLabel="Recolher ferramentas"
        expandLabel="Expandir ferramentas"
      />
    </>
  );
}
