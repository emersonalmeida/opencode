import type { AuditSource } from "../auditModel";

/**
 * Auditoria maximalista — GOOGLE PLAY.
 *
 * Base: docs/fontes/google-play-2026-08-25.md (canônica), a implementação
 * (server/routes/googlePlay.ts via google-play-scraper) e os rendimentos
 * medidos ao vivo (1000 reviews por app com IDs corretos).
 */
export const GOOGLE_AUDIT: AuditSource = {
  id: "google",
  order: 8,
  name: "Google Play",
  category: "Loja Android",
  status: "audited",
  implemented: true,
  summary:
    "A fonte mais completa do sistema: busca, detalhes (metadados ricos: instalações, nota, histograma de estrelas, permissões, dados de privacidade) e REVIEWS com multi-sort (NEWEST/RATING/HELPFUL) + dedupe por id — 1000 reviews por app verificado ao vivo. Tudo via google-play-scraper (batchexecute interno da Play Store web), sem credencial. Extras únicos vs Apple: thumbsUp por review, resposta do desenvolvedor exposta, histograma de notas e faixas de instalação.",
  endpoints: [
    {
      label: "Rota do sistema (todas as ações)",
      url: "POST /functions/v1/google-play-scraper {action, ...}",
      method: "POST",
      auth: "nenhuma",
      notes: "Wrapper do google-play-scraper com ações search/details/reviews/toplist/similar/permissions/categories/developer.",
      status: "implemented",
    },
    {
      label: "search",
      url: "action=search {term, country, lang, num}",
      method: "POST",
      auth: "nenhuma",
      notes: "Busca de apps por termo com país/idioma.",
      status: "implemented",
    },
    {
      label: "details",
      url: "action=details {appId, country, lang}",
      method: "POST",
      auth: "nenhuma",
      notes: "Metadados completos: instalações (min/max), nota + histograma 1-5★, permissões, privacy info, screenshots, vídeo, datas.",
      status: "implemented",
    },
    {
      label: "reviews (multi-sort)",
      url: "action=reviews {appId, country, lang, num, sort}",
      method: "POST",
      auth: "nenhuma",
      notes: "Sort específico (recent/helpful/rating) ou mixed (NEWEST+RATING+HELPFUL com dedupe por id — máximo rendimento/variedade). Auto-paginação até num ou esgotar token. Verificado: 1000/1000.",
      status: "implemented",
    },
    {
      label: "toplist",
      url: "action=toplist {collection, category, country, num}",
      method: "POST",
      auth: "nenhuma",
      notes: "TOP_FREE / TOP_PAID / GROSSING × categoria × país.",
      status: "implemented",
    },
    {
      label: "similar / developer / permissions / categories",
      url: "action=similar|developer|permissions|categories",
      method: "POST",
      auth: "nenhuma",
      notes: "Apps similares (grafo de concorrentes), página do desenvolvedor, permissões declaradas, lista de categorias.",
      status: "implemented",
    },
  ],
  parameters: [
    { name: "term", type: "string", description: "Termo de busca (action=search).", status: "implemented" },
    { name: "appId (package)", type: "string", description: "Package name real (ex.: Nubank=com.nu.production). IDs errados → 404 → 0 reviews (gotcha documentado).", status: "implemented" },
    { name: "country / lang", type: "string", description: "Storefront e idioma (1 por chamada).", status: "implemented" },
    { name: "num", type: "number", description: "Quantidade alvo (1–10.000; 100→100, 5000→5000 verificado).", range: "1–10000", status: "implemented" },
    { name: "sort", type: "enum", description: "recent (NEWEST) · helpful (HELPFUL) · rating (RATING) · mixed (os 3 com dedupe — máximo rendimento).", options: ["recent", "helpful", "rating", "mixed"], default: "mixed", status: "implemented" },
    { name: "collection / category", type: "enum", description: "Top charts: TOP_FREE/TOP_PAID/GROSSING × categoria × país.", status: "implemented" },
    { name: "fullDetail", type: "boolean", description: "Busca com detalhes completos por resultado (mais lento).", status: "implemented" },
    { name: "reviews multi-idioma em 1 coleta", type: "combinação", description: "Hoje 1 lang por chamada; combinar várias langs seria possível.", status: "available" },
  ],
  capabilities: [
    { label: "Busca de apps por termo (país/idioma)", status: "implemented" },
    { label: "Metadados ricos: instalações (min/max), nota + histograma, permissões, privacy info, screenshots, vídeo", status: "implemented" },
    { label: "Reviews em massa com multi-sort + dedupe (1000/app verificado)", status: "implemented" },
    { label: "thumbsUp por review (alimenta sort 'helpful' e amostragem da IA)", status: "implemented" },
    { label: "developerReply exposta (resposta do dev ao review)", status: "implemented" },
    { label: "Top charts por coleção/categoria/país", status: "implemented" },
    { label: "Apps similares (grafo de concorrentes)", status: "implemented" },
    { label: "Página do desenvolvedor (todos os apps)", status: "implemented" },
    { label: "Permissões declaradas do app", status: "implemented" },
    { label: "Reviews multi-idioma numa única coleta", status: "available" },
    { label: "Histórico de notas da loja ao longo do tempo (scraper é sempre 'agora')", status: "unavailable" },
  ],
  combinations: [
    "reviews × sort — 'helpful' traz os problemas mais votados, 'recent' o pulso atual",
    "reviews × versão — regressão por versão (anomaly detector do Pipeline)",
    "similar × busca — grafo de concorrentes automático",
    "Google Play × Apple — o mesmo app nas duas lojas (comparativo canônico)",
    "toplist × categoria — líderes do nicho",
  ],
  outputs: [
    { name: "AppInfo.id (package)", type: "string", description: "Package name do app.", presence: "always", status: "implemented" },
    { name: "AppInfo.name / developer / developerId", type: "string", description: "Nome e desenvolvedor.", presence: "always", status: "implemented" },
    { name: "AppInfo.rating / ratingCount / histogram", type: "number", description: "Nota da loja, contagem e histograma 1-5★.", presence: "always", status: "implemented" },
    { name: "AppInfo.installs / minInstalls / maxInstalls", type: "faixa", description: "Instalações (faixas: 1M+, 10M+…).", presence: "always", status: "implemented" },
    { name: "AppInfo.price / free / offersIAP / adSupported", type: "misto", description: "Preço, gratuidade, IAP e anúncios.", presence: "always", status: "implemented" },
    { name: "AppInfo.version / updated / released", type: "misto", description: "Versão e datas.", presence: "always", status: "implemented" },
    { name: "AppInfo.permissions / privacyInfo", type: "lista", description: "Permissões e dados de privacidade declarados.", presence: "common", status: "implemented" },
    { name: "ReviewEntry.id / author / text", type: "string", description: "Identidade e conteúdo do review.", presence: "always", status: "implemented" },
    { name: "ReviewEntry.rating / date / version", type: "misto", description: "Nota, data e versão avaliada.", presence: "always", status: "implemented" },
    { name: "ReviewEntry.thumbsUp", type: "number", description: "Contagem de úteis (a Apple não publica).", presence: "always", status: "implemented" },
    { name: "developerReply (texto + data)", type: "objeto", description: "Resposta do desenvolvedor.", presence: "common", status: "implemented" },
    { name: "score histograma ao longo do tempo", type: "série", description: "Histórico da nota da loja (a fonte não expõe).", presence: "absent", status: "unavailable" },
  ],
  derivations: [
    "Sentimento determinístico + anomalias (regressão de versão, picos)",
    "Ranking competitivo (% positivos, volume, nota coletada)",
    "Sort 'helpful' → problemas mais validados pela comunidade",
    "Histograma da loja × distribuição coletada (divergência honesta)",
  ],
  limits: [
    "google-play-scraper usa endpoints internos da Play web (podem mudar sem aviso)",
    "Reviews: amostra pública; paginação para quando o token esgota",
    "1 idioma por chamada (multi-idioma = múltiplas chamadas)",
    "IDs errados (package name) → 404 → 0 reviews (gotcha documentado)",
  ],
  reliability: {
    consistency:
      "Alta — os mesmos parâmetros retornam os mesmos conjuntos (multi-sort determinístico com dedupe por id).",
    stability:
      "Alta — verificado ao vivo 2026-08-17: 1000/1000 reviews em 6 apps reais com IDs corretos; a lib é mantida ativamente.",
    risks: [
      "Google mudar o formato do batchexecute (quebra a lib — dependência externa)",
      "Rate-limit implícito em volume muito alto (multi-sort sequencial mitiga)",
    ],
    fallbacks: [
      "Sort específico falha → outros sorts ainda rendem (mixed)",
      "Sem reviews → app salvo com metadados (coleta nunca quebra)",
    ],
  },
  references: [
    { label: "Doc da fonte no sistema", url: "docs/fontes/google-play-2026-08-25.md" },
    { label: "google-play-scraper (lib)", url: "https://github.com/facundoolano/google-play-scraper" },
  ],
};
