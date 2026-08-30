/**
 * experimentPlanner — EXPERIMENT PLANNER do Audit Engine (briefing §5).
 *
 * Transforma capacidades documentadas em experimentos concretos, classificados
 * (discovery/baseline/coverage/variation/combination/edge/stress/regression),
 * com budget para evitar explosão combinatória ("nunca desperdiçar requisições").
 *
 * Núcleo puro (sem React/DOM, sem servidor) — compilável em tsc.app e testável.
 */
import type { AuditSource } from "./auditModel";

/** Classe de experimento (briefing §5). */
export type ExperimentKind =
  | "discovery"
  | "baseline"
  | "coverage"
  | "variation"
  | "combination"
  | "edge"
  | "stress"
  | "regression";

/** Uma dimensão varrível do plano (operation × vertical × region × …). */
export interface ExperimentDimension {
  name: string;
  values: (string | number | boolean | undefined)[];
}

/** Um experimento concreto gerado pelo planner. */
export interface AuditExperiment {
  source: string;
  kind: ExperimentKind;
  /** Params concretos da chamada (mínimos para reproduzir). */
  params: Record<string, unknown>;
  /** Descrição curta, ex.: "vertical=web × region=br". */
  label: string;
}

/** Limite de experimentos por fonte/planejamento (orçamento de requisições). */
export interface ExperimentBudget {
  maxExperiments?: number;
  /** Prioriza esta ordem de kind ao cortar. */
  priority?: ExperimentKind[];
}

/**
 * Combina dimensões em experimentos, respeitando um orçamento. Cada dimensão
 * com valores enumeráveis gera uma matriz controlada; par chaveado como
 * `dim=value`. O `kind` recebido rotula a classe.
 */
export function planExperiments(
  source: string,
  kind: ExperimentKind,
  dimensions: ExperimentDimension[],
  budget: ExperimentBudget = {},
): AuditExperiment[] {
  const max = budget.maxExperiments ?? 50;
  const effective = dimensions.filter((d) => d.values.length > 0);
  // Se TODAS as dimensões estão vazias, não há o que experimentar.
  if (effective.length === 0) return [];
  const combos: Record<string, unknown>[] = cartesian(effective, max);
  return combos.slice(0, max).map((params) => ({
    source,
    kind,
    params,
    label: Object.entries(params)
      .map(([k, v]) => `${k}=${String(v)}`)
      .join(" × "),
  }));
}

/**
 * Produto cartesiano LIMITADO das dimensões — sem explosão combinatória.
 * Para quando ultrapassa `limit` (corte honesto, o planner reporta o teto).
 */
function cartesian(dimensions: ExperimentDimension[], limit: number): Record<string, unknown>[] {
  let acc: Record<string, unknown>[] = [{}];
  for (const dim of dimensions) {
    const next: Record<string, unknown>[] = [];
    for (const base of acc) {
      for (const value of dim.values) {
        if (next.length >= limit) break;
        next.push({ ...base, [dim.name]: value });
      }
    }
    if (next.length === 0) return [];
    acc = next;
  }
  return acc;
}

/** Prioridade default se o budget não especificar. */
export const DEFAULT_PRIORITY: ExperimentKind[] = [
  "discovery", "baseline", "coverage", "variation", "combination", "edge", "stress", "regression",
];

/** Ordena experimentos por prioridade de kind (estável). */
export function prioritize(experiments: AuditExperiment[], priority: ExperimentKind[] = DEFAULT_PRIORITY): AuditExperiment[] {
  const rank = new Map(priority.map((k, i) => [k, i] as const));
  return [...experiments].sort((a, b) => (rank.get(a.kind) ?? 99) - (rank.get(b.kind) ?? 99));
}

/** Extrai valores "fechados" de um param: ignora placeholders "(vazio)=…",
 * "…qualquer ISO" e opções com reticências — o planner só enumera valores
 * REAIS (opção aberta não é experimento finito). */
export function closedOptions(options?: string[]): string[] {
  if (!options) return [];
  return options.filter(
    (o) => o && !o.includes("…") && !o.startsWith("(") && !o.endsWith("…"),
  );
}

/**
 * Ponte catálogo → planner: deriva dimensões varríveis dos params de uma
 * fonte (só os com options enumeradas e status != "unavailable").
 */
export function dimensionsForSource(source: AuditSource): ExperimentDimension[] {
  return source.parameters
    .filter((p) => p.status !== "unavailable")
    .map((p) => ({ name: p.name, values: closedOptions(p.options) }))
    .filter((d) => d.values.length > 0);
}

/** Plano de VARIAÇÃO de uma fonte: combina os params enumerados com budget. */
export function planSourceVariations(
  source: AuditSource,
  budget: ExperimentBudget = {},
): AuditExperiment[] {
  return planExperiments(source.id, "variation", dimensionsForSource(source), budget);
}

/** Plano de BASELINE de uma fonte: 1 experimento com os defaults documentados. */
export function planSourceBaseline(source: AuditSource): AuditExperiment[] {
  const params = Object.fromEntries(
    source.parameters
      .filter((p) => p.default != null && p.default !== "" && p.status !== "unavailable")
      .map((p) => [p.name, p.default as string]),
  );
  return [{ source: source.id, kind: "baseline", params, label: "defaults documentados" }];
}
