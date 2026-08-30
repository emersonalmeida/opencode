import type { RequestHandler } from "express";
// Camada RAW/provenance (aditivo): helper failure-safe, nunca muda a resposta.
import { startRun, finishRun, saveRawArtifact, type CollectionRun } from "../lib/rawStore.js";
import { withObservation } from "../lib/auditObservation.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Conector GitHub — repositórios e issues via Search API. Referência:
 * docs/_uni.py (buscar_repos / buscar_issues).
 *
 * Sem auth: 10 req/min na Search API. Se GITHUB_TOKEN estiver no env do
 * servidor, usa (30 req/min). Rate-limit vira erro honesto com reset.
 *
 * Ações:
 *  - repos:  { query, sort?: "stars"|"updated"|"forks", limit? }
 *  - issues: { query, state?: "open"|"closed"|"all", limit? }
 */
const GH_SEARCH = "https://api.github.com/search";
const UA = "AppDataReview/1.0 (research)";

function ghHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    "User-Agent": UA,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function ghGet(url: string): Promise<unknown> {
  const resp = await fetch(url, { headers: ghHeaders(), signal: AbortSignal.timeout(15000) });
  if (resp.status === 403 || resp.status === 429) {
    const reset = resp.headers.get("x-ratelimit-reset");
    const when = reset ? new Date(Number(reset) * 1000).toLocaleTimeString("pt-BR") : null;
    throw new Error(`GitHub rate-limit atingido${when ? ` (libera às ${when})` : ""}. Configure GITHUB_TOKEN no servidor para mais cota.`);
  }
  if (!resp.ok) throw new Error(`GitHub retornou ${resp.status}`);
  return resp.json();
}

interface GhRepo {
  full_name: string;
  description?: string;
  html_url: string;
  stargazers_count?: number;
  forks_count?: number;
  open_issues_count?: number;
  language?: string;
  updated_at?: string;
  topics?: string[];
}

interface GhIssue {
  id: number;
  title: string;
  html_url: string;
  state?: string;
  comments?: number;
  created_at?: string;
  user?: { login?: string };
  repository_url?: string;
  labels?: { name?: string }[];
  pull_request?: unknown;
}

export const uniGithub: RequestHandler = async (req, res) => {
  res.set(corsHeaders);
  let run: CollectionRun | null = null;
  try {
    const { action } = req.body ?? {};

    if (action === "repos") {
      const { query, sort = "stars", limit } = req.body ?? {};
      if (!query || typeof query !== "string") return res.status(400).json({ error: "query required" });
      const max = Math.max(1, Math.min(Number(limit) || 20, 100));
      const sortBy = ["stars", "updated", "forks"].includes(String(sort)) ? String(sort) : "stars";
      run = startRun({
        sourceId: "github",
        subjectKey: `github:repos:${query}:${sortBy}`,
        collector: "uni-github",
        collectorVersion: "1",
        params: { action, query, sort: sortBy, limit: max },
      });
      const url = `${GH_SEARCH}/repositories?q=${encodeURIComponent(query)}&sort=${sortBy}&order=desc&per_page=${max}`;
      const data = await withObservation(
        run.id, "github", "gh-search-repos", url,
        { action, query, sort: sortBy, limit: max },
        () => ghGet(url),
      ) as { items?: GhRepo[] };
      const repos = (data.items ?? []).map((r) => ({
        name: r.full_name,
        description: r.description ?? "",
        url: r.html_url,
        stars: r.stargazers_count ?? 0,
        forks: r.forks_count ?? 0,
        openIssues: r.open_issues_count ?? 0,
        language: r.language ?? "",
        updatedAt: r.updated_at ?? "",
        topics: r.topics ?? [],
      }));
      saveRawArtifact({
        runId: run.id, sourceId: "github", subjectKey: `github:repos:${query}:${sortBy}`,
        endpoint: "gh-search-repos", url, params: { action, query, sort: sortBy, limit: max },
        payload: { count: repos.length }, collector: "uni-github", collectorVersion: "1",
      });
      finishRun(run, { status: repos.length ? "completed" : "partial", yielded: repos.length });
      return res.json({ repos, count: repos.length });
    }

    if (action === "issues") {
      const { query, state = "open", limit } = req.body ?? {};
      if (!query || typeof query !== "string") return res.status(400).json({ error: "query required" });
      const max = Math.max(1, Math.min(Number(limit) || 20, 100));
      const st = ["open", "closed", "all"].includes(String(state)) ? String(state) : "open";
      run = startRun({
        sourceId: "github",
        subjectKey: `github:issues:${query}:${st}`,
        collector: "uni-github",
        collectorVersion: "1",
        params: { action, query, state: st, limit: max },
      });
      const q = `${query} is:issue state:${st === "all" ? "" : st}`.trim();
      const url = `${GH_SEARCH}/issues?q=${encodeURIComponent(q)}&sort=created&order=desc&per_page=${max}`;
      const data = await withObservation(
        run.id, "github", "gh-search-issues", url,
        { action, query, state: st, limit: max },
        () => ghGet(url),
      ) as { items?: GhIssue[] };
      const issues = (data.items ?? [])
        .filter((i) => !i.pull_request)
        .map((i) => ({
          id: i.id,
          title: i.title,
          url: i.html_url,
          state: i.state ?? "",
          comments: i.comments ?? 0,
          repo: (i.repository_url ?? "").split("/repos/")[1] ?? "",
          author: i.user?.login ?? "",
          createdAt: i.created_at ?? "",
          labels: (i.labels ?? []).map((l) => l.name ?? "").filter(Boolean),
        }));
      saveRawArtifact({
        runId: run.id, sourceId: "github", subjectKey: `github:issues:${query}:${st}`,
        endpoint: "gh-search-issues", url, params: { action, query, state: st, limit: max },
        payload: { count: issues.length }, collector: "uni-github", collectorVersion: "1",
      });
      finishRun(run, { status: issues.length ? "completed" : "partial", yielded: issues.length });
      return res.json({ issues, count: issues.length });
    }

    return res.status(400).json({ error: `unknown action: ${action} (use repos|issues)` });
  } catch (err) {
    console.error("uni-github error:", err);
    if (run) {
      finishRun(run, { status: "failed", errors: [{ endpoint: "github", message: String((err as Error)?.message || err) }] });
    }
    return res.status(500).json({ error: String((err as Error)?.message || err) });
  }
};
