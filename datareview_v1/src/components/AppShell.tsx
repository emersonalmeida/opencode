import { useEffect, useRef, type ReactNode } from "react";
import { startServerHealthMonitor, stopServerHealthMonitor } from "@/lib/serverHealth";
import { useLocation } from "react-router-dom";
import { LeftSidebar } from "@/components/LeftSidebar";
import { AIAssistantPanel } from "@/components/AIAssistantPanel";
import { ComparePickerDialog } from "@/components/ComparePickerDialog";
import { ResizeHandle } from "@/components/ResizeHandle";
import { OnboardingModal } from "@/components/OnboardingModal";
import { useCompare } from "@/context/CompareContext";
import { useColumnSize } from "@/lib/useColumnSize";
import { useFeatureFlags, isFeatureEnabled } from "@/lib/featureFlags";
import { applyBackground } from "@/lib/appearanceSettings";
import { applyUISettings } from "@/lib/uiSettings";
import { startMonitorScheduler } from "@/lib/monitorRunner";
import { BackgroundLayer } from "@/components/BackgroundLayer";
import { SkipLink } from "@/components/ux/UxPrimitives";
import { GlobalShortcuts } from "@/components/ux/GlobalShortcuts";
import { VersionMismatchBanner } from "@/components/VersionMismatchBanner";

import { PageSidebarsProvider, PageSidebarHost } from "@/context/PageSidebarsContext";
import { RouteSidebars } from "@/components/pageSidebars/RouteSidebars";
import { trackPageView } from "@/lib/usage";
import { SIDEBARS } from "@/lib/sidebarSizing";
import { useLayout, isDefaultLayout, SLOT_ORDER, type WidgetId } from "@/lib/layoutComposer";
import { WidgetColumn } from "@/components/layoutComposer/WidgetColumn";
import { applyDesignTokens } from "@/lib/designTokens";

// Larguras padronizadas (fonte única: src/lib/sidebarSizing.ts)
const LEFT_DEFAULT = SIDEBARS.left.defaultWidth, LEFT_MIN = SIDEBARS.left.minWidth;
const RIGHT_DEFAULT = SIDEBARS.right.defaultWidth, RIGHT_MIN = SIDEBARS.right.minWidth;
const LEFT_RAIL = SIDEBARS.left.railWidth;
const RIGHT_RAIL = SIDEBARS.right.railWidth;

/** Rotas que dispensam as sidebars EXTERNAS (a página monta suas próprias
 *  colunas internas completas). Vazio: TODAS as páginas mostram as sidebars
 *  do sistema — páginas-workspace (ex.: /01) somam suas colunas INTERNAS
 *  às externas, nunca as substituem. */
const HIDE_EXTERNAL_SIDEBARS: RegExp[] = [];

/**
 * Three-column shell.
 * - Full viewport height, each column scrolls internally.
 * - Left (system) and right (AI) sidebars share the SAME sizing contract as
 *   every internal page column (via `useColumnSize`): collapsible to a narrow
 *   rail, resizable by drag, and clamped to at most 25% of the viewport so no
 *   sidebar can ever starve the center column. Width + collapsed state persist.
 * - Center column is width-constrained to ~92% of its container and centered.
 */
export function AppShell({ children }: { children: ReactNode }) {
  // Monitor de saúde do servidor: sobe junto com o app e detecta quando
  // o servidor local volta a responder (ex.: usuário rodou npm run dev:all
  // depois de abrir a página).
  useEffect(() => {
    startServerHealthMonitor();
    return () => stopServerHealthMonitor();
  }, []);

  // Re-render when feature flags change so sidebars hide/show live.
  useFeatureFlags();
  // Sem defaultCollapsed explícito: vale o padrão global do hook
  // (recolhida) — as sidebars externas também iniciam fechadas.
  const left = useColumnSize({
    storageKey: "aso:sidebar-left-w",
    collapsedKey: "aso:sidebar-left-collapsed",
    defaultWidth: LEFT_DEFAULT,
    minWidth: LEFT_MIN,
  });
  const right = useColumnSize({
    storageKey: "aso:sidebar-right-w",
    collapsedKey: "aso:sidebar-right-collapsed",
    defaultWidth: RIGHT_DEFAULT,
    minWidth: RIGHT_MIN,
  });
  const { pickerOpen, setPickerOpen } = useCompare();
  const mainRef = useRef<HTMLElement>(null);
  const location = useLocation();
  // Em rotas de hub completo (ex.: /01), as sidebars EXTERNAS saem de cena —
  // a página ocupa os dois lados com suas próprias colunas internas.
  const hideExternal = HIDE_EXTERNAL_SIDEBARS.some((r) => r.test(location.pathname));

  // Scroll the center column back to top on every page change.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [location.pathname]);

  // Telemetria local de uso (Onda 1.3): 1 page view por troca de rota,
  // ponto único de rastreamento (nunca registrar views em outro lugar).
  useEffect(() => {
    trackPageView(location.pathname);
  }, [location.pathname]);

  // Mantém a flag legada panelOpen do AIContext em sincronia com o estado de colapso.
  useEffect(() => {
    try { localStorage.setItem("aso:ai-panel", right.collapsed ? "0" : "1"); } catch { /* ignore */ }
  }, [right.collapsed]);

  // Apply compact density class to <html> when the flag is on (live, no reload).
  useEffect(() => {
    const root = document.documentElement;
    const on = isFeatureEnabled("ui.compact-density");
    root.classList.toggle("density-compact", on);
    return () => root.classList.remove("density-compact");
  });

  // Monitoramento agendado (Onda 3.2): scheduler global de recoleta com diff.
  // Vive no shell (todas as páginas) e para quando a aba fica oculta.
  useEffect(() => startMonitorScheduler(), []);

  // Apply the user's custom background (gradient/color/image + blur) once on
  // mount of the shell — every page sits inside this shell, so the preference
  // applies globally (also reapplied on each setBackgroundSettings call).
  useEffect(() => {
    applyBackground();
    applyUISettings();
    applyDesignTokens();
  }, []);

  // Layout composer: quando o usuário move algum widget (layout ≠ padrão), os
  // 4 slots passam a ser colunas de widgets empilháveis/arrastáveis.
  const layout = useLayout();
  const composerMode =
    !hideExternal && isFeatureEnabled("ui.layout-composer") && !isDefaultLayout(layout);

  const renderWidget = (id: WidgetId): ReactNode => {
    switch (id) {
      case "nav":
        return isFeatureEnabled("ui.left-sidebar")
          ? <LeftSidebar collapsed={false} onToggle={() => {}} />
          : null;
      case "ai":
        return isFeatureEnabled("ui.right-sidebar")
          ? <AIAssistantPanel collapsed={false} onToggle={() => {}} />
          : null;
      case "page-left":
        return <PageSidebarHost side="left" fill />;
      case "page-right":
        return <PageSidebarHost side="right" fill />;
    }
  };

  const slotWidgets = (slot: (typeof SLOT_ORDER)[number]) =>
    layout[slot].filter((id) => renderWidgetAllowed(id));

  const renderWidgetAllowed = (id: WidgetId): boolean => {
    if (id === "nav") return isFeatureEnabled("ui.left-sidebar");
    if (id === "ai") return isFeatureEnabled("ui.right-sidebar");
    return true;
  };

  const slotWidth = (slot: (typeof SLOT_ORDER)[number]): number =>
    slot === "leftExt" ? left.width
    : slot === "rightExt" ? right.width
    : slot === "leftInt" ? 280 : 320;

  return (
    <PageSidebarsProvider>
    {/* Sidebars INTERNAS padrão por rota (páginas sem sidebar interna própria). */}
    <RouteSidebars />
    <div className="app-shell-root h-screen w-screen bg-background flex overflow-hidden">
      {/* Camada de fundo customizável (gradiente/cor/imagem/vídeo), atrás de tudo */}
      <BackgroundLayer />
      {/* A11y: teclado/leitor de tela pula direto para o conteúdo (WCAG 2.4.1). */}
      <SkipLink />
      {/* Atalhos globais + central de ajuda ("?"). */}
      <GlobalShortcuts />
      {/* Aviso quando o build aberto diverge do commit do servidor (git pull
          sem recarregar a página) — oferece reload. */}
      <VersionMismatchBanner />
      {composerMode ? (
        /* ── Modo compositor: slots de widgets empilháveis/arrastáveis ── */
        <>
          {SLOT_ORDER.slice(0, 2).map((slot) => {
            const widgets = slotWidgets(slot);
            if (widgets.length === 0) return null;
            return (
              <WidgetColumn
                key={slot}
                slot={slot}
                widgetIds={widgets}
                width={slotWidth(slot)}
                isLeft
                renderWidget={renderWidget}
              />
            );
          })}

          <main
            id="conteudo-principal"
            ref={mainRef}
            tabIndex={-1}
            className="flex-1 min-w-0 h-full overflow-y-auto overflow-x-hidden focus:outline-none"
          >
            <div className="w-full h-full">{children}</div>
          </main>

          {SLOT_ORDER.slice(2).map((slot) => {
            const widgets = slotWidgets(slot);
            if (widgets.length === 0) return null;
            return (
              <WidgetColumn
                key={slot}
                slot={slot}
                widgetIds={widgets}
                width={slotWidth(slot)}
                isLeft={false}
                renderWidget={renderWidget}
              />
            );
          })}
        </>
      ) : (
        <>
          {/* LEFT: unified primary sidebar (apps + chats) — hidden if feature disabled */}
          {!hideExternal && isFeatureEnabled("ui.left-sidebar") && (
            <div
              className="relative flex-shrink-0 h-full"
              style={{ width: left.effectiveWidth(LEFT_RAIL) }}
            >
              <LeftSidebar collapsed={left.collapsed} onToggle={left.toggleCollapsed} />
              {!left.collapsed && (
                <ResizeHandle
                  side="right"
                  onResize={left.resize}
                  onReset={left.reset}
                  value={left.width}
                  min={left.min}
                  max={left.max}
                  ariaLabel="Largura da sidebar esquerda"
                />
              )}
            </div>
          )}

          {/* INTERNAL LEFT: sidebar interna da página (registrada via <PageSidebar>) */}
          <PageSidebarHost side="left" />

          {/* CENTER: page content — fills all remaining space between sidebars */}
          <main
            id="conteudo-principal"
            ref={mainRef}
            tabIndex={-1}
            className="flex-1 min-w-0 h-full overflow-y-auto overflow-x-hidden focus:outline-none"
          >
            <div className="w-full h-full">{children}</div>
          </main>

          {/* INTERNAL RIGHT: sidebar interna da página (registrada via <PageSidebar>) */}
          <PageSidebarHost side="right" />

          {/* RIGHT: AI assistant — hidden if feature disabled */}
          {!hideExternal && isFeatureEnabled("ui.right-sidebar") && (
            <div
              className="relative flex-shrink-0 h-full"
              style={{ width: right.effectiveWidth(RIGHT_RAIL) }}
            >
              {!right.collapsed && (
                <ResizeHandle
                  side="left"
                  onResize={right.resize}
                  onReset={right.reset}
                  value={right.width}
                  min={right.min}
                  max={right.max}
                  ariaLabel="Largura da sidebar direita"
                />
              )}
              <AIAssistantPanel collapsed={right.collapsed} onToggle={right.toggleCollapsed} />
            </div>
          )}
        </>
      )}

      <ComparePickerDialog open={pickerOpen} onOpenChange={setPickerOpen} />

      <OnboardingModal />
    </div>
    </PageSidebarsProvider>
  );
}
