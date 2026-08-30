/**
 * Nexus OS — tipos compartilhados entre lib, componentes e página.
 */

/** Views da coluna central do OS. */
export type OSView = "overview" | "analises" | "fluxos" | "insights";

export const OS_VIEWS: Array<{ id: OSView; label: string; hint: string }> = [
  { id: "overview", label: "Visão geral", hint: "KPIs e gráficos do dataset" },
  { id: "analises", label: "Análises", hint: "12 seções de IA sob demanda" },
  { id: "fluxos", label: "Fluxos", hint: "Agentes com pipelines executáveis" },
  { id: "insights", label: "Insights", hint: "O que o OS aprendeu e recomenda" },
];

/** Uma linha do console (CLI) do OS. */
export interface ConsoleLine {
  kind: "in" | "out" | "ok" | "err" | "sys";
  text: string;
  ts: number;
}

export function line(kind: ConsoleLine["kind"], text: string): ConsoleLine {
  return { kind, text, ts: Date.now() };
}
