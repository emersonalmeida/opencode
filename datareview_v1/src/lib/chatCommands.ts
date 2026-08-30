/**
 * chatCommands — detecção de intenção em linguagem natural SEM IA.
 *
 * Todo o sistema pode ser operado pelo chat mesmo com a IA desativada: o
 * parser reconhece pedidos em PT-BR ("exiba a página de pipeline", "colete
 * nubank", "pesquise bitcoin em todas as fontes", "gere um relatório") e
 * devolve uma AÇÃO estruturada que a superfície de chat executa —
 * renderizando componentes reais na conversa, coletando dados ou gerando
 * relatórios determinísticos.
 *
 * Módulo PURO (sem React): seguro para testes e reuso em qualquer chat.
 */
import { resolveSurface, normText } from "@/lib/embeddableSurfaces";
import { PIPELINE_SOURCES } from "@/lib/uni/sourceRunner";
import { UNI_SOURCE_META, type UniSourceId } from "@/lib/uni/types";
import { PAGES } from "@/lib/pages";

/** Ação detectada a partir da mensagem do usuário. */
export type ChatAction =
  | { kind: "show"; surfaceId: string; label: string }
  | { kind: "goto"; path: string; label: string }
  | { kind: "collect-app"; term: string }
  | { kind: "collect-multi"; term: string; sources: UniSourceId[]; max: boolean }
  | { kind: "report"; scope: string | null }
  | { kind: "run-pipeline"; sectionId: string | null }
  | { kind: "help" };

/* ------------------------------------------------------------ léxico ---- */

const SHOW_VERBS = /(?:^|\s)(exiba|exibir|mostre|mostrar|mostra|abra|abrir|ver|visualizar|exibe|mostrar-me|apresente|renderize)\b/i;
const COLLECT_APP_VERBS = /(?:^|\s)(colete|coletar|coleta|baixe|baixar|capture|capturar)\b/i;
const SEARCH_VERBS = /(?:^|\s)(pesquise|pesquisar|busque|buscar|procure|procurar|varra|minerar|mine)\b/i;
const REPORT_NOUNS = /(?:^|\s)(relat[oó]rio|report|relatorio completo|sum[aá]rio executivo)\b/i;
const HELP_WORDS = /^(?:ajuda|help|o que (voc[eê]|vc) pode fazer|comandos|o que sabe fazer)\??$/i;
const RUN_VERBS = /(?:^|\s)(execute|executar|executa|rode|rodar|roda|corra|dispare|disparar|inicie|iniciar|processe|processar)\b/i;
const PIPELINE_NOUNS = /\b(?:pipeline|an[áa]lises?|an[áa]lise|pipeline completa?|tudo)\b/i;
// Navegação: verbos que pedem para IR ATÉ uma página (diferente de "exibir",
// que mostra o componente dentro da conversa). ATENÇÃO: usa lookahead em vez
// de \b — "vá" termina em caractere acentuado e \b não casa após não-ASCII.
const NAV_VERBS = /^(?:v[aá]|vai|ir|navegue|navegar|leve(?:-me)?|me leve|acesse|acessar|abra a p[aá]gina|abrir a p[aá]gina)(?=\s|$)/i;

const STOP_PREFIX = /^(?:por favor[,]?|pf[,]?|por gentileza[,]?|pra mim|para mim)\s+/i;
const STOP_FILLERS = /\b(?:por favor|pra mim|para mim|agora|aqui|neste chat|no chat)\b/gi;

/** Extrai o "objeto" do pedido removendo o verbo e artigos iniciais. */
function extractObject(text: string, verbRe: RegExp): string {
  return text
    .replace(STOP_PREFIX, "")
    .replace(verbRe, " ")
    .replace(/^\s*(?:a|o|as|os|um|uma|de|da|do|das|dos|no|na|em)\s+/i, "")
    .replace(STOP_FILLERS, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Termo de busca: texto após "por/pelo/pela/sobre" se houver, senão o objeto. */
function extractTerm(obj: string): string {
  const m = obj.match(/(?:\bpor\b|\bpelo\b|\bpela\b|\bsobre\b|\bde\b)\s+(.+)$/i);
  const raw = (m ? m[1] : obj)
    .replace(/[."!?]+$/, "")
    .trim();
  return raw;
}

/** Resolve fontes Uni citadas no texto ("reddit e youtube", "fontes acadêmicas"). */
export function resolveUniSources(text: string): UniSourceId[] {
  const t = normText(text);
  const found = new Set<UniSourceId>();
  for (const src of PIPELINE_SOURCES) {
    const meta = UNI_SOURCE_META[src];
    const names = [src, meta?.label ?? ""];
    for (const n of names) {
      const nn = normText(n);
      if (nn && nn.length >= 3 && new RegExp(`\\b${nn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(t)) {
        found.add(src);
        break;
      }
    }
  }
  // Grupos semânticos
  if (/\bacademica?s?\b|\bartigos? cientificos?\b|\bpapers?\b/.test(t)) {
    (["arxiv", "semanticscholar", "openalex", "crossref"] as UniSourceId[]).forEach((s) => found.add(s));
  }
  if (/\bnoticias?\b|\bjornal\b/.test(t)) {
    (["gdelt", "hackernews"] as UniSourceId[]).forEach((s) => found.add(s));
  }
  if (/\bredes? sociais?\b|\bsocial\b/.test(t)) {
    (["reddit", "mastodon", "bluesky"] as UniSourceId[]).forEach((s) => found.add(s));
  }
  return [...found];
}

/** "todas as fontes" / "coleta máxima" detectados no texto. */
function wantsAllSources(text: string): boolean {
  return /\btodas? as fontes\b|\btodas? fontes\b|\bmultifonte\b|\bmulti-?fonte\b/i.test(text);
}
function wantsMax(text: string): boolean {
  return /\bm[aá]xim|\bmax\b|\bcomplet[ao]\b|\btudo que (houver|tiver|existir)\b|\bprofund[ao]\b/i.test(text);
}

/**
 * Seções de análise da IA (ids de EXPERIMENT_SECTIONS) com aliases PT-BR.
 * Mapa local para manter o módulo puro (sem importar o registry com ícones).
 */
const SECTION_ALIASES: Array<[id: string, re: RegExp]> = [
  ["summary", /\bresumo\b/],
  ["organize", /\borganiz/],
  ["quantitative", /\bquantitativ/],
  ["qualitative", /\bqualitativ/],
  ["problems", /\bproblemas?\b|\bbugs?\b|\bfalhas?\b/],
  ["requests", /\bsolicita|\bpedidos?\b/],
  ["suggestions", /\bsugest/],
  ["opportunities", /\boportunidades?\b/],
  ["evidence", /\bevid[êe]ncias?\b|\bprovas?\b/],
  ["strategy", /\bestrat[ée]g/],
  ["business", /\bneg[óo]cios?\b|\breceita\b/],
  ["roi", /\broi\b|\bretorno\b/],
];

/** Resolve uma seção de análise citada por nome ("análise de problemas"). */
export function resolveSectionId(text: string): string | null {
  const t = normText(text);
  for (const [id, re] of SECTION_ALIASES) if (re.test(t)) return id;
  return null;
}

/**
 * Resolve uma PÁGINA do sistema citada por path, número do menu, label ou
 * descrição (registry PAGES = fonte única de verdade). "dashboard",
 * "/configuracoes", "5", "chat com voz" → o path correspondente.
 */
export function resolvePagePath(text: string): { path: string; label: string } | null {
  const t = normText(text)
    .replace(/^(?:(?:a|o|as|os|de|da|do|para|pra|p[aá]gina|tela|de)\s+)+/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!t) return null;
  const byPath = PAGES.find((p) => normText(p.path) === `/${t}` || normText(p.path) === t);
  if (byPath) return { path: byPath.path, label: byPath.label };
  // Número do menu de páginas (a ordem do registry define a numeração).
  if (/^\d{1,2}$/.test(t)) {
    const byNum = PAGES[parseInt(t, 10) - 1];
    if (byNum) return { path: byNum.path, label: byNum.label };
  }
  const byLabel = PAGES.find((p) => normText(p.label) === t)
    ?? PAGES.find((p) => normText(p.label).includes(t) || t.includes(normText(p.label)))
    ?? PAGES.find((p) => p.desc && normText(p.desc).includes(t));
  return byLabel ? { path: byLabel.path, label: byLabel.label } : null;
}

/* ------------------------------------------------------------ parser ---- */

/**
 * Detecta a intenção da mensagem. Retorna null quando nada é reconhecido —
 * a superfície então cai no fluxo normal (IA ou mensagem de ajuda).
 */
export function detectChatIntent(input: string): ChatAction | null {
  const text = input.trim();
  if (!text) return null;

  if (HELP_WORDS.test(text)) return { kind: "help" };

  const isSearch = SEARCH_VERBS.test(text);
  const isCollect = COLLECT_APP_VERBS.test(text);
  const isReport = REPORT_NOUNS.test(text);
  const isShow = SHOW_VERBS.test(text);
  const isRun = RUN_VERBS.test(text);

  // Navegação: "vá para o dashboard", "ir para configurações", "acesse o
  // canvas", "abra a página de configurações". Verificado ANTES de show —
  // "abra a página de X" com verbo de navegação NAVEGA; "exiba a página de
  // pipeline" (verbo de exibição) continua mostrando o componente no chat.
  if (NAV_VERBS.test(text) && !isCollect && !isSearch) {
    const obj = extractObject(text, NAV_VERBS);
    const page = resolvePagePath(obj);
    if (page) return { kind: "goto", path: page.path, label: page.label };
  }

  // Executar pipeline/análise: "execute o pipeline", "rode a análise de
  // problemas", "rode as análises". Verificado ANTES de show/collect —
  // "execute a coleta" continua caindo em collect (verbo específico vence).
  if (isRun && (PIPELINE_NOUNS.test(text) || resolveSectionId(text)) && !isCollect && !isSearch) {
    return { kind: "run-pipeline", sectionId: resolveSectionId(text) };
  }

  // Seletor de fontes (coleta passo a passo configurada): "selecione as
  // fontes", "configure a coleta multifonte" → exibe o picker interativo.
  if (/\bselecione\b.*\bfontes?\b/i.test(text) || /\bconfigure\b.*\b(?:coleta|fontes?)\b/i.test(text)) {
    return { kind: "show", surfaceId: "uni-picker", label: "Seletor de fontes Uni" };
  }

  // Pesquisa multifonte: "pesquise X em todas as fontes", "busque X no reddit"
  if (isSearch || (isCollect && (wantsAllSources(text) || resolveUniSources(text).length > 0))) {
    const all = wantsAllSources(text);
    const sources = all ? [...PIPELINE_SOURCES] : resolveUniSources(text);
    if (all || sources.length > 0) {
      const objRaw = extractObject(text, isSearch ? SEARCH_VERBS : COLLECT_APP_VERBS);
      const obj = objRaw
        .replace(/\b(?:em|nas?|das?)\s+(?:todas? as )?fontes\b.*$/i, "")
        .replace(/\b(?:no|na|em|do|da)\s+[\w\s./()-]+$/i, (m) => {
          // remove a cauda de fontes ("no reddit e youtube") só se o resto não ficar vazio
          const head = objRaw.slice(0, objRaw.length - m.length).trim();
          return head.length >= 2 ? "" : m;
        });
      const term = extractTerm(obj);
      if (term) {
        return {
          kind: "collect-multi",
          term,
          sources: sources.length > 0 ? sources : [...PIPELINE_SOURCES],
          max: wantsMax(text) || all,
        };
      }
    }
  }

  // Exibir superfície: "exiba a página de pipeline", "mostre os gráficos".
  // Verificado ANTES de coleta/relatório: "abra a configuração de coleta" e
  // "exiba o componente de relatório…" são pedidos para MOSTRAR a superfície,
  // não para coletar/gerar.
  if (isShow) {
    const obj = extractObject(text, SHOW_VERBS);
    const surface = resolveSurface(obj);
    if (surface) return { kind: "show", surfaceId: surface.id, label: surface.label };
  }

  // Coleta de app: "colete nubank", "baixe o app do banco inter"
  if (isCollect) {
    const term = extractTerm(extractObject(text, COLLECT_APP_VERBS));
    if (term) return { kind: "collect-app", term };
  }

  // Relatório: "gere um relatório", "relatório do nubank"
  if (isReport || /\b(?:gere|gerar|monte|montar|produza|produzir|crie|criar)\b.*\brelat/i.test(text)) {
    const obj = extractObject(text, REPORT_NOUNS)
      .replace(/^(?:(?:gere|gerar|monte|montar|produza|produzir|crie|criar|um|uma|completo|completa|detalhado|detalhada|visual)\s*)+/i, "")
      .replace(/^(?:de|da|do|das|dos|sobre)\s+/i, "")
      .trim();
    const scope = obj && obj.length >= 2 ? obj : null;
    return { kind: "report", scope };
  }

  // Sem verbo, mas nomeou uma superfície diretamente: "página de pipeline"
  if (/^(?:a )?p[aá]gina|^(?:o )?componente|^(?:o )?painel/i.test(text)) {
    const surface = resolveSurface(text);
    if (surface) return { kind: "show", surfaceId: surface.id, label: surface.label };
  }

  return null;
}

/** Texto de ajuda (sem IA): o que o chat sabe fazer sozinho. */
export const CHAT_COMMANDS_HELP = `Posso agir mesmo sem IA. Exemplos do que você pode pedir:
• **Abrir página no chat**: "vá para o dashboard", "acesse o canvas", "abra a página de pipeline" — a página real abre DENTRO da conversa (interativa, sem sair do chat).
• **Exibir componentes**: "exiba a página de pipeline", "mostre os gráficos", "abra a configuração de coleta" — o componente real aparece aqui na conversa e você pode usá-lo normalmente.
• **Coletar apps**: "colete nubank" — busco nas duas lojas e coleciono reviews.
• **Pesquisa multifonte**: "pesquise bitcoin em todas as fontes" — coleto das fontes da Uni (web, notícias, acadêmico, redes…).
• **Executar pipeline**: "execute o pipeline" — computo os fatos e detecto anomalias do dataset (sem IA); "rode a análise de problemas" — roda uma seção de IA.
• **Relatório**: "gere um relatório" — consolido os dados coletados (sem IA, determinístico).
Com IA ativada, qualquer pergunta livre é respondida pela IA — e ela também pode exibir componentes na resposta.`;
