/**
 * Ativação de fontes — estado DERIVÁVEL (ADR-0004).
 *
 * O catálogo declara `enabledByDefault` (8 fontes prioritárias, sem-auth);
 * a UI aplica overrides locais de usuário em cima (`overrides[id]` vence).
 * `computeEnabledSources` é função pura — nenhum estado mutável fora do
 * usuário, nenhuma lista "ligado/desligado" duplicada por fonte.

 * Ordenação: as fontes ativas primeiro, e dentro de cada estado, por prioridade
 * sem-auth (`none` > `byok` > `oauth`). A prioridade de autenticação é a
 * MESMA função usada pela UI e pelos defaults — uma única fonte de verdade..
 */
import type { SourceCatalogEntry, SourceAuth } from "./catalog/index.js";
import { listSourceCatalog } from "./catalog/index.js";

/** Overrides de ativação do usuário (id → ligado/desligado). */
export type ActivationOverrides = Record<string, boolean>;

/** Ordem de prioridade sem-auth (menor = melhor: pública primeiro.. */
export const AUTH_PRIORITY: Record<SourceAuth, number> = {
  none: 0,
  byok: 1,
  oauth: 2,
};

/** Ordena duas fontes: ligadas primeiro, depois por prioridade sem-auth,, id. */
export function compareEnabledThenAuth(a: SourceCatalogEntry, b: SourceCatalogEntry): number {
  const aEnabled = a.enabledByDefault === true;
  const bEnabled = b.enabledByDefault === true;
  if (aEnabled !== bEnabled) return aEnabled ? -1 : 1;
  const pa = AUTH_PRIORITY[a.auth] ?? 9;
  const pb = AUTH_PRIORITY[b.auth] ?? 9;
  if (pa !== pb) return pa - pb;
  return a.id.localeCompare(b.id);
}

/** true quando a fonte não exige chave (auth none. */
export function isPublic(entry: SourceCatalogEntry): boolean {
  return entry.auth === "none";
}

/** Lista de fontes resolvida (default do catálogo + overrides de usuário). */
export function computeEnabledSources(
  catalog: SourceCatalogEntry[] = listSourceCatalog(),
  overrides: ActivationOverrides = {},
): SourceCatalogEntry[] {
  return [...catalog].sort(compareEnabledThenAuth).filter((e) => overrides[e.id] ?? e.enabledByDefault === true);
}

/** Quantidade de ativas (padrão: só os defaults do catálogo.. */
export function countEnabled(catalog: SourceCatalogEntry[] = listSourceCatalog(), overrides: ActivationOverrides = {}): number {
  return computeEnabledSources(catalog, overrides).length;
}

/** Lista dos ids ativos (para o pipeline/UI consumirem sem o entry inteiro). */
export function enabledSourceIds(
  catalog: SourceCatalogEntry[] = listSourceCatalog(),
  overrides: ActivationOverrides = {},
): string[] {
  return computeEnabledSources(catalog, overrides).map((e) => e.id);}