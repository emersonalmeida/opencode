/**
 * Testes do catálogo da v5 — valida os contratos que NUNCA podem quebrar:
 *  - ids únicos; grupos/categorias preenchidos; status implementado;
 *  - ativação derivável (8 defaults + overrides de usuário);
 *  - prioridade sem-auth (públicas primeiro); ordenação estável.

 * Node:test nativo (sem framework — mesma linha da v4.
 */
import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import {
  AUTH_PRIORITY,
  computeEnabledSources,
  countEnabled,
  getSourceCatalogEntry,
  isPublic,
  listSourceCatalog,
} from "../src/index.js";

const catalog = listSourceCatalog();

describe("catálogo", () => {
  test("59 fontes documentadas, todas com coletor (implemented)", () => {
    assert.equal(catalog.length, 59);
    const ids = new Set(catalog.map((e) => e.id));
    assert.equal(ids.size, 59, "ids devem ser únicos");
    assert.ok(catalog.every((e) => e.status === "implemented"), "todas devem estar implemented na entrega atual");
    assert.ok(catalog.every((e) => e.group && e.category && e.resource && e.params.length > 0 && e.data.length > 0), "metadados obrigatórios preenchidos");
  });

  test("8 fontes ativas por padrão — exatamente as prioritárias sem-auth", () => {
    const enabled = catalog.filter((e) => e.enabledByDefault === true);
    assert.deepEqual(
      enabled.map((e) => e.id).sort(),
      ["apple", "googleplay", "producthunt", "reclameaqui", "serp", "suggest", "trends", "youtube"].sort(),
    );
    for (const e of enabled) {
      assert.ok(isPublic(e), `${e.id} deveria ser pública por padrão (auth ${e.auth})`);
    }
    assert.equal(countEnabled(), 8);
  });

  test("overrides de usuário vencem o default", () => {
    const withDesativada = computeEnabledSources(catalog, { trends: false });
    assert.ok(!withDesativada.some((e) => e.id === "trends"), "override false desativa");
    const comAtiva = computeEnabledSources(catalog, { arxiv: true });
    assert.ok(comAtiva.some((e) => e.id === "arxiv"), "override true ativa fonte extra");
    assert.equal(computeEnabledSources(catalog, { apple: false }).length, 7, "desativar um default reduz a 7");
  });

  test("prioridade sem-auth: públicas ordenadas antes de BYOK/OAuth entre ativas", () => {
    const enabled = computeEnabledSources();
    const ranks = enabled.map((e) => AUTH_PRIORITY[e.auth] ?? 9);
    for (let i = 1; i < ranks.length; i++) {
      assert.ok((ranks[i] ?? 9) >= (ranks[i - 1] ?? 9), "rank de auth deve ser não-decrescente entre ativas");
    }
  });

  test("registro por id e aliases", () => {
    const gp = getSourceCatalogEntry("googleplay");
    assert.ok(gp);
    assert.equal(gp.enabledByDefault, true);
    const viaAlias = getSourceCatalogEntry("discover-google-play");
    assert.ok(viaAlias, "alias deve resolver");
    assert.equal(viaAlias?.id, "googleplay");
    const viaCoingecko = getSourceCatalogEntry("coingecko");
    assert.equal(viaCoingecko?.id, "crypto");
  });
});