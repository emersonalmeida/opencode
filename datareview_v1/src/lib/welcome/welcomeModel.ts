/**
 * Núcleo puro da página Boas-vindas (`/boas-vindas`) — a porta de entrada do
 * sistema. Sem React/DOM: testável isoladamente.
 *
 * Dois conceitos:
 * 1. BootSequence — "loading fictício" em etapas que dá a sensação de entrar
 *    num sistema (e não num site qualquer). As etapas são honestas: o sistema
 *    realmente inicializa stores/lê dados locais enquanto exibe.
 * 2. Anfitrião — o sistema recebe o usuário com uma saudação ADAPTATIVA
 *    (primeira visita vs. retorno, com/sem dados coletados, modo de IA).
 */

/** Uma etapa da sequência de entrada. `minMs` é o tempo mínimo em tela. */
export interface BootStep {
  id: string;
  label: string;
  minMs: number;
}

/** Etapas da entrada — ordem importa (contam uma micro-história). */
export const BOOT_STEPS: BootStep[] = [
  { id: "init", label: "Inicializando a interface", minMs: 420 },
  { id: "space", label: "Preparando seu espaço de trabalho", minMs: 520 },
  { id: "data", label: "Lendo seus dados locais", minMs: 460 },
  { id: "host", label: "Acordando o anfitrião", minMs: 540 },
  { id: "ready", label: "Tudo pronto — bem-vindo", minMs: 340 },
];

/** Duração total mínima da sequência de entrada. */
export const BOOT_TOTAL_MS = BOOT_STEPS.reduce((s, b) => s + b.minMs, 0);

/** Progresso (0–100) ao concluir `doneSteps` etapas. */
export function bootProgress(doneSteps: number): number {
  if (BOOT_STEPS.length === 0) return 100;
  return Math.round((Math.min(doneSteps, BOOT_STEPS.length) / BOOT_STEPS.length) * 100);
}

export const WELCOME_STORAGE_KEY = "aso:welcome:v1";

/** Estado persistido da página (visitas). */
export interface WelcomeState {
  visits: number;
  firstVisitAt: number;
  lastVisitAt: number;
}

function readState(storage: Storage | undefined): WelcomeState | null {
  try {
    const raw = storage?.getItem(WELCOME_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WelcomeState>;
    if (typeof parsed.visits !== "number" || parsed.visits < 1) return null;
    return {
      visits: parsed.visits,
      firstVisitAt: typeof parsed.firstVisitAt === "number" ? parsed.firstVisitAt : 0,
      lastVisitAt: typeof parsed.lastVisitAt === "number" ? parsed.lastVisitAt : 0,
    };
  } catch {
    return null; // storage corrompido → trata como primeira visita
  }
}

function safeStorage(): Storage | undefined {
  try {
    return typeof localStorage !== "undefined" ? localStorage : undefined;
  } catch {
    return undefined;
  }
}

/** Já visitou a página de boas-vindas antes? */
export function hasVisited(storage: Storage | undefined = safeStorage()): boolean {
  return readState(storage) !== null;
}

/**
 * Registra uma visita e retorna o estado atualizado (visits incrementado).
 * A página deve chamar UMA vez por montagem.
 */
export function markVisited(storage: Storage | undefined = safeStorage(), now = Date.now()): WelcomeState {
  const prev = readState(storage);
  const next: WelcomeState = {
    visits: (prev?.visits ?? 0) + 1,
    firstVisitAt: prev?.firstVisitAt ?? now,
    lastVisitAt: now,
  };
  try {
    storage?.setItem(WELCOME_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // storage indisponível (modo privado) — a página funciona sem persistir
  }
  return next;
}

/** Contexto do visitante para a saudação adaptativa. */
export interface VisitorContext {
  returning: boolean;
  apps: number;
  reviews: number;
  /** Modo de IA atual ("auto" | "none" | "local" | "cloud"). */
  aiMode: string;
}

/** Saudação do anfitrião — adaptada ao momento do usuário. */
export function greetingFor(ctx: VisitorContext): { headline: string; subline: string } {
  if (!ctx.returning) {
    return {
      headline: "Olá. Eu sou o anfitrião deste sistema.",
      subline:
        "Fui feito para transformar reviews de apps em decisões. Vou te acompanhar em cada etapa — sem pressa, sem cadastro, tudo no seu navegador.",
    };
  }
  if (ctx.apps > 0) {
    return {
      headline: "Que bom te ver de novo.",
      subline: `Seu espaço está como você deixou: ${ctx.apps} app${ctx.apps > 1 ? "s" : ""} e ${ctx.reviews.toLocaleString("pt-BR")} reviews guardados localmente. Por onde continuamos?`,
    };
  }
  return {
    headline: "Bem-vindo de volta.",
    subline: "Seu espaço está limpo e pronto. Quando quiser, coletamos o primeiro app juntos.",
  };
}

/** Dica contextual do anfitrião sobre o estado da IA (sempre honesta). */
export function aiHintFor(aiMode: string): string {
  switch (aiMode) {
    case "none":
      return "A IA está desligada — tudo que é determinístico continua funcionando. Você liga quando quiser, nas Configurações.";
    case "local":
      return "A IA roda localmente na sua máquina (Ollama). Nada sai do seu computador.";
    case "cloud":
      return "A IA está no modo nuvem, com a sua chave. As análises usam o provedor que você escolheu.";
    default:
      return "A IA está no modo automático: o sistema escolhe o melhor modelo para o seu hardware.";
  }
}
