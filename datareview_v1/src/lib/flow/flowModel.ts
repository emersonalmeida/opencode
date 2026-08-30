/**
 * Flow (`/fluxo`) — modelo puro da "Intelligence Journey": a página que reúne
 * TODAS as páginas do sistema em seções expansíveis/recolhíveis, em ordem
 * lógica de uso (missão → descobrir → … → monitorar), formando um pipeline
 * UX de ponta a ponta.
 *
 * Este arquivo é a fonte única de verdade de:
 *  - o catálogo de seções (ordem, rótulos, deep links para as páginas reais);
 *  - o status de cada seção, derivado de um snapshot do estado do sistema
 *    (visibilidade do status do sistema — Nielsen #1);
 *  - o progresso global da jornada + a próxima etapa sugerida;
 *  - a missão da investigação (persistida, pub/sub).
 *
 * É deliberadamente PURO (sem hooks, sem efeitos colaterais além do store de
 * missão) para ser testável — os componentes vivem em src/components/flow/.
 */
import {
  Target, Search, CheckSquare, Download, Database, BarChart3, Activity,
  BrainCircuit, Bot, Lightbulb, Scale, FlaskRound, FlaskConical,
  PackageOpen, Presentation, Radar, type LucideIcon,
  Circle, Play, Settings2, Loader, Pause, Check, AlertTriangle, X, Lock, Minus,
} from "lucide-react";

export type FlowSectionId =
  | "missao" | "descobrir" | "selecionar" | "coletar" | "dados"
  | "visualizar" | "sinais" | "investigar" | "agentes" | "conhecimento"
  | "decidir" | "oportunidades" | "experimentar" | "artefatos"
  | "apresentar" | "monitorar";

/** Vocabulário canônico de estados de uma etapa do System Flow. */
export type FlowStatus =
  | "idle" // não iniciada
  | "ready" // pronta para executar
  | "needs-config" // configuração necessária
  | "running" // executando
  | "processing" // processando (streaming/pós-execução)
  | "paused" // pausada
  | "done" // concluída
  | "done-warning" // concluída com avisos
  | "error" // erro
  | "blocked" // bloqueada por dependência
  | "skipped" // ignorada/saltada pelo usuário
  | "attention"; // legado: agrega needs-config/warning

export interface FlowDeepLink {
  path: string;
  label: string;
}

export interface FlowSectionDef {
  id: FlowSectionId;
  /** Número exibido ("00"…"15"). */
  num: string;
  title: string;
  /** O que o usuário faz nesta etapa (uma linha). */
  subtitle: string;
  icon: LucideIcon;
  /** Páginas reais cujas capacidades a seção incorpora. */
  deepLinks: FlowDeepLink[];
}

/**
 * As 16 seções em ordem lógica de uso. Cada seção mapeia para uma ou mais
 * páginas do registry `PAGES` — a seção traz a capacidade essencial e o deep
 * link leva ao workspace completo da página.
 */
export const FLOW_SECTIONS: FlowSectionDef[] = [
  {
    id: "missao", num: "00", title: "Missão",
    subtitle: "Defina o objetivo da investigação e ajuste a configuração do sistema.",
    icon: Target,
    deepLinks: [{ path: "/configuracoes", label: "Configurações" }],
  },
  {
    id: "descobrir", num: "01", title: "Descobrir",
    subtitle: "Busque apps nas duas lojas e explore os top charts por categoria e país.",
    icon: Search,
    deepLinks: [
      { path: "/", label: "Início" },
      { path: "/home", label: "Home" },
      { path: "/auditoria", label: "Auditoria" },
      { path: "/chaves", label: "Chaves API" },
      { path: "/testes-fontes", label: "Testes de fontes" },
      { path: "/inicio", label: "Coleta" },
      { path: "/boas-vindas", label: "Boas-vindas" },
      { path: "/demo", label: "Demo" },
      { path: "/search", label: "Busca" },
      { path: "/00", label: "Uni" },
      { path: "/suggest", label: "Suggest" },
      { path: "/trending", label: "Trending" },
      { path: "/descoberta", label: "Descoberta" },
      { path: "/one", label: "One Page" },
      { path: "/all", label: "All" },
    ],
  },
  {
    id: "selecionar", num: "02", title: "Selecionar",
    subtitle: "Escolha o universo de análise: quais apps entram no escopo.",
    icon: CheckSquare,
    deepLinks: [{ path: "/compare", label: "Comparar" }],
  },
  {
    id: "coletar", num: "03", title: "Coletar",
    subtitle: "Baixe reviews e metadados para o dataset local — colete uma vez, reutilize sempre.",
    icon: Download,
    deepLinks: [
      { path: "/sessions", label: "Sessões" },
      { path: "/feedback", label: "Feedback" },
      { path: "/pipeline-multifonte", label: "Pipeline Multifonte" },
    ],
  },
  {
    id: "dados", num: "04", title: "Dados",
    subtitle: "Explore, valide e exporte tudo que foi coletado.",
    icon: Database,
    deepLinks: [
      { path: "/dados", label: "Dados brutos" },
      { path: "/pipeline-dados", label: "Pipeline de dados" },
      { path: "/fluxo-dados", label: "Fluxo de dados" },
    ],
  },
  {
    id: "visualizar", num: "05", title: "Visualizar",
    subtitle: "KPIs e gráficos determinísticos (sem IA): notas, sentimento, timeline, lojas.",
    icon: BarChart3,
    deepLinks: [{ path: "/dashboard", label: "Dashboard" }],
  },
  {
    id: "sinais", num: "06", title: "Sinais",
    subtitle: "Fatos computados e anomalias detectadas — o que merece investigação.",
    icon: Activity,
    deepLinks: [{ path: "/pipeline", label: "Pipeline" }],
  },
  {
    id: "investigar", num: "07", title: "Investigar",
    subtitle: "A IA transforma os dados em achados: seções de análise e módulos do Atlas.",
    icon: BrainCircuit,
    deepLinks: [
      { path: "/01", label: "01" },
      { path: "/chat-voz", label: "Chat com voz" },
      { path: "/chat-arquivos", label: "Chat com arquivos" },
      { path: "/conversa", label: "Conversa" },
      { path: "/experiments", label: "Experimentos" },
      { path: "/atlas", label: "Analysis Atlas" },
      { path: "/metodologias", label: "Metodologias" },
      { path: "/chat", label: "Chat" },
      { path: "/case-ia", label: "Case IA" },
      { path: "/concept", label: "Conceito" },
      { path: "/ia", label: "Central de IA" },
      { path: "/teste", label: "Teste" },
    ],
  },
  {
    id: "agentes", num: "08", title: "Agentes",
    subtitle: "Especialistas por segmento executam pipelines de trabalho sobre os achados.",
    icon: Bot,
    deepLinks: [{ path: "/agentes", label: "Agentes" }],
  },
  {
    id: "conhecimento", num: "09", title: "Conhecimento",
    subtitle: "O que o sistema já sabe: insights, artefatos, findings e evidências.",
    icon: Lightbulb,
    deepLinks: [{ path: "/lab", label: "Lab" }],
  },
  {
    id: "decidir", num: "10", title: "Decidir",
    subtitle: "Consolide achados em decisões priorizadas, por persona, com evidência.",
    icon: Scale,
    deepLinks: [{ path: "/decision-center", label: "Decision Center" }],
  },
  {
    id: "oportunidades", num: "11", title: "Oportunidades",
    subtitle: "Transforme findings em oportunidades e candidatos a produto.",
    icon: FlaskRound,
    deepLinks: [{ path: "/lab", label: "Lab" }],
  },
  {
    id: "experimentar", num: "12", title: "Experimentar",
    subtitle: "Protótipos, pipelines visuais e page builder para testar ideias.",
    icon: FlaskConical,
    deepLinks: [
      { path: "/playground", label: "Playground" },
      { path: "/canvas", label: "Canvas" },
      { path: "/git", label: "Git" },
      { path: "/design", label: "Design Canvas" },
      { path: "/design-system", label: "Design System" },
      { path: "/componentes", label: "Componentes" },
      { path: "/inventario", label: "Inventário" },
      { path: "/layouts", label: "Layouts" },
      { path: "/estrutura", label: "Estrutura" },
      { path: "/ui", label: "UI" },
    ],
  },
  {
    id: "artefatos", num: "13", title: "Artefatos",
    subtitle: "Tudo que o sistema gerou: sessões, saídas de IA e arquivos exportáveis.",
    icon: PackageOpen,
    deepLinks: [
      { path: "/sessions", label: "Sessões" },
      { path: "/outputs", label: "Outputs" },
    ],
  },
  {
    id: "apresentar", num: "14", title: "Apresentar",
    subtitle: "Gere decks profissionais dos resultados e exporte para compartilhar.",
    icon: Presentation,
    deepLinks: [{ path: "/apresentacoes", label: "Apresentações" }],
  },
  {
    id: "monitorar", num: "15", title: "Monitorar",
    subtitle: "Acompanhe a atividade do sistema e reinicie o ciclo com novos dados.",
    icon: Radar,
    deepLinks: [
      { path: "/nucleo", label: "Núcleo" },
      { path: "/terminal", label: "Terminal" },
      { path: "/os", label: "Nexus OS" },
      { path: "/case", label: "Explorar" },
      { path: "/jornada", label: "Jornada guiada" },
      { path: "/uso", label: "Uso do sistema" },
    ],
  },
];

/** Snapshot do estado do sistema usado para derivar o status das seções. */
export interface FlowSnapshot {
  apps: number;
  reviews: number;
  /** Apps selecionados (0 = "todos" na semântica do sistema). */
  selected: number;
  insights: number;
  artifacts: number;
  findings: number;
  candidates: number;
  decks: number;
  outputs: number;
  generations: number;
  canvasNodes: number;
  designPages: number;
}

export interface FlowSectionState {
  status: FlowStatus;
  /** Linha curta exibida no resumo recolhido e no navegador. */
  detail: string;
}

/** Meta visual dos 12 estados canônicos (tokens `--status-*`). Estado ≠ cor. */
export const FLOW_STATUS_META: Record<FlowStatus, { label: string; icon: LucideIcon; dot: string; chip: string }> = {
  idle: { label: "Não iniciada", icon: Circle, dot: "bg-status-idle", chip: "text-muted-foreground bg-muted/60" },
  ready: { label: "Pronta", icon: Play, dot: "bg-status-info", chip: "text-status-info bg-status-info/10" },
  "needs-config": { label: "Config. necessária", icon: Settings2, dot: "bg-status-warning", chip: "text-status-warning bg-status-warning/10" },
  running: { label: "Executando", icon: Loader, dot: "bg-status-running", chip: "text-status-running bg-status-running/10" },
  processing: { label: "Processando", icon: Activity, dot: "bg-status-running", chip: "text-status-running bg-status-running/10" },
  paused: { label: "Pausada", icon: Pause, dot: "bg-status-idle", chip: "text-muted-foreground bg-muted/60" },
  done: { label: "Concluída", icon: Check, dot: "bg-status-success", chip: "text-status-success bg-status-success/10" },
  "done-warning": { label: "Concluída com avisos", icon: AlertTriangle, dot: "bg-status-warning", chip: "text-status-warning bg-status-warning/10" },
  error: { label: "Erro", icon: X, dot: "bg-status-error", chip: "text-status-error bg-status-error/10" },
  blocked: { label: "Bloqueada", icon: Lock, dot: "bg-status-skipped", chip: "text-status-skipped bg-status-skipped/10" },
  skipped: { label: "Ignorada", icon: Minus, dot: "bg-status-skipped", chip: "text-status-skipped bg-status-skipped/10" },
  attention: { label: "Atenção", icon: AlertTriangle, dot: "bg-status-warning", chip: "text-status-warning bg-status-warning/10" },
};

/**
 * Conecta tarefas do activityStore a uma seção do System Flow (heurística por
 * palavras-chave em `label`/`source`). Retorna null quando não reconhece —
 * a seção permanece no estado derivado do snapshot.
 */
export function sectionForTask(task: { label: string; source: string }): FlowSectionId | null {
  const text = `${task.label} ${task.source}`.toLowerCase();
  const rules: [FlowSectionId, RegExp][] = [
    ["descobrir", /busca|search|descobrir/],
    ["coletar", /coleta|collect|dataset/],
    ["dados", /valida|validação|dados/],
    ["visualizar", /dashboard|visualiz/],
    ["sinais", /pipeline|anomalia|fatos|sinais/],
    ["investigar", /ia|análise|analyze|atlas|seção|experiment/],
    ["agentes", /agente|agent/],
    ["decidir", /decis|decision|persona/],
    ["oportunidades", /lab\b|produto|candidato/],
    ["experimentar", /canvas|playground|design/],
    ["artefatos", /artefato|output|sessão/],
    ["apresentar", /apresenta|deck|slide/],
  ];
  for (const [id, re] of rules) {
    if (re.test(text)) return id;
  }
  return null;
}

const EMPTY_SNAPSHOT: FlowSnapshot = {
  apps: 0, reviews: 0, selected: 0, insights: 0, artifacts: 0, findings: 0,
  candidates: 0, decks: 0, outputs: 0, generations: 0, canvasNodes: 0, designPages: 0,
};

function hasData(s: FlowSnapshot): boolean {
  return s.apps > 0;
}

function hasKnowledge(s: FlowSnapshot): boolean {
  return s.insights > 0 || s.artifacts > 0 || s.findings > 0;
}

/**
 * Deriva o status de uma seção a partir do snapshot. Regras:
 *  - `done`: a etapa já produziu resultado persistido;
 *  - `ready`: a etapa pode ser executada agora (dependências satisfeitas);
 *  - `idle`: falta algo antes (ex.: sem dataset);
 *  - `attention`: há algo que pede ação do usuário.
 */
export function sectionState(id: FlowSectionId, s: FlowSnapshot): FlowSectionState {
  switch (id) {
    case "missao":
      return { status: "ready", detail: "objetivo e configuração" };
    case "descobrir":
      return hasData(s)
        ? { status: "done", detail: `${s.apps} app(s) no dataset` }
        : { status: "idle", detail: "busque e colete apps" };
    case "selecionar":
      return hasData(s)
        ? { status: "done", detail: s.selected > 0 ? `${s.selected} selecionado(s)` : "escopo: todos os apps" }
        : { status: "idle", detail: "aguardando coleta" };
    case "coletar":
      return hasData(s)
        ? { status: "done", detail: `${s.reviews.toLocaleString("pt-BR")} reviews` }
        : { status: "idle", detail: "nenhum review coletado" };
    case "dados":
      return hasData(s)
        ? { status: "done", detail: `${s.apps} app(s) · ${s.reviews.toLocaleString("pt-BR")} reviews` }
        : { status: "idle", detail: "dataset vazio" };
    case "visualizar":
      return hasData(s)
        ? { status: "done", detail: "gráficos disponíveis" }
        : { status: "idle", detail: "sem dados para visualizar" };
    case "sinais":
      if (s.artifacts > 0) return { status: "done", detail: `${s.artifacts} artefato(s) de conhecimento` };
      return hasData(s)
        ? { status: "ready", detail: "compute fatos e anomalias" }
        : { status: "idle", detail: "sem dados" };
    case "investigar":
      if (s.outputs > 0 || s.insights > 0)
        return { status: "done", detail: `${s.outputs + s.insights} saída(s) de IA` };
      return hasData(s)
        ? { status: "ready", detail: "pronto para analisar" }
        : { status: "idle", detail: "sem dados" };
    case "agentes":
      if (s.outputs > 0 || s.artifacts > 0)
        return { status: "done", detail: "especialistas já executaram" };
      return hasData(s)
        ? { status: "ready", detail: "execute um especialista" }
        : { status: "idle", detail: "sem dados" };
    case "conhecimento":
      return hasKnowledge(s)
        ? { status: "done", detail: `${s.insights + s.artifacts + s.findings} registro(s)` }
        : { status: "idle", detail: "nenhum conhecimento acumulado" };
    case "decidir":
      if (s.outputs > 0) return { status: "done", detail: `${s.outputs} análise(s) para decidir` };
      return hasData(s)
        ? { status: "ready", detail: "gere decisões por persona" }
        : { status: "idle", detail: "sem dados" };
    case "oportunidades":
      if (s.candidates > 0) return { status: "done", detail: `${s.candidates} candidato(s) a produto` };
      return hasKnowledge(s)
        ? { status: "ready", detail: "promova findings a oportunidades" }
        : { status: "idle", detail: "sem findings ainda" };
    case "experimentar":
      if (s.canvasNodes > 0 || s.designPages > 0)
        return { status: "done", detail: `${s.canvasNodes} nó(s) · ${s.designPages} página(s)` };
      return { status: "ready", detail: "protótipos e pipelines visuais" };
    case "artefatos":
      return s.generations > 0
        ? { status: "done", detail: `${s.generations} geração(ões) registrada(s)` }
        : { status: "idle", detail: "nada gerado ainda" };
    case "apresentar":
      return s.decks > 0
        ? { status: "done", detail: `${s.decks} deck(s)` }
        : { status: "ready", detail: "monte uma apresentação" };
    case "monitorar":
      return { status: "ready", detail: "atividade e próximo ciclo" };
  }
}

/** Status de todas as seções, na ordem do catálogo. */
export function allSectionStates(s: FlowSnapshot): Record<FlowSectionId, FlowSectionState> {
  const out = {} as Record<FlowSectionId, FlowSectionState>;
  for (const sec of FLOW_SECTIONS) out[sec.id] = sectionState(sec.id, s);
  return out;
}

export interface FlowProgress {
  done: number;
  total: number;
  pct: number;
}

/** Progresso global da jornada (seções concluídas / total). */
export function flowProgress(states: Record<FlowSectionId, FlowSectionState>): FlowProgress {
  const total = FLOW_SECTIONS.length;
  const done = FLOW_SECTIONS.filter((sec) => states[sec.id]?.status === "done").length;
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

/**
 * Próxima etapa sugerida: a primeira seção ainda não concluída (ignorando a
 * "missão", que é contínua). Retorna null quando tudo está concluído.
 */
export function nextSuggestedSection(
  states: Record<FlowSectionId, FlowSectionState>,
): FlowSectionDef | null {
  for (const sec of FLOW_SECTIONS) {
    if (sec.id === "missao" || sec.id === "monitorar") continue;
    if (states[sec.id]?.status !== "done") return sec;
  }
  return null;
}

/** Snapshot vazio (estado inicial / testes). */
export function emptySnapshot(): FlowSnapshot {
  return { ...EMPTY_SNAPSHOT };
}

// ---------------------------------------------------------------------------
// Missão da investigação (persistida + pub/sub)
// ---------------------------------------------------------------------------

const MISSION_KEY = "aso:flow-mission";

export function getMission(): string {
  try {
    return localStorage.getItem(MISSION_KEY) ?? "";
  } catch {
    return "";
  }
}

const missionListeners = new Set<() => void>();

/**
 * Monta o contexto de missão para injetar nos prompts de IA. Se a missão está
 * definida, ela vai no início; `base` (ex.: knowledge digest) é concatenado.
 * Retorna `undefined` quando não há nada — assim o campo `extraContext` fica
 * undefined e o servidor não adiciona o bloco.
 */
export function missionIAContext(base?: string): string | undefined {
  // Injeção de missão é configurável (AISettings.missionInjection, default ON).
  let missionOn = true;
  try {
    const raw = localStorage.getItem("aso:ai-settings:v1");
    if (raw) missionOn = (JSON.parse(raw).missionInjection ?? true) !== false;
  } catch { /* default ON */ }
  const mission = missionOn ? getMission() : "";
  const parts = [
    mission
      ? `OBJETIVO DA INVESTIGAÇÃO (declarado pelo usuário na página Fluxo — ORIENTE todas as análises a essa meta; seja específico sobre ela nas conclusões):\n"${mission}"`
      : "",
    base ?? "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join("\n\n") : undefined;
}

export function saveMission(text: string): void {
  try {
    localStorage.setItem(MISSION_KEY, text);
  } catch {
    /* quota */
  }
  missionListeners.forEach((l) => l());
}

export function subscribeMission(cb: () => void): () => void {
  missionListeners.add(cb);
  return () => missionListeners.delete(cb);
}
