import type { RequestHandler } from "express";
// Camada RAW/provenance (aditivo): helper failure-safe, nunca muda a resposta.
import { startRun, finishRun, saveRawArtifact, type CollectionRun } from "../lib/rawStore.js";
import { withObservation } from "../lib/auditObservation.js";
// Cache de respostas — GDELT limita a 1 req/5s por IP; hit evita o 429.
import { getCached, setCached } from "../lib/routeCache.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Conector GDELT — notícias globais monitoradas em tempo real, API pública
 * sem auth. Referência: docs/_uni.py (coletar_gdelt).
 *
 * Ação:
 *  - search: { query, sort?: "date"|"relevance", lang?: "pt"|"en"|"es"|"auto",
 *              limit?, startDate?: "YYYYMMDD", endDate?: "YYYYMMDD" }
 *
 * https://api.gdeltproject.org/api/v2/doc/doc?query=..&maxrecords=..&format=json
 * Idioma via operador sourceLang: na query (PT-BR correto: Portuguese).
 */
const GDELT_URL = "https://api.gdeltproject.org/api/v2/doc/doc";
const UA = "AppDataReview/1.0 (research)";

const LANG_MAP: Record<string, string> = {
  pt: "Portuguese",
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
};

interface GdeltArticle {
  url?: string;
  title?: string;
  seendate?: string;
  domain?: string;
  language?: string;
  sourcecountry?: string;
}

/** "20240101" → ISO "2024-01-01T00:00:00Z" (GDELT seendate vem como YYYYMMDDTHHMMSSZ). */
function parseSeenDate(raw?: string): string | undefined {
  if (!raw) return undefined;
  const m = /^(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?(\d{2})?/.exec(raw);
  if (!m) return undefined;
  const [, y, mo, d, h = "00", mi = "00", se = "00"] = m;
  return `${y}-${mo}-${d}T${h}:${mi}:${se}Z`;
}

export const uniGdelt: RequestHandler = async (req, res) => {
  res.set(corsHeaders);
  let run: CollectionRun | null = null;
  try {
    const { action } = req.body ?? {};
    if (action !== "search") {
      return res.status(400).json({ error: `unknown action: ${action} (use search)` });
    }
    const { query, sort = "date", lang = "auto", limit, startDate, endDate } = req.body ?? {};
    if (!query || typeof query !== "string") return res.status(400).json({ error: "query required" });
    const max = Math.max(1, Math.min(Number(limit) || 20, 250));

    // Idioma: operador sourcelang: na query (a referência usava `mode`, que é
    // parâmetro de formato de saída do GDELT, não de idioma). Frases multi-
    // palavra vão entre aspas (parênteses soltos quebram o parser do GDELT).
    const srcLang = LANG_MAP[String(lang)];
    const phrase = query.trim().includes(" ") ? `"${query.trim()}"` : query.trim();
    const fullQuery = srcLang ? `${phrase} sourcelang:${srcLang}` : phrase;
    const sortParam = sort === "relevance" ? "HybridRel" : "DateDesc";

    // Cache hit: mesma consulta dentro do TTL → resposta imediata sem nova run.
    const cacheParams = { action, query, sort, lang, limit: max, startDate, endDate };
    const cached = getCached("uni-gdelt", cacheParams) as Record<string, unknown> | undefined;
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    run = startRun({
      sourceId: "gdelt",
      subjectKey: `gdelt:${fullQuery}:${sortParam}`,
      collector: "uni-gdelt",
      collectorVersion: "1",
      params: { action, query, sort, lang, limit: max, startDate, endDate },
    });

    const params = new URLSearchParams({
      query: fullQuery,
      maxrecords: String(max),
      format: "json",
      sort: sortParam,
    });
    if (/^\d{8}$/.test(String(startDate ?? ""))) params.set("startdatetime", `${startDate}000000`);
    if (/^\d{8}$/.test(String(endDate ?? ""))) params.set("enddatetime", `${endDate}235959`);
    const url = `${GDELT_URL}?${params}`;

    // GDELT retorna TEXTO (não JSON) em rate-limit (1 req/5s por IP) ou em
    // query inválida — a Observation registra o status honesto (fetch que não
    // parseia a artigos vira confidence=0; parseável, 1).
    const articles = await withObservation(
      run.id, "gdelt", "gdelt-doc", url,
      { action, query, sort, lang, limit: max },
      async () => {
        const resp = await fetch(url, {
          headers: { "User-Agent": UA, Accept: "application/json" },
          signal: AbortSignal.timeout(20000),
        });
        const rawText = await resp.text();
        let data: { articles?: GdeltArticle[] };
        try {
          data = JSON.parse(rawText) as { articles?: GdeltArticle[] };
        } catch {
          const msg = rawText.slice(0, 160).trim();
          if (/limit requests/i.test(rawText)) {
            if (run) finishRun(run, { status: "failed", errors: [{ endpoint: "gdelt", message: "rate-limit" }] });
            res.status(429).json({ error: "GDELT limita a 1 requisição a cada 5 segundos por IP. Aguarde alguns segundos e tente novamente." });
            return [] as { url: string; title: string; seenDate: string; domain: string; language: string; sourceCountry: string }[];
          }
          if (run) finishRun(run, { status: "failed", errors: [{ endpoint: "gdelt", message: msg }] });
          res.status(400).json({ error: `GDELT rejeitou a consulta: ${msg}` });
          return [] as { url: string; title: string; seenDate: string; domain: string; language: string; sourceCountry: string }[];
        }
        if (!resp.ok) throw new Error(`GDELT retornou ${resp.status}`);
        return (data.articles ?? []).map((a) => ({
          url: a.url ?? "",
          title: a.title ?? "(sem título)",
          seenDate: parseSeenDate(a.seendate) ?? "",
          domain: a.domain ?? "",
          language: a.language ?? "",
        sourceCountry: a.sourcecountry ?? "",
        }) as { url: string; title: string; seenDate: string; domain: string; language: string; sourceCountry: string });
      },
    );
    if ((res as { statusCode?: number }).statusCode && res.statusCode >= 400) return;

    saveRawArtifact({
      runId: run.id, sourceId: "gdelt", subjectKey: `gdelt:${fullQuery}:${sortParam}`,
      endpoint: "gdelt-doc", url, params: { action, query, sort, lang, limit: max },
      payload: { count: articles.length }, collector: "uni-gdelt", collectorVersion: "1",
    });
    finishRun(run, { status: articles.length ? "completed" : "partial", yielded: articles.length });
    if (articles.length) setCached("uni-gdelt", cacheParams, { action, query, sort, count: articles.length, articles }, 10 * 60 * 1000);
    return res.json({ articles, count: articles.length });
  } catch (err) {
    console.error("uni-gdelt error:", err);
    if (run) {
      finishRun(run, { status: "failed", errors: [{ endpoint: "gdelt", message: String((err as Error)?.message || err) }] });
    }
    return res.status(500).json({ error: String((err as Error)?.message || err) });
  }
};
