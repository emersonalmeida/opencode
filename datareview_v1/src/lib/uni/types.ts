/**
 * Uni (/00) — modelo unificado de dados multi-fonte.
 *
 * Cada fonte (suggest/trends/serp/youtube/reddit…) produz UniItems com um
 * shape comum — é o que permite UMA tabela, UM conjunto de gráficos e UM
 * pipeline de IA para todas as fontes. O payload bruto específico fica em
 * `meta` (auditável).
 */

export type UniSourceId =
  | "suggest"
  | "trends"
  | "serp"
  | "youtube"
  | "reddit"
  | "wikipedia"
  | "hackernews"
  | "gdelt"
  | "arxiv"
  | "stackexchange"
  | "github"
  | "semanticscholar"
  | "steam"
  | "web"
  | "feed"
  | "paste"
  | "devto"
  | "lobsters"
  | "mastodon"
  | "bluesky"
  | "wikidata"
  | "openalex"
  | "crossref"
  | "openlibrary"
  | "npm"
  | "pypi"
  | "itchio"
  | "rubygems"
  | "cratesio"
  | "doaj"
  | "openfoodfacts"
  | "archive"
  | "tvmaze"
  | "reclameaqui"
  | "producthunt"
  | "custom";

export type UniItemKind =
  | "suggestion" // termo de autocomplete (suggest)
  | "trend-point" // ponto temporal (trends)
  | "trend-region" // interesse por região (trends)
  | "trend-query" // query relacionada (trends)
  | "web-result" // resultado SERP
  | "video" // vídeo YouTube
  | "comment" // comentário (YouTube/Reddit)
  | "post" // post (Reddit/HN)
  | "article" // artigo (Wikipedia)
  | "news" // notícia (GDELT)
  | "paper" // artigo científico (arXiv)
  | "question" // pergunta (StackExchange)
  | "answer" // resposta (StackExchange)
  | "repo" // repositório (GitHub)
  | "issue" // issue (GitHub)
  | "game" // jogo (Steam)
  | "review" // review (Steam)
  | "complaint" // reclamação (ReclameAqui)
  | "document" // documento (PDF/texto colado)
  | "book" // livro (Open Library)
  | "package"; // pacote (npm/PyPI)

export interface UniItem {
  id: string;
  source: UniSourceId;
  kind: UniItemKind;
  /** Título/rótulo principal. */
  title: string;
  /** Texto completo (comentário, post, snippet…). */
  text?: string;
  author?: string;
  url?: string;
  /** Score numérico genérico: relevância, likes, upvotes, views… */
  score?: number;
  /** ISO date quando a fonte fornece. */
  date?: string;
  /** Payload específico da fonte (raw normalizado). */
  meta?: Record<string, unknown>;
}

/** Opções do seletor de tipo de item (para fontes customizadas e pickers). */
export const KIND_OPTIONS: { id: UniItemKind; label: string }[] = [
  { id: "web-result", label: "Resultado web" },
  { id: "post", label: "Post" },
  { id: "comment", label: "Comentário" },
  { id: "article", label: "Artigo" },
  { id: "news", label: "Notícia" },
  { id: "paper", label: "Paper" },
  { id: "question", label: "Pergunta" },
  { id: "answer", label: "Resposta" },
  { id: "repo", label: "Repositório" },
  { id: "issue", label: "Issue" },
  { id: "video", label: "Vídeo" },
  { id: "game", label: "Jogo" },
  { id: "review", label: "Review" },
  { id: "book", label: "Livro" },
  { id: "package", label: "Pacote" },
  { id: "document", label: "Documento" },
  { id: "suggestion", label: "Sugestão" },
];

/** Uma coleta salva (o usuário pode salvar várias por fonte/termo). */
export interface UniCollection {
  id: string;
  label: string;
  source: UniSourceId;
  /** Termo/consulta que originou a coleta. */
  query: string;
  items: UniItem[];
  collectedAt: number;
  /** Parâmetros da coleta (região, vertical, ordenação…). */
  params?: Record<string, unknown>;
}

export const UNI_SOURCE_META: Record<UniSourceId, { label: string; description: string }> = {
  itchio: {
    label: "itch.io",
    description: "Jogos indie com título e link (busca textual).",
  },
  suggest: {
    label: "Google Suggest",
    description: "Autocomplete web/YouTube/News/Shopping + expansão alfabética (mineração de demanda e keywords).",
  },
  trends: {
    label: "Google Trends",
    description: "Interesse ao longo do tempo, por região e queries relacionadas (top/rising).",
  },
  serp: {
    label: "SERP (Bing/DDG/Brave/Google)",
    description: "Resultados orgânicos de busca multi-engine com dedup por URL.",
  },
  youtube: {
    label: "YouTube",
    description: "Busca de vídeos + comentários (top), sem API key.",
  },
  reddit: {
    label: "Reddit",
    description: "Posts + comentários por termo/subreddit (JSON público ou OAuth).",
  },
  wikipedia: {
    label: "Wikipedia",
    description: "Busca de artigos + texto integral (contexto enciclopédico).",
  },
  hackernews: {
    label: "Hacker News",
    description: "Stories + comentários da comunidade tech (API Algolia oficial).",
  },
  gdelt: {
    label: "GDELT (notícias)",
    description: "Notícias globais monitoradas em tempo real (GDELT Project, sem API key).",
  },
  arxiv: {
    label: "arXiv",
    description: "Artigos científicos (preprints) com resumo, autores e PDF (API pública).",
  },
  stackexchange: {
    label: "StackExchange",
    description: "Perguntas + respostas da rede (Stack Overflow, pt.SO…) — API pública 2.3.",
  },
  github: {
    label: "GitHub",
    description: "Repositórios + issues (Search API; mais cota com GITHUB_TOKEN no servidor).",
  },
  semanticscholar: {
    label: "Semantic Scholar",
    description: "Artigos acadêmicos com resumo e contagem de citações (Graph API pública).",
  },
  steam: {
    label: "Steam",
    description: "Jogos + reviews de usuários com recomendação, votos e horas jogadas.",
  },
  reclameaqui: {
    label: "ReclameAqui",
    description: "Reclamações de consumidores por empresa ou termo — status (Resolvido/Respondido…), cidade/UF e avaliação final.",
  },
  producthunt: {
    label: "Product Hunt",
    description: "Lançamentos de produtos do dia (feed público, ranking real); GraphQL oficial com votos/tópicos/comentários via PRODUCT_HUNT_TOKEN.",
  },
  web: {
    label: "Web (URL/PDF)",
    description: "Qualquer página pública ou PDF vira texto extraído + metadados.",
  },
  feed: {
    label: "RSS/Atom",
    description: "Qualquer feed RSS/Atom (blog, portal, Google News) como lista de itens.",
  },
  paste: {
    label: "Texto colado",
    description: "Cole .md, .txt, .json ou .csv — vira itens analisáveis.",
  },
  devto: { label: "DEV Community", description: "Artigos dev por tag com reações e comentários." },
  lobsters: { label: "Lobsters", description: "Discussões tech de nicho com score e comentários." },
  mastodon: { label: "Mastodon", description: "Posts públicos por hashtag (fediverso)." },
  bluesky: { label: "Bluesky", description: "Busca de posts públicos com likes e reposts." },
  wikidata: { label: "Wikidata", description: "Entidades estruturadas (empresas, apps, conceitos)." },
  openalex: { label: "OpenAlex", description: "250M de papers com citações e acesso aberto." },
  crossref: { label: "Crossref", description: "Metadados DOI de publicações científicas." },
  openlibrary: { label: "Open Library", description: "Livros com autores, ano, notas e assuntos." },
  npm: { label: "npm", description: "Pacotes JavaScript com descrição, versão e keywords." },
  pypi: { label: "PyPI", description: "Pacote Python por nome exato (versão, licença, resumo)." },
  rubygems: { label: "RubyGems", description: "Gems Ruby com versão e downloads totais." },
  cratesio: { label: "Crates.io", description: "Crates Rust com downloads e repositório." },
  doaj: { label: "DOAJ", description: "Artigos de periódicos open access com revista e DOI." },
  openfoodfacts: { label: "Open Food Facts", description: "Produtos alimentícios com marca, categorias e nutri-score." },
  archive: { label: "Internet Archive", description: "Mídia arquivada (livros/web/áudio) com criador e downloads." },
  tvmaze: { label: "TVMaze", description: "Séries de TV com nota, gêneros e sinopse." },
  custom: { label: "Fonte customizada", description: "Conector JSON definido pelo usuário (URL template + mapa de campos)." },
};

let counter = 0;
/** Id único local (suficiente para coleções do usuário). */
export function uniItemId(source: string, seed: string): string {
  counter = (counter + 1) % 10000;
  return `${source}:${seed}:${Date.now().toString(36)}${counter.toString(36)}`;
}
