/**
 * Sistema de status unificado — vocabulário único de estados para TODAS as
 * tarefas/sistemas/interfaces do app (canvas, pipeline, agentes, IA, coleta).
 *
 * Princípio: o usuário sempre sabe o que está acontecendo —
 * parado, na fila, executando, gerando, concluído, com erro, pulado ou
 * cancelado — com cor, ícone e descrição consistentes em toda a UI.
 *
 * As cores resolvem para os tokens semânticos `--status-*` (index.css +
 * tailwind `status.*`), padronizando a sinalização em todo o sistema.
 */

export type TaskStatus =
  | "idle" // parado, aguardando ação do usuário
  | "queued" // na fila, vai executar
  | "running" // executando (determinístico/rede)
  | "streaming" // gerando (IA produzindo tokens)
  | "done" // finalizado com sucesso
  | "error" // falhou
  | "skipped" // pulado (desativado/sem dados/não se aplica)
  | "cancelled"; // interrompido pelo usuário

export interface StatusMeta {
  label: string;
  /** Frase de ajuda: o que esse estado significa / o que fazer. */
  hint: string;
  /** Cor semântica (token tailwind status.*). */
  color: "running" | "success" | "error" | "warning" | "info" | "idle" | "skipped";
  /** Se o indicador deve pulsar (atividade viva). */
  pulse: boolean;
}

export const STATUS_META: Record<TaskStatus, StatusMeta> = {
  idle: {
    label: "Parado",
    hint: "Aguardando você executar.",
    color: "idle",
    pulse: false,
  },
  queued: {
    label: "Na fila",
    hint: "Vai executar assim que as dependências terminarem.",
    color: "info",
    pulse: false,
  },
  running: {
    label: "Executando",
    hint: "Processando agora (cálculo, rede ou transformação).",
    color: "running",
    pulse: true,
  },
  streaming: {
    label: "Gerando",
    hint: "A IA está produzindo o resultado agora.",
    color: "info",
    pulse: true,
  },
  done: {
    label: "Concluído",
    hint: "Terminou com sucesso — veja a saída.",
    color: "success",
    pulse: false,
  },
  error: {
    label: "Erro",
    hint: "Falhou — veja a mensagem de erro e tente novamente.",
    color: "error",
    pulse: false,
  },
  skipped: {
    label: "Pulado",
    hint: "Não executou (desativado, sem dados de entrada ou não se aplica).",
    color: "skipped",
    pulse: false,
  },
  cancelled: {
    label: "Interrompido",
    hint: "Cancelado por você — pode executar de novo quando quiser.",
    color: "warning",
    pulse: false,
  },
};

/** Classes Tailwind prontas por status (texto + bg sutil + borda). */
export function statusClasses(s: TaskStatus): {
  text: string;
  bg: string;
  border: string;
  dot: string;
} {
  const c = STATUS_META[s].color;
  return {
    text: `text-status-${c}`,
    bg: `bg-status-${c}/10`,
    border: `border-status-${c}/40`,
    dot: `bg-status-${c}`,
  };
}

/** Status "vivo" = está acontecendo agora (usado p/ indicadores globais). */
export function isActiveStatus(s: TaskStatus): boolean {
  return s === "running" || s === "streaming" || s === "queued";
}

/** Fase temporal de um evento de log: o que VAI fazer / está FAZENDO / FEZ. */
export type ActivityPhase =
  | "plan" // o que irá fazer
  | "start" // começou a fazer
  | "progress" // está fazendo (andamento)
  | "done" // fez / o que processou/transformou/gerou
  | "skip" // pulou (com motivo)
  | "error"; // falhou

export const PHASE_META: Record<
  ActivityPhase,
  { label: string; color: StatusMeta["color"] }
> = {
  plan: { label: "Vai fazer", color: "info" },
  start: { label: "Fazendo", color: "running" },
  progress: { label: "Progresso", color: "running" },
  done: { label: "Feito", color: "success" },
  skip: { label: "Pulado", color: "skipped" },
  error: { label: "Erro", color: "error" },
};
