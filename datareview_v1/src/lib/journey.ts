/**
 * Jornada (`/jornada`) — pipeline único de ponta a ponta que junta todas as
 * capacidades do sistema num fluxo guiado: Descobrir → Coletar → Analisar →
 * Visualizar → Decidir → Apresentar.
 *
 * O estado da jornada (etapa atual + etapas concluídas) persiste em
 * localStorage para retomada entre sessões. Lib pura de lógica (testável) —
 * os componentes das etapas vivem em src/components/journey/.
 */

export type JourneyStepId =
  | "descobrir" | "coletar" | "analisar" | "visualizar" | "decidir" | "apresentar";

export interface JourneyStep {
  id: JourneyStepId;
  label: string;
  /** O que o usuário faz nesta etapa (exibido no stepper). */
  desc: string;
  /** Para onde aprofundar depois (página especializada). */
  deepLink: string;
  deepLinkLabel: string;
}

export const JOURNEY_STEPS: JourneyStep[] = [
  {
    id: "descobrir",
    label: "Descobrir",
    desc: "Busque apps na Apple App Store e Google Play e escolha o que analisar.",
    deepLink: "/search",
    deepLinkLabel: "Busca avançada",
  },
  {
    id: "coletar",
    label: "Coletar",
    desc: "Reviews são baixados para o dataset local — colete uma vez, reutilize em todo o sistema.",
    deepLink: "/dados",
    deepLinkLabel: "Dados brutos",
  },
  {
    id: "analisar",
    label: "Analisar",
    desc: "A IA transforma os reviews em achados: problemas, pedidos, oportunidades e evidências.",
    deepLink: "/experiments",
    deepLinkLabel: "Experimentos",
  },
  {
    id: "visualizar",
    label: "Visualizar",
    desc: "Gráficos determinísticos (sem IA): distribuição de notas, sentimento, timeline e lojas.",
    deepLink: "/dashboard",
    deepLinkLabel: "Dashboard completo",
  },
  {
    id: "decidir",
    label: "Decidir",
    desc: "Consolide os achados em decisões priorizadas com evidência.",
    deepLink: "/decision-center",
    deepLinkLabel: "Decision Center",
  },
  {
    id: "apresentar",
    label: "Apresentar",
    desc: "Gere uma apresentação profissional dos resultados e exporte para compartilhar.",
    deepLink: "/apresentacoes",
    deepLinkLabel: "Editor de apresentações",
  },
];

export interface JourneyState {
  currentStep: JourneyStepId;
  completed: JourneyStepId[];
  updatedAt: number;
}

const KEY = "aso:journey:v1";

const DEFAULT_STATE: JourneyState = {
  currentStep: "descobrir",
  completed: [],
  updatedAt: 0,
};

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() { listeners.forEach((l) => l()); }

export function subscribeJourney(l: Listener) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function loadJourney(): JourneyState {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!raw || typeof raw !== "object") return { ...DEFAULT_STATE };
    // Sanitiza cada campo independentemente: currentStep inválido cai no
    // início, mas as conclusões válidas são preservadas.
    return {
      currentStep: JOURNEY_STEPS.some((s) => s.id === raw.currentStep)
        ? raw.currentStep
        : DEFAULT_STATE.currentStep,
      completed: Array.isArray(raw.completed)
        ? raw.completed.filter((c: string) => JOURNEY_STEPS.some((s) => s.id === c))
        : [],
      updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : 0,
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function saveJourney(state: JourneyState) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...state, updatedAt: Date.now() }));
  } catch { /* ignore */ }
  notify();
}

export function resetJourney() {
  saveJourney({ ...DEFAULT_STATE });
}

// ─── Navegação (pura) ────────────────────────────────────────────────────────

export function stepIndex(id: JourneyStepId): number {
  return JOURNEY_STEPS.findIndex((s) => s.id === id);
}

export function nextStep(id: JourneyStepId): JourneyStepId | null {
  const i = stepIndex(id);
  return i >= 0 && i < JOURNEY_STEPS.length - 1 ? JOURNEY_STEPS[i + 1].id : null;
}

export function prevStep(id: JourneyStepId): JourneyStepId | null {
  const i = stepIndex(id);
  return i > 0 ? JOURNEY_STEPS[i - 1].id : null;
}

/** Avança para `to`, marcando a etapa atual como concluída. */
export function advanceTo(state: JourneyState, to: JourneyStepId): JourneyState {
  const completed = state.completed.includes(state.currentStep)
    ? state.completed
    : [...state.completed, state.currentStep];
  return { ...state, currentStep: to, completed, updatedAt: Date.now() };
}

/** Vai direto para uma etapa (sem marcar conclusão). */
export function goTo(state: JourneyState, to: JourneyStepId): JourneyState {
  return { ...state, currentStep: to, updatedAt: Date.now() };
}

/** % de conclusão (0–100) para barras de progresso. */
export function journeyProgress(state: JourneyState): number {
  return Math.round((state.completed.length / JOURNEY_STEPS.length) * 100);
}

/**
 * Status de uma etapa para o stepper: concluída / atual / futura.
 * "desbloqueada" é sempre true — o usuário pode pular etapas livremente
 * (fluxo guiado, não travado).
 */
export function stepStatus(state: JourneyState, id: JourneyStepId): "done" | "current" | "todo" {
  if (state.currentStep === id) return "current";
  if (state.completed.includes(id)) return "done";
  return "todo";
}
