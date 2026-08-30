/**
 * Base URL ÚNICA para todas as chamadas ao backend local (Express :8787).
 *
 * Resolução (nesta ordem):
 * 1. `VITE_SUPABASE_URL` definido e não-vazio → usa como está
 *    (compatibilidade com instalações antigas e modo cloud).
 * 2. Caso contrário (sem .env ou valor vazio) → "" (mesma origem do app):
 *    - Em DEV: o proxy do Vite repassa /functions e /health para :8787.
 *    - Em PREVIEW/PROD (vite preview / build): o Express serve o dist/ e
 *      responde /functions + /health na mesma porta (server/index.ts).
 *
 * Por que não http://localhost:8787 direto: o preview remoto (work-*.dev)
 * não alcança localhost:8787 da máquina do usuário — a chamada precisa ir
 * pela mesma origem e ser resolvida pelo proxy/servidor.
 */
export function apiBase(): string {
  const v = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  return v && v.trim() !== "" ? v : "";
}

/** URL completa de um endpoint do backend local. */
export function apiUrl(path: string): string {
  return `${apiBase()}${path}`;
}
