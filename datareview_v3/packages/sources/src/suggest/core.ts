/**
 * Suggest — núcleo puro do construtor de sondas de autocomplete.
 *
 * Referência: docs/suggest.md (script _uni.py) + briefing "Inventário máximo
 * dos recursos de Suggest / Autocomplete". O endpoint público do Google
 * (suggestqueries.google.com/complete/search) aceita:
 *   q  — consulta (termo, prefixo, frase, pergunta…)
 *   gl — região (br, us, fr…)
 *   hl — idioma (pt, en…)
 *   ds — vertical ("" web, "yt" YouTube, "n" News, "sh" Shopping)
 *   client — contexto do cliente (chrome, firefox)
 *
 * A estratégia de descoberta é um grafo de consultas: o termo base vira
 * N sondas (alfabeto, números, questões, intenções…) e cada sugestão é um
 * nó. Esta lib constrói as sondas e deriva estatísticas dos resultados —
 * tudo 100% determinístico (sem IA).
 */

// ---------- Parâmetros da fonte ----------

export type SuggestVertical = "web" | "youtube" | "news" | "shopping";

export interface SuggestOption<T extends string = string> {
  id: T;
  label: string;
}

export const VERTICALS: SuggestOption<SuggestVertical>[] = [
  { id: "web", label: "Web" },
  { id: "youtube", label: "YouTube" },
  { id: "news", label: "News" },
  { id: "shopping", label: "Shopping" },
];

/** Código `ds` do endpoint por vertical ("" = web). */
export const VERTICAL_DS: Record<SuggestVertical, string> = {
  web: "",
  youtube: "yt",
  news: "n",
  shopping: "sh",
};

export const REGIONS: SuggestOption[] = [
  { id: "br", label: "Brasil (br)" },
  { id: "us", label: "EUA (us)" },
  { id: "pt", label: "Portugal (pt)" },
  { id: "gb", label: "Reino Unido (gb)" },
  { id: "fr", label: "França (fr)" },
  { id: "de", label: "Alemanha (de)" },
  { id: "jp", label: "Japão (jp)" },
  { id: "es", label: "Espanha (es)" },
  { id: "mx", label: "México (mx)" },
  { id: "ar", label: "Argentina (ar)" },
  { id: "ca", label: "Canadá (ca)" },
  { id: "it", label: "Itália (it)" },
];

export const LANGS: SuggestOption[] = [
  { id: "", label: "Auto" },
  { id: "pt", label: "Português (pt)" },
  { id: "en", label: "Inglês (en)" },
  { id: "es", label: "Espanhol (es)" },
  { id: "fr", label: "Francês (fr)" },
  { id: "de", label: "Alemão (de)" },
  { id: "ja", label: "Japonês (ja)" },
];

export const CLIENTS: SuggestOption[] = [
  { id: "chrome", label: "Chrome" },
  { id: "firefox", label: "Firefox" },
];

// ---------- Grupos de expansão ----------

/** Como a variação combina com o termo base. */
export type SeedPosition = "suffix" | "prefix" | "infix";

export interface ExpansionGroup {
  id: string;
  label: string;
  desc: string;
  position: SeedPosition;
  /** palavras/frases da variação. */
  words: string[];
}

const ALPHA = "abcdefghijklmnopqrstuvwxyz".split("");
const DIGITS = "0123456789".split("");

/**
 * Catálogo maximalista de grupos de expansão. As categorias de palavras vêm
 * de docs/suggest.md (grupo "Outros" + categorias comentadas do script
 * original), estendidas com as estratégias do briefing (interrogativas,
 * intenções, comparativos, temporais).
 */
export const EXPANSION_GROUPS: ExpansionGroup[] = [
  {
    id: "alphabet",
    label: "Alfabeto (a–z)",
    desc: "termo + letra — descobre ramos que não aparecem no termo puro",
    position: "suffix",
    words: ALPHA,
  },
  {
    id: "numbers",
    label: "Números (0–9)",
    desc: "termo + dígito — versões, anos, modelos, listas",
    position: "suffix",
    words: DIGITS,
  },
  {
    id: "alphabet-prefix",
    label: "Alfabeto invertido",
    desc: "letra + termo — sugestões que só aparecem no começo da frase",
    position: "prefix",
    words: ALPHA,
  },
  {
    id: "questions",
    label: "Questões",
    desc: "o que/é/como/quem/por que/onde/quando/qual/quanto",
    position: "suffix",
    words: [
      "o que", "é", "não é", "são", "não são", "como", "quem",
      "por que", "onde", "quando", "qual", "quanto",
    ],
  },
  {
    id: "interrogative-prefix",
    label: "Interrogativas (prefixo)",
    desc: "como/o que é/onde/quando/por que/qual + termo",
    position: "prefix",
    words: ["como", "o que é", "onde", "quando", "por que", "qual", "quem", "quanto"],
  },
  {
    id: "prepositions",
    label: "Preposições",
    desc: "de/para/com/sem/sobre/contra/até/tipo",
    position: "suffix",
    words: ["de", "para", "com", "sem", "sobre", "contra", "até", "tipo"],
  },
  {
    id: "comparisons",
    label: "Comparações",
    desc: "e/ou/vs/melhor/pior/alternativa/comparação",
    position: "suffix",
    words: ["e", "ou", "vs", "melhor", "pior", "melhor que", "pior que", "alternativa", "comparação"],
  },
  {
    id: "verbs",
    label: "Verbos",
    desc: "comprar/vender/usar/criar/fazer/ganhar/perder/baixar/aprender",
    position: "suffix",
    words: ["comprar", "vender", "usar", "criar", "fazer", "ganhar", "perder", "baixar", "aprender"],
  },
  {
    id: "adjectives",
    label: "Adjetivos",
    desc: "bom/ruim/seguro/caro/barato/fácil/difícil/grátis",
    position: "suffix",
    words: ["bom", "ruim", "seguro", "caro", "barato", "fácil", "difícil", "grátis"],
  },
  {
    id: "problems",
    label: "Problemas",
    desc: "erro/bug/travado/golpe/fraude/scam/não funciona",
    position: "suffix",
    words: ["erro", "bug", "travado", "golpe", "fraude", "scam", "não funciona", "problema"],
  },
  {
    id: "tutorials",
    label: "Tutoriais",
    desc: "tutorial/aula/dicas/iniciante/passo a passo/guia/manual/curso",
    position: "suffix",
    words: ["tutorial", "aula", "dicas", "iniciante", "passo a passo", "guia", "manual", "curso"],
  },
  {
    id: "intents",
    label: "Intenções",
    desc: "preço/custo/valor/download/review/avaliação/notícias/perto",
    position: "suffix",
    words: ["preço", "custo", "valor", "download", "review", "avaliação", "notícias", "perto de mim"],
  },
  {
    id: "temporal",
    label: "Temporais",
    desc: "hoje/agora/novo/2025/2026 — termos com recorte de tempo",
    position: "suffix",
    words: ["hoje", "agora", "novo", "2025", "2026"],
  },
];

export const MAX_SEEDS = 400;

// ---------- Sondas ----------

/** Uma sonda = 1 consulta concreta enviada à fonte. */
export interface SuggestSeed {
  /** consulta enviada (ex.: "python tutorial"). */
  seed: string;
  /** id do grupo que gerou a sonda ("base", "alphabet", …). */
  group: string;
  /** label do grupo (para exibição). */
  groupLabel: string;
  /** variação aplicada (ex.: "a", "tutorial") — "" na base. */
  variation: string;
  position: SeedPosition | "base";
}

function joinSeed(term: string, word: string, position: SeedPosition): string {
  if (position === "prefix") return `${word} ${term}`;
  if (position === "infix") return `${term.slice(0, -1)}${word}${term.slice(-1)}`;
  return `${term} ${word}`;
}

/**
 * Constrói as sondas de um termo: sempre inclui a consulta BASE primeiro,
 * depois uma por grupo selecionado (dedup de consultas idênticas, teto
 * MAX_SEEDS). Orçamento controlado — nenhum grupo explode o espaço.
 */
export function buildSeeds(
  term: string,
  groups: ExpansionGroup[] = EXPANSION_GROUPS,
  maxSeeds: number = MAX_SEEDS,
): SuggestSeed[] {
  const t = term.trim();
  if (!t) return [];
  const base: SuggestSeed = {
    seed: t,
    group: "base",
    groupLabel: "Base",
    variation: "",
    position: "base",
  };
  const seen = new Set([base.seed.toLowerCase()]);
  const out: SuggestSeed[] = [base];
  for (const group of groups) {
    for (const word of group.words) {
      const seed = joinSeed(t, word.trim(), group.position);
      const key = seed.toLowerCase();
      if (seen.has(key) || out.length >= maxSeeds) continue;
      seen.add(key);
      out.push({ seed, group: group.id, groupLabel: group.label, variation: word, position: group.position });
    }
  }
  return out;
}

/** Contagem de sondas por grupo selecionado (para UI de orçamento). */
export function seedBudget(term: string, groupIds: string[]): number {
  const groups = EXPANSION_GROUPS.filter((g) => groupIds.includes(g.id));
  return buildSeeds(term, groups).length;
}

// ---------- Análise determinística dos resultados ----------

/** Item bruto de uma coleta (o servidor retorna text/relevance/seed/query). */
export interface RawSuggestItem {
  text: string;
  relevance: number;
  seed?: string;
  query?: string;
}

/** Linha agregada por sugestão única após merge das combos. */
export interface SuggestRow {
  text: string;
  /** melhor relevância observada (a fonte retorna 0–~1000). */
  relevance: number;
  /** de quantas sondas distintas a sugestão saiu (recorrência). */
  occurrences: number;
  /** grupos de expansão que a descobriram. */
  groups: string[];
  /** sondas (consultas) que a geraram. */
  seeds: string[];
  /** verticais onde apareceu (web/youtube/news/shopping). */
  verticals: string[];
  /** regiões onde apareceu. */
  regions: string[];
}

export interface GatherObservation {
  item: RawSuggestItem;
  seed: string;
  group: string;
  groupLabel: string;
  region: string;
  vertical: string;
}

/**
 * Merge determinístico das observações: dedup por texto (case-insensitive),
 * guardando a MELHOR relevância e acumulando proveniência (sondas, grupos,
 * verticais, regiões). Ordenado por relevância desc, depois recorrência.
 */
export function mergeObservations(observations: GatherObservation[]): SuggestRow[] {
  const map = new Map<string, SuggestRow>();
  for (const obs of observations) {
    const key = obs.item.text.trim().toLowerCase();
    if (!key) continue;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, {
        text: obs.item.text.trim(),
        relevance: obs.item.relevance || 0,
        occurrences: 1,
        groups: [obs.group],
        seeds: [obs.seed],
        verticals: obs.vertical ? [obs.vertical] : [],
        regions: obs.region ? [obs.region] : [],
      });
      continue;
    }
    prev.occurrences += 1;
    if (obs.item.relevance > prev.relevance) prev.relevance = obs.item.relevance;
    if (!prev.groups.includes(obs.group)) prev.groups.push(obs.group);
    if (!prev.seeds.includes(obs.seed)) prev.seeds.push(obs.seed);
    if (obs.vertical && !prev.verticals.includes(obs.vertical)) prev.verticals.push(obs.vertical);
    if (obs.region && !prev.regions.includes(obs.region)) prev.regions.push(obs.region);
  }
  return [...map.values()].sort(
    (a, b) => b.relevance - a.relevance || b.occurrences - a.occurrences,
  );
}

/** Frequência de termos nas sugestões (wordcloud determinística, PT stopwords). */
const STOPWORDS = new Set([
  "de", "da", "do", "para", "com", "sem", "em", "no", "na", "e", "ou", "a", "o",
  "que", "como", "é", "são", "um", "uma", "por", "ao", "à", "dos", "das", "the",
  "and", "of", "in", "to", "for", "on", "se", "os", "as",
]);

export interface TokenFreq {
  text: string;
  value: number;
}

export function suggestionTokens(rows: SuggestRow[], limit = 40): TokenFreq[] {
  const freq = new Map<string, number>();
  for (const row of rows) {
    for (const token of row.text.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
      if (!token || token.length < 3 || STOPWORDS.has(token) || /^\d+$/.test(token)) continue;
      freq.set(token, (freq.get(token) ?? 0) + 1);
    }
  }
  return [...freq.entries()]
    .map(([text, value]) => ({ text, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

/** Estatísticas por grupo de expansão (orçamento vs rendimento). */
export interface GroupStat {
  group: string;
  label: string;
  seeds: number;
  unique: number;
  observations: number;
}

export function groupStats(observations: GatherObservation[]): GroupStat[] {
  const byGroup = new Map<string, { label: string; seeds: Set<string>; uniques: Set<string>; observations: number }>();
  for (const obs of observations) {
    const g = byGroup.get(obs.group) ?? {
      label: obs.groupLabel,
      seeds: new Set<string>(),
      uniques: new Set<string>(),
      observations: 0,
    };
    g.seeds.add(obs.seed);
    g.uniques.add(obs.item.text.trim().toLowerCase());
    g.observations += 1;
    byGroup.set(obs.group, g);
  }
  return [...byGroup.entries()]
    .map(([group, g]) => ({
      group,
      label: g.label,
      seeds: g.seeds.size,
      unique: g.uniques.size,
      observations: g.observations,
    }))
    .sort((a, b) => b.unique - a.unique);
}

/** Matriz de sobreposição entre verticais (exclusivas × compartilhadas). */
export interface VerticalOverlap {
  vertical: string;
  unique: number;
  shared: number;
  exclusive: number;
}

export function verticalOverlap(rows: SuggestRow[]): VerticalOverlap[] {
  const verticals = [...new Set(rows.flatMap((r) => r.verticals))];
  return verticals.map((v) => {
    const inV = rows.filter((r) => r.verticals.includes(v));
    return {
      vertical: v,
      unique: inV.length,
      shared: inV.filter((r) => r.verticals.length > 1).length,
      exclusive: inV.filter((r) => r.verticals.length === 1).length,
    };
  });
}

/** Sugestões recorrentes: presentes em ≥ minOccurrences sondas. */
export function recurring(rows: SuggestRow[], minOccurrences = 3): SuggestRow[] {
  return rows.filter((r) => r.occurrences >= minOccurrences);
}

/** Exportação markdown das linhas agregadas. */
export function rowsToMarkdown(term: string, rows: SuggestRow[]): string {
  const lines = [
    `# Suggest — ${term}`,
    "",
    `${rows.length} sugestões únicas (merge de expansões).`,
    "",
    "| # | Sugestão | Relevância | Recorrência | Grupos | Verticais |",
    "| - | - | - | - | - | - |",
  ];
  rows.forEach((r, i) => {
    lines.push(
      `| ${i + 1} | ${r.text} | ${r.relevance} | ${r.occurrences} | ${r.groups.join(", ")} | ${r.verticals.join(", ")} |`,
    );
  });
  return lines.join("\n");
}
