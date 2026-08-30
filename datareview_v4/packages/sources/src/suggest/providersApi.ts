import type { SuggestProvider, SuggestProviderItem } from "./providers.js";
import { SUGGEST_PROVIDERS } from "./providers.js";

const SUGGEST_URL = (): string =>
  ((globalThis as { VITE_SUGGEST_URL?: string }).VITE_SUGGEST_URL) ?? "http://localhost:8787";

export interface SuggestProviderResult {
  ok: boolean;
  provider: string;
  query: string;
  items: SuggestProviderItem[];
  error?: string;
}

export async function fetchSuggestProvider(
  provider: string,
  query: string,
  opts?: { limit?: number; lang?: string; signal?: AbortSignal },
): Promise<SuggestProviderResult> {
  try {
    const resp = await fetch(`${SUGGEST_URL()}/functions/v1/uni-suggest-provider`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, query, limit: opts?.limit ?? 10, lang: opts?.lang }),
      signal: opts?.signal,
    });
    const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
    if (!resp.ok) return { ok: false, provider, query, items: [], error: (data.error as string) || `Erro ${resp.status}` };
    return {
      ok: true,
      provider: (data.provider as string) ?? provider,
      query: (data.query as string) ?? query,
      items: (data.items as SuggestProviderItem[] | undefined) ?? [],
    };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return { ok: false, provider, query, items: [], error: "cancelado" };
    return { ok: false, provider, query, items: [], error: e instanceof Error ? e.message : "Falha de conexao" };
  }
}

export function listSuggestProviders(): SuggestProvider[] {
  return SUGGEST_PROVIDERS;
}
