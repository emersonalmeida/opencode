import type { RequestHandler } from "express";
// Camada RAW/provenance (aditivo): helper failure-safe, nunca muda a resposta.
import { startRun, finishRun, saveRawArtifact, type CollectionRun } from "../lib/rawStore.js";
import { withObservation } from "../lib/auditObservation.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Conector arXiv — artigos científicos (preprints) via API Atom pública,
 * sem auth. Referência: docs/_uni.py (buscar_arxiv).
 *
 * Ação:
 *  - search: { query, sort?: "relevance"|"lastUpdatedDate"|"submittedDate",
 *              limit? }
 * https://export.arxiv.org/api/query?search_query=all:..&max_results=..
 * Resposta Atom XML — parser mínimo por regex (sem dependência nova).
 */
const ARXIV_URL = "https://export.arxiv.org/api/query";
const UA = "AppDataReview/1.0 (research)";

export interface ArxivPaper {
  id: string;
  title: string;
  summary: string;
  authors: string[];
  published: string;
  updated: string;
  url: string;
  pdf: string;
  categories: string[];
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function tag(block: string, name: string): string {
  const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`).exec(block);
  return m ? decodeEntities(m[1].replace(/\s+/g, " ").trim()) : "";
}

function tags(block: string, name: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) out.push(decodeEntities(m[1].trim()));
  return out;
}

function parseAtom(xml: string): ArxivPaper[] {
  const papers: ArxivPaper[] = [];
  const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
  let m: RegExpExecArray | null;
  while ((m = entryRe.exec(xml))) {
    const e = m[1];
    const idUrl = tag(e, "id");
    const pdfMatch = /<link[^>]*title="pdf"[^>]*href="([^"]+)"/.exec(e);
    const cats = /<category[^>]*term="([^"]+)"/g;
    const categories: string[] = [];
    let c: RegExpExecArray | null;
    while ((c = cats.exec(e))) categories.push(c[1]);
    const authorNames = tags(e, "name");
    papers.push({
      id: idUrl.split("/abs/")[1] ?? idUrl,
      title: tag(e, "title"),
      summary: tag(e, "summary"),
      authors: authorNames,
      published: tag(e, "published"),
      updated: tag(e, "updated"),
      url: idUrl,
      pdf: pdfMatch?.[1] ?? "",
      categories,
    });
  }
  return papers;
}

export const uniArxiv: RequestHandler = async (req, res) => {
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
    const sortBy = ["relevance", "lastUpdatedDate", "submittedDate"].includes(String(sort)) ? String(sort) : "relevance";

    run = startRun({
      sourceId: "arxiv",
      subjectKey: `arxiv:${query}:${sortBy}`,
      collector: "uni-arxiv",
      collectorVersion: "1",
      params: { action, query, sort: sortBy, limit: max },
    });

    const params = new URLSearchParams({
      search_query: `all:${query}`,
      start: "0",
      max_results: String(max),
      sortBy,
    });
    const url = `${ARXIV_URL}?${params}`;
    const papers = await withObservation(
      run.id, "arxiv", "arxiv-query", url,
      { action, query, sort: sortBy, limit: max },
      async () => {
        const resp = await fetch(url, {
          headers: { "User-Agent": UA },
          signal: AbortSignal.timeout(20000),
        });
        if (!resp.ok) throw new Error(`arXiv retornou ${resp.status}`);
        return parseAtom(await resp.text());
      },
    );

    saveRawArtifact({
      runId: run.id, sourceId: "arxiv", subjectKey: `arxiv:${query}:${sortBy}`,
      endpoint: "arxiv-query", url, params: { action, query, sort: sortBy, limit: max },
      payload: { count: papers.length }, collector: "uni-arxiv", collectorVersion: "1",
    });
    finishRun(run, { status: papers.length ? "completed" : "partial", yielded: papers.length });
    return res.json({ papers, count: papers.length });
  } catch (err) {
    console.error("uni-arxiv error:", err);
    if (run) {
      finishRun(run, { status: "failed", errors: [{ endpoint: "arxiv", message: String((err as Error)?.message || err) }] });
    }
    return res.status(500).json({ error: String((err as Error)?.message || err) });
  }
};
