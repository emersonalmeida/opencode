import {
  Search, Download, Database, Sparkles, BarChart3, Table2, Eye, StickyNote, Filter, Code2, FileText, Wand2,
  PieChart as PieIcon, LineChart as LineIcon, AreaChart as AreaIcon, TrendingUp, Users, Bug, Megaphone,
  LayoutDashboard, Activity, Hash, GitCompare, Gauge, Globe, ListChecks, ShieldAlert, Reply,
  ClipboardList, ShieldCheck, ArrowUpDown, Sword, Target, Tags, WholeWord, Calculator, CalendarClock,
  type LucideIcon,
} from "lucide-react";
import { searchApps } from "@/lib/appStoreApi";
import { searchGooglePlayApps } from "@/lib/googlePlayApi";
import { collectApp } from "@/lib/collect";
import { streamExperiment } from "@/lib/experimentApi";
import { streamExperimentChat, type ChatMessage } from "@/lib/experimentChatApi";
import { EXPERIMENT_SECTIONS } from "@/lib/experimentSections";
import { listDataset, type DatasetEntry } from "@/lib/datasetStore";
import { getUserRegion } from "@/lib/region";
import {
  computeRatingDistribution, computeSentiment, computeTimeline,
  computeStoreComparison, computeWordCloud, computePerAppStats, computeVersionBreakdown,
  computeKPIs,
} from "@/lib/dashboardAnalytics";
import { computeFacts } from "@/lib/pipeline/facts";
import { detectAnomalies, ANOMALY_TYPE_LABEL } from "@/lib/pipeline/anomalies";

/** All node kinds available in the canvas. */
export type NodeKind =
  // Sources / data
  | "search" | "collect" | "dataset"
  // IA (encadeável)
  | "analyze" | "prompt" | "report" | "action-plan" | "validator" | "challenge" | "competitive-gap" | "tag-cluster"
  // Análises sem IA (determinísticas)
  | "statistics" | "sentiment" | "themes" | "version-analysis" | "reviews-analysis" | "country-analysis"
  | "rating-trend" | "version-compare" | "review-sampler" | "anomaly-detector" | "reply-rate"
  | "bigram-cloud" | "aggregate" | "review-age"
  // Visualizações
  | "chart" | "dashboard" | "table" | "display" | "output"
  // Utilitários
  | "note" | "filter" | "code" | "sort";

export interface NodeMeta {
  kind: NodeKind;
  label: string;
  icon: LucideIcon;
  description: string;
  color: string; // tailwind text color class for accent
  async: boolean;
  /** Group in the palette (sources / ai / analysis / viz / util). */
  group: "sources" | "ai" | "analysis" | "viz" | "util";
}

export const NODE_REGISTRY: Record<NodeKind, NodeMeta> = {
  search:           { kind: "search",           label: "Buscar apps",        icon: Search,        description: "Pesquisa apps na Apple App Store e Google Play.", color: "text-sky-500", async: true, group: "sources" },
  collect:          { kind: "collect",          label: "Coletar reviews",    icon: Download,      description: "Coleta reviews do app selecionado (reusa dataset).", color: "text-emerald-500", async: true, group: "sources" },
  dataset:          { kind: "dataset",          label: "Dataset",            icon: Database,      description: "Carrega apps já coletados do dataset local (todas as lojas).", color: "text-violet-500", async: false, group: "sources" },

  analyze:          { kind: "analyze",          label: "Análise IA",        icon: Sparkles,      description: "Analisa apps/reviews OU a saída de outro nó IA (encadeável).", color: "text-fuchsia-500", async: true, group: "ai" },
  prompt:           { kind: "prompt",           label: "Prompt IA",         icon: Wand2,         description: "Prompt customizado → markdown renderizado como apresentação. Lê nós anteriores.", color: "text-pink-500", async: true, group: "ai" },
  report:           { kind: "report",           label: "Relatório IA",       icon: FileText,      description: "Relatório completo em markdown a partir de um prompt + dados recebidos.", color: "text-orange-500", async: true, group: "ai" },
  "action-plan":    { kind: "action-plan",      label: "Plano de ação IA", icon: ClipboardList, description: "Plano P0/P1/P2 com impacto, esforço e evidência. Lê dados OU saídas anteriores.", color: "text-violet-500", async: true, group: "ai" },
  validator:        { kind: "validator",        label: "Validador IA",     icon: ShieldCheck,   description: "Audita a análise anterior: afirmação por afirmação, marca evidência suportada/fraca.", color: "text-emerald-500", async: true, group: "ai" },
  challenge:        { kind: "challenge",        label: "Desafiar conclusão", icon: Sword,        description: "Desafia a análise anterior: evidências contrárias, vieses, incertezas e confiança.", color: "text-red-500", async: true, group: "ai" },
  "competitive-gap":{ kind: "competitive-gap",  label: "Gap competitivo",  icon: Target,         description: "Compara múltiplos apps: o que os concorrentes têm que o alvo não tem (IA).", color: "text-orange-500", async: true, group: "ai" },
  "tag-cluster":    { kind: "tag-cluster",      label: "Cluster por tema", icon: Tags,           description: "Clusteriza reviews em temas recorrentes com IA e uma citação de cada.", color: "text-pink-500", async: true, group: "ai" },

  statistics:       { kind: "statistics",        label: "Estatísticas",      icon: Gauge,         description: "Métricas agregadas (KPIs: apps, reviews, nota média, sentimento). Sem IA.", color: "text-teal-500", async: false, group: "analysis" },
  sentiment:        { kind: "sentiment",        label: "Análise de sentimento", icon: Activity,   description: "Distribuição positivo/neutro/negativo + % por app. Sem IA.", color: "text-rose-500", async: false, group: "analysis" },
  themes:           { kind: "themes",           label: "Temas & keywords",   icon: Hash,         description: "Termos mais frequentes + keywords de ASO. Sem IA.", color: "text-amber-500", async: false, group: "analysis" },
  "version-analysis": { kind: "version-analysis", label: "Análise por versão", icon: GitCompare, description: "Distribuição de reviews e nota média por versão do app. Sem IA.", color: "text-indigo-500", async: false, group: "analysis" },
  "reviews-analysis": { kind: "reviews-analysis", label: "Análise de reviews", icon: Users,      description: "Extrai reviews recentes + resumo quantitativo (top apps, com/sem resposta). Sem IA.", color: "text-cyan-500", async: false, group: "analysis" },
  "country-analysis": { kind: "country-analysis", label: "Análise por país", icon: Globe,        description: "Distribuição de reviews e sentimento por país/storefront. Sem IA.", color: "text-lime-500", async: false, group: "analysis" },
  "rating-trend":     { kind: "rating-trend",     label: "Tendência de nota", icon: LineIcon,     description: "Evolução da nota média ao longo do tempo (linha/área). Sem IA.", color: "text-sky-500", async: false, group: "analysis" },
  "version-compare":  { kind: "version-compare",  label: "Comparar versões",  icon: GitCompare,   description: "Tabela comparativa por versão: reviews, nota média, % pos/neg. Sem IA.", color: "text-indigo-500", async: false, group: "analysis" },
  "review-sampler":   { kind: "review-sampler",   label: "Amostra de reviews", icon: ListChecks,  description: "Amostra N reviews por critério: recentes, antigos, úteis, melhores, piores. Sem IA.", color: "text-rose-500", async: false, group: "analysis" },
  "anomaly-detector": { kind: "anomaly-detector", label: "Detector de anomalias", icon: ShieldAlert, description: "Regressão de versão, pico de negatividade/volume e app outlier. Sem IA.", color: "text-red-500", async: false, group: "analysis" },
  "reply-rate":       { kind: "reply-rate",       label: "Taxa de resposta",   icon: Reply,        description: "% de reviews respondidos pelo dev por app. Sem IA.", color: "text-cyan-500", async: false, group: "analysis" },
  "bigram-cloud":     { kind: "bigram-cloud",     label: "Bigramas",           icon: WholeWord,    description: "Pares de palavras mais frequentes (frases) — nuvem de bigramas. Sem IA.", color: "text-amber-500", async: false, group: "analysis" },
  aggregate:          { kind: "aggregate",        label: "Agregar métricas",   icon: Calculator,   description: "Agrega (count/sum/média) por campo dos reviews: rating, 👍, tamanho do texto. Sem IA.", color: "text-teal-500", async: false, group: "analysis" },
  "review-age":       { kind: "review-age",       label: "Idade dos reviews",  icon: CalendarClock, description: "Distribuição por faixa de idade (≤30d, 31-90d, 91-180d, >180d) e idade média. Sem IA.", color: "text-sky-500", async: false, group: "analysis" },

  chart:            { kind: "chart",            label: "Gráfico",            icon: BarChart3,     description: "Gráfico de vários tipos a partir dos dados (ou saída de outro nó).", color: "text-amber-500", async: false, group: "viz" },
  dashboard:        { kind: "dashboard",        label: "Dashboard",         icon: LayoutDashboard, description: "Painel com KPIs + múltiplos gráficos sobre os dados conectados.", color: "text-blue-500", async: false, group: "viz" },
  table:            { kind: "table",            label: "Tabela",            icon: Table2,        description: "Renderiza dados recebidos em uma tabela.", color: "text-cyan-500", async: false, group: "viz" },
  display:          { kind: "display",          label: "Exibição",          icon: Eye,          description: "Exibe texto/markdown ou resultado bruto.", color: "text-blue-500", async: false, group: "viz" },
  output:           { kind: "output",           label: "Saída renderizada",  icon: Eye,          description: "Renderiza a SAÍDA do nó conectado (markdown, gráficos, tabela, dashboard).", color: "text-emerald-500", async: false, group: "viz" },

  note:             { kind: "note",             label: "Nota",              icon: StickyNote,   description: "Anotação livre no canvas (não executa).", color: "text-yellow-500", async: false, group: "util" },
  filter:           { kind: "filter",           label: "Filtro",            icon: Filter,       description: "Filtra/passa dados recebidos (por nota, loja...).", color: "text-indigo-500", async: false, group: "util" },
  code:             { kind: "code",             label: "Código",            icon: Code2,         description: "Trecho JS que transforma os dados recebidos.", color: "text-rose-500", async: false, group: "util" },
  sort:             { kind: "sort",             label: "Ordenar reviews",   icon: ArrowUpDown,  description: "Reordena os reviews da entrada por recente/antigo/útil/nota.", color: "text-sky-500", async: false, group: "util" },
};

export const NODE_PALETTE: NodeMeta[] = Object.values(NODE_REGISTRY);

export interface NodeRunContext {
  config: Record<string, unknown>;
  inputs: unknown[];
  log: (level: "info" | "success" | "error" | "warn", message: string) => void;
  setStatus: (status: "running" | "done" | "error") => void;
  setOutput: (value: unknown) => void;
  signal: AbortSignal;
}

export interface NodeRunResult {
  output: unknown;
  summary?: string;
}

type Executor = (ctx: NodeRunContext) => Promise<NodeRunResult> | NodeRunResult;

const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);

function asEntries(input: unknown): DatasetEntry[] {
  if (Array.isArray(input)) {
    const first = input[0];
    if (first && typeof first === "object" && "app" in (first as object)) return input as DatasetEntry[];
  }
  if (input && typeof input === "object" && "app" in (input as object)) return [input as DatasetEntry];
  return [];
}

/**
 * Extract upstream textual context — the markdown produced by prior AI nodes
 * (analyze/prompt/report) OR plain strings. This is the "nodes talk to each
 * other" core: a downstream AI node can analyze the *output* of an upstream
 * AI node instead of (or alongside) raw dataset entries.
 */
function asUpstreamText(inputs: unknown[]): string[] {
  const texts: string[] = [];
  for (const inp of inputs) {
    if (inp == null) continue;
    if (typeof inp === "string") { if (inp.trim()) texts.push(inp.trim()); continue; }
    if (typeof inp === "object") {
      const obj = inp as Record<string, unknown>;
      if (typeof obj.markdown === "string" && obj.markdown.trim()) {
        texts.push(obj.markdown.trim());
        continue;
      }
      if (typeof obj.text === "string" && obj.text.trim()) {
        texts.push(obj.text.trim());
        continue;
      }
    }
  }
  return texts;
}

/**
 * Leitor seguro da seleção global ("aso:selected-apps:v1") — nada acopla ao
 * React (executores rodam fora de componentes). Duplica o formato de
 * SelectionContext.read() sem depender do contexto.
 */
function readSelectedKeysSafe(): string[] | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem("aso:selected-apps:v1");
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as string[]) : [];
  } catch {
    return [];
  }
}

/** All reviews flattened from a list of inputs (entries) or a single entry. */
function collectReviews(inputs: unknown[]) {
  return inputs.flatMap(asEntries).flatMap((e) => e.reviews ?? []);
}

const executors: Record<NodeKind, Executor> = {
  search: async (ctx) => {
    const term = str(ctx.config.term, "").trim();
    const store = str(ctx.config.store, "both");
    const limit = num(ctx.config.limit, 10);
    const region = getUserRegion();
    if (!term) throw new Error("Termo de busca vazio");
    ctx.log("info", `Buscando "${term}" em ${store}…`);
    const [apple, google] = await Promise.allSettled([
      store === "google" ? Promise.resolve([]) : searchApps(term, region, limit),
      store === "apple" ? Promise.resolve([]) : searchGooglePlayApps(term, region, limit),
    ]);
    const results = [
      ...(apple.status === "fulfilled" ? apple.value : []),
      ...(google.status === "fulfilled" ? google.value : []),
    ];
    ctx.log("success", `${results.length} app(s) encontrado(s).`);
    return { output: results, summary: `${results.length} apps` };
  },

  collect: async (ctx) => {
    const limit = num(ctx.config.reviewLimit, 500);
    const region = getUserRegion();
    // Resolve which app(s) to collect: explicit `config.app` (manual pick) first,
    // then the connected upstream output — a search node yields AppInfo[]; a
    // dataset node yields DatasetEntry[]. We collect every app found so the
    // example pipeline (search → collect) works for any result count.
    const explicit = ctx.config.app as { id?: string; store?: string; name?: string } | undefined;
    const fromInputs = ctx.inputs.flatMap((inp) => {
      if (Array.isArray(inp)) return inp.filter((x) => x && typeof x === "object" && "id" in (x as object)) as DatasetEntry["app"][];
      if (inp && typeof inp === "object" && "id" in (inp as object)) return [inp as DatasetEntry["app"]];
      return [];
    });
    const apps = explicit?.id ? [explicit as DatasetEntry["app"]] : fromInputs;
    if (apps.length === 0) throw new Error("Conecte um nó Buscar apps/Dataset, ou escolha um app manualmente.");
    ctx.log("info", `Coletando reviews de ${apps.length} app(s) (até ${limit} cada)…`);
    let total = 0;
    let lastEntry: DatasetEntry | null = null;
    for (const app of apps) {
      const result = await collectApp(app, region, limit, "mixed");
      total += result.entry.reviews.length;
      lastEntry = result.entry;
      ctx.log("info", `${app.name ?? app.id}: ${result.entry.reviews.length} reviews${result.reused ? " (cache)" : ""}.`);
    }
    // Com múltiplos apps coletados, emite o slice completo do dataset para os
    // nós downstream (analyze/chart/table) receberem todos os apps. App único
    // mantém a entry.
    const all = listDataset();
    const collectedKeys = new Set(apps.map((a) => `${a.store}:${a.id}`));
    const output = apps.length === 1 && lastEntry ? lastEntry : all.filter((e) => collectedKeys.has(`${e.app.store}:${e.app.id}`));
    ctx.log("success", `${total} reviews coletados em ${apps.length} app(s).`);
    return { output, summary: `${total} reviews` };
  },

  dataset: (ctx) => {
    const all = listDataset();
    const explicitKeys = Array.isArray(ctx.config.keys) ? (ctx.config.keys as string[]) : null;
    // Sem chaves explícitas: honra a seleção global (como as outras páginas);
    // seleção vazia = dataset inteiro.
    const selectedKeys = explicitKeys ?? readSelectedKeysSafe();
    const entries = selectedKeys && selectedKeys.length > 0
      ? all.filter((e) => selectedKeys.includes(`${e.app.store}:${e.app.id}`))
      : all;
    const scope = explicitKeys ? "chaves explícitas" : selectedKeys && selectedKeys.length > 0 ? "seleção global" : "dataset inteiro";
    ctx.log("info", `${entries.length} app(s) (${scope}).`);
    return { output: entries, summary: `${entries.length} apps (${scope})` };
  },

  analyze: async (ctx) => {
    const section = str(ctx.config.section, "summary");
    const entries = ctx.inputs.flatMap(asEntries);
    const upstreamTexts = asUpstreamText(ctx.inputs);

    // Chained-AI mode: when an upstream node produced markdown/text (another
    // analyze/prompt/report), ask the IA to refine/analyze THAT instead of the
    // raw reviews. The user explicitly wants "IA analyzes what IA generated".
    if (upstreamTexts.length > 0) {
      ctx.log("info", `Modo encadeado: analisando a saída de ${upstreamTexts.length} nó(s) anterior(es)…`);
      const context = upstreamTexts.map((t, i) => `### Saída do nó #${i + 1}\n\n${t}`).join("\n\n");
      const messages: ChatMessage[] = [
        { role: "user", content:
          `Você é um analista sênior de produto. Abaixo está a análise gerada por um nó anterior do pipeline de reviews de apps.\n` +
          `Refine, aprofunde e complemente essa análise com base apenas no conteúdo abaixo. Identifique pontos cegos, contradições, \n` +
          `insights não explorados e recomendações acionáveis. Estruture em markdown profissional.\n\n${context}` },
      ];
      let result = "";
      await streamExperimentChat(entries, messages, {
        onToken: (full) => { result = full; ctx.setOutput({ markdown: result, entries, derivedFrom: "upstream" }); },
        onDone: (full) => { result = full; },
        onError: (err) => { throw new Error(err); },
      }, ctx.signal);
      if (ctx.signal.aborted) return { output: { markdown: result, entries, derivedFrom: "upstream" }, summary: "interrompido" };
      ctx.log("success", `Análise refinada (${result.length} chars).`);
      return { output: { markdown: result, entries, derivedFrom: "upstream" }, summary: `${result.length} chars` };
    }

    // Raw-data mode: analyze the dataset directly.
    if (entries.length === 0) throw new Error("Conecte um nó de dataset/coleta ou a saída de outro nó IA.");
    ctx.log("info", `Análise IA: ${section} sobre ${entries.length} app(s)…`);
    let result = "";
    await streamExperiment(section, entries, {
      onToken: (full) => { result = full; ctx.setOutput({ markdown: result, entries, derivedFrom: "data" }); },
      onDone: (full) => { result = full; },
      onError: (err) => { throw new Error(err); },
    }, ctx.signal);
    if (ctx.signal.aborted) return { output: { markdown: result, entries, derivedFrom: "data" }, summary: "interrompido" };
    ctx.log("success", `Análise gerada (${result.length} chars).`);
    return { output: { markdown: result, entries, derivedFrom: "data" }, summary: `${result.length} chars` };
  },

  prompt: async (ctx) => {
    const prompt = str(ctx.config.prompt, "").trim();
    const entries = ctx.inputs.flatMap(asEntries);
    const upstreamTexts = asUpstreamText(ctx.inputs);
    if (!prompt) throw new Error("Escreva um prompt no nó de Prompt IA.");
    if (entries.length === 0 && upstreamTexts.length === 0)
      throw new Error("Conecte um nó de coleta/dataset ou a saída de outro nó IA.");
    const hasUpstream = upstreamTexts.length > 0;
    ctx.log("info", hasUpstream
      ? `Gerando a partir do prompt + saída de ${upstreamTexts.length} nó(s)…`
      : `Gerando a partir do prompt + ${entries.length} app(s)…`);
    const context = upstreamTexts.map((t, i) => `### Saída do nó #${i + 1}\n\n${t}`).join("\n\n");
    const messages: ChatMessage[] = [
      { role: "user", content:
        `${prompt}\n\n` +
        (hasUpstream
          ? `Use o contexto abaixo (saídas de nós anteriores) como base primária:\n\n${context}`
          : `Os dados completos dos apps/reviews coletados estão anexados. Use-os como evidência.`) },
    ];
    let result = "";
    await streamExperimentChat(entries, messages, {
      onToken: (full) => { result = full; ctx.setOutput({ markdown: result, entries, presentation: true, derivedFrom: hasUpstream ? "upstream" : "data" }); },
      onDone: (full) => { result = full; },
      onError: (err) => { throw new Error(err); },
    }, ctx.signal);
    if (ctx.signal.aborted) return { output: { markdown: result, entries, presentation: true, derivedFrom: hasUpstream ? "upstream" : "data" }, summary: "interrompido" };
    ctx.log("success", `Markdown gerado (${result.length} chars).`);
    return { output: { markdown: result, entries, presentation: true, derivedFrom: hasUpstream ? "upstream" : "data" }, summary: `${result.length} chars` };
  },

  "action-plan": async (ctx) => {
    const focus = str(ctx.config.focus, "").trim();
    const entries = ctx.inputs.flatMap(asEntries);
    const upstreamTexts = asUpstreamText(ctx.inputs);
    if (entries.length === 0 && upstreamTexts.length === 0)
      throw new Error("Conecte um nó de coleta/dataset OU a saída de outro nó IA.");
    const hasUpstream = upstreamTexts.length > 0;
    ctx.log("info", hasUpstream
      ? `Plano de ação a partir de ${upstreamTexts.length} saída(s) anterior(es)…`
      : `Plano de ação sobre ${entries.length} app(s)…`);
    const context = upstreamTexts.map((t, i) => `### Saída do nó #${i + 1}\n\n${t}`).join("\n\n");
    const messages: ChatMessage[] = [
      { role: "user", content:
        `Você é um product strategist. Desenvolva um plano de ação priorizado com base ${hasUpstream ? "na análise anterior" : "nos dados anexados"}.\n` +
        `Estruture em markdown com cabeçalhos ## P0 (agora), ## P1 (curto prazo) e ## P2 (médio prazo).\n` +
        `Para cada ação: (1) o problema em uma linha, (2) evidência do dataset (citação real de review quando houver ou "Não há evidência"), (3) impacto esperado, (4) esforço estimado, (5) KPI para medir o sucesso.\n` +
        `Termine com uma seção ## Resumo listando a ação top-1 de cada prioridade.\n` +
        (focus ? `FOCO ESPECIAL (contexto extra do usuário):\n${focus}\n\n` : "") +
        (hasUpstream ? `\nBaseie-se nas saídas anteriores:\n\n${context}` : `\nOs dados completos dos apps estão anexados.`),
      },
    ];
    let result = "";
    await streamExperimentChat(entries, messages, {
      onToken: (full) => { result = full; ctx.setOutput({ markdown: result, entries, presentation: true, derivedFrom: hasUpstream ? "upstream" : "data" }); },
      onDone: (full) => { result = full; },
      onError: (err) => { throw new Error(err); },
    }, ctx.signal);
    if (ctx.signal.aborted) return { output: { markdown: result, entries, presentation: true, derivedFrom: hasUpstream ? "upstream" : "data" }, summary: "interrompido" };
    ctx.log("success", `Plano gerado (${result.length} chars).`);
    return { output: { markdown: result, entries, presentation: true, derivedFrom: hasUpstream ? "upstream" : "data" }, summary: `${result.length} chars` };
  },

  validator: async (ctx) => {
    const entries = ctx.inputs.flatMap(asEntries);
    const upstreamTexts = asUpstreamText(ctx.inputs);
    if (upstreamTexts.length === 0)
      throw new Error("Conecte a saída de um nó IA (análise/relatório/prompt) para auditar.");
    const extra = str(ctx.config.extra, "").trim();
    ctx.log("info", `Auditando evidência de ${upstreamTexts.length} saída(s) anterior(es)…`);
    const context = upstreamTexts.map((t, i) => `### Saída do nó #${i + 1}\n\n${t}`).join("\n\n");
    const messages: ChatMessage[] = [
      { role: "user", content:
        `Você é um auditor de evidências. Cada afirmação de IA deve ter suporte em pelo menos uma citação real de review. Audite o conteúdo abaixo com rigor:\n\n` +
        context + "\n\n" +
        `Siga EXATAMENTE esta estrutura:\n` +
        `1. ## Veredicto — 1 linha sobre a qualidade da evidência geral.\n` +
        `2. ## Auditoria por afirmação — para cada afirmação principal: marque ✓ (suportada com citação) ou ✗ (sem citação / não verificável), com a evidência citada ou a falta dela.\n` +
        `3. ## Ajustes — recomendações para deixar a análise mais verificável.\n` +
        (extra ? `\nÂNGULO ADICIONAL DO USUÁRIO: ${extra}\n` : ""),
      },
    ];
    let result = "";
    await streamExperimentChat(entries, messages, {
      onToken: (full) => { result = full; ctx.setOutput({ markdown: result, entries, presentation: true, derivedFrom: "upstream" }); },
      onDone: (full) => { result = full; },
      onError: (err) => { throw new Error(err); },
    }, ctx.signal);
    if (ctx.signal.aborted) return { output: { markdown: result, entries, presentation: true, derivedFrom: "upstream" }, summary: "interrompido" };
    ctx.log("success", `Auditoria de evidência (${result.length} chars).`);
    return { output: { markdown: result, entries, presentation: true, derivedFrom: "upstream" }, summary: `${result.length} chars` };
  },

  challenge: async (ctx) => {
    const entries = ctx.inputs.flatMap(asEntries);
    const upstreamTexts = asUpstreamText(ctx.inputs);
    if (upstreamTexts.length === 0) throw new Error("Conecte a saída de um nó IA para desafiar.");
    ctx.log("info", `Desafiando a conclusão de ${upstreamTexts.length} saída(s)…`);
    const context = upstreamTexts.map((t, i) => `### Saída do nó #${i + 1}\n\n${t}`).join("\n\n");
    const messages: ChatMessage[] = [
      { role: "user", content:
        `Você é um revisor crítico cético. Desafie a conclusão abaixo — não com elogios, apenas críticas técnicas.\n\n` + context +
        `\n\nEstruture EXATAMENTE os cabeçalhos:\n` +
        `## Evidências contrárias — apontadas no próprio conteúdo/dataset (ou "nenhuma encontrada").\n` +
        `## Vieses presumidos — amostra, recência, país, loja, ou viés do próprio modelo.\n` +
        `## Incertezas remanescentes — o que continua não respondido.\n` +
        `## Confiança final (0–100%) — um número com 1 linha de justificativa.`,
      },
    ];
    let result = "";
    await streamExperimentChat(entries, messages, {
      onToken: (full) => { result = full; ctx.setOutput({ markdown: result, entries, presentation: true, derivedFrom: "upstream" }); },
      onDone: (full) => { result = full; },
      onError: (err) => { throw new Error(err); },
    }, ctx.signal);
    if (ctx.signal.aborted) return { output: { markdown: result, entries, presentation: true, derivedFrom: "upstream" }, summary: "interrompido" };
    ctx.log("success", `Conclusão contestada (${result.length} chars).`);
    return { output: { markdown: result, entries, presentation: true, derivedFrom: "upstream" }, summary: `${result.length} chars` };
  },

  "competitive-gap": async (ctx) => {
    const entries = ctx.inputs.flatMap(asEntries);
    if (entries.length < 2) throw new Error("Conecte um dataset/busca com pelo menos 2 apps comparáveis.");
    const target = str(ctx.config.target, "").trim() || entries[0].app.name;
    const others = entries.slice(1).map((e) => e.app.name);
    ctx.log("info", `Gap competitivo: "${target}" vs ${others.length} concorrente(s)…`);
    const messages: ChatMessage[] = [
      { role: "user", content:
        `Você é um analista competitivo. Compare o app "${target}" contra os concorrentes ${others.slice(0, 8).map((n) => `"${n}"`).join(", ")} (dados reais anexados).\n` +
        `Estruture EXATAMENTE:\n` +
        `## O que os concorrentes têm que "${target}" não tem — feature por feature, com evidência de review (citação real).\n` +
        `## Onde "${target}" lidera — pontos de vantagem com evidência.\n` +
        `## 3 gaps mais acionáveis — ordenados por impacto, cada um com hipótese de feature e esforço.\n` +
        `Se faltar evidência, diga "Não há evidência suficiente".`,
      },
    ];
    let result = "";
    await streamExperimentChat(entries, messages, {
      onToken: (full) => { result = full; ctx.setOutput({ markdown: result, entries, presentation: true, derivedFrom: "data" }); },
      onDone: (full) => { result = full; },
      onError: (err) => { throw new Error(err); },
    }, ctx.signal);
    if (ctx.signal.aborted) return { output: { markdown: result, entries, presentation: true, derivedFrom: "data" }, summary: "interrompido" };
    ctx.log("success", `Gap competitivo gerado (${result.length} chars).`);
    return { output: { markdown: result, entries, presentation: true, derivedFrom: "data" }, summary: `${result.length} chars` };
  },

  "tag-cluster": async (ctx) => {
    const entries = ctx.inputs.flatMap(asEntries);
    const reviews = collectReviews(ctx.inputs);
    if (entries.length === 0 || reviews.length === 0) throw new Error("Conecte coleta/dataset com reviews para clusterizar.");
    const maxClusters = Math.max(3, Math.min(15, num(ctx.config.maxClusters, 8)));
    ctx.log("info", `Clusterizando ${reviews.length} reviews em até ${maxClusters} temas…`);
    const messages: ChatMessage[] = [
      { role: "user", content:
        `Você é um analista de voz do cliente. Clusterize os reviews anexados em até ${maxClusters} temas recorrentes.\n` +
        `Para CADA tema, use cabeçalho "## [nome do tema] — N reviews" e dentro: sentimento dominante, 1 citação real de review com (★, país) e 1 nota curta de insight.\n` +
        `Ordene os temas por frequência desc (mais recorrentes primeiro). Termine com "## Resumo" listando temas numerados.\n` +
        `Apenas clusterize — não invente métricas. Se houver menos de ${maxClusters} temas, apresente os que existem.`,
      },
    ];
    let result = "";
    await streamExperimentChat(entries, messages, {
      onToken: (full) => { result = full; ctx.setOutput({ markdown: result, entries, presentation: true, derivedFrom: "data" }); },
      onDone: (full) => { result = full; },
      onError: (err) => { throw new Error(err); },
    }, ctx.signal);
    if (ctx.signal.aborted) return { output: { markdown: result, entries, presentation: true, derivedFrom: "data" }, summary: "interrompido" };
    ctx.log("success", `Clusterização gerada (${result.length} chars).`);
    return { output: { markdown: result, entries, presentation: true, derivedFrom: "data" }, summary: `${result.length} chars` };
  },

  statistics: (ctx) => {
    const entries = ctx.inputs.flatMap(asEntries);
    if (entries.length === 0) throw new Error("Sem dados. Conecte coleta/dataset.");
    const reviews = collectReviews(ctx.inputs);
    const kpis = computeKPIs(reviews, entries);
    ctx.log("info", `KPIs: ${kpis.totalReviews} reviews, nota ${kpis.avgRating}.`);
    return {
      output: {
        kpis,
        markdown:
          `## Estatísticas agregadas\n\n` +
          `- **Apps:** ${kpis.totalApps}\n- **Reviews:** ${kpis.totalReviews}\n- **Nota média coletada:** ${kpis.avgRating}\n` +
          `- **Positivo:** ${kpis.positiveCount} (${kpis.positivePct}%)\n- **Neutro:** ${kpis.neutralCount} (${kpis.neutralPct}%)\n- **Negativo:** ${kpis.negativeCount} (${kpis.negativePct}%)\n` +
          `- **Com resposta do dev:** ${kpis.withDeveloperReply}\n- **Período:** ${kpis.oldestDate ? kpis.oldestDate.slice(0, 10) : "—"} a ${kpis.newestDate ? kpis.newestDate.slice(0, 10) : "—"}`,
      },
      summary: `${kpis.totalReviews} reviews`,
    };
  },

  sentiment: (ctx) => {
    const entries = ctx.inputs.flatMap(asEntries);
    if (entries.length === 0) throw new Error("Sem dados. Conecte coleta/dataset.");
    const reviews = collectReviews(ctx.inputs);
    if (reviews.length === 0) throw new Error("Sem reviews nos dados conectados.");
    const overall = computeSentiment(reviews);
    const perApp = entries.map((e) => ({
      app: e.app.name,
      store: e.app.store,
      ...computeSentiment(e.reviews).reduce((acc, s) => { acc[s.name.includes("Positivo") ? "positive" : s.name.includes("Neutro") ? "neutral" : "negative"] = s.value; return acc; }, {} as Record<string, number>),
    }));
    ctx.log("info", `Sentimento sobre ${reviews.length} reviews.`);
    return {
      output: {
        chart: "pie",
        data: overall,
        title: "Sentimento agregado",
        perApp,
        markdown: `## Análise de sentimento\n\n${overall.map((s) => `- **${s.name}:** ${s.value}`).join("\n")}`,
      },
      summary: `${reviews.length} reviews`,
    };
  },

  themes: (ctx) => {
    const reviews = collectReviews(ctx.inputs);
    if (reviews.length === 0) throw new Error("Sem reviews. Conecte coleta/dataset.");
    const words = computeWordCloud(reviews, 40).map(([text, value]) => ({ text, value }));
    if (words.length === 0) throw new Error("Sem termos frequentes.");
    ctx.log("info", `${words.length} termos extraídos.`);
    return {
      output: { chart: "wordcloud", data: words, title: "Termos frequentes" },
      summary: `${words.length} termos`,
    };
  },

  "version-analysis": (ctx) => {
    const reviews = collectReviews(ctx.inputs);
    if (reviews.length === 0) throw new Error("Sem reviews. Conecte coleta/dataset.");
    const data = computeVersionBreakdown(reviews);
    if (data.length === 0) throw new Error("Sem versões nos reviews.");
    ctx.log("info", `${data.length} versões encontradas.`);
    return {
      output: { chart: "bar", data, title: "Reviews por versão", xKey: "version", yKey: "count" },
      summary: `${data.length} versões`,
    };
  },

  "reviews-analysis": (ctx) => {
    const entries = ctx.inputs.flatMap(asEntries);
    if (entries.length === 0) throw new Error("Sem dados. Conecte coleta/dataset.");
    const reviews = collectReviews(ctx.inputs);
    const recent = [...reviews]
      .filter((r) => r.date)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 50);
    const withReply = reviews.filter((r) => r.developerReply).length;
    const perApp = computePerAppStats(entries);
    ctx.log("info", `${reviews.length} reviews (${recent.length} recentes, ${withReply} com resposta).`);
    return {
      output: {
        recent,
        perApp,
        columns: ["app", "store", "reviews", "rating", "developer"],
        rows: perApp.map((s) => ({ app: s.name, store: s.store, reviews: s.reviewCount, rating: s.rating, developer: "—" })),
        markdown: `## Análise de reviews\n\n- **Total:** ${reviews.length} reviews de ${entries.length} app(s)\n- **Recentes:** ${recent.length}\n- **Com resposta do dev:** ${withReply}\n- **Top app:** ${perApp[0]?.name ?? "—"}`,
      },
      summary: `${reviews.length} reviews`,
    };
  },

  "country-analysis": (ctx) => {
    const entries = ctx.inputs.flatMap(asEntries);
    if (entries.length === 0) throw new Error("Sem dados. Conecte coleta/dataset.");
    const reviews = collectReviews(ctx.inputs);
    // Conta reviews e sentimento por país.
    const byCountry = new Map<string, { count: number; positive: number; negative: number; neutral: number }>();
    for (const r of reviews) {
      const c = (r as { country?: string }).country || "—";
      const cur = byCountry.get(c) ?? { count: 0, positive: 0, negative: 0, neutral: 0 };
      cur.count++;
      if (r.rating >= 4) cur.positive++;
      else if (r.rating <= 2) cur.negative++;
      else cur.neutral++;
      byCountry.set(c, cur);
    }
    const data = [...byCountry.entries()]
      .map(([country, v]) => ({ country, count: v.count, positive: v.positive, negative: v.negative, neutral: v.neutral, pctPositive: Math.round((v.positive / Math.max(1, v.count)) * 100) }))
      .sort((a, b) => b.count - a.count);
    const top = data.slice(0, 5).map((d) => `${d.country} (${d.count}, ${d.pctPositive}%+)`).join(", ");
    ctx.log("info", `${data.length} países, top: ${top}.`);
    return {
      output: {
        chart: "country",
        data,
        title: "Reviews por país",
        columns: ["country", "count", "positive", "negative", "pctPositive"],
        rows: data,
        markdown: `## Análise por país\n\n- **Países distintos:** ${data.length}\n- **Total:** ${reviews.length} reviews\n- **Top:** ${top || "—"}\n\n| País | Reviews | % Positivo |\n|---|---|---|\n${data.slice(0, 10).map((d) => `| ${d.country} | ${d.count} | ${d.pctPositive}% |`).join("\n")}`,
      },
      summary: `${data.length} países`,
    };
  },

  "rating-trend": (ctx) => {
    const dated = collectReviews(ctx.inputs).filter((r) => r.date);
    if (dated.length === 0) throw new Error("Sem reviews com data. Conecte coleta/dataset.");
    const byDate = new Map<string, { sum: number; count: number }>();
    for (const r of dated) {
      const d = String(r.date).slice(0, 10);
      const cur = byDate.get(d) ?? { sum: 0, count: 0 };
      cur.sum += r.rating;
      cur.count++;
      byDate.set(d, cur);
    }
    const data = [...byDate.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, v]) => ({ date, avgRating: +(v.sum / v.count).toFixed(2), count: v.count }));
    ctx.log("info", `Tendência de ${dated.length} reviews em ${data.length} dia(s).`);
    return {
      output: { chart: "line", data, title: "Evolução da nota média", xKey: "date" },
      summary: `${data.length} dias`,
    };
  },

  "version-compare": (ctx) => {
    const withVersion = collectReviews(ctx.inputs).filter((r) => (r.version ?? "").trim());
    if (withVersion.length === 0) throw new Error("Nenhum review com campo de versão. Conecte coleta/dataset.");
    const byVersion = new Map<string, { count: number; sum: number; pos: number; neg: number }>();
    for (const r of withVersion) {
      const v = String(r.version).trim();
      const cur = byVersion.get(v) ?? { count: 0, sum: 0, pos: 0, neg: 0 };
      cur.count++;
      cur.sum += r.rating;
      if (r.rating >= 4) cur.pos++;
      else if (r.rating <= 2) cur.neg++;
      byVersion.set(v, cur);
    }
    const rows = [...byVersion.entries()]
      .map(([version, v]) => ({
        version,
        reviews: v.count,
        avgRating: +(v.sum / v.count).toFixed(2),
        positivePct: Math.round((v.pos / v.count) * 100),
        negativePct: Math.round((v.neg / v.count) * 100),
      }))
      .sort((a, b) => b.reviews - a.reviews);
    ctx.log("info", `${rows.length} versões comparadas.`);
    const best = [...rows].sort((a, b) => b.avgRating - a.avgRating)[0];
    const worst = [...rows].sort((a, b) => a.avgRating - b.avgRating)[0];
    return {
      output: {
        columns: ["version", "reviews", "avgRating", "positivePct", "negativePct"],
        rows,
        markdown:
          `## Comparação de versões\n\n- **Versões:** ${rows.length}\n` +
          `- **Melhor:** ${best.version} (nota ${best.avgRating})\n- **Pior:** ${worst.version} (nota ${worst.avgRating})\n\n` +
          rows.slice(0, 15).map((r) => `- **${r.version}** — ${r.reviews} reviews, nota ${r.avgRating}, ${r.positivePct}%+ / ${r.negativePct}%−`).join("\n"),
      },
      summary: `${rows.length} versões`,
    };
  },

  "review-sampler": (ctx) => {
    const n = num(ctx.config.sampleSize, 10);
    const mode = str(ctx.config.mode, "recent");
    const reviews = collectReviews(ctx.inputs);
    if (reviews.length === 0) throw new Error("Sem reviews. Conecte coleta/dataset.");
    const byDate = (r: { date?: string }) => (r.date ? new Date(r.date).getTime() : 0);
    const sorted = [...reviews];
    switch (mode) {
      case "oldest": sorted.sort((a, b) => byDate(a) - byDate(b)); break;
      case "helpful": sorted.sort((a, b) => (b.thumbsUp ?? 0) - (a.thumbsUp ?? 0)); break;
      case "top": sorted.sort((a, b) => b.rating - a.rating || byDate(b) - byDate(a)); break;
      case "bottom": sorted.sort((a, b) => a.rating - b.rating || byDate(b) - byDate(a)); break;
      default: sorted.sort((a, b) => byDate(b) - byDate(a));
    }
    const MODE_LABEL: Record<string, string> = { recent: "recentes", oldest: "antigos", helpful: "úteis", top: "melhores", bottom: "piores" };
    const sampled = sorted.slice(0, Math.max(1, n));
    ctx.log("info", `${sampled.length} reviews (${(MODE_LABEL[mode] ?? "recentes")}) de ${reviews.length}.`);
    return {
      output: {
        columns: ["rating", "author", "date", "text"],
        rows: sampled.map((r) => ({
          rating: `${r.rating}★`, author: r.author || "—", date: (r.date ?? "").slice(0, 10) || "—",
          text: (r.text ?? "").slice(0, 180),
        })),
        markdown:
          `## Amostra: ${sampled.length} reviews (${MODE_LABEL[mode] ?? "recentes"})\n\n` +
          sampled.map((r) => `> **${"★".repeat(Math.max(1, r.rating))}** — ${r.author || "Anônimo"} (${(r.date ?? "").slice(0, 10) || "s/ data"}): ${((r.text ?? "").trim() || "(vazio)").slice(0, 220)}`).join("\n\n"),
      },
      summary: `${sampled.length} amostrados`,
    };
  },

  "anomaly-detector": (ctx) => {
    const entries = ctx.inputs.flatMap(asEntries);
    if (entries.length === 0) throw new Error("Sem dados. Conecte coleta/dataset.");
    const facts = computeFacts(entries);
    const anomalies = detectAnomalies(entries, facts);
    ctx.log("info", `${anomalies.length} anomalia(s) em ${entries.length} app(s).`);
    if (anomalies.length === 0) {
      return {
        output: {
          markdown: `## Detecção de anomalias\n\nNenhuma anomalia detectada em ${entries.length} app(s). Regras: regressão de versão (Δ ≤ −0.7), pico de negatividade (+15pp vs baseline), pico de volume (≥ 2× mediana), app outlier (|Δ| ≥ 0.8).`,
        },
        summary: "0 anomalias",
      };
    }
    const SEV_ICON: Record<string, string> = { alta: "🔴", média: "🟡", baixa: "🔵" };
    return {
      output: {
        columns: ["severity", "type", "title"],
        rows: anomalies.map((a) => ({ severity: a.severity, type: ANOMALY_TYPE_LABEL[a.type], title: a.title })),
        markdown:
          `## Detector de anomalias (${anomalies.length})\n\n` +
          anomalies.map((a) => `- ${SEV_ICON[a.severity] ?? "•"} **[${ANOMALY_TYPE_LABEL[a.type]}]** ${a.title} — ${a.detail}`).join("\n") +
          `\n\nReviews de suporte: até ${Math.max(...anomalies.map((a) => a.reviewIds.length))} referências por anomalia.`,
      },
      summary: `${anomalies.length} anomalias`,
    };
  },

  "reply-rate": (ctx) => {
    const entries = ctx.inputs.flatMap(asEntries);
    if (entries.length === 0) throw new Error("Sem dados. Conecte coleta/dataset.");
    const data = entries.map((e) => {
      const total = e.reviews.length;
      const withReply = e.reviews.filter((r) => r.developerReply).length;
      return {
        name: e.app.name,
        reviews: total,
        withReply,
        withoutReply: total - withReply,
        ratePct: total > 0 ? Math.round((withReply / total) * 100) : 0,
      };
    }).sort((a, b) => b.ratePct - a.ratePct);
    const avg = data.length > 0 ? Math.round(data.reduce((s, d) => s + d.ratePct, 0) / data.length) : 0;
    ctx.log("info", `Taxa de resposta: média ${avg}% em ${data.length} app(s).`);
    return {
      output: {
        chart: "bar-h",
        data,
        title: "% respondido pelo dev por app",
        xKey: "name",
        yKey: "ratePct",
        columns: ["name", "reviews", "withReply", "ratePct"],
        rows: data,
        markdown: `## Taxa de resposta do dev\n\n- **Média do conjunto:** ${avg}%\n` + data.map((d) => `- **${d.name}:** ${d.ratePct}% (${d.withReply}/${d.reviews})`).join("\n"),
      },
      summary: `média ${avg}%`,
    };
  },

  sort: (ctx) => {
    const order = str(ctx.config.order, "recent");
    const ORDER_LABEL: Record<string, string> = { recent: "recentes", oldest: "antigos", helpful: "úteis", rating: "nota", ratingAsc: "nota crescente" };
    const entries = ctx.inputs.flatMap(asEntries);
    if (entries.length === 0) throw new Error("Sem dados. Conecte coleta/dataset ou a saída de um filtro.");
    const byDate = (r: { date?: string }) => (r.date ? new Date(r.date).getTime() : 0);
    const sorted = entries.map((e) => {
      const reviews = [...(e.reviews ?? [])];
      switch (order) {
        case "oldest": reviews.sort((a, b) => byDate(a) - byDate(b)); break;
        case "helpful": reviews.sort((a, b) => (b.thumbsUp ?? 0) - (a.thumbsUp ?? 0)); break;
        case "rating": reviews.sort((a, b) => b.rating - a.rating); break;
        case "ratingAsc": reviews.sort((a, b) => a.rating - b.rating); break;
        default: reviews.sort((a, b) => byDate(b) - byDate(a));
      }
      return { ...e, reviews };
    });
    const total = sorted.reduce((s, e) => s + e.reviews.length, 0);
    ctx.log("info", `Ordenado (${ORDER_LABEL[order] ?? "recentes"}): ${total} reviews.`);
    return { output: sorted, summary: `${total} reviews ordenados` };
  },

  "bigram-cloud": (ctx) => {
    const reviews = collectReviews(ctx.inputs);
    if (reviews.length === 0) throw new Error("Sem reviews. Conecte coleta/dataset.");
    const limit = Math.max(10, Math.min(60, num(ctx.config.limit, 30)));
    const STOP = new Set("de,da,do,em,um,uma,e,é,que,o,a,os,as,com,para,por,não,na,no,nas,nos,ao,à,às,se,eu,me,meu,minha,mas,como,quando,então,foi,ser,são,sou,tem,ele,ela,vc,você,app,pois,muito,mais,muito,só,tive,está,estou,esse,essa,desta,dessa".split(","));
    const counts = new Map<string, number>();
    for (const r of reviews) {
      const words = String(r.text ?? "").toLowerCase()
        .split(/[^a-zà-úÁ-Ú0-9]+/i)
        .filter((w) => w.length > 2 && !STOP.has(w));
      const seen = new Set<string>();
      for (let i = 0; i + 1 < words.length; i++) {
        const key = `${words[i]} ${words[i + 1]}`;
        if (seen.has(key)) continue; // 1 par por review
        seen.add(key);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    const data = [...counts.entries()]
      .filter(([, v]) => v >= (reviews.length > 200 ? 3 : 2))
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([text, value]) => ({ text, value }));
    if (data.length === 0) throw new Error("Sem bigramas frequentes (textos muito curtos ou reviews repetidos).");
    ctx.log("info", `${data.length} bigramas frequentes de ${reviews.length} reviews.`);
    return {
      output: {
        chart: "wordcloud", data, title: "Pares de palavras frequentes",
        markdown: data.slice(0, 10).map((d) => `- **${d.text}** (${d.value}×)`).join("\n"),
      },
      summary: `${data.length} bigramas`,
    };
  },

  aggregate: (ctx) => {
    const entries = ctx.inputs.flatMap(asEntries);
    if (entries.length === 0) throw new Error("Sem dados. Conecte coleta/dataset.");
    const field = str(ctx.config.field, "rating");
    const op = str(ctx.config.op, "avg");
    const FIELD_LABEL: Record<string, string> = { rating: "nota (★)", thumbsUp: "👍 úteis", length: "tamanho texto", reviews: "nº reviews" };
    const val = (e: DatasetEntry): number | null => {
      const rs = e.reviews ?? [];
      if (field === "reviews") return rs.length;
      const nums = rs.map((r) => field === "rating" ? r.rating : field === "thumbsUp" ? (r.thumbsUp ?? 0) : String(r.text ?? "").length);
      if (nums.length === 0) return null;
      if (op === "count") return nums.filter((n) => n != null).length;
      if (op === "sum") return nums.reduce((a, b) => a + b, 0);
      return +(nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2);
    };
    const rows = entries
      .map((e) => ({ app: e.app.name, store: e.app.store, field: FIELD_LABEL[field] ?? field, op, value: val(e) }))
      .filter((r) => r.value !== null);
    const overall = (() => {
      const all = entries.flatMap((e) => e.reviews ?? []);
      if (all.length === 0) return null;
      const nums = all.map((r) => field === "rating" ? r.rating : field === "thumbsUp" ? (r.thumbsUp ?? 0) : String(r.text ?? "").length);
      if (op === "count") return nums.length;
      if (op === "sum") return +(nums.reduce((a, b) => a + b, 0)).toFixed(2);
      return +(nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2);
    })();
    ctx.log("info", `Agregação (${op} de ${FIELD_LABEL[field] ?? field}): ${rows.length} app(s).`);
    return {
      output: {
        columns: ["app", "store", "field", "op", "value"],
        rows,
        markdown: `## Agregação: ${op} de ${FIELD_LABEL[field] ?? field}\n\n- **Conjunto (todas as reviews):** ${overall ?? "—"}\n` + rows.slice(0, 15).map((r) => `- **${r.app}** (${r.store}): ${r.value}`).join("\n"),
      },
      summary: `${op} ${FIELD_LABEL[field] ?? field}`,
    };
  },

  "review-age": (ctx) => {
    const reviews = collectReviews(ctx.inputs).filter((r) => r.date);
    if (reviews.length === 0) throw new Error("Sem reviews com data.");
    const now = Date.now();
    const DAY = 86400_000;
    const buckets = [
      { label: "≤ 30 dias", max: 30, count: 0, sum: 0 },
      { label: "31–90 dias", max: 90, count: 0, sum: 0 },
      { label: "91–180 dias", max: 180, count: 0, sum: 0 },
      { label: "> 180 dias", max: Infinity, count: 0, sum: 0 },
    ];
    let ageSum = 0;
    for (const r of reviews) {
      const days = Math.max(0, Math.round((now - new Date(r.date).getTime()) / DAY));
      ageSum += days;
      const b = buckets.find((b) => days <= b.max)!;
      b.count++; b.sum += r.rating;
    }
    const avgDays = Math.round(ageSum / reviews.length);
    const data = buckets.filter((b) => b.count > 0).map((b) => ({
      faixa: b.label, count: b.count, avgRating: +(b.sum / b.count).toFixed(2),
    }));
    ctx.log("info", `Idade média ${avgDays} dias em ${reviews.length} reviews.`);
    return {
      output: {
        chart: "bar", data: data.map((d) => ({ rating: d.faixa, count: d.count })), title: "Reviews por faixa de idade",
        columns: ["faixa", "count", "avgRating"], rows: data,
        markdown: `## Idade dos reviews\n\n- **Reviews:** ${reviews.length}\n- **Idade média:** ${avgDays} dias\n\n` + data.map((d) => `- **${d.faixa}:** ${d.count} (nota ${d.avgRating})`).join("\n"),
      },
      summary: `idade média ${avgDays}d`,
    };
  },

  dashboard: (ctx) => {
    const entries = ctx.inputs.flatMap(asEntries);
    if (entries.length === 0) throw new Error("Sem dados. Conecte coleta/dataset.");
    const reviews = collectReviews(ctx.inputs);
    const kpis = computeKPIs(reviews, entries);
    ctx.log("info", `Dashboard: ${kpis.totalReviews} reviews, ${entries.length} apps.`);
    return {
      output: {
        dashboard: true,
        kpis,
        charts: [
          { chart: "bar", data: computeRatingDistribution(reviews), title: "Distribuição de notas" },
          { chart: "pie", data: computeSentiment(reviews), title: "Sentimento" },
          { chart: "bar-h", data: computeStoreComparison(entries), title: "Apple vs Google", xKey: "shortName", yKey: "reviews" },
          { chart: "bar-h", data: computePerAppStats(entries), title: "Reviews por app", xKey: "name", yKey: "reviewCount" },
        ].filter((c) => Array.isArray(c.data) && c.data.length > 0),
      },
      summary: `${kpis.totalReviews} reviews`,
    };
  },

  chart: (ctx) => {
    const chartType = str(ctx.config.chartType, "rating");
    // Upstream chart data: a sentiment/themes/version-analysis node already
    // produced { chart, data, title } — pass it through (optionally override
    // the title). This lets an analysis node feed a chart node directly.
    for (const inp of ctx.inputs) {
      if (inp && typeof inp === "object" && "chart" in (inp as object) && "data" in (inp as object)) {
        const v = inp as { chart: string; data: unknown[]; title?: string; xKey?: string; yKey?: string };
        if (Array.isArray(v.data) && v.data.length > 0) {
          ctx.log("info", `Repassando gráfico "${v.chart}" da saída anterior.`);
          return { output: v, summary: `${v.data.length} pontos` };
        }
      }
    }
    const entries = ctx.inputs.flatMap(asEntries);
    if (entries.length === 0) throw new Error("Sem dados para gráfico. Conecte coleta/dataset ou a saída de um nó de análise.");
    const reviews = collectReviews(ctx.inputs);
    if (reviews.length === 0 && chartType !== "store") throw new Error("Sem reviews nos dados conectados.");

    switch (chartType) {
      case "rating": {
        const data = computeRatingDistribution(reviews);
        ctx.log("info", `Distribuição de notas sobre ${reviews.length} reviews.`);
        return { output: { chart: "bar", data, title: "Distribuição de notas" }, summary: `${reviews.length} reviews` };
      }
      case "sentiment": {
        const data = computeSentiment(reviews);
        ctx.log("info", `Sentimento (${reviews.length} reviews).`);
        return { output: { chart: "pie", data, title: "Sentimento" }, summary: `${reviews.length} reviews` };
      }
      case "timeline": {
        const data = computeTimeline(reviews);
        if (data.length === 0) throw new Error("Sem datas suficientes para a timeline.");
        ctx.log("info", `Timeline (${data.length} meses).`);
        return { output: { chart: "line", data, title: "Evolução temporal" }, summary: `${data.length} pontos` };
      }
      case "store": {
        const data = computeStoreComparison(entries);
        if (data.length === 0) throw new Error("Sem apps para comparar lojas.");
        ctx.log("info", `Comparativo de lojas (${data.length}).`);
        return { output: { chart: "bar-h", data, title: "Apple vs Google" }, summary: `${data.length} lojas` };
      }
      case "version": {
        const data = computeVersionBreakdown(reviews);
        if (data.length === 0) throw new Error("Sem versões nos reviews.");
        ctx.log("info", `Versões (${data.length}).`);
        return { output: { chart: "bar", data, title: "Reviews por versão", xKey: "version", yKey: "count" }, summary: `${data.length} versões` };
      }
      case "perApp": {
        const data = computePerAppStats(entries);
        if (data.length === 0) throw new Error("Sem apps para stats por app.");
        ctx.log("info", `Stats por app (${data.length}).`);
        return { output: { chart: "bar-h", data, title: "Reviews por app", xKey: "name", yKey: "reviewCount" }, summary: `${data.length} apps` };
      }
      case "wordcloud": {
        const data = computeWordCloud(reviews, 30).map(([text, value]) => ({ text, value }));
        if (data.length === 0) throw new Error("Sem termos frequentes.");
        ctx.log("info", `Nuvem de termos (${data.length}).`);
        return { output: { chart: "wordcloud", data, title: "Termos frequentes" }, summary: `${data.length} termos` };
      }
      case "scatter": {
        // Nota (loja) × nº de reviews por app; bolha = volume de reviews coletados.
        const data = entries.map((e) => ({
          name: e.app.name,
          x: typeof e.app.rating === "number" ? e.app.rating : Number(e.app.rating) || 0,
          y: e.app.ratingCount ?? e.reviews.length,
          z: e.reviews.length,
        })).filter((d) => Number.isFinite(d.x) && Number.isFinite(d.y));
        if (data.length === 0) throw new Error("Sem apps para dispersão.");
        ctx.log("info", `Dispersão (${data.length} apps).`);
        return { output: { chart: "scatter", data, title: "Nota × Reviews por app" }, summary: `${data.length} apps` };
      }
      case "heatmap": {
        // App × distribuição de notas (matriz de intensidade).
        const data = entries.map((e) => {
          const dist: Record<string, number | string> = { label: e.app.name };
          for (let s = 1; s <= 5; s++) dist[`${s}★`] = 0;
          for (const r of e.reviews) { const k = `${r.rating}★`; if (k in dist) dist[k] = (Number(dist[k]) || 0) + 1; }
          return dist;
        });
        if (data.length === 0) throw new Error("Sem apps para heatmap.");
        ctx.log("info", `Heatmap (${data.length} apps × 5 notas).`);
        return { output: { chart: "heatmap", data, title: "Distribuição de notas por app" }, summary: `${data.length} apps` };
      }
      case "country": {
        // Reviews por país (ReviewEntry.country).
        const counts = new Map<string, number>();
        for (const r of reviews) {
          const c = (r as { country?: string }).country || "—";
          counts.set(c, (counts.get(c) ?? 0) + 1);
        }
        const data = [...counts.entries()].map(([country, count]) => ({ country, count })).sort((a, b) => b.count - a.count);
        if (data.length === 0) throw new Error("Sem países nos reviews.");
        ctx.log("info", `Reviews por país (${data.length} países).`);
        return { output: { chart: "country", data, title: "Reviews por país" }, summary: `${data.length} países` };
      }
      case "trend": {
        // Evolução da nota média por dia (mesmo cálculo do nó rating-trend).
        const byDate = new Map<string, { sum: number; count: number }>();
        for (const r of reviews) {
          const d = String(r.date ?? "").slice(0, 10);
          if (!d) continue;
          const cur = byDate.get(d) ?? { sum: 0, count: 0 };
          cur.sum += r.rating;
          cur.count++;
          byDate.set(d, cur);
        }
        const data = [...byDate.entries()]
          .sort(([a], [b]) => (a < b ? -1 : 1))
          .map(([date, v]) => ({ date, avgRating: +(v.sum / v.count).toFixed(2), count: v.count }));
        if (data.length === 0) throw new Error("Sem reviews com data.");
        ctx.log("info", `Tendência (${data.length} dias).`);
        return { output: { chart: "line", data, title: "Evolução da nota média", xKey: "date" }, summary: `${data.length} dias` };
      }
      default:
        return { output: { chart: "bar", data: computeRatingDistribution(reviews), title: "Distribuição de notas" }, summary: `${reviews.length} reviews` };
    }
  },

  table: (ctx) => {
    const entries = ctx.inputs.flatMap(asEntries);
    if (entries.length === 0) throw new Error("Sem dados para tabela.");
    const rows = entries.map((e) => ({
      app: e.app.name, store: e.app.store, reviews: e.reviews.length,
      rating: e.app.rating ?? "—", developer: e.app.developer ?? "—",
    }));
    ctx.log("info", `Tabela com ${rows.length} linha(s).`);
    return { output: { columns: ["app", "store", "reviews", "rating", "developer"], rows }, summary: `${rows.length} linhas` };
  },

  display: (ctx) => {
    const text = str(ctx.config.text, "");
    const input = ctx.inputs[0];
    return { output: { text: text || (typeof input === "string" ? input : input == null ? "" : JSON.stringify(input, null, 2)) } };
  },

  output: (ctx) => {
    // Pass-through viewer node: it does not compute anything — it renders the
    // upstream node's output. CanvasNode reads the upstream output reactively
    // via edges so streaming works live. The executor just forwards the first
    // input so topology/identity is consistent if something chains from it.
    const upstream = ctx.inputs[0];
    return { output: upstream ?? null, summary: "saída" };
  },

  note: () => ({ output: null }),

  filter: (ctx) => {
    const minRating = num(ctx.config.minRating, 0);
    const store = str(ctx.config.store, "");
    const entries = ctx.inputs.flatMap(asEntries);
    const filtered = entries
      .filter((e) => !store || e.app.store === store)
      .map((e) => ({ ...e, reviews: e.reviews.filter((r) => r.rating >= minRating) }));
    const totalReviews = filtered.reduce((s, e) => s + e.reviews.length, 0);
    ctx.log("info", `Filtro: ${filtered.length} app(s), ${totalReviews} reviews.`);
    return { output: filtered, summary: `${totalReviews} reviews` };
  },

  code: (ctx) => {
    const src = str(ctx.config.source, "").trim();
    if (!src) throw new Error("Código vazio.");
    ctx.log("info", "Executando trecho de código…");
    // Sandboxed-ish: only `inputs` is exposed. Best-effort, not a security boundary.
    const fn = new Function("inputs", `"use strict";\n${src}`);
    const out = fn(ctx.inputs);
    ctx.log("success", "Código executado.");
    return { output: out, summary: "ok" };
  },

  report: async (ctx) => {
    const prompt = str(ctx.config.prompt, "").trim();
    const entries = ctx.inputs.flatMap(asEntries);
    const upstreamTexts = asUpstreamText(ctx.inputs);
    if (!prompt) throw new Error("Escreva um prompt no nó de Relatório IA.");
    if (entries.length === 0 && upstreamTexts.length === 0)
      throw new Error("Conecte um nó de coleta/dataset ou a saída de outro nó IA.");
    const hasUpstream = upstreamTexts.length > 0;
    ctx.log("info", hasUpstream
      ? `Relatório a partir de ${upstreamTexts.length} saída(s) anterior(es)…`
      : `Relatório IA sobre ${entries.length} app(s)…`);
    if (hasUpstream) {
      const context = upstreamTexts.map((t, i) => `### Saída do nó #${i + 1}\n\n${t}`).join("\n\n");
      const messages: ChatMessage[] = [
        { role: "user", content: `${prompt}\n\nBaseie-se nas saídas anteriores:\n\n${context}` },
      ];
      let result = "";
      await streamExperimentChat(entries, messages, {
        onToken: (full) => { result = full; ctx.setOutput({ markdown: result, entries, presentation: true, derivedFrom: "upstream" }); },
        onDone: (full) => { result = full; },
        onError: (err) => { throw new Error(err); },
      }, ctx.signal);
      if (ctx.signal.aborted) return { output: { markdown: result, entries, presentation: true, derivedFrom: "upstream" }, summary: "interrompido" };
      ctx.log("success", `Relatório gerado (${result.length} chars).`);
      return { output: { markdown: result, entries, presentation: true, derivedFrom: "upstream" }, summary: `${result.length} chars` };
    }
    let result = "";
    await streamExperiment("custom", entries, {
      onToken: (full) => { result = full; ctx.setOutput({ markdown: result, entries, presentation: true, derivedFrom: "data" }); },
      onDone: (full) => { result = full; },
      onError: (err) => { throw new Error(err); },
    }, ctx.signal);
    if (ctx.signal.aborted) return { output: { markdown: result, entries, presentation: true, derivedFrom: "data" }, summary: "interrompido" };
    ctx.log("success", `Relatório gerado (${result.length} chars).`);
    return { output: { markdown: result, entries, presentation: true, derivedFrom: "data" }, summary: `${result.length} chars` };
  },
};

export async function runNodeExecutor(kind: NodeKind, ctx: NodeRunContext): Promise<NodeRunResult> {
  const fn = executors[kind];
  if (!fn) return { output: null };
  return await fn(ctx);
}

export const ANALYSIS_SECTIONS = EXPERIMENT_SECTIONS.filter((s) => s.kind === "ai");

/** Chart types available in the chart node config. */
export const CHART_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "rating", label: "Distribuição de notas" },
  { value: "sentiment", label: "Sentimento (pizza)" },
  { value: "timeline", label: "Evolução temporal" },
  { value: "store", label: "Comparar lojas" },
  { value: "version", label: "Reviews por versão" },
  { value: "perApp", label: "Reviews por app" },
  { value: "wordcloud", label: "Nuvem de termos" },
  { value: "scatter", label: "Dispersão (nota × reviews)" },
  { value: "heatmap", label: "Mapa de calor (app × nota)" },
  { value: "country", label: "Reviews por país" },
  { value: "trend", label: "Tendência da nota (tempo)" },
];
