/**
 * Origem dos dados — separação explícita entre o que é DADO DO USUÁRIO
 * (coletado/digitado), o que foi GERADO POR IA, o que é DERIVADO
 * (determinístico, sem IA) e o que é SISTEMA (configurações).
 *
 * Regra do produto: por padrão o sistema entrega somente dados do usuário;
 * qualquer conteúdo produzido por IA é identificado visualmente e listado
 * separadamente (nunca misturado silenciosamente ao dado coletado).
 */

export type DataOrigin = "user" | "ai" | "derived" | "system";

export interface OriginMeta {
  label: string;
  shortLabel: string;
  description: string;
  /** classes Tailwind do badge (texto/fundo/borda). */
  badgeClass: string;
}

export const ORIGIN_META: Record<DataOrigin, OriginMeta> = {
  user: {
    label: "Dado do usuário",
    shortLabel: "Coletado",
    description: "Coletado de fontes externas ou inserido por você — fonte de verdade.",
    badgeClass: "text-emerald-700 bg-emerald-500/10 border-emerald-500/40 dark:text-emerald-300",
  },
  ai: {
    label: "Gerado por IA",
    shortLabel: "IA",
    description: "Produzido por um modelo de IA — interpretação, não fonte primária.",
    badgeClass: "text-violet-700 bg-violet-500/10 border-violet-500/40 dark:text-violet-300",
  },
  derived: {
    label: "Derivado (sem IA)",
    shortLabel: "Derivado",
    description: "Computado deterministicamente a partir dos seus dados.",
    badgeClass: "text-sky-700 bg-sky-500/10 border-sky-500/40 dark:text-sky-300",
  },
  system: {
    label: "Sistema",
    shortLabel: "Sistema",
    description: "Configurações e preferências da aplicação.",
    badgeClass: "text-muted-foreground bg-secondary/60 border-border/60",
  },
};

/**
 * Classifica uma chave de localStorage pela origem. Espelha os grupos de
 * `outputs.ts` (base→user, ia→ai, noai→derived, sistema/projetos→system/user)
 * sem importar o inventário (mantém a lib leve e testável).
 */
export function originForStorageKey(key: string): DataOrigin {
  const k = key.toLowerCase();
  if (
    k.startsWith("aso:ai-outputs:") || k.startsWith("aso:insights:") ||
    k.startsWith("aso:generations:") || k.startsWith("aso:pipeline-artifacts:") ||
    k.startsWith("aso:lab:") || k.startsWith("aso:chat-history:") ||
    k.startsWith("aso:agents:")
  ) return "ai";
  if (k.startsWith("aso:dataset:") || k.startsWith("aso:history")) return "user";
  if (k.startsWith("aso:cache:") || k.startsWith("aso:artifacts")) return "derived";
  return "system";
}

/** Classifica o tipo de uma geração (sessionStore) por origem. */
export function originForGenerationType(type: string): DataOrigin {
  return type === "collect" ? "user" : "ai";
}

/**
 * Mapeia o grupo do inventário de Outputs para a origem:
 * - base (dataset coletado) e projetos (criados pelo usuário) → "user"
 * - ia → "ai" · noai → "derived" · sistema/outros → "system"
 */
export function originForOutputGroup(groupId: string): DataOrigin {
  switch (groupId) {
    case "base":
    case "projetos":
      return "user";
    case "ia":
      return "ai";
    case "noai":
      return "derived";
    default:
      return "system";
  }
}
