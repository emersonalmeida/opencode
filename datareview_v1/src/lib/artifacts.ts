/**
 * Store local de artefatos — entregáveis de pesquisa/descoberta gerados pela
 * IA (personas, jornadas, benchmarks, oportunidades, problemas, pedidos,
 * custom). Persistido no localStorage para o usuário revisitar quando quiser.
 */

export type ArtifactKind =
  | "persona"
  | "journey"
  | "benchmark"
  | "opportunities"
  | "problems"
  | "requests"
  | "swot"
  | "custom";

export interface Artifact {
  id: string;
  kind: ArtifactKind;
  title: string;
  scope: string; // e.g. "app:apple:12345" / "compare:..." / "home"
  scopeLabel: string;
  content: string; // markdown
  createdAt: number;
}

const KEY = "aso:artifacts";
type Listener = () => void;
const listeners = new Set<Listener>();

function read(): Artifact[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function write(list: Artifact[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ }
  listeners.forEach(l => l());
}

export function listArtifacts(): Artifact[] {
  return read().sort((a, b) => b.createdAt - a.createdAt);
}
export function saveArtifact(a: Omit<Artifact, "id" | "createdAt">): Artifact {
  const entry: Artifact = { ...a, id: crypto.randomUUID(), createdAt: Date.now() };
  const list = read();
  list.unshift(entry);
  write(list.slice(0, 200));
  return entry;
}
export function removeArtifact(id: string) {
  write(read().filter(a => a.id !== id));
}
export function clearArtifacts() { write([]); }
export function subscribeArtifacts(l: Listener) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export const KIND_META: Record<ArtifactKind, { label: string; icon: string; prompt: string }> = {
  persona: {
    label: "Personas",
    icon: "👤",
    prompt: "Gere 3 personas realistas baseadas nos reviews e dados coletados. Para cada persona: nome, arquétipo, contexto, objetivos, dores, jobs-to-be-done, canais e citações reais de reviews que sustentam a persona. Formato markdown com cabeçalhos.",
  },
  journey: {
    label: "Jornada do usuário",
    icon: "🗺️",
    prompt: "Mapeie a jornada de usuário completa (descoberta → onboarding → uso recorrente → suporte → churn), listando ações, pensamentos, sentimentos, pontos de dor e oportunidades em cada etapa. Baseie-se em citações reais dos reviews. Use tabelas markdown.",
  },
  benchmark: {
    label: "Benchmark competitivo",
    icon: "📊",
    prompt: "Faça um benchmark competitivo estruturado com tabela comparativa de funcionalidades, notas, sentimento, pontos fortes/fracos, diferenciais e posicionamento. Se houver mais de um app, compare-os; se houver apenas um, aponte gaps observados e concorrentes citados nos reviews.",
  },
  opportunities: {
    label: "Oportunidades de produto",
    icon: "💡",
    prompt: "Liste as 10 principais oportunidades de produto priorizadas por impacto x esforço, cada uma com: contexto, evidência (citações reais), hipótese de valor, métrica de sucesso sugerida.",
  },
  problems: {
    label: "Mapa de problemas",
    icon: "🐞",
    prompt: "Agrupe os problemas relatados por categoria (bugs, UX, performance, cobrança, suporte, funcionalidade faltante), com frequência estimada, severidade, versões afetadas e trechos reais dos reviews.",
  },
  requests: {
    label: "Pedidos dos usuários",
    icon: "📣",
    prompt: "Extraia e agrupe os pedidos/sugestões de funcionalidades mencionados nos reviews, com frequência, contexto e citações. Ordene por recorrência.",
  },
  swot: {
    label: "SWOT",
    icon: "🎯",
    prompt: "Monte uma matriz SWOT (Forças, Fraquezas, Oportunidades, Ameaças) baseada estritamente nos dados coletados, com bullets curtos e cada item ancorado em evidência.",
  },
  custom: {
    label: "Personalizado",
    icon: "✨",
    prompt: "",
  },
};
