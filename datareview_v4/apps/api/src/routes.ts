/**
 * Rotas REST da API — cada recurso é fino e testável (deps injetadas).
 * Formato de resposta uniforme: `@v4/contracts` puro (nada de tipos duplicados).
 */
import type { Request, Response } from "express";
import { Router } from "express";
import type { AIPort } from "@v4/domain";
import { deriveFromDataset, runPipeline, runSource, runSourceWithFallback, derive } from "@v4/domain";
import { AUDIT_REGISTRY, categoryCounts, listSourceCatalog, toSourceDescriptor } from "@v4/sources";
import { VERTICALS, REGIONS, LANGS, CLIENTS, EXPANSION_GROUPS, listSuggestProviderIds } from "@v4/sources";
import type { AppDeps } from "./deps.js";
import { buildAdapter } from "./adapters/index.js";

export interface AiDeps {
  ai?: AIPort;
}

function ok(res: Response, body: unknown): void {
  res.json(body);
}

const [auditEntries, auditCategories] = [AUDIT_REGISTRY, [...categoryCounts(AUDIT_REGISTRY).entries()]];

export function createRouter(deps: AppDeps, ai: AiDeps = {}): Router {
  const router = Router();

  /* ------------------------------------------------------------- health -- */
  router.get("/health", (_req, res) => {
    ok(res, { ok: true, name: "datareview-v4", api: "1", version: "0.1.0" });
  });

  /* ------------------------------------------------------------ catalog -- */
  router.get("/catalog", (_req, res) => {
    const sources = listSourceCatalog().map((e) => ({
      ...toSourceDescriptor(e),
      status: e.status,
      group: e.group,
      method: e.method,
      resource: e.resource,
      params: e.params,
      data: e.data,
      keys: e.keys,
      aliases: e.aliases ?? [],
      tosNote: e.tosNote,
    }));
    const byGroup = sources.reduce<Record<string, number>>((acc, s) => {
      acc[s.group] = (acc[s.group] ?? 0) + 1;
      return acc;
    }, {});
    ok(res, { total: sources.length, byGroup, sources });
  });

  router.get("/catalog/:id", (req, res) => {
    const entry = listSourceCatalog().find((e) => e.id === req.params.id || e.aliases?.includes(req.params.id ?? ""));
    if (!entry) {
      res.status(404).json({ error: `fonte '${req.params.id}' fora do catálogo` });
      return;
    }
    ok(res, { entry, descriptor: toSourceDescriptor(entry), status: entry.status });
  });

  /* -------------------------------------------------------------- audit -- */
  router.get("/audit", (_req, res) => {
    ok(res, { entries: auditEntries, categories: Object.fromEntries(auditCategories) });
  });

  /* ------------------------------------------------------------ dataset -- */
  router.get("/dataset", async (_req, res) => {
    const entries = await deps.storage.list();
    ok(res, { total: entries.length, entries });
  });

  router.get("/dataset/:key", async (req, res) => {
    const entry = await deps.storage.get(req.params.key ?? "");
    if (!entry) {
      res.status(404).json({ error: "item não encontrado no dataset" });
      return;
    }
    ok(res, entry);
  });

  router.get("/stats", async (_req, res) => {
    const list = await deps.storage.list();
    ok(res, derive.stats(list));
  });

  router.get("/derive", async (_req, res) => {
    ok(res, await deriveFromDataset(deps.storage));
  });

  /* -------------------------------------------------------------- suggest -- */
  router.get("/suggest-options", (_req, res) => {
    ok(res, {
      verticals: VERTICALS,
      regions: REGIONS,
      langs: LANGS,
      clients: CLIENTS,
      groups: EXPANSION_GROUPS,
      providers: listSuggestProviderIds(),
    });
  });

  /* ------------------------------------------------- inline-parse helpers -- */
  function parseRunBody(body: unknown): { query: string; limit: number; engine?: string; country?: string } | undefined {
    const b = (body ?? {}) as Record<string, unknown>;
    const query = typeof b.query === "string" && b.query.trim() ? b.query.trim() : "";
    if (!query) return undefined;
    const limit = Math.max(1, Math.min(Number(b.limit) || 10, 50));
    const engine = typeof b.engine === "string" && b.engine ? b.engine : undefined;
    const country = typeof b.country === "string" && b.country ? b.country : undefined;
    return { query, limit, engine, country };
  }

  /* ----------------------------------------------------------------- run -- */
  router.post("/run", async (req: Request, res: Response) => {
    const id = typeof req.body?.source === "string" ? req.body.source : undefined;
    if (!id) {
      res.status(400).json({ error: "campo 'source' obrigatório" });
      return;
    }
    const params = parseRunBody(req.body);
    if (!params) {
      res.status(400).json({ error: "campo 'query' obrigatório" });
      return;
    }

    const built = buildAdapter(id, deps.keys, deps.adapters);
    if (!built.source) {
      res.status(built.manifest ? 501 : 404).json({
        error: built.reason,
        ...(built.manifest ? { catalog: built.manifest } : {}),
      });
      return;
    }

    const options = { ...params, signal: upTo(res) };
    const run =
      deps.serp && built.source.id !== "serpapi"
        ? await runSourceWithFallback(built.source, options, {
            storage: deps.storage,
            fallback: deps.serp.source,
            quota: deps.serp.quota,
          }, { adapter: id, requestAt: Date.now() })
        : await runSource(built.source, options, { storage: deps.storage }, { adapter: id, requestAt: Date.now() });

    ok(res, {
      source: id,
      added: run.added,
      total: run.total,
      response: run.response,
      meta: run.meta ?? null,
    });
  });

  /* ------------------------------------------------------------ pipeline -- */
  router.post("/pipeline", async (req: Request, res: Response) => {
    const id = typeof req.body?.source === "string" ? req.body.source : undefined;
    if (!id) {
      res.status(400).json({ error: "campo 'source' obrigatório" });
      return;
    }
    const params = parseRunBody(req.body);
    if (!params) {
      res.status(400).json({ error: "campo 'query' obrigatório" });
      return;
    }

    const built = buildAdapter(id, deps.keys, deps.adapters);
    if (!built.source) {
      res.status(built.manifest ? 501 : 404).json({ error: built.reason, ...(built.manifest ? { catalog: built.manifest } : {}) });
      return;
    }

    const run = await runPipeline(built.source, { ...params, signal: upTo(res) }, { storage: deps.storage, ai: ai.ai });
    ok(res, {
      source: id,
      added: run.added,
      total: run.total,
      response: run.response,
      aiResponse: run.aiResponse ?? null,
    });
  });

  return router;
}

/** Cancela a coleta quando o CLIENTE desconecta antes do fim (não confundir
 *  com o fechamento normal do stream de request, que dispararia cedo). */
function upTo(res: Response): AbortSignal | undefined {
  const killer = new AbortController();
  const abort = () => {
    if (!res.writableEnded) killer.abort(new DOMException("client closed", "AbortError"));
  };
  res.on("close", abort);
  res.on("finish", () => res.removeListener("close", abort));
  return killer.signal;
}

export type { Request, Response };
export type { AppDeps };