/**
 * Chaves de API do sistema — lidas SOMENTE do ambiente (backend-only).
 *
 * O legado v1 tinha BYOK (traga-sua-chave) no browser; no v4 o padrão é:
 *   - produtores que funcionam sem chave → nenhum env necessário;
 *   - SerpAPI/Brave/Google CSE/GitHub/Reddit/YouTube → via env no servidor.
 * Chaves NUNCA são persistidas nem serializadas (os descritores do catálogo
 * expõem apenas os NOMES das variáveis, não valores).
 */

export type ApiKeys = Readonly<Record<string, string | undefined>>;

/** Nomes canônicos de variáveis de ambiente. Fonte de verdade p/ .env.example. */
export const ENV_KEY_NAMES = [
  "SERPAPI_KEY",
  "BRAVE_API_KEY",
  "GOOGLE_API_KEY",
  "GOOGLE_CX",
  "REDDIT_CLIENT_ID",
  "REDDIT_CLIENT_SECRET",
  "GITHUB_TOKEN",
  "PRODUCT_HUNT_TOKEN",
  "YOUTUBE_API_KEY",
] as const;

export function keysFromEnv(env: NodeJS.ProcessEnv = process.env): ApiKeys {
  return Object.fromEntries(ENV_KEY_NAMES.map((n) => [n, env[n]])) as ApiKeys;
}

export function getKey(keys: ApiKeys, name: string): string | undefined {
  return keys[name];
}

/** true quando TODOS os nomes têm valor (ex.: reddit OAuth exige id+secret). */
export function hasKeys(keys: ApiKeys, ...names: string[]): boolean {
  return names.every((n) => Boolean(keys[n]));
}