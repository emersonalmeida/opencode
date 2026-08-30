/**
 * PageTabsSidebar — helper para registrar a sidebar INTERNA de uma página com
 * várias ABAS (ex.: Atlas = [Módulos, Pipeline], Canvas = [Paleta, Canvas,
 * Terminal]). Usa o PageSidebarsContext: o AppShell a monta como coluna
 * inteira entre o centro e a sidebar externa do mesmo lado. Recolhida,
 * mostra o rail de 56px com um ícone por aba (clique troca a aba). Sem o
 * shell externo, renderiza o conteúdo inline (fallback para testes).
 *
 * Padronização: a strip de abas e o rail vêm do componente compartilhado
 * `SidebarTabStrip`/`SidebarTabRail` (mesmo visual da sidebar externa de IA).
 * A strip rola horizontalmente quando há muitas abas.
 *
 * `helpTab`: quando informado, PREPENDE a aba "Como funciona" (HelpPanel) —
 * primeira aba e ativa por padrão, explicando o que a página faz antes das
 * ferramentas. Padrão de TODAS as sidebars internas.
 */
import { useEffect, useState, type ReactNode } from "react";
import { HelpCircle } from "lucide-react";
import { PageSidebar } from "@/context/PageSidebarsContext";
import { SidebarTabStrip, SidebarTabRail } from "@/components/shared/SidebarTabStrip";
import { HelpPanel } from "@/components/pageSidebars/kit";

export interface PageTab {
  id: string;
  label: string;
  icon: ReactNode;
  content: ReactNode;
}

interface Props {
  id: string;
  side: "left" | "right";
  /** Título da coluna (nome da página/domínio). */
  title: string;
  subtitle?: string;
  icon: ReactNode;
  storageKey: string;
  defaultWidth?: number;
  tabs: PageTab[];
  defaultTab?: string;
  /** Ativa uma aba quando um evento global dispara (ex.: seleção de
   *  componente no catálogo ativa a aba "Componente" da sidebar direita). */
  activateOnEvent?: { event: string; tabId: string };
  /** Se definido, adiciona a aba "Como funciona" como PRIMEIRA (ativa por
   *  padrão, a não ser que defaultTab diga outra). */
  helpTab?: { description: string; tips?: string[] };
  expandLabel?: string;
  collapseLabel?: string;
  headerRight?: ReactNode;
}

export function PageTabsSidebar(props: Props) {
  const tabs: PageTab[] = props.helpTab
    ? [{
        id: "como-funciona",
        label: "Como funciona",
        icon: <HelpCircle className="h-3 w-3" />,
        content: <HelpPanel description={props.helpTab.description} tips={props.helpTab.tips} />,
      }, ...props.tabs]
    : props.tabs;

  const [active, setActive] = useState(props.defaultTab ?? tabs[0]?.id);

  // Ativação externa de aba (ex.: selecionar um componente abre a aba dele).
  useEffect(() => {
    const spec = props.activateOnEvent;
    if (!spec) return;
    const handler = () => setActive(spec.tabId);
    window.addEventListener(spec.event, handler);
    return () => window.removeEventListener(spec.event, handler);
  }, [props.activateOnEvent]);

  // Recolhida: clicar num ícone do rail seleciona a aba E expande a coluna
  // (o CollapsibleColumn envolve os railIcons com expand-on-click). O HOVER
  // abre um flyout flutuante com o conteúdo real da aba — dá para usar o
  // recurso sem expandir a sidebar.
  const railIcons = (
    <SidebarTabRail
      tabs={tabs}
      active={active}
      onSelect={setActive}
      tooltipSide={props.side === "right" ? "left" : "right"}
      renderFlyout={(t) => {
        const full = tabs.find((x) => x.id === t.id);
        return full ? <div className="p-2">{full.content}</div> : null;
      }}
    />
  );

  const meta = {
    id: props.id,
    side: props.side,
    title: props.title,
    subtitle: props.subtitle,
    icon: props.icon,
    storageKey: props.storageKey,
    defaultWidth: props.defaultWidth,
    headerRight: props.headerRight,
    expandLabel: props.expandLabel,
    collapseLabel: props.collapseLabel,
    railIcons,
    // O flyout por ABA já vem do SidebarTabRail — desativa o flyout genérico
    // do PageSidebar (que mostraria a tabStrip inteira duplicada).
    railFlyout: null,
  } as const;

  const tabStrip = (
    <div className="flex flex-col h-full">
      <SidebarTabStrip
        tabs={tabs}
        active={active}
        onChange={setActive}
        ariaLabel={`Painéis de ${props.title}`}
      />
      {/* Todas as abas ficam montadas (hidden quando inativas) — preserva
          scroll, expansões e estado interno entre trocas de aba. */}
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" hidden={active !== t.id} className="min-h-0 min-w-0 overflow-y-auto flex-1">
          {t.content}
        </div>
      ))}
    </div>
  );

  return <PageSidebar meta={meta}>{tabStrip}</PageSidebar>;
}
