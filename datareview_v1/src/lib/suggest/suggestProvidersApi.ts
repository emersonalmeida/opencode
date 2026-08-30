/**
 * Cliente da rota POST /functions/v1/uni-suggest-provider.
 *
 * Cada provedor de autocomplete retorna itens normalizados (text, relevance)
 * com proveniencia da fonte. A UI da página /suggest pode expandir o termo
 * por sonda (mesma estratégia dos grupos do Google) enviando as sondas como
 * query ao provedor.
 */
import { apiUrl } from "@/lib/apiBase";
import { SUGGEST_PROVIDERS, type SuggestProvider, type SuggestProviderItem } from "../../../server/lib/suggestProviders";

const SUPA_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

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
    const resp = await fetch(apiUrl("/functions/v1/uni-suggest-provider"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPA_KEY}` },
      body: JSON.stringify({
        provider,
        query,
        limit: opts?.limit ?? 10,
        lang: opts?.lang,
      }),
      signal: opts?.signal,
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) return { ok: false, provider, query, items: [], error: (data.error as string) || `Erro ${resp.status}` };
    return {
      ok: true,
      provider: (data.provider as string) ?? provider,
      query: (data.query as string) ?? query,
      items: (data.items as SuggestProviderItem[] | undefined) ?? [],
    };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return { ok: false, provider, query, items: [], error: "cancelado" };
    }
    return { ok: false, provider, query, items: [], error: e instanceof Error ? e.message : "Falha de conexão" };
  }
}

/**
 * Catalogo completo de provedores para a UI (seletor da pagina /suggest).
 */
export function listSuggestProviders(): SuggestProvider[] {
  return SUGGEST_PROVIDERS;
;
}