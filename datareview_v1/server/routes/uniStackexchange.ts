import type { RequestHandler } from "express";
// Camada RAW/provenance (aditivo): helper failure-safe, nunca muda a resposta.
import { startRun, finishRun, saveRawArtifact, type CollectionRun } from "../lib/rawStore.js";
import { withObservation } from "../lib/auditObservation.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Conector StackExchange — perguntas/respostas da rede (Stack Overflow etc.)
 * via API 2.3 pública (sem auth; quota 300 req/dia por IP). Referência:
 * docs/_uni.py (buscar_stack).
 *
 * Ações:
 *  - search:  { query, site?: "stackoverflow"|..., sort?: "relevance"|
 *             "votes"|"creation", limit? } — /search/advanced
 *  - answers: { questionId, site?, limit? } — /questions/{id}/answers
 */
const SE_SEARCH = "https://api.stackexchange.com/2.3/search/advanced";
const SE_ANSWERS = "https://api.stackexchange.com/2.3/questions";
const UA = "AppDataReview/1.0 (research)";

const SE_SITES = ["stackoverflow", "pt.stackoverflow", "superuser", "serverfault", "android", "apple", "webapps"];

interface SeQuestion {
  question_id: number;
  title?: string;
  link?: string;
  score?: number;
  answer_count?: number;
  view_count?: number;
  is_answered?: boolean;
  creation_date?: number;
  tags?: string[];
  owner?: { display_name?: string };
  body?: string;
}

interface SeAnswer {
  answer_id: number;
  score?: number;
  is_accepted?: boolean;
  creation_date?: number;
  body?: string;
  owner?: { display_name?: string };
}

function decodeHtml(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function stripHtml(html: string): string {
  return decodeHtml(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

async function seGet(url: string): Promise<{ items?: unknown[]; error_message?: string }> {
  const resp = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`StackExchange retornou ${resp.status}`);
  const data = (await resp.json()) as { items?: unknown[]; error_message?: string };
  if (data.error_message) throw new Error(`StackExchange: ${data.error_message}`);
  return data;
}

export const uniStackexchange: RequestHandler = async (req, res) => {
  res.set(corsHeaders);
  let run: CollectionRun | null = null;
  try {
    const { action } = req.body ?? {};

    if (action === "search") {
      const { query, site = "stackoverflow", sort = "relevance", limit } = req.body ?? {};
      if (!query || typeof query !== "string") return res.status(400).json({ error: "query required" });
      const siteId = SE_SITES.includes(String(site)) ? String(site) : "stackoverflow";
      const max = Math.max(1, Math.min(Number(limit) || 20, 100));
      const sortBy = ["relevance", "votes", "creation", "activity"].includes(String(sort)) ? String(sort) : "relevance";
      run = startRun({
        sourceId: "stackexchange",
        subjectKey: `stackexchange:${siteId}:${query}:${sortBy}`,
        collector: "uni-stackexchange",
        collectorVersion: "1",
        params: { action, query, site: siteId, sort: sortBy, limit: max },
      });
      const params = new URLSearchParams({
        order: "desc", sort: sortBy, q: query, site: siteId,
        pagesize: String(max), filter: "withbody",
      });
      const url = `${SE_SEARCH}?${params}`;
      const data = await withObservation(
        run.id, "stackexchange", "se-search", url,
        { action, query, site: siteId, sort: sortBy, limit: max },
        () => seGet(url),
      );
      const raw = (data.items ?? []) as SeQuestion[];
      const questions = raw.map((q) => ({
        id: q.question_id,
        title: decodeHtml(q.title ?? "(sem título)"),
        link: q.link ?? "",
        score: q.score ?? 0,
        answerCount: q.answer_count ?? 0,
        viewCount: q.view_count ?? 0,
        isAnswered: !!q.is_answered,
        body: q.body ? stripHtml(q.body).slice(0, 2000) : "",
        createdAt: q.creation_date ? new Date(q.creation_date * 1000).toISOString() : "",
        tags: q.tags ?? [],
        author: q.owner?.display_name ?? "",
      }));
      saveRawArtifact({
        runId: run.id, sourceId: "stackexchange", subjectKey: `stackexchange:${siteId}:${query}:${sortBy}`,
        endpoint: "se-search", url, params: { action, query, site: siteId, sort: sortBy, limit: max },
        payload: { count: questions.length }, collector: "uni-stackexchange", collectorVersion: "1",
      });
      finishRun(run, { status: questions.length ? "completed" : "partial", yielded: questions.length });
      return res.json({ questions, count: questions.length });
    }

    if (action === "answers") {
      const { questionId, site = "stackoverflow", limit } = req.body ?? {};
      if (!questionId) return res.status(400).json({ error: "questionId required" });
      const siteId = SE_SITES.includes(String(site)) ? String(site) : "stackoverflow";
      const max = Math.max(1, Math.min(Number(limit) || 10, 50));
      run = startRun({
        sourceId: "stackexchange",
        subjectKey: `stackexchange:answers:${questionId}`,
        collector: "uni-stackexchange",
        collectorVersion: "1",
        params: { action, questionId, site: siteId, limit: max },
      });
      const params = new URLSearchParams({
        order: "desc", sort: "votes", site: siteId, pagesize: String(max), filter: "withbody",
      });
      const url = `${SE_ANSWERS}/${encodeURIComponent(String(questionId))}/answers?${params}`;
      const data = await withObservation(
        run.id, "stackexchange", "se-answers", url,
        { action, questionId, site: siteId, limit: max },
        () => seGet(url),
      );
      const raw = (data.items ?? []) as SeAnswer[];
      const answers = raw.map((a) => ({
        id: a.answer_id,
        score: a.score ?? 0,
        isAccepted: !!a.is_accepted,
        body: a.body ? stripHtml(a.body).slice(0, 2000) : "",
        createdAt: a.creation_date ? new Date(a.creation_date * 1000).toISOString() : "",
        author: a.owner?.display_name ?? "",
      }));
      saveRawArtifact({
        runId: run.id, sourceId: "stackexchange", subjectKey: `stackexchange:answers:${questionId}`,
        endpoint: "se-answers", url, params: { action, questionId, site: siteId, limit: max },
        payload: { count: answers.length }, collector: "uni-stackexchange", collectorVersion: "1",
      });
      finishRun(run, { status: answers.length ? "completed" : "partial", yielded: answers.length });
      return res.json({ answers, count: answers.length });
    }

    return res.status(400).json({ error: `unknown action: ${action} (use search|answers)` });
  } catch (err) {
    console.error("uni-stackexchange error:", err);
    if (run) {
      finishRun(run, { status: "failed", errors: [{ endpoint: "stackexchange", message: String((err as Error)?.message || err) }] });
    }
    return res.status(500).json({ error: String((err as Error)?.message || err) });
  }
};
