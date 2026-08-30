/** GENERATED — rode `node scripts/build-component-catalog.mjs`.
 * Inventário de componentes (244 arquivos, 41 páginas). */
export type AtomicLevel = "atom" | "molecule" | "organism" | "template" | "page";
export interface ComponentInventoryEntry {
  file: string;
  dir: string;
  exports: string[];
  lines: number;
  /** Imports locais de componentes (Atomic Design: do que é feito). */
  deps: string[];
  /** Hooks React usados no arquivo. */
  hooks: string[];
  /** Classificação Atomic Design (heurística do gerador). */
  atomic: AtomicLevel;
  consumers: number;
}
export interface PageUsageEntry { page: string; components: string[]; }
export interface DuplicateEntry { name: string; files: string[]; }

export const COMPONENT_INVENTORY: ComponentInventoryEntry[] = [
 {
  "file": "components/AIAssistantPanel.tsx",
  "dir": "components",
  "exports": [
   "AIAssistantPanel"
  ],
  "lines": 1070,
  "deps": [
   "components/AppsPanel.tsx",
   "components/ChatHistorySidebar.tsx",
   "components/LiveTerminal.tsx",
   "components/SettingsPanel.tsx",
   "components/SidebarChartsPanel.tsx",
   "components/dashboard/ErrorBoundary.tsx",
   "components/shared/AIChatShortcuts.tsx",
   "components/shared/AIOutputCard.tsx",
   "components/shared/CopyDownloadButtons.tsx",
   "components/shared/RailHover.tsx",
   "components/shared/SidebarTabStrip.tsx",
   "components/ui/button.tsx"
  ],
  "hooks": [
   "useAIContext",
   "useAISettings",
   "useChatHistory",
   "useCompare",
   "useDataset",
   "useEffect",
   "useGenerations",
   "useLocation",
   "useMemo",
   "useNavigate",
   "useRef",
   "useSelection",
   "useSessions",
   "useSmartAutoScroll",
   "useState",
   "useVoiceInput",
   "useVoiceSettings"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/AISettingsPanel.tsx",
  "dir": "components",
  "exports": [
   "AISettingsPanel"
  ],
  "lines": 399,
  "deps": [],
  "hooks": [
   "useAISettings",
   "useGpu",
   "useState",
   "useSystemProfile"
  ],
  "atomic": "atom",
  "consumers": 3
 },
 {
  "file": "components/analysisAtlas/AtlasTree.tsx",
  "dir": "components/analysisAtlas",
  "exports": [
   "AtlasTree"
  ],
  "lines": 168,
  "deps": [],
  "hooks": [
   "useMemo",
   "useState"
  ],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/analysisAtlas/ModuleContract.tsx",
  "dir": "components/analysisAtlas",
  "exports": [
   "ModuleContract"
  ],
  "lines": 379,
  "deps": [
   "components/shared/AIOutputCard.tsx",
   "components/ui/badge.tsx",
   "components/ui/button.tsx"
  ],
  "hooks": [
   "useAISettings",
   "useCanvasStore",
   "useDataset",
   "useMemo",
   "useNavigate",
   "useSelection",
   "useState"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/analysisAtlas/PipelineComposer.tsx",
  "dir": "components/analysisAtlas",
  "exports": [
   "PipelineComposer"
  ],
  "lines": 153,
  "deps": [
   "components/ui/button.tsx"
  ],
  "hooks": [
   "useCanvasStore",
   "useMemo",
   "useNavigate"
  ],
  "atomic": "molecule",
  "consumers": 1
 },
 {
  "file": "components/AppCard.tsx",
  "dir": "components",
  "exports": [
   "AppCard"
  ],
  "lines": 92,
  "deps": [],
  "hooks": [
   "useEffect",
   "useState"
  ],
  "atomic": "atom",
  "consumers": 2
 },
 {
  "file": "components/AppHeader.tsx",
  "dir": "components",
  "exports": [
   "AppHeader"
  ],
  "lines": 148,
  "deps": [
   "components/GlobalSearchBar.tsx",
   "components/SystemStatusIndicator.tsx",
   "components/ui/button.tsx"
  ],
  "hooks": [
   "useAISettings",
   "useEffect",
   "useNavigate",
   "useRef",
   "useState"
  ],
  "atomic": "organism",
  "consumers": 37
 },
 {
  "file": "components/AppShell.tsx",
  "dir": "components",
  "exports": [
   "AppShell"
  ],
  "lines": 255,
  "deps": [
   "components/AIAssistantPanel.tsx",
   "components/BackgroundLayer.tsx",
   "components/ComparePickerDialog.tsx",
   "components/LeftSidebar.tsx",
   "components/OnboardingModal.tsx",
   "components/ResizeHandle.tsx",
   "components/layoutComposer/WidgetColumn.tsx",
   "components/pageSidebars/RouteSidebars.tsx",
   "components/ux/GlobalShortcuts.tsx",
   "components/ux/UxPrimitives.tsx"
  ],
  "hooks": [
   "useColumnSize",
   "useCompare",
   "useEffect",
   "useFeatureFlags",
   "useLayout",
   "useLocation",
   "useRef"
  ],
  "atomic": "organism",
  "consumers": 0
 },
 {
  "file": "components/AppsPanel.tsx",
  "dir": "components",
  "exports": [
   "AppsPanel"
  ],
  "lines": 447,
  "deps": [
   "components/CollectionSettingsProvider.tsx",
   "components/shared/FilesPanel.tsx",
   "components/shared/OriginBadge.tsx"
  ],
  "hooks": [
   "useCollectionSettings",
   "useDataset",
   "useEffect",
   "useGenerations",
   "useMemo",
   "useNavigate",
   "useSelection",
   "useSessions",
   "useState"
  ],
  "atomic": "organism",
  "consumers": 2
 },
 {
  "file": "components/assistant/AssistantPanels.tsx",
  "dir": "components/assistant",
  "exports": [
   "AssistantActionsPanel",
   "AssistantContextPanel",
   "AssistantStatusPanel",
   "AssistantVoicePanel"
  ],
  "lines": 289,
  "deps": [
   "components/ui/badge.tsx",
   "components/ui/separator.tsx",
   "components/ui/slider.tsx",
   "components/ui/switch.tsx"
  ],
  "hooks": [
   "useAISettings",
   "useDataset",
   "useEffect",
   "useSelection",
   "useState",
   "useVoiceCapsVersion",
   "useVoiceSettings"
  ],
  "atomic": "organism",
  "consumers": 2
 },
 {
  "file": "components/assistant/VoiceDiagnostics.tsx",
  "dir": "components/assistant",
  "exports": [
   "VoiceDiagnostics"
  ],
  "lines": 220,
  "deps": [],
  "hooks": [
   "useCallback",
   "useEffect",
   "useState",
   "useVoiceCapsVersion"
  ],
  "atomic": "atom",
  "consumers": 2
 },
 {
  "file": "components/assistant/VoiceOrb.tsx",
  "dir": "components/assistant",
  "exports": [
   "VoiceOrb"
  ],
  "lines": 38,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/BackgroundLayer.tsx",
  "dir": "components",
  "exports": [
   "BackgroundLayer"
  ],
  "lines": 117,
  "deps": [],
  "hooks": [
   "useBackgroundSettings",
   "useMemo"
  ],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/canvas/CanvasChat.tsx",
  "dir": "components/canvas",
  "exports": [
   "CanvasChat"
  ],
  "lines": 155,
  "deps": [
   "components/shared/AIOutputCard.tsx"
  ],
  "hooks": [
   "useAISettings",
   "useCanvasStore",
   "useEffect",
   "useRef",
   "useSmartAutoScroll",
   "useState"
  ],
  "atomic": "molecule",
  "consumers": 1
 },
 {
  "file": "components/canvas/CanvasNode.tsx",
  "dir": "components/canvas",
  "exports": [
   "CanvasNode"
  ],
  "lines": 514,
  "deps": [
   "components/canvas/NodeOutput.tsx",
   "components/canvas/ScrollableArea.tsx",
   "components/canvas/nodeRegistry.ts",
   "components/shared/ContextMenu.tsx"
  ],
  "hooks": [
   "useCanvasStore",
   "useState"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/canvas/CanvasOptionsPanel.tsx",
  "dir": "components/canvas",
  "exports": [
   "CanvasOptionsPanel"
  ],
  "lines": 447,
  "deps": [
   "components/SessionsPanel.tsx",
   "components/canvas/nodeRegistry.ts"
  ],
  "hooks": [
   "useCanvasStore",
   "useMemo",
   "useState"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/canvas/CanvasPalette.tsx",
  "dir": "components/canvas",
  "exports": [
   "CanvasPalette"
  ],
  "lines": 101,
  "deps": [
   "components/canvas/nodeRegistry.ts"
  ],
  "hooks": [
   "useCanvasStore",
   "useState"
  ],
  "atomic": "molecule",
  "consumers": 2
 },
 {
  "file": "components/canvas/CanvasSidebarTabs.tsx",
  "dir": "components/canvas",
  "exports": [
   "CanvasSidebarTabs"
  ],
  "lines": 80,
  "deps": [
   "components/PageTabsSidebar.tsx",
   "components/canvas/CanvasOptionsPanel.tsx",
   "components/canvas/CanvasPalette.tsx",
   "components/canvas/CanvasTerminal.tsx",
   "components/canvas/CanvasToolsPanel.tsx",
   "components/dashboard/ErrorBoundary.tsx"
  ],
  "hooks": [],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/canvas/CanvasTerminal.tsx",
  "dir": "components/canvas",
  "exports": [
   "CanvasTerminal"
  ],
  "lines": 180,
  "deps": [
   "components/ResourceMonitor.tsx",
   "components/canvas/nodeRegistry.ts"
  ],
  "hooks": [
   "useActivityEvents",
   "useCanvasStore",
   "useEffect",
   "useRef",
   "useSmartAutoScroll",
   "useState"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/canvas/CanvasToolsPanel.tsx",
  "dir": "components/canvas",
  "exports": [
   "CanvasToolsPanel"
  ],
  "lines": 122,
  "deps": [
   "components/canvas/CanvasPalette.tsx",
   "components/canvas/nodeRegistry.ts",
   "components/canvas/pipelineTemplates.ts"
  ],
  "hooks": [
   "useCanvasStore",
   "useState"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/canvas/NodeOutput.tsx",
  "dir": "components/canvas",
  "exports": [
   "NodeOutput"
  ],
  "lines": 372,
  "deps": [
   "components/canvas/SelectionExplorer.tsx",
   "components/shared/AIOutputCard.tsx"
  ],
  "hooks": [
   "useRatingColors"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/canvas/nodeRegistry.ts",
  "dir": "components/canvas",
  "exports": [],
  "lines": 1100,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 6
 },
 {
  "file": "components/canvas/pipelineTemplates.ts",
  "dir": "components/canvas",
  "exports": [],
  "lines": 564,
  "deps": [
   "components/canvas/nodeRegistry.ts"
  ],
  "hooks": [],
  "atomic": "organism",
  "consumers": 4
 },
 {
  "file": "components/canvas/ScrollableArea.tsx",
  "dir": "components/canvas",
  "exports": [
   "ScrollableArea"
  ],
  "lines": 78,
  "deps": [],
  "hooks": [
   "useEffect",
   "useRef"
  ],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/canvas/SelectionExplorer.tsx",
  "dir": "components/canvas",
  "exports": [
   "SelectionExplorer"
  ],
  "lines": 84,
  "deps": [],
  "hooks": [
   "useCanvasStore",
   "useEffect",
   "useRef",
   "useState"
  ],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/canvas/TemplateGallery.tsx",
  "dir": "components/canvas",
  "exports": [
   "TemplateGallery"
  ],
  "lines": 87,
  "deps": [
   "components/canvas/pipelineTemplates.ts"
  ],
  "hooks": [
   "useCanvasStore",
   "useReactFlow",
   "useState"
  ],
  "atomic": "molecule",
  "consumers": 1
 },
 {
  "file": "components/case/AIInteractionExplorer.tsx",
  "dir": "components/case",
  "exports": [
   "AIInteractionExplorer"
  ],
  "lines": 127,
  "deps": [
   "components/case/CaseShell.tsx"
  ],
  "hooks": [
   "useDataset",
   "useNavigate",
   "useState"
  ],
  "atomic": "molecule",
  "consumers": 1
 },
 {
  "file": "components/case/ArchitectureMap.tsx",
  "dir": "components/case",
  "exports": [
   "ArchitectureMap"
  ],
  "lines": 81,
  "deps": [
   "components/case/CaseShell.tsx"
  ],
  "hooks": [
   "useNavigate",
   "useState"
  ],
  "atomic": "molecule",
  "consumers": 1
 },
 {
  "file": "components/case/CaseNav.tsx",
  "dir": "components/case",
  "exports": [
   "CaseNav"
  ],
  "lines": 94,
  "deps": [],
  "hooks": [
   "useEffect",
   "useI18n",
   "useNavigate",
   "useState"
  ],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/case/CaseShell.tsx",
  "dir": "components/case",
  "exports": [
   "CaseCard",
   "CaseLabel",
   "CaseSection",
   "CaseTag"
  ],
  "lines": 81,
  "deps": [],
  "hooks": [
   "useReveal"
  ],
  "atomic": "atom",
  "consumers": 10
 },
 {
  "file": "components/case/CaseTimeline.tsx",
  "dir": "components/case",
  "exports": [
   "CaseTimeline"
  ],
  "lines": 80,
  "deps": [
   "components/case/CaseShell.tsx"
  ],
  "hooks": [
   "useNavigate",
   "useState"
  ],
  "atomic": "molecule",
  "consumers": 1
 },
 {
  "file": "components/case/DecisionInspector.tsx",
  "dir": "components/case",
  "exports": [
   "DecisionInspector"
  ],
  "lines": 72,
  "deps": [
   "components/case/CaseShell.tsx"
  ],
  "hooks": [
   "useState"
  ],
  "atomic": "molecule",
  "consumers": 1
 },
 {
  "file": "components/case/EvidenceInspector.tsx",
  "dir": "components/case",
  "exports": [
   "EvidenceInspector"
  ],
  "lines": 168,
  "deps": [
   "components/case/CaseShell.tsx"
  ],
  "hooks": [
   "useDataset",
   "useMemo",
   "useState"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/case/EvolutionExplorer.tsx",
  "dir": "components/case",
  "exports": [
   "EvolutionExplorer"
  ],
  "lines": 93,
  "deps": [
   "components/case/CaseShell.tsx"
  ],
  "hooks": [
   "useState"
  ],
  "atomic": "molecule",
  "consumers": 1
 },
 {
  "file": "components/case/FailuresSection.tsx",
  "dir": "components/case",
  "exports": [
   "FailuresSection"
  ],
  "lines": 40,
  "deps": [
   "components/case/CaseShell.tsx"
  ],
  "hooks": [],
  "atomic": "molecule",
  "consumers": 1
 },
 {
  "file": "components/case/SkillInspector.tsx",
  "dir": "components/case",
  "exports": [
   "EvaluationPanel",
   "SkillInspector"
  ],
  "lines": 135,
  "deps": [
   "components/case/CaseShell.tsx"
  ],
  "hooks": [
   "useNavigate",
   "useState"
  ],
  "atomic": "molecule",
  "consumers": 1
 },
 {
  "file": "components/case/SystemDiagram.tsx",
  "dir": "components/case",
  "exports": [
   "SystemDiagram"
  ],
  "lines": 73,
  "deps": [],
  "hooks": [
   "useState"
  ],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/case/TechnicalDiscovery.tsx",
  "dir": "components/case",
  "exports": [
   "TechnicalDiscovery"
  ],
  "lines": 71,
  "deps": [
   "components/case/CaseShell.tsx"
  ],
  "hooks": [
   "useState"
  ],
  "atomic": "molecule",
  "consumers": 1
 },
 {
  "file": "components/catalog/CatalogSidebars.tsx",
  "dir": "components/catalog",
  "exports": [
   "CatalogSidebars"
  ],
  "lines": 284,
  "deps": [
   "components/PageTabsSidebar.tsx",
   "components/catalog/LivePreview.tsx",
   "components/settings/DesignSystemSection.tsx"
  ],
  "hooks": [
   "useEffect",
   "useMemo",
   "useSelectedComponent",
   "useState"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/catalog/LivePreview.tsx",
  "dir": "components/catalog",
  "exports": [
   "LivePreview",
   "PREVIEWABLE"
  ],
  "lines": 54,
  "deps": [
   "components/shared/CopyDownloadButtons.tsx",
   "components/shared/EmptyState.tsx",
   "components/shared/ExpandableBlock.tsx",
   "components/shared/QuickCollect.tsx",
   "components/shared/SidebarTabStrip.tsx"
  ],
  "hooks": [],
  "atomic": "organism",
  "consumers": 2
 },
 {
  "file": "components/catalog/PageFrame.tsx",
  "dir": "components/catalog",
  "exports": [
   "PageFrame"
  ],
  "lines": 295,
  "deps": [],
  "hooks": [
   "useEffect",
   "useFeatureFlags",
   "useRef",
   "useState"
  ],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/ChatHistorySidebar.tsx",
  "dir": "components",
  "exports": [
   "ChatHistorySidebar"
  ],
  "lines": 200,
  "deps": [],
  "hooks": [
   "useChatHistory",
   "useDestructiveAction",
   "useState",
   "useUx"
  ],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/CollapsibleColumn.tsx",
  "dir": "components",
  "exports": [
   "CollapsibleColumn",
   "ColumnBody"
  ],
  "lines": 189,
  "deps": [
   "components/ResizeHandle.tsx",
   "components/shared/RailHover.tsx"
  ],
  "hooks": [
   "useColumnSize"
  ],
  "atomic": "organism",
  "consumers": 0
 },
 {
  "file": "components/CollectionSettingsProvider.tsx",
  "dir": "components",
  "exports": [
   "CollectionSettingsProvider"
  ],
  "lines": 63,
  "deps": [],
  "hooks": [
   "useCollectionSettings",
   "useContext",
   "useState"
  ],
  "atomic": "atom",
  "consumers": 16
 },
 {
  "file": "components/CollectionSettingsToggle.tsx",
  "dir": "components",
  "exports": [
   "CollectionSettingsToggle"
  ],
  "lines": 124,
  "deps": [
   "components/CollectionSettingsProvider.tsx"
  ],
  "hooks": [
   "useCollectionSettings",
   "useEffect",
   "useRef",
   "useState"
  ],
  "atomic": "molecule",
  "consumers": 0
 },
 {
  "file": "components/ComparePickerDialog.tsx",
  "dir": "components",
  "exports": [
   "ComparePickerDialog"
  ],
  "lines": 291,
  "deps": [
   "components/CollectionSettingsProvider.tsx",
   "components/ui/button.tsx",
   "components/ui/dialog.tsx",
   "components/ui/input.tsx"
  ],
  "hooks": [
   "useCollectionSettings",
   "useCompare",
   "useDataset",
   "useEffect",
   "useMemo",
   "useNavigate",
   "useState"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/dashboard/DashboardAIPanel.tsx",
  "dir": "components/dashboard",
  "exports": [
   "DashboardAIPanel"
  ],
  "lines": 218,
  "deps": [
   "components/shared/AIOutputCard.tsx",
   "components/ui/button.tsx"
  ],
  "hooks": [
   "useCallback",
   "useEffect",
   "useRef",
   "useState"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/dashboard/DashboardCharts.tsx",
  "dir": "components/dashboard",
  "exports": [
   "AggregateRatingChart",
   "AggregateSentimentChart",
   "AggregateTimelineChart",
   "KpiCard",
   "PerAppRow",
   "RecentReviewItem",
   "StoreComparisonChart",
   "VersionAnalysisChart"
  ],
  "lines": 314,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 7
 },
 {
  "file": "components/dashboard/ErrorBoundary.tsx",
  "dir": "components/dashboard",
  "exports": [
   "ErrorBoundary"
  ],
  "lines": 41,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 10
 },
 {
  "file": "components/designCanvas/DesignCanvasAICopilot.tsx",
  "dir": "components/designCanvas",
  "exports": [
   "DesignCanvasAICopilot"
  ],
  "lines": 167,
  "deps": [
   "components/shared/AIOutputCard.tsx"
  ],
  "hooks": [
   "useAISettings",
   "useDesignStore",
   "useEffect",
   "useRef",
   "useSmartAutoScroll",
   "useState",
   "useVisibleEdges",
   "useVisibleNodes"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/designCanvas/DesignCanvasBoard.tsx",
  "dir": "components/designCanvas",
  "exports": [
   "DesignCanvasBoard"
  ],
  "lines": 158,
  "deps": [
   "components/designCanvas/DesignCanvasNode.tsx"
  ],
  "hooks": [
   "useDesignStore",
   "useMemo",
   "useVisibleEdges",
   "useVisibleNodes"
  ],
  "atomic": "molecule",
  "consumers": 1
 },
 {
  "file": "components/designCanvas/DesignCanvasInspector.tsx",
  "dir": "components/designCanvas",
  "exports": [
   "DesignCanvasInspector"
  ],
  "lines": 447,
  "deps": [
   "components/ui/button.tsx",
   "components/ui/checkbox.tsx",
   "components/ui/input.tsx",
   "components/ui/label.tsx",
   "components/ui/select.tsx",
   "components/ui/separator.tsx",
   "components/ui/switch.tsx",
   "components/ui/textarea.tsx"
  ],
  "hooks": [
   "useDataset",
   "useDesignStore",
   "useMemo",
   "useVisibleEdges",
   "useVisibleNodes"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/designCanvas/DesignCanvasNode.tsx",
  "dir": "components/designCanvas",
  "exports": [
   "DesignCanvasNode",
   "NodeBody"
  ],
  "lines": 468,
  "deps": [
   "components/AppCard.tsx",
   "components/ReviewsList.tsx",
   "components/WordCloud.tsx",
   "components/dashboard/DashboardCharts.tsx",
   "components/shared/AIOutputCard.tsx",
   "components/ui/accordion.tsx",
   "components/ui/alert.tsx",
   "components/ui/aspect-ratio.tsx",
   "components/ui/avatar.tsx",
   "components/ui/badge.tsx",
   "components/ui/breadcrumb.tsx",
   "components/ui/button.tsx",
   "components/ui/calendar.tsx",
   "components/ui/card.tsx",
   "components/ui/checkbox.tsx",
   "components/ui/dialog.tsx",
   "components/ui/input.tsx",
   "components/ui/label.tsx",
   "components/ui/pagination.tsx",
   "components/ui/progress.tsx",
   "components/ui/select.tsx",
   "components/ui/separator.tsx",
   "components/ui/skeleton.tsx",
   "components/ui/slider.tsx",
   "components/ui/switch.tsx",
   "components/ui/table.tsx",
   "components/ui/tabs.tsx",
   "components/ui/textarea.tsx",
   "components/ui/toggle-group.tsx",
   "components/ui/tooltip.tsx"
  ],
  "hooks": [
   "useAISettings",
   "useBoundData",
   "useDataset",
   "useDesignStore",
   "useSelection",
   "useState"
  ],
  "atomic": "organism",
  "consumers": 3
 },
 {
  "file": "components/designCanvas/DesignCanvasPalette.tsx",
  "dir": "components/designCanvas",
  "exports": [
   "DesignCanvasPalette"
  ],
  "lines": 98,
  "deps": [],
  "hooks": [
   "useDesignStore",
   "useState"
  ],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/designCanvas/DesignCanvasPreview.tsx",
  "dir": "components/designCanvas",
  "exports": [
   "DesignCanvasCode",
   "DesignCanvasPreview"
  ],
  "lines": 173,
  "deps": [
   "components/designCanvas/DesignCanvasNode.tsx"
  ],
  "hooks": [
   "useDesignStore",
   "useMemo"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/designCanvas/PageSwitcher.tsx",
  "dir": "components/designCanvas",
  "exports": [
   "PageSwitcher"
  ],
  "lines": 75,
  "deps": [],
  "hooks": [
   "useDesignStore",
   "useState"
  ],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/designCanvas/TemplateGallery.tsx",
  "dir": "components/designCanvas",
  "exports": [
   "PAGE_TEMPLATES",
   "TemplateGallery"
  ],
  "lines": 53,
  "deps": [],
  "hooks": [
   "useDesignStore"
  ],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/FloatingWindow.tsx",
  "dir": "components",
  "exports": [
   "FloatingWindow"
  ],
  "lines": 169,
  "deps": [
   "components/ui/context-menu.tsx"
  ],
  "hooks": [
   "useEffect",
   "useRef",
   "useWM"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/flow/FlowActivity.tsx",
  "dir": "components/flow",
  "exports": [
   "FlowActivity"
  ],
  "lines": 182,
  "deps": [
   "components/shared/EmptyState.tsx"
  ],
  "hooks": [
   "useActivityEvents",
   "useMemo",
   "useState",
   "useTrackedTasks"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/flow/FlowContextPanel.tsx",
  "dir": "components/flow",
  "exports": [
   "FlowContextPanel"
  ],
  "lines": 184,
  "deps": [
   "components/canvas/pipelineTemplates.ts"
  ],
  "hooks": [
   "useActiveTaskCount",
   "useCanvasStore",
   "useEffect",
   "useFocused",
   "useNavigate",
   "useState",
   "useSyncExternalStore",
   "useTrackedTasks"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/flow/FlowEmbed.tsx",
  "dir": "components/flow",
  "exports": [
   "FlowEmbed"
  ],
  "lines": 76,
  "deps": [
   "components/shared/PageLoader.tsx"
  ],
  "hooks": [],
  "atomic": "molecule",
  "consumers": 12
 },
 {
  "file": "components/flow/FlowMissionBar.tsx",
  "dir": "components/flow",
  "exports": [
   "FlowMissionBar"
  ],
  "lines": 94,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/flow/FlowNavigator.tsx",
  "dir": "components/flow",
  "exports": [
   "FlowNavigator"
  ],
  "lines": 124,
  "deps": [],
  "hooks": [
   "useEffect",
   "useState"
  ],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/flow/FlowSection.tsx",
  "dir": "components/flow",
  "exports": [
   "FlowSection"
  ],
  "lines": 268,
  "deps": [],
  "hooks": [
   "useCallback",
   "useEffect",
   "useRef",
   "useState"
  ],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/flow/sections/SectionAgents.tsx",
  "dir": "components/flow/sections",
  "exports": [
   "SectionAgents"
  ],
  "lines": 172,
  "deps": [
   "components/Panel.tsx",
   "components/flow/FlowEmbed.tsx",
   "components/flow/useFlowScope.ts",
   "components/shared/AIOutputCard.tsx",
   "components/shared/EmptyState.tsx"
  ],
  "hooks": [
   "useAISettings",
   "useFlowScope",
   "useMemo",
   "useRef",
   "useState"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/flow/sections/SectionArtifacts.tsx",
  "dir": "components/flow/sections",
  "exports": [
   "SectionArtifacts"
  ],
  "lines": 92,
  "deps": [
   "components/Panel.tsx",
   "components/SessionsPanel.tsx",
   "components/flow/FlowEmbed.tsx"
  ],
  "hooks": [
   "useAIOutputs",
   "useMemo"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/flow/sections/SectionCollect.tsx",
  "dir": "components/flow/sections",
  "exports": [
   "SectionCollect"
  ],
  "lines": 105,
  "deps": [
   "components/CollectionSettingsProvider.tsx",
   "components/Panel.tsx",
   "components/SettingsPanel.tsx",
   "components/flow/useFlowScope.ts",
   "components/shared/EmptyState.tsx"
  ],
  "hooks": [
   "useCollectionSettings",
   "useFlowScope",
   "useState"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/flow/sections/SectionData.tsx",
  "dir": "components/flow/sections",
  "exports": [
   "SectionData"
  ],
  "lines": 154,
  "deps": [
   "components/Panel.tsx",
   "components/flow/FlowEmbed.tsx",
   "components/flow/useFlowScope.ts",
   "components/shared/EmptyState.tsx"
  ],
  "hooks": [
   "useFlowScope",
   "useMemo",
   "useState"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/flow/sections/SectionDecide.tsx",
  "dir": "components/flow/sections",
  "exports": [
   "SectionDecide"
  ],
  "lines": 187,
  "deps": [
   "components/Panel.tsx",
   "components/flow/FlowEmbed.tsx",
   "components/flow/useFlowScope.ts",
   "components/shared/AIOutputCard.tsx",
   "components/shared/EmptyState.tsx"
  ],
  "hooks": [
   "useAISettings",
   "useFlowScope",
   "useRef",
   "useState"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/flow/sections/SectionDiscover.tsx",
  "dir": "components/flow/sections",
  "exports": [
   "SectionDiscover"
  ],
  "lines": 32,
  "deps": [
   "components/Panel.tsx",
   "components/TopCharts.tsx",
   "components/journey/StageDiscover.tsx"
  ],
  "hooks": [],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/flow/sections/SectionExperiment.tsx",
  "dir": "components/flow/sections",
  "exports": [
   "SectionExperiment"
  ],
  "lines": 135,
  "deps": [
   "components/Panel.tsx",
   "components/canvas/pipelineTemplates.ts",
   "components/flow/FlowEmbed.tsx"
  ],
  "hooks": [
   "useCanvasStore",
   "useDesignStore",
   "useState"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/flow/sections/SectionInvestigate.tsx",
  "dir": "components/flow/sections",
  "exports": [
   "SectionInvestigate"
  ],
  "lines": 435,
  "deps": [
   "components/Panel.tsx",
   "components/flow/FlowEmbed.tsx",
   "components/flow/useFlowScope.ts",
   "components/shared/AIOutputCard.tsx",
   "components/shared/EmptyState.tsx",
   "components/shared/IAQueueBar.tsx"
  ],
  "hooks": [
   "useAISettings",
   "useEffect",
   "useFlowScope",
   "useIAQueue",
   "useMemo",
   "useRef",
   "useState"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/flow/sections/SectionKnowledge.tsx",
  "dir": "components/flow/sections",
  "exports": [
   "SectionKnowledge"
  ],
  "lines": 130,
  "deps": [
   "components/Panel.tsx",
   "components/shared/EmptyState.tsx"
  ],
  "hooks": [
   "useArtifacts",
   "useInsights",
   "useLabFindings"
  ],
  "atomic": "molecule",
  "consumers": 1
 },
 {
  "file": "components/flow/sections/SectionMission.tsx",
  "dir": "components/flow/sections",
  "exports": [
   "SectionMission"
  ],
  "lines": 87,
  "deps": [
   "components/CollectionSettingsProvider.tsx",
   "components/Panel.tsx",
   "components/flow/FlowEmbed.tsx"
  ],
  "hooks": [
   "useAISettings",
   "useCollectionSettings",
   "useEffect",
   "useState"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/flow/sections/SectionMonitor.tsx",
  "dir": "components/flow/sections",
  "exports": [
   "SectionMonitor"
  ],
  "lines": 87,
  "deps": [
   "components/Panel.tsx",
   "components/flow/FlowActivity.tsx",
   "components/flow/FlowEmbed.tsx"
  ],
  "hooks": [],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/flow/sections/SectionOpportunities.tsx",
  "dir": "components/flow/sections",
  "exports": [
   "SectionOpportunities"
  ],
  "lines": 99,
  "deps": [
   "components/Panel.tsx",
   "components/flow/FlowEmbed.tsx",
   "components/lab/ProductCandidateDialog.tsx",
   "components/shared/EmptyState.tsx"
  ],
  "hooks": [
   "useLabExperiments",
   "useLabProductCandidates",
   "useState"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/flow/sections/SectionPresent.tsx",
  "dir": "components/flow/sections",
  "exports": [
   "SectionPresent"
  ],
  "lines": 121,
  "deps": [
   "components/Panel.tsx",
   "components/flow/FlowEmbed.tsx",
   "components/flow/useFlowScope.ts",
   "components/shared/EmptyState.tsx"
  ],
  "hooks": [
   "useEffect",
   "useFlowScope",
   "useState"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/flow/sections/SectionSelect.tsx",
  "dir": "components/flow/sections",
  "exports": [
   "SectionSelect"
  ],
  "lines": 131,
  "deps": [
   "components/Panel.tsx",
   "components/flow/useFlowScope.ts",
   "components/shared/ComparisonView.tsx",
   "components/shared/EmptyState.tsx"
  ],
  "hooks": [
   "useFlowScope",
   "useSelection"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/flow/sections/SectionSignals.tsx",
  "dir": "components/flow/sections",
  "exports": [
   "SectionSignals"
  ],
  "lines": 138,
  "deps": [
   "components/Panel.tsx",
   "components/flow/FlowEmbed.tsx",
   "components/flow/useFlowScope.ts",
   "components/shared/EmptyState.tsx"
  ],
  "hooks": [
   "useFlowScope",
   "useState"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/flow/sections/SectionVisualize.tsx",
  "dir": "components/flow/sections",
  "exports": [
   "SectionVisualize"
  ],
  "lines": 124,
  "deps": [
   "components/Panel.tsx",
   "components/dashboard/DashboardCharts.tsx",
   "components/flow/FlowEmbed.tsx",
   "components/flow/useFlowScope.ts",
   "components/shared/EmptyState.tsx"
  ],
  "hooks": [
   "useFlowScope",
   "useMemo"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/flow/useFlowScope.ts",
  "dir": "components/flow",
  "exports": [],
  "lines": 29,
  "deps": [],
  "hooks": [
   "useDataset",
   "useFlowScope",
   "useMemo",
   "useSelection"
  ],
  "atomic": "atom",
  "consumers": 11
 },
 {
  "file": "components/gitCanvas/GitBlocksView.tsx",
  "dir": "components/gitCanvas",
  "exports": [
   "GitBlocksView"
  ],
  "lines": 206,
  "deps": [
   "components/shared/ExpandableBlock.tsx"
  ],
  "hooks": [
   "useMemo",
   "useState"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/gitCanvas/GitCanvasBoard.tsx",
  "dir": "components/gitCanvas",
  "exports": [
   "GitCanvasBoard"
  ],
  "lines": 123,
  "deps": [
   "components/gitCanvas/GitObjectNode.tsx"
  ],
  "hooks": [
   "useCallback",
   "useMemo"
  ],
  "atomic": "molecule",
  "consumers": 1
 },
 {
  "file": "components/gitCanvas/GitCommandPalette.tsx",
  "dir": "components/gitCanvas",
  "exports": [
   "GitCommandPalette"
  ],
  "lines": 118,
  "deps": [
   "components/gitCanvas/GitObjectNode.tsx",
   "components/ui/command.tsx"
  ],
  "hooks": [
   "useMemo",
   "useState"
  ],
  "atomic": "molecule",
  "consumers": 1
 },
 {
  "file": "components/gitCanvas/GitInspector.tsx",
  "dir": "components/gitCanvas",
  "exports": [
   "GitInspector"
  ],
  "lines": 278,
  "deps": [
   "components/gitCanvas/GitObjectNode.tsx"
  ],
  "hooks": [
   "useState"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/gitCanvas/GitObjectNode.tsx",
  "dir": "components/gitCanvas",
  "exports": [],
  "lines": 140,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 3
 },
 {
  "file": "components/gitCanvas/GitOnboarding.tsx",
  "dir": "components/gitCanvas",
  "exports": [
   "GitOnboarding"
  ],
  "lines": 230,
  "deps": [
   "components/gitCanvas/GitUploadZone.tsx"
  ],
  "hooks": [
   "useGitCanvas",
   "useState"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/gitCanvas/GitTimelinePanel.tsx",
  "dir": "components/gitCanvas",
  "exports": [
   "GitTimelinePanel"
  ],
  "lines": 88,
  "deps": [],
  "hooks": [
   "useGitCanvas",
   "useMemo"
  ],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/gitCanvas/GitTopBar.tsx",
  "dir": "components/gitCanvas",
  "exports": [
   "GitTopBar"
  ],
  "lines": 145,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/gitCanvas/GitUploadZone.tsx",
  "dir": "components/gitCanvas",
  "exports": [
   "GitUploadZone"
  ],
  "lines": 167,
  "deps": [
   "components/ui/button.tsx",
   "components/ui/card.tsx"
  ],
  "hooks": [
   "useCallback",
   "useRef",
   "useState"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/GlobalSearchBar.tsx",
  "dir": "components",
  "exports": [
   "GlobalSearchBar"
  ],
  "lines": 119,
  "deps": [],
  "hooks": [
   "useEffect",
   "useNavigate",
   "useRef",
   "useState"
  ],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/HeroSection.tsx",
  "dir": "components",
  "exports": [
   "HeroSection"
  ],
  "lines": 63,
  "deps": [],
  "hooks": [
   "useEffect",
   "useState"
  ],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/HistorySidebar.tsx",
  "dir": "components",
  "exports": [
   "HistorySidebar"
  ],
  "lines": 152,
  "deps": [
   "components/OnboardingModal.tsx"
  ],
  "hooks": [
   "useEffect",
   "useNavigate",
   "useState"
  ],
  "atomic": "molecule",
  "consumers": 0
 },
 {
  "file": "components/journey/StageAnalyze.tsx",
  "dir": "components/journey",
  "exports": [
   "StageAnalyze"
  ],
  "lines": 167,
  "deps": [
   "components/shared/AIOutputCard.tsx",
   "components/shared/EmptyState.tsx"
  ],
  "hooks": [
   "useAISettings",
   "useMemo",
   "useRef",
   "useState"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/journey/StageCollect.tsx",
  "dir": "components/journey",
  "exports": [
   "StageCollect"
  ],
  "lines": 86,
  "deps": [
   "components/shared/EmptyState.tsx"
  ],
  "hooks": [
   "useDataset",
   "useSelection"
  ],
  "atomic": "molecule",
  "consumers": 1
 },
 {
  "file": "components/journey/StageDecide.tsx",
  "dir": "components/journey",
  "exports": [
   "StageDecide"
  ],
  "lines": 117,
  "deps": [
   "components/shared/AIOutputCard.tsx",
   "components/shared/EmptyState.tsx"
  ],
  "hooks": [
   "useAISettings",
   "useRef",
   "useState"
  ],
  "atomic": "molecule",
  "consumers": 1
 },
 {
  "file": "components/journey/StageDiscover.tsx",
  "dir": "components/journey",
  "exports": [
   "StageDiscover"
  ],
  "lines": 141,
  "deps": [
   "components/CollectionSettingsProvider.tsx"
  ],
  "hooks": [
   "useCollectionSettings",
   "useDataset",
   "useSelection",
   "useState"
  ],
  "atomic": "molecule",
  "consumers": 2
 },
 {
  "file": "components/journey/StagePresent.tsx",
  "dir": "components/journey",
  "exports": [
   "StagePresent"
  ],
  "lines": 119,
  "deps": [
   "components/shared/EmptyState.tsx"
  ],
  "hooks": [
   "useNavigate",
   "useState"
  ],
  "atomic": "molecule",
  "consumers": 1
 },
 {
  "file": "components/journey/StageVisualize.tsx",
  "dir": "components/journey",
  "exports": [
   "StageVisualize"
  ],
  "lines": 86,
  "deps": [
   "components/dashboard/DashboardCharts.tsx",
   "components/shared/EmptyState.tsx"
  ],
  "hooks": [
   "useMemo"
  ],
  "atomic": "molecule",
  "consumers": 1
 },
 {
  "file": "components/lab/DiscoveryBoard.tsx",
  "dir": "components/lab",
  "exports": [
   "DiscoveryBoard"
  ],
  "lines": 57,
  "deps": [
   "components/lab/LabEmptyState.tsx",
   "components/lab/ProductCandidateCard.tsx",
   "components/ui/button.tsx"
  ],
  "hooks": [],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/lab/ExperimentCard.tsx",
  "dir": "components/lab",
  "exports": [
   "ExperimentCard"
  ],
  "lines": 84,
  "deps": [
   "components/ui/badge.tsx"
  ],
  "hooks": [],
  "atomic": "molecule",
  "consumers": 1
 },
 {
  "file": "components/lab/ExperimentDetail.tsx",
  "dir": "components/lab",
  "exports": [
   "ExperimentDetail"
  ],
  "lines": 403,
  "deps": [
   "components/AppHeader.tsx",
   "components/lab/ProductCandidateDialog.tsx",
   "components/shared/AIOutputCard.tsx",
   "components/ui/badge.tsx",
   "components/ui/button.tsx",
   "components/ui/tabs.tsx"
  ],
  "hooks": [
   "useAISettings",
   "useDataset",
   "useLabDatasets",
   "useLabExperiments",
   "useLabFindings",
   "useNavigate",
   "useState"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/lab/ExperimentDialog.tsx",
  "dir": "components/lab",
  "exports": [
   "ExperimentDialog"
  ],
  "lines": 221,
  "deps": [
   "components/ui/button.tsx",
   "components/ui/checkbox.tsx",
   "components/ui/dialog.tsx",
   "components/ui/input.tsx",
   "components/ui/label.tsx",
   "components/ui/textarea.tsx"
  ],
  "hooks": [
   "useEffect",
   "useState"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/lab/FindingCard.tsx",
  "dir": "components/lab",
  "exports": [
   "FindingCard"
  ],
  "lines": 67,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 2
 },
 {
  "file": "components/lab/LabEmptyState.tsx",
  "dir": "components/lab",
  "exports": [
   "LabEmptyState"
  ],
  "lines": 71,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 3
 },
 {
  "file": "components/lab/LabKnowledge.tsx",
  "dir": "components/lab",
  "exports": [
   "LabKnowledge"
  ],
  "lines": 140,
  "deps": [
   "components/lab/FindingCard.tsx",
   "components/lab/LabEmptyState.tsx",
   "components/ui/input.tsx"
  ],
  "hooks": [
   "useCallback",
   "useLabDatasets",
   "useLabExperiments",
   "useLabFindings",
   "useLabProductCandidates",
   "useMemo",
   "useState"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/lab/LabKpiCards.tsx",
  "dir": "components/lab",
  "exports": [
   "LabKpiCards"
  ],
  "lines": 65,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/lab/LabPipeline.tsx",
  "dir": "components/lab",
  "exports": [
   "LabPipeline"
  ],
  "lines": 46,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/lab/OpportunityScore.tsx",
  "dir": "components/lab",
  "exports": [
   "OpportunityScore",
   "ScoreBar"
  ],
  "lines": 108,
  "deps": [],
  "hooks": [
   "useState"
  ],
  "atomic": "atom",
  "consumers": 2
 },
 {
  "file": "components/lab/ProductCandidateCard.tsx",
  "dir": "components/lab",
  "exports": [
   "ProductCandidateCard"
  ],
  "lines": 90,
  "deps": [
   "components/lab/OpportunityScore.tsx",
   "components/lab/ProductCandidateDialog.tsx",
   "components/ui/badge.tsx",
   "components/ui/button.tsx"
  ],
  "hooks": [
   "useLabDatasets",
   "useLabExperiments",
   "useLabFindings",
   "useState"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/lab/ProductCandidateDialog.tsx",
  "dir": "components/lab",
  "exports": [
   "ProductCandidateDialog"
  ],
  "lines": 127,
  "deps": [
   "components/lab/OpportunityScore.tsx",
   "components/ui/button.tsx",
   "components/ui/dialog.tsx",
   "components/ui/input.tsx",
   "components/ui/label.tsx",
   "components/ui/textarea.tsx"
  ],
  "hooks": [
   "useEffect",
   "useState"
  ],
  "atomic": "organism",
  "consumers": 4
 },
 {
  "file": "components/layoutBuilder/ComponentGallery.tsx",
  "dir": "components/layoutBuilder",
  "exports": [
   "ComponentGallery"
  ],
  "lines": 172,
  "deps": [
   "components/ui/dialog.tsx"
  ],
  "hooks": [
   "useMemo",
   "useState"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/layoutBuilder/LayoutCanvas.tsx",
  "dir": "components/layoutBuilder",
  "exports": [
   "BlockView",
   "ColumnView",
   "ComponentPickerButton",
   "ResizeHandle",
   "RowView"
  ],
  "lines": 739,
  "deps": [
   "components/layoutBuilder/ComponentGallery.tsx",
   "components/layoutBuilder/LayoutComponents.tsx"
  ],
  "hooks": [
   "useCallback",
   "useRef",
   "useState"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/layoutBuilder/LayoutComponents.tsx",
  "dir": "components/layoutBuilder",
  "exports": [
   "AIDisabledHint",
   "BlockPlaceholder",
   "LayoutComponentBody"
  ],
  "lines": 1028,
  "deps": [
   "components/MarkdownRenderer.tsx",
   "components/SessionsPanel.tsx",
   "components/TopCharts.tsx",
   "components/dashboard/DashboardCharts.tsx",
   "components/page01/panels.tsx",
   "components/search/AppSearchPanels.tsx",
   "components/shared/AIOutputCard.tsx",
   "components/shared/QuickCollect.tsx"
  ],
  "hooks": [
   "useAISettings",
   "useActiveTaskCount",
   "useArtifacts",
   "useContext",
   "useDataset",
   "useDense",
   "useEffect",
   "useGenerations",
   "useMemo",
   "useRef",
   "useScopedEntries",
   "useSelection",
   "useSessions",
   "useState"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/layoutBuilder/LayoutSpecView.tsx",
  "dir": "components/layoutBuilder",
  "exports": [
   "LayoutSpecView"
  ],
  "lines": 129,
  "deps": [
   "components/layoutBuilder/LayoutCanvas.tsx"
  ],
  "hooks": [
   "useRef"
  ],
  "atomic": "molecule",
  "consumers": 2
 },
 {
  "file": "components/layoutComposer/WidgetColumn.tsx",
  "dir": "components/layoutComposer",
  "exports": [
   "WidgetChrome",
   "WidgetColumn"
  ],
  "lines": 164,
  "deps": [],
  "hooks": [
   "useState"
  ],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/LeftSidebar.tsx",
  "dir": "components",
  "exports": [
   "LeftSidebar"
  ],
  "lines": 219,
  "deps": [
   "components/OnboardingModal.tsx",
   "components/PageGroupsNav.tsx",
   "components/shared/RailHover.tsx"
  ],
  "hooks": [
   "useFeatureFlags",
   "useLocation",
   "useMemo",
   "useNavigate",
   "useState"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/LiveTerminal.tsx",
  "dir": "components",
  "exports": [
   "LiveTerminal"
  ],
  "lines": 543,
  "deps": [
   "components/shared/AIOutputCard.tsx",
   "components/shared/CopyDownloadButtons.tsx"
  ],
  "hooks": [
   "useAISettings",
   "useActivityEvents",
   "useDataset",
   "useEffect",
   "useFeatureFlags",
   "useGenerations",
   "useLocation",
   "useMemo",
   "useRef",
   "useSessions",
   "useSmartAutoScroll",
   "useState",
   "useSystemProfile",
   "useTerminalTabs",
   "useTrackedTasks"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/MarkdownRenderer.tsx",
  "dir": "components",
  "exports": [
   "MarkdownRenderer"
  ],
  "lines": 298,
  "deps": [],
  "hooks": [
   "useState"
  ],
  "atomic": "atom",
  "consumers": 2
 },
 {
  "file": "components/NavLink.tsx",
  "dir": "components",
  "exports": [
   "NavLink"
  ],
  "lines": 29,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 0
 },
 {
  "file": "components/OnboardingModal.tsx",
  "dir": "components",
  "exports": [
   "OnboardingModal"
  ],
  "lines": 125,
  "deps": [
   "components/ui/button.tsx"
  ],
  "hooks": [
   "useEffect",
   "useState"
  ],
  "atomic": "molecule",
  "consumers": 4
 },
 {
  "file": "components/os/OSBottombar.tsx",
  "dir": "components/os",
  "exports": [
   "OSBottombar"
  ],
  "lines": 180,
  "deps": [
   "components/shared/AIOutputCard.tsx"
  ],
  "hooks": [
   "useEffect",
   "useSmartAutoScroll",
   "useState"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/os/OSConsole.tsx",
  "dir": "components/os",
  "exports": [
   "OSConsole"
  ],
  "lines": 147,
  "deps": [],
  "hooks": [
   "useMemo",
   "useRef",
   "useSmartAutoScroll",
   "useState"
  ],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/os/OSLeftSidebar.tsx",
  "dir": "components/os",
  "exports": [
   "OSLeftContent",
   "OSLeftRailIcons"
  ],
  "lines": 386,
  "deps": [
   "components/CollectionSettingsProvider.tsx"
  ],
  "hooks": [
   "useCollectionSettings",
   "useDataset",
   "useNavigate",
   "useSelection",
   "useState"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/os/OSRightSidebar.tsx",
  "dir": "components/os",
  "exports": [
   "OSRightContent",
   "OSRightRailIcons"
  ],
  "lines": 234,
  "deps": [
   "components/os/OSConsole.tsx",
   "components/shared/AIOutputCard.tsx"
  ],
  "hooks": [
   "useDataset",
   "useGenerations",
   "useMemo",
   "useOSEvents",
   "useSessions"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/os/OSTopbar.tsx",
  "dir": "components/os",
  "exports": [
   "OSTopbar"
  ],
  "lines": 115,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/os/OSViews.tsx",
  "dir": "components/os",
  "exports": [
   "OSAnalises",
   "OSFluxos",
   "OSInsights",
   "OSOverview"
  ],
  "lines": 378,
  "deps": [
   "components/WordCloud.tsx",
   "components/dashboard/DashboardCharts.tsx",
   "components/shared/AIOutputCard.tsx"
  ],
  "hooks": [
   "useMemo",
   "useState"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/page01/panels.tsx",
  "dir": "components/page01",
  "exports": [
   "CollectedDataPanel",
   "CollectedListPanel",
   "CollectionConfigPanel",
   "DataQualityPanel",
   "FeatureFlagsPanel",
   "PagesNavPanel",
   "PipelineArtifactsPanel",
   "SystemHistoryPanel"
  ],
  "lines": 645,
  "deps": [
   "components/CollectionSettingsProvider.tsx",
   "components/PageGroupsNav.tsx",
   "components/pageSidebars/kit.tsx",
   "components/shared/AIOutputCard.tsx",
   "components/ui/badge.tsx",
   "components/ui/switch.tsx"
  ],
  "hooks": [
   "useArtifacts",
   "useChatHistory",
   "useCollectionSettings",
   "useDataset",
   "useFeatureFlags",
   "useGenerations",
   "useLocation",
   "useMemo",
   "useSelection",
   "useSessions",
   "useState"
  ],
  "atomic": "organism",
  "consumers": 2
 },
 {
  "file": "components/page01/SplitColumn.tsx",
  "dir": "components/page01",
  "exports": [
   "SplitColumn",
   "TabsBlock"
  ],
  "lines": 194,
  "deps": [
   "components/shared/SidebarTabStrip.tsx"
  ],
  "hooks": [
   "useCallback",
   "useEffect",
   "useRef",
   "useState"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/PageGroupsNav.tsx",
  "dir": "components",
  "exports": [
   "PageGroupsNav"
  ],
  "lines": 410,
  "deps": [
   "components/ui/dialog.tsx"
  ],
  "hooks": [
   "useCustomPages",
   "useFeatureFlags",
   "useNavigate",
   "usePageGroups",
   "useState"
  ],
  "atomic": "organism",
  "consumers": 2
 },
 {
  "file": "components/pageSidebars/kit.tsx",
  "dir": "components/pageSidebars",
  "exports": [
   "ActivityPanel",
   "AnchorsPanel",
   "ContextPanel",
   "HelpPanel",
   "InsightsPanel"
  ],
  "lines": 293,
  "deps": [
   "components/shared/AIOutputCard.tsx"
  ],
  "hooks": [
   "useActivityEvents",
   "useDataset",
   "useInsights",
   "useMemo",
   "useNavigate",
   "useSelection",
   "useState"
  ],
  "atomic": "organism",
  "consumers": 6
 },
 {
  "file": "components/pageSidebars/RouteSidebars.tsx",
  "dir": "components/pageSidebars",
  "exports": [
   "RouteSidebars"
  ],
  "lines": 139,
  "deps": [
   "components/pageSidebars/StandardPageSidebars.tsx",
   "components/pageSidebars/kit.tsx"
  ],
  "hooks": [
   "useLocation"
  ],
  "atomic": "molecule",
  "consumers": 1
 },
 {
  "file": "components/pageSidebars/StandardPageSidebars.tsx",
  "dir": "components/pageSidebars",
  "exports": [
   "StandardPageSidebars"
  ],
  "lines": 109,
  "deps": [
   "components/PageTabsSidebar.tsx",
   "components/pageSidebars/kit.tsx"
  ],
  "hooks": [],
  "atomic": "molecule",
  "consumers": 1
 },
 {
  "file": "components/PageTabsSidebar.tsx",
  "dir": "components",
  "exports": [
   "PageTabsSidebar"
  ],
  "lines": 127,
  "deps": [
   "components/pageSidebars/kit.tsx",
   "components/shared/SidebarTabStrip.tsx"
  ],
  "hooks": [
   "useEffect",
   "useState"
  ],
  "atomic": "molecule",
  "consumers": 5
 },
 {
  "file": "components/Panel.tsx",
  "dir": "components",
  "exports": [
   "Panel"
  ],
  "lines": 207,
  "deps": [],
  "hooks": [
   "useCallback",
   "useEffect",
   "useRef",
   "useState"
  ],
  "atomic": "atom",
  "consumers": 19
 },
 {
  "file": "components/pipeline/ArtifactDetail.tsx",
  "dir": "components/pipeline",
  "exports": [
   "ArtifactDetail"
  ],
  "lines": 170,
  "deps": [
   "components/shared/AIOutputCard.tsx"
  ],
  "hooks": [],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/pipeline/ArtifactVault.tsx",
  "dir": "components/pipeline",
  "exports": [
   "ArtifactVault"
  ],
  "lines": 132,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/pipeline/LineagePanel.tsx",
  "dir": "components/pipeline",
  "exports": [
   "LineagePanel"
  ],
  "lines": 167,
  "deps": [],
  "hooks": [
   "useMemo",
   "useState"
  ],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/pipeline/OrchestratorPanel.tsx",
  "dir": "components/pipeline",
  "exports": [
   "OrchestratorPanel"
  ],
  "lines": 130,
  "deps": [
   "components/ui/tooltip.tsx"
  ],
  "hooks": [],
  "atomic": "molecule",
  "consumers": 1
 },
 {
  "file": "components/pipeline/PipelineLog.tsx",
  "dir": "components/pipeline",
  "exports": [
   "PipelineLog"
  ],
  "lines": 126,
  "deps": [],
  "hooks": [
   "useSmartAutoScroll"
  ],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/pipeline/StageFlow.tsx",
  "dir": "components/pipeline",
  "exports": [
   "StageFlow"
  ],
  "lines": 68,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/presentations/SlideView.tsx",
  "dir": "components/presentations",
  "exports": [
   "SlideView"
  ],
  "lines": 218,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/RatingBreakdown.tsx",
  "dir": "components",
  "exports": [
   "RatingBreakdown"
  ],
  "lines": 45,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/RatingChart.tsx",
  "dir": "components",
  "exports": [
   "RatingChart"
  ],
  "lines": 57,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/ResizeHandle.tsx",
  "dir": "components",
  "exports": [
   "ResizeHandle"
  ],
  "lines": 97,
  "deps": [],
  "hooks": [
   "useEffect",
   "useRef"
  ],
  "atomic": "atom",
  "consumers": 2
 },
 {
  "file": "components/ResourceMonitor.tsx",
  "dir": "components",
  "exports": [
   "ResourceMonitor"
  ],
  "lines": 120,
  "deps": [],
  "hooks": [
   "useEffect",
   "useState"
  ],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/ReviewLengthChart.tsx",
  "dir": "components",
  "exports": [
   "ReviewLengthChart"
  ],
  "lines": 47,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/ReviewsList.tsx",
  "dir": "components",
  "exports": [
   "ReviewsList"
  ],
  "lines": 100,
  "deps": [],
  "hooks": [
   "useState"
  ],
  "atomic": "atom",
  "consumers": 2
 },
 {
  "file": "components/ReviewTimeline.tsx",
  "dir": "components",
  "exports": [
   "ReviewTimeline"
  ],
  "lines": 60,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/search/AppSearchPanels.tsx",
  "dir": "components/search",
  "exports": [
   "AppSelectionPanel",
   "SearchFieldPanel",
   "SearchResultsPanel"
  ],
  "lines": 267,
  "deps": [],
  "hooks": [
   "useDataset",
   "useSearchState",
   "useSelection",
   "useState"
  ],
  "atomic": "atom",
  "consumers": 2
 },
 {
  "file": "components/SearchBar.tsx",
  "dir": "components",
  "exports": [
   "SearchBar"
  ],
  "lines": 41,
  "deps": [
   "components/ui/button.tsx",
   "components/ui/input.tsx"
  ],
  "hooks": [
   "useEffect",
   "useState"
  ],
  "atomic": "molecule",
  "consumers": 0
 },
 {
  "file": "components/SectionHeader.tsx",
  "dir": "components",
  "exports": [
   "SectionHeader"
  ],
  "lines": 36,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 3
 },
 {
  "file": "components/SentimentChart.tsx",
  "dir": "components",
  "exports": [
   "SentimentChart"
  ],
  "lines": 48,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/SessionsPanel.tsx",
  "dir": "components",
  "exports": [
   "SessionsPanel"
  ],
  "lines": 245,
  "deps": [
   "components/shared/AIOutputCard.tsx"
  ],
  "hooks": [
   "useCanvasStore",
   "useGenerations",
   "useMemo",
   "useSessions",
   "useSnapshots",
   "useState"
  ],
  "atomic": "organism",
  "consumers": 5
 },
 {
  "file": "components/settings/CustomPrimaryColor.tsx",
  "dir": "components/settings",
  "exports": [
   "CustomPrimaryColor"
  ],
  "lines": 83,
  "deps": [
   "components/ThemeProvider.tsx"
  ],
  "hooks": [
   "useState",
   "useTheme"
  ],
  "atomic": "molecule",
  "consumers": 1
 },
 {
  "file": "components/settings/DataHubSection.tsx",
  "dir": "components/settings",
  "exports": [
   "DataHubSection"
  ],
  "lines": 250,
  "deps": [],
  "hooks": [
   "useCallback",
   "useMemo",
   "useRef",
   "useState"
  ],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/settings/DesignSystemSection.tsx",
  "dir": "components/settings",
  "exports": [
   "DesignSystemSection"
  ],
  "lines": 300,
  "deps": [],
  "hooks": [
   "useDesignTokens",
   "useState",
   "useUISettings"
  ],
  "atomic": "atom",
  "consumers": 3
 },
 {
  "file": "components/settings/LayoutComposerSection.tsx",
  "dir": "components/settings",
  "exports": [
   "LayoutComposerSection"
  ],
  "lines": 104,
  "deps": [],
  "hooks": [
   "useLayout"
  ],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/settings/SourcesSection.tsx",
  "dir": "components/settings",
  "exports": [
   "SourcesSection"
  ],
  "lines": 86,
  "deps": [
   "components/ui/badge.tsx"
  ],
  "hooks": [
   "useSources"
  ],
  "atomic": "molecule",
  "consumers": 1
 },
 {
  "file": "components/settings/TotalResetSection.tsx",
  "dir": "components/settings",
  "exports": [
   "TotalResetSection"
  ],
  "lines": 103,
  "deps": [
   "components/ui/alert-dialog.tsx"
  ],
  "hooks": [
   "useMemo",
   "useState"
  ],
  "atomic": "molecule",
  "consumers": 1
 },
 {
  "file": "components/SettingsPanel.tsx",
  "dir": "components",
  "exports": [
   "AIBehaviorToggles",
   "CollectionSettingsInline",
   "PromptsEditor",
   "SettingsPanel"
  ],
  "lines": 867,
  "deps": [
   "components/AISettingsPanel.tsx",
   "components/CollectionSettingsProvider.tsx",
   "components/OnboardingModal.tsx",
   "components/ThemeProvider.tsx",
   "components/settings/CustomPrimaryColor.tsx"
  ],
  "hooks": [
   "useAIOutputSettings",
   "useAISettings",
   "useBackgroundSettings",
   "useCollectionSettings",
   "useColumnWidths",
   "useI18n",
   "usePromptOverrides",
   "useRef",
   "useSidebarWidths",
   "useState",
   "useTheme",
   "useUISettings"
  ],
  "atomic": "organism",
  "consumers": 5
 },
 {
  "file": "components/shared/AIChatShortcuts.tsx",
  "dir": "components/shared",
  "exports": [
   "AIChatShortcuts"
  ],
  "lines": 117,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 3
 },
 {
  "file": "components/shared/AIOutputCard.tsx",
  "dir": "components/shared",
  "exports": [
   "AIOutputCard"
  ],
  "lines": 658,
  "deps": [
   "components/MarkdownRenderer.tsx",
   "components/shared/CopyDownloadButtons.tsx",
   "components/shared/VoiceControls.tsx"
  ],
  "hooks": [
   "useAIOutputSettings",
   "useAISettings",
   "useCallback",
   "useDataset",
   "useEffect",
   "useRef",
   "useSelection",
   "useSpeechState",
   "useState",
   "useVoiceSettings"
  ],
  "atomic": "organism",
  "consumers": 37
 },
 {
  "file": "components/shared/AppDetailColumn.tsx",
  "dir": "components/shared",
  "exports": [
   "AppDetailColumn"
  ],
  "lines": 275,
  "deps": [
   "components/RatingBreakdown.tsx",
   "components/RatingChart.tsx",
   "components/ReviewLengthChart.tsx",
   "components/ReviewTimeline.tsx",
   "components/ReviewsList.tsx",
   "components/SectionHeader.tsx",
   "components/SentimentChart.tsx",
   "components/StatsCards.tsx",
   "components/WordCloud.tsx",
   "components/shared/AppUpdates.tsx",
   "components/shared/AutoAIAnalysis.tsx",
   "components/shared/QuantiQualiFindings.tsx",
   "components/shared/UpdateIssues.tsx"
  ],
  "hooks": [],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/shared/AppUpdates.tsx",
  "dir": "components/shared",
  "exports": [
   "AppUpdates"
  ],
  "lines": 82,
  "deps": [],
  "hooks": [
   "useMemo"
  ],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/shared/AutoAIAnalysis.tsx",
  "dir": "components/shared",
  "exports": [
   "AutoAIAnalysis"
  ],
  "lines": 157,
  "deps": [
   "components/shared/AIOutputCard.tsx",
   "components/shared/CopyDownloadButtons.tsx",
   "components/ui/button.tsx"
  ],
  "hooks": [
   "useAISettings",
   "usePersistentAIOutput",
   "useState"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/shared/ComparisonView.tsx",
  "dir": "components/shared",
  "exports": [
   "ComparisonView"
  ],
  "lines": 182,
  "deps": [
   "components/SectionHeader.tsx",
   "components/shared/AppDetailColumn.tsx",
   "components/shared/UnifiedComparisonAI.tsx"
  ],
  "hooks": [
   "useScroll"
  ],
  "atomic": "organism",
  "consumers": 2
 },
 {
  "file": "components/shared/ContextMenu.tsx",
  "dir": "components/shared",
  "exports": [
   "ContextMenuOverlay"
  ],
  "lines": 123,
  "deps": [],
  "hooks": [
   "useContextMenu",
   "useEffect",
   "useLayoutEffect",
   "useRef",
   "useState"
  ],
  "atomic": "atom",
  "consumers": 3
 },
 {
  "file": "components/shared/CopyDownloadButtons.tsx",
  "dir": "components/shared",
  "exports": [
   "CopyDownloadButtons"
  ],
  "lines": 110,
  "deps": [],
  "hooks": [
   "useState"
  ],
  "atomic": "atom",
  "consumers": 9
 },
 {
  "file": "components/shared/EmptyState.tsx",
  "dir": "components/shared",
  "exports": [
   "EmptyState"
  ],
  "lines": 60,
  "deps": [
   "components/shared/QuickCollect.tsx"
  ],
  "hooks": [],
  "atomic": "molecule",
  "consumers": 33
 },
 {
  "file": "components/shared/ExpandableBlock.tsx",
  "dir": "components/shared",
  "exports": [
   "ExpandableBlock"
  ],
  "lines": 178,
  "deps": [],
  "hooks": [
   "useEffect",
   "useState"
  ],
  "atomic": "atom",
  "consumers": 6
 },
 {
  "file": "components/shared/FilesPanel.tsx",
  "dir": "components/shared",
  "exports": [
   "FilesPanel"
  ],
  "lines": 104,
  "deps": [
   "components/shared/OriginBadge.tsx"
  ],
  "hooks": [
   "useState",
   "useUserFiles"
  ],
  "atomic": "molecule",
  "consumers": 2
 },
 {
  "file": "components/shared/IAQueueBar.tsx",
  "dir": "components/shared",
  "exports": [
   "IAQueueBar"
  ],
  "lines": 89,
  "deps": [],
  "hooks": [
   "useIAQueue"
  ],
  "atomic": "atom",
  "consumers": 5
 },
 {
  "file": "components/shared/OriginBadge.tsx",
  "dir": "components/shared",
  "exports": [
   "OriginBadge"
  ],
  "lines": 34,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 5
 },
 {
  "file": "components/shared/PageLoader.tsx",
  "dir": "components/shared",
  "exports": [
   "PageLoader"
  ],
  "lines": 20,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 3
 },
 {
  "file": "components/shared/QuantiQualiFindings.tsx",
  "dir": "components/shared",
  "exports": [
   "QuantiQualiFindings"
  ],
  "lines": 122,
  "deps": [],
  "hooks": [
   "useMemo"
  ],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/shared/QuickCollect.tsx",
  "dir": "components/shared",
  "exports": [
   "QuickCollect"
  ],
  "lines": 43,
  "deps": [
   "components/search/AppSearchPanels.tsx"
  ],
  "hooks": [],
  "atomic": "molecule",
  "consumers": 3
 },
 {
  "file": "components/shared/RailHover.tsx",
  "dir": "components/shared",
  "exports": [
   "RailHover"
  ],
  "lines": 157,
  "deps": [],
  "hooks": [
   "useCallback",
   "useEffect",
   "useRef",
   "useState"
  ],
  "atomic": "atom",
  "consumers": 4
 },
 {
  "file": "components/shared/SidebarTabStrip.tsx",
  "dir": "components/shared",
  "exports": [
   "SidebarTabRail",
   "SidebarTabStrip"
  ],
  "lines": 152,
  "deps": [
   "components/shared/RailHover.tsx"
  ],
  "hooks": [],
  "atomic": "molecule",
  "consumers": 6
 },
 {
  "file": "components/shared/SidebarToolTabs.tsx",
  "dir": "components/shared",
  "exports": [
   "SidebarToolTabs"
  ],
  "lines": 52,
  "deps": [
   "components/pageSidebars/kit.tsx",
   "components/shared/SidebarTabStrip.tsx"
  ],
  "hooks": [
   "useState"
  ],
  "atomic": "molecule",
  "consumers": 6
 },
 {
  "file": "components/shared/UnifiedComparisonAI.tsx",
  "dir": "components/shared",
  "exports": [
   "UnifiedComparisonAI"
  ],
  "lines": 156,
  "deps": [
   "components/shared/AIOutputCard.tsx",
   "components/shared/CopyDownloadButtons.tsx",
   "components/ui/button.tsx"
  ],
  "hooks": [
   "useAISettings",
   "usePersistentAIOutput",
   "useState"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/shared/UpdateIssues.tsx",
  "dir": "components/shared",
  "exports": [
   "UpdateIssues"
  ],
  "lines": 71,
  "deps": [],
  "hooks": [
   "useMemo"
  ],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/shared/VoiceControls.tsx",
  "dir": "components/shared",
  "exports": [
   "VoiceControls"
  ],
  "lines": 305,
  "deps": [
   "components/ui/popover.tsx",
   "components/ui/slider.tsx",
   "components/ui/switch.tsx"
  ],
  "hooks": [
   "useEffect",
   "useRef",
   "useSpeechState",
   "useState",
   "useVoiceCapsVersion",
   "useVoiceSettings"
  ],
  "atomic": "organism",
  "consumers": 1
 },
 {
  "file": "components/SidebarChartsPanel.tsx",
  "dir": "components",
  "exports": [
   "SidebarChartsPanel"
  ],
  "lines": 362,
  "deps": [
   "components/shared/AIOutputCard.tsx",
   "components/ui/button.tsx"
  ],
  "hooks": [
   "useCallback",
   "useDataset",
   "useEffect",
   "useMemo",
   "useRef",
   "useState"
  ],
  "atomic": "organism",
  "consumers": 2
 },
 {
  "file": "components/StatsCards.tsx",
  "dir": "components",
  "exports": [
   "StatsCards"
  ],
  "lines": 63,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/SystemStatusIndicator.tsx",
  "dir": "components",
  "exports": [
   "SystemStatusIndicator"
  ],
  "lines": 110,
  "deps": [],
  "hooks": [
   "useEffect",
   "useRef",
   "useState",
   "useTrackedTasks"
  ],
  "atomic": "atom",
  "consumers": 2
 },
 {
  "file": "components/terminal/TerminalPane.tsx",
  "dir": "components/terminal",
  "exports": [
   "TerminalPane"
  ],
  "lines": 242,
  "deps": [],
  "hooks": [
   "useEffect",
   "useRef",
   "useSmartAutoScroll",
   "useState"
  ],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/testCenter/RunsFilterBar.tsx",
  "dir": "components/testCenter",
  "exports": [
   "RunsFilterBar"
  ],
  "lines": 84,
  "deps": [],
  "hooks": [
   "useMemo"
  ],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/ThemeProvider.tsx",
  "dir": "components",
  "exports": [
   "ThemeProvider"
  ],
  "lines": 93,
  "deps": [],
  "hooks": [
   "useContext",
   "useEffect",
   "useState",
   "useTheme"
  ],
  "atomic": "atom",
  "consumers": 3
 },
 {
  "file": "components/ThemeToggle.tsx",
  "dir": "components",
  "exports": [
   "ThemeToggle"
  ],
  "lines": 75,
  "deps": [
   "components/ThemeProvider.tsx"
  ],
  "hooks": [
   "useEffect",
   "useRef",
   "useState",
   "useTheme"
  ],
  "atomic": "molecule",
  "consumers": 0
 },
 {
  "file": "components/TopCharts.tsx",
  "dir": "components",
  "exports": [
   "TopCharts"
  ],
  "lines": 519,
  "deps": [],
  "hooks": [
   "useCompare",
   "useEffect",
   "useMemo",
   "useNavigate",
   "useState"
  ],
  "atomic": "atom",
  "consumers": 3
 },
 {
  "file": "components/ui/accordion.tsx",
  "dir": "components/ui",
  "exports": [
   "Accordion",
   "AccordionContent",
   "AccordionItem",
   "AccordionTrigger"
  ],
  "lines": 53,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/ui/alert-dialog.tsx",
  "dir": "components/ui",
  "exports": [
   "AlertDialog",
   "AlertDialogAction",
   "AlertDialogCancel",
   "AlertDialogContent",
   "AlertDialogDescription",
   "AlertDialogFooter",
   "AlertDialogHeader",
   "AlertDialogOverlay",
   "AlertDialogPortal",
   "AlertDialogTitle",
   "AlertDialogTrigger"
  ],
  "lines": 105,
  "deps": [
   "components/ui/button.tsx"
  ],
  "hooks": [],
  "atomic": "molecule",
  "consumers": 1
 },
 {
  "file": "components/ui/alert.tsx",
  "dir": "components/ui",
  "exports": [
   "Alert",
   "AlertDescription",
   "AlertTitle"
  ],
  "lines": 44,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/ui/aspect-ratio.tsx",
  "dir": "components/ui",
  "exports": [
   "AspectRatio"
  ],
  "lines": 6,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/ui/avatar.tsx",
  "dir": "components/ui",
  "exports": [
   "Avatar",
   "AvatarFallback",
   "AvatarImage"
  ],
  "lines": 39,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/ui/badge.tsx",
  "dir": "components/ui",
  "exports": [
   "Badge"
  ],
  "lines": 30,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 10
 },
 {
  "file": "components/ui/breadcrumb.tsx",
  "dir": "components/ui",
  "exports": [
   "Breadcrumb",
   "BreadcrumbEllipsis",
   "BreadcrumbItem",
   "BreadcrumbLink",
   "BreadcrumbList",
   "BreadcrumbPage",
   "BreadcrumbSeparator"
  ],
  "lines": 91,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/ui/button.tsx",
  "dir": "components/ui",
  "exports": [
   "Button"
  ],
  "lines": 48,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 39
 },
 {
  "file": "components/ui/calendar.tsx",
  "dir": "components/ui",
  "exports": [
   "Calendar"
  ],
  "lines": 55,
  "deps": [
   "components/ui/button.tsx"
  ],
  "hooks": [],
  "atomic": "molecule",
  "consumers": 1
 },
 {
  "file": "components/ui/card.tsx",
  "dir": "components/ui",
  "exports": [
   "Card",
   "CardContent",
   "CardDescription",
   "CardFooter",
   "CardHeader",
   "CardTitle"
  ],
  "lines": 44,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 2
 },
 {
  "file": "components/ui/carousel.tsx",
  "dir": "components/ui",
  "exports": [
   "Carousel",
   "CarouselContent",
   "CarouselItem",
   "CarouselNext",
   "CarouselPrevious"
  ],
  "lines": 225,
  "deps": [
   "components/ui/button.tsx"
  ],
  "hooks": [
   "useCarousel",
   "useEmblaCarousel"
  ],
  "atomic": "organism",
  "consumers": 0
 },
 {
  "file": "components/ui/chart.tsx",
  "dir": "components/ui",
  "exports": [
   "ChartContainer",
   "ChartLegend",
   "ChartLegendContent",
   "ChartStyle",
   "ChartTooltip",
   "ChartTooltipContent"
  ],
  "lines": 304,
  "deps": [],
  "hooks": [
   "useChart"
  ],
  "atomic": "atom",
  "consumers": 0
 },
 {
  "file": "components/ui/checkbox.tsx",
  "dir": "components/ui",
  "exports": [
   "Checkbox"
  ],
  "lines": 27,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 3
 },
 {
  "file": "components/ui/collapsible.tsx",
  "dir": "components/ui",
  "exports": [
   "Collapsible",
   "CollapsibleContent",
   "CollapsibleTrigger"
  ],
  "lines": 10,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 0
 },
 {
  "file": "components/ui/command.tsx",
  "dir": "components/ui",
  "exports": [
   "Command",
   "CommandDialog",
   "CommandEmpty",
   "CommandGroup",
   "CommandInput",
   "CommandItem",
   "CommandList",
   "CommandSeparator",
   "CommandShortcut"
  ],
  "lines": 133,
  "deps": [
   "components/ui/dialog.tsx"
  ],
  "hooks": [],
  "atomic": "molecule",
  "consumers": 1
 },
 {
  "file": "components/ui/context-menu.tsx",
  "dir": "components/ui",
  "exports": [
   "ContextMenu",
   "ContextMenuCheckboxItem",
   "ContextMenuContent",
   "ContextMenuGroup",
   "ContextMenuItem",
   "ContextMenuLabel",
   "ContextMenuPortal",
   "ContextMenuRadioGroup",
   "ContextMenuRadioItem",
   "ContextMenuSeparator",
   "ContextMenuShortcut",
   "ContextMenuSub",
   "ContextMenuSubContent",
   "ContextMenuSubTrigger",
   "ContextMenuTrigger"
  ],
  "lines": 179,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/ui/dialog.tsx",
  "dir": "components/ui",
  "exports": [
   "Dialog",
   "DialogClose",
   "DialogContent",
   "DialogDescription",
   "DialogFooter",
   "DialogHeader",
   "DialogOverlay",
   "DialogPortal",
   "DialogTitle",
   "DialogTrigger"
  ],
  "lines": 96,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 7
 },
 {
  "file": "components/ui/drawer.tsx",
  "dir": "components/ui",
  "exports": [
   "Drawer",
   "DrawerClose",
   "DrawerContent",
   "DrawerDescription",
   "DrawerFooter",
   "DrawerHeader",
   "DrawerOverlay",
   "DrawerPortal",
   "DrawerTitle",
   "DrawerTrigger"
  ],
  "lines": 88,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 0
 },
 {
  "file": "components/ui/dropdown-menu.tsx",
  "dir": "components/ui",
  "exports": [
   "DropdownMenu",
   "DropdownMenuCheckboxItem",
   "DropdownMenuContent",
   "DropdownMenuGroup",
   "DropdownMenuItem",
   "DropdownMenuLabel",
   "DropdownMenuPortal",
   "DropdownMenuRadioGroup",
   "DropdownMenuRadioItem",
   "DropdownMenuSeparator",
   "DropdownMenuShortcut",
   "DropdownMenuSub",
   "DropdownMenuSubContent",
   "DropdownMenuSubTrigger",
   "DropdownMenuTrigger"
  ],
  "lines": 180,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 0
 },
 {
  "file": "components/ui/form.tsx",
  "dir": "components/ui",
  "exports": [
   "Form",
   "FormControl",
   "FormDescription",
   "FormField",
   "FormItem",
   "FormLabel",
   "FormMessage"
  ],
  "lines": 130,
  "deps": [
   "components/ui/label.tsx"
  ],
  "hooks": [
   "useFormContext",
   "useFormField"
  ],
  "atomic": "molecule",
  "consumers": 0
 },
 {
  "file": "components/ui/hover-card.tsx",
  "dir": "components/ui",
  "exports": [
   "HoverCard",
   "HoverCardContent",
   "HoverCardTrigger"
  ],
  "lines": 28,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 0
 },
 {
  "file": "components/ui/input-otp.tsx",
  "dir": "components/ui",
  "exports": [
   "InputOTP",
   "InputOTPGroup",
   "InputOTPSeparator",
   "InputOTPSlot"
  ],
  "lines": 62,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 0
 },
 {
  "file": "components/ui/input.tsx",
  "dir": "components/ui",
  "exports": [
   "Input"
  ],
  "lines": 23,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 9
 },
 {
  "file": "components/ui/label.tsx",
  "dir": "components/ui",
  "exports": [
   "Label"
  ],
  "lines": 18,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 5
 },
 {
  "file": "components/ui/menubar.tsx",
  "dir": "components/ui",
  "exports": [
   "Menubar",
   "MenubarCheckboxItem",
   "MenubarContent",
   "MenubarGroup",
   "MenubarItem",
   "MenubarLabel",
   "MenubarMenu",
   "MenubarPortal",
   "MenubarRadioGroup",
   "MenubarRadioItem",
   "MenubarSeparator",
   "MenubarShortcut",
   "MenubarSub",
   "MenubarSubContent",
   "MenubarSubTrigger",
   "MenubarTrigger"
  ],
  "lines": 208,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 0
 },
 {
  "file": "components/ui/navigation-menu.tsx",
  "dir": "components/ui",
  "exports": [
   "NavigationMenu",
   "NavigationMenuContent",
   "NavigationMenuIndicator",
   "NavigationMenuItem",
   "NavigationMenuLink",
   "NavigationMenuList",
   "NavigationMenuTrigger",
   "NavigationMenuViewport"
  ],
  "lines": 121,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 0
 },
 {
  "file": "components/ui/pagination.tsx",
  "dir": "components/ui",
  "exports": [
   "Pagination",
   "PaginationContent",
   "PaginationEllipsis",
   "PaginationItem",
   "PaginationLink",
   "PaginationNext",
   "PaginationPrevious"
  ],
  "lines": 82,
  "deps": [
   "components/ui/button.tsx"
  ],
  "hooks": [],
  "atomic": "molecule",
  "consumers": 1
 },
 {
  "file": "components/ui/popover.tsx",
  "dir": "components/ui",
  "exports": [
   "Popover",
   "PopoverContent",
   "PopoverTrigger"
  ],
  "lines": 30,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/ui/progress.tsx",
  "dir": "components/ui",
  "exports": [
   "Progress"
  ],
  "lines": 24,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/ui/radio-group.tsx",
  "dir": "components/ui",
  "exports": [
   "RadioGroup",
   "RadioGroupItem"
  ],
  "lines": 37,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 0
 },
 {
  "file": "components/ui/resizable.tsx",
  "dir": "components/ui",
  "exports": [
   "ResizableHandle",
   "ResizablePanel",
   "ResizablePanelGroup"
  ],
  "lines": 38,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 0
 },
 {
  "file": "components/ui/scroll-area.tsx",
  "dir": "components/ui",
  "exports": [
   "ScrollArea",
   "ScrollBar"
  ],
  "lines": 39,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 0
 },
 {
  "file": "components/ui/select.tsx",
  "dir": "components/ui",
  "exports": [
   "Select",
   "SelectContent",
   "SelectGroup",
   "SelectItem",
   "SelectLabel",
   "SelectScrollDownButton",
   "SelectScrollUpButton",
   "SelectSeparator",
   "SelectTrigger",
   "SelectValue"
  ],
  "lines": 144,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 2
 },
 {
  "file": "components/ui/separator.tsx",
  "dir": "components/ui",
  "exports": [
   "Separator"
  ],
  "lines": 21,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 4
 },
 {
  "file": "components/ui/sheet.tsx",
  "dir": "components/ui",
  "exports": [
   "Sheet",
   "SheetClose",
   "SheetContent",
   "SheetDescription",
   "SheetFooter",
   "SheetHeader",
   "SheetOverlay",
   "SheetPortal",
   "SheetTitle",
   "SheetTrigger"
  ],
  "lines": 108,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/ui/sidebar.tsx",
  "dir": "components/ui",
  "exports": [
   "Sidebar",
   "SidebarContent",
   "SidebarFooter",
   "SidebarGroup",
   "SidebarGroupAction",
   "SidebarGroupContent",
   "SidebarGroupLabel",
   "SidebarHeader",
   "SidebarInput",
   "SidebarInset",
   "SidebarMenu",
   "SidebarMenuAction",
   "SidebarMenuBadge",
   "SidebarMenuButton",
   "SidebarMenuItem",
   "SidebarMenuSkeleton",
   "SidebarMenuSub",
   "SidebarMenuSubButton",
   "SidebarMenuSubItem",
   "SidebarProvider",
   "SidebarRail",
   "SidebarSeparator",
   "SidebarTrigger"
  ],
  "lines": 638,
  "deps": [
   "components/ui/button.tsx",
   "components/ui/input.tsx",
   "components/ui/separator.tsx",
   "components/ui/sheet.tsx",
   "components/ui/skeleton.tsx",
   "components/ui/tooltip.tsx"
  ],
  "hooks": [
   "useIsMobile",
   "useSidebar"
  ],
  "atomic": "organism",
  "consumers": 0
 },
 {
  "file": "components/ui/skeleton.tsx",
  "dir": "components/ui",
  "exports": [
   "Skeleton"
  ],
  "lines": 8,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 2
 },
 {
  "file": "components/ui/slider.tsx",
  "dir": "components/ui",
  "exports": [
   "Slider"
  ],
  "lines": 24,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 4
 },
 {
  "file": "components/ui/sonner.tsx",
  "dir": "components/ui",
  "exports": [
   "Toaster"
  ],
  "lines": 28,
  "deps": [],
  "hooks": [
   "useTheme"
  ],
  "atomic": "atom",
  "consumers": 0
 },
 {
  "file": "components/ui/switch.tsx",
  "dir": "components/ui",
  "exports": [
   "Switch"
  ],
  "lines": 28,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 6
 },
 {
  "file": "components/ui/table.tsx",
  "dir": "components/ui",
  "exports": [
   "Table",
   "TableBody",
   "TableCaption",
   "TableCell",
   "TableFooter",
   "TableHead",
   "TableHeader",
   "TableRow"
  ],
  "lines": 73,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/ui/tabs.tsx",
  "dir": "components/ui",
  "exports": [
   "Tabs",
   "TabsContent",
   "TabsList",
   "TabsTrigger"
  ],
  "lines": 54,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 3
 },
 {
  "file": "components/ui/textarea.tsx",
  "dir": "components/ui",
  "exports": [
   "Textarea"
  ],
  "lines": 22,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 5
 },
 {
  "file": "components/ui/toast.tsx",
  "dir": "components/ui",
  "exports": [
   "Toast",
   "ToastAction",
   "ToastClose",
   "ToastDescription",
   "ToastProvider",
   "ToastTitle",
   "ToastViewport"
  ],
  "lines": 112,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/ui/toaster.tsx",
  "dir": "components/ui",
  "exports": [
   "Toaster"
  ],
  "lines": 25,
  "deps": [
   "components/ui/toast.tsx"
  ],
  "hooks": [
   "useToast"
  ],
  "atomic": "molecule",
  "consumers": 0
 },
 {
  "file": "components/ui/toggle-group.tsx",
  "dir": "components/ui",
  "exports": [
   "ToggleGroup",
   "ToggleGroupItem"
  ],
  "lines": 50,
  "deps": [
   "components/ui/toggle.tsx"
  ],
  "hooks": [],
  "atomic": "molecule",
  "consumers": 1
 },
 {
  "file": "components/ui/toggle.tsx",
  "dir": "components/ui",
  "exports": [
   "Toggle"
  ],
  "lines": 38,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 1
 },
 {
  "file": "components/ui/tooltip.tsx",
  "dir": "components/ui",
  "exports": [
   "Tooltip",
   "TooltipContent",
   "TooltipProvider",
   "TooltipTrigger"
  ],
  "lines": 29,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 3
 },
 {
  "file": "components/ui/use-toast.ts",
  "dir": "components/ui",
  "exports": [],
  "lines": 4,
  "deps": [],
  "hooks": [
   "useToast"
  ],
  "atomic": "atom",
  "consumers": 0
 },
 {
  "file": "components/ux/GlobalShortcuts.tsx",
  "dir": "components/ux",
  "exports": [
   "GlobalShortcuts"
  ],
  "lines": 82,
  "deps": [
   "components/ux/UxPrimitives.tsx"
  ],
  "hooks": [
   "useKeyboardShortcuts",
   "useMemo",
   "useNavigate",
   "useRef",
   "useState",
   "useUx"
  ],
  "atomic": "molecule",
  "consumers": 1
 },
 {
  "file": "components/ux/UxPrimitives.tsx",
  "dir": "components/ux",
  "exports": [
   "BusyIndicator",
   "EmptyAction",
   "ErrorBox",
   "LiveStatus",
   "ShortcutsDialog",
   "SkipLink"
  ],
  "lines": 175,
  "deps": [],
  "hooks": [
   "useShortcutsDialogState",
   "useState"
  ],
  "atomic": "atom",
  "consumers": 3
 },
 {
  "file": "components/WordCloud.tsx",
  "dir": "components",
  "exports": [
   "WordCloud"
  ],
  "lines": 52,
  "deps": [],
  "hooks": [],
  "atomic": "atom",
  "consumers": 3
 },
 {
  "file": "components/Workspace.tsx",
  "dir": "components",
  "exports": [
   "Workspace"
  ],
  "lines": 60,
  "deps": [
   "components/FloatingWindow.tsx"
  ],
  "hooks": [
   "useEffect",
   "useFeatureFlags",
   "useWM"
  ],
  "atomic": "molecule",
  "consumers": 0
 }
];

export const PAGE_USAGE: PageUsageEntry[] = [
 {
  "page": "pages/AICentral.tsx",
  "components": [
   "components/AISettingsPanel.tsx",
   "components/AppHeader.tsx",
   "components/SettingsPanel.tsx",
   "components/shared/AIChatShortcuts.tsx",
   "components/shared/AIOutputCard.tsx",
   "components/shared/ExpandableBlock.tsx",
   "components/ui/button.tsx"
  ]
 },
 {
  "page": "pages/Agentes.tsx",
  "components": [
   "components/AppHeader.tsx",
   "components/dashboard/ErrorBoundary.tsx",
   "components/shared/AIOutputCard.tsx"
  ]
 },
 {
  "page": "pages/AnalysisAtlas.tsx",
  "components": [
   "components/AppHeader.tsx",
   "components/analysisAtlas/AtlasTree.tsx",
   "components/analysisAtlas/ModuleContract.tsx",
   "components/analysisAtlas/PipelineComposer.tsx",
   "components/shared/SidebarToolTabs.tsx"
  ]
 },
 {
  "page": "pages/AppDetail.tsx",
  "components": [
   "components/AppHeader.tsx",
   "components/CollectionSettingsProvider.tsx",
   "components/shared/ComparisonView.tsx",
   "components/shared/EmptyState.tsx",
   "components/shared/PageLoader.tsx",
   "components/ui/button.tsx"
  ]
 },
 {
  "page": "pages/Canvas.tsx",
  "components": [
   "components/AppHeader.tsx",
   "components/canvas/CanvasChat.tsx",
   "components/canvas/CanvasNode.tsx",
   "components/canvas/CanvasSidebarTabs.tsx",
   "components/canvas/TemplateGallery.tsx",
   "components/shared/ContextMenu.tsx"
  ]
 },
 {
  "page": "pages/Case.tsx",
  "components": [
   "components/AppHeader.tsx",
   "components/case/AIInteractionExplorer.tsx",
   "components/case/ArchitectureMap.tsx",
   "components/case/CaseNav.tsx",
   "components/case/CaseShell.tsx",
   "components/case/CaseTimeline.tsx",
   "components/case/DecisionInspector.tsx",
   "components/case/EvidenceInspector.tsx",
   "components/case/EvolutionExplorer.tsx",
   "components/case/FailuresSection.tsx",
   "components/case/SkillInspector.tsx",
   "components/case/SystemDiagram.tsx",
   "components/case/TechnicalDiscovery.tsx"
  ]
 },
 {
  "page": "pages/Chat.tsx",
  "components": [
   "components/AppHeader.tsx",
   "components/shared/AIChatShortcuts.tsx",
   "components/shared/AIOutputCard.tsx",
   "components/ui/button.tsx",
   "components/ui/textarea.tsx"
  ]
 },
 {
  "page": "pages/ChatVoz.tsx",
  "components": [
   "components/AppHeader.tsx",
   "components/CollectionSettingsProvider.tsx",
   "components/PageTabsSidebar.tsx",
   "components/assistant/AssistantPanels.tsx",
   "components/assistant/VoiceDiagnostics.tsx",
   "components/assistant/VoiceOrb.tsx",
   "components/shared/AIOutputCard.tsx"
  ]
 },
 {
  "page": "pages/CompareRedirect.tsx",
  "components": [
   "components/CollectionSettingsProvider.tsx",
   "components/shared/PageLoader.tsx"
  ]
 },
 {
  "page": "pages/ComponentsCatalog.tsx",
  "components": [
   "components/AppHeader.tsx",
   "components/catalog/CatalogSidebars.tsx",
   "components/catalog/LivePreview.tsx",
   "components/catalog/PageFrame.tsx",
   "components/shared/ExpandableBlock.tsx"
  ]
 },
 {
  "page": "pages/Concept.tsx",
  "components": [
   "components/AppHeader.tsx",
   "components/CollectionSettingsProvider.tsx",
   "components/dashboard/DashboardCharts.tsx",
   "components/shared/AIOutputCard.tsx",
   "components/shared/SidebarToolTabs.tsx",
   "components/ui/button.tsx"
  ]
 },
 {
  "page": "pages/CustomPageView.tsx",
  "components": [
   "components/AppHeader.tsx",
   "components/dashboard/ErrorBoundary.tsx",
   "components/layoutBuilder/LayoutSpecView.tsx",
   "components/shared/EmptyState.tsx"
  ]
 },
 {
  "page": "pages/Dashboard.tsx",
  "components": [
   "components/AppHeader.tsx",
   "components/dashboard/DashboardAIPanel.tsx",
   "components/dashboard/DashboardCharts.tsx",
   "components/shared/EmptyState.tsx",
   "components/ui/button.tsx"
  ]
 },
 {
  "page": "pages/DataExplorer.tsx",
  "components": [
   "components/AppHeader.tsx",
   "components/Panel.tsx",
   "components/shared/AIOutputCard.tsx",
   "components/shared/CopyDownloadButtons.tsx",
   "components/shared/EmptyState.tsx",
   "components/shared/OriginBadge.tsx",
   "components/ui/badge.tsx",
   "components/ui/button.tsx"
  ]
 },
 {
  "page": "pages/DataPipeline.tsx",
  "components": [
   "components/AppHeader.tsx",
   "components/dashboard/ErrorBoundary.tsx",
   "components/shared/CopyDownloadButtons.tsx",
   "components/shared/EmptyState.tsx",
   "components/ui/badge.tsx",
   "components/ui/button.tsx"
  ]
 },
 {
  "page": "pages/DecisionCenter.tsx",
  "components": [
   "components/AppHeader.tsx",
   "components/shared/AIOutputCard.tsx",
   "components/shared/IAQueueBar.tsx",
   "components/shared/SidebarToolTabs.tsx",
   "components/ui/button.tsx"
  ]
 },
 {
  "page": "pages/DesignCanvas.tsx",
  "components": [
   "components/AppHeader.tsx",
   "components/designCanvas/DesignCanvasAICopilot.tsx",
   "components/designCanvas/DesignCanvasBoard.tsx",
   "components/designCanvas/DesignCanvasInspector.tsx",
   "components/designCanvas/DesignCanvasPalette.tsx",
   "components/designCanvas/DesignCanvasPreview.tsx",
   "components/designCanvas/PageSwitcher.tsx",
   "components/designCanvas/TemplateGallery.tsx",
   "components/shared/SidebarToolTabs.tsx"
  ]
 },
 {
  "page": "pages/DesignSystemPage.tsx",
  "components": [
   "components/AppHeader.tsx",
   "components/Panel.tsx",
   "components/dashboard/ErrorBoundary.tsx",
   "components/designCanvas/DesignCanvasNode.tsx",
   "components/settings/DesignSystemSection.tsx",
   "components/shared/AIOutputCard.tsx",
   "components/shared/CopyDownloadButtons.tsx",
   "components/shared/EmptyState.tsx",
   "components/shared/ExpandableBlock.tsx",
   "components/shared/SidebarTabStrip.tsx"
  ]
 },
 {
  "page": "pages/ExperimentDetailPage.tsx",
  "components": [
   "components/lab/ExperimentDetail.tsx"
  ]
 },
 {
  "page": "pages/Experiments.tsx",
  "components": [
   "components/AppHeader.tsx",
   "components/CollectionSettingsProvider.tsx",
   "components/shared/AIOutputCard.tsx",
   "components/shared/EmptyState.tsx",
   "components/shared/IAQueueBar.tsx",
   "components/ui/button.tsx",
   "components/ui/input.tsx"
  ]
 },
 {
  "page": "pages/FileChat.tsx",
  "components": [
   "components/AppHeader.tsx",
   "components/PageTabsSidebar.tsx",
   "components/shared/AIOutputCard.tsx",
   "components/shared/EmptyState.tsx",
   "components/shared/FilesPanel.tsx",
   "components/shared/OriginBadge.tsx"
  ]
 },
 {
  "page": "pages/Flow.tsx",
  "components": [
   "components/AppHeader.tsx",
   "components/flow/FlowContextPanel.tsx",
   "components/flow/FlowMissionBar.tsx",
   "components/flow/FlowNavigator.tsx",
   "components/flow/FlowSection.tsx",
   "components/flow/sections/SectionAgents.tsx",
   "components/flow/sections/SectionArtifacts.tsx",
   "components/flow/sections/SectionCollect.tsx",
   "components/flow/sections/SectionData.tsx",
   "components/flow/sections/SectionDecide.tsx",
   "components/flow/sections/SectionDiscover.tsx",
   "components/flow/sections/SectionExperiment.tsx",
   "components/flow/sections/SectionInvestigate.tsx",
   "components/flow/sections/SectionKnowledge.tsx",
   "components/flow/sections/SectionMission.tsx",
   "components/flow/sections/SectionMonitor.tsx",
   "components/flow/sections/SectionOpportunities.tsx",
   "components/flow/sections/SectionPresent.tsx",
   "components/flow/sections/SectionSelect.tsx",
   "components/flow/sections/SectionSignals.tsx",
   "components/flow/sections/SectionVisualize.tsx",
   "components/flow/useFlowScope.ts",
   "components/shared/SidebarToolTabs.tsx"
  ]
 },
 {
  "page": "pages/GitCanvas.tsx",
  "components": [
   "components/gitCanvas/GitBlocksView.tsx",
   "components/gitCanvas/GitCanvasBoard.tsx",
   "components/gitCanvas/GitCommandPalette.tsx",
   "components/gitCanvas/GitInspector.tsx",
   "components/gitCanvas/GitOnboarding.tsx",
   "components/gitCanvas/GitTimelinePanel.tsx",
   "components/gitCanvas/GitTopBar.tsx",
   "components/shared/ContextMenu.tsx"
  ]
 },
 {
  "page": "pages/Index.tsx",
  "components": [
   "components/AppHeader.tsx",
   "components/HeroSection.tsx",
   "components/TopCharts.tsx",
   "components/shared/EmptyState.tsx"
  ]
 },
 {
  "page": "pages/Journey.tsx",
  "components": [
   "components/AppHeader.tsx",
   "components/journey/StageAnalyze.tsx",
   "components/journey/StageCollect.tsx",
   "components/journey/StageDecide.tsx",
   "components/journey/StageDiscover.tsx",
   "components/journey/StagePresent.tsx",
   "components/journey/StageVisualize.tsx"
  ]
 },
 {
  "page": "pages/Lab.tsx",
  "components": [
   "components/AppHeader.tsx",
   "components/lab/DiscoveryBoard.tsx",
   "components/lab/ExperimentCard.tsx",
   "components/lab/ExperimentDialog.tsx",
   "components/lab/FindingCard.tsx",
   "components/lab/LabEmptyState.tsx",
   "components/lab/LabKnowledge.tsx",
   "components/lab/LabKpiCards.tsx",
   "components/lab/LabPipeline.tsx",
   "components/lab/ProductCandidateDialog.tsx",
   "components/ui/button.tsx",
   "components/ui/tabs.tsx"
  ]
 },
 {
  "page": "pages/LayoutBuilder.tsx",
  "components": [
   "components/AppHeader.tsx",
   "components/layoutBuilder/LayoutSpecView.tsx",
   "components/shared/EmptyState.tsx"
  ]
 },
 {
  "page": "pages/Methodologies.tsx",
  "components": [
   "components/AppHeader.tsx",
   "components/shared/AIOutputCard.tsx",
   "components/shared/EmptyState.tsx",
   "components/shared/IAQueueBar.tsx"
  ]
 },
 {
  "page": "pages/NotFound.tsx",
  "components": [
   "components/ui/button.tsx"
  ]
 },
 {
  "page": "pages/Nucleo.tsx",
  "components": [
   "components/AppHeader.tsx",
   "components/dashboard/ErrorBoundary.tsx",
   "components/flow/useFlowScope.ts"
  ]
 },
 {
  "page": "pages/OS.tsx",
  "components": [
   "components/CollectionSettingsProvider.tsx",
   "components/os/OSBottombar.tsx",
   "components/os/OSLeftSidebar.tsx",
   "components/os/OSRightSidebar.tsx",
   "components/os/OSTopbar.tsx",
   "components/os/OSViews.tsx"
  ]
 },
 {
  "page": "pages/Outputs.tsx",
  "components": [
   "components/AppHeader.tsx",
   "components/Panel.tsx",
   "components/shared/EmptyState.tsx",
   "components/shared/OriginBadge.tsx",
   "components/ui/button.tsx"
  ]
 },
 {
  "page": "pages/Page01.tsx",
  "components": [
   "components/AISettingsPanel.tsx",
   "components/AppHeader.tsx",
   "components/AppsPanel.tsx",
   "components/SessionsPanel.tsx",
   "components/SettingsPanel.tsx",
   "components/SidebarChartsPanel.tsx",
   "components/SystemStatusIndicator.tsx",
   "components/assistant/AssistantPanels.tsx",
   "components/assistant/VoiceDiagnostics.tsx",
   "components/page01/SplitColumn.tsx",
   "components/page01/panels.tsx",
   "components/pageSidebars/kit.tsx",
   "components/shared/IAQueueBar.tsx"
  ]
 },
 {
  "page": "pages/Pipeline.tsx",
  "components": [
   "components/AppHeader.tsx",
   "components/pipeline/ArtifactDetail.tsx",
   "components/pipeline/ArtifactVault.tsx",
   "components/pipeline/LineagePanel.tsx",
   "components/pipeline/OrchestratorPanel.tsx",
   "components/pipeline/PipelineLog.tsx",
   "components/pipeline/StageFlow.tsx",
   "components/shared/EmptyState.tsx",
   "components/shared/SidebarToolTabs.tsx",
   "components/ui/button.tsx"
  ]
 },
 {
  "page": "pages/Playground.tsx",
  "components": [
   "components/AppHeader.tsx",
   "components/shared/AIOutputCard.tsx",
   "components/ui/button.tsx"
  ]
 },
 {
  "page": "pages/Presentations.tsx",
  "components": [
   "components/AppHeader.tsx",
   "components/presentations/SlideView.tsx",
   "components/shared/EmptyState.tsx"
  ]
 },
 {
  "page": "pages/SearchResults.tsx",
  "components": [
   "components/AppCard.tsx",
   "components/AppHeader.tsx",
   "components/SectionHeader.tsx",
   "components/shared/EmptyState.tsx",
   "components/ui/button.tsx",
   "components/ux/UxPrimitives.tsx"
  ]
 },
 {
  "page": "pages/SessionsPage.tsx",
  "components": [
   "components/AppHeader.tsx",
   "components/SessionsPanel.tsx",
   "components/dashboard/ErrorBoundary.tsx"
  ]
 },
 {
  "page": "pages/SettingsPage.tsx",
  "components": [
   "components/AppHeader.tsx",
   "components/SettingsPanel.tsx",
   "components/dashboard/ErrorBoundary.tsx",
   "components/settings/DataHubSection.tsx",
   "components/settings/DesignSystemSection.tsx",
   "components/settings/LayoutComposerSection.tsx",
   "components/settings/SourcesSection.tsx",
   "components/settings/TotalResetSection.tsx",
   "components/shared/ExpandableBlock.tsx",
   "components/ui/slider.tsx",
   "components/ui/switch.tsx"
  ]
 },
 {
  "page": "pages/Terminal.tsx",
  "components": [
   "components/AppHeader.tsx",
   "components/CollectionSettingsProvider.tsx",
   "components/dashboard/ErrorBoundary.tsx",
   "components/terminal/TerminalPane.tsx"
  ]
 },
 {
  "page": "pages/TestCenter.tsx",
  "components": [
   "components/AppHeader.tsx",
   "components/testCenter/RunsFilterBar.tsx"
  ]
 }
];

export const DUPLICATE_EXPORTS: DuplicateEntry[] = [
 {
  "name": "ResizeHandle",
  "files": [
   "components/ResizeHandle.tsx",
   "components/layoutBuilder/LayoutCanvas.tsx"
  ]
 },
 {
  "name": "TemplateGallery",
  "files": [
   "components/canvas/TemplateGallery.tsx",
   "components/designCanvas/TemplateGallery.tsx"
  ]
 },
 {
  "name": "Toaster",
  "files": [
   "components/ui/sonner.tsx",
   "components/ui/toaster.tsx"
  ]
 }
];
