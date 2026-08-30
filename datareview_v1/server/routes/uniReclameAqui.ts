import type { RequestHandler } from "express";
// Camada RAW/provenance (aditivo): helper failure-safe, nunca muda a resposta.
import { startRun, finishRun, saveRawArtifact, type CollectionRun } from "../lib/rawStore.js";
import { withObservation } from "../lib/auditObservation.js";
import {
  parseCompanyComplaints,
  parseCompanySearch,
  parseTermSearch,
} from "../lib/reclameAquiCore.js";
import { raFetchJson, RA_CF_MSG } from "../lib/raHttp.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Conector ReclameAqui — usa os endpoints JSON internos do próprio webapp
 * (iosearch/iosite …/raichu-io-*), sem auth. O RA fica atrás de Cloudflare
 * (Bot Fight Mode barra o fingerprint TLS do Node) — a camada HTTP
 * (server/lib/raHttp.ts) faz fallback para curl_cffi impersonando o Chrome;
 * se nada passar, erro HONESTO com a orientação de instalação/rede.
 *
 * Ações:
 *  - search:     { query }                    — empresas por nome.
 *  - complaints: { companyId?|shortname?, limit? } — reclamações da empresa.
 *  - term:       { query, limit? }            — busca livre de reclamações.
 */
const IOSEARCH = "https://iosearch.reclameaqui.com.br/raichu-io-site-search-v1";

const CF_MSG = RA_CF_MSG;

async function fetchJson(url: string): Promise<unknown> {
  return raFetchJson(url);
}

/** Resolve companyId pelo shortname via companies/search (endpoint estável). */
async function resolveCompanyId(shortname: string): Promise<{ id: string; name: string }> {
  const url = `${IOSEARCH}/companies/search/${encodeURIComponent(shortname)}`;
  const companies = parseCompanySearch(await fetchJson(url));
  const exact = companies.find((c) => c.shortname === shortname) ?? companies[0];
  if (!exact?.id) throw new Error(`Empresa "${shortname}" não encontrada no ReclameAqui`);
  return { id: exact.id, name: exact.name };
}

export const uniReclameAqui: RequestHandler = async (req, res) => {
  res.set(corsHeaders);
  let run: CollectionRun | null = null;
  try {
    const { action } = req.body ?? {};

    if (action === "search") {
      const { query } = req.body ?? {};
      if (!query || typeof query !== "string") return res.status(400).json({ error: "query required" });
      run = startRun({
        sourceId: "reclameaqui",
        subjectKey: `ra:search:${query}`,
        collector: "uni-reclameaqui",
        collectorVersion: "1",
        params: { action, query },
      });
      const url = `${IOSEARCH}/companies/search/${encodeURIComponent(query.trim())}`;
      const companies = await withObservation(
        run.id, "reclameaqui", "ra-companies-search", url,
        { action, query },
        async () => parseCompanySearch(await fetchJson(url)),
      );
      saveRawArtifact({
        runId: run.id, sourceId: "reclameaqui", subjectKey: `ra:search:${query}`,
        endpoint: "ra-companies-search", url, params: { action, query },
        payload: { count: companies.length }, collector: "uni-reclameaqui", collectorVersion: "1",
      });
      finishRun(run, { status: companies.length ? "completed" : "partial", yielded: companies.length });
      return res.json({ companies, count: companies.length });
    }

    if (action === "complaints") {
      const { companyId, shortname, limit } = req.body ?? {};
      const max = Math.max(1, Math.min(Number(limit) || 25, 100));
      if (!companyId && !shortname) {
        return res.status(400).json({ error: "companyId ou shortname required (busque a empresa primeiro)" });
      }
      let id = String(companyId ?? "");
      let companyName = "";
      if (!id && shortname) {
        const resolved = await resolveCompanyId(String(shortname));
        id = resolved.id;
        companyName = resolved.name;
      }
      run = startRun({
        sourceId: "reclameaqui",
        subjectKey: `ra:complaints:${id}`,
        collector: "uni-reclameaqui",
        collectorVersion: "1",
        params: { action, companyId: id, limit: max },
      });
      const url = `${IOSEARCH}/query/companyComplains/${max}/0?company=${encodeURIComponent(id)}`;
      const { complaints, total } = await withObservation(
        run.id, "reclameaqui", "ra-company-complains", url,
        { action, companyId: id, limit: max },
        async () => parseCompanyComplaints(await fetchJson(url), max),
      );
      saveRawArtifact({
        runId: run.id, sourceId: "reclameaqui", subjectKey: `ra:complaints:${id}`,
        endpoint: "ra-company-complains", url, params: { action, companyId: id, limit: max },
        payload: { count: complaints.length, total }, collector: "uni-reclameaqui", collectorVersion: "1",
      });
      finishRun(run, { status: complaints.length ? "completed" : "partial", yielded: complaints.length });
      return res.json({ complaints, count: complaints.length, total, companyId: id, companyName });
    }

    if (action === "term") {
      const { query, limit } = req.body ?? {};
      if (!query || typeof query !== "string") return res.status(400).json({ error: "query required" });
      const max = Math.max(1, Math.min(Number(limit) || 25, 100));
      run = startRun({
        sourceId: "reclameaqui",
        subjectKey: `ra:term:${query}`,
        collector: "uni-reclameaqui",
        collectorVersion: "1",
        params: { action, query, limit: max },
      });
      const url = `${IOSEARCH}/query/${encodeURIComponent(query.trim())}/${max}/1`;
      const complaints = await withObservation(
        run.id, "reclameaqui", "ra-term-search", url,
        { action, query, limit: max },
        async () => parseTermSearch(await fetchJson(url), max),
      );
      saveRawArtifact({
        runId: run.id, sourceId: "reclameaqui", subjectKey: `ra:term:${query}`,
        endpoint: "ra-term-search", url, params: { action, query, limit: max },
        payload: { count: complaints.length }, collector: "uni-reclameaqui", collectorVersion: "1",
      });
      finishRun(run, { status: complaints.length ? "completed" : "partial", yielded: complaints.length });
      return res.json({ complaints, count: complaints.length });
    }

    return res.status(400).json({ error: `unknown action: ${action} (use search|complaints|term)` });
  } catch (err) {
    console.error("uni-reclameaqui error:", err);
    if (run) {
      finishRun(run, { status: "failed", errors: [{ endpoint: "reclameaqui", message: String((err as Error)?.message || err) }] });
    }
    const msg = String((err as Error)?.message || err);
    const status = msg === CF_MSG ? 403 : 500;
    return res.status(status).json({ error: msg });
  }
};
