/**
 * auditProbes — sonda de descoberta (baseline) por fonte. Cada sonda é a
 * chamada MÍNIMA para validar a rota da fonte end-to-end (status success/
 * blocked) e preencher a reliability do Audit Engine. Nunca acessar a fonte
 * com volume industrial: fila sequencial, 1 sonda por fonte, abortável.
 */
import { apiUrl } from "@/lib/apiBase";

export interface AuditProbe {
  sourceId: string;
  route: string;
  body: Record<string, unknown>;
  label: string;
}

/** Ordem está propriamente FIXA (a ordem pedida: suggest→trends→…). */
export const AUDIT_PROBES: AuditProbe[] = [
  { sourceId: "suggest", route: "uni-suggest", body: { action: "suggest", query: "auditoria", region: "br", lang: "pt", vertical: "web", limit: 5 }, label: "Suggest web" },
  { sourceId: "trends", route: "uni-trending", body: { action: "trending", geo: "br", hours: 24 }, label: "Trending 24h" },
  { sourceId: "serp", route: "uni-serp", body: { action: "search", query: "auditoria", limit: 1 }, label: "SERP multi-engine" },
  { sourceId: "youtube", route: "uni-youtube", body: { action: "videos", query: "auditoria", limit: 1 }, label: "YouTube search" },
  { sourceId: "reddit", route: "uni-reddit", body: { action: "posts", query: "audit", limit: 1 }, label: "Reddit posts" },
  { sourceId: "producthunt", route: "uni-producthunt", body: { action: "feed", limit: 1 }, label: "Product Hunt feed" },
  { sourceId: "hackernews", route: "uni-hn", body: { action: "search", query: "auditoria", limit: 1 }, label: "HackerNews search" },
  { sourceId: "arxiv", route: "uni-arxiv", body: { action: "search", query: "auditoria", limit: 1, sort: "relevance" }, label: "arXiv papers" },
  { sourceId: "gdelt", route: "uni-gdelt", body: { action: "search", query: "audit", limit: 1 }, label: "GDELT articles" },
  { sourceId: "github", route: "uni-github", body: { action: "repos", query: "auditoria", limit: 1, sort: "stars" }, label: "GitHub repos" },
  { sourceId: "stackexchange", route: "uni-stackexchange", body: { action: "search", query: "audit", site: "stackoverflow", limit: 1, sort: "relevance" }, label: "StackExchange questions" },
  { sourceId: "steam", route: "uni-steam", body: { action: "search", query: "audit", limit: 1 }, label: "Steam search" },
  { sourceId: "semanticscholar", route: "uni-semanticscholar", body: { action: "search", query: "auditoria", limit: 1 }, label: "Semantic Scholar papers" },
  { sourceId: "reclameaqui", route: "uni-reclameaqui", body: { action: "search", query: "audit" }, label: "ReclameAqui companies" },
  { sourceId: "web", route: "uni-web", body: { action: "page", url: "https://en.wikipedia.org/wiki/Audit" }, label: "Web page" },
  { sourceId: "feed", route: "uni-web", body: { action: "feed", url: "https://hnrss.org/frontpage", limit: 1 }, label: "Web feed" },
  // --- 20 fontes que faltavam (todas as UniSourceId sem sonda) ---
  { sourceId: "wikipedia", route: "wikipedia", body: { action: "search", query: "auditoria", lang: "pt", limit: 1 }, label: "Wikipedia search" },
  { sourceId: "devto", route: "uni-source", body: { source: "devto", query: "auditoria", limit: 1 }, label: "DEV.to articles" },
  { sourceId: "lobsters", route: "uni-source", body: { source: "lobsters", query: "programming", limit: 1 }, label: "Lobsters posts" },
  { sourceId: "mastodon", route: "uni-source", body: { source: "mastodon", query: "auditoria", limit: 1 }, label: "Mastodon posts" },
  { sourceId: "bluesky", route: "uni-source", body: { source: "bluesky", query: "auditoria", limit: 1 }, label: "Bluesky posts" },
  { sourceId: "wikidata", route: "uni-source", body: { source: "wikidata", query: "auditoria", limit: 1 }, label: "Wikidata entities" },
  { sourceId: "openalex", route: "uni-source", body: { source: "openalex", query: "auditoria", limit: 1 }, label: "OpenAlex papers" },
  { sourceId: "crossref", route: "uni-source", body: { source: "crossref", query: "auditoria", limit: 1 }, label: "Crossref works" },
  { sourceId: "openlibrary", route: "uni-source", body: { source: "openlibrary", query: "auditoria", limit: 1 }, label: "OpenLibrary books" },
  { sourceId: "npm", route: "uni-source", body: { source: "npm", query: "auditoria", limit: 1 }, label: "npm packages" },
  { sourceId: "pypi", route: "uni-source", body: { source: "pypi", query: "auditoria", limit: 1 }, label: "PyPI packages" },
  { sourceId: "rubygems", route: "uni-source", body: { source: "rubygems", query: "auditoria", limit: 1 }, label: "RubyGems gems" },
  { sourceId: "cratesio", route: "uni-source", body: { source: "cratesio", query: "auditoria", limit: 1 }, label: "crates.io crates" },
  { sourceId: "doaj", route: "uni-source", body: { source: "doaj", query: "auditoria", limit: 1 }, label: "DOAJ articles" },
  { sourceId: "openfoodfacts", route: "uni-source", body: { source: "openfoodfacts", query: "audit", limit: 1 }, label: "Open Food Facts" },
  { sourceId: "archive", route: "uni-source", body: { source: "archive", query: "auditoria", limit: 1 }, label: "Internet Archive" },
  { sourceId: "tvmaze", route: "uni-source", body: { source: "tvmaze", query: "audit", limit: 1 }, label: "TVMaze shows" },
  { sourceId: "itchio", route: "uni-source", body: { source: "itchio", query: "audit", limit: 1 }, label: "itch.io games" },
];

/** Cliente mínimo (mesmo protocolo do uniApi.post, local p/ sondas). */
export async function postProbe(
  route: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? "local-anon-key";
    const resp = await fetch(apiUrl(`/functions/v1/${route}`), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      signal,
    });
    const data = (await resp.json().catch(() => ({}))) as { error?: string };
    if (!resp.ok) return { ok: false, error: data.error ?? `Erro ${resp.status}` };
    return { ok: true };
  } catch (err) {
    if ((err as Error)?.name === "AbortError") return { ok: false, error: "cancelado" };
    return { ok: false, error: (err as Error).message || "Falha de conexão" };
  }
}
