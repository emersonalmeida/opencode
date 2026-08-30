import type { AuditSource } from "../auditModel";

/**
 * Auditoria maximalista — HACKER NEWS.
 * Base: docs/fontes/hackernews-2026-08-25.md + implementação (uniHackernews).
 */
export const HACKERNEWS_AUDIT: AuditSource = {
  id: "hackernews",
  order: 11,
  name: "Hacker News",
  category: "Dev/Social",
  status: "audited",
  implemented: true,
  sourceId: "hackernews",
  summary:
    "O fórum de tecnologia da YC. Implementada via Algolia HN Search API (sem auth): busca por relevância ou data (searchByDate) e comentários sob demanda por story. Fallback de URL para itens textuais (Ask/Show HN). Meta preserva hnId, numComments e storyId. Disponíveis: filtros numericFilters da Algolia (pontos, intervalo de datas, tipo), as listagens oficiais via Firebase API (top/new/best/ask/show/job) e perfis de autor.",
  endpoints: [
    { label: "Algolia search", url: "https://hn.algolia.com/api/v1/search?query=<t>", method: "GET", auth: "nenhuma", notes: "Relevância; searchByDate para cronológico.", status: "implemented" },
    { label: "Algolia searchByDate", url: "https://hn.algolia.com/api/v1/search_by_date?query=<t>", method: "GET", auth: "nenhuma", status: "implemented" },
    { label: "Item/comentários", url: "https://hn.algolia.com/api/v1/items/<storyId>", method: "GET", auth: "nenhuma", notes: "Árvore de comentários da story.", status: "implemented" },
    { label: "Firebase oficial (listagens)", url: "https://hacker-news.firebaseio.com/v0/<top|new|best|ask|show|job>stories.json", method: "GET", auth: "nenhuma", notes: "Front page e listas oficiais — não implementado.", status: "available" },
    { label: "Rota do sistema", url: "POST /functions/v1/uni-hackernews {action: search|comments, query, sort, limit, storyId}", method: "POST", auth: "nenhuma (servidor local)", status: "implemented" },
  ],
  parameters: [
    { name: "query", type: "string", description: "Termo de busca.", status: "implemented" },
    { name: "sort", type: "enum", description: "relevance (Algolia search) ou date (searchByDate).", options: ["relevance", "date"], default: "relevance", status: "implemented" },
    { name: "storyId", type: "string", description: "Story alvo dos comentários (action=comments).", status: "implemented" },
    { name: "limit", type: "number", description: "Máximo de itens.", status: "implemented" },
    { name: "tags (Algolia)", type: "enum", description: "story/comment/job/poll/ask_hn/show_hn.", status: "available" },
    { name: "numericFilters (Algolia)", type: "string", description: "points>N, created_at_i>X..Y.", status: "available" },
    { name: "listas oficiais", type: "enum", description: "top/new/best/ask/show/job (Firebase).", status: "available" },
  ],
  capabilities: [
    { label: "Busca por relevância ou cronologia", status: "implemented" },
    { label: "Comentários sob demanda por story", status: "implemented" },
    { label: "Pontos + nº de comentários por story", status: "implemented" },
    { label: "Fallback de URL (Ask/Show HN textuais)", status: "implemented" },
    { label: "Filtros por tipo de item e pontos/data (Algolia)", status: "available" },
    { label: "Front page / top / new / best / ask / show / job (Firebase)", status: "available" },
    { label: "Perfil de autor (karma, histórico)", status: "available" },
  ],
  combinations: [
    "busca × sort=data — pulso em tempo real de um tema",
    "story → comentários — profundidade da discussão",
    "HN × Reddit × Lobsters — recepção dev em 3 comunidades",
  ],
  outputs: [
    { name: "title / text / url", type: "string", description: "Título, texto e link (fallback para item HN).", presence: "always", status: "implemented" },
    { name: "author / date", type: "misto", description: "Autor e data.", presence: "always", status: "implemented" },
    { name: "score (points)", type: "number", description: "Pontos da story/comment.", presence: "always", status: "implemented" },
    { name: "numComments / hnId / storyId", type: "meta", description: "Engajamento e identidade HN.", presence: "always", status: "implemented" },
    { name: "karma do autor", type: "number", description: "Firebase user — não coletado.", presence: "common", status: "available" },
    { name: "ranking na front page", type: "number", description: "Posição nas listas oficiais (não coletado).", presence: "common", status: "available" },
  ],
  derivations: [
    "Recepção técnica de lançamentos (Show HN)",
    "Críticas recorrentes nos comentários",
    "Sinal de tração (pontos × comentários)",
  ],
  limits: [
    "Algolia: índice com latência de minutos vs tempo real",
    "Sem rate-limit documentado, mas uso moderado",
    "Comentários: árvore completa pode ser grande",
  ],
  reliability: {
    consistency: "Alta — Algolia é índice estável e estruturado.",
    stability: "Alta — API pública estável há anos; Firebase oficial como caminho alternativo.",
    risks: ["Lag do índice Algolia", "Mudança de contrato (baixa)"],
    fallbacks: ["Algolia falha → Firebase oficial (listagens)", "Sem URL externa → fallback para o item HN"],
  },
  references: [
    { label: "Saídas de exemplo (hackernews-output)", url: "docs/fontes/notebooks/hackernews-output.md" },
    { label: "Notebook de testes (hackernews-fonte)", url: "docs/fontes/notebooks/hackernews-fonte.md" },
    { label: "Doc da fonte no sistema", url: "docs/fontes/hackernews-2026-08-25.md" },
    { label: "Algolia HN API", url: "https://hn.algolia.com/api" },
    { label: "Firebase HN API (oficial)", url: "https://github.com/HackerNews/API" },
  ],
};
