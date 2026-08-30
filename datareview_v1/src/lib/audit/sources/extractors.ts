import type { AuditSource } from "../auditModel";

/**
 * Auditoria maximalista — RECLAMEAQUI + extratores universais
 * (web, feed, paste, custom).
 * Base: docs/fontes/{reclameaqui,web-extractor,rss-feed,paste,fontes-customizadas}-2026-08-25.md.
 */

export const RECLAMEAQUI_AUDIT: AuditSource = {
  id: "reclameaqui", order: 34, name: "ReclameAqui", category: "Reclamações",
  status: "audited", implemented: true, sourceId: "reclameaqui",
  summary:
    "O maior portal de reclamações do Brasil. Implementada com cadeia anti-Cloudflare de 3 níveis (fetch → curl_cffi impersonando Chrome → Playwright real que resolve o challenge JS e herda o cookie __cf_bm): busca de empresas, reclamações por empresa (ID ou shortname via perfil público) e busca livre por termo. Status derivado fiel ao web client (getStatusComplain): Réplica / Resolvido / Não resolvido / Respondido / Não respondido. Meta rico: score 0-10, cidade/UF, dealAgain, evaluated, solved.",
  endpoints: [
    { label: "Busca de empresas", url: "https://iosearch.reclameaqui.com.br/raichu-io-site-search-v1/companies/search/<nome>", method: "GET", auth: "nenhuma (anti-bot: cadeia de 3 níveis)", notes: "Endpoint estável — NÃO usar iosite/company/shortname (404/challenge).", status: "implemented" },
    { label: "Reclamações por empresa", url: ".../query/companyComplains/<n>/<off>?company=<id>", method: "GET", auth: "nenhuma", status: "implemented" },
    { label: "Busca livre por termo", url: ".../query/<termo>/<size>/<page>", method: "GET", auth: "nenhuma", notes: "Shape complainResult.complains.data (título em titleMasked).", status: "implemented" },
    { label: "Perfil (iosite)", url: "https://iosite.reclameaqui.com.br/raichu-io-…/company/shortname/<slug>", method: "GET", auth: "nenhuma", notes: "Resolve shortname → id.", status: "implemented" },
    { label: "Rota do sistema", url: "POST /functions/v1/uni-reclameaqui {action: search|complaints|term, query, companyId, shortname, limit}", method: "POST", auth: "nenhuma (servidor local)", status: "implemented" },
  ],
  parameters: [
    { name: "action", type: "enum", description: "search (empresas) · complaints (da empresa) · term (busca livre).", options: ["search", "complaints", "term"], status: "implemented" },
    { name: "query", type: "string", description: "Nome da empresa ou termo livre.", status: "implemented" },
    { name: "companyId / shortname", type: "string", description: "Empresa alvo (shortname resolve o id via perfil).", status: "implemented" },
    { name: "limit", type: "number", description: "Máximo de reclamações.", range: "1–100 (default 25)", status: "implemented" },
  ],
  capabilities: [
    { label: "Busca de empresas", status: "implemented" },
    { label: "Reclamações por empresa (id ou shortname)", status: "implemented" },
    { label: "Busca livre por termo", status: "implemented" },
    { label: "Status derivado fiel ao web client (Réplica/Resolvido/Não resolvido/Respondido/Não respondido)", status: "implemented" },
    { label: "Score 0-10 + cidade/UF + dealAgain + evaluated + solved", status: "implemented" },
    { label: "Cadeia anti-Cloudflare de 3 níveis (fetch → curl_cffi → Playwright)", status: "implemented" },
  ],
  combinations: [
    "ReclameAqui × lojas — reputação de atendimento × qualidade do app",
    "empresa → reclamações — voz do cliente brasileiro",
    "termo livre — problemas de um produto/categoria",
  ],
  outputs: [
    { name: "Empresa: title / text (cidade-UF) / url + companyId, shortname, city, state", type: "misto", description: "Empresa.", presence: "always", status: "implemented" },
    { name: "Reclamação: title / text (relato) / date / score (0-10)", type: "misto", description: "Reclamação.", presence: "always", status: "implemented" },
    { name: "status / statusRaw / solved / evaluated / dealAgain / city / state / companyName / total", type: "meta", description: "Metadados ricos da reclamação.", presence: "always", status: "implemented" },
  ],
  derivations: ["Taxa de resolução por empresa", "Problemas recorrentes (temas dos relatos)", "Regiões com mais reclamações"],
  limits: [
    "Cloudflare Bot Fight Mode (mitigado pela cadeia de 3 níveis)",
    "Rate-limit por IP",
    "Só Brasil",
  ],
  reliability: {
    consistency: "Alta — status derivado fiel ao web client (mesma função).",
    stability: "Média — depende de burlar o anti-bot; a cadeia de 3 níveis passa até com IP marcado (verificado do sandbox com 403).",
    risks: ["Cloudflare endurecer o challenge", "Mudança dos endpoints internos (raichu-io)"],
    fallbacks: ["fetch nativo → curl_cffi → Playwright/Chromium real (resolve o challenge JS)"],
  },
  references: [{ label: "Doc da fonte no sistema", url: "docs/fontes/reclameaqui-2026-08-25.md" }],
};

export const WEB_AUDIT: AuditSource = {
  id: "web", order: 35, name: "Web (extrator)", category: "Conteúdo URL",
  status: "audited", implemented: true, sourceId: "web",
  summary:
    "O extrator universal de conteúdo de qualquer URL — a fonte que transforma qualquer link em dado. 4 modos numa rota: page (artigo via readability, remove navegação/ads), pdf (texto extraído no servidor), text (texto bruto) e feed (descobre RSS/Atom nos <link> da página). Meta: siteName, description, lang e contagem de palavras. Erros honestos com causa (timeout, não-HTML, bloqueio).",
  endpoints: [
    { label: "Rota do sistema", url: "POST /functions/v1/uni-web {action: page|pdf|text|feed, url}", method: "POST", auth: "nenhuma (servidor local)", status: "implemented" },
  ],
  parameters: [
    { name: "action", type: "enum", description: "page (readability) · pdf · text · feed.", options: ["page", "pdf", "text", "feed"], status: "implemented" },
    { name: "url", type: "string", description: "URL alvo (obrigatória).", status: "implemented" },
    { name: "lote / screenshot / wayback / chunking", type: "modos", description: "Extração em lote, headless, fallback Wayback, chunking para IA.", status: "available" },
  ],
  capabilities: [
    { label: "Artigo principal via readability (remove navegação/ads)", status: "implemented" },
    { label: "Texto de PDF extraído no servidor", status: "implemented" },
    { label: "Texto bruto da página", status: "implemented" },
    { label: "Descoberta de RSS/Atom nos <link>", status: "implemented" },
    { label: "Metadados (site, descrição, idioma, palavras)", status: "implemented" },
    { label: "Extração em lote", status: "available" },
    { label: "Screenshot/headless para páginas JS-only", status: "available" },
    { label: "Wayback como fallback de páginas mortas", status: "available" },
  ],
  combinations: [
    "SERP → web — da busca ao conteúdo completo da página",
    "web(feed) → feed — descobre e assina o RSS de qualquer site",
    "qualquer URL de qualquer fonte → web — o extrator universal",
  ],
  outputs: [
    { name: "title / text (artigo) / url / author / date", type: "misto", description: "Conteúdo extraído.", presence: "always", status: "implemented" },
    { name: "siteName / description / lang / words", type: "meta", description: "Metadados da página.", presence: "always", status: "implemented" },
    { name: "feedUrl(s) descobertos", type: "meta", description: "Ação feed.", presence: "conditional", status: "implemented" },
  ],
  derivations: ["Qualquer página vira dado analisável", "Ponte entre fontes (link → conteúdo)"],
  limits: ["Páginas JS-only sem headless renderizam pouco", "Paywalls/login bloqueiam", "1 URL por chamada"],
  reliability: {
    consistency: "Média-alta — readability é heurístico; páginas estruturadas rendem bem.",
    stability: "Média — depende da página alvo (paywall, JS, bloqueio).",
    risks: ["Paywall/login", "Páginas JS-only", "Bloqueio por bot"],
    fallbacks: ["Erro honesto com causa", "Modo text como fallback do page"],
  },
  references: [{ label: "Doc da fonte no sistema", url: "docs/fontes/web-extractor-2026-08-25.md" }],
};

export const FEED_AUDIT: AuditSource = {
  id: "feed", order: 36, name: "RSS/Atom", category: "Monitoramento",
  status: "audited", implemented: true, sourceId: "feed",
  summary:
    "O monitoramento por feeds. Implementada com RSS 2.0 e Atom 1.0 (qualquer feed): título, texto, url, autor, data e meta feedUrl (proveniência). Descoberta automática via fonte web (ação feed). Disponíveis: agregador multi-feed (OPML), monitoramento agendado com diff de itens novos, filtro por palavra-chave e full-text via fonte web quando o feed só traz resumo.",
  endpoints: [
    { label: "Feed RSS/Atom", url: "<qualquer URL de feed>", method: "GET", auth: "nenhuma", notes: "Descoberta via fonte web (ação feed).", status: "implemented" },
  ],
  parameters: [
    { name: "url", type: "string", description: "URL do feed (descoberta ou colada).", status: "implemented" },
    { name: "OPML / agendamento / filtro / full-text", type: "recursos", description: "Multi-feed, diff de novos itens, keyword, full-text via web.", status: "available" },
  ],
  capabilities: [
    { label: "RSS 2.0 + Atom 1.0", status: "implemented" },
    { label: "Proveniência (feedUrl)", status: "implemented" },
    { label: "Descoberta automática (via web)", status: "implemented" },
    { label: "Agregador multi-feed (OPML)", status: "available" },
    { label: "Monitoramento agendado com diff", status: "available" },
    { label: "Full-text quando o feed só traz resumo", status: "available" },
  ],
  combinations: ["feed × monitoramento — novidades contínuas de um tema", "web(feed) → feed — assina qualquer site"],
  outputs: [
    { name: "title / text / url / author / date", type: "misto", description: "Item do feed.", presence: "always", status: "implemented" },
    { name: "feedUrl", type: "meta", description: "Proveniência.", presence: "always", status: "implemented" },
  ],
  derivations: ["Monitoramento contínuo de fontes", "Novidades por tema"],
  limits: ["Depende do feed existir e estar acessível", "Feeds com só resumo exigem full-text via web"],
  reliability: {
    consistency: "Alta — RSS/Atom são padrões estáveis.",
    stability: "Alta — parser de feed maduro.",
    risks: ["Feed morto/movido", "Feed com só resumo"],
    fallbacks: ["Full-text via fonte web no link", "Erro honesto"],
  },
  references: [{ label: "Doc da fonte no sistema", url: "docs/fontes/rss-feed-2026-08-25.md" }],
};

export const PASTE_AUDIT: AuditSource = {
  id: "paste", order: 37, name: "Paste (manual)", category: "Entrada manual",
  status: "audited", implemented: true, sourceId: "paste",
  summary:
    "A entrada manual — qualquer texto colado vira dados Uni. Linhas vazias ignoradas; cada linha vira um UniItem (title = linha truncada, text = linha completa, sem meta). Integração total com o pipeline (charts, IA, coleções, exports). No pipeline multifonte é SKIP HONESTO por design ('fontes que exigem texto são puladas com a razão').",
  endpoints: [
    { label: "Entrada manual", url: "— (sem endpoint; texto colado na UI)", method: "—", auth: "—", notes: "Skip honesto no pipeline multifonte por design.", status: "implemented" },
  ],
  parameters: [
    { name: "texto livre", type: "string", description: "Multilinha; linhas vazias ignoradas.", status: "implemented" },
    { name: "parser estruturado / upload / detecção de formato", type: "recursos", description: "CSV/TSV/JSON, upload de arquivo, detecção automática.", status: "available" },
  ],
  capabilities: [
    { label: "Qualquer texto vira dados Uni (charts, IA, coleções)", status: "implemented" },
    { label: "Skip honesto no pipeline multifonte", status: "implemented" },
    { label: "Parser estruturado (CSV/TSV/JSON)", status: "available" },
    { label: "Upload de arquivo (txt/csv/md)", status: "available" },
  ],
  combinations: ["paste × tudo — dados externos (planilha, export) entram no sistema"],
  outputs: [
    { name: "title (linha truncada) / text (linha)", type: "string", description: "Item colado.", presence: "always", status: "implemented" },
  ],
  derivations: ["Dados do usuário entram no pipeline Uni"],
  limits: ["Sem metadados na origem", "Exige input manual (por design)"],
  reliability: {
    consistency: "Determinística (dado do usuário).",
    stability: "Total — sem dependência externa.",
    risks: [],
    fallbacks: ["N/A"],
  },
  references: [{ label: "Doc da fonte no sistema", url: "docs/fontes/paste-2026-08-25.md" }],
};

export const CUSTOM_AUDIT: AuditSource = {
  id: "custom", order: 38, name: "Fontes customizadas", category: "Qualquer JSON",
  status: "audited", implemented: true, sourceId: "custom",
  summary:
    "O usuário aponta QUALQUER API pública JSON como fonte: urlTemplate com placeholders {q}/{limit}, listPath (dot-path até o array), mapa de campos (title/text/url/author/date/score) e auth opcional (header/query/bearer — a chave NUNCA é persistida no servidor). Botão Testar (probe ao vivo) valida antes de salvar. Integra Uni (/00), pipeline multifonte (PipelineStep.customId) e UniSourcePicker. Disponíveis: templates prontos, normalização de data/score, paginação configurável e import/export de definições.",
  endpoints: [
    { label: "API definida pelo usuário", url: "<urlTemplate com {q} e {limit}>", method: "GET", auth: "header/query/bearer (opcional, chave não persistida)", status: "implemented" },
  ],
  parameters: [
    { name: "urlTemplate", type: "string", description: "URL com {q} (query) e {limit}.", status: "implemented" },
    { name: "listPath", type: "dot-path", description: "Caminho até o array de itens.", status: "implemented" },
    { name: "map", type: "dot-paths", description: "title, text, url, author, date, score.", status: "implemented" },
    { name: "auth", type: "header|query|bearer", description: "Autenticação opcional.", status: "implemented" },
    { name: "templates / normalização / paginação / import-export", type: "recursos", description: "Disponíveis.", status: "available" },
  ],
  capabilities: [
    { label: "Qualquer API JSON pública vira fonte", status: "implemented" },
    { label: "Probe ao vivo (Testar) antes de salvar", status: "implemented" },
    { label: "Auth sem persistência da chave no servidor", status: "implemented" },
    { label: "Integra Uni, pipeline multifonte e seletor de fontes", status: "implemented" },
    { label: "Templates prontos de APIs populares", status: "available" },
    { label: "Import/export de definições", status: "available" },
  ],
  combinations: ["custom × tudo — o usuário estende o sistema com qualquer fonte"],
  outputs: [
    { name: "title / text / url / author / date / score (mapeados)", type: "misto", description: "Mapeados pela definição.", presence: "always", status: "implemented" },
    { name: "customSourceId / customLabel", type: "meta", description: "Proveniência.", presence: "always", status: "implemented" },
  ],
  derivations: ["Fontes ilimitadas definidas pelo usuário"],
  limits: ["Depende da API do usuário", "Mapeamento manual (dot-path)"],
  reliability: {
    consistency: "Depende da API do usuário.",
    stability: "Alta — probe valida antes de salvar.",
    risks: ["API do usuário instável", "Mapeamento incorreto (mitigado pelo probe)"],
    fallbacks: ["Probe ao vivo detecta falha antes de salvar"],
  },
  references: [{ label: "Doc da fonte no sistema", url: "docs/fontes/fontes-customizadas-2026-08-25.md" }],
};
