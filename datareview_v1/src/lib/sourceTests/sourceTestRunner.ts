/**
 * Runner do teste de fontes (página /testes-fontes).
 *
 * Monta o catálogo de probes (fonte × variação) a partir dos fetchers
 * client-side existentes (uniApi, discoverApi, apple/google stores) —
 * NADA de duplicar chamadas: o teste reusa as mesmas funções que as
 * páginas usam, para que o resultado seja o que o sistema realmente
 * consegue coletar.
 *
 * Execução: worker pool com concorrência limitada (respeita rate-limits),
 * log ao vivo por probe (início/fim/erro/skip), resultados por probe e
 * agregados por fonte.
 */
import {
  fetchArxivPapers,
  fetchConnector,
  fetchGdeltNews,
  fetchGithubRepos,
  fetchHnStories,
  fetchProductHuntPosts,
  fetchReclameAquiCompanies,
  fetchRedditPosts,
  fetchSeQuestions,
  fetchSerp,
  fetchSteamGames,
  fetchSuggest,
  fetchTrends,
  fetchWikipediaSearch,
  fetchYoutubeVideos,
} from "@/lib/uni/uniApi";
import { fetchDiscover } from "@/lib/discover/discoverApi";
import type { UniItem } from "@/lib/uni/types";
import { logTestEvent } from "./sourceTestLog";
import type { ProbeResult, SourceTestResult, TestProbe } from "./sourceTestPlan";

const URL_RE = /^https?:\/\//i;

/** Extrai itens de um resultado. Se o resultado carrega erro da fonte
 *  (`{ok:false, error}`), LANÇA para o runProbe registrar a causa real —
 *  a página nunca mostra "0 itens (sem erro)" quando a fonte falhou. */
function toItems(r: unknown): UniItem[] {
  if (Array.isArray(r)) return r as UniItem[];
  const obj = r as { ok?: boolean; error?: string; items?: UniItem[]; results?: UniItem[]; suggestions?: UniItem[] };
  if (obj && obj.ok === false && obj.error) {
    throw new Error(obj.error);
  }
  return obj?.items ?? obj?.results ?? obj?.suggestions ?? [];
}

function probe(
  sourceId: string,
  variant: string,
  label: string,
  description: string,
  run: (term: string, limit: number, signal?: AbortSignal) => Promise<unknown[]>,
  needsInput?: "url" | "text",
): TestProbe {
  return { id: `${sourceId}:${variant}`, sourceId, label, description, run, needsInput };
}

/** Catálogo completo de probes (fonte × variação) — reusa os fetchers reais. */
export function buildTestPlan(): TestProbe[] {
  const out: TestProbe[] = [];
  const add = (p: TestProbe) => out.push(p);

  // Suggest × 4 verticais
  for (const v of ["web", "youtube", "news", "shopping"] as const) {
    add(probe("suggest", v, `vertical ${v}`, `Autocomplete Google ds=${v}`, (t, l, s) =>
      fetchSuggest(t, { vertical: v, limit: l }, s).then(toItems)));
  }
  // Trends (explore + trending)
  add(probe("trends", "explore", "explore (timeline+geo+related)", "Interesse 0–100 + regiões + queries", (t, l, s) =>
    fetchTrends([t], { topn: l }, s).then(toItems)));
  add(probe("trends", "trending", "trending BR 24h", "Trends 'Em alta' (volume/crescimento)", (_t, l, s) =>
    fetchTrends([], { topn: l }, s).then(toItems)));
  // SERP
  add(probe("serp", "multi", "multi-engine", "bing+ddg+brave+google", (t, l, s) =>
    fetchSerp(t, { limit: l }, s).then(toItems)));
  // YouTube
  add(probe("youtube", "videos", "busca de vídeos", "Scraping /results + oEmbed", (t, l, s) =>
    fetchYoutubeVideos(t, { limit: l }, s).then(toItems)));
  // Reddit
  add(probe("reddit", "posts", "posts por termo", "Search pública .json / OAuth", (t, l, s) =>
    fetchRedditPosts(t, { limit: l }, s).then(toItems)));
  // Product Hunt
  add(probe("producthunt", "feed", "feed do dia", "Atom público (topic=termo)", (t, l, s) =>
    fetchProductHuntPosts({ topic: t, limit: l }, s).then(toItems)));
  // Apple/Google stores
  add(probe("apple", "search", "busca iTunes", "search entity=software", (t, l) =>
    import("@/lib/appStoreApi").then((m) => m.searchApps(t, "br", l)) as unknown as Promise<unknown[]>));
  add(probe("google", "search", "busca Play", "google-play-scraper search", (t, l) =>
    fetchConnector("google" as never, t, l).then(toItems)));
  // Acadêmicas
  add(probe("arxiv", "search", "busca arXiv", "Atom search", (t, l, s) => fetchArxivPapers(t, "relevance", l, s).then(toItems)));
  add(probe("semanticscholar", "search", "busca S2", "Graph API", (t, l) => fetchConnector("semanticscholar" as never, t, l).then(toItems)));
  add(probe("stackexchange", "search", "perguntas SE", "search/advanced", (t, l, s) => fetchSeQuestions(t, "stackoverflow", "relevance", l, s).then(toItems)));
  // Dev/social
  add(probe("github", "repos", "repos por stars", "Search API", (t, l, s) => fetchGithubRepos(t, "stars", l, s).then(toItems)));
  add(probe("hackernews", "stories", "histórias HN", "Algolia search", (t, l, s) => fetchHnStories(t, "relevance", l, s).then(toItems)));
  add(probe("mastodon", "posts", "posts Mastodon", "relay público", (t, l) => fetchConnector("mastodon" as never, t, l).then(toItems)));
  add(probe("bluesky", "posts", "posts Bluesky", "relay público", (t, l) => fetchConnector("bluesky" as never, t, l).then(toItems)));
  add(probe("lobsters", "stories", "histórias Lobsters", "JSON público", (t, l) => fetchConnector("lobsters" as never, t, l).then(toItems)));
  add(probe("devto", "articles", "artigos DEV", "Forem API", (t, l) => fetchConnector("devto" as never, t, l).then(toItems)));
  // Conhecimento
  add(probe("wikipedia", "search", "busca Wikipedia", "REST search", (t, l, s) => fetchWikipediaSearch(t, "pt", l, s).then(toItems)));
  add(probe("wikidata", "search", "entidades Wikidata", "wbsearchentities", (t, l) => fetchConnector("wikidata" as never, t, l).then(toItems)));
  add(probe("openlibrary", "search", "livros", "search.json", (t, l) => fetchConnector("openlibrary" as never, t, l).then(toItems)));
  // Pacotes
  add(probe("npm", "search", "pacotes npm", "search + downloads", (t, l) => fetchConnector("npm" as never, t, l).then(toItems)));
  add(probe("pypi", "search", "pacotes PyPI", "nome exato", (t, l) => fetchConnector("pypi" as never, t, l).then(toItems)));
  add(probe("rubygems", "search", "gems", "API pública", (t, l) => fetchConnector("rubygems" as never, t, l).then(toItems)));
  add(probe("cratesio", "search", "crates", "API pública", (t, l) => fetchConnector("cratesio" as never, t, l).then(toItems)));
  add(probe("openalex", "search", "trabalhos OpenAlex", "API pública", (t, l) => fetchConnector("openalex" as never, t, l).then(toItems)));
  add(probe("crossref", "search", "DOIs Crossref", "metadados", (t, l) => fetchConnector("crossref" as never, t, l).then(toItems)));
  add(probe("doaj", "search", "periódicos OA", "API pública", (t, l) => fetchConnector("doaj" as never, t, l).then(toItems)));
  add(probe("openfoodfacts", "search", "produtos OFF", "search", (t, l) => fetchConnector("openfoodfacts" as never, t, l).then(toItems)));
  // Notícias/mídia
  add(probe("gdelt", "news", "notícias GDELT", "API pública", (t, l, s) => fetchGdeltNews(t, { limit: l }, s).then(toItems)));
  add(probe("steam", "games", "jogos Steam", "search scrape + appreviews", (t, l, s) => fetchSteamGames(t, l, s).then(toItems)));
  add(probe("itchio", "games", "jogos itch.io", "scrape HTML", (t, l) => fetchConnector("itchio" as never, t, l).then(toItems)));
  add(probe("tvmaze", "shows", "séries TVMaze", "API pública", (t, l) => fetchConnector("tvmaze" as never, t, l).then(toItems)));

  add(probe("archive", "items", "itens Internet Archive", "advancedsearch", (t, l) => fetchConnector("archive" as never, t, l).then(toItems)));
  // ReclameAqui (empresas brasileiras)
  add(probe("reclameaqui", "companies", "empresas ReclameAqui", "busca de empresas", (t, _l, s) =>
    fetchReclameAquiCompanies(t, s).then(toItems)));
  // Extratores (entrada dedicada)
  add(probe("web", "page", "página web", "extrator de texto", (t) => fetchConnector("web" as never, t, 1).then(toItems), "url"));
  add(probe("feed", "rss", "feed RSS/Atom", "parse de feed", (t) => fetchConnector("feed" as never, t, 1).then(toItems), "url"));
  add(probe("paste", "text", "texto colado", "parse manual", () => Promise.resolve([]), "text"));
  // Discover (momento/radar) — fontes sem termo obrigatório
  const DISCOVER = [
    "wikitop", "wikiviews", "onthisday", "podcasts", "crypto", "steamtop",
    "clima", "brasil", "music", "books", "packages", "github-trending",
    "mastodon-trends",
  ];
  for (const d of DISCOVER) {
    add(probe(`discover-${d}`, "now", "radar do momento", `Discover ${d}`, (t, l, s) =>
      fetchDiscover(d, { query: t, limit: l }, s).then((r) => {
        if (r.ok) return toItems(r.items);
        throw new Error(r.error ?? "Discover falhou");
      })));
  }
  // Social (testado ao vivo)
  add(probe("tiktok", "oembed", "oembed público", "oEmbed oficial (sem auth)", async (t) => {
    const url = URL_RE.test(t) ? t : `https://www.tiktok.com/@${t.replace(/^@/, "")}`;
    const resp = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
    const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
    return resp.ok && data?.author_name ? [data] : [];
  }));
  return out;
}

/** Coleta a união de chaves de um lote de itens (máx 200 itens inspecionados). */
export function collectFields(items: unknown[]): string[] {
  const fields = new Set<string>();
  for (const it of items.slice(0, 200)) {
    if (it && typeof it === "object") {
      for (const k of Object.keys(it as Record<string, unknown>)) fields.add(k);
    }
  }
  return [...fields].sort();
}

/** Executa UM probe com log ao vivo e resultado estruturado. */
export async function runProbe(
  p: TestProbe,
  term: string,
  limit: number,
  signal?: AbortSignal,
): Promise<ProbeResult> {
  const started = Date.now();
  // Skip honesto: entrada incompatível.
  if (p.needsInput === "url" && !URL_RE.test(term.trim())) {
    const r: ProbeResult = {
      id: p.id, sourceId: p.sourceId, label: p.label, status: "skipped",
      count: 0, fields: [], sample: [], items: [], skippedReason: "Precisa de uma URL (https://…)",
      durationMs: 0,
    };
    logTestEvent("warn", p.id, p.sourceId, p.label, `pulado: ${r.skippedReason}`, { status: "skipped" });
    return r;
  }
  if (p.needsInput === "text") {
    const r: ProbeResult = {
      id: p.id, sourceId: p.sourceId, label: p.label, status: "skipped",
      count: 0, fields: [], sample: [], items: [], skippedReason: "Precisa de texto colado (entrada manual)",
      durationMs: 0,
    };
    logTestEvent("warn", p.id, p.sourceId, p.label, `pulado: ${r.skippedReason}`, { status: "skipped" });
    return r;
  }
  logTestEvent("info", p.id, p.sourceId, p.label, `iniciando — ${p.description}`, { status: "running" });
  try {
    const items = await p.run(term, limit, signal);
    const fields = collectFields(items);
    const sample = items.slice(0, 3).map((it) => {
      const rec = it as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(rec).slice(0, 12)) {
        const v = rec[k];
        out[k] = typeof v === "string" ? v.slice(0, 160) : v;
      }
      return out;
    });
    const durationMs = Date.now() - started;
    logTestEvent(items.length ? "success" : "warn", p.id, p.sourceId, p.label,
      items.length ? `${items.length} itens · ${fields.length} campos · ${durationMs}ms`
        : `0 itens · ${durationMs}ms`,
      { status: items.length ? "done" : "error", count: items.length, fields, durationMs });
    return {
      id: p.id, sourceId: p.sourceId, label: p.label,
      status: items.length ? "done" : "error",
      count: items.length, fields, sample,
      items: items.slice(0, 200) as Record<string, unknown>[],
      durationMs,
      error: items.length ? undefined : "0 itens (sem erro — fonte vazia para o termo)",
    };
  } catch (e) {
    const durationMs = Date.now() - started;
    const msg = String((e as Error)?.message || e);
    logTestEvent("error", p.id, p.sourceId, p.label, `erro: ${msg}`, { status: "error", durationMs });
    return {
      id: p.id, sourceId: p.sourceId, label: p.label, status: "error",
      count: 0, fields: [], sample: [], items: [], error: msg, durationMs,
    };
  }
}

/** Executa o plano completo com worker pool (concorrência limitada). */
export async function runTestPlan(
  probes: TestProbe[],
  term: string,
  opts: { limit?: number; concurrency?: number; onSource?: (r: SourceTestResult) => void; signal?: AbortSignal } = {},
): Promise<SourceTestResult[]> {
  const limit = Math.max(1, Math.min(opts.limit ?? 25, 100));
  const concurrency = Math.max(1, Math.min(opts.concurrency ?? 4, 8));
  const results = new Map<string, ProbeResult[]>();
  let cursor = 0;

  async function worker() {
    while (cursor < probes.length) {
      if (opts.signal?.aborted) return;
      const p = probes[cursor++]!;
      const r = await runProbe(p, term, limit, opts.signal);
      const list = results.get(p.sourceId) ?? [];
      list.push(r);
      results.set(p.sourceId, list);
      if (opts.onSource) {
        opts.onSource(aggregate(p.sourceId, list));
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return [...results.entries()].map(([sourceId, list]) => aggregate(sourceId, list));
}

/** Executa o plano usando dados REAIS do snapshot demo (sem rede). */
export async function runDemoPlan(
  probes: TestProbe[],
  snapshot: { capturedAt: number; term: string; sources: Record<string, unknown[]> },
  opts: { limit?: number; onSource?: (r: SourceTestResult) => void } = {},
): Promise<SourceTestResult[]> {
  const results = new Map<string, ProbeResult[]>();
  logTestEvent("info", "run", "demo", "modo demo", `snapshot de ${new Date(snapshot.capturedAt).toLocaleString("pt-BR")} · termo "${snapshot.term}"`, { status: "running" });
  for (const p of probes) {
    const items = (snapshot.sources[p.sourceId] ?? []).slice(0, Math.max(1, opts.limit ?? 25));
    const fields = collectFields(items);
    const sample = items.slice(0, 3).map((it) => {
      const rec = it as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(rec).slice(0, 12)) {
        const v = rec[k];
        out[k] = typeof v === "string" ? v.slice(0, 160) : v;
      }
      return out;
    });
    const has = items.length > 0;
    const r: ProbeResult = {
      id: p.id, sourceId: p.sourceId, label: p.label,
      status: has ? "done" : "error",
      count: items.length, fields, sample,
      items: items.slice(0, 200) as Record<string, unknown>[],
      durationMs: 0,
      error: has ? undefined : "0 itens no snapshot demo (fonte não capturada)",
    };
    logTestEvent(has ? "success" : "warn", p.id, p.sourceId, p.label,
      has ? `demo: ${items.length} itens · ${fields.length} campos` : "demo: 0 itens",
      { status: r.status, count: items.length, fields });
    const list = results.get(p.sourceId) ?? [];
    list.push(r);
    results.set(p.sourceId, list);
    if (opts.onSource) opts.onSource(aggregate(p.sourceId, list));
  }
  logTestEvent("success", "run", "demo", "demo completo", `${results.size} fontes processadas`, { status: "done" });
  return [...results.entries()].map(([sourceId, list]) => aggregate(sourceId, list));
}

/** Agrega probes por fonte. */
export function aggregate(sourceId: string, probes: ProbeResult[]): SourceTestResult {
  const allFields = [...new Set(probes.flatMap((p) => p.fields))].sort();
  return {
    sourceId,
    probes,
    allFields,
    totalItems: probes.reduce((n, p) => n + p.count, 0),
    durationMs: probes.reduce((n, p) => n + p.durationMs, 0),
  };
}
