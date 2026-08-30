/**
 * sourceFields — MAPEAMENTO MAXIMALISTA por fonte: tudo o que cada fonte
 * oferece (dados diretos, metadados preservados em `meta`, recursos indiretos
 * como comentários/expansões, e limites honestos de rate-limit/volume).
 *
 * O catálogo é HONESTO: só lista o que os fetchers realmente extraem hoje
 * (src/lib/uni/uniApi.ts + server/lib/uniConnectors.ts). Lib pura/testável —
 * alimenta o bloco "O que esta fonte oferece" da Uni.
 */

export interface SourceFields {
  /** Campos do UniItem preenchidos (modelo comum). */
  dataFields: string[];
  /** Chaves de `meta` preservadas (dados além do modelo comum). */
  metaFields: string[];
  /** Recursos diretos e indiretos (modos, visões, dados derivados). */
  resources: string[];
  /** Limites honestos (volume máximo, rate-limit). */
  limits: string;
}

import type { UniSourceId } from "./types";

export const SOURCE_FIELDS: Record<UniSourceId, SourceFields> = {
  itchio: {
    dataFields: ["título", "link (url do jogo)", "score (nota média)"],
    metaFields: ["source (kind = game)"],
    resources: ["busca HTML pública (search?q=)"],
    limits: "Scrape da página de busca; sem API oficial.",
  },
  suggest: {
    dataFields: ["title", "text (sugestão)", "score (relevância)", "vertical"],
    metaFields: ["vertical", "seed (termo de expansão)", "query"],
    resources: [
      "4 verticais: Web, YouTube, News, Shopping (multi-selecionáveis)",
      "Modo suggest (10 por consulta) + expand alfabética a–Z (até 200, 27 seeds)",
      "Merge multi-vertical com dedup por texto (maior relevância vence)",
    ],
    limits: "Google Suggest público; ~50 por vertical+seed.",
  },
  trends: {
    dataFields: ["title (query/região)", "score (0–100)", "date (timeline)"],
    metaFields: ["kind (top|rising)", "values por termo", "terms"],
    resources: [
      "3 visões: interesse ao longo do tempo, interesse por região, queries relacionadas (top + rising)",
      "5 períodos × 5 verticais (web/news/images/youtube/shopping) combináveis (teto 12 combos)",
      "Até 5 termos comparados por execução",
    ],
    limits: "Rate-limit por IP (429); retries com backoff; até 25 regiões/queries por visão.",
  },
  serp: {
    dataFields: ["title", "text (snippet)", "url", "engine"],
    metaFields: ["engine (google/bing/duck)", "rank", "query"],
    resources: ["Busca web multi-engine via Serper", "Ranking posicional (rank → score 100-rank)"],
    limits: "Depende da chave SERPER_API_KEY no servidor.",
  },
  youtube: {
    dataFields: ["title", "text (canal/descrição)", "url", "author", "date", "score (likes)"],
    metaFields: ["videoId", "views", "duration", "thumb", "query"],
    resources: [
      "Vídeos (busca com views/duração/thumb)",
      "Comentários sob demanda (expand no card)",
      "Metadados: visualizações, duração, canal",
    ],
    limits: "Endpoints públicos do YouTube; comentários paginados por item.",
  },
  reddit: {
    dataFields: ["title", "text (selftext)", "url", "author", "date", "score (upvotes)"],
    metaFields: ["subreddit", "numComments", "upvoteRatio", "link", "postId"],
    resources: [
      "Posts por subreddit/busca com upvote ratio",
      "Comentários sob demanda por post",
      "Metadados: nº de comentários, subreddit",
    ],
    limits: "API pública do Reddit; comentários paginados por item.",
  },
  wikipedia: {
    dataFields: ["title", "text (snippet/artigo)", "url", "date (timestamp)"],
    metaFields: ["pageid", "lang", "full (artigo completo)"],
    resources: [
      "Busca + artigo completo sob demanda",
      "40+ idiomas (pt/en/es/de/fr/…)",
      "pageid estável (link curid)",
    ],
    limits: "MediaWiki API pública; busca com snippet.",
  },
  hackernews: {
    dataFields: ["title", "text", "url", "author", "date", "score (points)"],
    metaFields: ["hnId", "numComments", "storyId"],
    resources: ["Stories (top/new/best/ask/show/job)", "Comentários sob demanda por story"],
    limits: "Algolia HN API pública.",
  },
  gdelt: {
    dataFields: ["title", "url", "date (seenDate)"],
    metaFields: ["domain", "language", "sourceCountry"],
    resources: [
      "Notícias globais em tempo real",
      "Ordenação data|relevância; idioma via sourcelang:",
      "Janela de datas (startDate/endDate)",
    ],
    limits: "1 requisição a cada 5s por IP; 250 artigos por consulta; cache 10min.",
  },
  arxiv: {
    dataFields: ["title", "text (resumo)", "url", "author", "date"],
    metaFields: ["pdf", "categories", "updated"],
    resources: ["Papers com resumo, autores, categorias", "Ordenação relevância|data"],
    limits: "arXiv Atom API pública.",
  },
  stackexchange: {
    dataFields: ["title", "text (body)", "url", "author", "date", "score (votes)"],
    metaFields: ["questionId", "site", "answerCount", "viewCount", "isAnswered", "tags", "isAccepted"],
    resources: [
      "7 sites (stackoverflow, pt.SO, superuser, serverfault, askubuntu…)",
      "Respostas sob demanda por pergunta (com isAccepted)",
      "Metadados: respostas, visualizações, tags",
    ],
    limits: "StackExchange API pública (quota diária por IP).",
  },
  github: {
    dataFields: ["title", "text (descrição)", "url", "author", "date", "score (stars/comments)"],
    metaFields: ["forks", "openIssues", "language", "topics", "state", "repo", "labels", "comments"],
    resources: ["Repos (stars/forks/issues/topics)", "Issues (estado, labels, comentários)"],
    limits: "Search API; usa GITHUB_TOKEN quando presente (rate-limit informado com horário de reset).",
  },
  semanticscholar: {
    dataFields: ["title", "text (abstract)", "url", "author", "date", "score (citações)"],
    metaFields: ["year", "citations"],
    resources: ["Papers com citações e ano", "Ordenação relevância|citações|data"],
    limits: "429 frequente — backoff exponencial com jitter (5 tentativas).",
  },
  steam: {
    dataFields: ["title", "text (review)", "author", "date", "score (votes up)"],
    metaFields: ["appId", "language", "recommended", "playtimeHours"],
    resources: ["Jogos (busca por nome)", "Reviews públicos por jogo (idioma, votos, playtime)"],
    limits: "Scrape do search + appreviews público; reviews paginados.",
  },
  reclameaqui: {
    dataFields: ["title", "text (relato)", "author (cidade/UF)", "date", "score (avaliação final)"],
    metaFields: ["complaintId", "status", "statusRaw", "solved", "evaluated", "dealAgain", "city", "state", "companyId", "shortname"],
    resources: [
      "Empresas por nome (companies/search)",
      "Reclamações por empresa (query/companyComplains, com total)",
      "Busca livre de reclamações por termo (query/{termo})",
      "Status derivado como o web client: Réplica / Resolvido / Não resolvido / Respondido / Não respondido",
    ],
    limits: "Protegido por Cloudflare — bypass via curl_cffi e, com IP marcado, via navegador real (Playwright). Erro honesto orienta a instalação.",
  },
  producthunt: {
    dataFields: ["title (nome do produto)", "text (tagline)", "url", "date", "score (votos, via GraphQL)"],
    metaFields: ["rank", "via (feed|graphql)", "topic", "votesCount", "commentsCount", "topics"],
    resources: [
      "Lançamentos do dia (feed Atom público, sem auth)",
      "Feed por tópico/categoria (?category=<slug>)",
      "GraphQL oficial v2 com token: votos, comentários, tópicos, paginação por cursor",
      "Ranking = ordem do feed (PH não publica posição; o feed segue o ranking do dia)",
    ],
    limits: "Feed sem votos/comentários (só título/tagline/link/data); GraphQL exige PRODUCT_HUNT_TOKEN no env do servidor.",
  },
  web: {
    dataFields: ["title", "text (artigo extraído)", "url", "author", "date"],
    metaFields: ["siteName", "description", "lang", "words"],
    resources: ["Extração de artigo de qualquer URL (readability)", "PDF (texto extraído no servidor)"],
    limits: "Requer URL; timeouts com erro honesto.",
  },
  feed: {
    dataFields: ["title", "text", "url", "author", "date"],
    metaFields: ["feedUrl"],
    resources: ["RSS/Atom de qualquer feed válido (descoberta por URL)"],
    limits: "Requer URL de feed; validado no servidor.",
  },
  paste: {
    dataFields: ["title (linha)", "text"],
    metaFields: [],
    resources: ["Cola de texto livre (uma linha = um item) — entrada manual sem rede"],
    limits: "Local, sem rede.",
  },
  devto: {
    dataFields: ["title", "text (descrição)", "url", "author", "date", "score (reactions)"],
    metaFields: ["comments", "tags", "readingTime"],
    resources: ["Artigos dev.to com tags e tempo de leitura"],
    limits: "Forem API pública.",
  },
  lobsters: {
    dataFields: ["title", "text (descrição)", "url", "author", "date", "score"],
    metaFields: ["comments", "tags"],
    resources: ["Stories do Lobsters com tags"],
    limits: "JSON público (hottest/newest).",
  },
  mastodon: {
    dataFields: ["text", "url", "author", "date"],
    metaFields: ["favourites", "boosts", "replies", "lang"],
    resources: ["Posts por hashtag de qualquer instância"],
    limits: "API pública da instância (mastodon.social por padrão).",
  },
  bluesky: {
    dataFields: ["text", "url", "author", "date"],
    metaFields: ["likes", "reposts", "replies"],
    resources: ["Posts por termo (bsky.social público)"],
    limits: "searchPosts público; rate-limit da rede.",
  },
  wikidata: {
    dataFields: ["title (label)", "text (descrição)", "url"],
    metaFields: ["entityId", "aliases"],
    resources: ["Entidades com aliases e conceito (ático)"],
    limits: "Wikidata search público.",
  },
  openalex: {
    dataFields: ["title", "url", "author", "date", "score (citações)"],
    metaFields: ["citations", "openAccess", "type"],
    resources: ["Trabalhos acadêmicos com citações e acesso aberto"],
    limits: "OpenAlex API pública.",
  },
  crossref: {
    dataFields: ["title", "url", "author", "date", "score (citações)"],
    metaFields: ["citations", "doi", "publisher"],
    resources: ["DOIs com publisher e referências"],
    limits: "Crossref API pública.",
  },
  openlibrary: {
    dataFields: ["title", "url", "author", "date"],
    metaFields: ["ratings", "pages", "year", "editions", "ebook", "fullText", "cover", "languages"],
    resources: ["Livros com avaliações e metadados"],
    limits: "Open Library API pública.",
  },
  npm: {
    dataFields: ["title (pacote)", "text (descrição)", "url", "date"],
    metaFields: ["version", "keywords", "license", "maintainers", "repository", "homepage"],
    resources: ["Pacotes npm com versão e keywords"],
    limits: "Registry npm público (search).",
  },
  pypi: {
    dataFields: ["title (pacote)", "text (sumário)", "url", "author"],
    metaFields: ["version", "license", "requiresPython", "keywords", "classifiers", "projectUrls", "packageUrl"],
    resources: ["Pacotes PyPI com licença e requisitos"],
    limits: "PyPI JSON API pública (por nome exato).",
  },
  rubygems: {
    dataFields: ["title (gem)", "text (descrição)", "url", "score (downloads totais)"],
    metaFields: ["version", "downloads", "gemUri", "homepage", "docs", "source"],
    resources: ["Gems Ruby com downloads acumulados"],
    limits: "rubygems.org search API pública.",
  },
  cratesio: {
    dataFields: ["title (crate)", "text (descrição)", "url", "date (atualizado)", "score (downloads)"],
    metaFields: ["version (newest)", "downloads", "repository", "keywords", "categories", "homepage", "documentation"],
    resources: ["Crates Rust com link do repositório"],
    limits: "crates.io API pública; UA identificada exigida.",
  },
  doaj: {
    dataFields: ["title (artigo)", "text (revista)", "url (fulltext)", "author", "date (ano)"],
    metaFields: ["journal", "year", "doi"],
    resources: ["Artigos de periódicos open access com DOI"],
    limits: "DOAJ API pública; busca em path.",
  },
  openfoodfacts: {
    dataFields: ["title (produto)", "text (categorias)", "url", "author (marca)"],
    metaFields: ["brands", "nutriScore", "barcode", "categories"],
    resources: ["Produtos alimentícios com nutri-score e código de barras"],
    limits: "OpenFoodFacts (projeto open data); search.pl público.",
  },
  archive: {
    dataFields: ["title", "text (tipo de mídia)", "url", "author (criador)", "date (ano)", "score (downloads)"],
    metaFields: ["mediatype", "downloads", "identifier", "subject", "collection"],
    resources: ["Mídia arquivada: livros, web, áudio, vídeo"],
    limits: "Internet Archive advancedsearch API pública.",
  },
  tvmaze: {
    dataFields: ["title (série)", "text (sinopse)", "url", "date (estreia)", "score (nota)"],
    metaFields: ["genres", "status", "network", "runtime", "officialSite"],
    resources: ["Séries de TV com nota e sinopse"],
    limits: "TVMaze API pública sem chave.",
  },
  custom: {
    dataFields: ["title (mapeado)", "text (mapeado)", "url (mapeado)", "author (mapeado)", "date (mapeado)", "score (mapeado)"],
    metaFields: ["customSourceId", "customLabel"],
    resources: ["Qualquer API JSON pública via URL template + mapa de campos"],
    limits: "Definida pelo usuário; rate-limit depende da fonte.",
  },
};

/** Retorna o mapa de campos de uma fonte (fallback honesto). */
export function sourceFields(source: UniSourceId): SourceFields | undefined {
  return SOURCE_FIELDS[source];
}
