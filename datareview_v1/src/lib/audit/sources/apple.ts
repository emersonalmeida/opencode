import type { AuditSource } from "../auditModel";

/**
 * Auditoria maximalista — APPLE APP STORE.
 *
 * Base: docs/fontes/apple-app-store-2026-08-25.md (canônica), a implementação
 * (server/routes/appleReviews.ts + itunesProxy.ts, src/lib/appStoreApi.ts) e a
 * memória do projeto (AGENTS.md) com os rendimentos medidos ao vivo.
 */
export const APPLE_AUDIT: AuditSource = {
  id: "apple",
  order: 7,
  name: "Apple App Store",
  category: "Loja iOS",
  status: "audited",
  implemented: true,
  summary:
    "A fonte canônica do sistema para iOS. Metadados (search/lookup/top charts) via iTunes Search API estável (pública, sem auth, proxy próprio) e REVIEWS via 3 fontes combinadas: (1) amp-api via apps.apple.com — o JSON API do web App Store, ~20/página com cursor de offset, rende centenas a milhares por app mas tem rate-limit 429 agressivo por IP; (2) scraping SSR da página pública do app em ~50 storefronts — ~24-40 reviews 'most helpful' por país, nunca rate-limited; (3) RSS legado como fallback (quase morto pela Apple). Rendimento real medido: Nubank 382-1000, Binance 596, apps regionais ~100-130.",
  endpoints: [
    {
      label: "iTunes Search",
      url: "https://itunes.apple.com/search?term=<t>&entity=software&country=<cc>&limit=<n>&lang=<l>",
      method: "GET",
      auth: "nenhuma",
      notes: "Busca de apps (via itunes-proxy do servidor para evitar CORS).",
      status: "implemented",
    },
    {
      label: "iTunes Lookup",
      url: "https://itunes.apple.com/lookup?id=<appId>&country=<cc>",
      method: "GET",
      auth: "nenhuma",
      notes: "Metadados completos do app (nota da loja, ratings, versão, tamanho, gêneros, screenshots, vendedor…).",
      status: "implemented",
    },
    {
      label: "amp-api (reviews, PRIMÁRIO)",
      url: "https://apps.apple.com/api/apps/v1/catalog/{cc}/apps/{id}/reviews?offset=<cursor>",
      method: "GET",
      auth: "nenhuma (proxied via apps.apple.com — sem token bearer)",
      notes: "~20 reviews/página com paginação profunda (~500-750/país). MAIOR rendimento. Rate-limit 429 agressivo por IP (retry 1-3s ×3, fase pula graciosamente). Campo de texto = `review`.",
      status: "implemented",
    },
    {
      label: "SSR da página pública (reviews, SUPLEMENTO)",
      url: "https://apps.apple.com/{cc}/app/id{appId}",
      method: "GET",
      auth: "nenhuma",
      notes: "~24-40 reviews 'most helpful' no <script id='serialized-server-data'>. Varredura ~50 storefronts com concorrência 8. NUNCA é rate-limited; adiciona reviews que o amp-api omite (sort diferente).",
      status: "implemented",
    },
    {
      label: "RSS legado (reviews, FALLBACK)",
      url: "https://itunes.apple.com/{cc}/rss/customerreviews/...",
      method: "GET",
      auth: "nenhuma",
      notes: "Apple deprecou: retorna feed.entry null na maioria das páginas/apps. Ocasionalmente recupera reviews esparsos.",
      status: "implemented",
    },
    {
      label: "Top Charts",
      url: "via itunes-proxy (top-free / top-paid / top-grossing × ~60 países × 36 gêneros)",
      method: "GET",
      auth: "nenhuma",
      notes: "Listas oficiais de ranking por país e categoria.",
      status: "implemented",
    },
    {
      label: "Rota do sistema (reviews)",
      url: "POST /functions/v1/apple-reviews {appId, country, maxReviews}",
      method: "POST",
      auth: "nenhuma (servidor local)",
      notes: "3 fases: A=SSR broad sweep (~50 países) → B=amp-api deep (top storefronts por volume) → C=RSS fallback. Dedup por id, hard cap 5.000/chamada (10.000 no sistema).",
      status: "implemented",
    },
  ],
  parameters: [
    { name: "term / entity / country / limit / lang", type: "search", description: "Busca iTunes: termo livre, entity=software, storefront, quantidade, idioma.", status: "implemented" },
    { name: "attribute (term vs genre)", type: "enum", description: "Campo alvo da busca iTunes (software/genre/…).", options: ["software", "genre", "..."], status: "implemented" },
    { name: "explicit", type: "bitfield", description: "Incluir/excluir apps explícitos (explicit=1/0).", status: "implemented" },
    { name: "id (lookup)", type: "string", description: "ID numérico do app (ex.: Nubank = 814456780). Também aceita bundleId.", status: "implemented" },
    { name: "maxReviews", type: "number", description: "Alvo de reviews por app; configuração global do usuário (1–10.000).", range: "1–10000", status: "implemented" },
    { name: "sort (hint)", type: "enum", description: "Apple não expõe sort na fonte: `recent` pula o sweep SSR e prioriza o amp-api; `helpful` roda o SSR (most helpful) primeiro. Ordenação final aplicada client-side.", options: ["recent", "helpful", "rating", "mixed"], status: "implemented" },
    { name: "country (SSR sweep)", type: "string[]", description: "~50 storefronts varridos na fase SSR; amp-api deep nos top storefronts (6/10/14 conforme o alvo — deepCountriesForTarget).", status: "implemented" },
    { name: "App Store Connect API (JWT)", type: "auth", description: "Reviews de apps PRÓPRIOS via API oficial com JWT — útil para devs auditarem o próprio app. Não implementado.", status: "available" },
  ],
  capabilities: [
    { label: "Busca de apps por termo (com país e idioma)", status: "implemented" },
    { label: "Metadados completos (lookup): nota da loja, ratings, versão, tamanho, gêneros, vendedor, screenshots, datas", status: "implemented" },
    { label: "Reviews em massa (3 fontes combinadas, dedup por id)", status: "implemented" },
    { label: "Reviews multi-país (cada review carrega o storefront de origem)", status: "implemented" },
    { label: "Top Charts por país e categoria (top-free/top-paid/top-grossing)", status: "implemented" },
    { label: "Coleta limit-aware: aumentar o limite refaz o fetch e mescla (nunca perde dados)", status: "implemented" },
    { label: "Retry com backoff em 429/timeout + fases que pulam graciosamente", status: "implemented" },
    { label: "Coleta NUNCA falha por reviews vazios (o app é salvo com metadados)", status: "implemented" },
    { label: "App Store Connect API (reviews do próprio app com JWT)", status: "available" },
    { label: "Páginas de publisher (todos os apps de um desenvolvedor)", status: "available" },
    { label: "Editorial/featured (apps em destaque)", status: "available" },
    { label: "Histórico de versões completo (lookup traz só a atual)", status: "partial" },
  ],
  combinations: [
    "metadados × reviews — nota da loja vs nota média coletada (divergência honesta)",
    "reviews × storefront — diferenças regionais de recepção",
    "top charts × busca — do ranking ao detalhe ao review em 1 clique",
    "Apple × Google Play — o mesmo app nas duas lojas (comparativo)",
  ],
  outputs: [
    { name: "AppInfo.id / trackId", type: "string", description: "ID numérico do app.", presence: "always", status: "implemented" },
    { name: "AppInfo.name / developer / sellerName", type: "string", description: "Nome, desenvolvedor e vendedor.", presence: "always", status: "implemented" },
    { name: "AppInfo.rating / ratingCount", type: "number", description: "Nota da loja e contagem de avaliações.", presence: "always", status: "implemented" },
    { name: "AppInfo.version / released / updated", type: "string/date", description: "Versão atual e datas de lançamento/atualização.", presence: "always", status: "implemented" },
    { name: "AppInfo.price / currency / formattedPrice", type: "number/string", description: "Preço e moeda do storefront.", presence: "always", status: "implemented" },
    { name: "AppInfo.genres / genreIds", type: "string[]", description: "Gêneros/categorias.", presence: "always", status: "implemented" },
    { name: "AppInfo.size / minOs / contentRating / languages", type: "misto", description: "Tamanho, SO mínimo, classificação e idiomas.", presence: "common", status: "implemented" },
    { name: "ReviewEntry.id / author / title / text", type: "string", description: "Identidade e conteúdo do review.", presence: "always", status: "implemented" },
    { name: "ReviewEntry.rating", type: "1-5", description: "Nota do review.", presence: "always", status: "implemented" },
    { name: "ReviewEntry.date / version / country", type: "misto", description: "Data, versão avaliada e storefront de origem.", presence: "common", status: "implemented" },
    { name: "ReviewEntry.thumbsUp", type: "number", description: "Apple NÃO publica contagem de úteis (existe no Google).", presence: "absent", status: "unavailable" },
    { name: "developerReply", type: "string", description: "Resposta do desenvolvedor ao review.", presence: "rare", status: "implemented" },
  ],
  derivations: [
    "Sentimento determinístico por faixa de nota (enrichment: pos/neu/neg)",
    "Anomalias: regressão de versão, picos de negatividade/volume",
    "Cobertura de campos por app (appCoverage — 55 campos auditados)",
    "Cruzamento reviews×versão×país para diagnósticos regionais",
  ],
  limits: [
    "amp-api: 429 agressivo por IP após volume moderado (IP banido por minutos)",
    "Rendimento varia por app e IP: globais ~400-1000+, regionais ~100-130",
    "RSS legado praticamente morto (Apple deprecou)",
    "Hard cap 5.000 por chamada da rota (10.000 no sistema)",
    "Reviews = amostra pública (a Apple não expõe o total por API pública)",
  ],
  reliability: {
    consistency:
      "Metadados: alta (API estável). Reviews: média-alta — a amostra muda conforme sort/janela das fontes; dedup por id garante estabilidade do conjunto coletado.",
    stability:
      "Alta — 3 fontes combinadas com fases que pulam graciosamente: se o amp-api está rate-limited, o SSR entrega o baseline de centenas de reviews; o app nunca fica sem dados.",
    risks: [
      "Apple matar o amp-api público (mitigado: SSR + RSS continuam)",
      "IP banido por volume alto (mitigado: backoff, fases, SSR broad)",
      "Apps regionais com poucos reviews públicos (limite da fonte, não do sistema)",
    ],
    fallbacks: [
      "amp-api 429 → SSR multi-país (nunca rate-limited)",
      "SSR falha → RSS legado",
      "Tudo falha → app salvo com metadados, reviews vazios (nunca quebra a coleta)",
    ],
  },
  references: [
    { label: "Doc da fonte no sistema", url: "docs/fontes/apple-app-store-2026-08-25.md" },
    { label: "Notebook de testes (appstore-fonte)", url: "docs/fontes/notebooks/appstore-fonte.md" },
    { label: "Saídas de exemplo (stores-output)", url: "docs/fontes/notebooks/stores-output.md" },
    { label: "iTunes Search API", url: "https://performance-partners.apple.com/search-api" },
    { label: "App Store Connect API (oficial, apps próprios)", url: "https://developer.apple.com/documentation/appstoreconnectapi" },
  ],
};
