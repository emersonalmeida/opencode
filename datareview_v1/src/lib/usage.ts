/**
 * Telemetria LOCAL de uso do sistema (Onda 1.3 — "Uso do sistema").
 *
 * Zero rede: tudo deriva dos stores locais (os/memory, sessionStore,
 * activityStore, datasetStore). É a base de dados para TODA decisão de
 * consolidação de superfícies (one-in-one-out, flags órfãs) — nunca intuição.
 *
 * Convenção: page views usam trackOSEvent("view", "page:<path>") para não se
 * misturar com as views internas do Nexus OS ("overview", "analises"...).
 */
import { trackOSEvent, type OSEvent } from "@/lib/os/memory";
import type { GenerationRecord } from "@/lib/sessionStore";
import type { ActivityEvent } from "@/lib/activityStore";
import { PAGES } from "@/lib/pages";

export const PAGE_VIEW_PREFIX = "page:";

/** Normaliza /app/apple/123 → /app/:store/:id (contagem por página). */
export function normalizePath(path: string): string {
  if (/^\/app\/[^/]+\//.test(path)) return "/app/:store/:id";
  if (/^\/lab\/experiments\/.+/.test(path)) return "/lab/experiments/:id";
  if (/^\/p\/.+/.test(path)) return "/p/:id";
  return path || "/";
}

/** Registra a abertura de uma página (chamado UMA vez no AppShell por rota). */
export function trackPageView(path: string): void {
  trackOSEvent("view", `${PAGE_VIEW_PREFIX}${normalizePath(path)}`);
}

/** Rótulo legível de um path (registry PAGES; fallback = o próprio path). */
export function pageLabel(path: string): string {
  const hit = PAGES.find((p) => p.path === path);
  return hit?.label ?? path;
}

/** Frequência de page views: [[path, n]] ordenado desc. */
export function pageViewFrequency(events: OSEvent[]): Array<[string, number]> {
  const freq = new Map<string, number>();
  for (const e of events) {
    if (e.kind === "view" && e.id.startsWith(PAGE_VIEW_PREFIX)) {
      const path = e.id.slice(PAGE_VIEW_PREFIX.length);
      freq.set(path, (freq.get(path) ?? 0) + 1);
    }
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]);
}

/** Frequência genérica por kind (ex.: "collect", "export", "agent"). */
export function kindFrequency(events: OSEvent[], kind: OSEvent["kind"]): Array<[string, number]> {
  const freq = new Map<string, number>();
  for (const e of events) {
    if (e.kind === kind) freq.set(e.id, (freq.get(e.id) ?? 0) + 1);
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]);
}

/** Gerações por tipo (collect, ia, atlas, canvas…). */
export function generationTypeFrequency(gens: GenerationRecord[]): Array<[string, number]> {
  const freq = new Map<string, number>();
  for (const g of gens) freq.set(g.type, (freq.get(g.type) ?? 0) + 1);
  return [...freq.entries()].sort((a, b) => b[1] - a[1]);
}

/** Gerações por origem (qual página/superfície disparou). */
export function generationSourceFrequency(gens: GenerationRecord[]): Array<[string, number]> {
  const freq = new Map<string, number>();
  for (const g of gens) {
    const src = g.source ?? "desconhecida";
    freq.set(src, (freq.get(src) ?? 0) + 1);
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]);
}

/** Atividade por origem (coleta, canvas, pipeline, ia…). */
export function activitySourceFrequency(acts: ActivityEvent[]): Array<[string, number]> {
  const freq = new Map<string, number>();
  for (const a of acts) freq.set(a.source, (freq.get(a.source) ?? 0) + 1);
  return [...freq.entries()].sort((a, b) => b[1] - a[1]);
}

/** Páginas do registry NUNCA abertas (candidatas a revisão/flag-off). */
export function neverOpenedPages(events: OSEvent[]): string[] {
  const opened = new Set(pageViewFrequency(events).map(([p]) => p));
  return PAGES.map((p) => p.path).filter((p) => !opened.has(p));
}

export interface UsageSummary {
  totalEvents: number;
  pageViews: number;
  distinctPages: number;
  commands: number;
  analyses: number;
  agents: number;
  collects: number;
  generations: number;
  aiGenerations: number;
  activities: number;
  firstEventAt: number | null;
  lastEventAt: number | null;
}

/** KPIs agregados do uso (determinístico). */
export function usageSummary(
  events: OSEvent[],
  gens: GenerationRecord[],
  acts: ActivityEvent[],
): UsageSummary {
  const pageViews = events.filter((e) => e.kind === "view" && e.id.startsWith(PAGE_VIEW_PREFIX)).length;
  const count = (k: OSEvent["kind"]) => events.filter((e) => e.kind === k).length;
  const tss = [...events.map((e) => e.ts), ...gens.map((g) => g.createdAt), ...acts.map((a) => a.ts)];
  return {
    totalEvents: events.length + gens.length + acts.length,
    pageViews,
    distinctPages: pageViewFrequency(events).length,
    commands: count("command"),
    analyses: count("analysis"),
    agents: count("agent"),
    collects: count("collect") + gens.filter((g) => g.type === "collect").length,
    generations: gens.length,
    aiGenerations: gens.filter((g) => g.type !== "collect").length,
    activities: acts.length,
    firstEventAt: tss.length ? Math.min(...tss) : null,
    lastEventAt: tss.length ? Math.max(...tss) : null,
  };
}

/** Exporta o relatório de uso em Markdown (CopyDownloadButtons). */
export function buildUsageMarkdown(
  summary: UsageSummary,
  topPages: Array<[string, number]>,
  topCommands: Array<[string, number]>,
  byType: Array<[string, number]>,
  neverOpened: string[],
): string {
  const row = ([k, v]: [string, number]) => `| ${pageLabel(k)} | ${v} |`;
  const rowPlain = ([k, v]: [string, number]) => `| ${k} | ${v} |`;
  return [
    "# Uso do sistema",
    "",
    `- Eventos registrados: **${summary.totalEvents}**`,
    `- Page views: **${summary.pageViews}** em **${summary.distinctPages}** páginas distintas`,
    `- Comandos: **${summary.commands}** · Análises IA: **${summary.analyses}** · Agentes: **${summary.agents}**`,
    `- Coletas: **${summary.collects}** · Gerações: **${summary.generations}** (${summary.aiGenerations} de IA)`,
    "",
    "## Páginas mais abertas",
    "",
    "| Página | Aberturas |",
    "| --- | --- |",
    ...topPages.map(row),
    "",
    "## Comandos/ações mais usados",
    "",
    "| Ação | Vezes |",
    "| --- | --- |",
    ...topCommands.map(rowPlain),
    "",
    "## Gerações por tipo",
    "",
    "| Tipo | Total |",
    "| --- | --- |",
    ...byType.map(rowPlain),
    "",
    "## Páginas nunca abertas",
    "",
    neverOpened.length ? neverOpened.map((p) => `- ${pageLabel(p)} (\`${p}\`)`).join("\n") : "- (todas as páginas já foram abertas)",
    "",
  ].join("\n");
}
