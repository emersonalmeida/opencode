/**
 * Rotas de fontes — UM endpoint modela toda a categoria.
 *
 *  GET  /api/v1/sources            → descritores (id/label/kind/description)
 *  POST /api/v1/sources/collect    → { source, query, limit? } → items
 *
 * Falha de UMA fonte nunca derruba a coleta das demais (erro estruturado).
 */
import { CONNECTORS, getConnector } from "../lib/sources/connectors.js";
import { runConnector } from "../lib/normalize.js";
import { json, readJson, type Handler } from "../router.js";
import type { SourceDescriptor } from "../../shared/contracts.js";

export const listSources: Handler = (_req, res) => {
  const descriptors: SourceDescriptor[] = CONNECTORS.map((c) => ({
    id: c.id,
    label: c.label,
    kind: c.kind,
    description: c.description,
    lookup: c.lookup,
  }));
  json(res, 200, { sources: descriptors });
};

export const collectSource: Handler = async (req, res) => {
  const body = await readJson(req);
  const source = String(body.source ?? "");
  const query = String(body.query ?? "").trim();
  const limit = Math.max(1, Math.min(Number(body.limit ?? 12) || 12, 50));

  if (!source || !query) {
    return json(res, 400, { error: "source e query são obrigatórios" });
  }
  const connector = getConnector(source);
  if (!connector) {
    return json(res, 404, { error: `fonte desconhecida: ${source}` });
  }

  const outcome = await runConnector(connector, query, limit);
  json(res, outcome.error ? 200 : 200, {
    source,
    query,
    items: outcome.items,
    cached: outcome.cached || undefined,
    error: outcome.error,
  });
};
