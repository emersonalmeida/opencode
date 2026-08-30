/**
 * One Page — registro PURO das seções-fonte (uma por slide fullscreen).
 *
 * Cada fonte do sistema (Uni clássica, Trending, Descoberta, conectores
 * declarativos, custom) vira uma seção com: metadados honestos, como busca
 * (params → fetcher) e o que o usuário pode fazer nela. Sem React/fetch aqui
 * — os fetchers vivem em oneFetchers.ts (camada de efeito).
 */
import type { UniItem, UniSourceId } from "@/lib/uni/types";

export type OneSectionKind =
  | "uni"        // fonte clássica da Uni (uniApi fetch*)
  | "discover"   // fonte da Descoberta (uni-discover)
  | "trending"   // extrator do Google Trends Em alta
  | "connector"  // motor declarativo (uni-source)
  | "custom"     // fonte customizada do usuário
  | "ai";        // seção IA (conversa/gera sobre a coleta global)

export interface OneFieldOption { value: string; label: string }

export interface OneField {
  key: string;
  label: string;
  kind: "text" | "select" | "number";
  placeholder?: string;
  options?: OneFieldOption[];
  default: string;
}

/** O que o usuário pode fazer na seção (além de pesquisar/visualizar). */
export interface OneCapabilities {
  /** tem ação de drill (ex.: comentários do vídeo, reviews do app). */
  drill?: string;
  /** a fonte precisa de URL/texto em vez de termo. */
  needsUrl?: boolean;
  /** a fonte NÃO pesquisa por termo (coleta o momento: trending, clima, dados do Brasil…). */
  noQuery?: boolean;
  /** nota honesta (limite conhecido, rate-limit, scrape). */
  note?: string;
}

export interface OneSectionDef {
  id: string;
  /** label curto no snap dots. */
  title: string;
  /** pergunta-guia ("o que as pessoas estão buscando", "…encontram quando buscam por:"). */
  question: string;
  /** descrição honesta do que a fonte oferece. */
  description: string;
  kind: OneSectionKind;
  /** id do UniSourceId quando kind uni/connector (para saveCollection). */
  uniSource?: UniSourceId;
  /** id da fonte na rota uni-discover quando kind discover. */
  discoverSource?: string;
  /** id do conector quando kind connector. */
  connectorId?: string;
  group: OneGroup;
  fields: OneField[];
  caps: OneCapabilities;
}

export type OneGroup = "tendencias" | "busca" | "social" | "video" | "academico" | "dev" | "lojas" | "descoberta" | "web" | "ia";

export const ONE_GROUP_LABELS: Record<OneGroup, string> = {
  tendencias: "Tendências",
  busca: "Busca & descoberta",
  social: "Social & notícias",
  video: "Vídeo & áudio",
  academico: "Acadêmico & conhecimento",
  dev: "Desenvolvimento",
  lojas: "Lojas & produtos",
  descoberta: "Descoberta (radar)",
  web: "Web & custom",
  ia: "Inteligência artificial",
};

export const ONE_GROUP_ORDER: OneGroup[] = [
  "tendencias", "busca", "social", "video", "academico", "dev", "lojas", "descoberta", "web", "ia",
];

/** Resultado normalizado de qualquer fetcher de seção. */
export interface OneFetchResult {
  ok: boolean;
  items: UniItem[];
  error?: string;
  note?: string;
  cached?: boolean;
}

// ---------------------------------------------------------------------------
// As seções — ordem do pedido: trends → suggests → serp → youtube → …
// ---------------------------------------------------------------------------

export const ONE_SECTIONS: OneSectionDef[] = [
  // --- Tendências ---
  {
    id: "trending", title: "Trending", question: "O que as pessoas estão buscando agora",
    description: "Extrator do Google Trends “Em alta”: trends completos do dia com volume de buscas, crescimento, consultas relacionadas e notícias vinculadas, por região e janela.",
    kind: "trending", uniSource: "trends", group: "tendencias",
    fields: [
      { key: "geo", label: "Região", kind: "select", default: "br", options: [
        { value: "br", label: "Brasil" }, { value: "us", label: "EUA" }, { value: "pt", label: "Portugal" }, { value: "gb", label: "Reino Unido" },
      ] },
      { key: "hours", label: "Janela", kind: "select", default: "24", options: [
        { value: "4", label: "4 horas" }, { value: "24", label: "24 horas" }, { value: "48", label: "48 horas" }, { value: "168", label: "7 dias" },
      ] },
    ],
    caps: { drill: "notícias e consultas relacionadas de cada trend", noQuery: true },
  },
  {
    id: "trends", title: "Trends — interesse", question: "Como o interesse por um termo evolui",
    description: "Série temporal de interesse do Google Trends por termo, região e período — mede atenção ao longo do tempo.",
    kind: "uni", uniSource: "trends", group: "tendencias",
    fields: [
      { key: "geo", label: "Região", kind: "select", default: "BR", options: [
        { value: "BR", label: "Brasil" }, { value: "US", label: "EUA" }, { value: "PT", label: "Portugal" }, { value: "", label: "Mundo" },
      ] },
    ],
    caps: { note: "Google Trends aplica rate-limit por IP; o servidor tenta com backoff." },
  },
  // --- Busca & descoberta ---
  {
    id: "suggest", title: "Suggest", question: "O que as pessoas buscam na web, YouTube, notícias e shopping por:",
    description: "Autocomplete do Google em 4 verticais (web, YouTube, notícias, shopping) com expansões alfabéticas — revela intenções reais de busca.",
    kind: "uni", uniSource: "suggest", group: "busca",
    fields: [
      { key: "vertical", label: "Vertical", kind: "select", default: "web", options: [
        { value: "web", label: "Web" }, { value: "youtube", label: "YouTube" }, { value: "news", label: "Notícias" }, { value: "shopping", label: "Shopping" },
      ] },
      { key: "expand", label: "Expandir (a–z)", kind: "select", default: "no", options: [
        { value: "no", label: "Não" }, { value: "yes", label: "Sim (mais sondas)" },
      ] },
    ],
    caps: { drill: "expansões alfabéticas (a–z) por vertical" },
  },
  {
    id: "serp", title: "SERP", question: "O que as pessoas buscam e encontram no buscador por:",
    description: "Resultados de busca multi-engine (Google/Bing/DDG/Brave) — título, snippet e link orgânicos, com diagnóstico por engine.",
    kind: "uni", uniSource: "serp", group: "busca",
    fields: [],
    caps: {},
  },
  // --- Vídeo & áudio ---
  {
    id: "youtube", title: "YouTube", question: "O que as pessoas encontram quando buscam por:",
    description: "Vídeos com canal, visualizações, data e descrição; cada vídeo abre os comentários (drill) com autor, texto e likes.",
    kind: "uni", uniSource: "youtube", group: "video",
    fields: [],
    caps: { drill: "comentários de cada vídeo (autor, texto, likes)" },
  },
  // --- Social & notícias ---
  {
    id: "reddit", title: "Reddit", question: "O que as comunidades discutem sobre:",
    description: "Posts de qualquer subreddit (ou busca global) com score e nº de comentários; cada post abre os comentários (drill).",
    kind: "uni", uniSource: "reddit", group: "social",
    fields: [],
    caps: { drill: "comentários de cada post", note: "A API pública do Reddit pode bloquear por IP (403) — tente de outra rede se falhar." },
  },
  {
    id: "hackernews", title: "Hacker News", question: "O que a comunidade de tecnologia discute sobre:",
    description: "Histórias do HN (Algolia API) por relevância ou data, com pontos e nº de comentários; drill nos comentários de cada história.",
    kind: "uni", uniSource: "hackernews", group: "social",
    fields: [
      { key: "sort", label: "Ordenar", kind: "select", default: "relevance", options: [
        { value: "relevance", label: "Relevância" }, { value: "date", label: "Recentes" },
      ] },
    ],
    caps: { drill: "comentários de cada história" },
  },
  {
    id: "gdelt", title: "GDELT", question: "O que a imprensa global publica sobre:",
    description: "Notícias do mundo todo (GDELT) em qualquer idioma, com veículo, data e tom — cobertura jornalística global em tempo real.",
    kind: "uni", uniSource: "gdelt", group: "social",
    fields: [],
    caps: { note: "Frases multi-palavra entre aspas; rate-limit 1 req/5s por IP." },
  },
  {
    id: "reclameaqui", title: "ReclameAqui", question: "O que os consumidores reclamam de:",
    description: "Reclamações reais de consumidores do ReclameAqui: o termo resolve a empresa e coleta as reclamações (status Resolvido/Respondido/Réplica, cidade/UF, avaliação final); sem empresa correspondente, busca livre por termo.",
    kind: "uni", uniSource: "reclameaqui", group: "social",
    fields: [],
    caps: { note: "Protegido por Cloudflare — o servidor faz bypass via curl_cffi e, se o IP estiver marcado, via navegador real (Playwright: pip install playwright). Instalação guiada no erro." },
  },
  {
    id: "mastodon", title: "Mastodon", question: "O que o fediverso publica sobre:",
    description: "Posts públicos de qualquer instância Mastodon por hashtag/termo, com autor, favoritos e boosts.",
    kind: "connector", uniSource: "mastodon", connectorId: "mastodon", group: "social",
    fields: [],
    caps: {},
  },
  {
    id: "bluesky", title: "Bluesky", question: "O que o Bluesky publica sobre:",
    description: "Posts públicos do Bluesky por termo, com autor e engajamento.",
    kind: "connector", uniSource: "bluesky", connectorId: "bluesky", group: "social",
    fields: [],
    caps: { note: "A API pública pode retornar 403 conforme o IP de origem." },
  },
  // --- Acadêmico & conhecimento ---
  {
    id: "wikipedia", title: "Wikipédia", question: "O que a enciclopédia registra sobre:",
    description: "Busca de artigos da Wikipédia com resumo; cada artigo abre o conteúdo completo (drill) com texto e referências.",
    kind: "uni", uniSource: "wikipedia", group: "academico",
    fields: [
      { key: "lang", label: "Idioma", kind: "select", default: "pt", options: [
        { value: "pt", label: "Português" }, { value: "en", label: "Inglês" }, { value: "es", label: "Espanhol" },
      ] },
    ],
    caps: { drill: "artigo completo de cada resultado" },
  },
  {
    id: "arxiv", title: "arXiv", question: "O que a ciência publica sobre:",
    description: "Papers de pré-publicação (física, CS, matemática…) por relevância/data, com autores e resumo.",
    kind: "uni", uniSource: "arxiv", group: "academico",
    fields: [
      { key: "sort", label: "Ordenar", kind: "select", default: "relevance", options: [
        { value: "relevance", label: "Relevância" }, { value: "lastUpdatedDate", label: "Recentes" }, { value: "submittedDate", label: "Submissão" },
      ] },
    ],
    caps: { note: "arXiv aplica rate-limit; o servidor tenta com backoff." },
  },
  {
    id: "semanticscholar", title: "Semantic Scholar", question: "O que a pesquisa cita sobre:",
    description: "Papers com contagem de citações e ano — mede impacto real da pesquisa sobre o termo.",
    kind: "uni", uniSource: "semanticscholar", group: "academico",
    fields: [],
    caps: { note: "Rate-limit agressivo (429); o servidor tenta com backoff exponencial." },
  },
  {
    id: "openalex", title: "OpenAlex", question: "O que a pesquisa aberta publica sobre:",
    description: "Trabalhos acadêmicos do OpenAlex (catálogo aberto) com citações, ano e acesso aberto.",
    kind: "connector", uniSource: "openalex", connectorId: "openalex", group: "academico",
    fields: [],
    caps: {},
  },
  {
    id: "crossref", title: "Crossref", question: "O que os DOIs registram sobre:",
    description: "Trabalhos com DOI (Crossref) — a espinha dorsal da citação acadêmica, com periódico e ano.",
    kind: "connector", uniSource: "crossref", connectorId: "crossref", group: "academico",
    fields: [],
    caps: {},
  },
  {
    id: "doaj", title: "DOAJ", question: "O que os periódicos abertos publicam sobre:",
    description: "Artigos de periódicos open access (Directory of Open Access Journals).",
    kind: "connector", uniSource: "doaj", connectorId: "doaj", group: "academico",
    fields: [],
    caps: {},
  },
  {
    id: "wikidata", title: "Wikidata", question: "O que o grafo de conhecimento estrutura sobre:",
    description: "Entidades estruturadas do Wikidata (pessoas, lugares, obras, conceitos) com descrição e identificadores.",
    kind: "connector", uniSource: "wikidata", connectorId: "wikidata", group: "academico",
    fields: [],
    caps: {},
  },
  {
    id: "openlibrary", title: "Open Library", question: "Quais livros existem sobre:",
    description: "Busca de livros da Open Library com autor, ano e capa — catálogo bibliográfico aberto.",
    kind: "connector", uniSource: "openlibrary", connectorId: "openlibrary", group: "academico",
    fields: [],
    caps: {},
  },
  {
    id: "archive", title: "Internet Archive", question: "O que o arquivo da web preserva sobre:",
    description: "Mídias e textos preservados pelo Internet Archive (livros, áudio, vídeo, software histórico).",
    kind: "connector", uniSource: "archive", connectorId: "archive", group: "academico",
    fields: [],
    caps: {},
  },
  // --- Desenvolvimento ---
  {
    id: "github", title: "GitHub", question: "Quais projetos e discussões existem sobre:",
    description: "Repositórios por estrelas/atualização com descrição e linguagem; issues e discussões por termo.",
    kind: "uni", uniSource: "github", group: "dev",
    fields: [
      { key: "sort", label: "Ordenar", kind: "select", default: "stars", options: [
        { value: "stars", label: "Estrelas" }, { value: "updated", label: "Atualizados" }, { value: "forks", label: "Forks" },
      ] },
    ],
    caps: { drill: "issues do termo (estado aberto/fechado)" },
  },
  {
    id: "stackexchange", title: "Stack Exchange", question: "Quais dúvidas a comunidade técnica tem sobre:",
    description: "Perguntas do Stack Overflow e 6 outros sites, com respostas aceitas e score; drill nas respostas de cada pergunta.",
    kind: "uni", uniSource: "stackexchange", group: "dev",
    fields: [
      { key: "site", label: "Site", kind: "select", default: "stackoverflow", options: [
        { value: "stackoverflow", label: "Stack Overflow" }, { value: "pt.stackoverflow", label: "SO em Português" },
        { value: "superuser", label: "Super User" }, { value: "askubuntu", label: "Ask Ubuntu" },
        { value: "serverfault", label: "Server Fault" }, { value: "unix", label: "Unix & Linux" }, { value: "math", label: "Mathematics" },
      ] },
    ],
    caps: { drill: "respostas de cada pergunta" },
  },
  {
    id: "devto", title: "DEV.to", question: "O que devs escrevem sobre:",
    description: "Artigos da comunidade DEV.to por termo, com reações e tags.",
    kind: "connector", uniSource: "devto", connectorId: "devto", group: "dev",
    fields: [],
    caps: {},
  },
  {
    id: "lobsters", title: "Lobsters", question: "O que a comunidade Lobsters discute sobre:",
    description: "Histórias técnicas do Lobsters (link aggregator de programação) com score e comentários.",
    kind: "connector", uniSource: "lobsters", connectorId: "lobsters", group: "dev",
    fields: [],
    caps: { note: "O endpoint pode mudar — se 404, a fonte reporta honestamente." },
  },
  {
    id: "npm", title: "npm", question: "Quais pacotes JavaScript existem para:",
    description: "Busca de pacotes npm com descrição, versão e links — o registro do ecossistema JS.",
    kind: "connector", uniSource: "npm", connectorId: "npm", group: "dev",
    fields: [],
    caps: {},
  },
  {
    id: "pypi", title: "PyPI", question: "Quais pacotes Python existem para:",
    description: "Busca de pacotes PyPI com resumo e versão — o registro do ecossistema Python.",
    kind: "connector", uniSource: "pypi", connectorId: "pypi", group: "dev",
    fields: [],
    caps: {},
  },
  {
    id: "rubygems", title: "RubyGems", question: "Quais gems Ruby existem para:",
    description: "Busca de gems Ruby com descrição e downloads — o registro do ecossistema Ruby.",
    kind: "connector", uniSource: "rubygems", connectorId: "rubygems", group: "dev",
    fields: [],
    caps: {},
  },
  {
    id: "cratesio", title: "Crates.io", question: "Quais crates Rust existem para:",
    description: "Busca de crates Rust com descrição e downloads — o registro do ecossistema Rust.",
    kind: "connector", uniSource: "cratesio", connectorId: "cratesio", group: "dev",
    fields: [],
    caps: {},
  },
  // --- Lojas & produtos ---
  {
    id: "steam", title: "Steam", question: "Quais jogos existem sobre:",
    description: "Busca de jogos da Steam com preço e data; cada jogo abre os reviews públicos (drill) com idioma, votos e playtime.",
    kind: "uni", uniSource: "steam", group: "lojas",
    fields: [],
    caps: { drill: "reviews de cada jogo (idioma, votos, playtime)" },
  },
  {
    id: "itchio", title: "itch.io", question: "Quais jogos indie existem sobre:",
    description: "Jogos independentes do itch.io com autor e link — o catálogo indie aberto.",
    kind: "connector", uniSource: "itchio", connectorId: "itchio", group: "lojas",
    fields: [],
    caps: {},
  },
  {
    id: "openfoodfacts", title: "Open Food Facts", question: "Quais produtos alimentícios existem para:",
    description: "Produtos alimentícios com marca, Nutri-Score e origem — banco aberto de alimentos.",
    kind: "connector", uniSource: "openfoodfacts", connectorId: "openfoodfacts", group: "lojas",
    fields: [],
    caps: {},
  },
  {
    id: "tvmaze", title: "TVMaze", question: "Quais séries existem sobre:",
    description: "Séries de TV com emissora, status e resumo — catálogo aberto de televisão.",
    kind: "connector", uniSource: "tvmaze", connectorId: "tvmaze", group: "lojas",
    fields: [],
    caps: {},
  },
  // --- Web & custom ---
  {
    id: "web", title: "Web (página)", question: "O que uma página qualquer contém:",
    description: "Extrai título, texto principal e links de qualquer URL pública — transforma qualquer página em dado.",
    kind: "uni", uniSource: "web", group: "web",
    fields: [{ key: "url", label: "URL", kind: "text", placeholder: "https://exemplo.com/artigo", default: "" }],
    caps: { needsUrl: true },
  },
  {
    id: "feed", title: "Feed RSS/Atom", question: "O que um feed publica:",
    description: "Itens de qualquer feed RSS/Atom (blog, podcast, notícias) com título, data e link.",
    kind: "uni", uniSource: "feed", group: "web",
    fields: [{ key: "url", label: "URL do feed", kind: "text", placeholder: "https://blog.exemplo.com/feed", default: "" }],
    caps: { needsUrl: true },
  },
  {
    id: "paste", title: "Colar texto", question: "Transforme texto solto em dados:",
    description: "Cola qualquer texto (md/txt/json/csv) e vira itens analisáveis — dados do próprio usuário, sem rede.",
    kind: "uni", uniSource: "paste", group: "web",
    fields: [{ key: "text", label: "Texto", kind: "text", placeholder: "cole aqui…", default: "" }],
    caps: { needsUrl: true, note: "Processamento local — nada sai do navegador além do servidor local." },
  },
  {
    id: "custom", title: "Fontes do usuário", question: "Suas APIs públicas cadastradas:",
    description: "Qualquer API JSON que você cadastrou (URL template, mapa de campos, auth no vault local) — integra como fonte nativa.",
    kind: "custom", group: "web",
    fields: [],
    caps: { note: "Cadastre fontes customizadas na Uni (/00) para usá-las aqui." },
  },
  {
    id: "ia", title: "Assistente IA", question: "Converse e gere artefatos sobre a coleta:",
    description: "A IA lê TUDO o que você coletou nesta página e responde perguntas, resume, cruza fontes e gera artefatos (relatório, ranking, tese). Sem IA configurada, a coleta segue funcionando.",
    kind: "ai", group: "ia",
    fields: [],
    caps: { note: "Funciona sem IA (a coleta não depende dela). Configure em Configurações → IA para conversar/gerar." },
  },
];

// --- Seções da Descoberta (uni-discover) — adicionadas ao fim do grupo "descoberta" ---

const DISCOVER_SECTIONS_DEFS: OneSectionDef[] = [
  { id: "d-wikitop", title: "Wikipédia — mais lidos", question: "Os artigos mais lidos da Wikipédia hoje", description: "Top 100 artigos por dia e idioma, com visualizações (Wikimedia REST).", kind: "discover", discoverSource: "wikitop", group: "descoberta", fields: [], caps: { noQuery: true } },
  { id: "d-googlenews", title: "Notícias por termo", question: "Notícias recentes de qualquer termo", description: "Google News (RSS) com veículo e data de publicação.", kind: "discover", discoverSource: "googlenews", group: "descoberta", fields: [{ key: "query", label: "Termo", kind: "text", default: "inteligência artificial" }], caps: {} },
  { id: "d-podcasts", title: "Podcasts", question: "Os podcasts mais ouvidos", description: "Charts da Apple Podcasts por país, com capa, autor e gênero.", kind: "discover", discoverSource: "podcasts", group: "descoberta", fields: [], caps: { noQuery: true } },
  { id: "d-crypto", title: "Cripto em alta", question: "As moedas mais buscadas agora", description: "CoinGecko trending com rank e variação de 24h.", kind: "discover", discoverSource: "crypto", group: "descoberta", fields: [], caps: { noQuery: true } },
  { id: "d-music", title: "Música", question: "Charts e busca de músicas", description: "Charts globais do Deezer (faixas/artistas/álbuns) e busca de faixas com prévia de 30s.", kind: "discover", discoverSource: "music", group: "descoberta", fields: [], caps: { noQuery: true } },
  { id: "d-books", title: "Livros em alta", question: "Os livros mais acessados", description: "Open Library trending por período, com capa, autor e ano.", kind: "discover", discoverSource: "books", group: "descoberta", fields: [], caps: { noQuery: true } },
  { id: "d-clima", title: "Clima agora", question: "Condições nas capitais do Brasil", description: "Temperatura, sensação, umidade e vento agora (Open-Meteo).", kind: "discover", discoverSource: "clima", group: "descoberta", fields: [], caps: { noQuery: true } },
  { id: "d-brasil", title: "Brasil — dados oficiais", question: "Feriados, taxas, câmbio e nomes", description: "Feriados nacionais, SELIC/CDI, câmbio (BCE) e ranking de nomes do censo (IBGE).", kind: "discover", discoverSource: "brasil", group: "descoberta", fields: [], caps: { noQuery: true } },
  { id: "d-steamtop", title: "Jogos — mais jogados", question: "Os jogos mais jogados da Steam", description: "SteamSpy top 100 (2 semanas/sempre/vendidos) com jogadores simultâneos e % positivo.", kind: "discover", discoverSource: "steamtop", group: "descoberta", fields: [], caps: { noQuery: true } },
  { id: "d-packages", title: "Pacotes npm", question: "Downloads comparados de pacotes", description: "Downloads npm por pacote e período — compare frameworks lado a lado.", kind: "discover", discoverSource: "packages", group: "descoberta", fields: [{ key: "packages", label: "Pacotes", kind: "text", default: "react,vue,express" }], caps: {} },
  { id: "d-github-trending", title: "GitHub em alta", question: "Repositórios ganhando estrelas", description: "Trending do GitHub por linguagem e período (página pública).", kind: "discover", discoverSource: "github-trending", group: "descoberta", fields: [], caps: { note: "Extração da página pública — pode mudar sem aviso." } },
  { id: "d-mastodon-trends", title: "Mastodon em alta", question: "Tendências do fediverso", description: "Posts, hashtags e links em alta numa instância Mastodon.", kind: "discover", discoverSource: "mastodon-trends", group: "descoberta", fields: [], caps: { noQuery: true } },
  { id: "d-onthisday", title: "Neste dia", question: "Eventos, nascimentos e feriados de hoje", description: "Curadoria da Wikipédia em português para qualquer data.", kind: "discover", discoverSource: "onthisday", group: "descoberta", fields: [], caps: { noQuery: true } },
  { id: "d-wikiviews", title: "Leitura de artigo", question: "Atenção real sobre um tema", description: "Série diária de visualizações de qualquer artigo da Wikipédia (7–90 dias).", kind: "discover", discoverSource: "wikiviews", group: "descoberta", fields: [{ key: "article", label: "Artigo", kind: "text", default: "Brasil" }], caps: {} },
];

export const ALL_ONE_SECTIONS: OneSectionDef[] = [...ONE_SECTIONS, ...DISCOVER_SECTIONS_DEFS];

export function getOneSection(id: string): OneSectionDef | undefined {
  return ALL_ONE_SECTIONS.find((s) => s.id === id);
}

/** Mescla defaults dos campos com os valores atuais → params da coleta. */
export function oneSectionParams(def: OneSectionDef, values: Record<string, string>): Record<string, string> {
  const params: Record<string, string> = {};
  for (const f of def.fields) {
    const v = (values[f.key] ?? f.default).trim();
    if (v !== "") params[f.key] = v;
  }
  return params;
}
