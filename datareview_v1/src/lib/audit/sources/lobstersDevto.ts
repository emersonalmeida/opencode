import type { AuditSource } from "../auditModel";

/**
 * Auditoria maximalista — LOBSTERS + DEV COMMUNITY (DEV.to).
 * Base: docs/fontes/lobsters-2026-08-25.md + devto-2026-08-25.md.
 */
export const LOBSTERS_AUDIT: AuditSource = {
  id: "lobsters",
  order: 14,
  name: "Lobsters",
  category: "Dev/Social",
  status: "audited",
  implemented: true,
  sourceId: "lobsters",
  summary:
    "Agregador de links de programação (comunidade curada). Implementada como timeline pública por tag (JSON, sem auth): título, descrição, URL (short_id_url), autor, data, score e meta com comment_count e tags (taxonomia). Disponíveis: hottest/newest globais e comentários por story (/s/<id>.json).",
  endpoints: [
    { label: "Timeline por tag", url: "https://lobste.rs/t/<tag>.json", method: "GET", auth: "nenhuma", notes: "Tag normalizada (a-z0-9_-).", status: "implemented" },
    { label: "Hottest/Newest globais", url: "https://lobste.rs/hottest.json", method: "GET", auth: "nenhuma", notes: "Não implementado.", status: "available" },
    { label: "Comentários por story", url: "https://lobste.rs/s/<id>.json", method: "GET", auth: "nenhuma", notes: "Não implementado.", status: "available" },
  ],
  parameters: [
    { name: "query (tag)", type: "string", description: "Tag da comunidade (normalizada).", status: "implemented" },
    { name: "listas globais", type: "enum", description: "hottest/newest/active.", status: "available" },
  ],
  capabilities: [
    { label: "Timeline por tag com engajamento e taxonomia", status: "implemented" },
    { label: "Score + comment_count por story", status: "implemented" },
    { label: "Listas globais (hottest/newest)", status: "available" },
    { label: "Comentários por story", status: "available" },
  ],
  combinations: [
    "Lobsters × HN — o mesmo link nas duas comunidades dev",
    "tag × tempo — adoção de tecnologias",
  ],
  outputs: [
    { name: "title / text (descrição) / url", type: "string", description: "Story e descrição.", presence: "always", status: "implemented" },
    { name: "author / date / score", type: "misto", description: "Autor, data e pontos.", presence: "always", status: "implemented" },
    { name: "comments / tags", type: "meta", description: "Nº de comentários e taxonomia.", presence: "always", status: "implemented" },
    { name: "comentários (texto)", type: "objeto", description: "Discussão da story — não coletado.", presence: "common", status: "available" },
  ],
  derivations: ["Curadoria dev de qualidade (comunidade pequena e técnica)", "Sinais de adoção de tecnologia"],
  limits: ["Comunidade menor (volume reduzido vs HN)", "JSON público sem versionamento formal"],
  reliability: {
    consistency: "Alta — JSON estável.",
    stability: "Alta — API pública estável da comunidade.",
    risks: ["Volume baixo para nichos", "Rate-limit não documentado"],
    fallbacks: ["Erro honesto quando a tag não existe"],
  },
  references: [{ label: "Doc da fonte no sistema", url: "docs/fontes/lobsters-2026-08-25.md" }],
};

/** Auditoria maximalista — DEV COMMUNITY (DEV.to / Forem). */
export const DEVTO_AUDIT: AuditSource = {
  id: "devto",
  order: 15,
  name: "DEV Community",
  category: "Dev",
  status: "audited",
  implemented: true,
  sourceId: "devto",
  summary:
    "A maior comunidade de artigos dev (Forem). Implementada via API pública por tag: título, descrição, URL, autor, data, score (positive_reactions_count) e meta com comments_count, tags e tempo de leitura estimado (útil para priorização). Disponíveis: parâmetros da Forem API (top/latest/rising, username, intervalo de datas) e comentários por artigo.",
  endpoints: [
    { label: "Artigos por tag", url: "https://dev.to/api/articles?tag=<tag>&per_page=N", method: "GET", auth: "nenhuma", notes: "Tag normalizada (minúscula, sem espaços).", status: "implemented" },
    { label: "Artigos (filtros)", url: "https://dev.to/api/articles?top=N|latest|state=rising|username=<u>", method: "GET", auth: "nenhuma", notes: "Não implementado.", status: "available" },
    { label: "Comentários por artigo", url: "https://dev.to/api/comments?a_id=<id>", method: "GET", auth: "nenhuma", notes: "Não implementado.", status: "available" },
  ],
  parameters: [
    { name: "query (tag)", type: "string", description: "Tag da comunidade.", status: "implemented" },
    { name: "limit (per_page)", type: "number", description: "Máximo de artigos.", status: "implemented" },
    { name: "top / latest / rising", type: "enum", description: "Ordenações da Forem API.", status: "available" },
    { name: "username", type: "string", description: "Artigos de um autor.", status: "available" },
  ],
  capabilities: [
    { label: "Artigos por tag com engajamento e taxonomia", status: "implemented" },
    { label: "Tempo de leitura estimado", status: "implemented" },
    { label: "Reações + comentários por artigo", status: "implemented" },
    { label: "Filtros top/latest/rising e por autor", status: "available" },
    { label: "Comentários por artigo", status: "available" },
  ],
  combinations: [
    "tag × top — os artigos mais validados de um tema",
    "DEV × HN × Reddit — recepção dev em 3 superfícies",
  ],
  outputs: [
    { name: "title / text (description) / url", type: "string", description: "Artigo.", presence: "always", status: "implemented" },
    { name: "author / date", type: "misto", description: "Autor e publicação.", presence: "always", status: "implemented" },
    { name: "score (positive_reactions)", type: "number", description: "Reações positivas.", presence: "always", status: "implemented" },
    { name: "comments / tags / readingTime", type: "meta", description: "Engajamento, taxonomia e leitura.", presence: "always", status: "implemented" },
    { name: "comentários (texto)", type: "objeto", description: "Discussão — não coletado.", presence: "common", status: "available" },
  ],
  derivations: ["Conteúdo técnico validado pela comunidade", "Temas em alta por tag"],
  limits: ["por tag apenas (sem busca full-text na implementação)", "Rate-limit da Forem API"],
  reliability: {
    consistency: "Alta — Forem API estável.",
    stability: "Alta — API pública estável e documentada.",
    risks: ["Rate-limit", "Conteúdo varia por tag"],
    fallbacks: ["Erro honesto"],
  },
  references: [{ label: "Doc da fonte no sistema", url: "docs/fontes/devto-2026-08-25.md" }, { label: "Forem API", url: "https://developers.forem.com/api" }],
};
