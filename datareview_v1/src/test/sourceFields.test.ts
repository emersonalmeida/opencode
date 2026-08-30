/**
 * Testes do sourceFields — mapeamento maximalista por fonte (dados, metadados,
 * recursos e limites). Garante cobertura total das fontes da Uni e conteúdo
 * honesto (não vazio, sem promessas genéricas).
 */
import { describe, expect, it } from "vitest";
import { SOURCE_FIELDS, sourceFields } from "@/lib/uni/sourceFields";
import { UNI_SOURCE_META, type UniSourceId } from "@/lib/uni/types";

const ALL_SOURCES = Object.keys(UNI_SOURCE_META) as UniSourceId[];

describe("sourceFields — mapeamento maximalista por fonte", () => {
  it("cobre TODAS as fontes da Uni", () => {
    for (const id of ALL_SOURCES) {
      expect(SOURCE_FIELDS[id], `fonte sem mapeamento: ${id}`).toBeTruthy();
    }
    expect(Object.keys(SOURCE_FIELDS)).toHaveLength(ALL_SOURCES.length);
  });

  it("toda fonte tem dados, recursos e limites preenchidos", () => {
    for (const [id, f] of Object.entries(SOURCE_FIELDS)) {
      expect(f.dataFields.length, `${id}.dataFields`).toBeGreaterThan(0);
      expect(f.resources.length, `${id}.resources`).toBeGreaterThan(0);
      expect(f.limits.length, `${id}.limits`).toBeGreaterThan(10);
      for (const r of f.resources) expect(r.length, `${id} recurso vazio`).toBeGreaterThan(8);
    }
  });

  it("fontes ricas em metadados declaram as chaves de meta", () => {
    // Amostra das fontes cujos fetchers preservam meta extensa.
    expect(SOURCE_FIELDS.stackexchange.metaFields).toContain("isAccepted");
    expect(SOURCE_FIELDS.github.metaFields).toContain("topics");
    expect(SOURCE_FIELDS.youtube.metaFields).toContain("videoId");
    expect(SOURCE_FIELDS.steam.metaFields).toContain("playtimeHours");
    expect(SOURCE_FIELDS.gdelt.metaFields).toContain("sourceCountry");
  });

  it("limites honestos mencionam rate-limit onde ele existe", () => {
    expect(SOURCE_FIELDS.gdelt.limits).toMatch(/5s|rate/i);
    expect(SOURCE_FIELDS.trends.limits).toMatch(/429|rate/i);
    expect(SOURCE_FIELDS.semanticscholar.limits).toMatch(/429|rate/i);
  });

  it("fontes que exigem URL dizem isso nos limites", () => {
    expect(SOURCE_FIELDS.web.limits).toMatch(/URL/i);
    expect(SOURCE_FIELDS.feed.limits).toMatch(/URL|feed/i);
  });

  it("sourceFields() retorna a entrada da fonte", () => {
    expect(sourceFields("suggest")?.dataFields.length).toBeGreaterThan(0);
    expect(sourceFields("pypi")?.resources.length).toBeGreaterThan(0);
  });

  it("recursos refletem os modos de coleta implementados (multi-seleção)", () => {
    expect(SOURCE_FIELDS.suggest.resources.join(" ")).toMatch(/multi-selecion/i);
    expect(SOURCE_FIELDS.trends.resources.join(" ")).toMatch(/combin/i);
  });
});
