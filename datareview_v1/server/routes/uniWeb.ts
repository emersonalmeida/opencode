import type { RequestHandler } from "express";
// Camada RAW/provenance (aditivo): helper failure-safe, nunca muda a resposta.
import { startRun, finishRun, saveRawArtifact, type CollectionRun } from "../lib/rawStore.js";
import { withObservation } from "../lib/auditObservation.js";
import { extractArticle, parseFeed, splitTextItems } from "../lib/webExtract.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Coletores UNIVERSAIS da página `/00` — qualquer URL, PDF, feed RSS/Atom ou
 * texto colado vira UniItem normalizado:
 *
 *  - page:  { url }                       — HTML → título+texto+metadados (Readability-like)
 *  - pdf:   { url }                       — PDF → texto por blocos (unpdf, sem key)
 *  - feed:  { url, limit? }               — RSS 2.0/Atom genérico (blogs, Google News…)
 *  - text:  { text, format? }             — colado .md/.txt/.json/.csv → itens
 *
 * Princípio maximalista de coleta: nunca falhar feio — HTML inválido, feed
 * malformado ou PDF protegido viram erro honesto ou fallback de texto bruto.
 */
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const MAX_BYTES = 25 * 1024 * 1024; // 25MB (PDF grandes)

async function fetchBuffer(url: string, accept: string): Promise<{ body: Buffer; contentType: string }> {
  const resp = await fetch(url, {
    headers: { "User-Agent": UA, Accept: accept },
    signal: AbortSignal.timeout(30000),
    redirect: "follow",
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} ao acessar a URL`);
  const len = Number(resp.headers.get("content-length") ?? 0);
  if (len > MAX_BYTES) throw new Error("Arquivo muito grande (máx 25MB)");
  const buf = Buffer.from(await resp.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error("Arquivo muito grande (máx 25MB)");
  return { body: buf, contentType: resp.headers.get("content-type") ?? "" };
}

function looksLikeUrl(u: string): boolean {
  return /^https?:\/\/[\w.-]+\.[a-z]{2,}/i.test(u);
}

export const uniWeb: RequestHandler = async (req, res) => {
  res.set(corsHeaders);
  let run: CollectionRun | null = null;
  try {
    const { action } = req.body ?? {};

    if (action === "page") {
      const { url } = req.body ?? {};
      if (!url || typeof url !== "string" || !looksLikeUrl(url)) {
        return res.status(400).json({ error: "url inválida (precisa começar com http(s)://)" });
      }
      run = startRun({
        sourceId: "web",
        subjectKey: `web:${url}`,
        collector: "uni-web",
        collectorVersion: "1",
        params: { action, url },
      });
      const { body, contentType } = await withObservation(
        run.id, "web", "web-page", url,
        { action, url },
        () => fetchBuffer(url, "text/html,application/xhtml+xml"),
      );
      const html = body.toString("utf-8");
      if (/application\/pdf/i.test(contentType) || html.startsWith("%PDF")) {
        // URL aponta para PDF — redirecionar internamente para a extração de PDF.
        const { extractText } = await import("unpdf");
        const { text } = await extractText(new Uint8Array(body), { mergePages: false });
        const pages = (Array.isArray(text) ? text : [text]).filter(Boolean);
        finishRun(run, { status: pages.length ? "completed" : "partial", yielded: pages.length });
        return res.json({ kind: "pdf", pages, count: pages.length, url });
      }
      const article = extractArticle(html, url);
      saveRawArtifact({
        runId: run.id, sourceId: "web", subjectKey: `web:${url}`,
        endpoint: "web-page", url, params: { action, url },
        payload: { title: article.title, words: article.words },
        collector: "uni-web", collectorVersion: "1",
      });
      finishRun(run, { status: article.text ? "completed" : "partial", yielded: article.text ? 1 : 0 });
      return res.json({ kind: "page", article });
    }

    if (action === "pdf") {
      const { url } = req.body ?? {};
      if (!url || typeof url !== "string" || !looksLikeUrl(url)) {
        return res.status(400).json({ error: "url inválida (precisa começar com http(s)://)" });
      }
      run = startRun({
        sourceId: "web",
        subjectKey: `pdf:${url}`,
        collector: "uni-web",
        collectorVersion: "1",
        params: { action, url },
      });
      const { body } = await withObservation(
        run.id, "web", "web-pdf", url,
        { action, url },
        () => fetchBuffer(url, "application/pdf,*/*"),
      );
      const { extractText } = await import("unpdf");
      const { text } = await extractText(new Uint8Array(body), { mergePages: false });
      const pages = (Array.isArray(text) ? text : [text]).filter(Boolean);
      saveRawArtifact({
        runId: run.id, sourceId: "web", subjectKey: `pdf:${url}`,
        endpoint: "web-pdf", url, params: { action, url },
        payload: { pages: pages.length }, collector: "uni-web", collectorVersion: "1",
      });
      finishRun(run, { status: pages.length ? "completed" : "partial", yielded: pages.length });
      return res.json({ kind: "pdf", pages, count: pages.length, url });
    }

    if (action === "feed") {
      const { url, limit } = req.body ?? {};
      if (!url || typeof url !== "string" || !looksLikeUrl(url)) {
        return res.status(400).json({ error: "url inválida (precisa começar com http(s)://)" });
      }
      const max = Math.max(1, Math.min(Number(limit) || 50, 100));
      run = startRun({
        sourceId: "feed",
        subjectKey: `feed:${url}`,
        collector: "uni-web",
        collectorVersion: "1",
        params: { action, url, limit: max },
      });
      const { body } = await withObservation(
        run.id, "feed", "web-feed", url,
        { action, url, limit: max },
        () => fetchBuffer(url, "application/rss+xml,application/atom+xml,application/xml,text/xml,*/*"),
      );
      const items = parseFeed(body.toString("utf-8"), max);
      saveRawArtifact({
        runId: run.id, sourceId: "feed", subjectKey: `feed:${url}`,
        endpoint: "web-feed", url, params: { action, url, limit: max },
        payload: { count: items.length }, collector: "uni-web", collectorVersion: "1",
      });
      finishRun(run, { status: items.length ? "completed" : "partial", yielded: items.length });
      return res.json({ kind: "feed", items, count: items.length, url });
    }

    if (action === "text") {
      const { text, format = "auto" } = req.body ?? {};
      if (!text || typeof text !== "string" || !text.trim()) {
        return res.status(400).json({ error: "text vazio" });
      }
      if (text.length > 5 * 1024 * 1024) return res.status(400).json({ error: "Texto muito grande (máx 5MB)" });
      const fmt = ["auto", "md", "txt", "json", "csv"].includes(format) ? format : "auto";
      run = startRun({
        sourceId: "paste",
        subjectKey: `paste:${text.length}`,
        collector: "uni-web",
        collectorVersion: "1",
        params: { action, format: fmt, bytes: text.length },
      });
      const items = splitTextItems(text, fmt as "auto" | "md" | "txt" | "json" | "csv");
      finishRun(run, { status: "completed", yielded: items.length });
      return res.json({ kind: "text", items, count: items.length, format: fmt });
    }

    return res.status(400).json({ error: `unknown action: ${action} (use page|pdf|feed|text)` });
  } catch (err) {
    console.error("uni-web error:", err);
    if (run) {
      finishRun(run, { status: "failed", errors: [{ endpoint: "web", message: String((err as Error)?.message || err) }] });
    }
    return res.status(500).json({ error: String((err as Error)?.message || err) });
  }
};
