import type { AuditSource } from "../auditModel";

/**
 * Auditoria maximalista — MASTODON.
 * Base: docs/fontes/mastodon-2026-08-25.md + conector declarativo.
 */
export const MASTODON_AUDIT: AuditSource = {
  id: "mastodon",
  order: 12,
  name: "Mastodon",
  category: "Social",
  status: "audited",
  implemented: true,
  sourceId: "mastodon",
  summary:
    "Rede social federada (ActivityPub). Implementada como timeline pública de hashtag da instância mastodon.social (sem auth): display name, texto (HTML sanitizado), URL, autor (acct), data e engajamento (favourites + reblogs separados em meta, com replies e idioma detectado). Disponíveis: instância configurável, busca full-text (api/v2/search), timeline local/federada e trends.",
  endpoints: [
    { label: "Timeline de hashtag", url: "https://mastodon.social/api/v1/timelines/tag/<hashtag>?limit=N", method: "GET", auth: "nenhuma", notes: "Teto 40/requisição; instância fixa mastodon.social.", status: "implemented" },
    { label: "Busca full-text v2", url: "https://mastodon.social/api/v2/search?q=<t>&type=statuses", method: "GET", auth: "nenhuma (pública)", notes: "Além de hashtag — não implementado.", status: "available" },
    { label: "Trends", url: "https://mastodon.social/api/v1/trends/statuses", method: "GET", auth: "nenhuma", notes: "Usado pela Descoberta (mastodon-trends), não pela Uni.", status: "implemented" },
  ],
  parameters: [
    { name: "query (hashtag)", type: "string", description: "Hashtag normalizada (minúscula, letras/números/underscore, unicode).", status: "implemented" },
    { name: "limit", type: "number", description: "Máximo (teto 40 na URL).", range: "1–40", status: "implemented" },
    { name: "instância", type: "string", description: "Hoje fixa em mastodon.social; qualquer instância pública seria possível.", status: "available" },
    { name: "local / federada", type: "boolean", description: "Escopo da timeline.", status: "available" },
  ],
  capabilities: [
    { label: "Timeline por hashtag (sem auth)", status: "implemented" },
    { label: "Engajamento separado (favourites/boosts/replies)", status: "implemented" },
    { label: "Idioma do post detectado", status: "implemented" },
    { label: "HTML sanitizado para texto", status: "implemented" },
    { label: "Trends de statuses (na Descoberta)", status: "implemented" },
    { label: "Busca full-text além de hashtag", status: "available" },
    { label: "Instância configurável", status: "available" },
    { label: "Timeline local/federada sem hashtag", status: "available" },
  ],
  combinations: [
    "hashtag × idioma — conversas por região",
    "Mastodon × Bluesky — mesma hashtag nas duas redes abertas",
  ],
  outputs: [
    { name: "title (display name)", type: "string", description: "Autor de exibição (até 120 chars).", presence: "always", status: "implemented" },
    { name: "text", type: "string", description: "Conteúdo do post (HTML strip).", presence: "always", status: "implemented" },
    { name: "url / author (acct) / date", type: "misto", description: "Link, conta federada e data.", presence: "always", status: "implemented" },
    { name: "score (favs+reblogs)", type: "number", description: "Engajamento combinado.", presence: "always", status: "implemented" },
    { name: "favourites / boosts / replies / lang", type: "meta", description: "Métricas separadas e idioma.", presence: "always", status: "implemented" },
    { name: "thread (replies com texto)", type: "objeto", description: "Contexto da conversa — não coletado.", presence: "common", status: "available" },
  ],
  derivations: [
    "Sentimento sobre temas de nicho (comunidade técnica)",
    "Sinais de adoção por hashtag ao longo do tempo",
  ],
  limits: [
    "Teto 40 posts/requisição",
    "Instância fixa (mastodon.social) — outras instâncias teriam conteúdo diferente",
    "Sem dados de alcance/followers do autor",
  ],
  reliability: {
    consistency: "Alta — API pública estável (Mastodon API v1).",
    stability: "Alta — conector declarativo sobre API JSON estável.",
    risks: ["Instância mastodon.social fora do ar", "Rate-limit da instância"],
    fallbacks: ["Erro honesto da rota", "Outras instâncias como alternativa (disponível)"],
  },
  references: [
    { label: "Doc da fonte no sistema", url: "docs/fontes/mastodon-2026-08-25.md" },
    { label: "Mastodon API", url: "https://docs.joinmastodon.org/api/" },
  ],
};
