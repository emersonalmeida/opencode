import type { AuditSource } from "../auditModel";

/**
 * Auditoria maximalista — STEAM.
 *
 * Base: docs/fontes/steam-2026-08-25.md + implementação
 * (server/routes/uniSteam.ts + src/lib/uni/uniApi.ts).
 */
export const STEAM_AUDIT: AuditSource = {
  id: "steam",
  order: 9,
  name: "Steam",
  category: "Jogos",
  status: "audited",
  implemented: true,
  sourceId: "steam",
  summary:
    "A maior loja de jogos de PC. Implementada com busca de jogos via scrape do search HTML (seletor a.search_result_row + data-ds-appid — a ordem dos atributos varia, extração é do tag inteiro) e reviews públicos via appreviews JSON (sem auth): texto, autor, data, votos úteis, sinal recomendado/não e HORAS JOGADAS (peso de evidência único — quem jogou mais opina com mais dados). Idioma dos reviews configurável.",
  endpoints: [
    {
      label: "Busca de jogos (scrape HTML)",
      url: "https://store.steampowered.com/search/results/?query&term=<t>",
      method: "GET",
      auth: "nenhuma",
      notes: "HTML público; seletor a.search_result_row + data-ds-appid (ordem dos atributos varia — extrair do tag inteiro).",
      status: "implemented",
    },
    {
      label: "Reviews públicos (appreviews JSON)",
      url: "https://store.steampowered.com/appreviews/<appId>?json=1&language=<l>&num_per_page=<n>",
      method: "GET",
      auth: "nenhuma",
      notes: "JSON público sem auth: texto, autor, data, votes_up, recommended, playtime_at_review. Paginável.",
      status: "implemented",
    },
    {
      label: "Rota do sistema",
      url: "POST /functions/v1/uni-steam {action: search|reviews, query|appId, language, limit}",
      method: "POST",
      auth: "nenhuma (servidor local)",
      status: "implemented",
    },
    {
      label: "appdetails (detalhes do jogo)",
      url: "https://store.steampowered.com/api/appdetails?appids=<id>",
      method: "GET",
      auth: "nenhuma",
      notes: "Preço, gêneros, requisitos — usado pela página Descoberta (resolve steam), não pela Uni.",
      status: "implemented",
    },
  ],
  parameters: [
    { name: "query", type: "string", description: "Nome do jogo (busca).", status: "implemented" },
    { name: "appId", type: "string", description: "ID Steam do jogo (extraído do data-ds-appid na busca).", status: "implemented" },
    { name: "language", type: "enum", description: "Idioma dos reviews.", options: ["all", "portuguese", "english", "spanish", "…"], default: "all", status: "implemented" },
    { name: "limit (num_per_page)", type: "number", description: "Máximo de reviews por chamada.", status: "implemented" },
    { name: "filter", type: "enum", description: "Filtro do appreviews (não implementado).", options: ["recent", "helpful", "all"], status: "available" },
    { name: "review_type", type: "enum", description: "Só positivos / só negativos.", options: ["positive", "negative", "all"], status: "available" },
    { name: "purchase_type", type: "enum", description: "Reviews de quem comprou vs key.", status: "available" },
    { name: "cursor", type: "string", description: "Paginação do appreviews.", status: "available" },
  ],
  capabilities: [
    { label: "Busca de jogos por nome (scrape)", status: "implemented" },
    { label: "Reviews públicos com idioma configurável", status: "implemented" },
    { label: "Sinal binário recomendado/não (sentimento da fonte)", status: "implemented" },
    { label: "Horas jogadas por review (peso de evidência)", status: "implemented" },
    { label: "Votos úteis por review", status: "implemented" },
    { label: "Detalhes do jogo via appdetails (preço, gêneros)", status: "implemented" },
    { label: "Filtros recent/helpful/positive/negative do appreviews", status: "available" },
    { label: "Jogadores simultâneos (steamspy/numbers)", status: "available" },
    { label: "Reviews por período (gráfico temporal)", status: "available" },
  ],
  combinations: [
    "busca → appId → reviews (pipeline completo de um jogo)",
    "reviews × idioma — recepção por região",
    "playtime × recomendado — reviews de quem jogou muito pesam mais",
    "Steam × lojas mobile — o mesmo jogo em PC e mobile",
  ],
  outputs: [
    { name: "title (jogo)", type: "string", description: "Nome do jogo (busca).", presence: "always", status: "implemented" },
    { name: "appId", type: "string", description: "ID Steam (meta).", presence: "always", status: "implemented" },
    { name: "score (busca)", type: "number", description: "Nota média exibida no search.", presence: "common", status: "implemented" },
    { name: "text (review)", type: "string", description: "Texto completo do review.", presence: "always", status: "implemented" },
    { name: "author / date", type: "misto", description: "Autor e data do review.", presence: "always", status: "implemented" },
    { name: "votes_up", type: "number", description: "Votos úteis (score do UniItem).", presence: "always", status: "implemented" },
    { name: "recommended", type: "boolean", description: "Recomenda/não recomenda (meta).", presence: "always", status: "implemented" },
    { name: "playtimeHours", type: "number", description: "Horas jogadas ao escrever (meta).", presence: "always", status: "implemented" },
    { name: "playtime total / conquistas", type: "number", description: "Playtime total do autor (appreviews expõe; não coletado).", presence: "common", status: "available" },
    { name: "preço / gêneros / requisitos", type: "objeto", description: "Detalhes do jogo (appdetails — na Descoberta).", presence: "common", status: "implemented" },
  ],
  derivations: [
    "% recomendado como sentimento binário da fonte",
    "Reviews ponderados por horas jogadas (credibilidade)",
    "Evolução de recepção por período (com filtro temporal)",
  ],
  limits: [
    "Scrape do search depende do HTML (seletores podem mudar)",
    "appreviews: público mas com paginação e rate-limit implícito",
    "Sem dados de vendas/jogadores exatos (só estimativas externas)",
  ],
  reliability: {
    consistency: "Alta — os mesmos parâmetros retornam conjuntos estáveis; appreviews é JSON estruturado.",
    stability: "Média-alta — o scrape do search é o elo mais frágil (HTML), os reviews são JSON estável.",
    risks: [
      "Steam mudar o HTML do search (seletores)",
      "Rate-limit do appreviews em volume alto",
    ],
    fallbacks: [
      "Busca falha → appId direto ainda permite reviews",
      "Cache do servidor absorve falhas transitórias",
    ],
  },
  references: [
    { label: "Doc da fonte no sistema", url: "docs/fontes/steam-2026-08-25.md" },
    { label: "appreviews (endpoint usado)", url: "https://store.steampowered.com/appreviews/730?json=1" },
  ],
};
