import { Workflow, Search, Download, Sparkles, BarChart3, Eye, StickyNote, Filter, Table2, FileText, Bug, TrendingUp, Users, Wand2, GitBranch, LayoutDashboard, Activity, Hash, Gauge, ShieldAlert, CalendarDays } from "lucide-react";
import type { CanvasNode, CanvasEdge } from "@/lib/canvasStore";
import type { NodeKind } from "@/components/canvas/nodeRegistry";

export interface PipelineTemplate {
  id: string;
  name: string;
  description: string;
  icon: typeof Workflow;
  tags: string[];
  build: () => { nodes: CanvasNode[]; edges: CanvasEdge[] };
}

const mk = (
  id: string,
  kind: NodeKind,
  label: string,
  position: { x: number; y: number },
  config: Record<string, unknown> = {},
): CanvasNode => ({ id, type: kind, position, data: { kind, label, config } });

const edge = (id: string, source: string, target: string): CanvasEdge => ({
  id, source, target, animated: true,
});

/**
 * Templates de pipeline prontos que o usuário carrega da galeria.
 * Cada um é um grafo autocontido e editável cobrindo um fluxo de trabalho comum.
 */
export const PIPELINE_TEMPLATES: PipelineTemplate[] = [
  {
    id: "single-deep-dive",
    name: "Mergulho profundo num app",
    description: "Busca um app, coleta reviews e gera resumo executivo + bugs + gráfico de notas.",
    icon: Search,
    tags: ["análise", "single-app"],
    build: () => ({
      nodes: [
        mk("t1_search", "search", "Buscar app", { x: 0, y: 160 }, { term: "nubank", store: "both", limit: 5 }),
        mk("t1_collect", "collect", "Coletar reviews", { x: 280, y: 160 }, { reviewLimit: 500 }),
        mk("t1_summary", "analyze", "Resumo executivo", { x: 560, y: 0 }, { section: "summary" }),
        mk("t1_summary_out", "output", "Saída: resumo", { x: 840, y: 0 }, {}),
        mk("t1_bugs", "analyze", "Principais bugs", { x: 560, y: 160 }, { section: "problems" }),
        mk("t1_bugs_out", "output", "Saída: bugs", { x: 840, y: 160 }, {}),
        mk("t1_chart", "chart", "Distribuição de notas", { x: 560, y: 320 }, { chartType: "rating" }),
        mk("t1_chart_out", "output", "Saída: gráfico", { x: 840, y: 320 }, {}),
        mk("t1_note", "note", "Mergulho profundo", { x: 280, y: -60 }, { text: "Busca → coleta → resumo + bugs + gráfico, cada um com seu nó de Saída renderizada. Edite o termo de busca e o limite de reviews." }),
      ],
      edges: [
        edge("t1_e1", "t1_search", "t1_collect"),
        edge("t1_e2", "t1_collect", "t1_summary"),
        edge("t1_e3", "t1_collect", "t1_bugs"),
        edge("t1_e4", "t1_collect", "t1_chart"),
        edge("t1_e5", "t1_summary", "t1_summary_out"),
        edge("t1_e6", "t1_bugs", "t1_bugs_out"),
        edge("t1_e7", "t1_chart", "t1_chart_out"),
      ],
    }),
  },
  {
    id: "competitive-analysis",
    name: "Análise competitiva",
    description: "Compara N apps concorrentes: coleta, tabela comparativa, oportunidades e estratégia.",
    icon: TrendingUp,
    tags: ["comparativo", "estratégia"],
    build: () => ({
      nodes: [
        mk("t2_search", "search", "Buscar concorrentes", { x: 0, y: 120 }, { term: "banco digital", store: "both", limit: 8 }),
        mk("t2_collect", "collect", "Coletar todos", { x: 280, y: 120 }, { reviewLimit: 300 }),
        mk("t2_table", "table", "Tabela comparativa", { x: 560, y: 40 }, {}),
        mk("t2_opp", "analyze", "Oportunidades", { x: 560, y: 180 }, { section: "opportunities" }),
        mk("t2_strategy", "analyze", "Estratégia", { x: 840, y: 180 }, { section: "strategy" }),
        mk("t2_report", "report", "Relatório de análise", { x: 840, y: 40 }, { prompt: "Gere um relatório executivo de análise competitiva comparando os apps coletados: pontos fortes/fracos de cada um, oportunidades de diferenciação e recomendações estratégicas." }),
        mk("t2_note", "note", "Análise competitiva", { x: 280, y: -60 }, { text: "Busca concorrentes → coleta → tabela + oportunidades + estratégia + relatório consolidado." }),
      ],
      edges: [
        edge("t2_e1", "t2_search", "t2_collect"),
        edge("t2_e2", "t2_collect", "t2_table"),
        edge("t2_e3", "t2_collect", "t2_opp"),
        edge("t2_e4", "t2_opp", "t2_strategy"),
        edge("t2_e5", "t2_collect", "t2_report"),
      ],
    }),
  },
  {
    id: "bug-hunt",
    name: "Caça a bugs por versão",
    description: "Filtra reviews negativos e gera relatório de bugs + solicitações priorizadas.",
    icon: Bug,
    tags: ["bugs", "qualidade"],
    build: () => ({
      nodes: [
        mk("t3_search", "search", "Buscar app", { x: 0, y: 120 }, { term: "spotify", store: "both", limit: 3 }),
        mk("t3_collect", "collect", "Coletar reviews", { x: 280, y: 120 }, { reviewLimit: 1000 }),
        mk("t3_filter", "filter", "Só negativos (≤2★)", { x: 560, y: 120 }, { minRating: 2, store: "" }),
        mk("t3_bugs", "analyze", "Bugs por versão", { x: 840, y: 40 }, { section: "problems" }),
        mk("t3_req", "analyze", "Solicitações", { x: 840, y: 180 }, { section: "requests" }),
        mk("t3_report", "report", "Relatório de bugs", { x: 1120, y: 100 }, { prompt: "Gere um relatório de bugs consolidado: liste os bugs mais reportados por versão, frequência, severidade estimada e impacto no usuário, com citações reais dos reviews negativos." }),
        mk("t3_note", "note", "Caça a bugs", { x: 280, y: -60 }, { text: "Foco em reviews negativos → bugs + solicitações → relatório priorizado por severidade." }),
      ],
      edges: [
        edge("t3_e1", "t3_search", "t3_collect"),
        edge("t3_e2", "t3_collect", "t3_filter"),
        edge("t3_e3", "t3_filter", "t3_bugs"),
        edge("t3_e4", "t3_filter", "t3_req"),
        edge("t3_e5", "t3_filter", "t3_report"),
      ],
    }),
  },
  {
    id: "category-scan",
    name: "Scan de categoria",
    description: "Busca ampla numa categoria, coleta leve e tabela + oportunidades de mercado.",
    icon: BarChart3,
    tags: ["mercado", "descoberta"],
    build: () => ({
      nodes: [
        mk("t4_search", "search", "Buscar categoria", { x: 0, y: 120 }, { term: "investimentos", store: "both", limit: 10 }),
        mk("t4_collect", "collect", "Coleta leve", { x: 280, y: 120 }, { reviewLimit: 100 }),
        mk("t4_table", "table", "Panorama do mercado", { x: 560, y: 60 }, {}),
        mk("t4_chart", "chart", "Notas do mercado", { x: 560, y: 200 }, { chartType: "rating" }),
        mk("t4_opp", "analyze", "Oportunidades", { x: 840, y: 130 }, { section: "opportunities" }),
        mk("t4_note", "note", "Scan de categoria", { x: 280, y: -60 }, { text: "Busca ampla → coleta leve → panorama + notas + oportunidades de mercado." }),
      ],
      edges: [
        edge("t4_e1", "t4_search", "t4_collect"),
        edge("t4_e2", "t4_collect", "t4_table"),
        edge("t4_e3", "t4_collect", "t4_chart"),
        edge("t4_e4", "t4_collect", "t4_opp"),
      ],
    }),
  },
  {
    id: "executive-report",
    name: "Relatório executivo completo",
    description: "Pipeline de apresentação: coleta → resumo → relatório em markdown estilo slides.",
    icon: FileText,
    tags: ["relatório", "apresentação"],
    build: () => ({
      nodes: [
        mk("t5_search", "search", "Buscar app", { x: 0, y: 140 }, { term: "itau", store: "both", limit: 3 }),
        mk("t5_collect", "collect", "Coletar reviews", { x: 280, y: 140 }, { reviewLimit: 500 }),
        mk("t5_report", "report", "Apresentação executiva", { x: 560, y: 140 }, { prompt: "Gere uma apresentação executiva completa sobre o app coletado: capa com nome do app e resumo de 1 linha; slide de métricas (nota, nº de reviews, sentimento); slide de pontos fortes; slide de problemas críticos; slide de oportunidades; slide de recomendações priorizadas. Use cabeçalhos de nível 2 como separadores de slide." }),
        mk("t5_note", "note", "Relatório executivo", { x: 280, y: -40 }, { text: "Gera uma apresentação em markdown com slides separados por cabeçalhos ##. Renderizado como relatório no nó final." }),
      ],
      edges: [
        edge("t5_e1", "t5_search", "t5_collect"),
        edge("t5_e2", "t5_collect", "t5_report"),
      ],
    }),
  },
  {
    id: "persona-journey",
    name: "Personas e jornada",
    description: "Deriva personas e jornada do usuário a partir dos reviews coletados.",
    icon: Users,
    tags: ["ux", "personas"],
    build: () => ({
      nodes: [
        mk("t6_search", "search", "Buscar app", { x: 0, y: 120 }, { term: "mercadolivre", store: "both", limit: 3 }),
        mk("t6_collect", "collect", "Coletar reviews", { x: 280, y: 120 }, { reviewLimit: 500 }),
        mk("t6_personas", "analyze", "Personas prováveis", { x: 560, y: 40 }, { section: "personas" }),
        mk("t6_journey", "analyze", "Jornada do usuário", { x: 560, y: 200 }, { section: "journey" }),
        mk("t6_report", "report", "Relatório UX", { x: 840, y: 120 }, { prompt: "Gere um relatório de UX consolidando personas e jornada: descreva 3 personas principais com necessidades e dores; mapeie a jornada do usuário com pontos de fricção; recomende melhorias de UX priorizadas por impacto." }),
        mk("t6_note", "note", "Personas e jornada", { x: 280, y: -60 }, { text: "Deriva personas + jornada dos reviews e consolida num relatório de UX." }),
      ],
      edges: [
        edge("t6_e1", "t6_search", "t6_collect"),
        edge("t6_e2", "t6_collect", "t6_personas"),
        edge("t6_e3", "t6_collect", "t6_journey"),
        edge("t6_e4", "t6_collect", "t6_report"),
      ],
    }),
  },
  {
    id: "chained-refinement",
    name: "IA encadeada: refinar e apresentar",
    description: "Coleta → análise IA → refina a análise anterior (IA lê IA) → gera apresentação final. Mostra como os nós se conversam.",
    icon: GitBranch,
    tags: ["encadeado", "IA", "apresentação"],
    build: () => ({
      nodes: [
        mk("c1_search", "search", "Buscar app", { x: 0, y: 160 }, { term: "nubank", store: "both", limit: 3 }),
        mk("c1_collect", "collect", "Coletar reviews", { x: 280, y: 160 }, { reviewLimit: 500 }),
        mk("c1_summary", "analyze", "Análise inicial", { x: 560, y: 160 }, { section: "summary" }),
        mk("c1_refine", "analyze", "Aprofundar análise", { x: 840, y: 160 }, { section: "summary" }),
        mk("c1_prompt", "prompt", "Apresentação final", { x: 1120, y: 160 }, { prompt: "Transforme a análise anterior numa apresentação executiva: capa, métricas-chave, pontos fortes, problemas críticos e recomendações priorizadas. Use ## como separador de slides." }),
        mk("c1_chart", "chart", "Sentimento", { x: 560, y: 320 }, { chartType: "sentiment" }),
        mk("c1_note", "note", "IA encadeada", { x: 280, y: -40 }, { text: "Pipeline encadeado: a IA do nó 'Aprofundar' lê a SAÍDA do nó 'Análise inicial' (não os dados brutos). O nó 'Apresentação' lê a saída refinada. Cada nó IA analisa o que o anterior gerou." }),
      ],
      edges: [
        edge("c1_e1", "c1_search", "c1_collect"),
        edge("c1_e2", "c1_collect", "c1_summary"),
        edge("c1_e3", "c1_summary", "c1_refine"),
        edge("c1_e4", "c1_refine", "c1_prompt"),
        edge("c1_e5", "c1_collect", "c1_chart"),
      ],
    }),
  },
  {
    id: "sentiment-dashboard",
    name: "Dashboard de sentimento",
    description: "Pipeline visual completo: coleta → KPIs de sentimento + gráficos qualitativos + análise de temas.",
    icon: BarChart3,
    tags: ["dashboard", "visual", "sentimento"],
    build: () => ({
      nodes: [
        mk("s1_search", "search", "Buscar apps", { x: 0, y: 200 }, { term: "delivery", store: "both", limit: 5 }),
        mk("s1_collect", "collect", "Coletar reviews", { x: 280, y: 200 }, { reviewLimit: 400 }),
        mk("s1_rating", "chart", "Distribuição de notas", { x: 560, y: 40 }, { chartType: "rating" }),
        mk("s1_sentiment", "chart", "Sentimento", { x: 560, y: 240 }, { chartType: "sentiment" }),
        mk("s1_timeline", "chart", "Evolução temporal", { x: 840, y: 40 }, { chartType: "timeline" }),
        mk("s1_wordcloud", "chart", "Nuvem de termos", { x: 840, y: 240 }, { chartType: "wordcloud" }),
        mk("s1_qual", "analyze", "Padrões qualitativos", { x: 1120, y: 140 }, { section: "qualitative" }),
        mk("s1_note", "note", "Dashboard de sentimento", { x: 280, y: -40 }, { text: "Pipeline visual: 4 gráficos (notas, sentimento, timeline, nuvem de termos) + análise qualitativa da IA. Variedade de visualizações sobre os mesmos dados coletados." }),
      ],
      edges: [
        edge("s1_e1", "s1_search", "s1_collect"),
        edge("s1_e2", "s1_collect", "s1_rating"),
        edge("s1_e3", "s1_collect", "s1_sentiment"),
        edge("s1_e4", "s1_collect", "s1_timeline"),
        edge("s1_e5", "s1_collect", "s1_wordcloud"),
        edge("s1_e6", "s1_collect", "s1_qual"),
      ],
    }),
  },
  {
    id: "full-dashboard",
    name: "Dashboard completo (sem IA)",
    description: "Coleta → nó Dashboard (KPIs + 4 gráficos) + estatísticas + sentimento + temas. Tudo determinístico, sem IA.",
    icon: LayoutDashboard,
    tags: ["dashboard", "visual", "sem IA"],
    build: () => ({
      nodes: [
        mk("d1_search", "search", "Buscar apps", { x: 0, y: 200 }, { term: "banco", store: "both", limit: 5 }),
        mk("d1_collect", "collect", "Coletar reviews", { x: 280, y: 200 }, { reviewLimit: 500 }),
        mk("d1_dashboard", "dashboard", "Dashboard", { x: 560, y: 40 }, {}),
        mk("d1_dashboard_out", "output", "Saída: dashboard", { x: 840, y: 40 }, {}),
        mk("d1_stats", "statistics", "Estatísticas", { x: 560, y: 360 }, {}),
        mk("d1_stats_out", "output", "Saída: estatísticas", { x: 840, y: 360 }, {}),
        mk("d1_sentiment", "sentiment", "Sentimento", { x: 1120, y: 40 }, {}),
        mk("d1_sentiment_out", "output", "Saída: sentimento", { x: 1400, y: 40 }, {}),
        mk("d1_themes", "themes", "Temas", { x: 1120, y: 360 }, {}),
        mk("d1_themes_out", "output", "Saída: temas", { x: 1400, y: 360 }, {}),
        mk("d1_note", "note", "Dashboard sem IA", { x: 280, y: -40 }, { text: "Pipeline 100% determinístico: dashboard com KPIs + 4 gráficos, estatísticas, sentimento e temas — cada um com seu nó de Saída renderizada. Tudo derivado dos mesmos dados coletados, sem chamar IA." }),
      ],
      edges: [
        edge("d1_e1", "d1_search", "d1_collect"),
        edge("d1_e2", "d1_collect", "d1_dashboard"),
        edge("d1_e3", "d1_collect", "d1_stats"),
        edge("d1_e4", "d1_collect", "d1_sentiment"),
        edge("d1_e5", "d1_collect", "d1_themes"),
        edge("d1_e6", "d1_dashboard", "d1_dashboard_out"),
        edge("d1_e7", "d1_stats", "d1_stats_out"),
        edge("d1_e8", "d1_sentiment", "d1_sentiment_out"),
        edge("d1_e9", "d1_themes", "d1_themes_out"),
      ],
    }),
  },
  {
    id: "geo-temporal",
    name: "Geografia & temporal",
    description: "Coleta → análise por país + por versão + evolução temporal. Lentes geográfica e temporal sobre os mesmos reviews.",
    icon: Filter,
    tags: ["geo", "temporal", "sem IA"],
    build: () => ({
      nodes: [
        mk("g1_search", "search", "Buscar app", { x: 0, y: 200 }, { term: "uber", store: "both", limit: 3 }),
        mk("g1_collect", "collect", "Coletar reviews", { x: 280, y: 200 }, { reviewLimit: 800 }),
        mk("g1_country", "country-analysis", "Análise por país", { x: 560, y: 60 }, {}),
        mk("g1_country_out", "output", "Saída: países", { x: 840, y: 60 }, {}),
        mk("g1_version", "version-analysis", "Análise por versão", { x: 560, y: 220 }, {}),
        mk("g1_version_out", "output", "Saída: versões", { x: 840, y: 220 }, {}),
        mk("g1_timeline", "chart", "Evolução temporal", { x: 560, y: 380 }, { chartType: "timeline" }),
        mk("g1_timeline_out", "output", "Saída: timeline", { x: 840, y: 380 }, {}),
        mk("g1_note", "note", "Geo & temporal", { x: 280, y: -40 }, { text: "Três lentes determinísticas sobre os mesmos reviews: por país, por versão e evolução temporal. Sem IA — puro processamento." }),
      ],
      edges: [
        edge("g1_e1", "g1_search", "g1_collect"),
        edge("g1_e2", "g1_collect", "g1_country"),
        edge("g1_e3", "g1_collect", "g1_version"),
        edge("g1_e4", "g1_collect", "g1_timeline"),
        edge("g1_e5", "g1_country", "g1_country_out"),
        edge("g1_e6", "g1_version", "g1_version_out"),
        edge("g1_e7", "g1_timeline", "g1_timeline_out"),
      ],
    }),
  },
  {
    id: "market-gap-discovery",
    name: "Descoberta de gaps de mercado",
    description: "Coleta → oportunidades de IA + white-space (scatter) + heatmap competitivo → conceito de produto.",
    icon: TrendingUp,
    tags: ["estratégia", "descoberta", "IA"],
    build: () => ({
      nodes: [
        mk("m1_search", "search", "Buscar concorrentes", { x: 0, y: 200 }, { term: "carteira digital", store: "both", limit: 8 }),
        mk("m1_collect", "collect", "Coletar todos", { x: 280, y: 200 }, { reviewLimit: 300 }),
        mk("m1_opp", "analyze", "Oportunidades", { x: 560, y: 60 }, { section: "opportunities" }),
        mk("m1_opp_out", "output", "Saída: oportunidades", { x: 840, y: 60 }, {}),
        mk("m1_scatter", "chart", "Mapa de mercado", { x: 560, y: 220 }, { chartType: "scatter" }),
        mk("m1_scatter_out", "output", "Saída: mapa", { x: 840, y: 220 }, {}),
        mk("m1_heat", "chart", "Mapa de calor competitivo", { x: 560, y: 380 }, { chartType: "heatmap" }),
        mk("m1_heat_out", "output", "Saída: heatmap", { x: 840, y: 380 }, {}),
        mk("m1_concept", "prompt", "Conceito de produto", { x: 1120, y: 220 }, { prompt: "Com base nas oportunidades e no mapa de mercado acima, proponha um conceito de produto que explore o maior gap: problema-alvo, usuário-alvo, proposta de valor e diferencial. Cite evidências." }),
        mk("m1_note", "note", "Descoberta de gaps", { x: 280, y: -40 }, { text: "Pipeline de descoberta: oportunidades de IA + mapa de mercado (dispersão) + heatmap competitivo → conceito de produto. Combina IA e análises determinísticas." }),
      ],
      edges: [
        edge("m1_e1", "m1_search", "m1_collect"),
        edge("m1_e2", "m1_collect", "m1_opp"),
        edge("m1_e3", "m1_collect", "m1_scatter"),
        edge("m1_e4", "m1_collect", "m1_heat"),
        edge("m1_e5", "m1_opp", "m1_concept"),
        edge("m1_e6", "m1_scatter", "m1_concept"),
        edge("m1_e7", "m1_opp", "m1_opp_out"),
        edge("m1_e8", "m1_scatter", "m1_scatter_out"),
        edge("m1_e9", "m1_heat", "m1_heat_out"),
      ],
    }),
  },
  {
    id: "complete-atlas",
    name: "Pipeline completo (usa todos os nós)",
    description: "Pipeline didático que exercita TODOS os tipos de nó: fontes, IA encadeada, análises sem IA, visualizações e utilitários. Bom para entender o sistema inteiro.",
    icon: LayoutDashboard,
    tags: ["completo", "didático", "todos os nós"],
    build: () => ({
      nodes: [
        // --- Fontes & dados ---
        mk("x_search", "search", "Buscar apps", { x: 0, y: 240 }, { term: "nubank", store: "both", limit: 5 }),
        mk("x_collect", "collect", "Coletar reviews", { x: 260, y: 240 }, { reviewLimit: 500 }),
        mk("x_dataset", "dataset", "Dataset local", { x: 0, y: 420 }, {}),
        mk("x_note_src", "note", "Fontes & dados", { x: 0, y: 80 }, { text: "FONTES: buscar apps (rede), coletar reviews (reusa dataset) e carregar dataset local. As três alimentam o restante do pipeline." }),

        // --- Filtro (utilitário) ---
        mk("x_filter", "filter", "Só negativos (≤2★)", { x: 520, y: 420 }, { minRating: 2, store: "" }),

        // --- Análises sem IA (determinísticas) ---
        mk("x_stats", "statistics", "Estatísticas", { x: 780, y: 60 }, {}),
        mk("x_sentiment", "sentiment", "Sentimento", { x: 780, y: 200 }, {}),
        mk("x_themes", "themes", "Temas & keywords", { x: 780, y: 340 }, {}),
        mk("x_version", "version-analysis", "Análise por versão", { x: 780, y: 480 }, {}),
        mk("x_reviews", "reviews-analysis", "Análise de reviews", { x: 780, y: 620 }, {}),
        mk("x_country", "country-analysis", "Análise por país", { x: 780, y: 760 }, {}),

        // --- Visualizações ---
        mk("x_dash", "dashboard", "Dashboard completo", { x: 1040, y: 60 }, {}),
        mk("x_chart_rating", "chart", "Notas", { x: 1040, y: 240 }, { chartType: "rating" }),
        mk("x_chart_scatter", "chart", "Dispersão", { x: 1040, y: 380 }, { chartType: "scatter" }),
        mk("x_chart_heat", "chart", "Mapa de calor", { x: 1040, y: 520 }, { chartType: "heatmap" }),
        mk("x_chart_country", "chart", "Países", { x: 1040, y: 660 }, { chartType: "country" }),
        mk("x_table", "table", "Tabela", { x: 1300, y: 380 }, {}),
        mk("x_display", "display", "Exibição", { x: 1300, y: 520 }, { text: "Resultado bruto exibido como texto." }),

        // --- IA encadeada (IA lê IA) ---
        mk("x_ai1", "analyze", "Análise inicial", { x: 1300, y: 80 }, { section: "summary" }),
        mk("x_ai2", "analyze", "Aprofundar (lê a anterior)", { x: 1560, y: 80 }, { section: "summary" }),
        mk("x_prompt", "prompt", "Apresentação (lê a anterior)", { x: 1820, y: 80 }, { prompt: "Transforme a análise anterior numa apresentação executiva com capa, métricas, pontos fortes, problemas e recomendações. Use ## como separador de slides." }),
        mk("x_report", "report", "Relatório final", { x: 1820, y: 240 }, { prompt: "Gere um relatório consolidado de inteligência de produto: contexto, achados-chave (com evidências), oportunidades priorizadas e roadmap recomendado." }),

        // --- Código (utilitário) ---
        mk("x_code", "code", "Contar reviews", { x: 1300, y: 660 }, { source: "return inputs.flatMap(i => Array.isArray(i) ? i : []).reduce((s, e) => s + (e?.reviews?.length || 0), 0);" }),

        // --- Notas explicativas ---
        mk("x_note_ia", "note", "IA encadeada", { x: 1560, y: -60 }, { text: "IA ENCADEADA: 'Aprofundar' lê a SAÍDA de 'Análise inicial' (não os dados brutos). 'Apresentação' lê a saída refinada. Cada nó IA analisa o que o anterior gerou." }),
        mk("x_note_det", "note", "Análises sem IA", { x: 520, y: -60 }, { text: "ANÁLISES DETERMINÍSTICAS: estatísticas, sentimento, temas, versão, reviews e país — derivadas dos dados sem chamar IA." }),
        mk("x_note_viz", "note", "Visualizações", { x: 1040, y: -60 }, { text: "VISUALIZAÇÕES: dashboard, gráficos (notas, dispersão, mapa de calor, países), tabela e exibição." }),
      ],
      edges: [
        // search/collect → filter + análises + IA
        edge("x_e1", "x_search", "x_collect"),
        edge("x_e2", "x_collect", "x_filter"),
        edge("x_e3", "x_collect", "x_stats"),
        edge("x_e4", "x_collect", "x_sentiment"),
        edge("x_e5", "x_collect", "x_themes"),
        edge("x_e6", "x_collect", "x_version"),
        edge("x_e7", "x_collect", "x_reviews"),
        edge("x_e8", "x_collect", "x_country"),
        edge("x_e9", "x_collect", "x_ai1"),
        edge("x_e10", "x_dataset", "x_filter"),
        // filter → reviews-analysis (negativos)
        edge("x_e11", "x_filter", "x_reviews"),
        // análises → visualizações
        edge("x_e12", "x_stats", "x_dash"),
        edge("x_e13", "x_sentiment", "x_chart_rating"),
        edge("x_e14", "x_themes", "x_chart_scatter"),
        edge("x_e15", "x_version", "x_chart_heat"),
        edge("x_e16", "x_country", "x_chart_country"),
        // coleta → tabela/display/código
        edge("x_e17", "x_collect", "x_table"),
        edge("x_e18", "x_collect", "x_display"),
        edge("x_e19", "x_collect", "x_code"),
        // encadeamento IA → IA → IA
        edge("x_e20", "x_ai1", "x_ai2"),
        edge("x_e21", "x_ai2", "x_prompt"),
        edge("x_e22", "x_ai2", "x_report"),
      ],
    }),
  },
];

const V8: PipelineTemplate[] = [
  {
    id: "quality-guard",
    name: "Guarda de qualidade",
    description: "Coleta → detecta anomalias determinísticas (regressão de versão, picos) → auditoria IA das evidências.",
    icon: ShieldAlert,
    tags: ["qualidade", "anomalias", "IA"],
    build: () => ({
      nodes: [
        mk("q1_search", "search", "Buscar app", { x: 0, y: 140 }, { term: "nubank", store: "both", limit: 5 }),
        mk("q1_collect", "collect", "Coletar reviews", { x: 280, y: 140 }, { reviewLimit: 1000 }),
        mk("q1_anomaly", "anomaly-detector", "Detector de anomalias", { x: 560, y: 60 }, {}),
        mk("q1_anomaly_out", "output", "Saída: anomalias", { x: 840, y: 60 }, {}),
        mk("q1_problems", "analyze", "Bugs mais graves", { x: 560, y: 240 }, { section: "problems" }),
        mk("q1_validate", "validator", "Validar evidências", { x: 840, y: 240 }, {}),
        mk("q1_note", "note", "Guarda de qualidade", { x: 280, y: -60 }, { text: "Primeira linha de defesa: anomalias determinísticas (sem IA) triangulam o que merece atenção; a IA audita as evidências das análises." }),
      ],
      edges: [
        edge("q1_e1", "q1_search", "q1_collect"),
        edge("q1_e2", "q1_collect", "q1_anomaly"),
        edge("q1_e3", "q1_collect", "q1_problems"),
        edge("q1_e4", "q1_problems", "q1_validate"),
        edge("q1_e5", "q1_anomaly", "q1_anomaly_out"),
      ],
    }),
  },
  {
    id: "aso-mining",
    name: "Mineração ASO",
    description: "Coleta → temas frequentes (sem IA) → IA extrai 20 keywords de ASO com relevância.",
    icon: Hash,
    tags: ["aso", "marketing", "keywords"],
    build: () => ({
      nodes: [
        mk("a1_search", "search", "Buscar app", { x: 0, y: 140 }, { term: "spotify", store: "both", limit: 5 }),
        mk("a1_collect", "collect", "Coletar reviews", { x: 280, y: 140 }, { reviewLimit: 800 }),
        mk("a1_themes", "themes", "Temas frequentes", { x: 560, y: 60 }, {}),
        mk("a1_themes_out", "output", "Saída: temas", { x: 840, y: 60 }, {}),
        mk("a1_keywords", "prompt", "Extrair keywords ASO", { x: 840, y: 220 }, { prompt: "Com base nos temas frequentes extraídos dos reviews, proponha 20 keywords de ASO (App Store Optimization) ordenadas por relevância e intent. Para cada: keyword, volume estimado (alto/médio/baixo) e dificuldade estimada. Use markdown com tabela." }),
        mk("a1_note", "note", "Mineração ASO", { x: 280, y: -60 }, { text: "Temas determinísticos (wordcloud) → IA transforma em keywords ASO priorizadas. Refine o limite de coleta ou o prompt." }),
      ],
      edges: [
        edge("a1_e1", "a1_search", "a1_collect"),
        edge("a1_e2", "a1_collect", "a1_themes"),
        edge("a1_e3", "a1_themes", "a1_themes_out"),
        edge("a1_e4", "a1_themes", "a1_keywords"),
      ],
    }),
  },
  {
    id: "version-regression-watch",
    name: "Vigilância de regressão por versão",
    description: "Coleta → tabela por versão (sem IA) → detector de anomalias → plano de ação P0/P1/P2.",
    icon: GitBranch,
    tags: ["versões", "qualidade", "plano"],
    build: () => ({
      nodes: [
        mk("v1_search", "search", "Buscar app", { x: 0, y: 160 }, { term: "spotify", store: "both", limit: 3 }),
        mk("v1_collect", "collect", "Coletar reviews", { x: 280, y: 160 }, { reviewLimit: 1000 }),
        mk("v1_version", "version-compare", "Comparar versões", { x: 560, y: 40 }, {}),
        mk("v1_version_out", "output", "Saída: versões", { x: 840, y: 40 }, {}),
        mk("v1_anomaly", "anomaly-detector", "Detector de anomalias", { x: 560, y: 260 }, {}),
        mk("v1_plan", "action-plan", "Plano de ação", { x: 1120, y: 160 }, { focus: "priorize regressões de versão e crash loops nas últimas 2 versões" }),
        mk("v1_note", "note", "Vigilância de versão", { x: 280, y: -60 }, { text: "Versão ruim logada: o comparativo por versão + o detector de anomalias apontam causas; o nó Plano de ação consolida em P0/P1/P2." }),
      ],
      edges: [
        edge("v1_e1", "v1_search", "v1_collect"),
        edge("v1_e2", "v1_collect", "v1_version"),
        edge("v1_e3", "v1_version", "v1_version_out"),
        edge("v1_e4", "v1_collect", "v1_anomaly"),
        edge("v1_e5", "v1_version", "v1_plan"),
        edge("v1_e6", "v1_anomaly", "v1_plan"),
      ],
    }),
  },
  {
    id: "weekly-review-report",
    name: "Relatório semanal de reviews",
    description: "Coleta → tendência de nota (sem IA) + amostra de recentes (sem IA) → relatório IA executivo.",
    icon: CalendarDays,
    tags: ["relatorio", "tempo", "confirmado"],
    build: () => ({
      nodes: [
        mk("w1_search", "search", "Buscar app", { x: 0, y: 160 }, { term: "nubank", store: "both", limit: 3 }),
        mk("w1_collect", "collect", "Coletar reviews", { x: 280, y: 160 }, { reviewLimit: 500 }),
        mk("w1_trend", "rating-trend", "Tendência de nota", { x: 560, y: 60 }, {}),
        mk("w1_trend_out", "output", "Saída: tendência", { x: 840, y: 60 }, {}),
        mk("w1_sampler", "review-sampler", "10 recentes", { x: 560, y: 260 }, { mode: "recent", sampleSize: 10 }),
        mk("w1_sampler_out", "output", "Saída: amostra", { x: 840, y: 260 }, {}),
        mk("w1_report", "report", "Relatório semanal", { x: 1120, y: 160 }, { prompt: "Gere um relatório executivo semanal sobre o app: sentimento-e-oportunidade resumido, tendência de nota, os reviews mais críticos citados e 3 ações recomendadas. Conclusão com veredito." }),
        mk("w1_note", "note", "Relatório semanal", { x: 280, y: -60 }, { text: "Determinístico: tendência dos reviews + amostra data-driven. IA: relatório que consolida para o resultado da semana." }),
      ],
      edges: [
        edge("w1_e1", "w1_search", "w1_collect"),
        edge("w1_e2", "w1_collect", "w1_trend"),
        edge("w1_e3", "w1_trend", "w1_trend_out"),
        edge("w1_e4", "w1_collect", "w1_sampler"),
        edge("w1_e5", "w1_sampler", "w1_sampler_out"),
        edge("w1_e6", "w1_trend", "w1_report"),
        edge("w1_e7", "w1_sampler", "w1_report"),
      ],
    }),
  },
];

const V9: PipelineTemplate[] = [
  {
    id: "auditor-cross-check",
    name: "Desafio & validação cruzada",
    description: "Coleta → análise IA → Desafiar conclusão → Validador → saída final. IA audita a própria IA.",
    icon: Sparkles,
    tags: ["IA", "auditoria", "escepticismo"],
    build: () => ({
      nodes: [
        mk("x1_search", "search", "Buscar app", { x: 0, y: 140 }, { term: "nubank", store: "both", limit: 5 }),
        mk("x1_collect", "collect", "Coletar reviews", { x: 280, y: 140 }, { reviewLimit: 600 }),
        mk("x1_analyze", "analyze", "Análise inicial", { x: 560, y: 140 }, { section: "problems" }),
        mk("x1_challenge", "challenge", "Desafiar conclusão", { x: 840, y: 60 }, {}),
        mk("x1_validator", "validator", "Validar evidências", { x: 1120, y: 140 }, {}),
        mk("x1_note", "note", "Auditor-cruzado", { x: 280, y: -60 }, { text: "O Desafio procura evidências contrárias e vieses; o Validador audita as evidências da análise. O resultado auditado é mais confiável que qualquer um deles sozinho." }),
      ],
      edges: [
        edge("x1_e1", "x1_search", "x1_collect"),
        edge("x1_e2", "x1_collect", "x1_analyze"),
        edge("x1_e3", "x1_analyze", "x1_challenge"),
        edge("x1_e4", "x1_analyze", "x1_validator"),
      ],
    }),
  },
  {
    id: "voice-of-customer",
    name: "Voz do usuário",
    description: "Coleta → tema LLM + bigramas (sem IA) → gap competitivo. Linguagem do usuário virando insight competitivo.",
    icon: Hash,
    tags: ["IA", "cluster", "competitivo"],
    build: () => ({
      nodes: [
        mk("z1_search", "search", "Buscar concorrentes", { x: 0, y: 160 }, { term: "banking", store: "both", limit: 4 }),
        mk("z1_collect", "collect", "Coletar reviews", { x: 280, y: 160 }, { reviewLimit: 700 }),
        mk("z1_themes", "themes", "Temas frequentes", { x: 560, y: 60 }, {}),
        mk("z1_bigram", "bigram-cloud", "Pares (bigramas)", { x: 560, y: 260 }, { limit: 40 }),
        mk("z1_cluster", "tag-cluster", "Cluster por tema", { x: 840, y: 60 }, { maxClusters: 8 }),
        mk("z1_gap", "competitive-gap", "Gap competitivo", { x: 1120, y: 160 }, {}),
        mk("z1_note", "note", "Voz do usuário", { x: 280, y: -60 }, { text: "Temas determinísticos + bigramas fornecem o vocabulário do usuário; o cluster da IA organiza o 'o quê'; o gap competitivo diz 'o que falta em nós'." }),
      ],
      edges: [
        edge("z1_e1", "z1_search", "z1_collect"),
        edge("z1_e2", "z1_collect", "z1_themes"),
        edge("z1_e3", "z1_collect", "z1_bigram"),
        edge("z1_e4", "z1_collect", "z1_cluster"),
        edge("z1_e5", "z1_collect", "z1_gap"),
        edge("z1_e6", "z1_themes", "z1_cluster"),
        edge("z1_e7", "z1_bigram", "z1_cluster"),
      ],
    }),
  },
];

PIPELINE_TEMPLATES.push(...V8, ...V9);

/** The original single example, kept as one of the templates. */
export const DEFAULT_TEMPLATE = PIPELINE_TEMPLATES[0];
