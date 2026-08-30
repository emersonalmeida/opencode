import type { AuditSource } from "../auditModel";

/**
 * Auditoria maximalista — CONHECIMENTO/LIVROS + PACOTES (7 fontes).
 * Base: docs/fontes/{wikipedia,wikidata,openlibrary,npm,pypi,rubygems,cratesio}-2026-08-25.md.
 */

function simpleReliability(): AuditSource["reliability"] {
  return {
    consistency: "Alta — API pública estruturada e estável.",
    stability: "Alta — endpoint público mantido pela comunidade.",
    risks: ["Rate-limit público", "Cobertura varia por termo"],
    fallbacks: ["Erro honesto"],
  };
}

export const WIKIPEDIA_AUDIT: AuditSource = {
  id: "wikipedia", order: 23, name: "Wikipedia", category: "Conhecimento",
  status: "audited", implemented: true, sourceId: "wikipedia",
  summary:
    "A enciclopédia aberta. Implementada via MediaWiki API em 40+ idiomas: busca com snippet e highlight do termo, artigo completo sob demanda, timestamp da última edição, pageid e lang. Disponíveis: categorias/links internos (grafo de conceitos), infobox estruturada, imagens (pageimages) e sumário (exintro).",
  endpoints: [
    { label: "MediaWiki search", url: "https://<lang>.wikipedia.org/w/api.php?action=query&list=search&srsearch=<t>", method: "GET", auth: "nenhuma", status: "implemented" },
    { label: "Artigo completo", url: "https://<lang>.wikipedia.org/w/api.php?action=query&prop=extracts&pageids=<id>", method: "GET", auth: "nenhuma", status: "implemented" },
    { label: "REST summary", url: "https://<lang>.wikipedia.org/api/rest_v1/page/summary/<t>", method: "GET", auth: "nenhuma", notes: "Usado pela Descoberta (resolve wikipedia).", status: "implemented" },
  ],
  parameters: [
    { name: "query", type: "string", description: "Termo de busca.", status: "implemented" },
    { name: "lang", type: "string", description: "Idioma da wiki (pt, en, es, de, fr…).", status: "implemented" },
    { name: "limit", type: "number", description: "Máximo de resultados.", status: "implemented" },
    { name: "categorias / links / infobox / imagens", type: "props", description: "Propriedades extras do artigo.", status: "available" },
  ],
  capabilities: [
    { label: "Busca multi-idioma (40+)", status: "implemented" },
    { label: "Snippet com highlight do termo", status: "implemented" },
    { label: "Artigo completo sob demanda", status: "implemented" },
    { label: "Timestamp da última edição", status: "implemented" },
    { label: "Grafo de conceitos (links internos)", status: "available" },
    { label: "Infobox estruturada (fatos)", status: "available" },
    { label: "Imagens do artigo", status: "available" },
  ],
  combinations: ["Wikipedia × Suggest — conceito + demanda", "Wikipedia × Trends — o que as pessoas leem (pageviews na Descoberta)"],
  outputs: [
    { name: "title / text (snippet) / url", type: "string", description: "Artigo.", presence: "always", status: "implemented" },
    { name: "date (última edição)", type: "timestamp", description: "Atualidade do artigo.", presence: "always", status: "implemented" },
    { name: "pageid / lang / full", type: "meta", description: "Identidade e artigo completo.", presence: "always", status: "implemented" },
    { name: "infobox / categorias / imagens", type: "meta", description: "Estrutura — não coletado.", presence: "common", status: "available" },
  ],
  derivations: ["Contexto enciclopédico de qualquer termo", "Conceitos relacionados (grafo)"],
  limits: ["Conteúdo enciclopédico (não é fonte de demanda direta)", "Artigos variam em profundidade por idioma"],
  reliability: simpleReliability(),
  references: [
    { label: "Notebook de testes (wiki-fonte)", url: "docs/fontes/notebooks/wiki-fonte.md" },{ label: "Doc da fonte no sistema", url: "docs/fontes/wikipedia-2026-08-25.md" }],
};

export const WIKIDATA_AUDIT: AuditSource = {
  id: "wikidata", order: 24, name: "Wikidata", category: "Conhecimento",
  status: "audited", implemented: true, sourceId: "wikidata",
  summary:
    "A base de conhecimento estruturado. Implementada via wbsearchentities: label (ou Q-ID), descrição, concepturi, entityId (Q-ID estável — chave de linked data) e aliases (nomes alternativos — ótimo para matching de marca). Disponíveis: claims/propriedades (wbgetclaims — fundador, fundação, website), idioma configurável e SPARQL para perguntas complexas.",
  endpoints: [
    { label: "wbsearchentities", url: "https://www.wikidata.org/w/api.php?action=wbsearchentities&search=<t>", method: "GET", auth: "nenhuma", status: "implemented" },
    { label: "wbgetclaims", url: "https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=<Q-ID>", method: "GET", auth: "nenhuma", notes: "Fatos estruturados — não implementado.", status: "available" },
    { label: "SPARQL", url: "https://query.wikidata.org/sparql?query=<q>", method: "GET", auth: "nenhuma", notes: "Perguntas complexas — não implementado.", status: "available" },
  ],
  parameters: [
    { name: "query", type: "string", description: "Termo.", status: "implemented" },
    { name: "limit", type: "number", description: "Máximo.", status: "implemented" },
    { name: "language", type: "string", description: "Hoje pt fixo; configurável disponível.", status: "available" },
  ],
  capabilities: [
    { label: "Entidades com Q-ID estável", status: "implemented" },
    { label: "Aliases (matching de marca)", status: "implemented" },
    { label: "Descrição por entidade", status: "implemented" },
    { label: "Claims (fatos estruturados)", status: "available" },
    { label: "SPARQL (perguntas complexas)", status: "available" },
  ],
  combinations: ["Wikidata × fontes — resolve marca/entidade antes de coletar", "Q-ID × tudo — chave de linked data"],
  outputs: [
    { name: "title (label/Q-ID) / text (descrição) / url", type: "string", description: "Entidade.", presence: "always", status: "implemented" },
    { name: "entityId / aliases", type: "meta", description: "Q-ID e nomes alternativos.", presence: "always", status: "implemented" },
    { name: "claims (fatos)", type: "meta", description: "Propriedades — não coletado.", presence: "common", status: "available" },
  ],
  derivations: ["Resolução de entidades/marcas", "Fatos estruturados (fundação, fundador)"],
  limits: ["Busca só (claims não implementados)", "Idioma fixo pt"],
  reliability: simpleReliability(),
  references: [{ label: "Doc da fonte no sistema", url: "docs/fontes/wikidata-2026-08-25.md" }],
};

export const OPENLIBRARY_AUDIT: AuditSource = {
  id: "openlibrary", order: 25, name: "Open Library", category: "Livros",
  status: "audited", implemented: true, sourceId: "openlibrary",
  summary:
    "O catálogo aberto de livros (Internet Archive). Implementada via search API: título, até 8 subjects, autores (até 3), ano de 1ª publicação, nota média da comunidade (score), ratings count, mediana de páginas, nº de edições, disponibilidade (ebook/fulltext), capa (cover_i) e idiomas. Disponíveis: busca por campo (title:/author:), edições do work e leitura online (reader do Archive).",
  endpoints: [
    { label: "Search API", url: "https://openlibrary.org/search.json?q=<t>&limit=<n>", method: "GET", auth: "nenhuma", status: "implemented" },
  ],
  parameters: [
    { name: "query", type: "string", description: "Termo.", status: "implemented" },
    { name: "limit", type: "number", description: "Máximo.", status: "implemented" },
    { name: "title: / author:", type: "campo", description: "Busca por campo.", status: "available" },
  ],
  capabilities: [
    { label: "Busca com nota média da comunidade", status: "implemented" },
    { label: "Disponibilidade (ebook/fulltext)", status: "implemented" },
    { label: "Capa para exibição visual", status: "implemented" },
    { label: "Subjects (taxonomia) e idiomas", status: "implemented" },
    { label: "Edições do work", status: "available" },
    { label: "Leitura online (Archive reader)", status: "available" },
  ],
  combinations: ["OpenLibrary × Wikipedia — livro + contexto", "OpenLibrary × Suggest — demanda de leitura"],
  outputs: [
    { name: "title / text (subjects) / url", type: "string", description: "Livro.", presence: "always", status: "implemented" },
    { name: "author / date (1ª pub) / score (nota)", type: "misto", description: "Autores, ano e nota.", presence: "always", status: "implemented" },
    { name: "ratings / pages / year / editions / ebook / fullText / cover / languages", type: "meta", description: "Metadados ricos.", presence: "always", status: "implemented" },
  ],
  derivations: ["Literatura por tema com avaliação", "Disponibilidade de leitura"],
  limits: ["Nota só quando há ratings", "Catálogo varia por idioma"],
  reliability: simpleReliability(),
  references: [{ label: "Doc da fonte no sistema", url: "docs/fontes/openlibrary-2026-08-25.md" }],
};

export const NPM_AUDIT: AuditSource = {
  id: "npm", order: 26, name: "npm", category: "Pacotes JS",
  status: "audited", implemented: true, sourceId: "npm",
  summary:
    "O registry de JavaScript. Implementada via search API: nome, descrição, link npm, publisher, data da última publicação, score oficial do registry (qualidade/popularidade/manutenção — score.final), versão, keywords (até 6), licença, maintainers, repository e homepage. Disponíveis: downloads semanais (adoção real), qualifiers (author:, not:deprecated), histórico de versões e grafo de dependências.",
  endpoints: [
    { label: "Search API", url: "https://registry.npmjs.org/-/v1/search?text=<t>&size=<n>", method: "GET", auth: "nenhuma", notes: "Teto 50.", status: "implemented" },
    { label: "Downloads", url: "https://api.npmjs.org/downloads/point/last-week/<pkg>", method: "GET", auth: "nenhuma", notes: "Adoção real — não implementado.", status: "available" },
  ],
  parameters: [
    { name: "query (text=)", type: "string", description: "Termo.", status: "implemented" },
    { name: "limit (size)", type: "number", description: "Máximo (teto 50).", range: "1–50", status: "implemented" },
    { name: "qualifiers", type: "string", description: "author:, maintainer:, keywords:, not:deprecated.", status: "available" },
  ],
  capabilities: [
    { label: "Score oficial do registry (qualidade/popularidade/manutenção)", status: "implemented" },
    { label: "Versão + licença + maintainers + repo/homepage", status: "implemented" },
    { label: "Downloads semanais (adoção real)", status: "available" },
    { label: "Histórico de versões", status: "available" },
    { label: "Grafo de dependências", status: "available" },
  ],
  combinations: ["npm × GitHub — pacote + repo", "npm × Trends — adoção de tecnologia"],
  outputs: [
    { name: "title / text / url / author / date / score", type: "misto", description: "Pacote com score oficial.", presence: "always", status: "implemented" },
    { name: "version / keywords / license / maintainers / repository / homepage", type: "meta", description: "Metadados.", presence: "always", status: "implemented" },
    { name: "downloads semanais", type: "number", description: "Adoção — não coletado.", presence: "common", status: "available" },
  ],
  derivations: ["Ecossistema JS por tema", "Saúde de pacote (score × manutenção)"],
  limits: ["Teto 50/busca", "Downloads requerem endpoint separado"],
  reliability: simpleReliability(),
  references: [{ label: "Doc da fonte no sistema", url: "docs/fontes/npm-2026-08-25.md" }],
};

export const PYPI_AUDIT: AuditSource = {
  id: "pypi", order: 27, name: "PyPI", category: "Pacotes Python",
  status: "audited", implemented: true, sourceId: "pypi",
  summary:
    "O registry de Python. Implementada via JSON API por NOME EXATO de pacote (a PyPI não tem busca pública — o XML-RPC foi descontinuado; o conector é honesto: retorna só se o pacote existir): nome, summary/description (teto 2000 chars), author/maintainer, versão, licença, requiresPython, keywords, classifiers (audiência/framework/licença) e projectUrls (documentação/repositório/changelog). Disponíveis: busca por scraping de pypi.org/search, histórico de releases (já retornado no payload, não mapeado) e downloads via pypistats.",
  endpoints: [
    { label: "JSON API (por nome exato)", url: "https://pypi.org/pypi/<pacote>/json", method: "GET", auth: "nenhuma", notes: "Sem busca full-text pública — o conector é honesto sobre isso.", status: "implemented" },
  ],
  parameters: [
    { name: "query (nome exato)", type: "string", description: "Nome do pacote (normalizado).", status: "implemented" },
    { name: "releases (histórico)", type: "payload", description: "Versões no próprio payload — não mapeado.", status: "available" },
    { name: "downloads (pypistats)", type: "endpoint", description: "Estatísticas de download.", status: "available" },
  ],
  capabilities: [
    { label: "Metadados completos por nome exato", status: "implemented" },
    { label: "Classifiers (audiência/framework/licença)", status: "implemented" },
    { label: "Links do projeto (docs/repo/changelog)", status: "implemented" },
    { label: "Honestidade: sem busca pública, retorna só se o pacote existir", status: "implemented" },
    { label: "Histórico de releases", status: "available" },
    { label: "Downloads (pypistats)", status: "available" },
  ],
  combinations: ["PyPI × GitHub — pacote + repo", "PyPI × npm — ecossistemas Python/JS"],
  outputs: [
    { name: "title / text (summary) / url / author", type: "misto", description: "Pacote.", presence: "always", status: "implemented" },
    { name: "version / license / requiresPython / keywords / classifiers / projectUrls", type: "meta", description: "Metadados ricos.", presence: "always", status: "implemented" },
    { name: "releases / downloads", type: "meta", description: "Histórico e adoção — não coletado.", presence: "common", status: "available" },
  ],
  derivations: ["Ecossistema Python por pacote", "Maturidade (classifiers × releases)"],
  limits: ["SEM busca full-text (só nome exato) — comportamento honesto", "Sem score/downloads na API JSON"],
  reliability: simpleReliability(),
  references: [{ label: "Doc da fonte no sistema", url: "docs/fontes/pypi-2026-08-25.md" }],
};

export const RUBYGEMS_AUDIT: AuditSource = {
  id: "rubygems", order: 28, name: "RubyGems", category: "Pacotes Ruby",
  status: "audited", implemented: true, sourceId: "rubygems",
  summary:
    "O registry de Ruby. Implementada via API pública de busca: nome, info, project_uri e score = DOWNLOADS TOTAIS (adoção histórica real — diferencial), com meta de versão, downloads, gemUri, homepage, documentação e código-fonte. Disponíveis: versões, dependências e busca por autor.",
  endpoints: [
    { label: "Search API", url: "https://rubygems.org/api/v1/search.json?query=<t>", method: "GET", auth: "nenhuma", status: "implemented" },
  ],
  parameters: [
    { name: "query", type: "string", description: "Termo.", status: "implemented" },
    { name: "versões / dependências / autor", type: "endpoints", description: "Disponíveis na API.", status: "available" },
  ],
  capabilities: [
    { label: "Downloads totais como score (adoção real)", status: "implemented" },
    { label: "Links canônicos (docs/código)", status: "implemented" },
    { label: "Versões e dependências", status: "available" },
  ],
  combinations: ["RubyGems × npm × PyPI — ecossistemas em 4 linguagens"],
  outputs: [
    { name: "title / text / url / score (downloads)", type: "misto", description: "Gem com adoção real.", presence: "always", status: "implemented" },
    { name: "version / downloads / gemUri / homepage / docs / source", type: "meta", description: "Metadados.", presence: "always", status: "implemented" },
  ],
  derivations: ["Ecossistema Ruby", "Adoção histórica (downloads totais)"],
  limits: ["API simples (sem filtros avançados)"],
  reliability: simpleReliability(),
  references: [{ label: "Doc da fonte no sistema", url: "docs/fontes/rubygems-2026-08-25.md" }],
};

export const CRATESIO_AUDIT: AuditSource = {
  id: "cratesio", order: 29, name: "Crates.io", category: "Pacotes Rust",
  status: "audited", implemented: true, sourceId: "cratesio",
  summary:
    "O registry de Rust. Implementada via API pública: nome, descrição, URL, data de atualização, score = downloads acumulados (adoção + manutenção), versão (newest), repository, keywords (até 6), categorias oficiais do ecossistema Rust (até 4), homepage e documentação. Disponíveis: downloads recentes (tendência), sort oficial (recent-downloads/new/downloads), dependências reversas e versões.",
  endpoints: [
    { label: "Search API", url: "https://crates.io/api/v1/crates?q=<t>&per_page=<n>", method: "GET", auth: "nenhuma", notes: "Teto 50.", status: "implemented" },
  ],
  parameters: [
    { name: "query", type: "string", description: "Termo.", status: "implemented" },
    { name: "limit (per_page)", type: "number", description: "Máximo (teto 50).", range: "1–50", status: "implemented" },
    { name: "sort", type: "enum", description: "recent-downloads / new / downloads.", status: "available" },
  ],
  capabilities: [
    { label: "Downloads acumulados + data de atualização", status: "implemented" },
    { label: "Categorias oficiais do ecossistema Rust", status: "implemented" },
    { label: "Downloads recentes (tendência)", status: "available" },
    { label: "Dependências reversas (quem usa)", status: "available" },
  ],
  combinations: ["Crates × RubyGems × npm × PyPI — 4 ecossistemas de pacotes"],
  outputs: [
    { name: "title / text / url / date / score (downloads)", type: "misto", description: "Crate.", presence: "always", status: "implemented" },
    { name: "version / downloads / repository / keywords / categories / homepage / documentation", type: "meta", description: "Metadados ricos.", presence: "always", status: "implemented" },
  ],
  derivations: ["Ecossistema Rust", "Tendência (downloads recentes, disponível)"],
  limits: ["Teto 50/busca"],
  reliability: simpleReliability(),
  references: [{ label: "Doc da fonte no sistema", url: "docs/fontes/cratesio-2026-08-25.md" }],
};
