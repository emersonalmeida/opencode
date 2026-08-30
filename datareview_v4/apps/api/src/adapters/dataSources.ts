/**
 * Lote 7 de adaptadores reais (SourcePort) — dados/descobrimento com API
 * pública estável: Wikimedia (top/views/onThisDay), CoinGecko, SteamSpy,
 * Open-Meteo, Brasil API (feriados/taxas), Frankfurter, IBGE nomes,
 * Open Library trending, GitHub trending (proxy via Search API),
 * Mastodon trends e Google Trends em alta (RSS). Convenção: fetch+map.
 */
import type { CollectOptions, NormalizedItem } from "@v4/contracts";
import { cap, defineAdapter, item, num, str } from "./base.js";
import { asArray, asRecord, fetchJson, fetchText } from "./http.js";
import { parseFeed } from "./infraSources.js";

function excerpt(value: string, max = 220): string | undefined {
  const clean = value.trim();
  return clean ? clean.slice(0, max) : undefined;
}

/* ------------------------------------------------------------ Wikipédia -- */
const WIKI_LANG: Record<string, string> = { br: "pt", pt: "pt", us: "en", en: "en", es: "es", fr: "fr", de: "de", it: "it", ar: "ar", jp: "ja", cn: "zh" };

function wikiLang(options: CollectOptions): string {
  return WIKI_LANG[options.country?.toLowerCase().slice(0, 2) ?? ""] ?? "pt";
}

function wikiProject(options: CollectOptions): string {
  const explicit = options.engine?.trim();
  if (explicit && /^[\w-]+\.wikipedia$/.test(explicit)) return explicit;
  return `${wikiLang(options)}.wikipedia`;
}

function wikiHost(project: string): string {
  return project.replace(/\.wikipedia$/i, ".wikipedia.org");
}

function daysAgo(n: number): { year: string; month: string; day: string } {
  const d = new Date(Date.now() - n * 86_400_000);
  return {
    year: String(d.getUTCFullYear()),
    month: String(d.getUTCMonth() + 1).padStart(2, "0"),
    day: String(d.getUTCDate()).padStart(2, "0"),
  };
}

/* ---------------------------------------------------- wikitop (views top) - */
export const wikitop = defineAdapter(
  {
    id: "wikitop",
    label: "Wikipedia top views",
    kind: "article",
    description: "Top artigos mais vistos na Wikipédia (por projeto/dia).",
    capabilities: ["trends"],
    rateLimit: { rps: 1, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      const { year, month, day } = daysAgo(1);
      const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/${wikiProject(options)}/all-access/${year}/${month}/${day}`;
      return fetchJson(url, { signal: options.signal, timeoutMs: 15000 });
    },
    map(data: unknown, options: CollectOptions): NormalizedItem[] {
      const dayGroup = asRecord(asArray(asRecord(data).items)[0]);
      const project = str(dayGroup.project);
      const day = `${str(dayGroup.year)}-${str(dayGroup.month)}-${str(dayGroup.day)}`;
      return asArray(dayGroup.articles)
        .slice(0, cap(options.limit ?? 25, 50))
        .map((a) => {
          const article = asRecord(a);
          const title = str(article.article).replaceAll("_", " ");
          if (!title) return null;
          return item(
            {
              id: `wikitop:${title}:${day}`,
              title,
              url: `https://${wikiHost(project)}/wiki/${encodeURIComponent(str(article.article).replaceAll(" ", "_"))}`,
              text: `Ranking de acesso em ${day}.`,
              score: num(article.views),
              meta: { rank: num(article.rank), views: num(article.views), day },
            },
            "wikitop",
            "article",
          );
        })
        .filter((x): x is NormalizedItem => x !== null);
    },
  },
);

/* ---------------------------------------------------- wikiviews (artigo) - */
/* MediaWiki Action API prop=pageviews → views diárias por artigo (últimos 60d). */
export const wikiviews = defineAdapter(
  {
    id: "wikiviews",
    label: "Wikipedia views por artigo",
    kind: "metric",
    description: "Views diárias de um artigo (query = título; Action API prop=pageviews).",
    capabilities: ["trends"],
    lookup: true,
    rateLimit: { rps: 1, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      const title = options.query.trim();
      if (!title) throw new Error("query deve ser o título de um artigo (ex.: TypeScript)");
      const url = `https://${wikiLang(options)}.wikipedia.org/w/api.php?action=query&format=json&prop=pageviews&redirects=1&titles=${encodeURIComponent(title)}`;
      return fetchJson(url, { signal: options.signal, timeoutMs: 15000 });
    },
    map(data: unknown, options: CollectOptions): NormalizedItem[] {
      const pages = asRecord(asRecord(asRecord(data).query).pages);
      const pageId = Object.keys(pages)[0] ?? "";
      const page = asRecord(pages[pageId]);
      const title = str(page.title);
      if (!title) return [];
      const dayViewsRaw = asRecord(page.pageviews);
      const dayViews = Object.entries(dayViewsRaw as Record<string, unknown>)
        .map(([day, v]) => ({ day, views: num(v) }))
        .filter((d) => d.views !== undefined)
        .sort((a, b) => (a.day < b.day ? 1 : -1));
      const total = dayViews.reduce<number>((acc, d) => acc + (d.views ?? 0), 0);
      return [
        item(
          {
            id: `wikiviews:${title}`,
            title: `${title} · ${total.toLocaleString("pt-BR")} views (60d)`,
            url: `https://${wikiLang(options)}.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(" ", "_"))}`,
            text: `Views diárias somadas nos últimos ${dayViews.length} dias.`,
            score: total,
            meta: { total60d: total, dailyViews: dayViews.slice(0, 30).map((d) => ({ day: d.day, views: d.views })) },
          },
          "wikiviews",
          "metric",
        ),
      ];
    },
  },
);

/* ------------------------------------------------------ onthisday (dia) --- */
const OTD_TYPES = ["events", "selected", "births", "deaths", "holidays"] as const;
export const onthisday = defineAdapter(
  {
    id: "onthisday",
    label: "Wikipedia on this day",
    kind: "event",
    description: "Eventos/nascimentos/mortes do dia (engine = all|selected|births|deaths|events|holidays).",
    capabilities: ["custom"],
    rateLimit: { rps: 1, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      const lang = WIKI_LANG[options.country?.toLowerCase().slice(0, 2) ?? ""] ?? "pt";
      const requested = options.engine?.trim() || "selected";
      const type = (OTD_TYPES.includes(requested as (typeof OTD_TYPES)[number]) ? requested : "selected") as (typeof OTD_TYPES)[number];
      const m = options.query.trim().match(/^(\d{1,2})[/-](\d{1,2})$/);
      let month = String(new Date().getUTCMonth() + 1);
      let day = String(new Date().getUTCDate());
      if (m) {
        const mm = Number(m[1]);
        const dd = Number(m[2]);
        if (mm < 1 || mm > 12 || dd < 1 || dd > 31) throw new Error("data no formato MM/DD inválida");
        month = String(mm).padStart(2, "0");
        day = String(dd).padStart(2, "0");
      }
      const url = `https://api.wikimedia.org/feed/v1/wikipedia/${lang}/onthisday/${type}/${month}/${day}`;
      return fetchJson(url, { signal: options.signal, timeoutMs: 15000 });
    },
    map(data: unknown): NormalizedItem[] {
      const root = asRecord(data);
      const out: NormalizedItem[] = [];
      for (const key of ["selected", "events", "births", "deaths", "holidays"] as const) {
        for (const e of asArray(root[key])) {
          const en = asRecord(e);
          const text = str(en.text);
          if (!text) continue;
          const year = typeof en.year === "number" ? String(en.year) : str(en.year);
          const pages = asArray(en.pages);
          const firstPage = pages.length ? asRecord(pages[0]) : undefined;
          const desktop = firstPage ? asRecord(asRecord(firstPage.content_urls).desktop) : undefined;
          out.push(
            item(
              {
                id: `onthisday:${key}:${year}:${text.slice(0, 60)}`,
                title: text.slice(0, 120),
                url: str(desktop?.page) || undefined,
                text: key === "events" || key === "selected" ? text : undefined,
                date: year || undefined,
                meta: { type: key, year: year || undefined, pages: pages.length || undefined },
              },
              "onthisday",
              "event",
            ),
          );
        }
        if (out.length >= 50) return out.slice(0, 50);
      }
      return out.slice(0, 50);
    },
  },
);

/* --------------------------------------------------------------- crypto --- */
export const crypto = defineAdapter(
  {
    id: "crypto",
    label: "CoinGecko (crypto)",
    kind: "crypto",
    description: "Tendências de cripto da CoinGecko (trending; engine=markets p/ moeda específica).",
    capabilities: ["trends"],
    rateLimit: { rps: 1, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      if (options.engine?.trim() === "markets") {
        const id = options.query.trim();
        if (!id) throw new Error("engine=markets exige o id da moeda na query (ex.: bitcoin)");
        return fetchJson(
          `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${encodeURIComponent(id)}&order=market_cap_desc&per_page=${cap(options.limit ?? 10, 50)}`,
          { signal: options.signal, timeoutMs: 15000 },
        );
      }
      return fetchJson("https://api.coingecko.com/api/v3/search/trending", { signal: options.signal, timeoutMs: 15000 });
    },
    map(data: unknown, options: CollectOptions): NormalizedItem[] {
      if (Array.isArray(data)) {
        // markets (array de moedas)
        return data.slice(0, cap(options.limit ?? 10, 50)).map((c) => {
          const coin = asRecord(c);
          return item(
            {
              id: `crypto:${str(coin.id)}`,
              title: `${str(coin.name) || str(coin.id)} (${str(coin.symbol)})`,
              url: `https://www.coingecko.com/en/coins/${encodeURIComponent(str(coin.id))}`,
              text: coin.current_price !== undefined ? `$${Number(coin.current_price).toLocaleString("pt-BR", { maximumFractionDigits: 8 })}` : undefined,
              score: num(coin.market_cap_rank),
              meta: { rank: num(coin.market_cap_rank), priceUsd: num(coin.current_price), change24h: num(coin.price_change_percentage_24h) },
            },
            "crypto",
            "crypto",
          );
        });
      }
      const coins = asArray(asRecord(data).coins).map((c) => asRecord(c).item);
      return coins
        .map((c) => {
          const coin = asRecord(c);
          const name = str(coin.name);
          if (!name) return null;
          const d = asRecord(coin.data);
          const priceUsd = num(asRecord(d.price).usd);
          const change24h = num(asRecord(d.price_change_percentage_24h).usd);
          return item(
            {
              id: `crypto:${str(coin.id)}`,
              title: `${name} (${str(coin.symbol)})`,
              url: `https://www.coingecko.com/en/coins/${encodeURIComponent(str(coin.id))}`,
              text: priceUsd !== undefined ? `$${priceUsd.toLocaleString("pt-BR", { maximumFractionDigits: 8 })}` : undefined,
              score: num(coin.market_cap_rank) ?? change24h,
              meta: { rank: num(coin.market_cap_rank), priceUsd, change24h, symbol: str(coin.symbol) },
            },
            "crypto",
            "crypto",
          );
        })
        .filter((x): x is NormalizedItem => x !== null);
    },
  },
);

/* -------------------------------------------------------------- steamtop --- */
export const steamtop = defineAdapter(
  {
    id: "steamtop",
    label: "SteamSpy (top jogos)",
    kind: "game",
    description: "Top jogos Steam por jogadores (SteamSpy; engine = top100forever).",
    capabilities: ["media", "trends"],
    rateLimit: { rps: 1, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      const request = options.engine?.trim() === "top100forever" ? "top100forever" : "top100in2weeks";
      return fetchJson(`https://steamspy.com/api.php?request=${request}`, { signal: options.signal, timeoutMs: 15000 });
    },
    map(data: unknown, options: CollectOptions): NormalizedItem[] {
      const root = asRecord(data);
      return Object.entries(root as Record<string, unknown>)
        .slice(0, cap(options.limit ?? 25, 50))
        .map(([appid, v]) => {
          const game = asRecord(v);
          const name = str(game.name);
          if (!name) return null;
          const player2w = num(game.players_2weeks)?.toLocaleString("pt-BR");
          const price = priceText(num(game.price));
          return item(
            {
              id: `steamtop:${appid}`,
              title: name,
              url: `https://store.steampowered.com/app/${encodeURIComponent(appid)}/`,
              text: [`Jogadores (2 semanas): ${player2w ?? "?"}`, owners(game), price].filter(Boolean).join("; ") || undefined,
              score: num(game.positive) ?? num(game.players_2weeks),
              meta: { appid, owners: str(game.owners), positive: num(game.positive), negative: num(game.negative), players2w: num(game.players_2weeks) },
            },
            "steamtop",
            "game",
          );
        })
        .filter((x): x is NormalizedItem => x !== null);
    },
  },
);

function owners(game: Record<string, unknown>): string | undefined {
  const o = str(game.owners);
  return o ? `owners ${o}` : undefined;
}

function priceText(priceCents: number | undefined): string | undefined {
  return priceCents != null && priceCents > 0 ? `preço $${(priceCents / 100).toFixed(2)}` : "grátis";
}

/* -------------------------------------------------------------- weather --- */
export const weather = defineAdapter(
  {
    id: "weather",
    label: "Open-Meteo (clima)",
    kind: "metric",
    description: "Clima atual por cidade (Open-Meteo; query = cidade, vírgula p/ várias).",
    capabilities: ["custom"],
    rateLimit: { rps: 1, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      const cities = options.query.split(",").map((c) => c.trim()).filter(Boolean).slice(0, 5);
      if (cities.length === 0) throw new Error("query deve conter ao menos uma cidade (ex.: São Paulo)");
      const results: Array<Record<string, unknown>> = [];
      for (const city of cities) {
        const geo = asRecord(
          await fetchJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=pt&format=json`, {
            signal: options.signal,
            timeoutMs: 12000,
          }),
        );
        const place = asRecord(asArray(geo.results)[0]);
        const lat = place.latitude;
        const lon = place.longitude;
        if (typeof lat !== "number" || typeof lon !== "number") continue;
        const forecast = asRecord(
          await fetchJson(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code`,
            { signal: options.signal, timeoutMs: 12000 },
          ),
        );
        results.push({
          city: str(place.name) || city,
          ...asRecord(forecast.current),
          units: asRecord(forecast.current_units),
        });
      }
      if (results.length === 0) throw new Error("nenhuma cidade encontrada (geocoding)");
      return results;
    },
    map(data: unknown): NormalizedItem[] {
      return asArray(data).map((entry) => {
        const r = asRecord(entry);
        const units = asRecord(r.units);
        const city = str(r.city) || "?";
        const temp = num(r.temperature_2m);
        const humidity = num(r.relative_humidity_2m);
        const precip = num(r.precipitation);
        const wind = num(r.wind_speed_10m);
        const parts: string[] = [];
        if (humidity !== undefined) parts.push(`Umidade ${humidity}${str(units.relative_humidity_2m)}`);
        if (precip !== undefined) parts.push(`Precipitação ${precip}${str(units.precipitation)}`);
        if (wind !== undefined) parts.push(`Vento ${wind}${str(units.wind_speed_10m)}`);
        return item(
          {
            id: `weather:${city}`,
            title: `${city} · ${temp !== undefined ? `${temp}${str(units.temperature_2m)}` : "—"}`,
            text: parts.join(" · ") || undefined,
            score: temp,
            meta: {
              temperature2m: temp,
              humidity,
              precipitation: precip,
              windSpeed10m: wind,
              weatherCode: num(r.weather_code),
            },
          },
          "weather",
          "metric",
        );
      });
    },
  },
);

/* ------------------------------------------------------ brasilapi feriados - */
export const brasilapiFeriados = defineAdapter(
  {
    id: "brasilapi-feriados",
    label: "Brasil API (feriados)",
    kind: "event",
    description: "Feriados nacionais do Brasil por ano (query = ano).",
    capabilities: ["custom"],
    rateLimit: { rps: 1, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      const year = /^\d{4}$/.test(options.query.trim()) ? options.query.trim() : String(new Date().getFullYear());
      return fetchJson(`https://brasilapi.com.br/api/feriados/v1/${year}`, { signal: options.signal, timeoutMs: 15000 });
    },
    map(data: unknown, options: CollectOptions): NormalizedItem[] {
      return asArray(data)
        .slice(0, cap(options.limit ?? 25, 50))
        .map((f) => {
          const feriado = asRecord(f);
          return item(
            {
              id: `feriado:${str(feriado.date)}`,
              title: str(feriado.name) || str(feriado.date),
              text: str(feriado.type) || undefined,
              date: str(feriado.date) || undefined,
              meta: { type: str(feriado.type) || undefined },
            },
            "brasilapi-feriados",
            "event",
          );
        });
    },
  },
);

/* -------------------------------------------------------- brasilapi taxas --- */
export const brasilapiTaxas = defineAdapter(
  {
    id: "brasilapi-taxas",
    label: "Brasil API (taxas)",
    kind: "metric",
    description: "Taxas de juros do Banco Central (Brasil API).",
    capabilities: ["custom"],
    rateLimit: { rps: 1, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      return fetchJson("https://brasilapi.com.br/api/taxas/v1", { signal: options.signal, timeoutMs: 15000 });
    },
    map(data: unknown): NormalizedItem[] {
      return asArray(data)
        .map((t) => {
          const taxa = asRecord(t);
          const valor = num(taxa.valor);
          return item(
            {
              id: `taxa:${str(taxa.nome)}`,
              title: str(taxa.nome),
              text: valor !== undefined ? `${valor}%` : undefined,
              date: str(taxa.data) || undefined,
              score: valor,
              meta: { valor, data: str(taxa.data) || undefined },
            },
            "brasilapi-taxas",
            "metric",
          );
        })
        .filter((x): x is NormalizedItem => x !== null);
    },
  },
);

/* ------------------------------------------------- frankfurter (câmbio) --- */
export const frankfurter = defineAdapter(
  {
    id: "frankfurter",
    label: "Frankfurter (câmbio)",
    kind: "metric",
    description: "Câmbio diário do BCE (engine = moeda base; query = símbolos, ex.: USD,EUR).",
    capabilities: ["custom"],
    rateLimit: { rps: 1, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      const base = (/^[A-Z]{3}$/.test(options.engine?.trim() ?? "") ? (options.engine as string) : "USD").toUpperCase();
      const symbols = options.query.trim().toUpperCase();
      const url = `https://api.frankfurter.dev/v1/latest?base=${base}${symbols ? `&symbols=${symbols}` : ""}`;
      return fetchJson(url, { signal: options.signal, timeoutMs: 15000 });
    },
    map(data: unknown): NormalizedItem[] {
      const r = asRecord(data);
      const base = str(r.base);
      const date = str(r.date);
      return Object.entries(asRecord(r.rates) as Record<string, unknown>)
        .map(([sym, v]) => {
          const value = typeof v === "number" ? v : Number(v);
          if (!Number.isFinite(value)) return null;
          return item(
            {
              id: `fx:${base}${sym}:${date}`,
              title: `1 ${base} = ${value.toLocaleString("pt-BR", { maximumFractionDigits: 6 })} ${sym}`,
              text: `Câmbio de referência ${date} (Frankfurt).`,
              date,
              score: value,
              meta: { base, symbol: sym, rate: value, date },
            },
            "frankfurter",
            "metric",
          );
        })
        .filter((x): x is NormalizedItem => x !== null);
    },
  },
);

/* ----------------------------------------------------------- ibge-nomes --- */
export const ibgeNomes = defineAdapter(
  {
    id: "ibge-nomes",
    label: "IBGE (ranking de nomes)",
    kind: "person",
    description: "Ranking de nomes do censo (IBGE) — query opcional p/ um nome exato.",
    capabilities: ["custom"],
    lookup: true,
    rateLimit: { rps: 1, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      if (options.query.trim()) {
        return fetchJson(`https://servicodados.ibge.gov.br/api/v2/censos/nomes/${encodeURIComponent(options.query.trim().toUpperCase())}`, {
          signal: options.signal,
          timeoutMs: 15000,
        });
      }
      return fetchJson("https://servicodados.ibge.gov.br/api/v2/censos/nomes/ranking", { signal: options.signal, timeoutMs: 15000 });
    },
    map(data: unknown, options: CollectOptions): NormalizedItem[] {
      const arr = asArray(data);
      const entry = asRecord(arr[0]);
      // Ranking (censo): entry.res = [{nome, frequencia, ranking}]
      // Nome exato: entry.res = [{periodo, frequencia}]
      if (arr.length && Array.isArray(entry.res)) {
        const res = asArray(entry.res);
        const first = asRecord(res[0]);
        if (str(first.periodo)) {
          // nome exato → série por período
          const name = str(entry.nome);
          const total = res.reduce<number>((acc, p) => acc + (num(asRecord(p).frequencia) ?? 0), 0);
          if (!name) return [];
          return [
            item(
              {
                id: `ibge:${name}`,
                title: name,
                text: res.length > 0 ? `${total.toLocaleString("pt-BR")} registros (${res.length} períodos censitários).` : undefined,
                score: total || undefined,
                meta: { periods: res.slice(0, 30).map((p) => ({ periodo: str(asRecord(p).periodo), frequencia: num(asRecord(p).frequencia) })) },
              },
              "ibge-nomes",
              "person",
            ),
          ];
        }
        return res
          .slice(0, cap(options.limit ?? 25, 50))
          .map((p) => {
            const person = asRecord(p);
            const name = str(person.nome);
            if (!name) return null;
            return item(
              {
                id: `ibge:${name}`,
                title: name,
                text: `${typeof person.frequencia === "number" ? person.frequencia.toLocaleString("pt-BR") : "?"} registros no censo.`,
                score: num(person.frequencia),
                meta: { rank: num(person.ranking), frequencia: num(person.frequencia) },
              },
              "ibge-nomes",
              "person",
            );
          })
          .filter((x): x is NormalizedItem => x !== null);
      }
      return [];
    },
  },
);

/* ---------------------------------------------- openlibrary-trending ----- */
export const openlibraryTrending = defineAdapter(
  {
    id: "openlibrary-trending",
    label: "Open Library (em alta)",
    kind: "book",
    description: "Livros em alta na Open Library (engine = daily|weekly|monthly).",
    capabilities: ["trends", "custom"],
    rateLimit: { rps: 1, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      const period = (["daily", "weekly", "monthly"].includes(options.engine?.trim() ?? "") ? options.engine : "daily") as "daily" | "weekly" | "monthly";
      return fetchJson(`https://openlibrary.org/trending/${period}.json`, { signal: options.signal, timeoutMs: 15000 });
    },
    map(data: unknown, options: CollectOptions): NormalizedItem[] {
      return asArray(asRecord(data).works)
        .slice(0, cap(options.limit ?? 25, 50))
        .map((w) => {
          const work = asRecord(w);
          const key = str(work.key);
          const title = str(work.title);
          if (!title) return null;
          const authors = asArray(work.author_name).map((a) => str(a)).filter(Boolean);
          return item(
            {
              id: key || title,
              title,
              url: `https://openlibrary.org${key || ""}`,
              text: authors[0] ? `Por ${authors.join(", ")}.` : undefined,
              author: authors[0] || undefined,
              date: typeof work.first_publish_year === "number" ? String(work.first_publish_year) : undefined,
              score: num(work.ratings_average) ?? num(work.want_to_read_count),
              meta: { year: str(work.first_publish_year), wantToRead: num(work.want_to_read_count), ratingsAverage: num(work.ratings_average), coverKey: str(work.cover_edition_key) },
            },
            "openlibrary-trending",
            "book",
          );
        })
        .filter((x): x is NormalizedItem => x !== null);
    },
  },
);

/* ------------------------------------------------ github-trending ------- */
export const githubTrending = defineAdapter(
  {
    id: "github-trending",
    label: "GitHub trending",
    kind: "repo",
    description: "Surgindo no GitHub (proxy: Search API sort=stars, criados há ~30d; engine = linguagem).",
    capabilities: ["code", "trends"],
    rateLimit: { rps: 1, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      const since = daysAgo(30);
      const lang = options.engine?.trim() ? `+language:${encodeURIComponent(options.engine.trim())}` : "";
      const url = `https://api.github.com/search/repositories?q=created:>${since.year}-${since.month}-${since.day}${lang}&sort=stars&order=desc&per_page=${cap(options.limit ?? 25, 50)}`;
      return fetchJson(url, { signal: options.signal, timeoutMs: 15000 });
    },
    map(data: unknown): NormalizedItem[] {
      return asArray(asRecord(data).items)
        .map((r) => {
          const repo = asRecord(r);
          const fullName = str(repo.full_name);
          if (!fullName) return null;
          return item(
            {
              id: fullName,
              title: fullName,
              url: str(repo.html_url) || undefined,
              text: excerpt(str(repo.description)),
              date: str(repo.pushed_at) || undefined,
              score: num(repo.stargazers_count),
              meta: { stars: num(repo.stargazers_count), forks: num(repo.forks_count), language: str(repo.language) || undefined, openIssues: num(repo.open_issues_count) },
            },
            "github-trending",
            "repo",
          );
        })
        .filter((x): x is NormalizedItem => x !== null);
    },
  },
);

/* ------------------------------------------------ mastodon-trends ------- */
export const mastodonTrends = defineAdapter(
  {
    id: "mastodon-trends",
    label: "Mastodon trends",
    kind: "trend-point",
    description: "Tendências do Mastodon (engine = statuses|tags|links; query = instância opcional).",
    capabilities: ["social", "trends"],
    rateLimit: { rps: 1, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      const instance = /^[\w.-]+\.[a-z]{2,}$/i.test(options.query.trim()) ? options.query.trim() : "mastodon.social";
      const KINDS = ["statuses", "tags", "links"] as const;
      const requested = (options.engine?.trim() || "tags") as (typeof KINDS)[number];
      const kind = (KINDS.includes(requested) ? requested : "tags") as (typeof KINDS)[number];
      return fetchJson(`https://${instance}/api/v1/trends/${kind}`, { signal: options.signal, timeoutMs: 15000 });
    },
    map(data: unknown): NormalizedItem[] {
      return asArray(data)
        .map((t) => {
          const tag = asRecord(t);
          const name = str(tag.name);
          const title = str(tag.title) || (name ? `#${name}` : "");
          if (!title) return null;
          const history = asArray(tag.history);
          const uses = num(tag.uses) ?? num(asRecord(history[0]).uses);
          return item(
            {
              id: str(tag.id) || title,
              title,
              url: str(tag.url) || undefined,
              text: uses !== undefined ? `${name ? `${name} · ` : ""}${uses} usos nos últimos 14 dias.` : undefined,
              score: uses,
              meta: { name: name || undefined, uses, accounts: num(tag.accounts), type: str(tag.type) || undefined },
            },
            "mastodon-trends",
            "trend-point",
          );
        })
        .filter((x): x is NormalizedItem => x !== null);
    },
  },
);

/* --------------------------------------------- google trends em alta ---- */
export const trending = defineAdapter(
  {
    id: "trending",
    label: "Google Trends Em alta",
    kind: "trend-point",
    description: "Tendências em alta do Google via RSS público (country = geo).",
    capabilities: ["trends", "news"],
    rateLimit: { rps: 1, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      const geo = /^[A-Z]{2}$/i.test(options.country?.trim() ?? "") ? (options.country as string).trim().toUpperCase() : "BR";
      return fetchText(`https://trends.google.com/trending/rss?geo=${geo}`, { signal: options.signal, timeoutMs: 15000 });
    },
    map(data: unknown, options: CollectOptions): NormalizedItem[] {
      return parseFeed(typeof data === "string" ? data : "", cap(options.limit ?? 25, 50)).map((e, i) =>
        item(
          {
            id: e.title,
            title: e.title,
            url: e.url,
            text: e.text,
            date: e.date,
            meta: { rank: i + 1, source: "trends.google.com/trending/rss" },
          },
          "trending",
          "trend-point",
        ),
      );
    },
  },
);

export const dataSources = {
  wikitop: () => wikitop,
  wikiviews: () => wikiviews,
  onthisday: () => onthisday,
  crypto: () => crypto,
  steamtop: () => steamtop,
  weather: () => weather,
  "brasilapi-feriados": () => brasilapiFeriados,
  "brasilapi-taxas": () => brasilapiTaxas,
  frankfurter: () => frankfurter,
  "ibge-nomes": () => ibgeNomes,
  "openlibrary-trending": () => openlibraryTrending,
  "github-trending": () => githubTrending,
  "mastodon-trends": () => mastodonTrends,
  trending: () => trending,
};
export type DataSourceId = keyof typeof dataSources;