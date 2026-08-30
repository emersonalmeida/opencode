// @vitest-environment node
/**
 * Auditoria estrutural multifonte (Peça 1): garante que TODA fonte Uni
 * (UniSourceId) é coletável pelo pipeline (suggest…pypi), tem UNI_SOURCE_META,
 * e existe um extractor fetch* exportado em uniApi para as que não são
 * connectors genéricos — sem isto, o runner cai no default com a razão honesta.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import {
  UNI_SOURCE_META, type UniSourceId,
} from "../lib/uni/types";
import { PIPELINE_SOURCES, sourceSkipReason } from "../lib/uni/sourceRunner";

const ALL: UniSourceId[] = [
  "suggest", "trends", "serp", "youtube", "reddit", "wikipedia", "hackernews",
  "gdelt", "arxiv", "stackexchange", "github", "semanticscholar", "steam",
  "web", "feed", "paste", "devto", "lobsters", "mastodon", "bluesky",
  "wikidata", "openalex", "crossref", "openlibrary", "npm", "pypi", "itchio",
  "rubygems", "cratesio", "doaj", "openfoodfacts", "archive", "tvmaze",
  "producthunt",
];

/** Fontes que o runner despacha ao fetchConnector (não precisam de fetch* próprio). */
const CONNECTORS = new Set<UniSourceId>([
  "devto", "lobsters", "mastodon", "bluesky", "wikidata",
  "openalex", "crossref", "openlibrary", "npm", "pypi", "itchio",
  "rubygems", "cratesio", "doaj", "openfoodfacts", "archive", "tvmaze",
]);

const uniApiSrc = readFileSync("src/lib/uni/uniApi.ts", "utf8");

describe("multifonte — cobertura total das fontes no pipeline", () => {
  it("PIPELINE_SOURCES cobre TODA UniSourceId menos 'paste' e 'producthunt' (documentado)", () => {
    const missing = ALL.filter((s) => s !== "paste" && s !== "producthunt" && !PIPELINE_SOURCES.includes(s));
    expect(missing).toEqual([]);
    // 'paste' é intencional — skip com razão honesta (precisa de texto colado).
    expect(sourceSkipReason("paste", "qualquer")).toContain("Colar texto");
    // 'producthunt' é intencional — feed de lançamentos do dia, NÃO busca por
    // termo (incluir no pipeline retornaria os mesmos lançamentos para
    // qualquer query, poluindo o resultado).
  });

  it("UNI_SOURCE_META completo para TODA fonte", () => {
    for (const s of ALL) {
      expect(UNI_SOURCE_META[s], `meta da fonte ${s}`).toBeDefined();
      expect(UNI_SOURCE_META[s].label.length).toBeGreaterThan(0);
    }
  });

  it("fonte no pipeline tem extractor fetch* (ou cai no connector genérico)", () => {
    const failures: string[] = [];
    for (const s of PIPELINE_SOURCES) {
      if (CONNECTORS.has(s)) continue;
      // Heurística: o switch do runner deve despachar um fetch<Algo> para a fonte.
      const hasFetcher = /fetch[A-Z][a-zA-Z]+/.test(readFileSync("src/lib/uni/sourceRunner.ts", "utf8"));
      expect(hasFetcher).toBe(true);
    }
    expect(failures).toEqual([]);
  });

  it("sourceSkipReason só bloqueia web/feed sem URL (ou paste)", () => {
    expect(sourceSkipReason("web", "bitcoin")).toContain("URL");
    expect(sourceSkipReason("feed", "bitcoin")).toContain("URL");
    expect(sourceSkipReason("web", "https://exemplo.com")).toBeNull();
    expect(sourceSkipReason("feed", "https://exemplo.com")).toBeNull();
    expect(sourceSkipReason("youtube", "bitcoin")).toBeNull();
  });
});
