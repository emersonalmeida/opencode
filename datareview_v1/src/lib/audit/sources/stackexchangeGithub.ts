import type { AuditSource } from "../auditModel";

/**
 * Auditoria maximalista — STACK EXCHANGE + GITHUB.
 * Base: docs/fontes/stackexchange-2026-08-25.md + github-2026-08-25.md.
 */
export const STACKEXCHANGE_AUDIT: AuditSource = {
  id: "stackexchange",
  order: 16,
  name: "Stack Exchange",
  category: "Dev Q&A",
  status: "audited",
  implemented: true,
  sourceId: "stackexchange",
  summary:
    "A rede de Q&A técnica (7 sites: stackoverflow, pt.SO, superuser, serverfault, askubuntu…). Implementada via Stack Exchange API pública (sem auth): busca avançada de perguntas (relevance/votes/activity/creation) e respostas por pergunta com aceitação (solução validada) e view count (alcance do problema). HTML entities decodificadas no servidor. Disponíveis: filtros avançados (tagged, accepted, datas), comentários e reputação de usuários.",
  endpoints: [
    { label: "Busca avançada", url: "https://api.stackexchange.com/2.3/search/advanced?q=<t>&site=<s>", method: "GET", auth: "nenhuma", notes: "Multi-site; sort relevance/votes/activity/creation.", status: "implemented" },
    { label: "Respostas", url: "https://api.stackexchange.com/2.3/questions/<id>/answers?site=<s>", method: "GET", auth: "nenhuma", notes: "Com is_accepted por resposta.", status: "implemented" },
    { label: "Rota do sistema", url: "POST /functions/v1/uni-stackexchange {action: search|answers, query, site, sort, limit, questionId}", method: "POST", auth: "nenhuma (servidor local)", status: "implemented" },
  ],
  parameters: [
    { name: "query", type: "string", description: "Termo de busca.", status: "implemented" },
    { name: "site", type: "enum", description: "7 comunidades da rede.", options: ["stackoverflow", "pt.stackoverflow", "superuser", "serverfault", "askubuntu", "…"], default: "stackoverflow", status: "implemented" },
    { name: "sort", type: "enum", description: "Ordenação da busca.", options: ["relevance", "votes", "activity", "creation"], default: "relevance", status: "implemented" },
    { name: "questionId", type: "string", description: "Pergunta alvo das respostas.", status: "implemented" },
    { name: "tagged / accepted / datas", type: "filtros", description: "Filtros avançados da API.", status: "available" },
  ],
  capabilities: [
    { label: "Busca multi-site (7 comunidades)", status: "implemented" },
    { label: "Respostas com aceitação (solução validada)", status: "implemented" },
    { label: "View count (alcance do problema)", status: "implemented" },
    { label: "Tags por pergunta", status: "implemented" },
    { label: "Filtros avançados (tagged, accepted, datas)", status: "available" },
    { label: "Comentários por pergunta/resposta", status: "available" },
    { label: "Reputação de usuários (autoridade)", status: "available" },
  ],
  combinations: [
    "pergunta → respostas — a solução validada do problema",
    "site × tag — o mesmo problema em comunidades diferentes",
    "SE × GitHub — problema (SE) ↔ código (GitHub)",
  ],
  outputs: [
    { name: "title / text (body) / url", type: "string", description: "Pergunta.", presence: "always", status: "implemented" },
    { name: "author / date / score", type: "misto", description: "Autor, data e votos.", presence: "always", status: "implemented" },
    { name: "questionId / site / answerCount / viewCount / isAnswered / tags", type: "meta", description: "Identidade e métricas.", presence: "always", status: "implemented" },
    { name: "isAccepted (respostas)", type: "boolean", description: "Resposta aceita.", presence: "common", status: "implemented" },
    { name: "reputação do autor", type: "number", description: "Autoridade — não coletado.", presence: "common", status: "available" },
  ],
  derivations: ["Problemas reais validados pela comunidade", "Soluções aceitas como verdade operacional"],
  limits: ["Quota diária da API pública (sem key)", "1 site por chamada"],
  reliability: {
    consistency: "Alta — API oficial estável.",
    stability: "Alta — Stack Exchange API 2.3 documentada e estável.",
    risks: ["Quota diária sem key", "Entities HTML (mitigado — decodificado no servidor)"],
    fallbacks: ["Erro honesto com quota"],
  },
  references: [
    { label: "Saídas de exemplo (stackexchange-output)", url: "docs/fontes/notebooks/stackexchange-output.md" },
    { label: "Notebook de testes (stackexchange-fonte)", url: "docs/fontes/notebooks/stackexchange-fonte.md" },{ label: "Doc da fonte no sistema", url: "docs/fontes/stackexchange-2026-08-25.md" }],
};

/** Auditoria maximalista — GITHUB. */
export const GITHUB_AUDIT: AuditSource = {
  id: "github",
  order: 17,
  name: "GitHub",
  category: "Dev",
  status: "audited",
  implemented: true,
  sourceId: "github",
  summary:
    "A maior plataforma de código. Implementada via Search API (repos + issues, sem auth com GITHUB_TOKEN opcional do env): repos com stars/forks/language/topics/openIssues e issues com state/labels/comments. Rate-limit vira erro acionável com horário de reset. Disponíveis: qualifiers explícitos (language:, stars:>100), README via contents API, commits/releases e grafo de dependents.",
  endpoints: [
    { label: "Search repos", url: "https://api.github.com/search/repositories?q=<t>&sort=stars", method: "GET", auth: "GITHUB_TOKEN opcional (env do servidor)", notes: "Query syntax completa do GitHub.", status: "implemented" },
    { label: "Search issues", url: "https://api.github.com/search/issues?q=<t>&state=<s>", method: "GET", auth: "GITHUB_TOKEN opcional", notes: "Issues/PRs com labels.", status: "implemented" },
    { label: "Contents (README)", url: "https://api.github.com/repos/<o>/<r>/readme", method: "GET", auth: "token", notes: "Não implementado.", status: "available" },
    { label: "Rota do sistema", url: "POST /functions/v1/uni-github {action: repos|issues, query, sort, state, limit}", method: "POST", auth: "nenhuma (servidor local)", status: "implemented" },
  ],
  parameters: [
    { name: "query", type: "string", description: "Termo (aceita query syntax do GitHub).", status: "implemented" },
    { name: "sort (repos)", type: "enum", description: "Ordenação de repos.", options: ["stars", "forks", "updated"], default: "stars", status: "implemented" },
    { name: "state (issues)", type: "enum", description: "Estado da issue.", options: ["open", "closed", "all"], default: "open", status: "implemented" },
    { name: "qualifiers", type: "string", description: "language:, stars:>100, created:> — explícitos na UI.", status: "available" },
  ],
  capabilities: [
    { label: "Repos + issues (código E discussão) na mesma fonte", status: "implemented" },
    { label: "Stars/forks/topics/language/openIssues por repo", status: "implemented" },
    { label: "Issues com state/labels/comments", status: "implemented" },
    { label: "Rate-limit com erro acionável (horário de reset)", status: "implemented" },
    { label: "README do repo (contents API)", status: "available" },
    { label: "Commits/releases (atividade de manutenção)", status: "available" },
    { label: "Dependents/dependências (grafo de uso)", status: "available" },
  ],
  combinations: [
    "repo × issues — saúde do projeto (atividade × problemas)",
    "topics × busca — ecossistemas de um tema",
    "GitHub × HN × DEV — código + discussão + artigos",
  ],
  outputs: [
    { name: "title / text (descrição) / url", type: "string", description: "Repo/issue.", presence: "always", status: "implemented" },
    { name: "author / date", type: "misto", description: "Dono e data.", presence: "always", status: "implemented" },
    { name: "score (stars/comments)", type: "number", description: "Tração.", presence: "always", status: "implemented" },
    { name: "forks / openIssues / language / topics (repos)", type: "meta", description: "Métricas e taxonomia.", presence: "always", status: "implemented" },
    { name: "state / repo / labels / comments (issues)", type: "meta", description: "Estado e discussão.", presence: "always", status: "implemented" },
    { name: "README (conteúdo)", type: "markdown", description: "Documentação — não coletado.", presence: "common", status: "available" },
    { name: "commits / releases recentes", type: "objeto", description: "Atividade — não coletado.", presence: "common", status: "available" },
  ],
  derivations: ["Saúde de projeto (stars × issues × atividade)", "Ecossistemas por topic", "Concorrência técnica"],
  limits: ["Rate-limit: 10 req/min sem token, 30 com token (search API)", "Search só (não firehose de eventos)"],
  reliability: {
    consistency: "Alta — API oficial estável.",
    stability: "Alta — GitHub Search API documentada; token eleva o limite.",
    risks: ["Rate-limit sem token (erro acionável com reset)", "Search API tem lag de indexação"],
    fallbacks: ["GITHUB_TOKEN do env eleva o limite", "Erro honesto com horário de reset"],
  },
  references: [
    { label: "Doc da fonte no sistema", url: "docs/fontes/github-2026-08-25.md" },
    { label: "Notebook de testes (github-fonte)", url: "docs/fontes/notebooks/github-fonte.md" },
    { label: "Saídas de exemplo (github-output)", url: "docs/fontes/notebooks/github-output.md" },
  ],
};
