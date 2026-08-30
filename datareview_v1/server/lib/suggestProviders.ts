/**
 * suggestProviders - catalogo declarativo de fontes de autocomplete/suggest.
 *
 * Cada provedor descreve um endpoint publico sem auth (validado ao vivo):
 *   - buildUrl(query, params) - monta a URL com query e params do provedor..

 *   - parse(body, limit) - normaliza a resposta bruta em SuggestProviderItem[].

 * O nucleo e PURO (sem Node/Express/fetch) para ser importavel pelo
 * frontend e testavel em vitest simulando apenas o fetch..

 * Provedores validados ao vivo em 2026-08-28:
 *   Bing        api.bing.com/osjson.aspx            -> ["q",[sugestoes]]
 *   DuckDuckGo ac.duckduckgo.com/ac                 -> ["q",[sugestoes]]
 *   Brave      search.brave.com/api/suggest           -> ["q",[sugestoes]]
 *   Yahoo      search.yahoo.com/sugg/gossip          -> {r:[{k}]}}
 *   Yandex     suggest.yandex.com/suggest-ff.cgi    -> ["q",[sugestoes]]
 *   Baidu      baidu.com/sugrec                     -> {g:[{q}]}}}
 *   Naver      ac.search.naver.com/nx/ac              -> {items:[[[termo],[sugestoes]]]]}}
 *   Amazon     completion.amazon.com                -> {suggestions:[{value}]}}
 *   eBay       autosug.ebay.com/autosug             -> JSONP prefixo fn(...)
 *   Wikipedia  wikipedia.org/w/api.php              -> ["q",[titulos],[descs],[urls]]]]
 *
 * Google verticais extras (ds=i/youtube/n) permanecem no conector uni-suggest
 * existente. Aqui so entram provedores novos (multi-motor.

 * Fontes validadas mas NAO implementadas (bloqueadas/exigem auth/desafio JS):
 *   TikTok, Pinterest, Twitch, SoundCloud, Spotify(401), Walmart/Alibaba,
 *   Apple/Google Play (404/challenge), Instagram/X (sessao logada), Tenor.
,
 */

export interface SuggestProviderItem {
  text: string;
  relevance: number;
}

export interface SuggestProvider {
  id: string;
  label: string;
  description: string;
  group: "general" | "commerce" | "international" | "entities";
  region: string;
  buildUrl(query: string, params: Record<string, string>): string;
  parse(text: string, limit: number): SuggestProviderItem[];
  note?: string;
}

export interface SuggestProviderParams {
  lang?: string;
}

function parseSimpleArray(text: string, limit: number): string[] {
  try {
    const data: unknown = JSON.parse(text);
    if (!Array.isArray(data)) return [];
    const suggestions = data[1];
    if (!Array.isArray(suggestions)) return [];
    return suggestions
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .map((s) => (s as string).trim())
      .slice(0, limit);
  } catch {
    return [];
  }
}

function toItems(suggestions: string[], limit: number): SuggestProviderItem[] {
  return suggestions.slice(0, limit).map((text, i) => ({
    text,
    relevance: Math.max(1, 1000 - i * 100),
  }));
}

function stripJsonp(text: string): string {
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace < firstBrace) return text;
  return text.slice(firstBrace, lastBrace + 1);
}

function fromField(
  text: string,
  limit: number,
  field: "value" | "q" | "k",
): string[] {
  try {
    const data: unknown = JSON.parse(text);
    const arr: string[] = [];
    if (field === "k") {
      const r = (data as { r?: Array<{ k?: unknown }> }).r ?? [];
      for (const item of r) {
        const k = (item as { k?: unknown } | undefined)?.k;
        if (typeof k === "string") arr.push(k);
      }
    } else if (field === "q") {
      const g = (data as { g?: Array<{ q?: unknown }> }).g ?? [];
      for (const item of g) {
        const q = (item as { q?: unknown } | undefined)?.q;
        if (typeof q === "string") arr.push(q);
      }
    } else {
      const s = (data as { suggestions?: Array<{ value?: unknown }> }).suggestions ?? [];
      for (const item of s) {
        const v = (item as { value?: unknown } | undefined)?.value;
        if (typeof v === "string") arr.push(v);
      }
    }
    return arr
      .filter((x) => typeof x === "string" && x.trim().length > 0)
      .map((x) => (x as string).trim())
      .slice(0, limit);
  } catch {
    return [];
  }
}

export const SUGGEST_PROVIDERS: SuggestProvider[] = [
  {
    id: "bing",
    label: "Bing",
    group: "general",
    region: "pt-BR",
    description: "Autosuggest da busca Bing (endpoint publico sem auth).",
    buildUrl(query, params) {
      void params;
      return `https://api.bing.com/osjson.aspx?query=${encodeURIComponent(query)}&mkt=pt-BR`;
    },
    parse(text, limit) {
      return toItems(parseSimpleArray(text, limit), limit);
    },
    note: "api.bing.com/osjson.aspx - JSON legado publico do Bing. Sem auth.",
  },
  {
    id: "duckduckgo",
    label: "DuckDuckGo",
    group: "general",
    region: "us-en",
    description: "Autocomplete da busca DuckDuckGo (ac.duckduckgo.com).",
    buildUrl(query, params) {
      void params;
      return `https://ac.duckduckgo.com/ac/?q=${encodeURIComponent(query)}&type=list`;
    },
    parse(text, limit) {
      return toItems(parseSimpleArray(text, limit), limit);
    },
    note: "ac.duckduckgo.com/ac - JSON publico classico ([q],[sugestoes]).",
  },
  {
    id: "brave",
    label: "Brave",
    group: "general",
    region: "us",
    description: "Autocomplete do mecanismo Brave Search (search.brave.com/api/suggest).",
    buildUrl(query, params) {
      void params;
      return `https://search.brave.com/api/suggest?q=${encodeURIComponent(query)}`;
    },
    parse(text, limit) {
      return toItems(parseSimpleArray(text, limit), limit);
    },
    note: "search.brave.com/api/suggest - JSON da interface publica.",
  },
  {
    id: "yahoo",
    label: "Yahoo",
    group: "general",
    region: "us",
    description: "Autocomplete da busca Yahoo (gossip JSON).",
    buildUrl(query, params) {
      void params;
      return `https://search.yahoo.com/sugg/gossip/gossip-us-ura/?output=sd1&command=${encodeURIComponent(query)}`;
    },
    parse(text, limit) {
      return toItems(fromField(text, limit, "k"), limit);
    },
    note: "search.yahoo.com/sugg/gossip - JSON publico do typeahead (r[].k).",
  },
  {
    id: "yandex",
    label: "Yandex",
    group: "international",
    region: "tr",
    description: "Autocomplete da busca Yandex (suggest-ff.cgi).",
    buildUrl(query, params) {
      void params;
      return `https://suggest.yandex.com/suggest-ff.cgi?v=4&part=${encodeURIComponent(query)}&geo=tr`;
    },
    parse(text, limit) {
      return toItems(parseSimpleArray(text, limit), limit);
    },
    note: "suggest-ff.cgi - JSON estilo Google ([q],[sugestoes]).",
  },
  {
    id: "baidu",
    label: "Baidu",
    group: "international",
    region: "zh",
    description: "Autocomplete do mecanismo Baidu (sugrec com Referer opcional).",
    buildUrl(query, params) {
      void params;
      return `https://www.baidu.com/sugrec?pre=1&p=3&ie=utf-8&json=1&prod=pc&wd=${encodeURIComponent(query)}`;
    },
    parse(text, limit) {
      return toItems(fromField(text, limit, "q"), limit);
    },
    note: "baidu.com/sugrec - JSON interno do campo de busca (g[].q).",
  },
  {
    id: "naver",
    label: "Naver",
    group: "international",
    region: "ko",
    description: "Autocomplete do portal Naver (ac.search.naver.com/nx/ac).",
    buildUrl(query, params) {
      void params;
      return `https://ac.search.naver.com/nx/ac?q=${encodeURIComponent(query)}&con=0&frm=nv&ans=2&r_format=json&r_enc=UTF-8&st=100`;
    },
    parse(text, limit) {
      try {
        const data: unknown = JSON.parse(text);
        const raw = (data as { items?: unknown }).items;
        const suggestions: string[] = [];
        if (Array.isArray(raw)) {
          const list = raw[0] as unknown;
          if (Array.isArray(list)) {
            for (const sub of list as unknown[]) {
              if (Array.isArray(sub)) {
                for (const s of sub as unknown[]) {
                  if (typeof s === "string" && s.trim()) suggestions.push(s.trim());
                }
              }
            }
          }
        }
        return toItems(suggestions, limit);
      } catch {
        return [];
      }
    },
    note: "ac.search.naver.com/nx/ac - JSON aninhado (items[i][1]).",
  },
  {
    id: "amazon",
    label: "Amazon",
    group: "commerce",
    region: "us",
    description: "Autocomplete da busca Amazon (completion.amazon.com).",
    buildUrl(query, params) {
      void params;
      return `https://completion.amazon.com/api/2017/suggestions?mid=ATVPDKIKX0DER&prefix=${encodeURIComponent(query)}&alias=aps`;
    },
    parse(text, limit) {
      return toItems(fromField(text, limit, "value"), limit);
    },
    note: "completion.amazon.com/api/2017/suggestions - JSON publico do autocomplete do site.",
  },
  {
    id: "ebay",
    label: "eBay",
    group: "commerce",
    region: "us",
    description: "Autocomplete da busca eBay (autosug.ebay.com/autosug, JSONP).",
    buildUrl(query, params) {
      void params;
      return `https://autosug.ebay.com/autosug?sId=0&kwd=${encodeURIComponent(query)}&siteid=0&mfs=1&sType=1`;
    },
    parse(text, limit) {
      try {
        const cleaned = stripJsonp(text);
        const data: unknown = JSON.parse(cleaned);
        const sug = (data as { res?: { sug?: unknown[] } }).res?.sug ?? [];
        const items: SuggestProviderItem[] = [];
        for (let i = 0; i < sug.length && items.length < limit; i += 1) {
          const x = sug[i];
          if (typeof x === "string" && x.trim().length > 0) {
            items.push({ text: x.trim(), relevance: Math.max(1, 1000 - i * 100) });
          }
        }
        return items;
      } catch {
        return [];
      }
    },
    note: "autosug.ebay.com/autosug - JSONP que precisa de strip do prefixo fn().",
  },
  {
    id: "wikipedia",
    label: "Wikipedia",
    group: "entities",
    region: "pt",
    description: "Opensearch do MediaWiki (artigos e entidades).",
    buildUrl(query, params) {
      const lang = params["lang"] ?? "pt";
      return `https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=10&format=json`;
    },
    parse(text, limit) {
      return toItems(parseSimpleArray(text, limit), limit);
    },
    note: "MediaWiki opensearch - JSON ([q],[titulos],[descs],[urls]), cada posicao e 1 entidade.",
  },
];

/** Registro canonico - lookup por id. */
export function getSuggestProvider(id: string | undefined): SuggestProvider | undefined {
  return SUGGEST_PROVIDERS.find((p) => p.id === id);
}

/** Agrupamento para exibicao na UI. */
export const SUGGEST_PROVIDER_GROUPS: Array<{ id: SuggestProvider["group"]; label: string }> = [
  { id: "general", label: "Busca geral" },
  { id: "commerce", label: "Comercio e marketplaces" },
  { id: "international", label: "Internacionais (ru/zh/ko)" },
  { id: "entities", label: "Lugares e entidades" },
];

/** Provedores validos (ids em ordem para a UI. */
export function listSuggestProviderIds(): string[] {
  return SUGGEST_PROVIDERS.map((p) => p.id);
}