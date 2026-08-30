import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  BackgroundVariant, useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Play, Square, Trash2, Workflow, Sparkles, Maximize2, Download, LayoutGrid, Magnet, Map, MessageSquareText, Grid3x3, FilePlus2, Undo2, Redo2, Upload, AlignStartVertical, AlignStartHorizontal, Power, PowerOff } from "lucide-react";
import { useCanvasStore } from "@/lib/canvasStore";
import { useDestructiveAction } from "@/hooks/useUx";
import { confirmDestructive } from "@/lib/ux";
import { CanvasNode } from "@/components/canvas/CanvasNode";
import { CanvasChat } from "@/components/canvas/CanvasChat";
import { TemplateGallery } from "@/components/canvas/TemplateGallery";
import { ContextMenuOverlay, type ContextMenuState, type ContextMenuItem } from "@/components/shared/ContextMenu";
import { AppHeader } from "@/components/AppHeader";
import { useCompare } from "@/context/CompareContext";
import { downloadFile } from "@/lib/pageFeatures";
import { CanvasSidebarTabs } from "@/components/canvas/CanvasSidebarTabs";

const nodeTypes = { custom: CanvasNode };

function CanvasInner({ embedded = false }: { embedded?: boolean }) {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const status = useCanvasStore((s) => s.status);
  const running = useCanvasStore((s) => s.running);
  const snapToGrid = useCanvasStore((s) => s.snapToGrid);
  const showMinimap = useCanvasStore((s) => s.showMinimap);
  const canUndo = useCanvasStore((s) => s.past.length > 0);
  const canRedo = useCanvasStore((s) => s.future.length > 0);
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);
  const destroy = useDestructiveAction();
  const { onNodesChange, onEdgesChange, onConnect, onSelectionChange, run, clearCanvas, newCanvas, loadExample, toggleSnapToGrid, toggleMinimap, autoLayout, undo, redo, importPipeline, cancel, isValidConnection, removeNodes, setNodesEnabled, alignNodes, selectNode } = useCanvasStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [alignMenuOpen, setAlignMenuOpen] = useState(false);
  const doneCount = Object.values(status).filter((s) => s === "done").length;
  const errCount = Object.values(status).filter((s) => s === "error").length;
  const skipCount = Object.values(status).filter((s) => s === "skipped").length;
  const { setPickerOpen } = useCompare();
  const { fitView } = useReactFlow();
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  // O zoom/pan por roda do mouse do canvas está SEMPRE ativado (mesmo com um
  // nó selecionado). Áreas roláveis dentro dos nós capturam a roda elas mesmas
  // (via ScrollableArea), então a roda rola o conteúdo do nó quando há algo
  // para rolar, e faz zoom do canvas nos demais casos.
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null);

  // Keyboard shortcuts: Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z (or Y) redo,
  // Ctrl/Cmd+Enter run/cancel. Ignored while typing in inputs/textareas.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || t?.isContentEditable) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((mod && e.key.toLowerCase() === "z" && e.shiftKey) || (mod && e.key.toLowerCase() === "y")) { e.preventDefault(); redo(); }
      else if (mod && e.key === "Enter") { e.preventDefault(); if (running) cancel(); else run(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, run, cancel, running]);

  // Abre a galeria de templates a partir da paleta Canvas da sidebar direita.
  useEffect(() => {
    const onOpen = () => setGalleryOpen(true);
    window.addEventListener("canvas:open-templates", onOpen);
    return () => window.removeEventListener("canvas:open-templates", onOpen);
  }, []);

  const nodesTyped = useMemo(() => nodes.map((n) => ({ ...n, type: "custom" })), [nodes]);

  const handleLoadExample = useCallback(() => {
    loadExample();
    setTimeout(() => fitView({ duration: 400, padding: 0.2 }), 60);
  }, [loadExample, fitView]);

  const handleAutoLayout = useCallback(() => {
    autoLayout();
    setTimeout(() => fitView({ duration: 400, padding: 0.2 }), 60);
  }, [autoLayout, fitView]);

  const nodeColor = useCallback((n: { id: string }) => {
    switch (status[n.id]) {
      case "done": return "hsl(var(--status-success))";
      case "error": return "hsl(var(--status-error))";
      case "running": return "hsl(var(--status-info))";
      case "skipped": return "hsl(var(--status-warning))";
      default: return "hsl(var(--muted-foreground))";
    }
  }, [status]);

  // Export pipeline as JSON.
  const exportPipeline = useCallback(() => {
    const data = JSON.stringify({ nodes, edges, exportedAt: new Date().toISOString() }, null, 2);
    downloadFile("pipeline-canvas.json", data, "application/json");
  }, [nodes, edges]);

  // Import pipeline from a JSON file picked from disk (exported by "Exportar pipeline").
  const applyImportResult = useCallback((text: string) => {
    const res = importPipeline(text);
    if (!res.ok) { window.alert(res.error ?? "Falha ao importar o pipeline."); return; }
    setTimeout(() => fitView({ duration: 400, padding: 0.2 }), 60);
  }, [importPipeline, fitView]);

  const handleImportPipeline = useCallback(() => {
    // Prefere o file picker; cai para o texto JSON do arquivo lido pelo input.
    fileInputRef.current?.click();
  }, []);

  const onImportFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => applyImportResult(String(reader.result ?? ""));
    reader.readAsText(file);
  }, [applyImportResult]);

  const zoomFit = useCallback(() => {
    fitView({ duration: 400, padding: 0.2 });
  }, [fitView]);

  // Viewport persistence: zoom/pan position survives reloads so the user
  // returns exactly where they left off.
  const VIEWPORT_KEY = "aso:canvas-viewport:v1";
  const initialViewport = useMemo(() => {
    try {
      const raw = localStorage.getItem(VIEWPORT_KEY);
      if (raw) {
        const v = JSON.parse(raw);
        if (typeof v?.x === "number" && typeof v?.y === "number" && typeof v?.zoom === "number") return v;
      }
    } catch { /* ignore */ }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onMoveEnd = useCallback((_e: unknown, viewport: { x: number; y: number; zoom: number }) => {
    try { localStorage.setItem(VIEWPORT_KEY, JSON.stringify(viewport)); } catch { /* ignore */ }
  }, []);

  const toolBtn = "flex items-center justify-center text-xs p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50";

  // Monta os itens do menu de contexto do fundo do canvas.
  const bgMenu = (): ContextMenuItem[] => [
    {
      label: "Ajustar à tela",
      icon: <Maximize2 className="h-3.5 w-3.5" />,
      onClick: zoomFit,
    },
    {
      label: "Layout automático",
      icon: <Grid3x3 className="h-3.5 w-3.5" />,
      onClick: handleAutoLayout,
    },
    { type: "separator" },
    {
      label: snapToGrid ? "Desativar grade magnética" : "Ativar grade magnética",
      icon: <Magnet className="h-3.5 w-3.5" />,
      onClick: toggleSnapToGrid,
    },
    {
      label: showMinimap ? "Ocultar minimapa" : "Mostrar minimapa",
      icon: <Map className="h-3.5 w-3.5" />,
      onClick: toggleMinimap,
    },
    ...(nodes.length > 0 ? [
      { type: "separator" as const },
      {
        label: "Exportar pipeline (JSON)",
        icon: <Download className="h-3.5 w-3.5" />,
        onClick: exportPipeline,
      },
      {
        label: "Limpar canvas",
        icon: <Trash2 className="h-3.5 w-3.5" />,
        danger: true,
        onClick: () => { if (confirmDestructive("Limpar todo o canvas?", `${nodes.length} nó(s) · ${edges.length} conexão(ões). Você pode desfazer com Ctrl+Z.`)) clearCanvas(); },
      },
    ] : []),
    { type: "separator" as const },
    {
      label: "Importar pipeline (JSON)…",
      icon: <Upload className="h-3.5 w-3.5" />,
      onClick: handleImportPipeline,
    },
    {
      label: "Desfazer",
      icon: <Undo2 className="h-3.5 w-3.5" />,
      onClick: undo,
      disabled: !canUndo,
    },
    {
      label: "Refazer",
      icon: <Redo2 className="h-3.5 w-3.5" />,
      onClick: redo,
      disabled: !canRedo,
    },
  ];

  return (
    <div className={embedded ? "h-full min-h-[560px] flex flex-col bg-background" : "h-screen flex flex-col bg-background"}>
      {!embedded && (
        <AppHeader
          crumb="Canvas"
          compare={{ count: 0, onOpen: () => setPickerOpen(true) }}
          showSearch={false}
        />
      )}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodesTyped}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
          onSelectionChange={({ nodes: sel }) => onSelectionChange(sel as unknown as { id: string }[])}
          nodeTypes={nodeTypes}
          snapToGrid={snapToGrid}
          fitView={!initialViewport}
          defaultViewport={initialViewport}
          onMoveEnd={onMoveEnd}
          // Zoom/pan always on. Scrollable node areas capture the wheel via
          // ScrollableArea so internal scroll still works (no zoom conflict).
          zoomOnScroll
          panOnScroll={false}
          zoomOnPinch
          // Right-click on the background opens a context menu instead of the
          // default selection box.
          onPaneContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, items: bgMenu() }); }}
          onPaneClick={() => { if (ctxMenu) setCtxMenu(null); }}
          proOptions={{ hideAttribution: true }}
          className="bg-background"
        >
          <Background variant={BackgroundVariant.Dots} gap={18} size={1} className="opacity-60" />
          <Controls className="!bg-card !border !border-border/60 !shadow-sm" />
          {showMinimap && (
            <MiniMap
              pannable
              zoomable
              className="!bg-card !border !border-border/60"
              nodeColor={nodeColor}
            />
          )}
        </ReactFlow>

        {ctxMenu && (
          <ContextMenuOverlay state={ctxMenu} onClose={() => setCtxMenu(null)} />
        )}

        {/* Floating toolbar */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-card/90 backdrop-blur border border-border/60 rounded-lg shadow-sm p-1">
          <button
            onClick={run}
            disabled={running}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            title="Executar fluxo"
            aria-label="Executar fluxo"
          >
            {running ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            {running ? "Executando…" : "Executar"}
          </button>
          <button
            onClick={() => setGalleryOpen(true)}
            className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            title="Galeria de templates"
            aria-label="Abrir galeria de templates"
          >
            <LayoutGrid className="h-3 w-3" />
            Templates
          </button>
          <button
            onClick={handleLoadExample}
            className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            title="Pipeline de exemplo"
            aria-label="Carregar pipeline de exemplo"
          >
            <Sparkles className="h-3 w-3" />
            Exemplo
          </button>
          <span className="w-px h-4 bg-border/60 mx-0.5" />
          <button onClick={() => { if (nodes.length === 0 || confirmDestructive("Criar um novo canvas em branco?", "O canvas atual será substituído. Você pode desfazer com Ctrl+Z.")) newCanvas(); }} className={toolBtn} title="Novo canvas em branco" aria-label="Criar novo canvas em branco">
            <FilePlus2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={zoomFit} className={toolBtn} title="Ajustar à tela" aria-label="Ajustar à tela">
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={handleAutoLayout} className={toolBtn} title="Layout automático" aria-label="Reorganizar nós automaticamente">
            <Grid3x3 className="h-3.5 w-3.5" />
          </button>
          <button onClick={toggleSnapToGrid} className={`${toolBtn} ${snapToGrid ? "text-primary bg-primary/10" : ""}`} title={snapToGrid ? "Desativar alinhamento à grade" : "Ativar alinhamento à grade"} aria-pressed={snapToGrid}>
            <Magnet className="h-3.5 w-3.5" />
          </button>
          <button onClick={toggleMinimap} className={`${toolBtn} ${showMinimap ? "text-primary bg-primary/10" : ""}`} title={showMinimap ? "Ocultar minimapa" : "Mostrar minimapa"} aria-pressed={showMinimap}>
            <Map className="h-3.5 w-3.5" />
          </button>
          <span className="w-px h-4 bg-border/60 mx-0.5" />
          <button onClick={undo} disabled={!canUndo} className={`${toolBtn} disabled:opacity-40`} title="Desfazer (Ctrl+Z)" aria-label="Desfazer">
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={redo} disabled={!canRedo} className={`${toolBtn} disabled:opacity-40`} title="Refazer (Ctrl+Shift+Z)" aria-label="Refazer">
            <Redo2 className="h-3.5 w-3.5" />
          </button>
          <span className="w-px h-4 bg-border/60 mx-0.5" />
          <button onClick={() => setChatOpen((v) => !v)} className={`${toolBtn} ${chatOpen ? "text-primary bg-primary/10" : ""}`} title="Chat de IA do canvas" aria-label="Abrir chat de IA do canvas" aria-pressed={chatOpen}>
            <MessageSquareText className="h-3.5 w-3.5" />
          </button>
          {nodes.length > 0 && (
            <button onClick={exportPipeline} className={toolBtn} title="Exportar pipeline" aria-label="Exportar pipeline como JSON">
              <Download className="h-3.5 w-3.5" />
            </button>
          )}
          <button onClick={handleImportPipeline} className={toolBtn} title="Importar pipeline (JSON)" aria-label="Importar pipeline de JSON">
            <Upload className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => { destroy({ confirm: "Limpar todo o canvas?", detail: `${nodes.length} nó(s) · ${edges.length} conexão(ões). Você pode desfazer com Ctrl+Z.`, toast: "Canvas limpo", action: () => { clearCanvas(); } }); }} className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" title="Limpar canvas" aria-label="Limpar canvas">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>

        {/* Status pill */}
        <div
          className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-card/90 backdrop-blur border border-border/60 rounded-lg shadow-sm px-3 py-1.5"
          role="status"
          aria-live="polite"
          aria-label={`${nodes.length} nós, ${edges.length} conexões, ${doneCount} concluídos, ${errCount} com erro`}
        >
          <Workflow className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          <span className="text-[11px] font-medium">{nodes.length} nós · {edges.length} conexões</span>
          {doneCount > 0 && <span className="text-[10px] text-emerald-500">✓ {doneCount}</span>}
          {errCount > 0 && <span className="text-[10px] text-destructive">✗ {errCount}</span>}
          {skipCount > 0 && <span className="text-[10px] text-status-warning" title="Nós pulados por dependência falha">⤼ {skipCount}</span>}
        </div>

        {/* Multi-select toolbar (≥2 nodes selected): align, enable/disable, remove */}
        {selectedNodeIds.length >= 2 && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-card/90 backdrop-blur border border-border/60 rounded-lg shadow-sm px-2 py-1">
            <span className="text-[10px] text-muted-foreground px-1">{selectedNodeIds.length} selecionados</span>
            <div className="relative">
              <button onClick={() => setAlignMenuOpen((v) => !v)} className={toolBtn} title="Alinhar/distribuir" aria-haspopup="menu" aria-expanded={alignMenuOpen}>
                <AlignStartVertical className="h-3.5 w-3.5" />
              </button>
              {alignMenuOpen && (
                <div className="absolute top-full left-0 mt-1 w-44 rounded-md border border-border/60 bg-card shadow-md p-1" role="menu">
                  {([
                    ["left", "Alinhar à esquerda"], ["right", "Alinhar à direita"],
                    ["top", "Alinhar ao topo"], ["bottom", "Alinhar abaixo"],
                    ["distribute-h", "Distribuir horizontal"], ["distribute-v", "Distribuir vertical"],
                  ] as const).map(([mode, label]) => (
                    <button
                      key={mode}
                      onClick={() => { alignNodes(selectedNodeIds, mode); setAlignMenuOpen(false); }}
                      role="menuitem"
                      className="w-full text-left text-[11px] px-2 py-1.5 rounded hover:bg-primary/10 hover:text-primary transition-colors flex items-center gap-2"
                    >
                      <AlignStartHorizontal className="h-3 w-3 shrink-0" /> {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span className="w-px h-4 bg-border/60 mx-0.5" />
            <button onClick={() => setNodesEnabled(selectedNodeIds, true)} className={toolBtn} title="Ativar todos os selecionados" aria-label="Ativar selecionados">
              <Power className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setNodesEnabled(selectedNodeIds, false)} className={toolBtn} title="Desativar todos (pular na execução)" aria-label="Desativar selecionados">
              <PowerOff className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => { destroy({ confirm: `Remover ${selectedNodeIds.length} nó(s) selecionados?`, detail: "Você pode desfazer com Ctrl+Z.", toast: `${selectedNodeIds.length} nó(s) removidos`, action: () => { removeNodes(selectedNodeIds); setAlignMenuOpen(false); selectNode(null); } }); }}
              className={`${toolBtn} hover:text-destructive hover:bg-destructive/10`}
              title="Remover selecionados"
              aria-label="Remover nós selecionados"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Hidden file input used by "Importar pipeline". */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={onImportFile}
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
        />

        {/* In-canvas AI chat docked below the status pill */}
        <CanvasChat open={chatOpen} onClose={() => setChatOpen(false)} />

        {/* Template gallery modal */}
        <TemplateGallery open={galleryOpen} onClose={() => setGalleryOpen(false)} />

        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center max-w-sm">
              <Workflow className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">Canvas vazio</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Comece do zero adicionando nós pelo painel esquerdo, ou carregue um pipeline pronto. Conecte a saída (●) de um nó à entrada (●) do próximo — os nós se conversam e a IA pode analisar a saída de outros nós.
              </p>
              <div className="pointer-events-auto mt-3 flex items-center justify-center gap-2">
                <button onClick={newCanvas} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                  <FilePlus2 className="h-3.5 w-3.5" /> Novo canvas
                </button>
                <button onClick={handleLoadExample} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
                  <Sparkles className="h-3.5 w-3.5" /> Exemplo
                </button>
                <button onClick={() => setGalleryOpen(true)} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
                  <LayoutGrid className="h-3.5 w-3.5" /> Templates
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground/60 mt-4 flex items-center justify-center gap-2 flex-wrap">
                <span><kbd className="px-1 py-0.5 rounded bg-muted font-mono">Ctrl+Enter</kbd> executar</span>
                <span><kbd className="px-1 py-0.5 rounded bg-muted font-mono">Ctrl+Z</kbd> desfazer</span>
                <span><kbd className="px-1 py-0.5 rounded bg-muted font-mono">Scroll</kbd> zoom</span>
                <span><kbd className="px-1 py-0.5 rounded bg-muted font-mono">Botão direito</kbd> menu</span>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Canvas({ embedded = false }: { embedded?: boolean }) {
  return (
    <ReactFlowProvider>
      <CanvasSidebarTabs />
      <CanvasInner embedded={embedded} />
    </ReactFlowProvider>
  );
}
