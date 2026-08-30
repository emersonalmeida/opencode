/**
 * FlowEmbed — incorpora uma PÁGINA COMPLETA do sistema dentro de uma seção
 * do Fluxo (`/fluxo`), sem navegar. Cada página existe uma única vez: aqui e
 * na sua rota dedicada — o modo `embedded` apenas oculta o AppHeader.
 *
 * O carregamento é pregado (React.lazy + Suspense) e só monta quando o Panel
 * que o contém é aberto (Panel desmonta children fechados), então abrir uma
 * seção do Fluxo nunca pesa mais que navegar à página dedicada.
 */
import { Suspense, lazy, type ComponentType } from "react";
import { PageLoader } from "@/components/shared/PageLoader";

export type EmbeddedPageId =
  | "configuracoes" | "dados" | "dashboard" | "pipeline" | "atlas"
  | "agentes" | "decision-center" | "lab" | "canvas" | "design"
  | "playground" | "outputs" | "apresentacoes" | "terminal" | "nucleo"
  | "experiments" | "metodologias" | "chat";

const REGISTRY: Record<EmbeddedPageId, () => Promise<{ default: ComponentType<{ embedded?: boolean }> }>> = {
  configuracoes: () => import("@/pages/SettingsPage"),
  dados: () => import("@/pages/DataExplorer"),
  dashboard: () => import("@/pages/Dashboard"),
  pipeline: () => import("@/pages/Pipeline"),
  atlas: () => import("@/pages/AnalysisAtlas"),
  agentes: () => import("@/pages/Agentes"),
  "decision-center": () => import("@/pages/DecisionCenter"),
  lab: () => import("@/pages/Lab"),
  canvas: () => import("@/pages/Canvas"),
  design: () => import("@/pages/DesignCanvas"),
  playground: () => import("@/pages/Playground"),
  outputs: () => import("@/pages/Outputs"),
  apresentacoes: () => import("@/pages/Presentations"),
  terminal: () => import("@/pages/Terminal"),
  nucleo: () => import("@/pages/Nucleo"),
  experiments: () => import("@/pages/Experiments"),
  metodologias: () => import("@/pages/Methodologies"),
  chat: () => import("@/pages/Chat"),
};

/** Cache de componentes lazy por página (1 por id). */
const LAZY: Partial<Record<EmbeddedPageId, ComponentType<{ embedded?: boolean }>>> = {};

function lazyFor(id: EmbeddedPageId) {
  return (LAZY[id] ??= lazy(REGISTRY[id]));
}

export const EMBED_LABEL: Record<EmbeddedPageId, string> = {
  configuracoes: "Configurações",
  dados: "Dados brutos",
  dashboard: "Dashboard",
  pipeline: "Pipeline",
  atlas: "Analysis Atlas",
  agentes: "Agentes",
  "decision-center": "Decision Center",
  lab: "Lab",
  canvas: "Canvas",
  design: "Design Canvas",
  playground: "Playground",
  outputs: "Outputs",
  apresentacoes: "Apresentações",
  terminal: "Terminal",
  nucleo: "Núcleo",
  experiments: "Experimentos",
  metodologias: "Metodologias",
  chat: "Chat",
};

export function FlowEmbed({ page }: { page: EmbeddedPageId }) {
  const C = lazyFor(page);
  return (
    <Suspense fallback={<PageLoader label={`Carregando ${EMBED_LABEL[page]}…`} />}>
      <C embedded />
    </Suspense>
  );
}
