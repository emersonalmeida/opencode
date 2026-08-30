/**
 * Núcleo PURO do extrator Google Trends "Em alta" (trending now) —
 * compartilhado servidor↔cliente (mesmo padrão do systemProfileCore: sem
 * imports de Node/DOM, para o frontend poder importar via caminho relativo).
 *
 * Extrai os dados da página https://trends.google.com/trending?geo=BR pelas
 * MESMAS fontes que a página usa (validado ao vivo em 2026-08-25):
 *
 *  1. RPC interno batchexecute (fonte PRIMÁRIA):
 *       POST /_/TrendsUi/data/batchexecute?rpcids=i0OFE
 *       f.req=[[["i0OFE","[null,null,\"BR\",0,null,24]",null,"generic"]]]
 *     Parâmetros reais: geo (BR/US/PT…) e janela hours (4|24|48|168).
 *     Rendimento: 4h≈25 · 24h≈230 · 48h≈630 · 168h≈1800 trends.
 *     Cada linha: [title, null, geo, [startTs], [endTs|null], null, volume,
 *     null, growthPct, [relatedQueries], [topicIds], [entityIds], title].
 *     (O 4º campo do payload NÃO filtra categoria — a taxonomia vem por
 *     trend em topicIds e o filtro é client-side, como na página oficial.)
 *
 *  2. RSS público (ENRICHMENT de notícias/imagens do top-10):
 *       GET /trending/rss?geo=BR — traz até 10 trends com ht:news_item
 *       (título/url/fonte/imagem). Os parâmetros hours/category/sort do RSS
 *       são IGNORADOS pelo Google hoje (toda resposta é o mesmo top-10) —
 *       por isso o RSS não é fonte primária de descoberta.
 */

export interface TrendingNewsItem {
  title: string;
  url: string;
  source: string;
  picture?: string;
  snippet?: string;
}

export interface TrendingProvenance {
  /** janelas de tempo (horas) em que o item apareceu no gather. */
  hours: number[];
}

export interface TrendingItem {
  title: string;
  /** volume aproximado de buscas no período. */
  traffic: number;
  /** crescimento percentual no período (ex.: 1000 = +1000%). */
  growthPct: number;
  /** ISO date de quando o trend começou. */
  startedAt: string;
  /** ISO date de quando deixou de estar ativo (ausente = em alta agora). */
  endedAt?: string;
  /** true enquanto o trend está ativo (sem endedAt). */
  active: boolean;
  /** consultas relacionadas ("detalhamento da consulta" da página oficial). */
  relatedQueries: string[];
  /** ids da taxonomia interna do Google (ver TOPIC_LABELS). */
  topicIds: number[];
  /** posição no ranking de relevância da fonte (0-based). */
  rank: number;
  picture?: string;
  pictureSource?: string;
  /** notícias vinculadas (vêm do RSS top-10; ausente = sem cobertura). */
  news: TrendingNewsItem[];
  provenance: TrendingProvenance;
}

/** Contagem por combo da coleta (transparência do rendimento). */
export interface TrendingObservation {
  hours: number;
  count: number;
  /** quantos itens desta janela eram novos no merge. */
  added: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Dimensões de exploração (fonte única de UI; o servidor valida)
// ---------------------------------------------------------------------------

export const TRENDING_REGIONS: { id: string; label: string }[] = [
  { id: "br", label: "Brasil" },
  { id: "pt", label: "Portugal" },
  { id: "us", label: "Estados Unidos" },
  { id: "ar", label: "Argentina" },
  { id: "mx", label: "México" },
  { id: "co", label: "Colômbia" },
  { id: "cl", label: "Chile" },
  { id: "pe", label: "Peru" },
  { id: "uy", label: "Uruguai" },
  { id: "es", label: "Espanha" },
  { id: "gb", label: "Reino Unido" },
  { id: "fr", label: "França" },
  { id: "de", label: "Alemanha" },
  { id: "it", label: "Itália" },
  { id: "ca", label: "Canadá" },
  { id: "au", label: "Austrália" },
  { id: "jp", label: "Japão" },
  { id: "in", label: "Índia" },
];

export const TRENDING_HOURS: { id: number; label: string; short: string }[] = [
  { id: 4, label: "Últimas 4 horas", short: "4h" },
  { id: 24, label: "Últimas 24 horas", short: "24h" },
  { id: 48, label: "Últimas 48 horas", short: "48h" },
  { id: 168, label: "Últimos 7 dias", short: "7d" },
];

export function hoursLabel(h: number): string {
  return TRENDING_HOURS.find((o) => o.id === h)?.label ?? `${h}h`;
}

export function hoursShort(h: number): string {
  return TRENDING_HOURS.find((o) => o.id === h)?.short ?? `${h}h`;
}

/**
 * Taxonomia interna do Google presente em topicIds — rótulos mapeados por
 * evidência das amostras reais (2026-08-25). Só os ids verificados com
 * confiança têm nome; os demais caem em "Tópico N" (honesto).
 */
export const TOPIC_LABELS: Record<number, string> = {
  1: "Negócios",
  4: "Entretenimento",
  5: "Comida e bebida",
  10: "Saúde",
  14: "Destaques",
  17: "Esportes",
  18: "Tecnologia",
  20: "Clima",
};

export function topicLabel(id: number): string {
  return TOPIC_LABELS[id] ?? `Tópico ${id}`;
}

// ---------------------------------------------------------------------------
// Parsing do RPC batchexecute
// ---------------------------------------------------------------------------

function toIso(ts: unknown): string | undefined {
  const n = Number(ts);
  if (!isFinite(n) || n <= 0) return undefined;
  return new Date(n * 1000).toISOString();
}

/**
 * Parseia a resposta do batchexecute: envelope ")]}'" + linhas com JSON;
 * cada chunk tem ["wrb.fr","i0OFE","<json string>"]. O json interno é
 * [null, [trendRows]] e cada linha segue o layout documentado no cabeçalho.
 */
export function parseBatchexecuteTrends(text: string, dim: { hours: number }): TrendingItem[] {
  const clean = text.replace(/^\)\]\}',?\n?/, "");
  const items: TrendingItem[] = [];
  for (const line of clean.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("[[")) continue;
    let envelope: unknown;
    try {
      envelope = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (!Array.isArray(envelope)) continue;
    for (const chunk of envelope) {
      if (!Array.isArray(chunk) || chunk[1] !== "i0OFE" || typeof chunk[2] !== "string") continue;
      let inner: unknown;
      try {
        inner = JSON.parse(chunk[2]);
      } catch {
        continue;
      }
      const rows = (inner as [unknown, unknown[]])?.[1];
      if (!Array.isArray(rows)) continue;
      rows.forEach((row, rank) => {
        if (!Array.isArray(row) || typeof row[0] !== "string" || !row[0].trim()) return;
        const startedAt = toIso(Array.isArray(row[3]) ? row[3][0] : undefined);
        const endedAt = toIso(Array.isArray(row[4]) ? row[4][0] : undefined);
        items.push({
          title: row[0].trim(),
          traffic: Number(row[6]) || 0,
          growthPct: Number(row[8]) || 0,
          startedAt: startedAt ?? "",
          endedAt,
          active: !endedAt,
          relatedQueries: Array.isArray(row[9])
            ? row[9].filter((q): q is string => typeof q === "string").slice(0, 12)
            : [],
          topicIds: Array.isArray(row[10])
            ? row[10].filter((t): t is number => typeof t === "number")
            : [],
          rank,
          news: [],
          provenance: { hours: [dim.hours] },
        });
      });
    }
  }
  return items;
}

// ---------------------------------------------------------------------------
// Parsing do RSS (enrichment de notícias/imagens)
// ---------------------------------------------------------------------------

export function decodeXmlEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function extractTag(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return m?.[1]?.trim() ?? "";
}

export interface RssEnrichment {
  news: TrendingNewsItem[];
  picture?: string;
  pictureSource?: string;
}

/** Parseia o RSS do trending (top-10) para enriquecer os itens do RPC. */
export function parseTrendingRss(xml: string): Map<string, RssEnrichment> {
  const map = new Map<string, RssEnrichment>();
  for (const raw of xml.split(/<item>/).slice(1)) {
    const block = raw.split(/<\/item>/)[0] ?? raw;
    const title = decodeXmlEntities(extractTag(block, "title")).trim();
    if (!title) continue;
    const news: TrendingNewsItem[] = [];
    for (const nm of block.matchAll(/<ht:news_item>([\s\S]*?)<\/ht:news_item>/g)) {
      const nb = nm[1];
      const nTitle = decodeXmlEntities(extractTag(nb, "ht:news_item_title")).trim();
      const nUrl = extractTag(nb, "ht:news_item_url").trim();
      if (!nTitle || !nUrl) continue;
      news.push({
        title: nTitle,
        url: nUrl,
        source: decodeXmlEntities(extractTag(nb, "ht:news_item_source")).trim(),
        picture: extractTag(nb, "ht:news_item_picture") || undefined,
        snippet: decodeXmlEntities(extractTag(nb, "ht:news_item_snippet")).trim() || undefined,
      });
    }
    map.set(trendKey(title), {
      news,
      picture: extractTag(block, "ht:picture") || undefined,
      pictureSource: decodeXmlEntities(extractTag(block, "ht:picture_source")).trim() || undefined,
    });
  }
  return map;
}

/** Aplica o enrichment do RSS nos itens do RPC (dedup por trendKey). */
export function enrichWithRss(items: TrendingItem[], rss: Map<string, RssEnrichment>): TrendingItem[] {
  for (const item of items) {
    const e = rss.get(trendKey(item.title));
    if (!e) continue;
    item.news = e.news;
    item.picture = e.picture;
    item.pictureSource = e.pictureSource;
  }
  return items;
}

// ---------------------------------------------------------------------------
// Merge determinístico (dedup + proveniência acumulada)
// ---------------------------------------------------------------------------

/** Chave de dedup: minúsculas sem diacríticos — "Café!" ≡ "cafe". */
export function trendKey(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function unionSorted<T extends string | number>(a: T[], b: T[]): T[] {
  return [...new Set([...a, ...b])].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
}

/**
 * Funde listas de trends de janelas diferentes: dedup por trendKey, mantém o
 * MAIOR volume/crescimento, o startedAt mais antigo (início real), active se
 * ativo em qualquer janela, une queries/tópicos/notícias e acumula as janelas
 * na proveniência. Ordena por volume desc (a UI reordena se quiser).
 */
export function mergeTrending(lists: TrendingItem[][]): TrendingItem[] {
  const best = new Map<string, TrendingItem>();
  for (const list of lists) {
    for (const item of list) {
      const key = trendKey(item.title);
      const prev = best.get(key);
      if (!prev) {
        best.set(key, { ...item, relatedQueries: [...item.relatedQueries], topicIds: [...item.topicIds], news: [...item.news] });
        continue;
      }
      prev.traffic = Math.max(prev.traffic, item.traffic);
      prev.growthPct = Math.max(prev.growthPct, item.growthPct);
      prev.rank = Math.min(prev.rank, item.rank);
      if (item.startedAt && (!prev.startedAt || item.startedAt < prev.startedAt)) {
        prev.startedAt = item.startedAt;
      }
      if (item.active) {
        prev.active = true;
        prev.endedAt = undefined;
      } else if (!prev.active && item.endedAt && (!prev.endedAt || item.endedAt > prev.endedAt)) {
        prev.endedAt = item.endedAt;
      }
      prev.relatedQueries = unionSorted(prev.relatedQueries, item.relatedQueries).slice(0, 12);
      prev.topicIds = unionSorted(prev.topicIds, item.topicIds);
      if (!prev.picture && item.picture) {
        prev.picture = item.picture;
        prev.pictureSource = item.pictureSource;
      }
      const seenUrls = new Set(prev.news.map((n) => n.url));
      for (const n of item.news) {
        if (!seenUrls.has(n.url)) {
          prev.news.push(n);
          seenUrls.add(n.url);
        }
      }
      prev.provenance = { hours: unionSorted(prev.provenance.hours, item.provenance.hours) };
    }
  }
  return [...best.values()].sort((a, b) => b.traffic - a.traffic);
}

// ---------------------------------------------------------------------------
// Agregados e utilidades de exibição
// ---------------------------------------------------------------------------

export interface TrendingKpis {
  total: number;
  active: number;
  totalTraffic: number;
  newsCount: number;
  sources: string[];
  /** quantidade de trends por tópico (id → n). */
  perTopic: Record<number, number>;
}

export function trendingKpis(items: TrendingItem[]): TrendingKpis {
  const sources = new Set<string>();
  const perTopic: Record<number, number> = {};
  let totalTraffic = 0;
  let newsCount = 0;
  let active = 0;
  for (const item of items) {
    totalTraffic += item.traffic;
    newsCount += item.news.length;
    if (item.active) active++;
    for (const n of item.news) if (n.source) sources.add(n.source);
    for (const t of item.topicIds) perTopic[t] = (perTopic[t] ?? 0) + 1;
  }
  return {
    total: items.length,
    active,
    totalTraffic,
    newsCount,
    sources: [...sources].sort(),
    perTopic,
  };
}

/** Formata o volume para exibição compacta em PT-BR: 1500 → "1,5 mil". */
export function formatTraffic(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (n >= 1e3) return `${(n / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return n.toLocaleString("pt-BR");
}

/** Tempo relativo em PT-BR ("há 2 h", "há 3 dias") — puro e testável. */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const t = Date.parse(iso);
  if (!isFinite(t)) return "";
  const diff = Math.max(0, now - t);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `há ${days} ${days === 1 ? "dia" : "dias"}`;
  const months = Math.floor(days / 30);
  return `há ${months} ${months === 1 ? "mês" : "meses"}`;
}

/** Link público para explorar o trend no Google Trends. */
export function exploreUrl(title: string, geo: string): string {
  return `https://trends.google.com/trends/explore?q=${encodeURIComponent(title)}&geo=${geo.toUpperCase()}`;
}

/** Link público da página "Em alta" original (fonte dos dados). */
export function trendingPageUrl(geo: string): string {
  return `https://trends.google.com/trending?geo=${geo.toUpperCase()}`;
}
