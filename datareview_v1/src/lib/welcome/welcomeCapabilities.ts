/**
 * Conteúdo interativo da página Boas-vindas — puro e testável.
 *
 * Dois blocos:
 * 1. Stats ao vivo (`welcomeStats`) — números REAIS do sistema (dataset local,
 *    registry de páginas, fontes Uni), nunca inventados.
 * 2. Tour de capacidades (`WELCOME_CAPABILITIES`) — as 6 portas de entrada
 *    curadas para o que o sistema faz de melhor, cada uma levando a uma página
 *    real do registry PAGES.
 */

/** Um cartão do tour de capacidades. */
export interface WelcomeCapability {
  id: string;
  title: string;
  desc: string;
  /** Rota real do sistema (validada contra o registry PAGES em teste). */
  path: string;
}

/** As 6 capacidades vitrine — curadoria do "o que este sistema faz de melhor". */
export const WELCOME_CAPABILITIES: WelcomeCapability[] = [
  {
    id: "collect",
    title: "Coleta de reviews reais",
    desc: "Apple App Store e Google Play em dezenas de países — milhares de reviews por app, com dedup e enriquecimento automático.",
    path: "/inicio",
  },
  {
    id: "multisource",
    title: "30+ fontes de dados",
    desc: "YouTube, Reddit, Wikipédia, Hacker News, GitHub, Trends, lojas e mais — pesquise um termo em todas de uma vez.",
    path: "/00",
  },
  {
    id: "noai",
    title: "Análise sem IA",
    desc: "KPIs, sentimento, termos, versões, países e detecção de anomalias — tudo determinístico, instantâneo e auditável.",
    path: "/dashboard",
  },
  {
    id: "ai",
    title: "IA que trabalha para você",
    desc: "Local (Ollama), na nuvem com a sua chave, ou desligada. Análises com evidência citada dos seus próprios reviews.",
    path: "/experiments",
  },
  {
    id: "flow",
    title: "Fluxo guiado de ponta a ponta",
    desc: "Da descoberta à apresentação em 16 etapas: o sistema inteiro organizado numa jornada única.",
    path: "/fluxo",
  },
  {
    id: "present",
    title: "Decisões que se apresentam",
    desc: "Decks executivos, relatórios e exportações gerados dos seus dados — prontos para compartilhar.",
    path: "/apresentacoes",
  },
];

/** Um número vivo do sistema. */
export interface WelcomeStat {
  id: string;
  label: string;
  value: number;
  /** Texto de apoio honesto quando o valor é zero. */
  emptyHint?: string;
}

/**
 * Monta os stats ao vivo a partir de contagens reais. `pages`/`sources` vêm
 * dos registries (PAGES e UNI_SOURCE_META) — sempre atualizados por definição.
 */
export function welcomeStats(input: {
  apps: number;
  reviews: number;
  pages: number;
  sources: number;
}): WelcomeStat[] {
  return [
    {
      id: "apps",
      label: input.apps === 1 ? "app coletado" : "apps coletados",
      value: input.apps,
      emptyHint: "o primeiro é coletado em 1 minuto",
    },
    {
      id: "reviews",
      label: "reviews guardados",
      value: input.reviews,
      emptyHint: "no seu navegador, só seus",
    },
    { id: "pages", label: "páginas no sistema", value: input.pages },
    { id: "sources", label: "fontes de dados", value: input.sources },
  ];
}
