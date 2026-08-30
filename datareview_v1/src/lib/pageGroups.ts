/**
 * Page Groups ("workspaces") — organização do menu de páginas da sidebar
 * esquerda em grupos expansíveis/recolhíveis criados pelo usuário.
 *
 * Modelo:
 *  - O grupo builtin único **"Backup"** (`backup`) lista TODAS as páginas do
 *    registry (`PAGES`) exceto as de nível topo (`/`), dinamicamente, e não
 *    pode ser renomeado, editado nem excluído — é o caminho de volta garantido.
 *  - Grupos custom têm nome + seleção de páginas (paths do registry). Uma
 *    página pode estar em VÁRIOS grupos (grupos são "vistas", não pastas
 *    exclusivas) — assim cada grupo funciona como um workspace temático.
 *  - Páginas que saem do registry (ou têm a feature flag desligada) são
 *    podadas na LEITURA (`groupPages`), nunca corrompem o storage.
 *
 * Persistência: `aso:page-groups:v1` (grupos custom, cap 12) e o estado
 * recolhido de cada grupo fica dentro do próprio grupo (`collapsed`).
 * Padrão pub/sub com snapshot memoizado (anti-loop do useSyncExternalStore).
 */

import { useSyncExternalStore } from "react";
import { PAGES, type PageItem } from "@/lib/pages";
import { isFeatureEnabled, pagePathToFlag } from "@/lib/featureFlags";

export interface PageGroup {
  id: string;
  label: string;
  /** Paths do registry PAGES que pertencem a este grupo (vazio no builtin "all"). */
  paths: string[];
  /** Grupo recolhido no menu (expandido por padrão). */
  collapsed: boolean;
  /** Builtin (o grupo "Backup" — imutável). */
  builtin: boolean;
}


export const BACKUP_GROUP_ID = "backup";
/**
 * Páginas de NÍVEL TOPO — renderizadas fora de qualquer grupo, no topo do
 * menu. Desde 2026-08-29, a ÚNICA página de nível topo é a página
 * inicial do sistema (`/`), duplicata enxuta da Coleta. TODAS as demais
 * páginas do registry (incluindo Auditoria e Home) vivem no Backup.
 */
export const TOP_LEVEL_PATHS: string[] = ["/"];
const STORAGE_KEY = "aso:page-groups:v1";
const MAX_GROUPS = 12;
const MAX_LABEL = 28;

// Grupos temáticos sugeridos na primeira execução (menu navegável desde o
// primeiro uso, sem exigir configuração; não tocam rotas nem registry).
const SUGGESTED_GROUPS: Array<Pick<PageGroup, "id" | "label" | "paths" | "collapsed">> = [
  { id: "grp_coleta", label: "Coleta e dados", collapsed: true, paths: ["/inicio", "/00", "/dados", "/pipeline", "/pipeline-dados", "/pipeline-multifonte", "/fluxo-dados", "/outputs"] },
  { id: "grp_desc", label: "Pesquisa e descoberta", collapsed: true, paths: ["/search", "/descoberta", "/trending", "/suggest", "/one", "/all"] },
  { id: "grp_ia", label: "IA e chat", collapsed: true, paths: ["/chat", "/chat-voz", "/chat-arquivos", "/conversa", "/ia", "/decision-center", "/case-ia", "/case"] },
  { id: "grp_ferr", label: "Ferramentas", collapsed: true, paths: ["/canvas", "/git", "/design", "/layouts", "/playground", "/teste", "/lab"] },
  { id: "grp_infra", label: "Infra e sistema", collapsed: true, paths: ["/os", "/nucleo", "/terminal", "/uso", "/sessions", "/configuracoes"] },
];


const BACKUP_COLLAPSED_KEY = "aso:page-groups:backup-collapsed";
const listeners = new Set<() => void>();

let customGroups: PageGroup[] = load();
let backupCollapsed = loadCollapsed(BACKUP_COLLAPSED_KEY, false);

function load(): PageGroup[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const valid = new Set(PAGES.map((p) => p.path));
      const seeded: PageGroup[] = SUGGESTED_GROUPS
        .map((g) => ({ ...g, builtin: false, paths: g.paths.filter((p) => valid.has(p)) }))
        .filter((g) => g.paths.length > 0);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return sanitize(parsed);
  } catch {
    return [];
  }
}

function loadCollapsed(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === "1";
  } catch {
    return fallback;
  }
}

function sanitize(raw: unknown[]): PageGroup[] {
  const validPaths = new Set(PAGES.map((p) => p.path));
  const out: PageGroup[] = [];
  for (const g of raw) {
    const group = g as Partial<PageGroup>;
    if (typeof group?.id !== "string" || !group.id) continue;
    if (typeof group?.label !== "string" || !group.label.trim()) continue;
    if (group.id === BACKUP_GROUP_ID || group.builtin) continue; // builtins nunca vêm do storage
    const paths = Array.isArray(group.paths)
      ? [...new Set(group.paths.filter((p): p is string => typeof p === "string" && validPaths.has(p)))]
      : [];
    out.push({
      id: group.id,
      label: group.label.trim().slice(0, MAX_LABEL),
      paths,
      collapsed: group.collapsed === true,
      builtin: false,
    });
    if (out.length >= MAX_GROUPS) break;
  }
  return out;
}

// Snapshot memoizado — useSyncExternalStore exige referência estável entre
// renders quando nada mudou (senão loop infinito "Maximum update depth").
let cachedCustom: PageGroup[] = [];
let cachedAll: PageGroup[] = [];

function fingerprint(groups: PageGroup[]): string {
  return groups.map((g) => `${g.id}:${g.label}:${g.collapsed ? 1 : 0}:${g.paths.join(",")}`).join("|");
}

function refreshCache() {
  if (fingerprint(customGroups) !== fingerprint(cachedCustom)) {
    cachedCustom = customGroups.map((g) => ({ ...g, paths: [...g.paths] }));
  }
  const all: PageGroup[] = [backupGroup(), ...cachedCustom];
  if (fingerprint(all) !== fingerprint(cachedAll)) cachedAll = all;
}
refreshCache();

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(customGroups)); } catch { /* quota */ }
  refreshCache();
  listeners.forEach((l) => l());
}


/** Grupo builtin "Backup" — agrupa TODAS as páginas do registry exceto as
 *  de nível topo (TOP_LEVEL_PATHS). Dinâmico como o "Todas": páginas novas
 *  entram sozinhas; páginas desligadas/fora do registry são podadas na
 *  leitura. Imutável como os demais builtins. */
export function backupGroup(): PageGroup {
  return { id: BACKUP_GROUP_ID, label: "Backup", paths: [], collapsed: backupCollapsed, builtin: true };
}

/** Todos os grupos: builtin "Backup" primeiro, customs depois. */
export function listGroups(): PageGroup[] {
  return cachedAll;
}

export function usePageGroups(): PageGroup[] {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => cachedAll,
    () => cachedAll,
  );
}

export function getGroup(id: string): PageGroup | undefined {
  return listGroups().find((g) => g.id === id);
}

/**
 * Páginas de um grupo, resolvidas contra o registry + feature flags:
 * - builtin — "Backup": todas as páginas do registry EXCETO as de nível topo.
 * - Custom → paths do grupo na ordem salva.
 * Em ambos os casos, páginas com flag desligada ou fora do registry são
 * podadas na leitura.
 */
export function groupPages(group: PageGroup): PageItem[] {
  const enabled = PAGES.filter((p) => {
    const fk = pagePathToFlag(p.path);
    return !fk || isFeatureEnabled(fk);
  });
  if (group.id === BACKUP_GROUP_ID) return enabled.filter((p) => !TOP_LEVEL_PATHS.includes(p.path));
  if (group.builtin) return enabled;
  const byPath = new Map(enabled.map((p) => [p.path, p]));
  return group.paths.map((p) => byPath.get(p)).filter((p): p is PageItem => !!p);
}

/** Páginas de NÍVEL TOPO (fora de grupos), resolvidas contra flags — o
 *  menu as renderiza diretamente, acima dos grupos. */
export function topLevelPages(): PageItem[] {
  return PAGES.filter((p) => {
    if (!TOP_LEVEL_PATHS.includes(p.path)) return false;
    const fk = pagePathToFlag(p.path);
    return !fk || isFeatureEnabled(fk);
  });
}

function genId(): string {
  return `grp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/** Cria um grupo custom. Retorna null se nome vazio ou limite atingido. */
export function createGroup(label: string, paths: string[] = []): PageGroup | null {
  if (!label.trim() || customGroups.length >= MAX_GROUPS) return null;
  const validPaths = new Set(PAGES.map((p) => p.path));
  const group: PageGroup = {
    id: genId(),
    label: label.trim().slice(0, MAX_LABEL),
    paths: [...new Set(paths.filter((p) => validPaths.has(p)))],
    collapsed: false,
    builtin: false,
  };
  customGroups = [...customGroups, group];
  persist();
  return group;
}

/** Renomeia um grupo custom (builtins são imutáveis). */
export function renameGroup(id: string, label: string): boolean {
  if (id === BACKUP_GROUP_ID || !label.trim()) return false;
  const idx = customGroups.findIndex((g) => g.id === id);
  if (idx < 0) return false;
  customGroups = customGroups.map((g, i) =>
    i === idx ? { ...g, label: label.trim().slice(0, MAX_LABEL) } : g);
  persist();
  return true;
}

/** Substitui a seleção de páginas de um grupo custom (dedup + só paths válidos). */
export function setGroupPaths(id: string, paths: string[]): boolean {
  if (id === BACKUP_GROUP_ID) return false;
  const idx = customGroups.findIndex((g) => g.id === id);
  if (idx < 0) return false;
  const validPaths = new Set(PAGES.map((p) => p.path));
  const clean = [...new Set(paths.filter((p) => validPaths.has(p)))];
  customGroups = customGroups.map((g, i) => (i === idx ? { ...g, paths: clean } : g));
  persist();
  return true;
}

/** Alterna uma página dentro de um grupo custom. */
export function toggleGroupPath(id: string, path: string): boolean {
  const group = customGroups.find((g) => g.id === id);
  if (!group) return false;
  const has = group.paths.includes(path);
  return setGroupPaths(id, has ? group.paths.filter((p) => p !== path) : [...group.paths, path]);
}

/** Expande/recolhe um grupo no menu. Os builtins usam overrides leves
 *  persistidos separadamente (não vivem no array de customs). */
export function toggleGroupCollapsed(id: string): boolean {
  if (id === BACKUP_GROUP_ID) {
    backupCollapsed = !backupCollapsed;
    const next = backupCollapsed;
    const key = BACKUP_COLLAPSED_KEY;
    try { localStorage.setItem(key, next ? "1" : "0"); } catch { /* quota */ }
    refreshCache();
    listeners.forEach((l) => l());
    return true;
  }
  const idx = customGroups.findIndex((g) => g.id === id);
  if (idx < 0) return false;
  customGroups = customGroups.map((g, i) => (i === idx ? { ...g, collapsed: !g.collapsed } : g));
  persist();
  return true;
}

/** Remove um grupo custom (builtins são intocáveis). */
export function deleteGroup(id: string): boolean {
  if (id === BACKUP_GROUP_ID) return false;
  const before = customGroups.length;
  customGroups = customGroups.filter((g) => g.id !== id);
  if (customGroups.length === before) return false;
  persist();
  return true;
}

/** Reordena um grupo custom (delta: -1 sobe, +1 desce). */
export function moveGroup(id: string, delta: -1 | 1): boolean {
  const idx = customGroups.findIndex((g) => g.id === id);
  const to = idx + delta;
  if (idx < 0 || to < 0 || to >= customGroups.length) return false;
  const next = [...customGroups];
  [next[idx], next[to]] = [next[to], next[idx]];
  customGroups = next;
  persist();
  return true;
}

/** Remove todos os grupos custom (o builtin "Backup" permanece, com o
 *  recolhimento de volta ao padrão: aberto). */
export function resetGroups(): void {
  customGroups = [];
  backupCollapsed = false;
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(BACKUP_COLLAPSED_KEY);
  } catch { /* ignore */ }
  refreshCache();
  listeners.forEach((l) => l());
}

/** Estado recolhido efetivo de um grupo (atalho semântico para a UI). */
export function groupCollapsed(group: PageGroup): boolean {
  return group.collapsed;
}
