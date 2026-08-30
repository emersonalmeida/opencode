import type { AuditSource } from "../auditModel";

/**
 * Auditoria — FONTE FAMÍLIA DISCOVER (radar do /descoberta) + voz local.
 *
 * Base: server/routes/uniDiscover.ts, server/lib/discoverCore.ts (builders +
 * parsers puros), server/lib/urlResolver.ts (resolve, 13 tipos),
 * server/lib/voiceBackends.ts (whisper/piper), docs/pages/descoberta-2026-08-25.md.
 * Tudo documentado a partir do código real — nada inventado.
 */

const REL_DASHBOARD = {
  consistency: "Fontes de momento (top/trending/clima) — a resposta muda por natureza; o TTL do cache define a janela de consistência.",
  stability: "APIs públicas estáveis (Wikimedia REST, iTunes RSS, CoinGecko, Open-Meteo, Deezer, npm, Mastodon v1). GitHub Trending é scrape de HTML — pode mudar sem aviso.",
  risks: ["Rate-limit por IP (SteamSpy 1 req/s; GitHub trending sem SLA)", "GitHub Trending é extração de página pública (HTML pode mudar)"],
  fallbacks: ["Cache TTL por fonte (hit não reconsulta)", "Erro honesto por seção — uma fonte lenta nunca bloqueia as outras"],
};

const REF_DISCOVER = [
  { label: "server/lib/discoverCore.ts (builders + parsers)", url: "https://github.com/appdatareview/blob/main/server/lib/discoverCore.ts" },
  { label: "docs/pages/descoberta-2026-08-25.md", url: "https://github.com/appdatareview/blob/main/docs/pages/descoberta-2026-08-25.md" },
];

export const WIKITOP_AUDIT: AuditSource = {
  id: "wikitop", order: 39, name: "Wikipedia Top (pageviews)", category: "Momento",
  status: "audited", implemented: true, sourceId: "discover-wikitop",
  summary:
    "Os artigos mais lidos da Wikipédia por dia e projeto (pt.wikipedia, en.wikipedia…), via REST pública de pageviews da Wikimedia. Até 100 artigos com rank e views. A data padrão é D-2 (a API publica com defasagem).",
  endpoints: [
    { label: "Top pageviews", url: "https://wikimedia.org/api/rest_v1/metrics/pageviews/top/{project}/all-access/{yyyy}/{mm}/{dd}", method: "GET", auth: "nenhuma", notes: "project ex.: pt.wikipedia. Data default = D-2 (defasagem de publicação).", status: "implemented" },
    { label: "Rota do sistema", url: "POST /functions/v1/uni-discover {source: \"wikitop\", project?, date?}", method: "POST", auth: "nenhuma (servidor local)", status: "implemented" },
  ],
  parameters: [
    { name: "project", type: "string", description: "Projeto Wikimedia (idioma). Default pt.wikipedia.", options: ["pt.wikipedia", "en.wikipedia", "es.wikipedia", "…"], status: "implemented" },
    { name: "date", type: "string", description: "Data do ranking (YYYY-MM-DD). Default D-2.", status: "implemented" },
  ],
  capabilities: [
    { label: "Ranking diário de artigos mais lidos (até 100/dia)", status: "implemented" },
    { label: "Variação por idioma/projeto", status: "implemented" },
    { label: "Série histórica por dia (a API aceita qualquer data; o sistema expõe 1 dia por coleta)", status: "available" },
  ],
  combinations: ["project × date"],
  outputs: [
    { name: "title", type: "string", description: "Artigo (underscores).", presence: "always", status: "implemented" },
    { name: "score", type: "number", description: "Views do dia.", presence: "always", status: "implemented" },
    { name: "meta.rank", type: "number", description: "Posição no ranking.", presence: "always", status: "implemented" },
    { name: "url", type: "string", description: "Link do artigo.", presence: "always", status: "implemented" },
  ],
  derivations: ["Top-N por projeto", "comparação de rank entre dias (mesclando coletas)"],
  limits: ["Até 100 artigos/dia (fixo da API)", "data com defasagem de ~2 dias"],
  reliability: REL_DASHBOARD,
  references: [
    { label: "Wikimedia REST — pageviews top", url: "https://wikimedia.org/api/rest_v1/" },
    ...REF_DISCOVER,
  ],
};

export const WIKIVIEWS_AUDIT: AuditSource = {
  id: "wikiviews", order: 40, name: "Wikipedia Views (por artigo)", category: "Momento",
  status: "audited", implemented: true, sourceId: "discover-wikiviews",
  summary:
    "Série diária de pageviews de UM artigo (ex.: \"Brasil\") nos últimos N dias (default 30), via REST pública da Wikimedia. Cada ponto vira um item (data + views).",
  endpoints: [
    { label: "Per-article pageviews", url: "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/{project}/all-access/all-agents/{article}/daily/{start}/{end}", method: "GET", auth: "nenhuma", status: "implemented" },
    { label: "Rota do sistema", url: "POST /functions/v1/uni-discover {source: \"wikiviews\", article, project?, days?}", method: "POST", auth: "nenhuma (servidor local)", status: "implemented" },
  ],
  parameters: [
    { name: "article", type: "string", description: "Obrigatório. Título do artigo (espaços viram underscores).", status: "implemented" },
    { name: "project", type: "string", description: "Projeto Wikimedia.", options: ["pt.wikipedia", "en.wikipedia", "…"], status: "implemented" },
    { name: "days", type: "number", description: "Janela em dias (default 30).", options: ["7", "30", "60", "90"], status: "implemented" },
  ],
  capabilities: [
    { label: "Série temporal de views por artigo", status: "implemented" },
    { label: "Janela configurável (dias)", status: "implemented" },
  ],
  combinations: ["article × project × days"],
  outputs: [
    { name: "title", type: "string", description: "Data (dd/mm/aaaa).", presence: "always", status: "implemented" },
    { name: "score", type: "number", description: "Views do dia.", presence: "always", status: "implemented" },
    { name: "publishedAt", type: "string", description: "Data ISO.", presence: "always", status: "implemented" },
  ],
  derivations: ["média/mediana de views", "pico e tendência da série", "comparação entre artigos"],
  limits: ["1 artigo por coleta", "somente pageviews (sem edições/autores)"],
  reliability: REL_DASHBOARD,
  references: [
    { label: "Wikimedia REST — per-article pageviews", url: "https://wikimedia.org/api/rest_v1/" },
    ...REF_DISCOVER,
  ],
};

export const ONTHISDAY_AUDIT: AuditSource = {
  id: "onthisday", order: 41, name: "On This Day (Wikimedia)", category: "Momento",
  status: "audited", implemented: true, sourceId: "discover-onthisday",
  summary:
    "Feed curado \"neste dia\" da Wikipédia: eventos, nascimentos, mortes, feriados e selecionados, por mês/dia e idioma. Cada evento traz texto, ano e páginas relacionadas.",
  endpoints: [
    { label: "On this day feed", url: "https://api.wikimedia.org/feed/v1/wikipedia/{lang}/onthisday/{type}/{mm}/{dd}", method: "GET", auth: "nenhuma", notes: "type: all|selected|events|births|deaths|holidays.", status: "implemented" },
    { label: "Rota do sistema", url: "POST /functions/v1/uni-discover {source: \"onthisday\", month?, day?, type?, lang?}", method: "POST", auth: "nenhuma (servidor local)", status: "implemented" },
  ],
  parameters: [
    { name: "month", type: "number", description: "Mês (1–12). Default: mês atual (UTC).", range: "1–12", status: "implemented" },
    { name: "day", type: "number", description: "Dia (1–31). Default: dia atual (UTC).", range: "1–31", status: "implemented" },
    { name: "type", type: "enum", description: "Tipo do feed.", options: ["all", "selected", "events", "births", "deaths", "holidays"], default: "all", status: "implemented" },
    { name: "lang", type: "string", description: "Idioma da Wikipédia.", options: ["pt", "en", "es", "…"], default: "pt", status: "implemented" },
  ],
  capabilities: [
    { label: "Eventos por tipo (6 tipos)", status: "implemented" },
    { label: "Variação por idioma", status: "implemented" },
    { label: "Qualquer data do ano", status: "implemented" },
  ],
  combinations: ["month × day × type × lang"],
  outputs: [
    { name: "title", type: "string", description: "Texto do evento.", presence: "always", status: "implemented" },
    { name: "meta.year", type: "number", description: "Ano do evento.", presence: "common", status: "implemented" },
    { name: "meta.pages", type: "array", description: "Páginas relacionadas (título + thumbnail).", presence: "common", status: "implemented" },
    { name: "image", type: "string", description: "Thumbnail da página principal.", presence: "conditional", status: "implemented" },
  ],
  derivations: ["linha do tempo por século", "entidades recorrentes"],
  limits: ["Conteúdo curado pela Wikipédia (não exaustivo)"],
  reliability: REL_DASHBOARD,
  references: [
    { label: "Wikimedia Feed API — onthisday", url: "https://api.wikimedia.org/wiki/Feed_API" },
    ...REF_DISCOVER,
  ],
};

export const GOOGLENEWS_AUDIT: AuditSource = {
  id: "googlenews", order: 42, name: "Google News (RSS)", category: "Notícias",
  status: "audited", implemented: true, sourceId: "discover-googlenews",
  summary:
    "Busca no Google News via RSS público (sem chave): manchetes com título, fonte, data e link. Idioma/país configuráveis via hl/gl (ceid derivado).",
  endpoints: [
    { label: "RSS search", url: "https://news.google.com/rss/search?q={query}&hl={hl}&gl={gl}&ceid={ceid}", method: "GET", auth: "nenhuma", status: "implemented" },
    { label: "Rota do sistema", url: "POST /functions/v1/uni-discover {source: \"googlenews\", query, hl?, gl?}", method: "POST", auth: "nenhuma (servidor local)", status: "implemented" },
    { label: "GNews API v4 — search", url: "https://gnews.io/api/v4/search?q={q}&lang={lang}&country={country}&from={from}&to={to}&in={in}&sortby={sortby}&max={max}&apikey={GNEWS_API_KEY}", method: "GET", auth: "GNEWS_API_KEY", notes: "API com chave do notebook gnews-fonte: janelas de data, escopo e ordenação.", status: "available" },
    { label: "GNews API v4 — top-headlines", url: "https://gnews.io/api/v4/top-headlines?category={category}&lang={lang}&country={country}", method: "GET", auth: "GNEWS_API_KEY", notes: "Manchetes por categoria (general/world/business/technology/entertainment/sports/science/health).", status: "available" },
  ],
  parameters: [
    { name: "query", type: "string", description: "Obrigatório. Termo de busca.", status: "implemented" },
    { name: "hl", type: "string", description: "Idioma.", options: ["pt-BR", "en-US", "es-ES", "…"], default: "pt-BR", status: "implemented" },
    { name: "gl", type: "string", description: "País.", options: ["BR", "US", "PT", "…"], default: "BR", status: "implemented" },
    { name: "from/to (GNews)", type: "data ISO", description: "Janela de datas da busca (GNews API).", status: "available" },
    { name: "in (search_in)", type: "enum", description: "Escopo do termo.", options: ["title", "description", "content", "all"], status: "available" },
    { name: "sortby", type: "enum", description: "Ordenação.", options: ["publishedAt", "relevance"], status: "available" },
    { name: "max (GNews)", type: "number", description: "Tamanho da página (1–100 na GNews; grátis limita).", status: "available" },
  ],
  capabilities: [
    { label: "Busca de notícias por termo", status: "implemented" },
    { label: "Variação idioma × país", status: "implemented" },
    { label: "Janela de datas from/to (GNews API)", status: "available", notes: "O RSS é sempre 'agora'; a janela só vem com a API com chave." },
    { label: "Escopo do termo: título/descrição/conteúdo/todos (GNews API)", status: "available" },
    { label: "Ordenação por relevância (GNews API sortBy=relevance)", status: "available" },
    { label: "Top-headlines por categoria (GNews API)", status: "available" },
  ],
  combinations: ["query × hl × gl", "query × from/to × in × sortby (GNews API)", "GNews × GDELT (cobertura por veículo vs. cobertura global)"],
  outputs: [
    { name: "title", type: "string", description: "Manchete.", presence: "always", status: "implemented" },
    { name: "subtitle", type: "string", description: "Fonte (veículo).", presence: "common", status: "implemented" },
    { name: "url", type: "string", description: "Link de redirect do Google News.", presence: "always", status: "implemented" },
    { name: "publishedAt", type: "string", description: "Data de publicação.", presence: "always", status: "implemented" },
  ],
  derivations: ["veículos mais frequentes", "frequência de publicação por hora", "full-content via GNews (com chave)"],
  limits: ["RSS trunca (~100 itens)", "links são redirects do Google (não a URL final)", "GNews API com chave: cota por plano (free ~100 req/dia)"],
  reliability: REL_DASHBOARD,
  references: [
    { label: "Google News RSS (público)", url: "https://news.google.com/rss" },
    { label: "Notebook de testes (gnews-fonte)", url: "docs/fontes/notebooks/gnews-fonte.md" },
    { label: "Saídas de exemplo (gnews-output)", url: "docs/fontes/notebooks/gnews-output.md" },
    { label: "GNews API (docs)", url: "https://gnews.io/docs/v4" },
    ...REF_DISCOVER,
  ],
};

export const APPLE_PODCASTS_AUDIT: AuditSource = {
  id: "apple-podcasts", order: 43, name: "Apple Podcasts (top)", category: "Mídia",
  status: "audited", implemented: true, sourceId: "discover-podcasts",
  summary:
    "Top podcasts da Apple por país, via RSS público do iTunes (toppodcasts). Retorna nome, artista, imagem e link.",
  endpoints: [
    { label: "Top podcasts RSS", url: "https://itunes.apple.com/{cc}/rss/toppodcasts/limit={n}/json", method: "GET", auth: "nenhuma", status: "implemented" },
    { label: "Rota do sistema", url: "POST /functions/v1/uni-discover {source: \"podcasts\", country?, limit?}", method: "POST", auth: "nenhuma (servidor local)", status: "implemented" },
  ],
  parameters: [
    { name: "country", type: "string", description: "País da loja.", options: ["br", "us", "pt", "…"], default: "br", status: "implemented" },
    { name: "limit", type: "number", description: "Quantidade (1–100).", range: "1–100", default: "50", status: "implemented" },
  ],
  capabilities: [
    { label: "Top podcasts por país", status: "implemented" },
    { label: "Limite configurável (1–100)", status: "implemented" },
  ],
  combinations: ["country × limit"],
  outputs: [
    { name: "title", type: "string", description: "Nome do podcast.", presence: "always", status: "implemented" },
    { name: "subtitle", type: "string", description: "Artista.", presence: "common", status: "implemented" },
    { name: "image", type: "string", description: "Capa.", presence: "always", status: "implemented" },
    { name: "url", type: "string", description: "Link iTunes.", presence: "always", status: "implemented" },
  ],
  derivations: ["presença recorrente no top (mesclando coletas)"],
  limits: ["Somente ranking (sem episódios/reviews)"],
  reliability: REL_DASHBOARD,
  references: [
    { label: "iTunes RSS Generator", url: "https://rss.itunes.apple.com/" },
    ...REF_DISCOVER,
  ],
};

export const COINGECKO_AUDIT: AuditSource = {
  id: "coingecko", order: 44, name: "CoinGecko (trending)", category: "Cripto",
  status: "audited", implemented: true, sourceId: "discover-crypto",
  summary:
    "Moedas em alta (trending) da CoinGecko: nome, símbolo, market cap rank, preço e variação 24h. API pública sem chave (com rate-limit por IP).",
  endpoints: [
    { label: "Trending", url: "https://api.coingecko.com/api/v3/search/trending", method: "GET", auth: "nenhuma", status: "implemented" },
    { label: "Rota do sistema", url: "POST /functions/v1/uni-discover {source: \"crypto\"}", method: "POST", auth: "nenhuma (servidor local)", status: "implemented" },
  ],
  parameters: [
    { name: "include_platform", type: "boolean", description: "Inclui endereços de contrato das plataformas no trending.", options: ["true", "false"], default: "false", status: "available" },
  ],
  capabilities: [
    { label: "Trending coins (~15 moedas)", status: "implemented" },
    { label: "Market data embutida no trending (preço, variação 24h)", status: "partial" },
    { label: "Histórico/graf de preços (endpoints /coins/*)", status: "available", notes: "A API oferece; não coletado." },
  ],
  combinations: [],
  outputs: [
    { name: "title", type: "string", description: "Nome da moeda.", presence: "always", status: "implemented" },
    { name: "subtitle", type: "string", description: "Símbolo.", presence: "common", status: "implemented" },
    { name: "image", type: "string", description: "Thumb.", presence: "always", status: "implemented" },
    { name: "meta.market_cap_rank", type: "number", description: "Posição por market cap.", presence: "common", status: "implemented" },
    { name: "meta.price_brl", type: "number", description: "Preço em BRL.", presence: "conditional", status: "implemented" },
    { name: "meta.change_24h", type: "number", description: "Variação % 24h.", presence: "conditional", status: "implemented" },
  ],
  derivations: ["variação média do trending", "recorrência de moedas entre coletas"],
  limits: ["Rate-limit agressivo por IP (plano free)", "somente trending (sem histórico)"],
  reliability: {
    ...REL_DASHBOARD,
    risks: ["Rate-limit por IP (HTTP 429 no plano free)"],
  },
  references: [
    { label: "CoinGecko API v3", url: "https://www.coingecko.com/en/api/documentation" },
    ...REF_DISCOVER,
  ],
};

export const STEAMTOP_AUDIT: AuditSource = {
  id: "steamtop", order: 45, name: "Steam Top (SteamSpy)", category: "Jogos",
  status: "audited", implemented: true, sourceId: "discover-steamtop",
  summary:
    "Top jogos da Steam via SteamSpy: top 100 das últimas 2 semanas, de todos os tempos ou mais possuídos — com owners estimados, preço e score.",
  endpoints: [
    { label: "SteamSpy top", url: "https://steamspy.com/api.php?request={top100in2weeks|top100forever|top100owned}", method: "GET", auth: "nenhuma", notes: "Limite de 1 req/s por IP.", status: "implemented" },
    { label: "Rota do sistema", url: "POST /functions/v1/uni-discover {source: \"steamtop\", request?}", method: "POST", auth: "nenhuma (servidor local)", status: "implemented" },
  ],
  parameters: [
    { name: "request", type: "enum", description: "Ranking desejado.", options: ["top100in2weeks", "top100forever", "top100owned"], default: "top100in2weeks", status: "implemented" },
  ],
  capabilities: [
    { label: "3 rankings (2 semanas / sempre / mais possuídos)", status: "implemented" },
  ],
  combinations: ["request"],
  outputs: [
    { name: "title", type: "string", description: "Nome do jogo.", presence: "always", status: "implemented" },
    { name: "score", type: "number", description: "Owners estimados.", presence: "common", status: "implemented" },
    { name: "meta.appid", type: "number", description: "AppID Steam.", presence: "always", status: "implemented" },
    { name: "meta.price", type: "string", description: "Preço.", presence: "conditional", status: "implemented" },
  ],
  derivations: ["interseção entre rankings", "faixa de preço do top"],
  limits: ["1 req/s por IP (SteamSpy)", "owners são estimativas"],
  reliability: {
    ...REL_DASHBOARD,
    risks: ["SteamSpy limita a 1 requisição/segundo por IP"],
  },
  references: [
    { label: "SteamSpy API", url: "https://steamspy.com/api.php" },
    ...REF_DISCOVER,
  ],
};

export const OPEN_METEO_AUDIT: AuditSource = {
  id: "open-meteo", order: 46, name: "Open-Meteo (clima)", category: "Clima",
  status: "audited", implemented: true, sourceId: "discover-clima",
  summary:
    "Clima atual de até 10 cidades por coleta (lat/lon), via Open-Meteo sem chave: temperatura, sensação, umidade, precipitação, código de tempo e vento.",
  endpoints: [
    { label: "Forecast current", url: "https://api.open-meteo.com/v1/forecast?latitude=…&longitude=…&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m", method: "GET", auth: "nenhuma", status: "implemented" },
    { label: "Rota do sistema", url: "POST /functions/v1/uni-discover {source: \"clima\", cities: [{name, lat, lon}]}", method: "POST", auth: "nenhuma (servidor local)", status: "implemented" },
  ],
  parameters: [
    { name: "cities", type: "array", description: "Obrigatório. Até 10 cidades com name/lat/lon.", status: "implemented" },
  ],
  capabilities: [
    { label: "Clima atual multi-cidade (até 10)", status: "implemented" },
    { label: "Previsão (hourly/daily)", status: "available", notes: "A API oferece; o sistema coleta só o current." },
  ],
  combinations: ["cities (até 10)"],
  outputs: [
    { name: "title", type: "string", description: "Cidade.", presence: "always", status: "implemented" },
    { name: "subtitle", type: "string", description: "Resumo (ex.: 24°C, vento 12 km/h).", presence: "always", status: "implemented" },
    { name: "meta.temperature", type: "number", description: "Temperatura (°C).", presence: "always", status: "implemented" },
    { name: "meta.humidity", type: "number", description: "Umidade relativa (%).", presence: "always", status: "implemented" },
    { name: "meta.weather_code", type: "number", description: "Código WMO do tempo.", presence: "always", status: "implemented" },
  ],
  derivations: ["mapa de temperaturas", "alertas por código de tempo"],
  limits: ["Somente current (sem previsão) na coleta atual"],
  reliability: REL_DASHBOARD,
  references: [
    { label: "Open-Meteo API", url: "https://open-meteo.com/en/docs" },
    ...REF_DISCOVER,
  ],
};

export const BRASIL_AUDIT: AuditSource = {
  id: "brasil", order: 47, name: "Brasil (feriados, taxas, câmbio, IBGE)", category: "Brasil",
  status: "audited", implemented: true, sourceId: "discover-brasil",
  summary:
    "Dados públicos do Brasil em uma seção: feriados nacionais (BrasilAPI), taxas Selic/CDI/IPCA (BrasilAPI), câmbio (Frankfurter/BCE) e nomes mais comuns por localidade (IBGE).",
  endpoints: [
    { label: "Feriados", url: "https://brasilapi.com.br/api/feriados/v1/{ano}", method: "GET", auth: "nenhuma", status: "implemented" },
    { label: "Taxas", url: "https://brasilapi.com.br/api/taxas/v1", method: "GET", auth: "nenhuma", status: "implemented" },
    { label: "Câmbio", url: "https://api.frankfurter.app/latest?from={base}&to={symbols}", method: "GET", auth: "nenhuma", status: "implemented" },
    { label: "IBGE nomes", url: "https://servicodados.ibge.gov.br/api/v2/censos/nomes/ranking?localidade={loc}", method: "GET", auth: "nenhuma", status: "implemented" },
    { label: "Rota do sistema", url: "POST /functions/v1/uni-discover {source: \"brasil\", resource?}", method: "POST", auth: "nenhuma (servidor local)", status: "implemented" },
  ],
  parameters: [
    { name: "resource", type: "enum", description: "Recurso a coletar.", options: ["feriados", "taxas", "cambio", "nomes"], status: "implemented" },
    { name: "ano", type: "number", description: "Ano (para feriados).", status: "implemented" },
    { name: "base/symbols", type: "string", description: "Moedas (para câmbio; default USD → BRL,EUR,GBP,JPY,ARS).", status: "implemented" },
  ],
  capabilities: [
    { label: "4 recursos públicos brasileiros", status: "implemented" },
    { label: "CEP/DDD/CNPJ/ISBN (BrasilAPI)", status: "available", notes: "A BrasilAPI oferece; não coletado nesta seção." },
  ],
  combinations: ["resource × ano", "resource × base/symbols"],
  outputs: [
    { name: "title", type: "string", description: "Nome do dado.", presence: "always", status: "implemented" },
    { name: "subtitle", type: "string", description: "Detalhe (data, valor…).", presence: "common", status: "implemented" },
    { name: "publishedAt", type: "string", description: "Data (feriados).", presence: "conditional", status: "implemented" },
    { name: "score", type: "number", description: "Valor (taxas/câmbio).", presence: "conditional", status: "implemented" },
  ],
  derivations: ["próximos feriados", "histórico de câmbio (mesclando coletas)"],
  limits: ["Cada recurso é uma API distinta (disponibilidade independente)"],
  reliability: REL_DASHBOARD,
  references: [
    { label: "BrasilAPI", url: "https://brasilapi.com.br/docs" },
    { label: "Frankfurter (ECB rates)", url: "https://www.frankfurter.app/docs/" },
    ...REF_DISCOVER,
  ],
};

export const DEEZER_AUDIT: AuditSource = {
  id: "deezer", order: 48, name: "Deezer (música)", category: "Mídia",
  status: "audited", implemented: true, sourceId: "discover-music",
  summary:
    "Busca e charts de música da Deezer sem chave: faixas, artistas e álbuns com preview de 30s, capa e rank.",
  endpoints: [
    { label: "Search", url: "https://api.deezer.com/search?q={query}&limit={n}", method: "GET", auth: "nenhuma", status: "implemented" },
    { label: "Chart", url: "https://api.deezer.com/chart", method: "GET", auth: "nenhuma", status: "implemented" },
    { label: "Rota do sistema", url: "POST /functions/v1/uni-discover {source: \"music\", resource?, query?, limit?}", method: "POST", auth: "nenhuma (servidor local)", status: "implemented" },
  ],
  parameters: [
    { name: "resource", type: "enum", description: "Busca ou chart.", options: ["search", "chart"], default: "chart", status: "implemented" },
    { name: "query", type: "string", description: "Termo (obrigatório para search).", status: "implemented" },
    { name: "limit", type: "number", description: "Quantidade (1–100).", range: "1–100", default: "25", status: "implemented" },
  ],
  capabilities: [
    { label: "Busca de faixas", status: "implemented" },
    { label: "Chart global", status: "implemented" },
    { label: "Preview de 30s (URL de áudio)", status: "implemented" },
  ],
  combinations: ["resource × query × limit"],
  outputs: [
    { name: "title", type: "string", description: "Faixa.", presence: "always", status: "implemented" },
    { name: "subtitle", type: "string", description: "Artista.", presence: "common", status: "implemented" },
    { name: "image", type: "string", description: "Capa.", presence: "common", status: "implemented" },
    { name: "meta.preview", type: "string", description: "URL do preview de 30s.", presence: "common", status: "implemented" },
    { name: "meta.rank", type: "number", description: "Rank Deezer.", presence: "conditional", status: "implemented" },
  ],
  derivations: ["artistas recorrentes", "duração média das faixas"],
  limits: ["Preview limitado a 30s", "sem letras"],
  reliability: REL_DASHBOARD,
  references: [
    { label: "Deezer API", url: "https://developers.deezer.com/api" },
    ...REF_DISCOVER,
  ],
};

export const OPENLIBRARY_TRENDING_AUDIT: AuditSource = {
  id: "openlibrary-trending", order: 49, name: "Open Library Trending", category: "Livros",
  status: "audited", implemented: true, sourceId: "discover-books",
  summary:
    "Livros em alta da Open Library por período (daily/weekly/monthly/yearly/forever): título, autor, ano e capa.",
  endpoints: [
    { label: "Trending", url: "https://openlibrary.org/trending/{period}.json", method: "GET", auth: "nenhuma", status: "implemented" },
    { label: "Rota do sistema", url: "POST /functions/v1/uni-discover {source: \"books\", period?}", method: "POST", auth: "nenhuma (servidor local)", status: "implemented" },
  ],
  parameters: [
    { name: "period", type: "enum", description: "Período do trending.", options: ["daily", "weekly", "monthly", "yearly", "forever"], default: "daily", status: "implemented" },
  ],
  capabilities: [
    { label: "Trending por 5 períodos", status: "implemented" },
  ],
  combinations: ["period"],
  outputs: [
    { name: "title", type: "string", description: "Título.", presence: "always", status: "implemented" },
    { name: "subtitle", type: "string", description: "Autor.", presence: "common", status: "implemented" },
    { name: "image", type: "string", description: "Capa (cover_i).", presence: "conditional", status: "implemented" },
    { name: "meta.first_publish_year", type: "number", description: "Ano da 1ª publicação.", presence: "common", status: "implemented" },
  ],
  derivations: ["autores mais frequentes", "distribuição por década"],
  limits: ["Somente trending (a busca fica na fonte Open Library principal)"],
  reliability: REL_DASHBOARD,
  references: [
    { label: "Open Library APIs", url: "https://openlibrary.org/developers/api" },
    ...REF_DISCOVER,
  ],
};

export const NPM_DOWNLOADS_AUDIT: AuditSource = {
  id: "npm-downloads", order: 50, name: "npm Downloads", category: "Pacotes",
  status: "audited", implemented: true, sourceId: "discover-packages",
  summary:
    "Downloads de pacotes npm por período (last-day/week/month/year), até 20 pacotes por coleta — comparativo direto de adoção.",
  endpoints: [
    { label: "Downloads point", url: "https://api.npmjs.org/downloads/point/{period}/{pkg1,pkg2,…}", method: "GET", auth: "nenhuma", status: "implemented" },
    { label: "Rota do sistema", url: "POST /functions/v1/uni-discover {source: \"packages\", packages: [], period?}", method: "POST", auth: "nenhuma (servidor local)", status: "implemented" },
  ],
  parameters: [
    { name: "packages", type: "array", description: "Obrigatório. Até 20 nomes de pacotes.", status: "implemented" },
    { name: "period", type: "enum", description: "Período.", options: ["last-day", "last-week", "last-month", "last-year"], default: "last-week", status: "implemented" },
  ],
  capabilities: [
    { label: "Comparativo de downloads multi-pacote (até 20)", status: "implemented" },
    { label: "4 períodos", status: "implemented" },
    { label: "Série range (start/end) — /range/", status: "available", notes: "A API oferece; não coletado." },
  ],
  combinations: ["packages × period"],
  outputs: [
    { name: "title", type: "string", description: "Pacote.", presence: "always", status: "implemented" },
    { name: "score", type: "number", description: "Downloads no período.", presence: "always", status: "implemented" },
  ],
  derivations: ["ranking comparativo", "razão entre concorrentes"],
  limits: ["Até 20 pacotes por coleta", "dados agregados (sem série diária no point)"],
  reliability: REL_DASHBOARD,
  references: [
    { label: "npm Downloads API", url: "https://github.com/npm/registry/blob/main/docs/download-counts.md" },
    ...REF_DISCOVER,
  ],
};

export const GITHUB_TRENDING_AUDIT: AuditSource = {
  id: "github-trending", order: 51, name: "GitHub Trending", category: "Código",
  status: "audited", implemented: true, sourceId: "discover-github-trending",
  summary:
    "Repositórios em alta do GitHub (página pública /trending), por linguagem e período (daily/weekly/monthly), extraídos do HTML — sem API oficial.",
  endpoints: [
    { label: "Trending (scrape)", url: "https://github.com/trending/{language}?since={daily|weekly|monthly}", method: "GET", auth: "nenhuma", notes: "Extração da página pública — pode mudar o HTML sem aviso.", status: "implemented" },
    { label: "Rota do sistema", url: "POST /functions/v1/uni-discover {source: \"github-trending\", language?, since?}", method: "POST", auth: "nenhuma (servidor local)", status: "implemented" },
  ],
  parameters: [
    { name: "language", type: "string", description: "Linguagem (vazio = todas).", options: ["", "typescript", "python", "rust", "…"], status: "implemented" },
    { name: "since", type: "enum", description: "Período.", options: ["daily", "weekly", "monthly"], default: "daily", status: "implemented" },
  ],
  capabilities: [
    { label: "Trending por linguagem × período", status: "implemented" },
  ],
  combinations: ["language × since"],
  outputs: [
    { name: "title", type: "string", description: "owner/repo.", presence: "always", status: "implemented" },
    { name: "subtitle", type: "string", description: "Descrição.", presence: "common", status: "implemented" },
    { name: "meta.language", type: "string", description: "Linguagem principal.", presence: "common", status: "implemented" },
    { name: "meta.stars_today", type: "number", description: "Estrelas no período.", presence: "common", status: "implemented" },
    { name: "url", type: "string", description: "Link do repo.", presence: "always", status: "implemented" },
  ],
  derivations: ["linguagens mais frequentes", "recorrência de repos entre períodos"],
  limits: ["Scrape de HTML (frágil a mudanças de layout)", "sem SLA oficial"],
  reliability: {
    ...REL_DASHBOARD,
    stability: "Extração da página pública do GitHub (pode mudar o HTML sem aviso).",
  },
  references: [
    { label: "GitHub Trending (página pública)", url: "https://github.com/trending" },
    ...REF_DISCOVER,
  ],
};

export const MASTODON_TRENDS_AUDIT: AuditSource = {
  id: "mastodon-trends", order: 52, name: "Mastodon Trends", category: "Social",
  status: "audited", implemented: true, sourceId: "discover-mastodon-trends",
  summary:
    "Tendências de uma instância Mastodon (statuses, tags ou links), via API pública v1 sem autenticação.",
  endpoints: [
    { label: "Trends", url: "https://{instance}/api/v1/trends/{statuses|tags|links}?limit={n}", method: "GET", auth: "nenhuma", status: "implemented" },
    { label: "Rota do sistema", url: "POST /functions/v1/uni-discover {source: \"mastodon-trends\", instance?, resource?, limit?}", method: "POST", auth: "nenhuma (servidor local)", status: "implemented" },
  ],
  parameters: [
    { name: "instance", type: "string", description: "Instância.", options: ["mastodon.social", "…"], default: "mastodon.social", status: "implemented" },
    { name: "resource", type: "enum", description: "Tipo de tendência.", options: ["statuses", "tags", "links"], default: "statuses", status: "implemented" },
    { name: "limit", type: "number", description: "Quantidade (1–40).", range: "1–40", default: "20", status: "implemented" },
  ],
  capabilities: [
    { label: "3 recursos de tendência", status: "implemented" },
    { label: "Qualquer instância pública", status: "implemented" },
  ],
  combinations: ["instance × resource × limit"],
  outputs: [
    { name: "title", type: "string", description: "Conteúdo/tag/link.", presence: "always", status: "implemented" },
    { name: "subtitle", type: "string", description: "Detalhe.", presence: "common", status: "implemented" },
    { name: "url", type: "string", description: "Link.", presence: "always", status: "implemented" },
    { name: "meta.uses", type: "number", description: "Usos (tags).", presence: "conditional", status: "implemented" },
  ],
  derivations: ["tags recorrentes", "domínios de links mais compartilhados"],
  limits: ["Cada instância tem disponibilidade própria"],
  reliability: REL_DASHBOARD,
  references: [
    { label: "Mastodon API — trends", url: "https://docs.joinmastodon.org/methods/trends/" },
    ...REF_DISCOVER,
  ],
};

export const URL_RESOLVER_AUDIT: AuditSource = {
  id: "url-resolver", order: 53, name: "URL Resolver (investigador)", category: "Meta",
  status: "audited", implemented: true, sourceId: "discover-resolve",
  summary:
    "Detecta o tipo de qualquer URL colada (13 tipos: youtube, wikipedia, github, npm, pypi, doi, apple-app, google-app, steam, openlibrary, mastodon, reddit, generic) e busca detalhes pela API pública correspondente — o investigador de URLs do /descoberta.",
  endpoints: [
    { label: "Rota do sistema", url: "POST /functions/v1/uni-discover {action: \"resolve\", url}", method: "POST", auth: "nenhuma (servidor local)", notes: "Detalhe cacheado 30min; falha de detalhe vira {error} sem invalidar a resolução.", status: "implemented" },
  ],
  parameters: [
    { name: "url", type: "string", description: "Obrigatório. Aceita também DOI cru (10.xxxx/…).", status: "implemented" },
  ],
  capabilities: [
    { label: "Detecção de 13 tipos de URL", status: "implemented" },
    { label: "Detalhe via API pública (oEmbed, REST summary, registries, Crossref…)", status: "implemented" },
    { label: "fanoutTerm (sugere termo de busca para github/wikipedia/npm/pypi)", status: "implemented" },
    { label: "Hint honesto para tipos sem detalhe direto (google-app, reddit, generic)", status: "implemented" },
  ],
  combinations: ["url × tipo detectado"],
  outputs: [
    { name: "type", type: "string", description: "Tipo detectado.", presence: "always", status: "implemented" },
    { name: "title", type: "string", description: "Título resolvido.", presence: "common", status: "implemented" },
    { name: "subtitle", type: "string", description: "Detalhe.", presence: "common", status: "implemented" },
    { name: "meta", type: "object", description: "Stats reais (estrelas, forks, views…).", presence: "common", status: "implemented" },
    { name: "error", type: "string", description: "Falha de detalhe (não invalida a resolução).", presence: "conditional", status: "implemented" },
  ],
  derivations: ["fan-out para buscas nas fontes correspondentes"],
  limits: ["Detalhe depende da API de cada tipo (rate-limits independentes)"],
  reliability: REL_DASHBOARD,
  references: [
    { label: "server/lib/urlResolver.ts", url: "https://github.com/appdatareview/blob/main/server/lib/urlResolver.ts" },
    ...REF_DISCOVER,
  ],
};

const REL_VOICE = {
  consistency: "Determinístico por modelo — o mesmo áudio/texto produz a mesma saída com o mesmo modelo.",
  stability: "Backends locais (não dependem de API externa após instalados).",
  risks: ["Dependem de instalação local (pip/venv)", "Primeira execução baixa o modelo/voz"],
  fallbacks: ["STT: Web Speech API do navegador → Whisper local", "TTS: vozes do navegador → Piper → espeak"],
};

export const WHISPER_AUDIT: AuditSource = {
  id: "whisper", order: 54, name: "Whisper / faster-whisper (STT local)", category: "Voz",
  status: "audited", implemented: true, sourceId: "voice-stt",
  summary:
    "Transcrição voz→texto LOCAL via faster-whisper (pip) ou whisper-cli+ffmpeg — sem enviar áudio para a nuvem. Modelo configurável (WHISPER_MODEL, default small), device cuda→cpu (WHISPER_DEVICE). Detectado em runtime pelo servidor.",
  endpoints: [
    { label: "STT", url: "POST /functions/v1/stt (áudio bruto, raw 25mb)", method: "POST", auth: "nenhuma (servidor local)", notes: "503 com hint de instalação quando nenhum backend existe.", status: "implemented" },
    { label: "Status", url: "GET /functions/v1/voice-status (refresh=1 re-detecta)", method: "GET", auth: "nenhuma (servidor local)", status: "implemented" },
  ],
  parameters: [
    { name: "lang", type: "string", description: "Idioma (normalizado pt-BR→pt — faster-whisper rejeita tag completa).", options: ["pt", "en", "es", "…"], status: "implemented" },
    { name: "WHISPER_MODEL", type: "env", description: "Modelo (default small).", options: ["tiny", "base", "small", "medium", "large-v3"], default: "small", status: "implemented" },
    { name: "WHISPER_DEVICE", type: "env", description: "Device (default cuda→cpu).", options: ["cuda", "cpu"], status: "implemented" },
  ],
  capabilities: [
    { label: "Transcrição local (faster-whisper)", status: "implemented" },
    { label: "Fallback whisper-cli (whisper.cpp) + ffmpeg", status: "implemented" },
    { label: "Fallback Web Speech API (navegador, nuvem Google)", status: "implemented" },
    { label: "GPU (cuda) quando disponível", status: "implemented" },
  ],
  combinations: ["model × device × lang"],
  outputs: [
    { name: "text", type: "string", description: "Transcrição.", presence: "always", status: "implemented" },
    { name: "engine", type: "string", description: "faster-whisper | whisper-cli.", presence: "always", status: "implemented" },
  ],
  derivations: ["segmentos com timestamps (faster-whisper)", "idioma detectado"],
  limits: ["Requer instalação local (pip install faster-whisper)", "modelos grandes exigem RAM/VRAM"],
  reliability: REL_VOICE,
  references: [
    { label: "faster-whisper", url: "https://github.com/SYSTRAN/faster-whisper" },
    { label: "server/lib/voiceBackends.ts", url: "https://github.com/appdatareview/blob/main/server/lib/voiceBackends.ts" },
  ],
};

export const TIKTOK_AUDIT: AuditSource = {
  id: "tiktok", order: 57, name: "TikTok (oEmbed público)", category: "Social",
  status: "audited", implemented: true, sourceId: "discover-tiktok",
  summary:
    "TikTok oferece um endpoint oficial de oEmbed para qualquer URL de vídeo/perfil (sem auth). Retorna HTML de incorporação + author + thumbnail. Pesquisa ao vivo 2026-08-27: OK ​– links @user/video funcionam.",
  endpoints: [
    { label: "oEmbed TikTok", url: "https://www.tiktok.com/oembed?url=<url>", method: "GET", auth: "nenhuma", notes: "Testado: -G --data-urlencode evita encoding wrong", status: "implemented" },
  ],
  parameters: [
    { name: "url", type: "string", description: "URL do vídeo ou perfil (obrigatório).", status: "implemented" },
  ],
  capabilities: [
    { label: "oEmbed por URL (vídeo/perfil): html + author + thumb + embed_type", status: "implemented" },
  ],
  combinations: ["TikTok × Suggest — intenção de busca em vídeo curto"],
  outputs: [
    { name: "html (embed)", type: "string", description: "Markup de incorporação.", presence: "always", status: "implemented" },
    { name: "author_name", type: "string", description: "Autor do vídeo.", presence: "always", status: "implemented" },
    { name: "thumbnail_url", type: "url", description: "Thumbnail.", presence: "common", status: "implemented" },
    { name: "type", type: "enum", description: "rich/video/photo.", presence: "always", status: "implemented" },
  ],
  derivations: ["embed type (profile vs video)"],
  limits: [
    "Somente metadados básicos do oEmbed (sem views/likes)",
    "Links com chaves criptografadas no invite retornam 400 (testado)",
  ],
  reliability: REL_DASHBOARD,
  references: [
    { label: "oEmbed TikTok (oficial)", url: "https://www.tiktok.com/oembed" },
    { label: "TikTok Embed (dev docs)", url: "https://developers.tiktok.com/docs/en/embed" },
    ...REF_DISCOVER,
  ],
};
export const FACEBOOK_AUDIT: AuditSource = {
  id: "facebook", order: 59, name: "Facebook (marketplace/events limited)", category: "Social",
  status: "audited", implemented: false, sourceId: "discover-facebook",
  summary:
    "Facebook serve Marketplace /events/search sem auth, mas os scripts GraphQL embutidos são opacos (testado 2026-08-27). Graph API exige App + Page Public Content Access.",
  endpoints: [
    { label: "Marketplace Search", url: "https://www.facebook.com/marketplace/search/?query=<q>", method: "GET", auth: "nenhuma", notes: "HTML público", status: "available" },
    { label: "Events Search", url: "https://www.facebook.com/events/search/?q=<q>", method: "GET", auth: "nenhuma", notes: "HTML público", status: "available" },
    { label: "Graph API (com APP_TOKEN)", url: "https://graph.facebook.com/{version}/...", method: "GET", auth: "APP_TOKEN", status: "available" },
  ],
  parameters: [
    { name: "query", type: "string", description: "Termo de busca.", status: "available" },
  ],
  capabilities: [
    { label: "Marketplace/Events HTML público (scrape instável)", status: "available" },
    { label: "Graph API (com App)", status: "available", notes: "Severamente restricted segundo a pesquisa." },
  ],
  combinations: ["Facebook × Suggest — intenção de busca social"],
  outputs: [
    { name: "title (Marketplace)", type: "string", description: "Anúncio.", presence: "always", status: "available", reliability: "scrape HTML" },
    { name: "name (Events)", type: "string", description: "Título do evento.", presence: "always", status: "available", reliability: "scrape HTML" },
    { name: "graphql name/category", type: "string", description: "Nome da página/evento.", presence: "always", status: "available", reliability: "Graph API" },
  ],
  derivations: [],
  limits: ["Scrape HTML instável", "Graph API severamente tamped"],
  reliability: REL_DASHBOARD,
  references: [
    { label: "Facebook Marketplace (public)", url: "https://www.facebook.com/marketplace/search/" },
    { label: "Meta Graph API (dev docs)", url: "https://developers.facebook.com/docs/graph-api" },
    ...REF_DISCOVER,
  ],
};
export const INSTAGRAM_AUDIT: AuditSource = {
  id: "instagram", order: 58, name: "Instagram (oEmbed → login wall)", category: "Social",
  status: "audited", implemented: false, sourceId: "discover-instagram",
  summary:
    "Instagram oEmbed legisla apenas para clientes do Facebook com APP_TOKEN; sem app, o endpoint redireciona para /accounts/login (302, testado 2026-08-27). A Graph API exige Page Public Content Approval.",
  endpoints: [
    { label: "oEmbed Instagram (com Facebook App)", url: "https://www.facebook.com/instagram_oembed?url=<url>", method: "GET", auth: "APP_TOKEN", status: "available" },
  ],
  parameters: [
    { name: "url", type: "string", description: "URL de posts/reels/perfil público.", status: "available" },
  ],
  capabilities: [
    { label: "oEmbed público (com Facebook App)", status: "available" },
    { label: "GraphQL interno sem auth (frágil; doc_id muda)", status: "available", notes: "Pesquisa ao vivo: login wall no sandbox." },
  ],
  combinations: ["Instagram × Suggest — intenção de busca visual"],
  outputs: [],
  derivations: [],
  limits: ["Facebook App + APP_TOKEN necessário", "Page Public Content Approval automático"],
  reliability: REL_DASHBOARD,
  references: [
    { label: "Instagram oEmbed (dev docs)", url: "https://developers.facebook.com/documentation/instagram-platform/oembed" },
    ...REF_DISCOVER,
  ],
};
export const PIPER_AUDIT: AuditSource = {
  id: "piper", order: 55, name: "Piper / espeak-ng (TTS local)", category: "Voz",
  status: "audited", implemented: true, sourceId: "voice-tts",
  summary:
    "Síntese texto→voz LOCAL via Piper (voz neural pt-BR, baixada na 1ª vez) com fallback espeak-ng/espeak — sem nuvem. Resposta WAV com header X-TTS-Engine indicando o motor usado.",
  endpoints: [
    { label: "TTS", url: "POST /functions/v1/tts {text} → WAV", method: "POST", auth: "nenhuma (servidor local)", notes: "Header X-TTS-Engine: piper | espeak. 503 com hint quando nada instalado.", status: "implemented" },
    { label: "Status", url: "GET /functions/v1/voice-status", method: "GET", auth: "nenhuma (servidor local)", status: "implemented" },
  ],
  parameters: [
    { name: "text", type: "string", description: "Obrigatório. Texto a sintetizar.", status: "implemented" },
    { name: "PIPER_MODEL", type: "env", description: "Voz (default pt_BR-faber-medium; baixada automaticamente na 1ª síntese via piper.download_voices).", options: ["pt_BR-faber-medium", "…"], default: "pt_BR-faber-medium", status: "implemented" },
  ],
  capabilities: [
    { label: "Síntese neural pt-BR (Piper)", status: "implemented" },
    { label: "Fallback espeak-ng/espeak (robótico, sempre disponível)", status: "implemented" },
    { label: "Fallback vozes do navegador (speechSynthesis)", status: "implemented" },
    { label: "Download automático da voz na 1ª execução", status: "implemented" },
  ],
  combinations: ["model × text"],
  outputs: [
    { name: "audio/wav", type: "binary", description: "Áudio sintetizado.", presence: "always", status: "implemented" },
    { name: "X-TTS-Engine", type: "string", description: "Header com o motor usado.", presence: "always", status: "implemented" },
  ],
  derivations: [],
  limits: ["Requer instalação local (pip install piper-tts)", "1 voz por modelo instalado"],
  reliability: REL_VOICE,
  references: [
    { label: "Piper TTS", url: "https://github.com/rhasspy/piper" },
    { label: "server/lib/voiceBackends.ts", url: "https://github.com/appdatareview/blob/main/server/lib/voiceBackends.ts" },
  ],
};
