/**
 * Roteiro do anfitrião da página Boas-vindas — puro e testável.
 *
 * O anfitrião CONVERSA com o usuário e o guia etapa a etapa (inspirado na
 * hospedagem proativa: o sistema se apresenta, explica as regras da casa e
 * sugere o próximo passo — nunca exige). O roteiro é determinístico e
 * adaptativo ao contexto (1ª visita/retorno, dados coletados, modo de IA) —
 * funciona 100% sem IA.
 */
import { aiHintFor, type VisitorContext } from "./welcomeModel";

/** Ação que o anfitrião oferece ao fim da conversa (quick replies reais). */
export interface HostAction {
  id: string;
  label: string;
  /** Rota para onde o anfitrião leva o usuário ao aceitar. */
  path: string;
}

/** Uma fala do anfitrião. */
export interface HostLine {
  id: string;
  text: string;
}

/** Ações iniciais para quem ainda não tem dados coletados. */
export const FIRST_STEPS_ACTIONS: HostAction[] = [
  { id: "demo", label: "Ver a demo de 90s", path: "/demo" },
  { id: "collect", label: "Coletar meu primeiro app", path: "/inicio" },
  { id: "explore", label: "Me mostre o sistema inteiro", path: "/fluxo" },
];

/** Ações para quem já tem dados coletados. */
export const RETURNING_ACTIONS: HostAction[] = [
  { id: "dashboard", label: "Abrir meu dashboard", path: "/dashboard" },
  { id: "chat", label: "Conversar com a IA sobre meus dados", path: "/chat" },
  { id: "continue", label: "Continuar o fluxo de onde parei", path: "/fluxo" },
];

/** Confirmação falada quando o usuário aceita uma ação (antes de navegar). */
export function acceptanceLine(actionId: string): string {
  switch (actionId) {
    case "demo":
      return "Ótima escolha. Em 90 segundos você vê tudo funcionando — com dados de exemplo, sem rede. Abrindo…";
    case "collect":
      return "Vamos juntos. Você busca o app, eu cuido da coleta e da organização. Te levo lá…";
    case "explore":
      return "Perfeito. O fluxo mostra o sistema de ponta a ponta, etapa por etapa. Vamos…";
    case "dashboard":
      return "Seus números primeiro. Abrindo o dashboard…";
    case "chat":
      return "Boa conversa nos espera. Abrindo o chat com o seu contexto carregado…";
    case "continue":
      return "De onde você parou, então. Abrindo o fluxo…";
    default:
      return "Entendido. Te levo até lá…";
  }
}

/**
 * Monta o roteiro da conversa de boas-vindas para o contexto atual.
 * Sempre termina com as ações sugeridas (renderizadas como quick replies).
 */
export function buildHostScript(ctx: VisitorContext): HostLine[] {
  const lines: HostLine[] = [];
  if (!ctx.returning) {
    lines.push(
      { id: "hello", text: "Prazer em te receber. Eu sou o anfitrião deste sistema — daqui em diante, eu te acompanho em cada etapa." },
      { id: "house", text: "Antes de começar, as regras da casa: tudo roda no seu navegador e os seus dados ficam com você, salvos localmente. Sem cadastro, sem nuvem obrigatória." },
      { id: "ai", text: aiHintFor(ctx.aiMode) },
      { id: "what", text: "O que este sistema faz de melhor: coleta reviews reais de apps (Apple e Google Play), organiza tudo num dataset local e transforma em análises, gráficos e decisões — com ou sem IA." },
      { id: "suggest", text: "Minha sugestão para a sua primeira vez: veja a demo de 90 segundos. Se preferir ir direto ao trabalho, eu te levo para coletar um app real." },
    );
  } else if (ctx.apps > 0) {
    lines.push(
      { id: "back", text: `Seu espaço está exatamente como você deixou: ${ctx.apps} app${ctx.apps > 1 ? "s" : ""} coletado${ctx.apps > 1 ? "s" : ""}, ${ctx.reviews.toLocaleString("pt-BR")} reviews guardados.` },
      { id: "ready", text: "Tudo continua funcionando — gráficos, análises determinísticas e as conversas com a IA. Por onde você quer continuar?" },
    );
  } else {
    lines.push(
      { id: "back", text: "Bem-vindo de volta. Seu espaço continua limpo e organizado, esperando o primeiro app." },
      { id: "ai", text: aiHintFor(ctx.aiMode) },
      { id: "suggest", text: "Quando quiser, coletamos juntos: você escolhe o app e eu cuido do resto. Ou veja a demo primeiro, se preferir." },
    );
  }
  return lines;
}

/** Ações sugeridas ao fim do roteiro, conforme o contexto. */
export function hostActionsFor(ctx: VisitorContext): HostAction[] {
  return ctx.returning && ctx.apps > 0 ? RETURNING_ACTIONS : FIRST_STEPS_ACTIONS;
}
