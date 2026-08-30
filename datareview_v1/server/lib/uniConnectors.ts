/**
 * Motor declarativo de conectores de fontes JSON (página /00 Uni).
 * Cada fonte é uma entrada de configuração (buildUrl + listPath + mapItem) —
 * adicionar fonte nova = adicionar UMA entrada aqui, sem rota nova.
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

export interface UniConnector {
  id: string;
  label: string;
  /** Tipo do item produzido (UniItemKind do cliente). */
  kind: string;
  /** Descrição curta exibida na UI. */
  description: string;
  /** true = a query é um identificador exato (ex.: nome de pacote), não busca. */
  lookup?: boolean;
  buildUrl: (query: string, limit: number) => string;
  /** Caminho dot-separated até o array de itens (vazio = resposta já é array). */
  listPath?: string;
  mapItem: (item: any) => RawConnectorItem | null;
  /** Autenticação opcional (fontes custom com chave — Onda 4.3). O valor vem
   *  do body da requisição e nunca é persistido no servidor. */
  auth?: { type: "header" | "query" | "bearer"; key: string; value: string };
}

export function getByPath(obj: any, path?: string): any {
  if (!path) return obj;
  return path.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

export const UNI_CONNECTORS: UniConnector[] = [
  {
    id: "itchio",
    label: "itch.io",
    kind: "game",
    description: "Jogos indie com título e link (busca textual da itch.io).",
    buildUrl: (q) => "https://itch.io/search?q=" + encodeURIComponent(q),
    listPath: "",
    mapItem: (g) => g && g.title ? { title: g.title, url: g.url, score: g.rating ? Number(g.rating) : 0, meta: { kind: "game" } } : null,
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
    description: "Discussões tech de nicho por tag com score e comentários (a busca textual exige login — usamos a timeline da tag).",
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
    buildUrl: (q, limit) => `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=${limit}&fields=key,title,author_name,first_publish_year,ratings_average,ratings_count,number_of_pages_median,subject,edition_count,ebook_access,has_fulltext,cover_i,language`,
    listPath: "docs",
    mapItem: (b) => ({
      title: b.title ?? "",
      text: (b.subject ?? []).slice(0, 8).join(", "),
      url: b.key ? `https://openlibrary.org${b.key}` : undefined,
      author: (b.author_name ?? []).slice(0, 3).join(", "),
      date: b.first_publish_year ? String(b.first_publish_year) : undefined,
      score: b.ratings_average ? Math.round(b.ratings_average * 10) / 10 : undefined,
      meta: {
        ratings: String(b.ratings_count ?? 0),
        pages: String(b.number_of_pages_median ?? ""),
        year: String(b.first_publish_year ?? ""),
        editions: String(b.edition_count ?? ""),
        ebook: b.ebook_access ? String(b.ebook_access).replace("unencrypted", "livre") : "",
        fullText: b.has_fulltext === true ? "sim" : "não",
        cover: b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-S.jpg` : "",
        languages: (b.language ?? []).slice(0, 4).join(", "),
      },
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
        meta: {
          version: p.version ?? "",
          keywords: (p.keywords ?? []).slice(0, 6).join(", "),
          license: p.license ?? "",
          maintainers: String((p.maintainers ?? []).length || 1),
          repository: p.links?.repository ?? "",
          homepage: p.links?.homepage ?? "",
        },
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
        meta: {
          version: i.version ?? "",
          license: i.license ? String(i.license).slice(0, 40) : "",
          requiresPython: i.requires_python ?? "",
          keywords: i.keywords ?? "",
          classifiers: (i.classifiers ?? []).slice(0, 6).join("; "),
          projectUrls: Object.entries(i.project_urls ?? {}).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(" | "),
          packageUrl: i.package_url ?? "",
        },
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
      meta: { version: g.version ?? "", downloads: String(g.downloads ?? 0), gemUri: g.gem_uri ?? "", homepage: g.homepage_uri ?? "", docs: g.documentation_uri ?? "", source: g.source_code_uri ?? "" },
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
      meta: { version: c.newest_version ?? "", downloads: String(c.downloads ?? 0), repository: c.repository ?? "", keywords: (c.keywords ?? []).slice(0, 6).join(", "), categories: (c.categories ?? []).slice(0, 4).join(", "), homepage: c.homepage ?? "", documentation: c.documentation ?? "" },
    }),
  },
  {
    id: "doaj",
    label: "DOAJ",
    kind: "paper",
    description: "Artigos de periódicos open access (Directory of Open Access Journals).",
    buildUrl: (q, limit) => `https://doaj.org/api/search/articles/${encodeURIComponent(q)}?pageSize=${Math.min(limit, 50)}`,
    listPath: "results",
    mapItem: (r) => {
      const b = r.bibjson;
      if (!b) return null;
      const link = (b.link ?? []).find((l: any) => l?.url)?.url;
      return {
        title: b.title ?? "",
        text: b.journal?.title ?? "",
        url: link,
        author: (b.author ?? []).slice(0, 3).map((a: any) => a?.name).filter(Boolean).join(", "),
        date: b.year ? String(b.year) : undefined,
        meta: { journal: b.journal?.title ?? "", year: String(b.year ?? ""), doi: (b.identifier ?? []).find((i: any) => i?.type === "doi")?.id ?? "" },
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
    mapItem: (p) => {
      if (!p.product_name) return null;
      return {
        title: p.product_name,
        text: (p.categories ?? "").split(",").slice(0, 4).join(","),
        url: p.code ? `https://world.openfoodfacts.org/product/${p.code}` : undefined,
        author: p.brands,
        meta: { brands: p.brands ?? "", nutriScore: (p.nutriscore_grade ?? "").toUpperCase(), barcode: p.code ?? "", categories: (p.categories ?? "").split(",").slice(0, 6).join(", ") },
      };
    },
  },
  {
    id: "archive",
    label: "Internet Archive",
    kind: "document",
    description: "Mídia/livros/web arquivados com criador, ano e downloads.",
    buildUrl: (q, limit) =>
      `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=creator&fl%5B%5D=year&fl%5B%5D=mediatype&fl%5B%5D=downloads&fl%5B%5D=description&fl%5B%5D=subject&fl%5B%5D=collection&rows=${Math.min(limit, 50)}&output=json`,
    listPath: "response.docs",
    mapItem: (d) => ({
      title: Array.isArray(d.title) ? d.title[0] : d.title ?? "",
      text: String(Array.isArray(d.description) ? d.description[0] : d.description ?? "").slice(0, 2000) || (d.mediatype ? `Tipo: ${d.mediatype}` : ""),
      url: d.identifier ? `https://archive.org/details/${d.identifier}` : undefined,
      author: Array.isArray(d.creator) ? d.creator[0] : d.creator,
      date: d.year ? String(d.year) : undefined,
      score: d.downloads,
      meta: {
        mediatype: d.mediatype ?? "",
        downloads: String(d.downloads ?? 0),
        identifier: d.identifier ?? "",
        subject: (Array.isArray(d.subject) ? d.subject.slice(0, 8) : d.subject ? [d.subject] : []).join(", "),
        collection: (Array.isArray(d.collection) ? d.collection.slice(0, 4) : d.collection ? [d.collection] : []).join(", "),
      },
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
        meta: { genres: (s.genres ?? []).join(", "), status: s.status ?? "", network: s.network?.name ?? s.webChannel?.name ?? "", runtime: s.runtime ? `${s.runtime} min` : "", officialSite: s.officialSite ?? "" },
      };
    },
  },
];

const BY_ID = new Map(UNI_CONNECTORS.map((c) => [c.id, c]));

export function getConnector(id: string): UniConnector | undefined {
  return BY_ID.get(id);
}

/** Extrai e mapeia itens de uma resposta JSON seguindo o conector. */
export function mapConnectorItems(connector: UniConnector, payload: any, limit: number): RawConnectorItem[] {
  const list = connector.listPath ? getByPath(payload, connector.listPath) : payload;
  if (!Array.isArray(list)) {
    // Lookup de objeto único (ex.: PyPI)
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
