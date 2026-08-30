/**
 * UiShell — a estrutura de layout da página UI (SEM conteúdo):
 *
 *   ┌ barra de status (100%) ┐
 *   ├ header / barra de ferramentas (100%) ┤
 *   ├ [esq-externa][esq-interna][CENTRO][dir-interna][dir-externa] ┤
 *   └ footer com barra de status (100%) ┘
 *
 * Comportamentos:
 *  - Container-relativo (ResizeObserver na própria página — NÃO media query
 *    do viewport): funciona dentro de qualquer centro do AppShell.
 *  - Colunas inteligentes: faltando espaço, fecham sozinhas para rail
 *    (resolveAutoCollapsed, sem gravar o estado do usuário); sobrando,
 *    reabrem com histerese. O "reset" volta ao padrão dividido em 3
 *    colunas (externas abertas, internas em rail).
 *  - Mobile-first (modo overlay): abaixo do breakpoint, as laterais saem
 *    do fluxo e abrem como gavetas overlay pelos botões da toolbar.
 *  - A11y: status bar com role=status, header com role=toolbar, colunas
 *    como landmarks nomeados, centro como região principal, footer
 *    contentinfo, gaveta com role=dialog + Esc + clique-fora.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, PanelLeft, PanelRight, X, PanelsTopLeft } from "lucide-react";
import { UiColumn } from "./UiColumn";
import { UiThemeMenu } from "./UiThemeMenu";
import { UiCenter } from "./UiCenter";
import {
  UI_COLUMNS, UI_COLUMN_ORDER, UI_OVERLAY_BREAKPOINT,
  getColumnSpec, resolveAutoCollapsed, shellMode, expandedCount,
  type UiColumnId,
} from "@/lib/uiShell/layout";
import { useUiShell, toggleColumnCollapsed, resetShell } from "@/lib/uiShell/store";
import { cn } from "@/lib/utils";



/**
 * Mede e força o modo por largura. `forceWidth` é só para testes — em
 * produção a largura vem do ResizeObserver do próprio container.
 */
export function UiShell({ forceWidth }: { forceWidth?: number }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState(0);
  const state = useUiShell();
  const [drawer, setDrawer] = useState<UiColumnId | null>(null);

  useEffect(() => {
    if (forceWidth != null) return;
    const el = rootRef.current;
    if (!el) return;
    setMeasured(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      setMeasured(entries[0]?.contentRect.width ?? el.clientWidth);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [forceWidth]);

  const containerWidth = forceWidth ?? measured;
  const mode = containerWidth > 0 ? shellMode(containerWidth) : "columns";

  const prevAutoRef = useRef<Set<UiColumnId>>(new Set());
  const autoCollapsed = useMemo(() => {
    const next = containerWidth > 0
      ? resolveAutoCollapsed(containerWidth, state, prevAutoRef.current)
      : new Set<UiColumnId>();
    prevAutoRef.current = next;
    return next;
  }, [containerWidth, state]);

  // Fora do modo overlay a gaveta não faz sentido — fecha ao voltar p/ colunas.
  useEffect(() => {
    if (mode === "columns") setDrawer(null);
  }, [mode]);

  const openCount = expandedCount(state, autoCollapsed);
  const drawerSpec = drawer ? getColumnSpec(drawer) : null;

  return (
    <div ref={rootRef} className="h-full min-h-0 w-full flex flex-col overflow-hidden bg-background">
      {/* Barra de status (topo, 100%) */}
      <div role="status" aria-label="Status do layout"
        className="h-6 flex items-center justify-between gap-2 px-3 border-b border-border/50 bg-secondary/40 text-[10px] text-muted-foreground flex-shrink-0 overflow-hidden">
        <span className="truncate">UI · estrutura de layout — sem conteúdo</span>
        <span className="truncate tabular-nums">
          {openCount}/4 colunas abertas · {mode === "overlay" ? "overlay (mobile)" : "colunas"}
          {containerWidth > 0 && ` · ${Math.round(containerWidth)}px`}
        </span>
      </div>

      {/* Header / barra de ferramentas (100%) */}
      <header className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border/50 bg-card/50 flex-shrink-0">
        <h1 className="text-xs font-semibold text-foreground px-1.5 flex items-center gap-1.5">
          <PanelsTopLeft className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> UI
        </h1>
        <div role="toolbar" aria-label="Ferramentas do layout"
          className="flex items-center gap-1 min-w-0 overflow-x-auto scrollbar-thin">
          {UI_COLUMN_ORDER.map((id) => {
            const spec = getColumnSpec(id);
            const Icon = spec.side === "left" ? PanelLeft : PanelRight;
            const active = mode === "columns" ? !state[id].collapsed : drawer === id;
            return (
              <button
                key={id}
                onClick={() => (mode === "overlay" ? setDrawer(drawer === id ? null : id) : toggleColumnCollapsed(id))}
                aria-pressed={active}
                aria-label={`${active ? "Fechar" : "Abrir"} coluna ${spec.label}`}
                title={`${active ? "Fechar" : "Abrir"} coluna ${spec.label}`}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] whitespace-nowrap transition-colors",
                  active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary",
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">{spec.label}</span>
              </button>
            );
          })}
        </div>
        <div className="flex-1" />
        <button
          onClick={resetShell}
          title="Resetar padrão — layout dividido em 3 colunas"
          aria-label="Resetar padrão — layout dividido em 3 colunas"
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex-shrink-0"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Resetar (3 colunas)</span>
        </button>
        <UiThemeMenu />
      </header>

      {/* Corpo: 5 colunas (modo colunas) ou só o centro (modo overlay) */}
      <div className="flex-1 min-h-0 flex">
        {mode === "columns" && (
          <>
            <UiColumn spec={getColumnSpec("left-outer")} state={state["left-outer"]} autoCollapsed={autoCollapsed.has("left-outer")} />
            <UiColumn spec={getColumnSpec("left-inner")} state={state["left-inner"]} autoCollapsed={autoCollapsed.has("left-inner")} />
          </>
        )}
        <UiCenter />
        {mode === "columns" && (
          <>
            <UiColumn spec={getColumnSpec("right-inner")} state={state["right-inner"]} autoCollapsed={autoCollapsed.has("right-inner")} />
            <UiColumn spec={getColumnSpec("right-outer")} state={state["right-outer"]} autoCollapsed={autoCollapsed.has("right-outer")} />
          </>
        )}
      </div>

      {/* Footer com barra de status (100%) */}
      <footer className="flex-shrink-0 border-t border-border/50 bg-card/50">
        <div role="status" aria-label="Status do rodapé"
          className="h-6 flex items-center justify-between gap-2 px-3 text-[10px] text-muted-foreground overflow-hidden">
          <span className="truncate">Pronto</span>
          <span className="truncate">ui shell · layout estrutural responsivo</span>
        </div>
      </footer>

      {/* Gaveta overlay (modo mobile): a coluna abre por cima do centro,
          sem mudar o estado de recolhimento persistido. */}
      {mode === "overlay" && drawerSpec && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Coluna ${drawerSpec.label}`}
          className="fixed inset-0 z-50 flex"
        >
          <button
            aria-label="Fechar gaveta"
            onClick={() => setDrawer(null)}
            className="absolute inset-0 bg-background/60 backdrop-blur-sm cursor-default"
          />
          <div
            className={cn(
              "relative h-full w-[min(320px,88vw)]",
              drawerSpec.side === "left" ? "mr-auto" : "ml-auto",
            )}
          >
            <UiColumn
              spec={drawerSpec}
              state={{ width: Math.min(320, typeof window === "undefined" ? 320 : window.innerWidth), collapsed: false }}
            />
            <button
              onClick={() => setDrawer(null)}
              aria-label="Fechar"
              autoFocus
              className="absolute top-2 right-2 p-1.5 rounded-md bg-card text-muted-foreground hover:text-foreground border border-border/60 z-10"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {/* Esc fecha (listeners globais enquanto a gaveta existe) */}
          <EscClose onClose={() => setDrawer(null)} />
        </div>
      )}
    </div>
  );
}

function EscClose({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return null;
}
