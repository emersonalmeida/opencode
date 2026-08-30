/**
 * Gera public/demo-sources.json com dados REAIS coletados pelas fontes
 * (para o modo Demo da página /testes-fontes). Requer o servidor local
 * online (npm run dev:server) — sem ele, o erro é honesto e não gera nada.
 *
 * Como o runner usa os fetchers client-side no navegador, mas o script roda
 * em Node, o coletor aqui chama as rotas diretamente (as MESMAS que as
 * páginas usam — nada é fabricado: o demo é uma fotografia do que o
 * sistema coletou de verdade).
 */
import { writeFileSync } from "node:fs";

const BASE = process.env.DEMO_BASE ?? "http://localhost:8787";
const TERM = process.argv[2] ?? "bitcoin";
const LIMIT = Number(process.argv[3] ?? 8);

const ROUTES: Record<string, string> = {
  suggest: "uni-suggest",
  serp: "uni-serp",
  youtube: "uni-youtube",
  reddit: "uni-reddit",
  wikipedia: "wikipedia",
  hackernews: "uni-hackernews",
  gdelt: "uni-gdelt",
  arxiv: "uni-arxiv",
  stackexchange: "uni-stackexchange",
  github: "uni-github",
  semanticscholar: "uni-semanticscholar",
  steam: "uni-steam",
  producthunt: "uni-producthunt",
};

/** Chave da resposta por rota (diferentes rotas devolvem formatos próprios). */
const EXTRACT: Record<string, (d: Record<string, unknown>) => unknown[]> = {
  suggest: (d) => (d.items as unknown[]) ?? [],
  serp: (d) => (d.items as unknown[]) ?? [],
  youtube: (d) => (d.videos as unknown[]) ?? [],
  reddit: (d) => (d.posts as unknown[]) ?? [],
  wikipedia: (d) => (d.results as unknown[]) ?? [],
  hackernews: (d) => (d.stories as unknown[]) ?? [],
  gdelt: (d) => (d.items as unknown[]) ?? [],
  arxiv: (d) => (d.papers as unknown[]) ?? [],
  stackexchange: (d) => (d.questions as unknown[]) ?? [],
  github: (d) => (d.repos as unknown[]) ?? [],
  semanticscholar: (d) => (d.items as unknown[]) ?? [],
  steam: (d) => (d.games as unknown[]) ?? [],
  producthunt: (d) => (d.posts as unknown[]) ?? [],
};

async function post(route: string, body: Record<string, unknown>, source: string): Promise<unknown[]> {
  try {
    const resp = await fetch(`${BASE}/functions/v1/${route}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25_000),
    });
    if (!resp.ok) { console.log(`[freeze] ${source}: HTTP ${resp.status}`); return []; }
    const data = (await resp.json()) as Record<string, unknown>;
    const pick = EXTRACT[source];
    const items = pick ? pick(data) : ((data.items as unknown[]) ?? []);
    if (!items.length) console.log(`[freeze] ${source}: 0 itens (resposta sem a chave)`);
    return items;
  } catch (e) {
    console.log(`[freeze] ${source}: ${String((e as Error)?.message ?? e)}`);
    return [];
  }
}

/** Body específico por fonte (cada rota tem ação própria — como nas páginas). */
function bodyFor(source: string): Record<string, unknown> {
  switch (source) {
    case "suggest": return { action: "suggest", query: TERM, limit: LIMIT };
    case "trends": return { action: "explore", terms: [TERM], region: "BR", lang: "pt-BR" };
    case "serp": return { action: "search", query: TERM, limit: LIMIT };
    case "youtube": return { action: "videos", query: TERM, limit: LIMIT };
    case "reddit": return { action: "posts", query: TERM, limit: LIMIT };
    case "producthunt": return { action: "posts", topic: TERM, limit: LIMIT };
    case "hackernews": return { action: "search", query: TERM, limit: LIMIT };
    case "gdelt": return { action: "search", query: TERM, limit: LIMIT };
    case "arxiv": return { action: "search", query: TERM, limit: LIMIT };
    case "stackexchange": return { action: "search", query: TERM, site: "stackoverflow", limit: LIMIT };
    case "github": return { action: "repos", query: TERM, sort: "stars", limit: LIMIT };
    case "semanticscholar": return { action: "search", query: TERM, limit: LIMIT };
    case "steam": return { action: "search", query: TERM, limit: LIMIT };
    case "wikipedia": return { action: "search", query: TERM, limit: LIMIT };
    default: return { action: "search", query: TERM, limit: LIMIT };
  }
}

const out: Record<string, unknown[]> = {};
let ok = 0;
for (const [source, route] of Object.entries(ROUTES)) {
  const items = await post(route, bodyFor(source), source);
  if (items.length) { out[source] = items; ok++; }
  console.log(`[demo-freeze] ${source}: ${items.length} itens`);
}

if (!ok) {
  console.error(`Nenhuma fonte respondeu — o servidor local está online? (${BASE}/health)`);
  process.exit(1);
}

const snapshot = { capturedAt: Date.now(), term: TERM, sources: out };
writeFileSync("public/demo-sources.json", JSON.stringify(snapshot, null, 1));
console.log(`OK: public/demo-sources.json com ${ok} fontes (${TERM})`);
