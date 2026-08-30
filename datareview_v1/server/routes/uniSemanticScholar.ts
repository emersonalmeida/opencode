import type { RequestHandler } from "express";
// Camada RAW/provenance (aditivo): helper failure-safe, nunca muda a resposta.
import { startRun, finishRun, saveRawArtifact, type CollectionRun } from "../lib/rawStore.js";
import { withObservation } from "../lib/auditObservation.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Conector Semantic Scholar — artigos acadêmicos com contagem de citações,
 * API Graph pública (sem auth; rate-limit apertado → backoff exponencial,
 * referência: docs/_uni.py fetch_with_backoff).
 *
 * Ação:
 *  - search: { query, sort?: "relevance"|"citationCount", limit? }
 * https://api.semanticscholar.org/graph/v1/paper/search
 */
const S2_URL = "https://api.semanticscholar.org/graph/v1/paper/search";
const UA = "AppDataReview/1.0 (research)";

interface S2Paper {
  paperId: string;
  title?: string;
  abstract?: string;
  year?: number;
  url?: string;
  citationCount?: number;
  authors?: { name?: string }[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Backoff exponencial + jitter em 429 (limite da referência: 5 tentativas). */
async function s2Get(url: string): Promise<{ data?: S2Paper[] }> {
  for (let i = 0; i < 5; i++) {
    const resp = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(30000),
    });
    if (resp.status === 429) {
      const wait = Math.pow(2, i) * 1000 + Math.random() * 2000;
      await sleep(wait);
      continue;
    }
    if (!resp.ok) throw new Error(`Semantic Scholar retornou ${resp.status}`);
    return (await resp.json()) as { data?: S2Paper[] };
  }
  throw new Error("Semantic Scholar: rate-limit persistente. Aguarde ~1 minuto e tente novamente.");
}

export const uniSemanticScholar: RequestHandler = async (req, res) => {
  res.set(corsHeaders);
  let run: CollectionRun | null = null;
  try {
    const { action } = req.body ?? {};
    if (action !== "search") {
      return res.status(400).json({ error: `unknown action: ${action} (use search)` });
    }
    const { query, sort = "relevance", limit } = req.body ?? {};
    if (!query || typeof query !== "string") return res.status(400).json({ error: "query required" });
    const max = Math.max(1, Math.min(Number(limit) || 20, 100));
    const sortBy = sort === "citationCount" ? "citationCount" : "relevance";

    run = startRun({
      sourceId: "semanticscholar",
      subjectKey: `semanticscholar:${query}:${sortBy}`,
      collector: "uni-semanticscholar",
      collectorVersion: "1",
      params: { action, query, sort: sortBy, limit: max },
    });

    const params = new URLSearchParams({
      query,
      limit: String(max),
      fields: "title,authors,year,url,abstract,citationCount",
    });
    if (sortBy === "citationCount") params.set("sort", "citationCount:desc");
    const url = `${S2_URL}?${params}`;
    const data = await withObservation(
      run.id, "semanticscholar", "s2-search", url,
      { action, query, sort: sortBy, limit: max },
      () => s2Get(url),
    );
    const raw = data.data ?? [];
    const papers = raw.map((p) => ({
      id: p.paperId,
      title: p.title ?? "(sem título)",
      abstract: p.abstract ?? "",
      year: p.year ?? null,
      url: p.url ?? "",
      citations: p.citationCount ?? 0,
      authors: (p.authors ?? []).map((a) => a.name ?? "").filter(Boolean),
    }));

    saveRawArtifact({
      runId: run.id, sourceId: "semanticscholar", subjectKey: `semanticscholar:${query}:${sortBy}`,
      endpoint: "s2-search", url, params: { action, query, sort: sortBy, limit: max },
      payload: { count: papers.length }, collector: "uni-semanticscholar", collectorVersion: "1",
    });
    finishRun(run, { status: papers.length ? "completed" : "partial", yielded: papers.length });
    return res.json({ papers, count: papers.length });
  } catch (err) {
    console.error("uni-semanticscholar error:", err);
    if (run) {
      finishRun(run, { status: "failed", errors: [{ endpoint: "semanticscholar", message: String((err as Error)?.message || err) }] });
    }
    return res.status(500).json({ error: String((err as Error)?.message || err) });
  }
};
