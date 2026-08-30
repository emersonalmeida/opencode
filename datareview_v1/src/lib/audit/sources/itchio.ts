import type { AuditSource } from "../auditModel";

/**
 * Auditoria maximalista — ITCH.IO.
 *
 * Base: docs/fontes/itchio-2026-08-25.md + conector declarativo
 * (server/lib/uniConnectors.ts).
 */
export const ITCHIO_AUDIT: AuditSource = {
  id: "itchio",
  order: 10,
  name: "itch.io",
  category: "Jogos indie",
  status: "audited",
  implemented: true,
  sourceId: "itchio",
  summary:
    "O marketplace de jogos indie. Implementada como conector declarativo com busca textual pública (scrape HTML): título, link e nota média quando exposta. Fonte mais simples do domínio games — complementa a Steam com o ecossistema indie (jogos experimentais, game jams, projetos autorais).",
  endpoints: [
    {
      label: "Busca pública (scrape)",
      url: "https://itch.io/search?q=<termo>",
      method: "GET",
      auth: "nenhuma",
      notes: "Conector declarativo em uniConnectors.ts — parse do HTML de resultados.",
      status: "implemented",
    },
  ],
  parameters: [
    { name: "query", type: "string", description: "Termo de busca de jogos indie.", status: "implemented" },
    { name: "tag", type: "string", description: "Busca por tag/gênero (itch.io/games/tag-<x>) — não implementado.", status: "available" },
    { name: "preço / plataforma", type: "filtro", description: "Filtros do search (free, windows…) — não implementado.", status: "available" },
  ],
  capabilities: [
    { label: "Busca textual de jogos indie (título + link)", status: "implemented" },
    { label: "Nota média quando exposta no HTML", status: "implemented" },
    { label: "Busca por tags/gêneros", status: "available" },
    { label: "Preço/plataformas do jogo", status: "available" },
    { label: "Comentários/ratings da página do jogo", status: "available" },
    { label: "Game jams como fonte de tendências indie", status: "available" },
  ],
  combinations: [
    "itch.io × Steam — indie + mainstream do mesmo gênero",
    "itch.io × Suggest — demanda de busca por jogos indie",
  ],
  outputs: [
    { name: "title", type: "string", description: "Nome do jogo indie.", presence: "always", status: "implemented" },
    { name: "url", type: "string", description: "Página do jogo no itch.io.", presence: "always", status: "implemented" },
    { name: "score (nota média)", type: "number", description: "Nota quando exposta no HTML de busca.", presence: "conditional", status: "implemented" },
    { name: "preço / plataformas", type: "misto", description: "Da página do jogo (não coletado).", presence: "common", status: "available" },
    { name: "tags / gêneros", type: "string[]", description: "Tags do jogo (não coletado).", presence: "common", status: "available" },
  ],
  derivations: [
    "Sinais de tendências indie (jogos novos por tag)",
    "Comparativo indie vs mainstream no mesmo nicho",
  ],
  limits: [
    "Scrape de HTML (frágil a mudanças de layout)",
    "Sem API pública oficial de busca",
    "Cobertura menor que Steam (só busca, sem reviews estruturados)",
  ],
  reliability: {
    consistency: "Média — busca estável, mas depende do HTML público.",
    stability: "Média — conector declarativo simples; layout do itch muda raramente.",
    risks: ["Mudança de layout do search", "Rate-limit não documentado"],
    fallbacks: ["Erro honesto quando o scrape não encontra resultados"],
  },
  references: [
    { label: "Doc da fonte no sistema", url: "docs/fontes/itchio-2026-08-25.md" },
  ],
};
