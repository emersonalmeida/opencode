/**
 * Valida a matriz de cobertura — garante que a auditoria reflita o código
 * REAL (não apenas o catálogo declarado) e que a pontuação seja estável.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { SOURCE_CATALOG } from "@v4/sources";
import { ADAPTERS } from "../src/adapters/index.js";
import { coverageReport, computeSourceCoverage } from "../src/coverage.js";

test("cobertura: toda fonte do catálogo tem entrada e score 0..1", () => {
  const report = coverageReport();
  assert.equal(report.length, SOURCE_CATALOG.length);
  for (const c of report) {
    assert.ok(c.coverageScore >= 0 && c.coverageScore <= 1, `${c.id}: score fora de faixa ${c.coverageScore}`);
    assert.ok(c.v4Actions.length > 0, `${c.id}: fonte sem capacidades v4`);
  }
});

test("cobertura: portado-reflete o registry de adapters (fonte de verdade)", () => {
  const report = coverageReport();
  const expectedPorted = new Set(Object.keys(ADAPTERS));
  for (const c of report) {
    const hasFactory = expectedPorted.has(c.id);
    assert.equal(c.ported, hasFactory, `${c.id}: ported divergente do ADAPTERS`);
  }
});

test("cobertura: fontes conhecidamente incompletas têm score < 1", () => {
  for (const id of ["steam", "deezer", "googleplay", "apple", "youtube", "github", "reddit"]) {
    const c = computeSourceCoverage(SOURCE_CATALOG.find((e) => e.id === id)!);
    assert.ok(c.coverageScore < 1, `${id}: deveria estar com score < 1 (ainda há v1/api a portar)`);
  }
});

test("cobertura: fontes completas têm score 1", () => {
  for (const id of ["wikitop", "trending"]) {
    const c = computeSourceCoverage(SOURCE_CATALOG.find((e) => e.id === id)!);
    assert.equal(c.coverageScore, 1, `${id}: deveria estar 100%`);
  }
});