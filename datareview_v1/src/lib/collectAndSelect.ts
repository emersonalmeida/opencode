/**
 * collectAndSelect — ao escolher um app em qualquer busca/seleção do sistema,
 * o app é COLETADO (reviews, respeitando o limite configurado) e
 * SELECIONADO globalmente (aba Apps da sidebar direita) em um único gesto.
 *
 * Resultado: apps escolhidos na busca entram imediatamente na base de dados
 * de todo o sistema (Dashboard, Experimentos, Chat, IA…) sem o usuário
 * precisar coletar e depois selecionar de novo. Para tirar um app do escopo,
 * basta desmarcá-lo na aba Apps (a coleta fica guardada no dataset).
 *
 * A seleção é escrita direto na chave do SelectionContext + evento de sync
 * (`SELECTION_SYNC_EVENT`) — funciona fora de componentes React.
 */
import type { AppInfo } from "@/lib/appStoreApi";
import { collectApp, type CollectResult } from "@/lib/collect";
import { getUserRegion } from "@/lib/region";
import type { CollectionSettings } from "@/components/CollectionSettingsProvider";
import { entryKey, selectKeysGlobally, SELECTION_SYNC_EVENT } from "@/context/SelectionContext";
import { toastPromise } from "@/lib/ux";

export { SELECTION_SYNC_EVENT };

export interface CollectAndSelectOptions {
  region?: string;
  reviewLimit?: number;
  reviewSort?: CollectionSettings["reviewSort"];
}

/** Lê as configurações de coleta direto do localStorage (fora de React). */
function readCollectionSettings(): CollectionSettings {
  const DEFAULTS: CollectionSettings = { searchLimit: 10, reviewLimit: 500, reviewSort: "mixed" };
  try {
    const raw = localStorage.getItem("collection-settings");
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

/**
 * Coleta o app (reusa o cache do dataset quando já atende o limite) e marca
 * a chave na seleção global. Nunca lança — falhas de coleta não impedem a
 * seleção quando o app já existe no dataset; retorna null se nada deu certo.
 */
export async function collectAndSelect(
  app: AppInfo,
  opts: CollectAndSelectOptions = {},
): Promise<CollectResult | null> {
  const region = opts.region ?? getUserRegion();
  const settings = readCollectionSettings();
  const limit = opts.reviewLimit ?? settings.reviewLimit;
  const sort = opts.reviewSort ?? settings.reviewSort;
  const key = entryKey(app.store, app.id);
  try {
    const result = await collectApp(app, region, limit, sort);
    selectKeysGlobally([key]);
    return result;
  } catch {
    // Falha de rede/coleta: se o app já estava no dataset, ainda seleciona —
    // a base local já serve às análises.
    try {
      const { getDatasetEntry } = await import("@/lib/datasetStore");
      if (getDatasetEntry(app.store, app.id)) {
        selectKeysGlobally([key]);
      }
    } catch {
      /* ignore */
    }
    return null;
  }
}

/**
 * Dispara a coleta+seleção em background (sem bloquear a UI). O progresso
 * aparece no indicador global de status (collectApp registra tasks) E em um
 * toast com ciclo de vida (coletando → pronto/erro) — feedback imediato e
 * visível em qualquer página.
 */
export function collectAndSelectInBackground(app: AppInfo, opts: CollectAndSelectOptions = {}): void {
  toastPromise(collectAndSelect(app, opts), {
    loading: `Coletando ${app.name}…`,
    success: (r) =>
      r
        ? r.reused
          ? `${app.name} selecionado (${r.entry.reviews.length} reviews já coletados)`
          : `${app.name} coletado e selecionado (${r.entry.reviews.length} reviews)`
        : `${app.name}: não foi possível coletar agora`,
    error: () => `Não foi possível coletar ${app.name}. Verifique sua conexão e tente novamente.`,
  }).catch(() => undefined);
}
