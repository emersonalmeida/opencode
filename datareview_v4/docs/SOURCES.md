# Catálogo de fontes de coleta

59 fontes documentadas. Gerado de `packages/sources/src/catalog/` (fonte de verdade) — não editar à mão; regerar com `pnpm --filter @v4/sources gen:catalog`.

Legenda de status: **PRONTO** = coletor ativo no v4; **PONTE(v1)** = coletor funcional no legado v1, a ser embrulhado por um `SourcePort`; **PLANEJADO** = mapeado, sem coletor ainda.

## Resumo por grupo

| Grupo | Fontes |
|-------|--------|
| Uni — coleta direta (front /00) | 17 |
| Conectores declarativos (uniConnectors) | 17 |
| Descoberta (sem chave) | 17 |
| Lojas e reviews | 3 |
| Conhecimento e infra | 5 |

## Uni — coleta direta (front /00) (17)

| id | label | método | auth | capacidades | parâmetros | dados | recurso | chaves | status |
|----|-------|--------|------|-------------|------------|-------|---------|--------|--------|
| **suggest** | Google Suggest (autocomplete) | api | none | trends, custom | query, lang, gl, ds, limit | text, relevance, seed | https://suggestqueries.google.com/complete/search?client=chrome&q=&gl=&hl=&ds= | — | PONTE(v1) |

> **ToS/restrição:** Autocomplete público; expansion seeds a-z/0-9; verticais via ds ('' web, yt, n, sh).
>
> **Operação:** Testado no v1: 6 itens reais por termo (demo 'nubank').

| **suggest-provider** | Autocomplete multi-provedor | scrape | none | trends, custom | provider, query, limit, lang | text, relevance | POST /functions/v1/uni-suggest-provider | — | PONTE(v1) |

> **ToS/restrição:** 10 provedores: bing, duckduckgo, brave, yahoo, yandex, baidu, naver, amazon, ebay, wikipedia. Cache 10min, timeout 8s.
>
> **Operação:** Bloqueados/nao implementados: tiktok, pinterest, twitch, soundcloud, spotify, walmart/alibaba, apple/play, instagram/x, tenor.

| **trends** | Google Trends (explore) | api | none | trends | terms, region, lang, timeframe, gprop, limit | timeseries, geo_ranking, related_searches | https://trends.google.com/trends/api/explore + widgetdata/multiline\|comparedgeo\|relatedsearches | — | PONTE(v1) |

> **ToS/restrição:** 3 visoes (timeseries/geo/related); mesma tecnica do pytrends; cookie CONSENT.

| **trending** | Google Trends Em alta | api | none | trends, news | geo, hours, limit | title, traffic, link, news_items, geo, hours | https://trends.google.com/trending/rpc?rpcids=i0OFE (batchexecute) + /trending/rss | — | PONTE(v1) |

> **ToS/restrição:** Horas 4/24/48/168 (4h~25, 24h~230, 48h~630, 168h~1800 itens). RSS so top-10.

| **serp** | SERP multi-engine | scrape | byok | search | query, engine, limit, action | rank, title, link, snippet | scraping bing/ddg + API brave/google-cse | BRAVE_API_KEY, GOOGLE_API_KEY, GOOGLE_CX | PONTE(v1) |

> **ToS/restrição:** bing/ddg sem chave; Brave e Google CSE exigem chave BYOK. DDG rate-limita datacenter.

| **youtube** | YouTube | scrape | none | media, social | query, action, limit, order, videoId | videoId, title, channel, published, views, duration, link, thumb | scraping ytInitialData (/results) + youtubei/v1/next (comentarios) | YOUTUBE_API_KEY | PONTE(v1) |

> **ToS/restrição:** Sem chave = scraping; ORDEM relevance/date/views/rating; comentarios ate ~10 paginas.

| **reddit** | Reddit | api | oauth | social | query, action, subreddit, limit | title, url, author, score, subreddit, numComments, created, text | OAuth client_credentials -> oauth.reddit.com; fallback *.json publico | REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET | PONTE(v1) |

> **ToS/restrição:** JSON publico falha em datacenter (403); OAuth robusto.

| **hackernews** | Hacker News | api | none | news, social | query, action, by, sort, limit | id, title, url, author, points, numComments, text, createdAt | https://hn.algolia.com/api/v1/search(_by_date) + /items/{id} | — | PONTE(v1) |

> **ToS/restrição:** Arvore de comentarios achatada; testado no v1 (6 itens demo).

| **gdelt** | GDELT (notícias globais) | api | none | news | query, sort, lang, limit, startDate, endDate | url, title, seendate, sourceCountry, tone, sourceLang | https://api.gdeltproject.org/api/v2/doc/doc?format=json | — | PONTE(v1) |

> **ToS/restrição:** Lang via LANG_MAP (pt/en/es/fr/de/it); campo seendate.

| **arxiv** | arXiv | api | none | academic | query, limit, sortBy | id, title, summary, authors, published, updated, url, pdf, categories | https://export.arxiv.org/api/query?search_query=all: | — | PONTE(v1) |

> **ToS/restrição:** XML atom parseado; paginacao start/max_results. Testado no v1 (3 itens demo).

| **stackexchange** | StackExchange | api | none | academic | query, site, limit, sort | id, title, link, score, answerCount, viewCount, isAnswered, body, createdAt, tags, author | https://api.stackexchange.com/2.3/search/advanced + /questions/{id}/answers | — | PONTE(v1) |

> **ToS/restrição:** Sites: SO, pt.stackoverflow, superuser, serverfault, android, apple, webapps. Testado (6 itens demo).

| **github** | GitHub (Search API) | api | byok | code | query, action, limit, sort, lang, qualifiers | name, description, url, stars, forks, openIssues, language, updatedAt, topics | https://api.github.com/search/repositories + /search/issues | GITHUB_TOKEN | PONTE(v1) |

> **ToS/restrição:** Sem token 10 req/min, com token 30 req/min; erro honesto com reset. Testado (6 itens demo).

| **semanticscholar** | Semantic Scholar | api | none | academic | query, limit, sort | paperId, title, abstract, year, url, citationCount, authors | https://api.semanticscholar.org/graph/v1/paper/search | — | PONTE(v1) |

> **ToS/restrição:** Backoff exponencial em 429 (5 tentativas, timeout 30s).

| **steam** | Steam | api | none | media | query, action, appId, language, limit | name, price, appid, reviewSummary, reviews | https://store.steampowered.com/api/storesearch/?term= (busca real portada; reviews ainda em ponte) | — | PRONTO |

> **ToS/restrição:** 2 acoes (search/reviews); language all/portuguese/english; pais via country (cc).

| **reclameaqui** | ReclameAqui | api | none | reviews | query, action, company, limit | company, complaint, status, date, title, text | https://iosearch.reclameaqui.com.br/raichu-io-site-search-v1/... | — | PONTE(v1) |

> **ToS/restrição:** Protecao Cloudflare -> fallback curl_cffi/Playwright (ra-fetch.py). Status derivado: Replica/Resolvido/Nao resolvido/Respondido/Nao respondido.

| **producthunt** | Product Hunt | feed | byok | media, news | query, action, category, limit | id, name, tagline, url, date, rank, votesCount, commentsCount, topics | https://www.producthunt.com/feed (+?category=) e GraphQL v2 | PRODUCT_HUNT_TOKEN | PONTE(v1) |

> **ToS/restrição:** Feed publico (~50 lancamentos/30min TTL cache); GraphQL v2 com token enriquece votes/comments/topics. Testado (6 itens demo).

| **web** | Web universal (extrator) | other | none | search, custom | action, url, content, limit | title, text, links, feed_items, meta | fetch + extractArticle (Readability-like) + parseFeed + splitTextItems | — | PONTE(v1) |

> **ToS/restrição:** MAX_BYTES 25MB; timeout 30s; MAX_TEXT_CHARS 20000; MAX_FEED_ITEMS 100. Necessita URL/texto.


## Conectores declarativos (uniConnectors) (17)

| id | label | método | auth | capacidades | parâmetros | dados | recurso | chaves | status |
|----|-------|--------|------|-------------|------------|-------|---------|--------|--------|
| **itchio** | itch.io | scrape | none | media | query, limit | title, url, price, description | scraping https://itch.io/search | — | PONTE(v1) |

> **ToS/restrição:** Busca de jogos indie; scrape HTML.

| **devto** | DEV.to | api | none | news, code | query, limit | title, url, author, reactions_count, comments_count, tags, published | https://dev.to/api/articles | — | PONTE(v1) |

| **lobsters** | Lobsters | api | none | news, social | query, limit | title, url, author, score, comments_count | https://lobste.rs/search.json | — | PONTE(v1) |

| **mastodon** | Mastodon | api | none | social | query, hashtag, limit | id, content, author, favourites, reblogs, created, url | https://mastodon.social/api/v1/timelines/tag/{tag} (busca real portada; /api/v2/search precisa de token) | — | PRONTO |

> **ToS/restrição:** Hashtag pública sem auth; query '#termo' ou termo direto.

| **bluesky** | Bluesky | api | none | social | query, limit | uri, text, author, likes, reposts, created, url | https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts | — | PRONTO |

> **ToS/restrição:** Em datacenters pode responder 403 por IP (verificado ao vivo); comportamento honesto.

| **wikidata** | Wikidata | api | none | custom | query, limit | entityId, label, description, claims, url | https://www.wikidata.org/w/api.php (wbsearchentities) | — | PRONTO |

> **ToS/restrição:** Busca pública sem chave; entidades com rótulo/descrição/id.

| **openalex** | OpenAlex | api | none | academic | query, limit | id, title, doi, authors, year, cited_by_count, open_access | https://api.openalex.org/works | — | PRONTO |

> **ToS/restrição:** Busca pública sem chave; papers com doi, autores, citações.

| **crossref** | Crossref | api | none | academic | query, limit | doi, title, authors, year, journal, citation_count | https://api.crossref.org/works | — | PONTE(v1) |

| **openlibrary** | Open Library | api | none | custom | query, limit | title, author, year, isbn, cover, url | https://openlibrary.org/search.json | — | PONTE(v1) |

| **npm** | npm | api | none | code | query, limit | name, version, description, score, downloads, url | https://registry.npmjs.org/-/v1/search?text= | — | PONTE(v1) |

| **pypi** | PyPI | api | none | code | query, limit | name, version, summary, author, license, url | https://pypi.org/pypi/{name}/json | — | PONTE(v1) |

| **rubygems** | RubyGems | api | none | code | query, limit | name, version, info, downloads, authors, url | https://rubygems.org/api/v1/search.json | — | PONTE(v1) |

| **cratesio** | crates.io | api | none | code | query, limit | name, version, description, downloads, recent_downloads, url | https://crates.io/api/v1/crates?q= | — | PONTE(v1) |

| **doaj** | DOAJ (open access) | api | none | academic | query, limit | title, doi, journal, authors, year, url | https://doaj.org/api/search/articles/{query} | — | PONTE(v1) |

| **openfoodfacts** | Open Food Facts | api | none | custom | query, limit | code, name, brands, nutriscore, nova, categories, url | https://world.openfoodfacts.org/cgi/search.pl?search_terms=&search_simple=1&action=process&json=1 | — | PONTE(v1) |

| **archive** | Internet Archive | api | none | media | query, type, limit | identifier, title, creator, date, downloads, type, url | https://archive.org/advancedsearch.php | — | PONTE(v1) |

| **tvmaze** | TVMaze | api | none | media | query, limit | id, name, genres, rating, premiered, status, url, summary | https://api.tvmaze.com/search/shows?q= | — | PONTE(v1) |


## Descoberta (sem chave) (17)

| id | label | método | auth | capacidades | parâmetros | dados | recurso | chaves | status |
|----|-------|--------|------|-------------|------------|-------|---------|--------|--------|
| **wikitop** | Wikipedia top views | api | none | trends | project, date, limit | title, view_count, rank | https://wikimedia.org/api/rest_v1/metrics/pageviews/top/{project}/all-access/ | — | PONTE(v1) |

| **wikiviews** | Wikipedia views por artigo | api | none | trends | project, title, days, limit | title, daily_views, total | https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/... | — | PONTE(v1) |

| **onthisday** | Wikipedia on this day | api | none | custom | lang, type, limit | type, text, year, pages | https://api.wikimedia.org/feed/v1/wikipedia/{lang}/onthisday/{type}/{mm}/{dd} | — | PONTE(v1) |

| **googlenews** | Google News RSS | feed | none | news | query, hl, gl, limit | title, source, published, url | https://news.google.com/rss/search?q=&hl=&gl= | — | PRONTO |

> **ToS/restrição:** Parse RSS/XML, limit 50; locale fixa pt-BR por ora.

| **podcasts** | Apple Podcasts (charts) | feed | none | media | country, limit | title, artist, feed, artwork, rank | https://itunes.apple.com/{cc}/rss/toppodcasts/limit= | — | PONTE(v1) |

| **crypto** | CoinGecko (crypto) | api | none | trends | limit | name, symbol, price, rank, change | https://api.coingecko.com/api/v3/search/trending | — | PONTE(v1) |

| **steamtop** | SteamSpy (top jogos) | api | none | media, trends | request, limit | name, appid, owners, players, price, score | https://steamspy.com/api.php?request=top100in2weeks | — | PONTE(v1) |

> **ToS/restrição:** Rate-limit 1 req/s.

| **weather** | Open-Meteo (clima) | api | none | custom | cities, limit | city, temperature, humidity, precipitation, wind, weathercode | https://api.open-meteo.com/v1/forecast (lat/lon batch) | — | PONTE(v1) |

| **brasilapi-feriados** | Brasil API (feriados) | api | none | custom | year, limit | date, name, type | https://brasilapi.com.br/api/feriados/v1/{year} | — | PONTE(v1) |

| **brasilapi-taxas** | Brasil API (taxas) | api | none | custom | limit | nome, valor, data | https://brasilapi.com.br/api/taxas/v1 | — | PONTE(v1) |

| **frankfurter** | Frankfurter (câmbio) | api | none | custom | base, symbols, limit | date, base, rates | https://api.frankfurter.dev/v1/latest?base=&symbols= | — | PONTE(v1) |

| **ibge-nomes** | IBGE (ranking de nomes) | api | none | custom | limit | nome, frequencia, rank | https://servicodados.ibge.gov.br/api/v2/censos/nomes/ranking | — | PONTE(v1) |

| **deezer** | Deezer (charts) | api | none | media | query, limit | id, title, artist, album, duration, rank, url | https://api.deezer.com/search (busca real portada; chart ainda em ponte) | — | PRONTO |

> **ToS/restrição:** Busca pública sem chave; dados de faixa/artista/álbum.

| **openlibrary-trending** | Open Library (em alta) | api | none | trends, custom | period, limit | title, author, year, score, url | https://openlibrary.org/trending/{daily\|weekly\|monthly}.json | — | PONTE(v1) |

| **npm-downloads** | npm downloads | api | none | code, trends | packages, period, limit | package, downloads, period | https://api.npmjs.org/downloads/point/{last-week}/{pkgs} | — | PONTE(v1) |

> **ToS/restrição:** Ate 20 pacotes por chamada.

| **github-trending** | GitHub trending | scrape | none | code, trends | since, language, limit | name, description, stars, forks, language, url | scraping https://github.com/trending?since=&language= | — | PONTE(v1) |

| **mastodon-trends** | Mastodon trends | api | none | social, trends | instance, kind, limit | content, author, favourites, url, tags, links | https://{instance}/api/v1/trends/statuses\|tags\|links | — | PONTE(v1) |

> **ToS/restrição:** Instancia padrao mastodon.social.


## Lojas e reviews (3)

| id | label | método | auth | capacidades | parâmetros | dados | recurso | chaves | status |
|----|-------|--------|------|-------------|------------|-------|---------|--------|--------|
| **apple** | Apple App Store (reviews) | api | none | reviews, media | appId, country, countries, mode, limit | title, rating, author, date, version, country, helpful, text | amp-api apps.apple.com/api/apps/v1/catalog/{cc}/apps/{id}/reviews + SSR serialized-server-data + RSS itunes customerreviews | — | PONTE(v1) |

> **ToS/restrição:** 3 fontes combinadas (amp-api primaria ~20/pag, SSR suplementar, RSS fallback); teto 500-750 reviews/pais; pau 2 fases (sweep SSR 8 paises + amp-api deep only top storefronts).

| **googleplay** | Google Play (reviews/apps) | api | none | reviews, media | appId, term, action, country, lang, num, collection, category, sort | title, score, author, date, version, thumbsUp, text, appInfo | google-play-scraper (npm) | — | PONTE(v1) |

> **ToS/restrição:** Padrao country br / lang pt_BR; multi-sort com dedupe.

| **itunes-proxy** | iTunes/Apple proxy (passthrough) | other | none | custom | url | raw | allowlist ^https://(itunes\|apps)\.apple\.com/ | — | PRONTO |

> **ToS/restrição:** Proxy pass-through so para hostnames Apple permitidos.


## Conhecimento e infra (5)

| id | label | método | auth | capacidades | parâmetros | dados | recurso | chaves | status |
|----|-------|--------|------|-------------|------------|-------|---------|--------|--------|
| **feed** | RSS/Atom (feed monitor) | feed | none | news, custom | url, limit | title, text, url, author, date, feedUrl | RSS 2.0 e Atom 1.0 (qualquer feed); descoberta via fonte web (acao feed) | — | PONTE(v1) |

> **ToS/restrição:** Requer URL do feed. Agregador multi-feed (OPML), monitoramento com diff de novos, full-text via fonte web quando o feed traz so resumo.

| **paste** | Paste (entrada manual) | other | none | custom | content, limit | title, text | qualquer texto colado vira dados Uni (linhas = itens) | — | PRONTO |

> **ToS/restrição:** Requer texto. No pipeline multifonte e SKIP honesto por design (fontes que exigem texto sao puladas com razao).

| **custom** | Fontes customizadas (qualquer JSON) | other | byok | custom | urlTemplate, listPath, fields, query, limit | title, text, url, author, date, score | qualquer API publica JSON: urlTemplate {q}/{limit}, listPath dot-path, mapa de campos e auth opcional (header/query/bearer) | — | PRONTO |

> **ToS/restrição:** A chave NUNCA e persistida no servidor (byok no browser). Templates prontos disponiveis.

| **wikipedia** | Wikipedia (busca/artigo) | api | none | custom | query, action, title, limit | title, pageid, snippet, extract, ns, size, wordcount, timestamp | https://pt.wikipedia.org/w/api.php?action=query list=search / prop=extracts | — | PONTE(v1) |

> **ToS/restrição:** Testado no v1 (6 itens demo).

| **embed-search** | Resolução de URL (fanout) | api | none | custom | url | kind, id, apiUrl, fanoutTerm | urlResolver.resolveUrl (youtube/wikipedia/github/npm/pypi/doi/apple/google/steam/openlibrary/mastodon/reddit) | — | PRONTO |

> **ToS/restrição:** Roteador: caracteriza URL e devolve a fonte correspondente.


---

## Totais

| Métrica | Valor |
|---------|-------|
| Fontes documentadas | 59 |
| Prontas / ponte v1 | 59 |
| Planejadas | 0 |
