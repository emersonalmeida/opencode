/**
 * SuggestSource — porta do conector Google Suggest do v1 (uniSuggest.ts) como
 * SourcePort. Coleta sugestões de autocomplete do endpoint público:
 *   /complete/search?client=chrome&q=..&gl=..&hl=..&ds=..
 * client=chrome devolve JSON [query, [sugs], [], [], {"google:suggestrelevance": [...]}].
 *
 * Injetável: `fetchImpl` permite testes offline (sem rede).
 */
import type { CollectOptions, CollectResponse, NormalizedItem, RateLimit, SourceDescriptor } from "@v4/contracts";
import type { SourcePort } from "@v4/domain";

export interface SuggestSourceOptions {
  /** client=chrome devolve relevância (0–~1000); firefox devolve lista simples. */
  client?: "chrome" | "firefox";
  fetchImpl?: typeof fetch;
}

const SUGGEST_URL = "https://suggestqueries.google.com/complete/search";
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/140.0 Safari/537.36";

const VERTICAL_DS: Record<string, string> = {
  web: "",
  youtube: "yt",
  news: "n",
  shopping: "sh",
};

export function normalizeVertical(v: unknown): "web" | "youtube" | "news" | "shopping" {
  return v === "youtube" || v === "news" || v === "shopping" ? v : "web";
}

export class SuggestSource implements SourcePort {
  readonly id = "suggest";
  readonly kind = "suggestion";
  readonly label = "Google Suggest";
  readonly description = "Sugestões de autocomplete do Google (intenção de busca real).";
  readonly capabilities: SourceDescriptor["capabilities"] = ["trends", "custom"];
  readonly rateLimit: RateLimit = { rps: 2, burst: 1 };

  readonly #client: "chrome" | "firefox";
  readonly #fetchImpl: typeof fetch;

  constructor(options: SuggestSourceOptions = {}) {
    this.#client = options.client ?? "chrome";
    this.#fetchImpl = options.fetchImpl ?? globalThis.fetch;
  }

  async collect(options: CollectOptions): Promise<CollectResponse> {
    const response: CollectResponse = { source: this.id, query: options.query, items: [] };
    try {
      const vertical = normalizeVertical(options.engine);
      const region = /^[a-z]{2}$/i.test(options.country ?? "") ? (options.country as string).toLowerCase() : "br";
      const langByRegion: Record<string, string> = {
        br: "pt", pt: "pt", us: "en", gb: "en", de: "de", fr: "fr",
        es: "es", mx: "es", ar: "es", it: "it", jp: "ja",
      };
      const lang = langByRegion[region] ?? "";
      const limit = Math.max(1, Math.min(options.limit ?? 10, 50));

      const params = new URLSearchParams({ client: this.#client, q: options.query, gl: region });
      params.set("hl", lang);
      const ds = VERTICAL_DS[vertical];
      if (ds) params.set("ds", ds);

      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(new DOMException("timeout", "TimeoutError")), 8000);
      const external = options.signal;
      if (external) {
        if (external.aborted) abort.abort(external.reason);
        else external.addEventListener("abort", () => abort.abort(external.reason), { once: true });
      }

      let data: unknown;
      try {
        const resp = await this.#fetchImpl(`${SUGGEST_URL}?${params.toString()}`, {
          headers: { "User-Agent": UA, Accept: "application/json" },
          signal: abort.signal,
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
        data = (await resp.json()) as unknown;
      } finally {
        clearTimeout(timer);
      }

      const root = Array.isArray(data) ? (data as unknown[]) : [];
      const suggestions = Array.isArray(root[1]) ? (root[1] as unknown[]) : [];
      const metaRaw = Array.isArray(root[4]) ? root[4] : undefined;
      const meta = metaRaw as Record<string, unknown> | undefined;
      const relevance = Array.isArray(meta?.["google:suggestrelevance"])
        ? (meta!["google:suggestrelevance"] as unknown[])
        : suggestions.map(() => 0);

      response.items = suggestions
        .slice(0, limit)
        .map((s, i) => {
          const text = typeof s === "string" ? s : String(s);
          const score = typeof relevance[i] === "number" ? (relevance[i] as number) : 0;
          return {
            id: `${this.id}:${vertical}:${region}:${text}`,
            source: this.id,
            kind: "suggestion" as NormalizedItem["kind"],
            title: text,
            score,
            meta: { vertical, region, lang, query: options.query, client: this.#client },
          };
        });
      response.meta = { vertical, region, lang, count: response.items.length };
    } catch (error) {
      response.error = error instanceof Error ? error.message : String(error);
    }
    return response;
  }
}