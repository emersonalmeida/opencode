/**
 * Registry declarativo de fontes — a padrão "nova fonte = 1 entrada".
 *
 * Cada fonte declara buildUrl + listPath + mapItem. Adicionar uma fonte nova
 * NUNCA exige rota nova nem mudança no núcleo. Portado do projeto original
 * (server/lib/uniConnectors.ts) e estendido com fontes que lá tinham rotas
 * dedicadas (hackernews/wikipedia/github/suggest/apple) — aqui elas viram
 * entradas uniformes como todas as demais.
 *
 * Todas as fontes abaixo são APIs públicas sem autenticação.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
// Fronteira de JSON de APIs públicas heterogêneas — normalizado no mapItem.

export interface RawConnectorItem {
  title: string;
  text?: string;
  url?: string;
  author?: string;
  date?: string;
  score?: number;
  meta?: Record<string, string>;
}

export interface SourceConnector {
  id: string;
  label: string;
  /** Tipo do item produzido (post/article/question/video/package/…). */
  kind: string;
  /** Descrição curta exibida na UI. */
  description: string;
  /** true = a query é um identificador exato (ex.: nome de pacote). */
  lookup?: boolean;
  buildUrl: (query: string, limit: number) => string;
  /** Caminho dot-separated até o array de itens (vazio = resposta já é array). */
  listPath?: string;
  mapItem: (item: any) => RawConnectorItem | null;
}

export function getByPath(obj: any, path?: string): any {
  if (!path) return obj;
  return path.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

export const CONNECTORS: SourceConnector[] = [
  /* ---- portadas do projeto original (uniConnectors.ts) ----------------- */
  {
    id: "itchio",
    label: "itch.io",
    kind: "game",
    description: "Jogos indie com título e link (busca textual da itch.io).",
    buildUrl: (q) => "https://itch.io/search?q=" + encodeURIComponent(q),
    listPath: "",
    mapItem: (g) => (g && g.title ? { title: g.title, url: g.url, score: g.rating ? Number(g.rating) : 0, meta: { kind: "game" } } : null),
  },
  {
    id: "devto",
    label: "DEV Community",
    kind: "article",
    description: "Artigos dev por tag/termo com reações e comentários.",
    buildUrl: (q, limit) =>
      `https://dev.to/api/articles?tag=${encodeURIComponent(q.toLowerCase().replace(/\s+/g, ""))}&per_page=${limit}`,
    mapItem: (a) => ({
      title: a.title ?? "",
      text: a.description ?? "",
      url: a.url,
      author: a.user?.name,
      date: a.published_at,
      score: a.positive_reactions_count,
      meta: { comments: String(a.comments_count ?? 0), tags: (a.tag_list ?? []).join(", "), readingTime: `${a.reading_time_minutes ?? 0} min` },
    }),
  },
  {
    id: "lobsters",
    label: "Lobsters",
    kind: "post",
    description: "Discussões tech de nicho por tag com score e comentários.",
    buildUrl: (q) => `https://lobste.rs/t/${encodeURIComponent(q.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}.json`,
    mapItem: (s) => ({
      title: s.title ?? "",
      text: s.description ?? "",
      url: s.short_id_url ?? s.url,
      author: s.submitter_user?.username,
      date: s.created_at,
      score: s.score,
      meta: { comments: String(s.comment_count ?? 0), tags: (s.tags ?? []).join(", ") },
    }),
  },
  {
    id: "mastodon",
    label: "Mastodon",
    kind: "post",
    description: "Posts públicos por hashtag (instância mastodon.social).",
    buildUrl: (q, limit) =>
      `https://mastodon.social/api/v1/timelines/tag/${encodeURIComponent(q.toLowerCase().replace(/[^\p{L}\p{N}_]/gu, ""))}?limit=${Math.min(limit, 40)}`,
    mapItem: (p) => ({
      title: (p.account?.display_name || p.account?.acct || "post").slice(0, 120),
      text: (p.content ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      url: p.url,
      author: p.account?.acct,
      date: p.created_at,
      score: (p.favourites_count ?? 0) + (p.reblogs_count ?? 0),
      meta: { favourites: String(p.favourites_count ?? 0), boosts: String(p.reblogs_count ?? 0), replies: String(p.replies_count ?? 0), lang: p.language ?? "" },
    }),
  },
  {
    id: "bluesky",
    label: "Bluesky",
    kind: "post",
    description: "Busca de posts públicos (AT Protocol, leitura sem auth).",
    buildUrl: (q, limit) => `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(q)}&limit=${Math.min(limit, 50)}`,
    listPath: "posts",
    mapItem: (p) => ({
      title: (p.author?.displayName || p.author?.handle || "post").slice(0, 120),
      text: p.record?.text ?? "",
      url: p.author?.handle && p.uri ? `https://bsky.app/profile/${p.author.handle}/post/${String(p.uri).split("/").pop()}` : undefined,
      author: p.author?.handle,
      date: p.indexedAt,
      score: (p.likeCount ?? 0) + (p.repostCount ?? 0),
      meta: { likes: String(p.likeCount ?? 0), reposts: String(p.repostCount ?? 0), replies: String(p.replyCount ?? 0) },
    }),
  },
  {
    id: "wikidata",
    label: "Wikidata",
    kind: "article",
    description: "Entidades estruturadas (empresas, apps, conceitos) com descrição.",
    buildUrl: (q, limit) =>
      `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(q)}&language=pt&uselang=pt&format=json&limit=${limit}`,
    listPath: "search",
    mapItem: (e) => ({
      title: e.label ?? e.id,
      text: e.description ?? "",
      url: e.concepturi,
      meta: { entityId: e.id, aliases: (e.aliases ?? []).map((a: any) => a.value).join(", ") },
    }),
  },
  {
    id: "openalex",
    label: "OpenAlex",
    kind: "paper",
    description: "250M de papers: citações, conceitos, acesso aberto.",
    buildUrl: (q, limit) => `https://api.openalex.org/works?search=${encodeURIComponent(q)}&per-page=${Math.min(limit, 50)}`,
    listPath: "results",
    mapItem: (w) => ({
      title: w.display_name ?? "",
      text: w.primary_location?.source?.display_name ?? "",
      url: w.doi ?? w.id,
      author: (w.authorships ?? []).slice(0, 3).map((a: any) => a.author?.display_name).filter(Boolean).join(", "),
      date: w.publication_date,
      score: w.cited_by_count,
      meta: { citations: String(w.cited_by_count ?? 0), openAccess: w.open_access?.is_oa ? "sim" : "não", type: w.type ?? "" },
    }),
  },
  {
    id: "crossref",
    label: "Crossref",
    kind: "paper",
    description: "Metadados DOI: publicações científicas com citações.",
    buildUrl: (q, limit) => `https://api.crossref.org/works?query=${encodeURIComponent(q)}&rows=${Math.min(limit, 50)}`,
    listPath: "message.items",
    mapItem: (w) => ({
      title: (w.title ?? [])[0] ?? "",
      text: (w["container-title"] ?? [])[0] ?? "",
      url: w.DOI ? `https://doi.org/${w.DOI}` : undefined,
      author: (w.author ?? []).slice(0, 3).map((a: any) => [a.given, a.family].filter(Boolean).join(" ")).filter(Boolean).join(", "),
      date: w.published?.["date-parts"]?.[0]?.join("-"),
      score: w["is-referenced-by-count"],
      meta: { citations: String(w["is-referenced-by-count"] ?? 0), doi: w.DOI ?? "", publisher: w.publisher ?? "" },
    }),
  },
  {
    id: "openlibrary",
    label: "Open Library",
    kind: "book",
    description: "Livros com autores, ano, notas e edições.",
    buildUrl: (q, limit) => `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=${limit}`,
    listPath: "docs",
    mapItem: (b) => ({
      title: b.title ?? "",
      text: (b.subject ?? []).slice(0, 8).join(", "),
      url: b.key ? `https://openlibrary.org${b.key}` : undefined,
      author: (b.author_name ?? []).slice(0, 3).join(", "),
      date: b.first_publish_year ? String(b.first_publish_year) : undefined,
      score: b.ratings_average ? Math.round(b.ratings_average * 10) / 10 : undefined,
      meta: { ratings: String(b.ratings_count ?? 0), year: String(b.first_publish_year ?? ""), editions: String(b.edition_count ?? "") },
    }),
  },
  {
    id: "npm",
    label: "npm",
    kind: "package",
    description: "Pacotes JavaScript com descrição e links.",
    buildUrl: (q, limit) => `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(q)}&size=${Math.min(limit, 50)}`,
    listPath: "objects",
    mapItem: (o) => {
      const p = o.package;
      if (!p) return null;
      return {
        title: p.name ?? "",
        text: p.description ?? "",
        url: p.links?.npm,
        author: p.publisher?.username,
        date: p.date,
        score: o.score?.final ? Math.round(o.score.final * 100) / 100 : undefined,
        meta: { version: p.version ?? "", keywords: (p.keywords ?? []).slice(0, 6).join(", "), license: p.license ?? "" },
      };
    },
  },
  {
    id: "pypi",
    label: "PyPI",
    kind: "package",
    description: "Pacote Python por nome exato (lookup; PyPI não tem busca JSON).",
    lookup: true,
    buildUrl: (q) => `https://pypi.org/pypi/${encodeURIComponent(q.trim().toLowerCase())}/json`,
    mapItem: (d) => {
      const i = d.info;
      if (!i) return null;
      return {
        title: i.name ?? "",
        text: (i.summary || i.description || "").slice(0, 2000),
        url: i.project_url ?? (i.name ? `https://pypi.org/project/${i.name}/` : undefined),
        author: i.author || i.maintainer,
        meta: { version: i.version ?? "", requiresPython: i.requires_python ?? "" },
      };
    },
  },
  {
    id: "rubygems",
    label: "RubyGems",
    kind: "package",
    description: "Gems Ruby com descrição, versão e downloads totais.",
    buildUrl: (q) => `https://rubygems.org/api/v1/search.json?query=${encodeURIComponent(q)}`,
    mapItem: (g) => ({
      title: g.name ?? "",
      text: g.info ?? "",
      url: g.project_uri ?? (g.name ? `https://rubygems.org/gems/${g.name}` : undefined),
      score: g.downloads,
      meta: { version: g.version ?? "", downloads: String(g.downloads ?? 0) },
    }),
  },
  {
    id: "cratesio",
    label: "Crates.io",
    kind: "package",
    description: "Crates Rust com descrição, downloads e repositório.",
    buildUrl: (q, limit) => `https://crates.io/api/v1/crates?q=${encodeURIComponent(q)}&per_page=${Math.min(limit, 50)}`,
    listPath: "crates",
    mapItem: (c) => ({
      title: c.name ?? "",
      text: c.description ?? "",
      url: c.name ? `https://crates.io/crates/${c.name}` : undefined,
      date: c.updated_at,
      score: c.downloads,
      meta: { version: c.newest_version ?? "", downloads: String(c.downloads ?? 0) },
    }),
  },
  {
    id: "doaj",
    label: "DOAJ",
    kind: "paper",
    description: "Artigos de periódicos open access.",
    buildUrl: (q, limit) => `https://doaj.org/api/search/articles/${encodeURIComponent(q)}?pageSize=${Math.min(limit, 50)}`,
    listPath: "results",
    mapItem: (r) => {
      const b = r.bibjson;
      if (!b) return null;
      return {
        title: b.title ?? "",
        text: b.journal?.title ?? "",
        author: (b.author ?? []).slice(0, 3).map((a: any) => a?.name).filter(Boolean).join(", "),
        date: b.year ? String(b.year) : undefined,
        meta: { journal: b.journal?.title ?? "", year: String(b.year ?? "") },
      };
    },
  },
  {
    id: "openfoodfacts",
    label: "Open Food Facts",
    kind: "document",
    description: "Produtos alimentícios com marca, categorias e nutri-score.",
    buildUrl: (q, limit) => `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&json=1&page_size=${Math.min(limit, 50)}`,
    listPath: "products",
    mapItem: (p) =>
      p.product_name
        ? { title: p.product_name, text: (p.categories ?? "").split(",").slice(0, 4).join(","), author: p.brands, meta: { nutriScore: (p.nutriscore_grade ?? "").toUpperCase(), barcode: p.code ?? "" } }
        : null,
  },
  {
    id: "archive",
    label: "Internet Archive",
    kind: "document",
    description: "Mídia/livros/web arquivados com criador, ano e downloads.",
    buildUrl: (q, limit) =>
      `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=creator&fl%5B%5D=year&fl%5B%5D=mediatype&fl%5B%5D=downloads&rows=${Math.min(limit, 50)}&output=json`,
    listPath: "response.docs",
    mapItem: (d) => ({
      title: Array.isArray(d.title) ? d.title[0] : d.title ?? "",
      url: d.identifier ? `https://archive.org/details/${d.identifier}` : undefined,
      author: Array.isArray(d.creator) ? d.creator[0] : d.creator,
      date: d.year ? String(d.year) : undefined,
      score: d.downloads,
      meta: { mediatype: d.mediatype ?? "", downloads: String(d.downloads ?? 0) },
    }),
  },
  {
    id: "tvmaze",
    label: "TVMaze",
    kind: "video",
    description: "Séries de TV com nota, gêneros e sinopse.",
    buildUrl: (q) => `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`,
    mapItem: (r) => {
      const s = r.show;
      if (!s) return null;
      return {
        title: s.name ?? "",
        text: (s.summary ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500),
        url: s.url,
        date: s.premiered,
        score: s.rating?.average,
        meta: { genres: (s.genres ?? []).join(", "), status: s.status ?? "" },
      };
    },
  },

  /* ---- NOVAS entradas uniformes (eram rotas dedicadas no projeto original) */
  {
    id: "suggest",
    label: "Google Suggest",
    kind: "suggestion",
    description: "Termos de autocomplete do Google (mercado de intenção).",
    buildUrl: (q) =>
      `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(q)}&hl=pt`,
    mapItem: (payload) => {
      // Resposta: [query, [sugestões], [descrições], [urls]]
      const suggestions: string[] = Array.isArray(payload?.[1]) ? payload[1] : [];
      return suggestions.length
        ? { title: suggestions.slice(0, 12).join(" · "), text: `Sugestões: ${suggestions.length}`, meta: { terms: suggestions.slice(0, 12).join(", ") } }
        : null;
    },
  },
  {
    id: "hackernews",
    label: "Hacker News",
    kind: "post",
    description: "Histórias tech com pontos e comentários (Algolia API).",
    buildUrl: (q, limit) =>
      `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&hitsPerPage=${Math.min(limit, 30)}&tags=story`,
    listPath: "hits",
    mapItem: (h) => ({
      title: h.title ?? "",
      url: h.url ?? (h.objectID ? `https://news.ycombinator.com/item?id=${h.objectID}` : undefined),
      author: h.author,
      date: h.created_at,
      score: h.points ?? 0,
      meta: { comments: String(h.num_comments ?? 0), hnId: String(h.objectID ?? "") },
    }),
  },
  {
    id: "wikipedia",
    label: "Wikipedia",
    kind: "article",
    description: "Artigos/sumários enciclopédicos (REST API).",
    buildUrl: (q, limit) =>
      `https://pt.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(q)}&limit=${Math.min(limit, 20)}`,
    listPath: "pages",
    mapItem: (p) => {
      const ex = p.excerpt ? String(p.excerpt).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
      return {
        title: p.title ?? "",
        text: ex || undefined,
        url: p.key ? `https://pt.wikipedia.org/wiki/${p.key}` : undefined,
        meta: { pageId: String(p.id ?? ""), thumbnail: p.thumbnail?.url ?? "" },
      };
    },
  },
  {
    id: "github",
    label: "GitHub",
    kind: "package",
    description: "Repositórios públicos com stars, forks e linguagem (Search API).",
    buildUrl: (q, limit) =>
      `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&per_page=${Math.min(limit, 30)}`,
    listPath: "items",
    mapItem: (r) => ({
      title: r.full_name ?? "",
      text: r.description ?? "",
      url: r.html_url,
      author: r.owner?.login,
      score: r.stargazers_count,
      meta: { stars: String(r.stargazers_count ?? 0), forks: String(r.forks_count ?? 0), language: r.language ?? "", updated: r.updated_at ?? "", issues: String(r.open_issues_count ?? 0) },
    }),
  },
  {
    id: "apple-search",
    label: "Apple App Store",
    kind: "app",
    description: "Apps da App Store por lookup na API iTunes.",
    buildUrl: (q, limit) =>
      `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=software&limit=${Math.min(limit, 20)}&country=BR&lang=pt_br`,
    listPath: "results",
    mapItem: (a) => ({
      title: a.trackName ?? "",
      text: (a.description ?? "").slice(0, 500),
      url: a.trackViewUrl,
      author: a.sellerName ?? a.artistName,
      score: a.averageUserRating ?? undefined,
      meta: { appId: String(a.trackId ?? ""), version: a.version ?? "", ratingCount: String(a.userRatingCount ?? 0) },
    }),
  },
];

const BY_ID = new Map(CONNECTORS.map((c) => [c.id, c]));

export function getConnector(id: string): SourceConnector | undefined {
  return BY_ID.get(id);
}

/** Extrai e mapeia itens de uma resposta seguindo o conector (JSON ou que já é objeto). */
export function mapConnectorItems(connector: SourceConnector, payload: any, limit: number): RawConnectorItem[] {
  const list = connector.listPath ? getByPath(payload, connector.listPath) : payload;
  if (!Array.isArray(list)) {
    // Lookup de objeto único (ex.: PyPI) ou payload composto (ex.: Suggest)
    const single = connector.mapItem(payload);
    return single ? [single] : [];
  }
  const out: RawConnectorItem[] = [];
  for (const item of list) {
    if (out.length >= limit) break;
    const mapped = connector.mapItem(item);
    if (mapped && mapped.title) out.push(mapped);
  }
  return out;
}
