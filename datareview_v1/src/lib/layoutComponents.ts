/**
 * Layout Components — registry dos componentes REAIS do sistema que podem ser
 * vinculados a um bloco de layout (na página `/layouts`), tornando o layout
 * uma tela customizada funcional com conteúdo dinâmico do dataset.
 *
 * O renderer vive em `src/components/layoutBuilder/LayoutComponents.tsx`
 * (este arquivo é puro: metadados, sem JSX).
 *
 * Cada componente declara:
 *  - `group`     — categoria funcional (dados / ia / sistema / conteúdo);
 *  - `originPage`— de qual página do sistema o componente veio (alimenta a
 *                  aba "Páginas" da galeria de componentes);
 *  - `minHeight` — altura mínima sugerida do bloco (o construtor usa ao
 *                  vincular, para o componente não nascer espremido).
 */
import type { LucideIcon } from "lucide-react";
import {
  Search, Layers, MessageSquare, BarChart3, Gauge, Lightbulb,
  Activity, PanelTop, LayoutList, Database, Trophy, ShieldCheck,
  Settings2, Archive, ListFilter, WholeWord, TrendingUp, GitCompare,
  Table2, ShieldAlert, Vault, Sparkles, Bot, StickyNote, Presentation,
  ListTodo, TextCursorInput, ListChecks, CheckSquare, SearchCode,
} from "lucide-react";

export type LayoutComponentGroup = "dados" | "ia" | "sistema" | "conteudo";

export interface LayoutComponentMeta {
  id: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  group: LayoutComponentGroup;
  /** Página do sistema de onde o componente é reaproveitado (aba "Páginas"). */
  originPage: string;
  /** Altura mínima sugerida (px) ao vincular o componente a um bloco. */
  minHeight?: number;
}

export const LAYOUT_COMPONENT_GROUPS: Record<LayoutComponentGroup, string> = {
  dados: "Dados coletados",
  ia: "Inteligência Artificial",
  sistema: "Sistema",
  conteudo: "Conteúdo",
};

export const LAYOUT_COMPONENTS: LayoutComponentMeta[] = [
  // ── Busca & coleta (página Início / Hub 01) ──────────────────────────
  { id: "search-field", label: "Campo de busca", desc: "Só o campo de busca nas duas lojas (resultados ficam no componente Resultados).", icon: TextCursorInput, group: "dados", originPage: "/", minHeight: 56 },
  { id: "search-results", label: "Resultados da busca", desc: "Resultados da última busca com coleta em 1 clique.", icon: ListFilter, group: "dados", originPage: "/", minHeight: 140 },
  { id: "search-collect", label: "Buscar & coletar (tudo-em-um)", desc: "Campo + resultados + seleção num único bloco.", icon: Search, group: "dados", originPage: "/", minHeight: 220 },
  { id: "app-selection", label: "Selecionados", desc: "Apps coletados com seleção global (chips Todos/Nenhum).", icon: CheckSquare, group: "dados", originPage: "/01", minHeight: 100 },
  { id: "apps-history", label: "Apps & histórico", desc: "Apps coletados (seleção global) + histórico de sessões/gerações.", icon: Layers, group: "dados", originPage: "/01", minHeight: 160 },
  { id: "collected-list", label: "Coletados (lista)", desc: "Todos os apps coletados agrupados por loja, expansíveis com metadados e amostra de reviews.", icon: LayoutList, group: "dados", originPage: "/dados", minHeight: 160 },
  { id: "top-charts", label: "Top Charts", desc: "Explorador dos mais baixados das lojas (tipo, quantidade, região).", icon: Trophy, group: "dados", originPage: "/", minHeight: 260 },

  // ── Análises de dados (Dashboard / Pipeline) ─────────────────────────
  { id: "dataset", label: "Dataset", desc: "Tabela dos apps coletados com KPIs por app.", icon: Database, group: "dados", originPage: "/dados", minHeight: 140 },
  { id: "kpis", label: "KPIs", desc: "Cartões de apps, reviews, nota média e sentimento.", icon: Gauge, group: "dados", originPage: "/dashboard", minHeight: 110 },
  { id: "charts", label: "Gráficos", desc: "KPIs, distribuição de notas, sentimento e timeline do escopo.", icon: BarChart3, group: "dados", originPage: "/dashboard", minHeight: 260 },
  { id: "reviews-feed", label: "Reviews recentes", desc: "Feed de reviews do escopo com filtro por nota.", icon: ListChecks, group: "dados", originPage: "/dashboard", minHeight: 200 },
  { id: "wordcloud", label: "Nuvem de termos", desc: "Termos mais frequentes nos reviews do escopo.", icon: WholeWord, group: "dados", originPage: "/dashboard", minHeight: 160 },
  { id: "timeline", label: "Timeline", desc: "Evolução do volume de reviews ao longo do tempo.", icon: TrendingUp, group: "dados", originPage: "/dashboard", minHeight: 180 },
  { id: "store-compare", label: "Apple × Google", desc: "Comparativo de volume e nota por loja.", icon: GitCompare, group: "dados", originPage: "/compare", minHeight: 180 },
  { id: "per-app", label: "Por app", desc: "Tabela comparativa por app (reviews, nota, % positivo/negativo).", icon: Table2, group: "dados", originPage: "/dashboard", minHeight: 160 },
  { id: "anomalies", label: "Anomalias", desc: "Detecção determinística: regressão de versão, picos de negatividade/volume, outliers.", icon: ShieldAlert, group: "dados", originPage: "/pipeline", minHeight: 160 },
  { id: "artifacts", label: "Vault de artefatos", desc: "Artefatos de conhecimento do Pipeline (fatos, análises, insights).", icon: Vault, group: "dados", originPage: "/pipeline", minHeight: 180 },

  // ── Inteligência Artificial ──────────────────────────────────────────
  { id: "ai-chat", label: "Chat com IA", desc: "Conversa com a IA sobre os apps selecionados (como a página /chat).", icon: MessageSquare, group: "ia", originPage: "/chat", minHeight: 240 },
  { id: "ai-section", label: "Análise de IA", desc: "Executa uma seção de análise de IA (resumo, problemas, oportunidades…) sobre o escopo.", icon: Sparkles, group: "ia", originPage: "/experiments", minHeight: 220 },
  { id: "insights", label: "Insights de IA", desc: "Últimas gerações de IA registradas no sistema.", icon: Lightbulb, group: "ia", originPage: "/outputs", minHeight: 160 },
  { id: "agents", label: "Agentes", desc: "Executa um agente do sistema (pipeline de etapas) sobre o escopo.", icon: Bot, group: "ia", originPage: "/agentes", minHeight: 200 },

  // ── Sistema ──────────────────────────────────────────────────────────
  { id: "activity", label: "Atividade", desc: "Log de atividade do sistema (coletas, gerações, tarefas).", icon: Activity, group: "sistema", originPage: "/01", minHeight: 140 },
  { id: "tasks", label: "Tarefas", desc: "Tarefas em andamento e recentes (processos do sistema).", icon: ListTodo, group: "sistema", originPage: "/01", minHeight: 120 },
  { id: "data-quality", label: "Qualidade dos dados", desc: "Validação determinística do dataset (8 checks de integridade).", icon: ShieldCheck, group: "sistema", originPage: "/pipeline-dados", minHeight: 200 },
  { id: "collection-config", label: "Config de coleta", desc: "Resultados por loja, limite de reviews, ordenação, região e idioma.", icon: Settings2, group: "sistema", originPage: "/configuracoes", minHeight: 160 },
  { id: "generations", label: "Gerações", desc: "Histórico unificado de coletas e gerações de IA.", icon: Archive, group: "sistema", originPage: "/sessions", minHeight: 180 },
  { id: "decks", label: "Apresentações", desc: "Decks de slides salvos (prévia + abrir).", icon: Presentation, group: "sistema", originPage: "/apresentacoes", minHeight: 140 },
  { id: "header", label: "Cabeçalho", desc: "Barra de topo com título e ações rápidas.", icon: PanelTop, group: "sistema", originPage: "—", minHeight: 48 },
  { id: "status", label: "Status & progresso", desc: "Resumo do dataset, IA ativa e tarefas em andamento.", icon: LayoutList, group: "sistema", originPage: "—", minHeight: 48 },

  // ── Conteúdo livre ───────────────────────────────────────────────────
  { id: "note", label: "Nota / Markdown", desc: "Bloco de texto livre editável (markdown) — documentação da tela.", icon: StickyNote, group: "conteudo", originPage: "—", minHeight: 120 },
  { id: "search-lab", label: "Busca semântica", desc: "Busca por significado nos reviews coletados (embeddings locais).", icon: SearchCode, group: "ia", originPage: "/dashboard", minHeight: 180 },
];

export function layoutComponentMeta(id: string | undefined): LayoutComponentMeta | null {
  if (!id) return null;
  return LAYOUT_COMPONENTS.find((c) => c.id === id) ?? null;
}

/** Prefixo de componente "qualquer um do catálogo completo" — id é `cat:<arquivo>`. */
export const PUBLIC_COMPONENT_PREFIX = "cat:";
export function publicComponentId(file: string): string {
  return PUBLIC_COMPONENT_PREFIX + file;
}
export function publicComponentFile(id: string | undefined): string | null {
  if (!id || !id.startsWith(PUBLIC_COMPONENT_PREFIX)) return null;
  return id.slice(PUBLIC_COMPONENT_PREFIX.length);
}

/** Componentes agrupados pela página de origem (aba "Páginas" da galeria). */
export function componentsByOriginPage(): { page: string; items: LayoutComponentMeta[] }[] {
  const map = new Map<string, LayoutComponentMeta[]>();
  for (const c of LAYOUT_COMPONENTS) {
    const list = map.get(c.originPage) ?? [];
    list.push(c);
    map.set(c.originPage, list);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] === "—" ? 1 : b[0] === "—" ? -1 : a[0].localeCompare(b[0])))
    .map(([page, items]) => ({ page, items }));
}
