import type { AuditSource } from "../auditModel";

/**
 * Auditoria maximalista — PRODUCT HUNT.
 *
 * Base: implementação nova (server/routes/uniProductHunt.ts) validada ao vivo
 * 2026-08-26 (feed público retornou os lançamentos reais do dia), documentação
 * oficial da GraphQL API v2 e pesquisa online sobre os endpoints sem auth.
 */
export const PRODUCTHUNT_AUDIT: AuditSource = {
  id: "producthunt",
  order: 6,
  name: "Product Hunt",
  category: "Lançamentos",
  status: "audited",
  implemented: true,
  sourceId: "producthunt",
  summary:
    "A principal vitrine de lançamentos de produtos (apps, SaaS, ferramentas dev). Implementada nesta auditoria com DOIS caminhos: o feed Atom público (producthunt.com/feed — sem auth, com filtro por tópico ?category=<slug>; traz nome, tagline, link e data, com ranking = ordem do feed) e a GraphQL API v2 oficial (com PRODUCT_HUNT_TOKEN no servidor — votos, comentários, tópicos e paginação por cursor). Validado ao vivo: 50 lançamentos reais por chamada.",
  endpoints: [
    {
      label: "Feed Atom público",
      url: "https://www.producthunt.com/feed?category=<slug-opcional>",
      method: "GET",
      auth: "nenhuma",
      notes: "50 entries por resposta; ?category=<slug> filtra por tópico (ex.: artificial-intelligence). Atualiza diariamente. ATENÇÃO: /feed.atom e /feed.rss retornam 404 — a URL canônica é /feed.",
      status: "implemented",
    },
    {
      label: "GraphQL API v2 (oficial)",
      url: "https://api.producthunt.com/v2/api/graphql",
      method: "POST",
      auth: "Bearer PRODUCT_HUNT_TOKEN (developer token)",
      notes: "posts(first, order: RANKING|VOTES|NEWEST|FEATURED) com votesCount, commentsCount, topics; paginação por cursor (after).",
      status: "implemented",
    },
    {
      label: "Rota do sistema",
      url: "POST /functions/v1/uni-producthunt {action: posts|graphql, topic?, limit?, order?}",
      method: "POST",
      auth: "nenhuma (servidor local)",
      notes: "Cache 30min do feed; erro honesto orientando a configurar o token quando graphql é pedido sem PRODUCT_HUNT_TOKEN.",
      status: "implemented",
    },
  ],
  parameters: [
    { name: "topic (feed)", type: "string", description: "Slug de categoria do feed (?category=…). Ex.: artificial-intelligence, developer-tools, design-tools.", status: "implemented" },
    { name: "limit", type: "number", description: "Máximo de posts (teto 100; o feed traz ~50 por resposta).", range: "1–100", default: "20", status: "implemented" },
    { name: "order (GraphQL)", type: "enum", description: "Ordenação oficial dos posts.", options: ["RANKING", "VOTES", "NEWEST", "FEATURED"], default: "RANKING", status: "implemented" },
    { name: "postedAfter / postedBefore (GraphQL)", type: "date", description: "Janela temporal do ranking — histórico de lançamentos (não implementado).", status: "available" },
    { name: "cursor after (GraphQL)", type: "string", description: "Paginação por cursor além da primeira página.", status: "available" },
    { name: "productId / postId (GraphQL)", type: "string", description: "Detalhe de um post específico (comentários, makers, links).", status: "available" },
  ],
  capabilities: [
    { label: "Lançamentos do dia via feed público (sem credencial)", status: "implemented" },
    { label: "Feed filtrado por tópico/categoria", status: "implemented" },
    { label: "Ranking do dia (ordem real do feed)", status: "implemented" },
    { label: "Votos, comentários e tópicos via GraphQL oficial (com token)", status: "implemented" },
    { label: "4 ordenações oficiais (RANKING/VOTES/NEWEST/FEATURED)", status: "implemented" },
    { label: "Erro honesto quando GraphQL é pedido sem token (com instrução)", status: "implemented" },
    { label: "Comentários dos posts (GraphQL comments)", status: "implemented" },
    { label: "Makers e perfis de criadores (GraphQL)", status: "available" },
    { label: "Coleções e tópicos como entidades navegáveis", status: "available" },
    { label: "Histórico de rankings (postedAfter/postedBefore)", status: "available" },
    { label: "Busca textual de posts (GraphQL posts(query:))", status: "available" },
  ],
  combinations: [
    "feed geral × feed por tópico — panorama do dia vs nicho",
    "Product Hunt × Suggest — a demanda de busca pelos produtos lançados",
    "Product Hunt × Trends — interesse ao longo do tempo nos temas dos lançamentos",
    "Product Hunt × lojas — apps lançados no PH coletados na Apple/Google",
    "GraphQL order × janela temporal — os mais votados da semana/mês (com token)",
  ],
  outputs: [
    { name: "name (título)", type: "string", description: "Nome do produto lançado.", presence: "always", status: "implemented" },
    { name: "tagline", type: "string", description: "Descrição curta oficial do produto.", presence: "always", status: "implemented" },
    { name: "url", type: "string", description: "Link do post no Product Hunt (com redirect para o site do produto).", presence: "always", status: "implemented" },
    { name: "date", type: "timestamp", description: "Data de publicação (updated do feed / createdAt no GraphQL).", presence: "always", status: "implemented" },
    { name: "rank", type: "number", description: "Posição no ranking do dia (ordem do feed; PH não publica o número).", presence: "always", status: "implemented", reliability: "derivado da ordem do feed — não é campo oficial" },
    { name: "votesCount", type: "number", description: "Upvotes do post — só GraphQL.", presence: "always", status: "implemented", reliability: "exige PRODUCT_HUNT_TOKEN" },
    { name: "commentsCount", type: "number", description: "Nº de comentários — só GraphQL.", presence: "always", status: "implemented" },
    { name: "topics", type: "string[]", description: "Tópicos/tags do post — só GraphQL.", presence: "common", status: "implemented" },
    { name: "maker / hunter", type: "objeto", description: "Criadores do produto — GraphQL, não implementado.", presence: "common", status: "available" },
    { name: "comentários (texto/autor/votos)", type: "objeto", description: "Discussão do post — GraphQL, não implementado.", presence: "common", status: "available" },
    { name: "thumbnail / media", type: "url", description: "Imagens do post — GraphQL.", presence: "common", status: "available" },
    { name: "website do produto", type: "url", description: "Link externo real (o feed embute no summary; GraphQL tem website).", presence: "conditional", status: "available" },
  ],
  derivations: [
    "Radar de categorias em alta (tópicos recorrentes nos lançamentos)",
    "Detecção de concorrentes recém-lançados",
    "Tração de lançamento (votos × comentários × tempo, com token)",
    "Pipeline de validação: PH lança → Suggest mede demanda → Trends mede interesse → lojas medem recepção",
  ],
  limits: [
    "Feed público: só o dia corrente, ~50 posts, SEM votos/comentários/tópicos",
    "Feed não pagina e não tem busca textual",
    "GraphQL exige developer token (PRODUCT_HUNT_TOKEN) com rate-limit por complexidade de query",
    "Posição/rank é derivado da ordem do feed (não é campo oficial)",
  ],
  reliability: {
    consistency:
      "Alta dentro do dia (o feed é curado pelo PH); entre dias muda completamente (é um ranking diário — natureza da fonte).",
    stability:
      "Feed Atom estável (formato padrão); GraphQL v2 é a API oficial com versionamento. Validado ao vivo 2026-08-26 (50 lançamentos reais).",
    risks: [
      "Mudança do formato/URL do feed (detectado nesta auditoria: /feed.atom 404 → /feed)",
      "Token GraphQL expirado/revogado → erro honesto",
      "Rate-limit do GraphQL por complexidade",
    ],
    fallbacks: [
      "Sem token: feed público continua funcionando (coleta nunca quebra)",
      "Cache 30min do feed absorve falhas transitórias",
      "Erro GraphQL honesto com instrução de configuração",
    ],
  },
  references: [
    { label: "Doc da fonte no sistema", url: "docs/fontes/producthunt-2026-08-25.md" },
    { label: "GraphQL API v2 (oficial)", url: "https://api.producthunt.com/v2/docs" },
    { label: "Developer tokens", url: "https://api.producthunt.com/v2/oauth/applications" },
  ],
};
