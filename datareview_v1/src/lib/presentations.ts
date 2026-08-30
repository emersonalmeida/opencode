/**
 * Apresentações (`/apresentacoes`) — modelo de deck, store e exportadores.
 *
 * Um deck é uma sequência de slides tipados, gerados deterministicamente a
 * partir do dataset (sem IA) ou via IA (markdown → slides). Temas controlam
 * aparência; export HTML gera um arquivo autocontido apresentável offline.
 */
import type { DatasetEntry } from "@/lib/datasetStore";
import type { ReviewEntry } from "@/lib/appStoreApi";
import {
  computeKPIs, computeRatingDistribution, computeSentiment,
  computePerAppStats, computeWordCloud, computeStoreComparison, entryKey,
} from "@/lib/dashboardAnalytics";

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type SlideType =
  | "title"      // capa: título + subtítulo
  | "section"    // divisor de seção
  | "bullets"    // lista de pontos (markdown por linha)
  | "kpis"       // grade de métricas determinísticas
  | "chart"      // gráfico do dataset (rating/sentiment/store/wordcloud)
  | "quotes"     // citações reais de reviews
  | "table"      // tabela por app
  | "text";      // bloco markdown livre

export interface Slide {
  id: string;
  type: SlideType;
  title: string;
  subtitle?: string;
  /** bullets: linhas; text: markdown; quotes: ids são resolvidos na render. */
  body?: string;
  /** chart: tipo do gráfico. */
  chart?: "rating" | "sentiment" | "store" | "wordcloud";
  /** Escopo do slide: vazio = dataset inteiro; senão appKeys `${store}:${id}`. */
  appKeys?: string[];
  notes?: string; // notas do apresentador
}

export type DeckThemeId =
  | "midnight" | "paper" | "ocean" | "forest" | "sunset" | "mono";

export interface DeckTheme {
  id: DeckThemeId;
  label: string;
  bg: string;         // fundo do slide
  fg: string;         // texto principal
  accent: string;     // destaques/títulos
  muted: string;      // texto secundário
  fontScale: number;  // 0.8–1.4
}

export const DECK_THEMES: DeckTheme[] = [
  { id: "midnight", label: "Meia-noite", bg: "#0b1020", fg: "#e6e9f2", accent: "#6ea8fe", muted: "#93a0bd", fontScale: 1 },
  { id: "paper", label: "Papel", bg: "#faf7f2", fg: "#1d1a16", accent: "#b45309", muted: "#6b6355", fontScale: 1 },
  { id: "ocean", label: "Oceano", bg: "#06232b", fg: "#e0f4f6", accent: "#22d3ee", muted: "#8fb8bf", fontScale: 1 },
  { id: "forest", label: "Floresta", bg: "#0d1f14", fg: "#e2f2e7", accent: "#4ade80", muted: "#8fb99c", fontScale: 1 },
  { id: "sunset", label: "Pôr do sol", bg: "#241019", fg: "#fde9ee", accent: "#fb7185", muted: "#c99bab", fontScale: 1 },
  { id: "mono", label: "Mono", bg: "#101010", fg: "#f0f0f0", accent: "#f0f0f0", muted: "#9a9a9a", fontScale: 1 },
];

export function getTheme(id: DeckThemeId): DeckTheme {
  return DECK_THEMES.find((t) => t.id === id) ?? DECK_THEMES[0];
}

export interface Deck {
  id: string;
  title: string;
  theme: DeckThemeId;
  slides: Slide[];
  createdAt: number;
  updatedAt: number;
}

export type Aspect = "16:9" | "4:3";
export const ASPECTS: Aspect[] = ["16:9", "4:3"];

// ─── Store (localStorage + pub/sub) ─────────────────────────────────────────

const KEY = "aso:presentations:v1";
type Listener = () => void;
const listeners = new Set<Listener>();

function notify() { listeners.forEach((l) => l()); }

export function subscribePresentations(l: Listener) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function listDecks(): Deck[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]") as Deck[];
    return raw.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function getDeck(id: string): Deck | undefined {
  return listDecks().find((d) => d.id === id);
}

export function saveDeck(deck: Deck) {
  try {
    const all = listDecks().filter((d) => d.id !== deck.id);
    all.unshift({ ...deck, updatedAt: Date.now() });
    localStorage.setItem(KEY, JSON.stringify(all.slice(0, 30)));
  } catch { /* storage cheio — ignora */ }
  notify();
}

export function deleteDeck(id: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify(listDecks().filter((d) => d.id !== id)));
  } catch { /* ignore */ }
  notify();
}

export function genSlideId(): string {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function newDeck(title = "Apresentação sem título"): Deck {
  const now = Date.now();
  return {
    id: `deck_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    title,
    theme: "midnight",
    createdAt: now,
    updatedAt: now,
    slides: [{ id: genSlideId(), type: "title", title, subtitle: "" }],
  };
}

// ─── Operações de slide (puras) ─────────────────────────────────────────────

export function addSlide(deck: Deck, slide: Omit<Slide, "id">, index?: number): Deck {
  const s: Slide = { ...slide, id: genSlideId() };
  const slides = [...deck.slides];
  slides.splice(index ?? slides.length, 0, s);
  return { ...deck, slides };
}

export function updateSlide(deck: Deck, id: string, patch: Partial<Slide>): Deck {
  return { ...deck, slides: deck.slides.map((s) => (s.id === id ? { ...s, ...patch } : s)) };
}

export function removeSlide(deck: Deck, id: string): Deck {
  return { ...deck, slides: deck.slides.filter((s) => s.id !== id) };
}

export function duplicateSlide(deck: Deck, id: string): Deck {
  const i = deck.slides.findIndex((s) => s.id === id);
  if (i < 0) return deck;
  const copy: Slide = { ...deck.slides[i], id: genSlideId() };
  const slides = [...deck.slides];
  slides.splice(i + 1, 0, copy);
  return { ...deck, slides };
}

export function moveSlide(deck: Deck, id: string, dir: -1 | 1): Deck {
  const i = deck.slides.findIndex((s) => s.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= deck.slides.length) return deck;
  const slides = [...deck.slides];
  [slides[i], slides[j]] = [slides[j], slides[i]];
  return { ...deck, slides };
}

// ─── Construtor determinístico (dataset → deck) ─────────────────────────────

function scopeEntries(entries: DatasetEntry[], appKeys?: string[]): DatasetEntry[] {
  if (!appKeys?.length) return entries;
  const set = new Set(appKeys);
  return entries.filter((e) => set.has(entryKey(e.app.store, e.app.id)));
}

function scopeReviews(entries: DatasetEntry[], appKeys?: string[]): ReviewEntry[] {
  return scopeEntries(entries, appKeys).flatMap((e) => e.reviews);
}

/** Constrói um deck executivo completo a partir do dataset — sem IA. */
export function buildDatasetDeck(entries: DatasetEntry[], title = "Análise de reviews"): Deck {
  const allReviews = entries.flatMap((e) => e.reviews);
  const kpis = computeKPIs(allReviews, entries);
  const stats = computePerAppStats(entries);
  const words = computeWordCloud(allReviews, 12);
  const deck = newDeck(title);
  deck.slides = [];

  deck.slides.push({
    id: genSlideId(), type: "title", title,
    subtitle: `${entries.length} app(s) · ${allReviews.length.toLocaleString("pt-BR")} reviews coletados`,
  });
  deck.slides.push({ id: genSlideId(), type: "section", title: "Panorama" });
  deck.slides.push({
    id: genSlideId(), type: "kpis", title: "Números-chave",
    body: `apps:${kpis.totalApps}|reviews:${kpis.totalReviews}|nota:${kpis.avgRating.toFixed(2)}|positivo:${kpis.positivePct}%|negativo:${kpis.negativePct}%`,
  });
  deck.slides.push({ id: genSlideId(), type: "chart", chart: "rating", title: "Distribuição de notas" });
  deck.slides.push({ id: genSlideId(), type: "chart", chart: "sentiment", title: "Sentimento dos usuários" });
  if (stats.length > 1) {
    deck.slides.push({ id: genSlideId(), type: "chart", chart: "store", title: "Cobertura por loja" });
    deck.slides.push({ id: genSlideId(), type: "table", title: "Comparativo por app" });
  }
  const topQuotes = [...allReviews].sort((a, b) => (b.thumbsUp ?? 0) - (a.thumbsUp ?? 0)).slice(0, 3);
  if (topQuotes.length > 0) {
    deck.slides.push({
      id: genSlideId(), type: "quotes", title: "A voz do usuário",
      body: topQuotes.map((q) => `"${q.text.slice(0, 220)}" — ${q.author} (★${q.rating})`).join("\n"),
    });
  }
  if (words.length > 0) {
    deck.slides.push({
      id: genSlideId(), type: "bullets", title: "Temas mais mencionados",
      body: words.slice(0, 8).map(([word, count]) => `${word} (${count}×)`).join("\n"),
    });
  }
  deck.slides.push({ id: genSlideId(), type: "section", title: "Obrigado!", subtitle: "Gerado pelo App Intelligence" });
  return deck;
}

// ─── IA → slides (markdown com separadores ---) ─────────────────────────────

/**
 * Converte markdown da IA em slides de bullets/text. Regra: cada bloco
 * separado por linha `---` vira um slide; a 1ª linha `##`/`#` vira título.
 * Retorna [] quando o texto não contém blocos utilizáveis.
 */
export function markdownToSlides(markdown: string): Slide[] {
  const blocks = markdown
    .split(/\r?\n\s*-{3,}\s*(?=\r?\n|$)/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0 && !/^-{3,}$/.test(b));
  const slides: Slide[] = [];
  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;
    const head = lines[0].replace(/^#{1,4}\s*/, "");
    const rest = lines.slice(1).join("\n");
    const isBullets = rest.split("\n").every((l) => /^[-*•]/.test(l) || l.length === 0) && rest.length > 0;
    slides.push({
      id: genSlideId(),
      type: isBullets ? "bullets" : "text",
      title: head.slice(0, 90),
      body: isBullets ? rest.replace(/^[-*•]\s*/gm, "") : rest,
    });
  }
  return slides;
}

/** Prompt usado para gerar a narrativa da apresentação via IA. */
export function buildDeckPrompt(entries: DatasetEntry[], topic: string): string {
  const names = entries.map((e) => e.app.name).join(", ");
  return [
    `Monte os slides de uma apresentação profissional sobre: ${topic || `análise de reviews de ${names}`}.`,
    "",
    "Formato EXIGIDO (a saída será convertida em slides):",
    "- Separe CADA slide com uma linha contendo apenas ---",
    "- Primeira linha de cada bloco: `## Título do slide`",
    "- Conteúdo: bullets curtos (máx 6 por slide, máx 12 palavras cada)",
    "- 8 a 12 slides: abertura → contexto → dados → sentimento → problemas →",
    "  oportunidades → evidências (cite 1-2 reviews reais por slide quando fizer sentido) → recomendações → fechamento",
    "- Sem tabelas, sem imagens, sem código. Apenas texto em markdown.",
  ].join("\n");
}

// ─── Exportadores ────────────────────────────────────────────────────────────

export function deckToMarkdown(deck: Deck): string {
  const parts: string[] = [`# ${deck.title}`, ""];
  for (const s of deck.slides) {
    parts.push(`## ${s.title}`);
    if (s.subtitle) parts.push(`_${s.subtitle}_`);
    if (s.body) parts.push(s.body);
    if (s.type === "chart") parts.push(`[gráfico: ${s.chart}]`);
    if (s.type === "kpis") parts.push(`[KPIs]`);
    if (s.type === "table") parts.push(`[tabela por app]`);
    if (s.notes) parts.push(`> Notas: ${s.notes}`);
    parts.push("", "---", "");
  }
  return parts.join("\n");
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Export HTML autocontido (sem JS externo): navegação por clique/teclado. */
export function deckToHTML(deck: Deck, entries: DatasetEntry[]): string {
  const theme = getTheme(deck.theme);
  const slidesHtml = deck.slides.map((s, i) => {
    let inner = "";
    if (s.type === "title" || s.type === "section") {
      inner = `<h1>${esc(s.title)}</h1>${s.subtitle ? `<p class="sub">${esc(s.subtitle)}</p>` : ""}`;
    } else if (s.type === "bullets") {
      inner = `<h2>${esc(s.title)}</h2><ul>${(s.body ?? "").split("\n").filter(Boolean).map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`;
    } else if (s.type === "text") {
      inner = `<h2>${esc(s.title)}</h2><p class="body">${esc(s.body ?? "")}</p>`;
    } else if (s.type === "quotes") {
      inner = `<h2>${esc(s.title)}</h2>${(s.body ?? "").split("\n").filter(Boolean).map((q) => `<blockquote>${esc(q)}</blockquote>`).join("")}`;
    } else if (s.type === "kpis") {
      const parts = Object.fromEntries((s.body ?? "").split("|").map((kv) => kv.split(":") as [string, string]));
      inner = `<h2>${esc(s.title)}</h2><div class="kpis">${Object.entries(parts)
        .map(([k, v]) => `<div class="kpi"><span class="kv">${esc(v ?? "")}</span><span class="kl">${esc(k)}</span></div>`).join("")}</div>`;
    } else if (s.type === "chart") {
      const rev = scopeReviews(entries, s.appKeys);
      if (s.chart === "rating") {
        const dist = computeRatingDistribution(rev);
        const maxC = Math.max(1, ...dist.map((d) => d.count));
        inner = `<h2>${esc(s.title)}</h2><div class="bars">${dist.map((d) => `<div class="bar-row"><span>${esc(d.star)}</span><div class="bar" style="width:${Math.round((d.count / maxC) * 100)}%"></div><span>${d.count}</span></div>`).join("")}</div>`;
      } else if (s.chart === "sentiment") {
        const sent = computeSentiment(rev);
        const total = Math.max(1, sent.reduce((a, b) => a + b.value, 0));
        inner = `<h2>${esc(s.title)}</h2><div class="bars">${sent.map((d) => `<div class="bar-row"><span>${esc(d.name)}</span><div class="bar" style="width:${Math.round((d.value / total) * 100)}%"></div><span>${d.value}</span></div>`).join("")}</div>`;
      } else if (s.chart === "store") {
        const cmp = computeStoreComparison(entries);
        const maxC = Math.max(1, ...cmp.map((c) => c.reviews));
        inner = `<h2>${esc(s.title)}</h2><div class="bars">${cmp.map((c) => `<div class="bar-row"><span>${esc(c.store)}</span><div class="bar" style="width:${Math.round((c.reviews / maxC) * 100)}%"></div><span>${c.reviews}</span></div>`).join("")}</div>`;
      } else if (s.chart === "wordcloud") {
        const words = computeWordCloud(rev, 24);
        inner = `<h2>${esc(s.title)}</h2><div class="cloud">${words.map(([word, count]) => `<span class="w" style="font-size:${Math.round(12 + Math.log2(count + 1) * 5)}px">${esc(word)}</span>`).join("")}</div>`;
      }
    } else if (s.type === "table") {
      const stats = computePerAppStats(scopeEntries(entries, s.appKeys));
      inner = `<h2>${esc(s.title)}</h2><table><tr><th>App</th><th>Reviews</th><th>Nota</th><th>% Positivo</th><th>% Negativo</th></tr>${stats
        .map((st) => `<tr><td>${esc(st.name)}</td><td>${st.reviewCount}</td><td>${st.avgCollected.toFixed(2)}</td><td>${st.positivePct}%</td><td>${st.negativePct}%</td></tr>`).join("")}</table>`;
    }
    return `<section class="slide" data-i="${i}"${i > 0 ? ' hidden' : ""}><div class="num">${i + 1}/${deck.slides.length}</div>${inner}</section>`;
  }).join("\n");

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(deck.title)}</title><style>
*{box-sizing:border-box;margin:0}html,body{height:100%}body{font-family:Inter,system-ui,sans-serif;background:#000}
.slide{width:100vw;height:100vh;display:flex;flex-direction:column;justify-content:center;padding:8vh 10vw;background:${theme.bg};color:${theme.fg};font-size:${theme.fontScale}rem}
.slide[hidden]{display:none}.slide h1{font-size:3.4em;color:${theme.accent};line-height:1.1}
.slide h2{font-size:2.2em;color:${theme.accent};margin-bottom:.6em}.slide .sub{font-size:1.3em;color:${theme.muted};margin-top:.8em}
.slide ul{font-size:1.35em;line-height:1.7;padding-left:1.2em}.slide li{margin:.3em 0}
.slide .body{font-size:1.2em;line-height:1.7;white-space:pre-wrap}
.slide blockquote{font-size:1.15em;line-height:1.6;border-left:4px solid ${theme.accent};padding:.4em 1em;margin:.7em 0;color:${theme.fg}}
.num{position:absolute;top:3vh;right:4vw;color:${theme.muted};font-size:.9em}
.kpis{display:flex;flex-wrap:wrap;gap:1.2em;margin-top:1em}.kpi{display:flex;flex-direction:column;min-width:6em}
.kv{font-size:2.6em;font-weight:800;color:${theme.accent}}.kl{color:${theme.muted};text-transform:uppercase;font-size:.8em;letter-spacing:.08em}
.bars{margin-top:1em}.bar-row{display:flex;align-items:center;gap:.8em;margin:.5em 0;font-size:1.05em}
.bar-row span:first-child{width:7em;text-align:right;color:${theme.muted}}.bar{height:1.4em;background:${theme.accent};border-radius:4px;min-width:2px}
table{border-collapse:collapse;font-size:1.1em;margin-top:.6em}td,th{border:1px solid ${theme.muted};padding:.45em .9em;text-align:left}
th{color:${theme.accent}}.cloud{display:flex;flex-wrap:wrap;gap:.6em;align-items:center;margin-top:1em}.cloud .w{color:${theme.fg}}
</style></head><body>
${slidesHtml}
<script>
(function(){var i=0;var slides=[].slice.call(document.querySelectorAll(".slide"));
function show(n){i=Math.max(0,Math.min(slides.length-1,n));slides.forEach(function(s,k){s.hidden=k!==i});}
document.addEventListener("keydown",function(e){if(e.key==="ArrowRight"||e.key===" "||e.key==="PageDown")show(i+1);
if(e.key==="ArrowLeft"||e.key==="PageUp")show(i-1);if(e.key==="Home")show(0);if(e.key==="End")show(slides.length-1);});
document.addEventListener("click",function(){show(i+1)});})();
</script></body></html>`;
}
