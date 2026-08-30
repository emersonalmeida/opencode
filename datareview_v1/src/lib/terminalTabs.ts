/**
 * Terminal vivo da sidebar direita — modelo de abas (puro, testável).
 *
 * Abas builtin: Log (stream de atividade), Monitor (status do sistema),
 * Tarefas (processos em andamento) e IA (chat terminal). O usuário pode
 * criar abas customizadas = visões filtradas do log (nome + palavra-chave),
 * persistidas em `aso:terminal-tabs:v1` (somente as custom).
 */

import { useSyncExternalStore } from "react";

export type TerminalTabKind = "log" | "monitor" | "tasks" | "ai" | "custom";

export interface TerminalTabDef {
  id: string;
  kind: TerminalTabKind;
  label: string;
  /** Filtro fixo (abas custom: filtra mensagem+origem do log). */
  filter?: string;
  builtin: boolean;
}

export const BUILTIN_TERMINAL_TABS: TerminalTabDef[] = [
  { id: "log", kind: "log", label: "Log", builtin: true },
  { id: "monitor", kind: "monitor", label: "Monitor", builtin: true },
  { id: "tasks", kind: "tasks", label: "Tarefas", builtin: true },
  { id: "ai", kind: "ai", label: "IA", builtin: true },
];

const KEY = "aso:terminal-tabs:v1";
const MAX_CUSTOM = 8;
const listeners = new Set<() => void>();

let customTabs: TerminalTabDef[] = loadCustom();

function loadCustom(): TerminalTabDef[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return sanitizeCustom(parsed);
  } catch {
    return [];
  }
}

function sanitizeCustom(raw: unknown[]): TerminalTabDef[] {
  const out: TerminalTabDef[] = [];
  for (const t of raw) {
    const tab = t as Partial<TerminalTabDef>;
    if (typeof tab?.id !== "string" || typeof tab?.label !== "string" || !tab.label.trim()) continue;
    out.push({
      id: tab.id,
      kind: "custom",
      label: tab.label.trim().slice(0, 24),
      filter: typeof tab.filter === "string" ? tab.filter.slice(0, 60) : undefined,
      builtin: false,
    });
    if (out.length >= MAX_CUSTOM) break;
  }
  return out;
}

// Snapshot memoizado (useSyncExternalStore exige referência estável).
let cachedAll: TerminalTabDef[] = [];

function refreshCache() {
  const next = [...BUILTIN_TERMINAL_TABS, ...customTabs];
  if (next.length !== cachedAll.length || next.some((t, i) => t.id !== cachedAll[i]?.id)) {
    cachedAll = next;
  }
}
refreshCache();

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(customTabs)); } catch { /* quota */ }
  refreshCache();
  listeners.forEach((l) => l());
}

/** Todas as abas: builtins primeiro, customs depois. */
export function allTerminalTabs(): TerminalTabDef[] {
  return [...BUILTIN_TERMINAL_TABS, ...customTabs];
}

export function useTerminalTabs(): TerminalTabDef[] {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => cachedAll,
    () => cachedAll,
  );
}

export function createTerminalTab(label: string, filter?: string): TerminalTabDef | null {
  if (!label.trim() || customTabs.length >= MAX_CUSTOM) return null;
  const tab: TerminalTabDef = {
    id: `custom_${Date.now().toString(36)}`,
    kind: "custom",
    label: label.trim().slice(0, 24),
    filter: filter?.trim() ? filter.trim().slice(0, 60) : undefined,
    builtin: false,
  };
  customTabs = [...customTabs, tab];
  persist();
  return tab;
}

export function deleteTerminalTab(id: string): boolean {
  const before = customTabs.length;
  customTabs = customTabs.filter((t) => t.id !== id);
  if (customTabs.length === before) return false;
  persist();
  return true;
}

/** Filtra eventos do log por texto (mensagem + origem), case-insensitive. */
export function filterLogEvents<T extends { message: string; source: string; detail?: string }>(
  events: T[],
  filter: string | undefined,
): T[] {
  const q = filter?.trim().toLowerCase();
  if (!q) return events;
  return events.filter(
    (e) =>
      e.message.toLowerCase().includes(q) ||
      e.source.toLowerCase().includes(q) ||
      (e.detail ?? "").toLowerCase().includes(q),
  );
}

/** Serializa o log em texto puro (copy/download). */
export function logToText(events: { ts: number; source: string; phase: string; message: string; detail?: string }[]): string {
  return events
    .map((e) => {
      const time = new Date(e.ts).toLocaleTimeString("pt-BR");
      return `[${time}] [${e.source}] [${e.phase}] ${e.message}${e.detail ? `\n    ${e.detail}` : ""}`;
    })
    .join("\n");
}
