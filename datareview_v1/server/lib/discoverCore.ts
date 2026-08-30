/**
 * Discover Core — núcleo PURO (sem Node/DOM) das fontes novas da página
 * Descoberta. Compartilhado servidor↔cliente (mesmo padrão do trendingCore).
 *
 * Cada fonte expõe: build<Fonte>Url(params) → URL e parse<Fonte>(payload) →
 * DiscoverItem[]. Todos os parsers são defensivos (campos ausentes viram
 * undefined, nunca lançam) — a resposta da API muda sem aviso.
 *
 * Fontes (todas verificadas ao vivo em 2026-08-25, sem chave de API):
 *  - wikitop:    artigos mais lidos da Wikipédia por dia/idioma
 *  - wikiviews:  série temporal de pageviews de um artigo
 *  - onthisday:  "neste dia" da Wikipédia (eventos/nascimentos/mortes)
 *  - googlenews: Google News RSS por termo/região/idioma
 *  - podcasts:   charts de podcasts da Apple por país
 *  - crypto:     moedas em alta do CoinGecko
 *  - steamtop:   jogos mais jogados (SteamSpy)
 */

// ---------------------------------------------------------------------------
// Tipos compartilhados
// ---------------------------------------------------------------------------

export interface DiscoverItem {
  id: string;
  /** Título principal (artigo, moeda, podcast, jogo…). */
  title: string;
  /** Linha secundária (autor, símbolo, desenvolvedora…). */
  subtitle?: string;
  url?: string;
  image?: string;
  /** Métrica principal da fonte (views, score, players, downloads…). */
  score?: number;
  /** Rótulo humano da métrica ("visualizações", "jogadores"…). */
  scoreLabel?: string;
  publishedAt?: string;
  /** Campos extras da fonte (rank, rankDelta, series, price…). */
  meta?: Record<string, unknown>;
}

export interface DiscoverResult {
  source: string;
  items: DiscoverItem[];
  count: number;
  /** Nota honesta quando a fonte tem limitações conhecidas. */
  note?: string;
  cached?: boolean;
}

/** Páginas que não são artigos de fato (filtradas do top da Wikipédia). */
const WIKI_SKIP = /^(Página principal|Main_Page|Special:|Especial:|Wikipedia:|Wikipédia:|-$)/i;

export function ymdUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Default do wikitop: ontem (o dia corrente ainda está incompleto). */
export function defaultTopDate(now = new Date()): string {
  return ymdUtc(new Date(now.getTime() - 86400000));
}

// ---------------------------------------------------------------------------
// wikitop — Wikimedia top pageviews
// https://wikimedia.org/api/rest_v1/metrics/pageviews/top/pt.wikipedia/all-access/2026/08/24
// ---------------------------------------------------------------------------

export function buildWikitopUrl(project = "pt.wikipedia", date?: string): string {
  const d = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : defaultTopDate();
  const [y, m, day] = d.split("-");
  return `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/${encodeURIComponent(project)}/all-access/${y}/${m}/${day}`;
}

interface WikiTopPayload {
  items?: { articles?: { article?: string; views?: number; rank?: number }[] }[];
}

export function parseWikitop(data: WikiTopPayload, limit = 100): DiscoverItem[] {
  const articles = data.items?.[0]?.articles ?? [];
  const items: DiscoverItem[] = [];
  for (const a of articles) {
    const article = String(a.article ?? "");
    if (!article || WIKI_SKIP.test(article)) continue;
    const title = article.replace(/_/g, " ");
    items.push({
      id: `wikitop:${article}`,
      title,
      url: `https://pt.wikipedia.org/wiki/${encodeURIComponent(article)}`,
      score: typeof a.views === "number" ? a.views : undefined,
      scoreLabel: "visualizações",
      meta: { rank: a.rank },
    });
    if (items.length >= limit) break;
  }
  return items;
}

// ---------------------------------------------------------------------------
// wikiviews — pageviews por artigo (série diária)
// https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/pt.wikipedia/all-access/all-agents/Brasil/daily/20260801/20260824
// ---------------------------------------------------------------------------

export function wikiviewsRange(days = 30, now = new Date()): { start: string; end: string } {
  const end = new Date(now.getTime() - 86400000);
  const start = new Date(end.getTime() - (Math.max(1, Math.min(days, 90)) - 1) * 86400000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
  return { start: fmt(start), end: fmt(end) };
}

export function buildWikiviewsUrl(article: string, project = "pt.wikipedia", days = 30): string {
  const { start, end } = wikiviewsRange(days);
  const art = encodeURIComponent(article.trim().replace(/ /g, "_"));
  return `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/${encodeURIComponent(project)}/all-access/all-agents/${art}/daily/${start}/${end}`;
}

interface WikiViewsPayload {
  items?: { timestamp?: string; views?: number }[];
}

export function parseWikiviews(article: string, data: WikiViewsPayload): DiscoverItem[] {
  const points = (data.items ?? [])
    .map((p) => {
      const ts = String(p.timestamp ?? "");
      const day = /^(\d{4})(\d{2})(\d{2})/.exec(ts);
      return day ? { date: `${day[1]}-${day[2]}-${day[3]}`, views: p.views ?? 0 } : null;
    })
    .filter((p): p is { date: string; views: number } => p !== null);
  if (!points.length) return [];
  const total = points.reduce((s, p) => s + p.views, 0);
  return [
    {
      id: `wikiviews:${article}`,
      title: article.replace(/_/g, " "),
      url: `https://pt.wikipedia.org/wiki/${encodeURIComponent(article)}`,
      score: total,
      scoreLabel: `visualizações em ${points.length} dias`,
      meta: { series: points, days: points.length, avg: Math.round(total / points.length) },
    },
  ];
}

// ---------------------------------------------------------------------------
// onthisday — "neste dia" da Wikipédia
// https://api.wikimedia.org/feed/v1/wikipedia/pt/onthisday/all/08/25
// ---------------------------------------------------------------------------

export type OnThisDayType = "all" | "selected" | "events" | "births" | "deaths" | "holidays";

export function buildOnThisDayUrl(month: number, day: number, type: OnThisDayType = "all", lang = "pt"): string {
  const t = ["all", "selected", "events", "births", "deaths", "holidays"].includes(type) ? type : "all";
  const mm = String(Math.max(1, Math.min(12, month))).padStart(2, "0");
  const dd = String(Math.max(1, Math.min(31, day))).padStart(2, "0");
  return `https://api.wikimedia.org/feed/v1/wikipedia/${encodeURIComponent(lang)}/onthisday/${t}/${mm}/${dd}`;
}

interface OnThisDayEvent {
  text?: string;
  year?: number;
  pages?: { title?: string; thumbnail?: { source?: string } }[];
}

type OnThisDayPayload = Partial<Record<Exclude<OnThisDayType, "all">, OnThisDayEvent[]>>;

const OTD_LABEL: Record<string, string> = {
  selected: "Destaque",
  events: "Evento",
  births: "Nascimento",
  deaths: "Morte",
  holidays: "Feriado",
};

export function parseOnThisDay(data: OnThisDayPayload): DiscoverItem[] {
  const items: DiscoverItem[] = [];
  for (const kind of ["selected", "events", "births", "deaths", "holidays"] as const) {
    for (const [i, ev] of (data[kind] ?? []).entries()) {
      const text = String(ev.text ?? "").trim();
      if (!text) continue;
      const page = ev.pages?.[0];
      items.push({
        id: `otd:${kind}:${ev.year ?? "x"}:${i}`,
        title: text,
        subtitle: [ev.year ? String(ev.year) : "", OTD_LABEL[kind]].filter(Boolean).join(" · "),
        url: page?.title ? `https://pt.wikipedia.org/wiki/${encodeURIComponent(page.title)}` : undefined,
        image: page?.thumbnail?.source,
        score: ev.year,
        scoreLabel: "ano",
        meta: { kind },
      });
    }
  }
  return items;
}

// ---------------------------------------------------------------------------
// googlenews — RSS de notícias por termo
// https://news.google.com/rss/search?q=openai&hl=pt-BR&gl=BR&ceid=BR:pt-419
// ---------------------------------------------------------------------------

export function buildGoogleNewsUrl(query: string, hl = "pt-BR", gl = "BR"): string {
  const ceid = `${gl}:${hl === "pt-BR" ? "pt-419" : hl.split("-")[0]}`;
  const params = new URLSearchParams({ q: query, hl, gl, ceid });
  return `https://news.google.com/rss/search?${params}`;
}

function xmlTag(xml: string, tag: string): string {
  const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(xml);
  return m ? decodeXml(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim()) : "";
}

export function decodeXml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

export function parseGoogleNewsRss(xml: string, limit = 50): DiscoverItem[] {
  const items: DiscoverItem[] = [];
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  for (const [i, block] of blocks.entries()) {
    const title = xmlTag(block, "title");
    const link = xmlTag(block, "link");
    const pubDate = xmlTag(block, "pubDate");
    const source = xmlTag(block, "source");
    if (!title) continue;
    const ts = pubDate ? Date.parse(pubDate) : NaN;
    items.push({
      id: `gnews:${i}:${link || title}`,
      title,
      subtitle: source || undefined,
      url: link || undefined,
      publishedAt: Number.isNaN(ts) ? undefined : new Date(ts).toISOString(),
      meta: { source },
    });
    if (items.length >= limit) break;
  }
  return items;
}

// ---------------------------------------------------------------------------
// podcasts — charts da Apple (RSS legado, mesmo padrão do iTunes search)
// https://itunes.apple.com/br/rss/toppodcasts/limit=25/json
// ---------------------------------------------------------------------------

export function buildPodcastsUrl(country = "br", limit = 50): string {
  const cc = /^[a-z]{2}$/i.test(country) ? country.toLowerCase() : "br";
  const n = Math.max(1, Math.min(limit, 100));
  return `https://itunes.apple.com/${cc}/rss/toppodcasts/limit=${n}/json`;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- JSON da Apple tem shape
   solto por natureza; normalizado na saída. */
export function parseApplePodcasts(data: any): DiscoverItem[] {
  // Shape legada: feed.entry[]; shape nova: feed.results[].
  const entries: any[] = data?.feed?.entry ?? data?.feed?.results ?? [];
  const items: DiscoverItem[] = [];
  for (const [i, e] of entries.entries()) {
    const title = e?.["im:name"]?.label ?? e?.name;
    if (!title) continue;
    const images: any[] = e?.["im:image"] ?? [];
    items.push({
      id: `podcast:${e?.id?.attributes?.["im:id"] ?? e?.id ?? i}`,
      title: String(title),
      subtitle: e?.["im:artist"]?.label ?? e?.artistName ?? undefined,
      url: e?.link?.attributes?.href ?? e?.url ?? undefined,
      image: images[images.length - 1]?.label ?? e?.artworkUrl100 ?? undefined,
      score: i + 1,
      scoreLabel: "posição no chart",
      meta: { genre: e?.category?.attributes?.label ?? e?.genres?.[0]?.name, rank: i + 1 },
    });
  }
  return items;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// crypto — CoinGecko trending (sem chave)
// https://api.coingecko.com/api/v3/search/trending
// ---------------------------------------------------------------------------

export const COINGECKO_TRENDING_URL = "https://api.coingecko.com/api/v3/search/trending";

interface CoinGeckoTrending {
  coins?: {
    item?: {
      id?: string;
      name?: string;
      symbol?: string;
      market_cap_rank?: number;
      thumb?: string;
      score?: number;
      data?: { price?: number | { BRL?: number }; price_change_percentage_24h?: { brl?: number; usd?: number } };
    };
  }[];
}

export function parseCoinGeckoTrending(data: CoinGeckoTrending): DiscoverItem[] {
  const items: DiscoverItem[] = [];
  for (const [i, c] of (data.coins ?? []).entries()) {
    const it = c.item;
    if (!it?.name) continue;
    const change = it.data?.price_change_percentage_24h?.usd ?? it.data?.price_change_percentage_24h?.brl;
    items.push({
      id: `crypto:${it.id ?? i}`,
      title: it.name,
      subtitle: it.symbol ? it.symbol.toUpperCase() : undefined,
      url: it.id ? `https://www.coingecko.com/en/coins/${it.id}` : undefined,
      image: it.thumb,
      score: typeof it.score === "number" ? it.score + 1 : i + 1,
      scoreLabel: "posição em alta",
      meta: { marketCapRank: it.market_cap_rank, change24h: change },
    });
  }
  return items;
}

// ---------------------------------------------------------------------------
// steamtop — SteamSpy top jogos (sem chave, rate-limit 1 req/s)
// https://steamspy.com/api.php?request=top100in2weeks
// ---------------------------------------------------------------------------

export type SteamTopRequest = "top100in2weeks" | "top100forever" | "top100owned";

export function buildSteamTopUrl(request: SteamTopRequest = "top100in2weeks"): string {
  const r = ["top100in2weeks", "top100forever", "top100owned"].includes(request) ? request : "top100in2weeks";
  return `https://steamspy.com/api.php?request=${r}`;
}

interface SteamSpyEntry {
  appid?: number;
  name?: string;
  developer?: string;
  publisher?: string;
  positive?: number;
  negative?: number;
  ccu?: number;
  price?: string;
  owners?: string;
}

export function parseSteamTop(data: Record<string, SteamSpyEntry>, limit = 100): DiscoverItem[] {
  const entries = Object.values(data ?? {});
  const items: DiscoverItem[] = [];
  for (const [i, g] of entries.entries()) {
    if (!g?.name || g.appid == null) continue;
    const pos = g.positive ?? 0;
    const neg = g.negative ?? 0;
    const pct = pos + neg > 0 ? Math.round((pos / (pos + neg)) * 100) : undefined;
    items.push({
      id: `steam:${g.appid}`,
      title: g.name,
      subtitle: g.developer || g.publisher || undefined,
      url: `https://store.steampowered.com/app/${g.appid}`,
      image: `https://cdn.cloudflare.steamstatic.com/steam/apps/${g.appid}/header.jpg`,
      score: typeof g.ccu === "number" ? g.ccu : undefined,
      scoreLabel: "jogadores agora",
      meta: { rank: i + 1, positivePct: pct, owners: g.owners, price: g.price },
    });
    if (items.length >= limit) break;
  }
  return items;
}

// ---------------------------------------------------------------------------
// clima — Open-Meteo (sem chave, múltiplas cidades numa requisição)
// https://api.open-meteo.com/v1/forecast?latitude=-15.8,-23.5&longitude=-47.9,-46.6&current=...
// ---------------------------------------------------------------------------

export interface CityInput { name: string; lat: number; lon: number }

export const DEFAULT_CITIES: CityInput[] = [
  { name: "Brasília", lat: -15.7939, lon: -47.8828 },
  { name: "São Paulo", lat: -23.5505, lon: -46.6333 },
  { name: "Rio de Janeiro", lat: -22.9068, lon: -43.1729 },
  { name: "Salvador", lat: -12.9777, lon: -38.5016 },
  { name: "Manaus", lat: -3.119, lon: -60.0217 },
  { name: "Porto Alegre", lat: -30.0346, lon: -51.2177 },
];

export function buildWeatherUrl(cities: CityInput[]): string {
  const list = cities.slice(0, 10);
  const params = new URLSearchParams({
    latitude: list.map((c) => String(c.lat)).join(","),
    longitude: list.map((c) => String(c.lon)).join(","),
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",
    timezone: "America/Sao_Paulo",
  });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}

interface OpenMeteoCurrent {
  temperature_2m?: number;
  relative_humidity_2m?: number;
  apparent_temperature?: number;
  precipitation?: number;
  weather_code?: number;
  wind_speed_10m?: number;
}

/** Códigos WMO → descrição PT-BR (subconjunto comum). */
export function weatherCodeLabel(code?: number): string {
  const map: Record<number, string> = {
    0: "Céu limpo", 1: "Predominantemente limpo", 2: "Parcialmente nublado", 3: "Nublado",
    45: "Nevoeiro", 48: "Nevoeiro com geada",
    51: "Garoa leve", 53: "Garoa", 55: "Garoa forte",
    61: "Chuva leve", 63: "Chuva", 65: "Chuva forte",
    71: "Neve leve", 73: "Neve", 75: "Neve forte",
    80: "Pancadas leves", 81: "Pancadas", 82: "Pancadas fortes",
    95: "Trovoada", 96: "Trovoada com granizo", 99: "Trovoada com granizo forte",
  };
  return code == null ? "" : (map[code] ?? `Código ${code}`);
}

export function parseOpenMeteo(cities: CityInput[], data: unknown): DiscoverItem[] {
  // Uma cidade → objeto; várias → array de objetos.
  const arr = Array.isArray(data) ? data : [data];
  const items: DiscoverItem[] = [];
  for (const [i, raw] of arr.entries()) {
    const cur = (raw as { current?: OpenMeteoCurrent })?.current;
    const city = cities[i];
    if (!cur || !city) continue;
    items.push({
      id: `clima:${city.name}`,
      title: city.name,
      subtitle: weatherCodeLabel(cur.weather_code) || undefined,
      score: cur.temperature_2m,
      scoreLabel: "°C agora",
      meta: {
        feelsLike: cur.apparent_temperature,
        humidity: cur.relative_humidity_2m,
        precipitation: cur.precipitation,
        wind: cur.wind_speed_10m,
        weatherCode: cur.weather_code,
      },
    });
  }
  return items;
}

// ---------------------------------------------------------------------------
// brasil — BrasilAPI (feriados/taxas) + Frankfurter (câmbio) + IBGE (nomes)
// ---------------------------------------------------------------------------

export function buildBrasilApiUrl(resource: string, params: Record<string, unknown>): string {
  switch (resource) {
    case "feriados": {
      const year = Number(params.year) || new Date().getUTCFullYear();
      return `https://brasilapi.com.br/api/feriados/v1/${year}`;
    }
    case "taxas":
      return "https://brasilapi.com.br/api/taxas/v1";
    default:
      return "";
  }
}

export function buildFrankfurterUrl(base = "USD", symbols = "BRL,EUR,GBP,JPY,ARS"): string {
  return `https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(base)}&symbols=${encodeURIComponent(symbols)}`;
}

export function buildIbgeNomesUrl(localidade = "BR"): string {
  return `https://servicodados.ibge.gov.br/api/v2/censos/nomes/ranking?localidade=${encodeURIComponent(localidade)}`;
}

export function parseFeriados(data: unknown): DiscoverItem[] {
  const list = Array.isArray(data) ? data : [];
  return list
    .map((f): DiscoverItem | null => {
      const h = f as { date?: string; name?: string; type?: string };
      if (!h?.name) return null;
      return {
        id: `feriado:${h.date}:${h.name}`,
        title: h.name,
        subtitle: h.date,
        publishedAt: h.date,
        meta: { type: h.type },
      };
    })
    .filter((i): i is DiscoverItem => i !== null);
}

export function parseTaxas(data: unknown): DiscoverItem[] {
  const list = Array.isArray(data) ? data : [];
  return list
    .map((t): DiscoverItem | null => {
      const tx = t as { nome?: string; valor?: number };
      if (!tx?.nome) return null;
      return {
        id: `taxa:${tx.nome}`,
        title: tx.nome,
        score: tx.valor,
        scoreLabel: "% ao ano",
      };
    })
    .filter((i): i is DiscoverItem => i !== null);
}

export function parseFrankfurter(base: string, data: unknown): DiscoverItem[] {
  const rates = (data as { rates?: Record<string, number> })?.rates ?? {};
  return Object.entries(rates).map(([cur, val]) => ({
    id: `fx:${base}:${cur}`,
    title: `${base} → ${cur}`,
    score: val,
    scoreLabel: `1 ${base}`,
    meta: { base, currency: cur },
  }));
}

export function parseIbgeNomes(data: unknown): DiscoverItem[] {
  const arr = Array.isArray(data) ? data : [];
  const res = (arr[0] as { res?: { nome?: string; rank?: number; frequencia?: number }[] })?.res ?? [];
  return res.slice(0, 50).map((n) => ({
    id: `nome:${n.rank}:${n.nome}`,
    title: String(n.nome ?? ""),
    score: n.frequencia,
    scoreLabel: "registros no censo",
    meta: { rank: n.rank },
  })).filter((i) => i.title);
}

// ---------------------------------------------------------------------------
// music — Deezer charts + busca (sem chave)
// https://api.deezer.com/chart/0/tracks · https://api.deezer.com/search?q=..
// ---------------------------------------------------------------------------

export function buildDeezerUrl(resource: string, query?: string, limit = 25): string {
  const n = Math.max(1, Math.min(limit, 100));
  if (resource === "search" && query) {
    return `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=${n}`;
  }
  const r = ["tracks", "artists", "albums"].includes(resource) ? resource : "tracks";
  return `https://api.deezer.com/chart/0/${r}?limit=${n}`;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- JSON do Deezer é solto; normalizado na saída. */
export function parseDeezer(resource: string, data: any): DiscoverItem[] {
  const list: any[] = data?.data ?? [];
  const items: DiscoverItem[] = [];
  for (const [i, t] of list.entries()) {
    if (resource === "artists") {
      if (!t?.name) continue;
      items.push({
        id: `dz-artist:${t.id ?? i}`, title: t.name,
        url: t.link, image: t.picture_medium ?? t.picture,
        score: i + 1, scoreLabel: "posição no chart",
        meta: { rank: i + 1, fans: t.nb_fan },
      });
    } else if (resource === "albums") {
      if (!t?.title) continue;
      items.push({
        id: `dz-album:${t.id ?? i}`, title: t.title,
        subtitle: t.artist?.name, url: t.link, image: t.cover_medium ?? t.cover,
        score: i + 1, scoreLabel: "posição no chart",
        meta: { rank: i + 1 },
      });
    } else {
      if (!t?.title) continue;
      items.push({
        id: `dz-track:${t.id ?? i}`, title: t.title,
        subtitle: [t.artist?.name, t.album?.title].filter(Boolean).join(" · ") || undefined,
        url: t.link, image: t.album?.cover_medium ?? t.album?.cover,
        score: t.rank ?? i + 1, scoreLabel: "rank Deezer",
        meta: { rank: i + 1, duration: t.duration, preview: t.preview, explicit: t.explicit_lyrics },
      });
    }
  }
  return items;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// books — OpenLibrary trending (sem chave)
// https://openlibrary.org/trending/daily.json
// ---------------------------------------------------------------------------

export function buildOpenLibraryTrendingUrl(period = "daily"): string {
  const p = ["daily", "weekly", "monthly", "yearly", "forever"].includes(period) ? period : "daily";
  return `https://openlibrary.org/trending/${p}.json`;
}

interface OlWork {
  key?: string;
  title?: string;
  author_name?: string[];
  cover_i?: number;
  first_publish_year?: number;
  edition_count?: number;
}

export function parseOpenLibraryTrending(data: unknown, limit = 50): DiscoverItem[] {
  const works = (data as { works?: OlWork[] })?.works ?? [];
  const items: DiscoverItem[] = [];
  for (const [i, w] of works.entries()) {
    if (!w?.title) continue;
    items.push({
      id: `ol:${w.key ?? i}`,
      title: w.title,
      subtitle: w.author_name?.slice(0, 2).join(", ") || undefined,
      url: w.key ? `https://openlibrary.org${w.key}` : undefined,
      image: w.cover_i ? `https://covers.openlibrary.org/b/id/${w.cover_i}-M.jpg` : undefined,
      score: w.edition_count,
      scoreLabel: "edições",
      meta: { rank: i + 1, year: w.first_publish_year },
    });
    if (items.length >= limit) break;
  }
  return items;
}

// ---------------------------------------------------------------------------
// packages — downloads do npm (sem chave)
// https://api.npmjs.org/downloads/point/last-week/react,vue
// ---------------------------------------------------------------------------

export type NpmPeriod = "last-day" | "last-week" | "last-month" | "last-year";

export function buildNpmDownloadsUrl(packages: string[], period: NpmPeriod = "last-week"): string {
  const p = ["last-day", "last-week", "last-month", "last-year"].includes(period) ? period : "last-week";
  const pkgs = packages.map((s) => s.trim()).filter(Boolean).slice(0, 20);
  return `https://api.npmjs.org/downloads/point/${p}/${pkgs.map(encodeURIComponent).join(",")}`;
}

interface NpmDlEntry { downloads?: number; package?: string; start?: string; end?: string }

export function parseNpmDownloads(data: unknown): DiscoverItem[] {
  // Pacote único → objeto com `package`; vários → mapa por nome.
  const obj = (data ?? {}) as Record<string, unknown>;
  const single = typeof obj.package === "string" ? (obj as unknown as NpmDlEntry) : null;
  const entries: [string, NpmDlEntry][] = single
    ? [[String(single.package), single]]
    : Object.entries(obj as Record<string, NpmDlEntry>);
  return entries
    .map(([name, d]): DiscoverItem | null => {
      if (!d || typeof d.downloads !== "number") return null;
      return {
        id: `npm-dl:${name}`,
        title: name,
        url: `https://www.npmjs.com/package/${name}`,
        score: d.downloads,
        scoreLabel: "downloads no período",
        meta: { start: d.start, end: d.end },
      };
    })
    .filter((i): i is DiscoverItem => i !== null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

// ---------------------------------------------------------------------------
// github-trending — scrape da página pública (sem chave)
// https://github.com/trending?since=daily&language=typescript
// ---------------------------------------------------------------------------

export function buildGithubTrendingUrl(language = "", since = "daily"): string {
  const s = ["daily", "weekly", "monthly"].includes(since) ? since : "daily";
  const params = new URLSearchParams({ since: s });
  const lang = language.trim().toLowerCase();
  return `https://github.com/trending${lang ? `/${encodeURIComponent(lang)}` : ""}?${params}`;
}

export function parseGithubTrending(html: string, limit = 25): DiscoverItem[] {
  const items: DiscoverItem[] = [];
  const blocks = html.match(/<article[^>]*class="[^"]*Box-row[^"]*"[\s\S]*?<\/article>/gi) ?? [];
  for (const [i, block] of blocks.entries()) {
    const href = /<h2[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"/i.exec(block)?.[1];
    if (!href) continue;
    const fullName = href.replace(/^\//, "").trim();
    const desc = /<p[^>]*class="[^"]*col-9[^"]*"[^>]*>([\s\S]*?)<\/p>/i.exec(block)?.[1]?.trim();
    const lang = /itemprop="programmingLanguage"[^>]*>([^<]+)</i.exec(block)?.[1]?.trim();
    const num = (re: RegExp) => {
      const m = re.exec(block)?.[1]?.replace(/,/g, "");
      return m ? Number(m) : undefined;
    };
    const stars = num(/\/stargazers"[^>]*>[\s\S]*?([0-9,]+)\s*<\/a>/i);
    const forks = num(/\/forks"[^>]*>[\s\S]*?([0-9,]+)\s*<\/a>/i);
    const today = num(/([0-9,]+)\s*stars\s*(?:today|this week|this month)/i);
    items.push({
      id: `gh-trend:${fullName}`,
      title: fullName,
      subtitle: desc ? decodeXml(desc.replace(/<[^>]+>/g, "")) : undefined,
      url: `https://github.com/${fullName}`,
      score: stars,
      scoreLabel: "estrelas",
      meta: { rank: i + 1, language: lang, forks, starsPeriod: today },
    });
    if (items.length >= limit) break;
  }
  return items;
}

// ---------------------------------------------------------------------------
// mastodon-trends — tendências de uma instância (sem chave)
// https://mastodon.social/api/v1/trends/statuses|tags|links
// ---------------------------------------------------------------------------

export function buildMastodonTrendsUrl(instance = "mastodon.social", resource = "statuses", limit = 20): string {
  const r = ["statuses", "tags", "links"].includes(resource) ? resource : "statuses";
  const n = Math.max(1, Math.min(limit, 40));
  return `https://${encodeURIComponent(instance)}/api/v1/trends/${r}?limit=${n}`;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- JSON do Mastodon é solto; normalizado na saída. */
export function parseMastodonTrends(resource: string, data: any): DiscoverItem[] {
  const list: any[] = Array.isArray(data) ? data : [];
  const items: DiscoverItem[] = [];
  for (const [i, s] of list.entries()) {
    if (resource === "tags") {
      if (!s?.name) continue;
      const uses = Number(s.history?.[0]?.uses ?? 0);
      items.push({
        id: `masto-tag:${s.name}`, title: `#${s.name}`,
        url: s.url, score: uses, scoreLabel: "publicações hoje",
        meta: { rank: i + 1, accounts: Number(s.history?.[0]?.accounts ?? 0) },
      });
    } else if (resource === "links") {
      if (!s?.url) continue;
      items.push({
        id: `masto-link:${i}`, title: s.title || s.url,
        subtitle: s.provider_name || undefined, url: s.url, image: s.image,
        score: Number(s.history?.[0]?.uses ?? 0), scoreLabel: "compartilhamentos hoje",
        meta: { rank: i + 1, description: s.description },
      });
    } else {
      const content = String(s?.content ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (!content) continue;
      items.push({
        id: `masto:${s.id ?? i}`, title: content.slice(0, 220),
        subtitle: s.account?.display_name || s.account?.acct || undefined,
        url: s.url, publishedAt: s.created_at,
        score: s.favourites_count, scoreLabel: "favoritos",
        meta: { rank: i + 1, boosts: s.reblogs_count, replies: s.replies_count },
      });
    }
  }
  return items;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
