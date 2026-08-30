/**
 * SidebarTabStrip — a ÚNICA strip de abas do sistema (padronização total).
 *
 * Usada por TODAS as sidebars, externas e internas:
 *  - AIAssistantPanel (externa direita) e LeftSidebar (externa esquerda);
 *  - PageTabsSidebar (internas via PageSidebarsContext);
 *  - TabsBlock do /01 (SplitColumn) e qualquer bloco com abas.
 *
 * Comportamento padronizado:
 *  - Scroll HORIZONTAL quando há muitas abas (botões nunca espremem:
 *    shrink-0 + whitespace-nowrap + overflow-x-auto com scrollbar-thin).
 *  - Visual pill: ativa = bg-primary/10 text-primary; inativa = muted hover.
 *  - Badge de contagem opcional por aba (ex.: nº de apps, conversas).
 *  - A11y: role=tablist/tab + aria-selected; foco com ring visível.
 *
 * SidebarTabRail — o rail de ícones usado quando a sidebar está RECOLHIDA
 * (um botão por aba, com badge absoluto opcional).
 */
import type { ReactNode } from "react";
import { RailHover } from "@/components/shared/RailHover";
import { cn } from "@/lib/utils";

export interface SidebarTabDef {
  id: string;
  label: string;
  icon: ReactNode;
  /** título/tooltip acessível (default: label). */
  title?: string;
  /** contador exibido ao lado do label (ex.: nº de itens da aba). */
  badge?: number;
}

interface StripProps {
  tabs: readonly SidebarTabDef[];
  active: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  /** ação fixa à direita da strip (ex.: recolher bloco). */
  end?: ReactNode;
  className?: string;
  /** centraliza os botões (ex.: abas do CENTRO da página UI). */
  centered?: boolean;
}

export function SidebarTabStrip({ tabs, active, onChange, ariaLabel, end, className, centered }: StripProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "flex items-center gap-1 p-2 border-b border-border/50 flex-shrink-0 overflow-x-auto scrollbar-thin",
        centered && "justify-center",
        className,
      )}
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={active === t.id}
          onClick={() => onChange(t.id)}
          title={t.title ?? t.label}
          className={cn(
            "shrink-0 flex items-center justify-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-md transition-colors whitespace-nowrap",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
            active === t.id
              ? "bg-primary/10 text-primary font-medium"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground",
          )}
        >
          {t.icon}
          {t.label}
          {(t.badge ?? 0) > 0 && (
            <span
              className="text-[9px] bg-primary/20 text-primary px-1 rounded"
              aria-label={`${t.badge} item(ns)`}
            >
              {t.badge! > 999 ? "999+" : t.badge}
            </span>
          )}
        </button>
      ))}
      {end && <div className="ml-auto flex-shrink-0">{end}</div>}
    </div>
  );
}

interface RailProps {
  tabs: readonly SidebarTabDef[];
  active?: string;
  onSelect: (id: string) => void;
  className?: string;
  /** Lado do tooltip/flyout (rail da esquerda → "right"; direita → "left"). */
  tooltipSide?: "left" | "right";
  /**
   * Quando definido, o hover sobre um item do rail abre um FLYOUT flutuante
   * com o conteúdo real da aba (em vez de um tooltip) — dá para usar o
   * recurso sem expandir a sidebar. O clique continua selecionando a aba
   * (e expandindo a coluna, via CollapsibleColumn).
   */
  renderFlyout?: (tab: SidebarTabDef) => ReactNode;
  /** Largura do flyout (default 360). */
  flyoutWidth?: number;
}

/**
 * Rail vertical de ícones (sidebar recolhida) — um botão por aba.
 * Hover → tooltip simples OU flyout com o conteúdo da aba (renderFlyout).
 * Clique → seleciona a aba; dentro de um CollapsibleColumn também EXPANDE
 * a coluna (expand-on-click no wrapper de railIcons).
 */
export function SidebarTabRail({ tabs, active, onSelect, className, tooltipSide = "right", renderFlyout, flyoutWidth }: RailProps) {
  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      {tabs.map((t) => {
        const button = (
          <button
            onClick={() => onSelect(t.id)}
            aria-label={t.title ?? `Abrir ${t.label}`}
            aria-current={active === t.id ? "page" : undefined}
            className={cn(
              "p-2 rounded-lg transition-colors relative focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
              active === t.id
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <span className="[&>svg]:h-4 [&>svg]:w-4 flex">{t.icon}</span>
            {(t.badge ?? 0) > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 text-[9px] bg-primary text-primary-foreground rounded-full min-w-4 h-4 px-0.5 flex items-center justify-center"
                aria-label={`${t.badge} item(ns)`}
              >
                {t.badge! > 99 ? "99+" : t.badge}
              </span>
            )}
          </button>
        );
        return (
          <RailHover
            key={t.id}
            trigger={button}
            label={t.label}
            icon={renderFlyout ? t.icon : undefined}
            description={t.title !== t.label ? t.title : undefined}
            content={renderFlyout ? renderFlyout(t) : undefined}
            side={tooltipSide}
            width={flyoutWidth}
          />
        );
      })}
    </div>
  );
}
