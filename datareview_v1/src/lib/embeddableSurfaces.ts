/**
 * Superfícies embutíveis — registry de componentes REAIS do sistema que podem
 * ser renderizados dentro de uma resposta de chat (com ou sem IA).
 *
 * Ideia central: o usuário pede no chat "exiba a página de pipeline" ou
 * "mostre o componente de gráficos" e o sistema renderiza o componente de
 * verdade na saída — totalmente interativo, sem sair da conversa.
 *
 * Este módulo é PURO (sem React): guarda só os metadados (id, label,
 * descrição, keywords) e a resolução fuzzy. O mapeamento id → componente
 * real vive em `src/components/shared/EmbeddedSurface.tsx`.
 */

export interface EmbeddableSurfaceDef {
  /** Identificador estável (usado no fence ```component <id>```). */
  id: string;
  /** Nome curto exibido no header do bloco embutido. */
  label: string;
  /** O que a superfície faz (ajuda o usuário e a IA a escolher). */
  description: string;
  /** Termos de busca (PT/EN, sem acento) para a resolução fuzzy. */
  keywords: string[];
  /** Página de origem (deep link "Abrir na página"). */
  originPath: string;
}

/**
 * Catálogo de superfícies embutíveis. Toda entrada aponta para um componente
 * que JÁ EXISTE no sistema (painéis reutilizados) — nada é simulado.
 */
export const EMBEDDABLE_SURFACES: EmbeddableSurfaceDef[] = [
  {
    id: "pipeline",
    label: "Pipeline",
    description: "Artefatos e análises do motor de conhecimento (vault do /pipeline).",
    keywords: ["pipeline", "artefatos", "conhecimento", "motor", "vault"],
    originPath: "/pipeline",
  },
  {
    id: "charts",
    label: "Gráficos",
    description: "KPIs, distribuição de notas, sentimento, timeline e termos do dataset.",
    keywords: ["graficos", "charts", "visualizacao", "dashboard", "sentimento", "timeline"],
    originPath: "/dashboard",
  },
  {
    id: "dataset",
    label: "Dados coletados",
    description: "Resumo do dataset: apps, reviews, nota média e estatísticas por app.",
    keywords: ["dados", "dataset", "coletados", "apps", "reviews", "estatisticas"],
    originPath: "/dados",
  },
  {
    id: "data-quality",
    label: "Qualidade dos dados",
    description: "Validação do dataset (8 checks determinísticos: ids, notas, datas, cobertura).",
    keywords: ["qualidade", "validacao", "checks", "integridade", "auditoria"],
    originPath: "/pipeline-dados",
  },
  {
    id: "generations",
    label: "Gerações",
    description: "Histórico unificado de coletas e gerações de IA (sessões).",
    keywords: ["geracoes", "sessoes", "historico", "coletas", "saidas"],
    originPath: "/sessions",
  },
  {
    id: "insights",
    label: "Insights",
    description: "Insights derivados de todas as gerações de IA (dataset derivado).",
    keywords: ["insights", "descobertas", "derivados", "aprendizado"],
    originPath: "/pipeline-dados",
  },
  {
    id: "activity",
    label: "Atividade",
    description: "Log de atividade do sistema (coletas, análises, tarefas) em tempo real.",
    keywords: ["atividade", "log", "tarefas", "status", "eventos"],
    originPath: "/os",
  },
  {
    id: "apps",
    label: "Coleta de apps",
    description: "Busca e coleta de apps (Apple + Google Play) com seleção global.",
    keywords: ["apps", "coleta", "busca", "coletar", "apple", "google", "play"],
    originPath: "/",
  },
  {
    id: "collection-config",
    label: "Configuração de coleta",
    description: "Limite de reviews, ordenação, região e idioma da coleta.",
    keywords: ["config", "configuracao", "coleta", "limite", "regiao", "ordenacao"],
    originPath: "/configuracoes",
  },
  {
    id: "feature-flags",
    label: "Recursos do sistema",
    description: "Feature flags: liga/desliga páginas, IA, canvas, interface e fontes.",
    keywords: ["recursos", "flags", "funcionalidades", "feature", "toggle"],
    originPath: "/configuracoes",
  },
  {
    id: "ai-settings",
    label: "Configuração de IA",
    description: "Modo de IA (auto/local/cloud), modelo, contexto e comportamento.",
    keywords: ["ia", "ai", "modelo", "ollama", "configuracao", "provider"],
    originPath: "/configuracoes",
  },
  {
    id: "top-charts",
    label: "Top charts",
    description: "Explorador dos rankings das lojas (grátis/pagos/arrecadação) por região.",
    keywords: ["top", "charts", "ranking", "lojas", "populares"],
    originPath: "/",
  },
  {
    id: "uni-sources",
    label: "Saída Uni (multifonte)",
    description: "Terminal de saída das coletas multifonte da Uni em tempo real.",
    keywords: ["uni", "fontes", "multifonte", "web", "noticias", "academico", "saida", "terminal"],
    originPath: "/00",
  },
  {
    id: "uni-picker",
    label: "Seletor de fontes Uni",
    description: "Seletor interativo das fontes da Uni + modo de coleta — configura e roda a coleta multifonte passo a passo.",
    keywords: ["uni", "fontes", "selecionar", "seletor", "multifonte", "configurar coleta", "picker"],
    originPath: "/00",
  },
  {
    id: "report",
    label: "Relatório de experimentos",
    description: "Últimas saídas de IA geradas (relatórios e análises) com proveniência.",
    keywords: ["relatorio", "report", "experimentos", "analises", "saidas", "ia"],
    originPath: "/experiments",
  },
];

/* -------------------------------------------------------- resolução ----- */

/** Normaliza para comparação: minúsculas, sem acento, sem pontuação extra. */
export function normText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function scoreSurface(def: EmbeddableSurfaceDef, q: string): number {
  const id = normText(def.id);
  const label = normText(def.label);
  if (id === q || label === q) return 100;
  let score = 0;
  if (id.startsWith(q) || label.startsWith(q)) score = Math.max(score, 60);
  if (label.includes(q) || id.includes(q)) score = Math.max(score, 40);
  for (const k of def.keywords) {
    const kw = normText(k);
    if (kw === q) score = Math.max(score, 80);
    else if (kw.startsWith(q) || q.startsWith(kw)) score = Math.max(score, 50);
    else if (kw.includes(q)) score = Math.max(score, 30);
  }
  if (normText(def.description).includes(q) && q.length >= 4) score = Math.max(score, 20);
  return score;
}

/**
 * Resolve uma consulta em linguagem natural para uma superfície.
 * Retorna a melhor correspondência (score ≥ 20) ou null.
 */
export function resolveSurface(query: string): EmbeddableSurfaceDef | null {
  const q = normText(query).replace(/^(pagina|page|componente|component|painel|panel|aba|tab)\s+(de|da|do)?\s*/, "");
  if (!q) return null;
  let best: EmbeddableSurfaceDef | null = null;
  let bestScore = 0;
  for (const def of EMBEDDABLE_SURFACES) {
    const s = scoreSurface(def, q);
    if (s > bestScore) {
      bestScore = s;
      best = def;
    }
  }
  return bestScore >= 20 ? best : null;
}

/** Busca todas as superfícies que batem com a consulta (para sugestões). */
export function searchSurfaces(query: string, limit = 5): EmbeddableSurfaceDef[] {
  const q = normText(query);
  if (!q) return EMBEDDABLE_SURFACES.slice(0, limit);
  return EMBEDDABLE_SURFACES.map((def) => ({ def, s: scoreSurface(def, q) }))
    .filter((x) => x.s >= 20)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.def);
}

/** Bloco de instruções para o system prompt da IA: como pedir componentes. */
export const COMPONENT_FENCE_INSTRUCTIONS = `
COMPONENTES INTERATIVOS: você pode exibir componentes REAIS e interativos do
sistema dentro da sua resposta usando um bloco fenced \`\`\`component com o id
da superfície na primeira linha. O usuário poderá USAR o componente
normalmente (ele é o componente real, não uma imagem). Superfícies
disponíveis:
${EMBEDDABLE_SURFACES.map((s) => `- ${s.id}: ${s.label} — ${s.description}`).join("\n")}
Use quando o usuário pedir para "exibir/mostrar/abrir" uma página, painel ou
componente. Exemplo:
\`\`\`component
charts
\`\`\`
`.trim();
