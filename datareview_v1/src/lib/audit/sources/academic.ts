import type { AuditSource } from "../auditModel";

/**
 * Auditoria maximalista — as 5 fontes ACADÊMICAS.
 * Base: docs/fontes/{arxiv,semanticscholar,openalex,crossref,doaj}-2026-08-25.md.
 */

function academicReliability(extra?: Partial<AuditSource["reliability"]>): AuditSource["reliability"] {
  return {
    consistency: "Alta — API pública estruturada e estável.",
    stability: "Alta — endpoint documentado e mantido pela comunidade acadêmica.",
    risks: ["Rate-limit/quota pública", "Cobertura varia por área"],
    fallbacks: ["Erro honesto", "Outras fontes acadêmicas do grupo cobrem lacunas"],
    ...extra,
  };
}

export const ARXIV_AUDIT: AuditSource = {
  id: "arxiv",
  order: 18,
  name: "arXiv",
  category: "Acadêmica",
  status: "audited",
  implemented: true,
  sourceId: "arxiv",
  summary:
    "O repositório de preprints (cs, math, physics…). Implementada via Atom API pública (sem auth): busca com 3 ordenações (relevance/lastUpdatedDate/submittedDate), resumo, autores, categorias por entry e link direto do PDF (ponte para a fonte web ação pdf). Disponíveis: query syntax completa (ti:, au:, cat:cs.SE), intervalo de datas e batch por IDs (id_list).",
  endpoints: [
    { label: "Atom API", url: "https://export.arxiv.org/api/query?search_query=all:<t>&sortBy=<s>&max_results=<n>", method: "GET", auth: "nenhuma", notes: "Atom XML parseado por regex (sem deps).", status: "implemented" },
    { label: "Rota do sistema", url: "POST /functions/v1/uni-arxiv {action: search, query, sort, limit}", method: "POST", auth: "nenhuma (servidor local)", status: "implemented" },
  ],
  parameters: [
    { name: "query", type: "string", description: "Termo (search_query=all:).", status: "implemented" },
    { name: "sort", type: "enum", description: "Ordenação.", options: ["relevance", "lastUpdatedDate", "submittedDate"], default: "relevance", status: "implemented" },
    { name: "limit (max_results)", type: "number", description: "Máximo de papers.", status: "implemented" },
    { name: "ti: / au: / cat:", type: "query syntax", description: "Busca por campo (título, autor, categoria).", status: "available" },
    { name: "submittedDate:[A TO B]", type: "intervalo", description: "Janela temporal.", status: "available" },
    { name: "id_list", type: "string[]", description: "Batch por IDs arXiv.", status: "available" },
  ],
  capabilities: [
    { label: "Busca com 3 ordenações", status: "implemented" },
    { label: "Resumo + autores + categorias por paper", status: "implemented" },
    { label: "Link direto do PDF (ponte para extração de texto)", status: "implemented" },
    { label: "Query syntax por campo (ti:/au:/cat:)", status: "available" },
    { label: "Intervalo de datas", status: "available" },
    { label: "Batch por IDs", status: "available" },
  ],
  combinations: [
    "arXiv × Semantic Scholar — preprint + métricas de citação",
    "PDF × fonte web — texto completo do paper",
    "arXiv × Trends — do hype de busca à literatura",
  ],
  outputs: [
    { name: "title / text (resumo) / url (abs)", type: "string", description: "Paper.", presence: "always", status: "implemented" },
    { name: "author / date", type: "misto", description: "Autores e data.", presence: "always", status: "implemented" },
    { name: "pdf / categories / updated", type: "meta", description: "PDF direto, taxonomia e atualização.", presence: "always", status: "implemented" },
    { name: "DOI / journal-ref", type: "string", description: "Quando publicado (não coletado).", presence: "common", status: "available" },
  ],
  derivations: ["Estado da arte por tema", "Linha do tempo de pesquisa (submittedDate)"],
  limits: ["Preprints (não revisados por pares)", "Atom API com rate-limit (3s entre chamadas recomendado)"],
  reliability: academicReliability(),
  references: [
    { label: "Doc da fonte no sistema", url: "docs/fontes/arxiv-2026-08-25.md" },
    { label: "Notebook de testes (arxiv-fonte)", url: "docs/fontes/notebooks/arxiv-fonte.md" },
    { label: "Saídas de exemplo (arxiv-output)", url: "docs/fontes/notebooks/arxiv-output.md" },
  ],
};

export const SEMANTICSCHOLAR_AUDIT: AuditSource = {
  id: "semanticscholar",
  order: 19,
  name: "Semantic Scholar",
  category: "Acadêmica",
  status: "audited",
  implemented: true,
  sourceId: "semanticscholar",
  summary:
    "O motor acadêmico da Allen AI. Implementada via Graph API pública: busca com ordenação por relevância ou CITAÇÕES (impacto — única fonte acadêmica com sort por métrica), abstract, autores, ano e citationCount. Resiliência a 429 com backoff exponencial + jitter (5 tentativas). Disponíveis: tldr, fieldsOfStudy, openAccessPdf, grafo de citações (references/citations) e bulk search com filtros.",
  endpoints: [
    { label: "Graph API search", url: "https://api.semanticscholar.org/graph/v1/paper/search?query=<t>&fields=title,authors,year,url,abstract,citationCount", method: "GET", auth: "nenhuma (API key eleva quota)", notes: "Backoff+jitter em 429 (5 tentativas).", status: "implemented" },
    { label: "Rota do sistema", url: "POST /functions/v1/uni-semanticscholar {action: search, query, sort, limit}", method: "POST", auth: "nenhuma (servidor local)", status: "implemented" },
  ],
  parameters: [
    { name: "query", type: "string", description: "Termo de busca.", status: "implemented" },
    { name: "sort", type: "enum", description: "relevance ou citationCount (impacto).", options: ["relevance", "citationCount"], default: "relevance", status: "implemented" },
    { name: "limit", type: "number", description: "Máximo de papers.", status: "implemented" },
    { name: "fields extras", type: "lista", description: "tldr, fieldsOfStudy, openAccessPdf, references, citations.", status: "available" },
    { name: "bulk search (ano/venue)", type: "filtros", description: "Busca em massa com filtros.", status: "available" },
  ],
  capabilities: [
    { label: "Ordenação por citações (impacto)", status: "implemented" },
    { label: "Resiliência a 429 (backoff exponencial + jitter)", status: "implemented" },
    { label: "Abstract + autores + ano + citações", status: "implemented" },
    { label: "TLDR automático do paper", status: "available" },
    { label: "Grafo de citações (quem cita/é citado)", status: "available" },
    { label: "openAccessPdf (texto completo gratuito)", status: "available" },
  ],
  combinations: [
    "S2 × arXiv — impacto + preprint",
    "grafo de citações — a genealogia de uma ideia",
  ],
  outputs: [
    { name: "title / text (abstract) / url", type: "string", description: "Paper.", presence: "always", status: "implemented" },
    { name: "author / date (year)", type: "misto", description: "Autores e ano.", presence: "always", status: "implemented" },
    { name: "score (citações) / year / citations", type: "meta", description: "Impacto.", presence: "always", status: "implemented" },
    { name: "tldr / fieldsOfStudy", type: "meta", description: "Resumo automático e áreas — não coletado.", presence: "common", status: "available" },
  ],
  derivations: ["Papers mais influentes por tema", "Grafo de influência científica"],
  limits: ["429 agressivo sem API key (mitigado com backoff)", "Cobertura varia por área"],
  reliability: academicReliability({ risks: ["429 frequente sem key (mitigado)", "Lag de indexação de papers novos"] }),
  references: [
    { label: "Doc da fonte no sistema", url: "docs/fontes/semanticscholar-2026-08-25.md" },
    { label: "Notebook de testes (scholar-fonte)", url: "docs/fontes/notebooks/scholar-fonte.md" },
  ],
};

export const OPENALEX_AUDIT: AuditSource = {
  id: "openalex",
  order: 20,
  name: "OpenAlex",
  category: "Acadêmica",
  status: "audited",
  implemented: true,
  sourceId: "openalex",
  summary:
    "O catálogo aberto de trabalhos acadêmicos (240M+). Implementada via API pública: busca de works com venue, autores (até 3), data, cited_by_count, flag de ACESSO ABERTO (filtra o que é legível de graça) e tipo do trabalho (article/preprint/dataset). Disponíveis: filtros (open_access.is_oa, datas), conceitos/tópicos para taxonomia e autores/instituições como entidades.",
  endpoints: [
    { label: "Works search", url: "https://api.openalex.org/works?search=<t>&per-page=<n>", method: "GET", auth: "nenhuma (mailto eleva prioridade)", notes: "Teto 50 por página na implementação.", status: "implemented" },
  ],
  parameters: [
    { name: "query", type: "string", description: "Termo (/works?search=).", status: "implemented" },
    { name: "limit", type: "number", description: "Máximo (teto 50).", range: "1–50", status: "implemented" },
    { name: "filter", type: "string", description: "open_access.is_oa:true, from_publication_date:…", status: "available" },
    { name: "concepts / topics", type: "taxonomia", description: "Classificação automática.", status: "available" },
  ],
  capabilities: [
    { label: "Busca de works com citações", status: "implemented" },
    { label: "Flag de acesso aberto", status: "implemented" },
    { label: "Tipo do trabalho (article/preprint/dataset)", status: "implemented" },
    { label: "Filtros avançados (OA, datas)", status: "available" },
    { label: "Conceitos/tópicos (taxonomia)", status: "available" },
    { label: "Autores/instituições como entidades", status: "available" },
  ],
  combinations: ["OpenAlex × S2 — catálogo + métricas", "OA × web — texto completo dos papers abertos"],
  outputs: [
    { name: "title (display_name) / text (venue) / url (DOI)", type: "string", description: "Trabalho.", presence: "always", status: "implemented" },
    { name: "author (até 3) / date", type: "misto", description: "Autores e publicação.", presence: "always", status: "implemented" },
    { name: "score (cited_by_count) / openAccess / type", type: "meta", description: "Impacto, acesso e tipo.", presence: "always", status: "implemented" },
    { name: "concepts / topics", type: "meta", description: "Taxonomia — não coletado.", presence: "common", status: "available" },
  ],
  derivations: ["Mapeamento de áreas de pesquisa", "Literatura aberta acessível"],
  limits: ["Teto 50/página na implementação", "Resumo não coletado (abstract_inverted_index existe)"],
  reliability: academicReliability(),
  references: [{ label: "Doc da fonte no sistema", url: "docs/fontes/openalex-2026-08-25.md" }],
};

export const CROSSREF_AUDIT: AuditSource = {
  id: "crossref",
  order: 21,
  name: "Crossref",
  category: "Acadêmica",
  status: "audited",
  implemented: true,
  sourceId: "crossref",
  summary:
    "O registro oficial de DOIs. Implementada via API pública: busca de works com periódico (container-title), autores (até 3), data, is-referenced-by-count, URL canônica via DOI (link permanente) e publisher (credibilidade). Disponíveis: filtros (from-pub-date, type), busca bibliográfica (query.bibliographic/author) e lookup por DOI exato.",
  endpoints: [
    { label: "Works search", url: "https://api.crossref.org/works?query=<t>&rows=<n>", method: "GET", auth: "nenhuma (mailto = pool polido)", notes: "Teto 50 na implementação.", status: "implemented" },
    { label: "Lookup por DOI", url: "https://api.crossref.org/works/<doi>", method: "GET", auth: "nenhuma", notes: "Usado pela Descoberta (resolve doi), não pela Uni.", status: "implemented" },
  ],
  parameters: [
    { name: "query", type: "string", description: "Termo (/works?query=).", status: "implemented" },
    { name: "limit (rows)", type: "number", description: "Máximo (teto 50).", range: "1–50", status: "implemented" },
    { name: "filter", type: "string", description: "from-pub-date:, type:journal-article.", status: "available" },
    { name: "query.bibliographic / query.author", type: "string", description: "Busca bibliográfica direcionada.", status: "available" },
  ],
  capabilities: [
    { label: "Busca de works com citações", status: "implemented" },
    { label: "URL canônica via DOI (link permanente)", status: "implemented" },
    { label: "Publisher + periódico (credibilidade)", status: "implemented" },
    { label: "Lookup por DOI exato (na Descoberta)", status: "implemented" },
    { label: "Filtros por data/tipo", status: "available" },
    { label: "Busca bibliográfica direcionada", status: "available" },
  ],
  combinations: ["Crossref × OpenAlex — DOI oficial + catálogo aberto", "DOI × web — a página do paper"],
  outputs: [
    { name: "title / text (periódico) / url (doi.org)", type: "string", description: "Obra.", presence: "always", status: "implemented" },
    { name: "author (até 3) / date", type: "misto", description: "Autores e publicação.", presence: "always", status: "implemented" },
    { name: "score (is-referenced-by) / doi / publisher", type: "meta", description: "Impacto e identidade.", presence: "always", status: "implemented" },
    { name: "abstract", type: "string", description: "Nem toda obra tem — não coletado.", presence: "conditional", status: "available" },
  ],
  derivations: ["Bibliografia formal por tema", "Periódicos relevantes por área"],
  limits: ["Teto 50 na implementação", "Sem texto completo (só metadados)"],
  reliability: academicReliability(),
  references: [{ label: "Doc da fonte no sistema", url: "docs/fontes/crossref-2026-08-25.md" }],
};

export const DOAJ_AUDIT: AuditSource = {
  id: "doaj",
  order: 22,
  name: "DOAJ",
  category: "Acadêmica",
  status: "audited",
  implemented: true,
  sourceId: "doaj",
  summary:
    "O diretório de periódicos open access. Implementada via API pública: busca de artigos com revista, autores (até 3), ano, fulltext link extraído de bibjson.link e DOI de bibjson.identifier. Disponíveis: paginação além da 1ª página, journals como entidade e filtros por ano/licença via query DSL.",
  endpoints: [
    { label: "Article search", url: "https://doaj.org/api/search/articles/<termo>?pageSize=<n>", method: "GET", auth: "nenhuma", notes: "Termo vai no path da URL.", status: "implemented" },
    { label: "Journals search", url: "https://doaj.org/api/search/journals/<termo>", method: "GET", auth: "nenhuma", notes: "Não implementado.", status: "available" },
  ],
  parameters: [
    { name: "query", type: "string", description: "Termo (path da URL).", status: "implemented" },
    { name: "limit (pageSize)", type: "number", description: "Máximo (teto 50).", range: "1–50", status: "implemented" },
    { name: "page", type: "number", description: "Paginação além da 1ª página.", status: "available" },
    { name: "ano / licença (query DSL)", type: "filtros", description: "Filtros do DOAJ.", status: "available" },
  ],
  capabilities: [
    { label: "Artigos open access com fulltext link", status: "implemented" },
    { label: "DOI extraído por artigo", status: "implemented" },
    { label: "Revista (journal) por artigo", status: "implemented" },
    { label: "Paginação", status: "available" },
    { label: "Journals como entidade buscável", status: "available" },
    { label: "Filtros por ano/licença", status: "available" },
  ],
  combinations: ["DOAJ × web — texto completo garantido (tudo é OA)", "DOAJ × Crossref — OA + DOI oficial"],
  outputs: [
    { name: "title / text (revista) / url (fulltext)", type: "string", description: "Artigo.", presence: "always", status: "implemented" },
    { name: "author (até 3) / date (ano)", type: "misto", description: "Autores e ano.", presence: "always", status: "implemented" },
    { name: "journal / year / doi", type: "meta", description: "Identidade.", presence: "always", status: "implemented" },
    { name: "abstract", type: "string", description: "bibjson.abstract — não coletado.", presence: "common", status: "available" },
  ],
  derivations: ["Literatura 100% acessível (tudo open access)", "Periódicos OA por área"],
  limits: ["Teto 50, 1ª página", "Cobertura menor que OpenAlex (só OA)"],
  reliability: academicReliability(),
  references: [{ label: "Doc da fonte no sistema", url: "docs/fontes/doaj-2026-08-25.md" }],
};
