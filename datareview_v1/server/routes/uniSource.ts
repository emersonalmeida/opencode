import type { RequestHandler } from "express";
// Camada RAW/provenance (aditivo): helper failure-safe, nunca muda a resposta.
import { startRun, finishRun, saveRawArtifact, type CollectionRun } from "../lib/rawStore.js";
import { withObservation } from "../lib/auditObservation.js";
import { getConnector, getByPath, mapConnectorItems, UNI_CONNECTORS, type UniConnector, type RawConnectorItem } from "../lib/uniConnectors.js";

/** Auth de fonte custom (Onda 4.3): header/query/bearer, valor vem no body. */
export interface CustomAuth {
  type: "header" | "query" | "bearer";
  key: string;
  value: string;
}

function applyAuth(url: string, headers: Record<string, string>, auth?: CustomAuth): string {
  if (!auth?.value) return url;
  if (auth.type === "bearer") headers["Authorization"] = `Bearer ${auth.value}`;
  else if (auth.type === "header" && auth.key) headers[auth.key] = auth.value;
  else if (auth.type === "query" && auth.key) {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}${encodeURIComponent(auth.key)}=${encodeURIComponent(auth.value)}`;
  }
  return url;
}

/** Constrói um conector a partir de uma definição customizada do usuário. */
export function customConnector(def: Record<string, unknown>): UniConnector | null {
  const urlTemplate = def?.urlTemplate;
  const fields = (def?.fields ?? {}) as Record<string, string | undefined>;
  if (!urlTemplate || !/^https?:\/\//i.test(String(urlTemplate)) || !String(urlTemplate).includes("{q}")) return null;
  if (!fields.title) return null;
  const label = String(def.label ?? "Fonte customizada");
  const auth = def?.auth as CustomAuth | undefined;
  return {
    id: `custom:${String(def.id ?? slugLite(label))}`,
    label,
    kind: String(def.kind ?? "document"),
    description: String(def.description ?? "Conector definido pelo usuário."),
    buildUrl: (q, limit) =>
      String(urlTemplate)
        .replace(/\{q\}/g, encodeURIComponent(q))
        .replace(/\{limit\}/g, String(Math.max(1, Math.min(limit, 100)))),
    listPath: typeof def.listPath === "string" ? def.listPath : "",
    mapItem: (item) => {
      const get = (p?: string) => (p ? getByPath(item, p) : undefined);
      const title = get(fields.title);
      if (title == null || title === "") return null;
      const out: RawConnectorItem = { title: String(title).slice(0, 300) };
      const text = get(fields.text); if (text != null) out.text = String(text).slice(0, 2000);
      const url = get(fields.url); if (url != null) out.url = String(url);
      const author = get(fields.author); if (author != null) out.author = String(author).slice(0, 120);
      const date = get(fields.date); if (date != null) out.date = String(date);
      const score = Number(get(fields.score)); if (Number.isFinite(score)) out.score = score;
      out.meta = { customSource: label };
      return out;
    },
    ...(auth?.value ? { auth } : {}),
  };
}

function slugLite(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "fonte";
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/**
 * Rota genérica de fontes declarativas (motor uniConnectors):
 *  - GET  (query ?list=1): lista os conectores disponíveis
 *  - POST { source, query, limit? }: busca na fonte e retorna itens normalizados
 */
export const uniSource: RequestHandler = async (req, res) => {
  res.set(corsHeaders);
  let run: CollectionRun | null = null;
  try {
    if (req.method === "GET" || req.query?.list) {
      return res.json({
        connectors: UNI_CONNECTORS.map((c) => ({
          id: c.id, label: c.label, kind: c.kind, description: c.description, lookup: !!c.lookup,
        })),
      });
    }
    const { source, query, limit, custom } = req.body ?? {};
    const connector =
      source === "custom"
        ? customConnector(custom as Record<string, unknown>)
        : getConnector(String(source ?? ""));
    if (!connector) {
      return res.status(400).json({
        error: source === "custom" ? "definição customizada inválida (urlTemplate com {q} + fields.title obrigatórios)" : `fonte desconhecida: ${source}`,
        available: UNI_CONNECTORS.map((c) => c.id),
      });
    }
    if (!query || typeof query !== "string" || !query.trim()) {
      return res.status(400).json({ error: "query required" });
    }
    const max = Math.max(1, Math.min(Number(limit) || 20, 100));
    const headers: Record<string, string> = { "User-Agent": UA, Accept: "application/json" };
    const url = applyAuth(connector.buildUrl(query.trim(), max), headers, connector.auth);
    run = startRun({
      sourceId: connector.id,
      subjectKey: `${connector.id}:${query}`,
      collector: "uni-source",
      collectorVersion: "1",
      params: { source: connector.id, query, limit: max },
    });
    const items = await withObservation(
      run.id, connector.id, connector.id, url,
      { source: connector.id, query, limit: max },
      async () => {
        const resp = await fetch(url, {
          headers,
          signal: AbortSignal.timeout(20000),
        });
        if (!resp.ok) {
          if (resp.status === 401 || resp.status === 403) {
            throw new Error(
              connector.auth
                ? `${connector.label}: credencial recusada (${resp.status}) — verifique a chave no painel da fonte.`
                : `${connector.label} exige autenticação (${resp.status}) — configure a chave de API no painel da fonte.`,
            );
          }
          if (resp.status === 404) throw new Error(`${connector.label}: não encontrado (404)`);
          if (resp.status === 429) throw new Error(`${connector.label} retornou 429 (rate-limit) — aguarde e tente novamente.`);
          throw new Error(`${connector.label} retornou ${resp.status}`);
        }
        const payload = (await resp.json()) as unknown;
        return mapConnectorItems(connector, payload, max);
      },
    );
    saveRawArtifact({
      runId: run.id, sourceId: connector.id, subjectKey: `${connector.id}:${query}`,
      endpoint: connector.id, url, params: { query, limit: max },
      payload: { count: items.length }, collector: "uni-source", collectorVersion: "1",
    });
    finishRun(run, { status: items.length ? "completed" : "partial", yielded: items.length });
    return res.json({ items, count: items.length, kind: connector.kind, source: connector.id });
  } catch (err) {
    console.error("uni-source error:", err);
    if (run) {
      finishRun(run, { status: "failed", errors: [{ endpoint: "uni-source", message: String((err as Error)?.message || err) }] });
    }
    return res.status(500).json({ error: String((err as Error)?.message || err) });
  }
};
