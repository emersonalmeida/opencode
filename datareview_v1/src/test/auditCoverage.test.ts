/**
 * Guarda de cobertura total: TODA fonte UniSourceId (exceto custom/paste)
 * tem uma sonda no Audit Engine. Sem isso, fontes ficam sem baseline de
 * descoberta e a auditoria fica incompleta.
 */
import { describe, expect, it } from "vitest";
import { AUDIT_PROBES } from "@/lib/audit/auditProbes";
import { buildTestPlan } from "@/lib/sourceTests/sourceTestRunner";

// UniSourceId completo (de src/lib/uni/types.ts) — exceto custom/paste
// (custom = definição do usuário no body; paste = texto local, sem rede).
const ALL_UNI_SOURCES = [
  "suggest", "trends", "serp", "youtube", "reddit", "wikipedia", "hackernews",
  "gdelt", "arxiv", "stackexchange", "github", "semanticscholar", "steam",
  "web", "feed", "devto", "lobsters", "mastodon", "bluesky", "wikidata",
  "openalex", "crossref", "openlibrary", "npm", "pypi", "itchio", "rubygems",
  "cratesio", "doaj", "openfoodfacts", "archive", "tvmaze", "reclameaqui",
  "producthunt",
] as const;

describe("cobertura total de fontes na auditoria", () => {
  it("TODA fonte tem sonda no AUDIT_PROBES", () => {
    const probed = new Set(AUDIT_PROBES.map((p) => p.sourceId));
    const missing = ALL_UNI_SOURCES.filter((s) => !probed.has(s));
    expect(missing).toEqual([]);
  });

  it("nenhuma sonda duplicada (sourceId único)", () => {
    const ids = AUDIT_PROBES.map((p) => p.sourceId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("total de sondas = total de fontes (35)", () => {
    expect(AUDIT_PROBES.length).toBe(ALL_UNI_SOURCES.length);
  });

  it("a página /testes-fontes cobre TODAS as fontes da auditoria", () => {
    const plan = buildTestPlan();
    const testedSources = new Set(plan.map((p) => p.sourceId));
    const missing = ALL_UNI_SOURCES.filter((s) => !testedSources.has(s));
    expect(missing).toEqual([]);
  });
});
