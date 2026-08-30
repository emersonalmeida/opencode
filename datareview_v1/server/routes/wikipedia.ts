import type { RequestHandler } from "express";
// Camada RAW/provenance (aditivo): helper failure-safe, nunca muda a resposta.
import { startRun, finishRun, saveRawArtifact, type CollectionRun } from "../lib/rawStore.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Conector Wikipedia — Discovery de candidatos (search) + coleta de artigo
 * (extract). MediaWiki Action API pública (terminos.legal/wikimedia, sem
 * auth). Fonte segura para a primeira expansão multi-fonte do harness.
 *
 * action=query:
 *  - search: list=search → candidatos {title, pageid, snippet}
 *  - article: prop=extracts → texto integral do artigo
 */
export interface WikiSearchResult {
  title: string;
  pageid: number;
  snippet: string;
  timestamp?: string;
  wordcount?: number;
}

export interface WikiArticle {
  title: string;
  extract: string;
}

export const wikipedia: RequestHandler = async (req, res) => {
  res.set(corsHeaders);
  let run: CollectionRun | null = null;
  try {
    const { action, query, pageid, title, lang = "pt", limit } = req.body ?? {};
    const langCode = /^[a-z]{2,3}(\.[a-z]{2,3})?$/.test(String(lang)) ? String(lang) : "pt";
    const max = Math.max(1, Math.min(Number(limit) || 10, 50));

    if (action === "search") {
      if (!query || typeof query !== "string") return res.status(400).json({ error: "query required" });
      run = startRun({
        sourceId: "wikipedia",
        subjectKey: `wikipedia:${langCode}:${query}`,
        collector: "wikipedia",
        collectorVersion: "1",
        params: { action, query, lang: langCode, limit: max },
      });
      const url = `https://${langCode}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=${max}&format=json`;
      const upstream = await fetch(url, { headers: { "User-Agent": "AppDataReview/1.0 (research)" } });
      const data = (await upstream.json()) as { query?: { search?: unknown[] } };
      const results = data?.query?.search ?? [];
      saveRawArtifact({
        runId: run.id,
        sourceId: "wikipedia",
        subjectKey: `wikipedia:${langCode}:${query}`,
        endpoint: "wikipedia-search",
        url,
        params: { action, query, lang: langCode, limit: max },
        payload: data,
        collector: "wikipedia",
        collectorVersion: "1",
      });
      finishRun(run, { status: results.length ? "completed" : "partial", yielded: results.length });
      return res.json({ action, results, count: results.length });
    }

    if (action === "article") {
      const ref = pageid ?? title;
      if (!ref) return res.status(400).json({ error: "pageid or title required" });
      run = startRun({
        sourceId: "wikipedia",
        subjectKey: `wikipedia:${langCode}:${ref}`,
        collector: "wikipedia",
        collectorVersion: "1",
        params: { action, pageid, title, lang: langCode },
      });
      const selector = pageid ? `pageids=${pageid}` : `titles=${encodeURIComponent(String(title))}`;
      const url = `https://${langCode}.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&${selector}&format=json`;
      const upstream = await fetch(url, { headers: { "User-Agent": "AppDataReview/1.0 (research)" } });
      const data = (await upstream.json()) as { query?: { pages?: Record<string, { extract?: string; title?: string }> } };
      const pages = data?.query?.pages ?? {};
      const first = Object.values(pages)[0] as { extract?: string; title?: string } | undefined;
      saveRawArtifact({
        runId: run.id,
        sourceId: "wikipedia",
        subjectKey: `wikipedia:${langCode}:${ref}`,
        endpoint: "wikipedia-article",
        url,
        params: { action, pageid, title, lang: langCode },
        payload: data,
        collector: "wikipedia",
        collectorVersion: "1",
      });
      finishRun(run, { status: first ? "completed" : "partial", yielded: first ? 1 : 0 });
      return res.json({ action, article: first ?? null, found: !!first });
    }

    if (run) finishRun(run, { status: "failed", errors: [{ endpoint: "wikipedia", message: `unknown action: ${action}` }] });
    return res.status(400).json({ error: `unknown action: ${action} (use search|article)` });
  } catch (err) {
    console.error("wikipedia connector error:", err);
    if (run) {
      finishRun(run, { status: "failed", errors: [{ endpoint: "wikipedia", message: String((err as Error)?.message || err) }] });
    }
    return res.status(500).json({ error: String((err as Error)?.message || err) });
  }
};
