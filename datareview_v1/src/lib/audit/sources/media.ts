import type { AuditSource } from "../auditModel";

/**
 * Auditoria maximalista — GDELT + TVMaze + Open Food Facts + Internet Archive.
 * Base: docs/fontes/{gdelt,tvmaze,openfoodfacts,internet-archive}-2026-08-25.md.
 */

function rel(): AuditSource["reliability"] {
  return {
    consistency: "Alta — API pública estruturada.",
    stability: "Alta — endpoint público estável.",
    risks: ["Rate-limit público", "Cobertura varia por termo"],
    fallbacks: ["Erro honesto"],
  };
}

export const GDELT_AUDIT: AuditSource = {
  id: "gdelt", order: 30, name: "GDELT", category: "Notícias",
  status: "audited", implemented: true, sourceId: "gdelt",
  summary:
    "O monitor global de notícias em tempo real (milhares de fontes). Implementada via GDELT 2.0 Events API: busca de artigos com idioma via operador sourcelang: (NÃO via mode, que é formato de saída), frases multi-palavra entre aspas (parênteses quebram o parser), sort date/relevance (hybridrel), janela de datas e teto 250 artigos. Cache 10min respeitando o rate-limit de 1 req/5s; respostas não-JSON viram erro 429/400 honesto. Meta: domain, language, sourceCountry. Disponíveis: mode TimelineVol/TimelineTone/ImageCollage e operadores tone:/theme:/near3:.",
  endpoints: [
    { label: "GDELT 2.0 Events", url: "https://api.gdeltproject.org/api/v2/doc/doc?query=<t>&mode=ArtList&maxrecords=<n>", method: "GET", auth: "nenhuma", notes: "Idioma via sourcelang: na query; frases entre aspas.", status: "implemented" },
    { label: "Rota do sistema", url: "POST /functions/v1/uni-gdelt {action: search, query, sort, lang, limit, startDate, endDate}", method: "POST", auth: "nenhuma (servidor local)", status: "implemented" },
  ],
  parameters: [
    { name: "query", type: "string", description: "Termo; sourcelang: para idioma; frases entre aspas (parênteses quebram o parser).", status: "implemented" },
    { name: "sort", type: "enum", description: "date (padrão) ou relevance (hybridrel).", options: ["date", "relevance"], default: "date", status: "implemented" },
    { name: "lang", type: "string", description: "Idioma (vira sourcelang:).", status: "implemented" },
    { name: "limit", type: "number", description: "Máximo (teto 250).", range: "1–250", status: "implemented" },
    { name: "startDate / endDate", type: "YYYYMMDDHHMMSS", description: "Janela temporal.", status: "implemented" },
    { name: "mode", type: "enum", description: "ArtList (hoje) → TimelineVol, TimelineTone, ImageCollage.", status: "available" },
    { name: "tone: / theme: / near3:", type: "operadores", description: "Tom, tema e proximidade.", status: "available" },
  ],
  capabilities: [
    { label: "Notícias globais em tempo real (teto 250/consulta)", status: "implemented" },
    { label: "Filtro de idioma via operador sourcelang:", status: "implemented" },
    { label: "Janela de datas", status: "implemented" },
    { label: "Cache 10min + erro honesto em 429/400", status: "implemented" },
    { label: "Timeline de volume/tom (mode)", status: "available" },
    { label: "Operadores de tom/tema/proximidade", status: "available" },
  ],
  combinations: ["GDELT × Trends — notícia × demanda de busca", "GDELT × janela temporal — cobertura de um evento"],
  outputs: [
    { name: "title / url / date (seenDate)", type: "misto", description: "Artigo.", presence: "always", status: "implemented" },
    { name: "domain / language / sourceCountry", type: "meta", description: "Proveniência.", presence: "always", status: "implemented" },
    { name: "tone / temas", type: "meta", description: "Tom e temas — não coletado.", presence: "common", status: "available" },
  ],
  derivations: ["Cobertura midiática global de um tema", "Linha do tempo de notícias"],
  limits: ["1 req/5s por IP (rate-limit)", "Teto 250 artigos", "Parser sensível a parênteses", "alguns ambientes (sandbox/datacenter) não alcançam o endpoint — erro honesto"],
  reliability: rel(),
  references: [
    { label: "Doc da fonte no sistema", url: "docs/fontes/gdelt-2026-08-25.md" },
    { label: "Notebook de testes (gdelt-fonte)", url: "docs/fontes/notebooks/gdelt-fonte.md" },
  ],
};

export const TVMAZE_AUDIT: AuditSource = {
  id: "tvmaze", order: 31, name: "TVMaze", category: "Séries",
  status: "audited", implemented: true, sourceId: "tvmaze",
  summary:
    "O catálogo aberto de séries. Implementada via API pública: busca com sinopse sanitizada (HTML strip, teto 500), estreia, nota média, gêneros, status (Running/Ended), network/webChannel, runtime e site oficial. Disponíveis: episódios com notas, elenco, schedule/estreias por país e busca de pessoas.",
  endpoints: [
    { label: "Search shows", url: "https://api.tvmaze.com/search/shows?q=<t>", method: "GET", auth: "nenhuma", status: "implemented" },
    { label: "Episódios / elenco / schedule", url: "https://api.tvmaze.com/shows/<id>/episodes|cast · /schedule", method: "GET", auth: "nenhuma", notes: "Não implementado.", status: "available" },
  ],
  parameters: [
    { name: "query", type: "string", description: "Termo.", status: "implemented" },
    { name: "episódios / elenco / schedule / pessoas", type: "endpoints", description: "Disponíveis.", status: "available" },
  ],
  capabilities: [
    { label: "Busca com nota + gêneros + status + network", status: "implemented" },
    { label: "Sinopse sanitizada", status: "implemented" },
    { label: "Episódios com notas por episódio", status: "available" },
    { label: "Schedule/estreias por país", status: "available" },
  ],
  combinations: ["TVMaze × YouTube — série + trailers", "TVMaze × Trends — séries em alta"],
  outputs: [
    { name: "title / text (sinopse) / url / date (estreia) / score (nota)", type: "misto", description: "Série.", presence: "always", status: "implemented" },
    { name: "genres / status / network / runtime / officialSite", type: "meta", description: "Metadados.", presence: "always", status: "implemented" },
    { name: "episódios / elenco", type: "meta", description: "Não coletado.", presence: "common", status: "available" },
  ],
  derivations: ["Catálogo de séries com avaliação", "Calendário de estreias (disponível)"],
  limits: ["Só séries (não filmes)", "Sem reviews de usuários"],
  reliability: rel(),
  references: [{ label: "Doc da fonte no sistema", url: "docs/fontes/tvmaze-2026-08-25.md" }],
};

export const OPENFOODFACTS_AUDIT: AuditSource = {
  id: "openfoodfacts", order: 32, name: "Open Food Facts", category: "Alimentos",
  status: "audited", implemented: true, sourceId: "openfoodfacts",
  summary:
    "A base aberta de produtos alimentícios. Implementada via API pública: nome do produto (itens sem nome são descartados), 4 primeiras categorias, página do produto por código, marcas, nutri-score (A–E) como metadado de qualidade e barcode como chave canônica. Disponíveis: lookup por código de barras, nutrientes completos (nutriments), filtros por nutri-score/país (facet API) e ingredientes/alérgenos.",
  endpoints: [
    { label: "Search", url: "https://world.openfoodfacts.org/cgi/search.pl?search_terms=<t>&json=1", method: "GET", auth: "nenhuma", status: "implemented" },
    { label: "Lookup por barcode", url: "https://world.openfoodfacts.org/api/v0/product/<barcode>.json", method: "GET", auth: "nenhuma", notes: "Não implementado.", status: "available" },
  ],
  parameters: [
    { name: "query", type: "string", description: "Termo.", status: "implemented" },
    { name: "limit", type: "number", description: "Máximo (teto 50).", range: "1–50", status: "implemented" },
    { name: "barcode / nutri-score / país", type: "filtros", description: "Lookup e facets.", status: "available" },
  ],
  capabilities: [
    { label: "Busca de produtos com nutri-score", status: "implemented" },
    { label: "Barcode como chave canônica", status: "implemented" },
    { label: "Lookup exato por código de barras", status: "available" },
    { label: "Nutrientes completos e ingredientes/alérgenos", status: "available" },
  ],
  combinations: ["OFF × Suggest — o que as pessoas buscam sobre alimentos"],
  outputs: [
    { name: "title (product_name) / text (categorias) / url / author (brands)", type: "misto", description: "Produto.", presence: "always", status: "implemented" },
    { name: "brands / nutriScore / barcode / categories", type: "meta", description: "Qualidade e identidade.", presence: "always", status: "implemented" },
    { name: "nutriments / ingredientes / alérgenos", type: "meta", description: "Não coletado.", presence: "common", status: "available" },
  ],
  derivations: ["Qualidade nutricional por categoria", "Marcas por nutri-score"],
  limits: ["Dados colaborativos (cobertura varia)", "Teto 50"],
  reliability: rel(),
  references: [{ label: "Doc da fonte no sistema", url: "docs/fontes/openfoodfacts-2026-08-25.md" }],
};

export const ARCHIVE_AUDIT: AuditSource = {
  id: "archive", order: 33, name: "Internet Archive", category: "Mídia histórica",
  status: "audited", implemented: true, sourceId: "archive",
  summary:
    "O arquivo histórico da web e da mídia. Implementada via advancedsearch (query syntax do Archive): título (normaliza array→primeiro), descrição (teto 2000), criador, ano, downloads como score, mediatype, subjects (até 8) e coleções (até 4). Disponíveis: filtros por mediatype (texts/audio/movies), full-text search dentro de livros, metadados completos do item e a Wayback Machine como dimensão (web arquivada).",
  endpoints: [
    { label: "Advanced Search", url: "https://archive.org/advancedsearch.php?q=<t>&fl[]=identifier,title,creator,year,mediatype,downloads,description,subject,collection&rows=<n>&output=json", method: "GET", auth: "nenhuma", status: "implemented" },
    { label: "Metadata / fulltext / Wayback", url: "archive.org/metadata/<id> · /fulltext/inside.php · web.archive.org", method: "GET", auth: "nenhuma", notes: "Não implementado.", status: "available" },
  ],
  parameters: [
    { name: "query", type: "string", description: "Termo (query syntax do Archive).", status: "implemented" },
    { name: "limit", type: "number", description: "Máximo (teto 50).", range: "1–50", status: "implemented" },
    { name: "mediatype", type: "filtro", description: "texts/audio/movies.", status: "available" },
  ],
  capabilities: [
    { label: "Mídia histórica (livros/áudio/vídeo/web) com downloads", status: "implemented" },
    { label: "Normalização de campos array", status: "implemented" },
    { label: "Subjects e coleções", status: "implemented" },
    { label: "Full-text dentro de livros", status: "available" },
    { label: "Wayback Machine (web arquivada)", status: "available" },
  ],
  combinations: ["Archive × OpenLibrary — catálogo + arquivo", "Wayback × web — versão histórica de uma página"],
  outputs: [
    { name: "title / text (descrição) / url / author / date (ano) / score (downloads)", type: "misto", description: "Item.", presence: "always", status: "implemented" },
    { name: "mediatype / downloads / identifier / subject / collection", type: "meta", description: "Metadados.", presence: "always", status: "implemented" },
    { name: "arquivos do item / formatos", type: "meta", description: "Via /metadata — não coletado.", presence: "common", status: "available" },
  ],
  derivations: ["Acervo histórico por tema", "Mídia mais acessada (downloads)"],
  limits: ["Teto 50", "Campos heterogêneos (array vs string) — normalizados"],
  reliability: rel(),
  references: [{ label: "Doc da fonte no sistema", url: "docs/fontes/internet-archive-2026-08-25.md" }],
};
