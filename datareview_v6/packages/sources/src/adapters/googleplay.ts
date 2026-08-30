/**
 * Google Play (ponte v1 → SourcePort), sem dep externa.
 * Scraping HTML público (funciona de datacenter, sondado ao vivo):
 *   - search (padrão): /store/search?c=apps → ids de apps → detalhes (og meta)
 *   - app:        /store/apps/details?id=X → detalhes do app (query = appId)
 *   - reviews:    os reviews hoje são carregados via RPC (batchexecute), não
 *     vêm embutidos na página — erro HONESTO orientando o painel v1/google-play.
 * engine = action. country = gl (padrão br). Convenção: nunca lança.
 */
import type { CollectOptions, NormalizedItem } from "@v6/contracts";
import type { SourcePort } from "@v6/domain";
import { cap, defineAdapter, item, num, str } from "./base.js";
import { fetchText } from "./http.js";

interface PlayApp {
  appId: string;
  title: string;
  description: string;
  summary: string;
  icon?: string;
  developer?: string;
  score?: number;
  ratings?: number;
  genre?: string;
  url: string;
}

/** Extrato "AF_initDataCallback"-less: apenas meta/JSON embutido acessível. */
function pick(html: string, re: RegExp): string {
  return (html.match(re)?.[1] ?? "").trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function metaContent(html: string, property: string): string {
  const tag = html.match(new RegExp(`<meta[^>]+property=["']${property}["'][^>]*>`, "i"))?.[0] ?? "";
  const content = tag.match(/content=["']([^"']+)["']/i)?.[1] ?? "";
  return decodeEntities(content.trim());
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function parseDetails(html: string, appId: string, url: string): PlayApp {
  const title = metaContent(html, "og:title") || pick(html, /<title>([^<]+)<\/title>/).replace(/ - Apps on Google Play.*/, "").replace(/ - Apps no Google Play.*/, "");
  const description = metaContent(html, "description");
  const icon = metaContent(html, "og:image");
  if (!title) throw new Error(`não foi possível extrair dados do app ${appId}`);
  const ratingJson = pick(html, /"rating":([0-9.]+)/);
  return {
    appId,
    title,
    description,
    summary: description,
    icon: icon || undefined,
    developer:
      pick(html, /"devSummary":\s*\{[^}]*?"title":\s*"([^"]+)"/) ||
      stripTags(pick(html, /<a[^>]+href="[^"]*\/store\/apps\/dev[^"]*"[^>]*>(.*?)<\/a>/i)) ||
      undefined,
    score: ratingJson ? num(ratingJson) : undefined,
    ratings: num(pick(html, /"reviews":\s*(\d+)/)) ?? undefined,
    genre: pick(html, /"genre":\s*"([^"]+)"/) || undefined,
    url,
  };
}

async function playDetails(appId: string, gl: string, hl: string): Promise<PlayApp> {
  const url = `https://play.google.com/store/apps/details?id=${encodeURIComponent(appId)}&hl=${encodeURIComponent(hl)}&gl=${encodeURIComponent(gl)}`;
  const html = await fetchText(url, { timeoutMs: 15000, headers: { "Accept-Language": hl } }).catch(() =>
    fetchText(url, { timeoutMs: 15000 }),
  );
  return parseDetails(html, appId, url);
}

export const googleplay = defineAdapter(
  {
    id: "googleplay",
    label: "Google Play (reviews/apps)",
    kind: "app",
    description: "Apps do Google Play via HTML público (engine = search|app; reviews exigem RPC — não nativo).",
    capabilities: ["reviews", "media"],
    rateLimit: { rps: 1, burst: 2 },
  },
  {
    async fetch(options: CollectOptions) {
      const action = options.engine || "search";
      const gl = /^[a-z]{2}$/i.test(options.country ?? "") ? (options.country as string).toLowerCase() : "br";
      const hl = "pt-BR";
      const limit = cap(options.limit ?? 10, 25);
      const q = options.query.trim();
      if (!q) throw new Error("query vazia");

      if (action === "app") {
        const app = await playDetails(q, gl, hl);
        return { action, apps: [app] };
      }

      if (action === "reviews") {
        throw new Error(
          "reviews do Google Play mudaram para RPC (batchexecute) em 2025 e não vêm mais no HTML — " +
            "use o painel v1/google-play (google-play-scraper) ou uma API BYOK; o adapter nativo suporta search|app.",
        );
      }

      const html = await fetchText(
        `https://play.google.com/store/search?q=${encodeURIComponent(q)}&c=apps&hl=${encodeURIComponent(hl)}&gl=${encodeURIComponent(gl)}`,
        { timeoutMs: 15000, headers: { "Accept-Language": hl } },
      );
      const ids: string[] = [];
      const seen = new Set<string>();
      const re = /\/store\/apps\/details\?id=([a-zA-Z][a-zA-Z0-9._]+)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(html)) !== null && ids.length < limit) {
        const id = m[1] as string;
        if (!seen.has(id)) {
          seen.add(id);
          ids.push(id);
        }
      }
      if (ids.length === 0) throw new Error(`nenhum app encontrado para "${q}"`);
      const apps: PlayApp[] = [];
      for (const id of ids) {
        try {
          apps.push(await playDetails(id, gl, hl));
        } catch {
          /* Google soft-challenge em rajadas paralelas — item falho não derruba o resto */
        }
        await new Promise((r) => setTimeout(r, 1200));
      }
      if (apps.length === 0) throw new Error("detalhes dos apps não retornaram (Google bloqueou?)");
      return { action: "search", query: q, apps };
    },
    map(data: unknown, options: CollectOptions): NormalizedItem[] {
      const r = (data ?? {}) as Record<string, unknown>;
      const apps = (Array.isArray(r.apps) ? r.apps : []) as PlayApp[];
      return apps.slice(0, cap(options.limit ?? 10, 25)).map((a) =>
        item(
          {
            id: `googleplay:${str(a.appId)}`,
            title: str(a.title),
            text: stripTags(str(a.summary)) || undefined,
            url: str(a.url) || undefined,
            author: str(a.developer) || undefined,
            score: num(a.score) ?? undefined,
            meta: {
              appId: str(a.appId),
              icon: str(a.icon) || undefined,
              ratings: num(a.ratings) ?? undefined,
              genre: str(a.genre) || undefined,
            },
          },
          "googleplay",
          "app",
        ),
      );
    },
  },
);

export const googleplaySources: Record<string, () => SourcePort> = {
  googleplay: () => googleplay,
  google: () => googleplay,
};