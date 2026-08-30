/**
 * Technical discovery — the data collection architecture.
 *
 * Real sources documented in AGENTS.md. The visitor inspects each source:
 * why it exists, what it solves, tradeoffs, limitations.
 */

export interface DataSource {
  id: string;
  store: "apple" | "google" | "local";
  name: string;
  why: string;
  solves: string;
  tradeoffs: string;
  limitations: string;
  yield?: string;
}

export const DATA_SOURCES: DataSource[] = [
  {
    id: "apple-ampapi",
    store: "apple",
    name: "amp-api (primário)",
    why: "O JSON API do web App Store, proxied via apps.apple.com — sem token bearer (o amp-api.apps.apple.com direto retorna 401).",
    solves: "Maior rendimento de reviews da Apple: ~20 por página com paginação por cursor, profundo (~500-750 por país).",
    tradeoffs: "Rate-limit agressivo (429) após volume moderado. O IP pode ser banido por minutos. Retry com backoff 1-3s, 3 tentativas.",
    limitations: "Campo de texto é 'review' (não 'body'). Pode omitir reviews que o SSR inclui (sort diferente).",
    yield: "Centenas a ~1000+ para apps globais; varia por IP limpo.",
  },
  {
    id: "apple-ssr",
    store: "apple",
    name: "SSR web page (suplemento)",
    why: "apps.apple.com/{cc}/app/id{appId} renderiza ~24-40 reviews 'most helpful' num <script id='serialized-server-data'>.",
    solves: "Nunca é rate-limited. Adiciona reviews que o amp-api omite por ordenação diferente.",
    tradeoffs: "Rendimento por país é limitado (~24-40). Sweep broad em ~50 países para o baseline.",
    limitations: "Só 'most helpful' — não é a visão mais recente. Parsing frágil se a Apple mudar o HTML.",
    yield: "Baseline de centenas (fase A: sweep broad multi-país).",
  },
  {
    id: "apple-rss",
    store: "apple",
    name: "RSS (fallback legado)",
    why: "Endpoint itunes.apple.com/{cc}/rss/customerreviews — quase morto, feed.entry null na maioria das páginas.",
    solves: "Ocasionalmente recupera reviews esparsos que as outras fontes perderam.",
    tradeoffs: "Retorna null na 1ª página para muitos apps, quebrando paginação.",
    limitations: "A Apple deprecou o RSS público. App Store Connect API (JWT) só retorna apps próprios.",
    yield: "Esparsos — ocasionalmente alguns reviews.",
  },
  {
    id: "google-play",
    store: "google",
    name: "google-play-scraper",
    why: "Pacote npm que acessa as APIs internas do Google Play. Auto-paginação até atingir num ou esgotar o token.",
    solves: "Reviews reais (texto, nota, autor, data, thumbsUp). IDs corretos via campo appId do resultado de busca.",
    tradeoffs: "IDs errados → 404 → 0 reviews. Apps salvos com IDs antigos errados continuam falhando até re-coletar.",
    limitations: "Multi-sort (NEWEST+RATING+HELPFUL) com dedupe para maximizar rendimento. Cap 5000.",
    yield: "1000 reviews (num=1000) para os 6 apps de teste; até 5000.",
  },
  {
    id: "local-dataset",
    store: "local",
    name: "Dataset local",
    why: "Fonte única de verdade. Todo app coletado fica em localStorage (aso:dataset:v1) com pub/sub.",
    solves: "Colete uma vez, reutilize em todas as superfícies. Um app coletado numa página é visto em todas instantaneamente.",
    tradeoffs: "Limite de ~5MB por origem. Apps pesados podem encher. Sem sync entre dispositivos.",
    limitations: "Teto de reviews 10000 (cliente + servidor). Dedup por reviewKey nunca perde dados, mas cresce.",
    yield: "Todo o dataset acumulado do usuário.",
  },
];

export interface EvolutionVersion {
  version: string;
  label: string;
  hypothesis: string;
  worked: string;
  didNot: string;
  changedNext: string;
  flow: string[];
}

export const PRODUCT_EVOLUTION: EvolutionVersion[] = [
  {
    version: "V0",
    label: "Buscar → Reviews",
    hypothesis: "Mostrar reviews brutos de um app pesquisado é suficiente.",
    worked: "Validou que a coleta funciona para as duas lojas.",
    didNot: "Lista de reviews sem agregação não gera inteligência. Faltava persistência e contexto.",
    changedNext: "Adicionar coleta → persistência → detalhe estruturado.",
    flow: ["Buscar", "Reviews"],
  },
  {
    version: "V1",
    label: "Buscar → Coletar → Detalhe",
    hypothesis: "Persistir apps coletados e mostrar um detalhe rico resolve.",
    worked: "AppDetail com metadados + reviews. Histórico de navegação.",
    didNot: "Cada página ainda buscava independente. Dados divergiam. Sem visão agregada.",
    changedNext: "Unificar num dataset compartilhado + dashboard.",
    flow: ["Buscar", "Coletar", "Detalhe"],
  },
  {
    version: "V2",
    label: "Dataset → Dashboard → Análise",
    hypothesis: "Um dataset único alimenta agregações e análises de IA.",
    worked: "Dashboard com KPIs e charts. Experimentos com 13 seções de IA. Reuso sem rede.",
    didNot: "Análise automática gastava recursos sem consentimento. Resumos sem evidência não eram auditáveis.",
    changedNext: "Geração manual + regra de evidência + múltiplos modos de IA.",
    flow: ["Dataset", "Dashboard", "Análise"],
  },
  {
    version: "V3",
    label: "Chat → Canvas → Workflows de IA",
    hypothesis: "IA como componente de workflow, não só conversação.",
    worked: "Canvas node-based com execução topológica. Chat com seleção de apps. Multi-provider.",
    didNot: "Avaliação de IA ainda é manual. Sem infraestrutura de medição automatizada.",
    changedNext: "Framework de avaliação + Decision Center por persona.",
    flow: ["Chat", "Canvas", "Workflows"],
  },
];

export interface ArchitectureNode {
  id: string;
  label: string;
  type: "source" | "core" | "surface";
  desc: string;
  to?: string;
}

/** One dataset → many product surfaces. */
export const ARCHITECTURE: ArchitectureNode[] = [
  { id: "dataset", label: "Dataset", type: "core", desc: "Fonte única de verdade. Colete uma vez, reutilize em todas as superfícies." },
  { id: "search", label: "Busca", type: "surface", desc: "Busca + coleta de apps Apple e Google Play.", to: "/" },
  { id: "detail", label: "App Detail", type: "surface", desc: "Metadados + reviews + análise de IA por app.", to: "/app/apple/324684580" },
  { id: "compare", label: "Compare", type: "surface", desc: "Comparação entre apps com análise comparativa.", to: "/compare" },
  { id: "dashboard", label: "Dashboard", type: "surface", desc: "KPIs, charts e métricas agregadas.", to: "/dashboard" },
  { id: "experiments", label: "Experimentos", type: "surface", desc: "13 seções de análise de IA.", to: "/experiments" },
  { id: "chat", label: "Chat", type: "surface", desc: "Conversa com IA sobre os apps selecionados.", to: "/chat" },
  { id: "canvas", label: "Canvas", type: "surface", desc: "Workflow node-based com IA como componente.", to: "/canvas" },
];

export interface FailureItem {
  id: string;
  assumption: string;
  observation: string;
  change: string;
  current: string;
}

export const FAILURES: FailureItem[] = [
  {
    id: "generic-summaries",
    assumption: "Resumos genéricos de IA dariam valor suficiente.",
    observation: "Sem citação, não dá para verificar. Soa bem mas pode estar inventado.",
    change: "Regra de Evidência obrigatória: blockquote + cálculo + 'não há evidência'.",
    current: "Toda afirmação de IA traz evidência ou admite a falta dela.",
  },
  {
    id: "auto-run",
    assumption: "IA deveria rodar automaticamente após a coleta.",
    observation: "Inferência local consome VRAM/GPU e pode levar minutos. Auto-run tirava controle.",
    change: "Geração manual (auto=false). Empty state explica o que falta.",
    current: "Botão explícito em toda superfície de IA. Nenhum auto-run.",
  },
  {
    id: "chat-alone",
    assumption: "Chat seria a interface suficiente para IA.",
    observation: "Conversa é linear. Encadear operações (buscar → coletar → filtrar → analisar) é difícil.",
    change: "Canvas node-based com execução topológica.",
    current: "IA como componente de workflow, não só endpoint conversacional.",
  },
  {
    id: "collection-limits",
    assumption: "Reusar cache sempre que existisse era eficiente.",
    observation: "Config 5000 mostrava só 100 / config 100 coletava 0. Reuso cego perdia dados.",
    change: "Dedup limit-aware: só reusa se atende ao limite pedido; senão refetch + merge.",
    current: "Nunca perde dados; cresce em merge. Teto 10000.",
  },
  {
    id: "page-datasets",
    assumption: "Cada página podia manter seu próprio conjunto de dados.",
    observation: "Apps coletados numa página não apareciam em outra. Duplicação e divergência.",
    change: "Dataset único + SelectionContext. collectApp como único entry point.",
    current: "Um app coletado na Home é visto em todas as páginas instantaneamente.",
  },
];
