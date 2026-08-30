/**
 * routeCache — cache em memória de respostas de rotas de coleta, inspirado no
 * load_cache/save_cache do docs/_uni.py: o mesmo (fonte, params) dentro do
 * TTL retorna a resposta cacheada em vez de re-bater APIs com rate-limit
 * agressivo (Trends 429, GDELT 1 req/5s). Hit NÃO abre run nova nem grava
 * raw artifact (nada novo foi coletado) — a resposta vem com `cached: true`.
 *
 * Em memória por processo (sem disco): simples, rápido e seguro — expira com
 * o TTL ou com o restart do servidor.
 */

interface CacheEntry {
  payload: unknown;
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();

/** Teto de entradas — LRU simples: remove as mais antigas ao estourar. */
const MAX_ENTRIES = 200;

/** Stringify estável: ordena chaves de objetos e elementos de arrays. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${[...value].map(stableStringify).sort().join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** Chave estável por rota + params (ordem das chaves/arrays normalizada). */
export function cacheKey(route: string, params: Record<string, unknown>): string {
  return `${route}:${stableStringify(params)}`;
}

/** Lê uma entrada válida (ou undefined se ausente/expirada). */
export function getCached(route: string, params: Record<string, unknown>): unknown | undefined {
  const key = cacheKey(route, params);
  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    return undefined;
  }
  return entry.payload;
}

/** Grava uma entrada com TTL (ms). */
export function setCached(route: string, params: Record<string, unknown>, payload: unknown, ttlMs: number): void {
  if (store.size >= MAX_ENTRIES) {
    // Evict expiradas primeiro; se não bastar, remove as mais antigas.
    const now = Date.now();
    for (const [k, v] of store) {
      if (v.expiresAt <= now) store.delete(k);
    }
    while (store.size >= MAX_ENTRIES) {
      const oldest = store.keys().next().value;
      if (oldest === undefined) break;
      store.delete(oldest);
    }
  }
  store.set(cacheKey(route, params), { payload, expiresAt: Date.now() + ttlMs });
}

/** Estatísticas do cache (diagnóstico/testes). */
export function cacheStats(): { size: number } {
  return { size: store.size };
}

/** Limpa o cache (testes). */
export function clearRouteCache(): void {
  store.clear();
}
