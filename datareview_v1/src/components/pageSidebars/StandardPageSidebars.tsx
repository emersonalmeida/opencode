/**
 * StandardPageSidebars — registra as DUAS sidebars INTERNAS padrão de uma
 * página (modelo de 5 colunas):
 *
 *   [Externa: páginas] [Interna E: Contexto …] [CENTRO] [Interna D: Insights/Atividade …] [Externa: IA]
 *
 * Contrato padronizado:
 *  - ESQUERDA interna: aba "Contexto" (escopo/seleção global) + aba "Âncoras"
 *    (seções da página, quando houver) + abas extras da página.
 *  - DIREITA interna: aba "Como funciona" (o que a página faz + dicas, PRIMEIRA
 *    e ativa por padrão) + abas "Insights" (feedback loop IA) e "Atividade"
 *    (log do sistema) + abas extras da página.
 *
 * Páginas com sidebars internas próprias (Atlas, Canvas, Pipeline, Concept,
 * DecisionCenter, DesignCanvas, Flow, OS) NÃO usam este helper — registram
 * via PageSidebar/PageTabsSidebar diretamente.
 */
import type { ReactNode } from "react";
import { Activity, Compass, HelpCircle, Lightbulb, SquareStack } from "lucide-react";
import { PageTabsSidebar, type PageTab } from "@/components/PageTabsSidebar";
import {
  ActivityPanel, AnchorsPanel, ContextPanel, HelpPanel, InsightsPanel,
  type PageAnchor,
} from "@/components/pageSidebars/kit";

export interface StandardPageSidebarsProps {
  /** slug único da página (vira prefixo das storageKeys). */
  pageId: string;
  /** título exibido nas colunas internas. */
  title: string;
  subtitle?: string;
  icon: ReactNode;
  /** âncoras de seções da página (gera a aba "Seções" à esquerda). */
  anchors?: PageAnchor[];
  /** texto de ajuda (gera a aba "Ajuda" à esquerda). */
  help?: { description: string; tips?: string[] };
  /** conteúdo extra injetado ao fim da aba Contexto. */
  contextExtras?: ReactNode;
  /** abas extras à esquerda (antes de Ajuda). */
  leftTabs?: PageTab[];
  /** abas extras à direita (depois de Insights/Atividade). */
  rightTabs?: PageTab[];
  defaultLeftTab?: string;
  defaultRightTab?: string;
}

const ICON = "h-3 w-3";

export function StandardPageSidebars(props: StandardPageSidebarsProps) {
  const leftTabs: PageTab[] = [
    {
      id: "contexto",
      label: "Contexto",
      icon: <SquareStack className={ICON} />,
      content: <ContextPanel extras={props.contextExtras} />,
    },
    ...(props.anchors?.length
      ? [{
          id: "secoes",
          label: "Âncoras",
          icon: <Compass className={ICON} />,
          content: <AnchorsPanel anchors={props.anchors} />,
        }]
      : []),
    ...(props.leftTabs ?? []),
  ];

  const rightTabs: PageTab[] = [
    ...(props.help
      ? [{
          id: "como-funciona",
          label: "Como funciona",
          icon: <HelpCircle className={ICON} />,
          content: <HelpPanel description={props.help.description} tips={props.help.tips} />,
        }]
      : []),
    { id: "insights", label: "Insights", icon: <Lightbulb className={ICON} />, content: <InsightsPanel /> },
    { id: "atividade", label: "Atividade", icon: <Activity className={ICON} />, content: <ActivityPanel /> },
    ...(props.rightTabs ?? []),
  ];

  return (
    <>
      <PageTabsSidebar
        id={`${props.pageId}-ctx`}
        side="left"
        title={props.title}
        subtitle={props.subtitle}
        icon={props.icon}
        storageKey={`aso:pgsb:${props.pageId}:left`}
        defaultWidth={260}
        tabs={leftTabs}
        defaultTab={props.defaultLeftTab}
      />
      <PageTabsSidebar
        id={`${props.pageId}-intel`}
        side="right"
        title={props.title}
        subtitle="Insights &amp; atividade"
        icon={props.icon}
        storageKey={`aso:pgsb:${props.pageId}:right`}
        defaultWidth={320}
        tabs={rightTabs}
        defaultTab={props.defaultRightTab}
      />
    </>
  );
}
