import type { AuditSource } from "../auditModel";

/**
 * Auditoria maximalista — BLUESKY.
 * Base: docs/fontes/bluesky-2026-08-25.md + conector declarativo.
 */
export const BLUESKY_AUDIT: AuditSource = {
  id: "bluesky",
  order: 13,
  name: "Bluesky",
  category: "Social",
  status: "audited",
  implemented: true,
  sourceId: "bluesky",
  summary:
    "Rede social do protocolo AT. Implementada com busca full-text pública (searchPosts, sem auth — diferencial vs Mastodon que é por hashtag): display name/handle, texto (record.text), URL canônica reconstruída do URI AT (bsky.app/profile/<handle>/post/<id>), data (indexedAt) e engajamento (likes + reposts, com replies em meta). Disponíveis: filtros do searchPosts (lang, datas, autor, menções), threads (getPostThread) e o firehose para tempo real.",
  endpoints: [
    { label: "Busca full-text", url: "https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=<t>&limit=N", method: "GET", auth: "nenhuma", notes: "API pública do relay; teto 50/requisição.", status: "implemented" },
    { label: "Thread", url: "https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=<at-uri>", method: "GET", auth: "nenhuma", notes: "Conversa completa — não implementado.", status: "available" },
    { label: "Firehose", url: "wss://bsky.network/xrpc/com.atproto.sync.subscribeRepos", method: "WS", auth: "nenhuma", notes: "Stream completo da rede — monitoramento em tempo real (não implementado).", status: "available" },
  ],
  parameters: [
    { name: "query", type: "string", description: "Termo livre (full-text).", status: "implemented" },
    { name: "limit", type: "number", description: "Máximo (teto 50 na URL).", range: "1–50", status: "implemented" },
    { name: "lang", type: "string", description: "Filtro de idioma do searchPosts.", status: "available" },
    { name: "since / until", type: "datetime", description: "Janela temporal do searchPosts.", status: "available" },
    { name: "author / mentions", type: "string", description: "Filtros por autor e menções.", status: "available" },
  ],
  capabilities: [
    { label: "Busca full-text pública (sem auth)", status: "implemented" },
    { label: "Engajamento separado (likes/reposts/replies)", status: "implemented" },
    { label: "URL canônica reconstruída do URI AT", status: "implemented" },
    { label: "Filtros de idioma/data/autor", status: "available" },
    { label: "Threads completas (getPostThread)", status: "available" },
    { label: "Firehose (stream em tempo real)", status: "available" },
  ],
  combinations: [
    "termo × janela temporal — evolução do discurso",
    "Bluesky × Mastodon — mesma conversa nas duas redes abertas",
    "Bluesky × Trends — o que sobe na rede vs o que é buscado",
  ],
  outputs: [
    { name: "title (display/handle)", type: "string", description: "Autor de exibição.", presence: "always", status: "implemented" },
    { name: "text (record.text)", type: "string", description: "Conteúdo do post.", presence: "always", status: "implemented" },
    { name: "url (bsky.app)", type: "string", description: "Link canônico reconstruído.", presence: "always", status: "implemented" },
    { name: "author (handle) / date (indexedAt)", type: "misto", description: "Handle e data.", presence: "always", status: "implemented" },
    { name: "score (likes+reposts)", type: "number", description: "Engajamento combinado.", presence: "always", status: "implemented" },
    { name: "likes / reposts / replies", type: "meta", description: "Métricas separadas.", presence: "always", status: "implemented" },
    { name: "thread / citações", type: "objeto", description: "Conversa completa — não coletado.", presence: "common", status: "available" },
  ],
  derivations: [
    "Sentimento em tempo real sobre lançamentos",
    "Detecção de temas emergentes (busca seriada)",
  ],
  limits: [
    "Teto 50 posts/requisição",
    "Busca depende do relay público (cobertura de indexação)",
    "Sem métricas de alcance (views não são públicas)",
  ],
  reliability: {
    consistency: "Alta — API pública estável do protocolo AT.",
    stability: "Alta — conector sobre XRPC estável; relay público mantido pela Bluesky.",
    risks: ["Relay público com lag de indexação", "Rate-limit do relay"],
    fallbacks: ["Erro honesto", "Threads via getPostThread quando implementado"],
  },
  references: [
    { label: "Doc da fonte no sistema", url: "docs/fontes/bluesky-2026-08-25.md" },
    { label: "AT Protocol API", url: "https://docs.bsky.app/docs/api/" },
  ],
};
