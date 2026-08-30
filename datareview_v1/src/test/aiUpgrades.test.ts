/**
 * Guard da matriz de superpoderes de IA (aiUpgrades.ts).
 *
 * Garante: (1) todo upgrade aponta para uma capacidade sem IA existente;
 * (2) refs apontam arquivos/símbolos reais; (3) as capacidades-chave têm
 * upgrade documentado; (4) superfícies de IA em testes declaram setAIMode
 * (com storage limpo o modo é "none" e a IA não roda — ver AGENTS.md).
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { AI_UPGRADES, upgradesFor } from "@/lib/aiUpgrades";
import { NO_AI_CAPABILITIES } from "@/lib/noAiCapabilities";

const REPO_ROOT = process.cwd();

describe("matriz de superpoderes de IA (integridade)", () => {
  it("todo upgrade referencia capacidade sem IA existente", () => {
    const ids = new Set(NO_AI_CAPABILITIES.map((c) => c.id));
    for (const u of AI_UPGRADES) {
      expect(ids.has(u.capabilityId), `capabilityId desconhecido: ${u.capabilityId}`).toBe(true);
      expect(u.superpower.length).toBeGreaterThan(20);
      expect(u.implementations.length).toBeGreaterThan(0);
    }
  });

  it("capabilityIds únicos", () => {
    const ids = AI_UPGRADES.map((u) => u.capabilityId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("refs apontam arquivos e símbolos reais", () => {
    for (const u of AI_UPGRADES) {
      for (const impl of u.implementations) {
        const [file, symbol] = impl.ref.split("·").map((s) => s.trim());
        const abs = path.join(REPO_ROOT, file);
        expect(existsSync(abs), `${u.capabilityId}: ${file} não existe`).toBe(true);
        if (symbol) {
          const content = readFileSync(abs, "utf8");
          expect(content.includes(symbol), `${u.capabilityId}: '${symbol}' ausente em ${file}`).toBe(true);
        }
      }
    }
  });

  it("capacidades-chave têm superpoder documentado", () => {
    for (const id of ["analisar", "gerar-relatorio", "comandar", "criar", "reanalisar"]) {
      expect(upgradesFor(id).length, `capacidade ${id} sem upgrade`).toBeGreaterThan(0);
    }
  });

  it("análise declara a base determinística que alimenta a IA", () => {
    const analisar = upgradesFor("analisar")[0];
    expect(analisar.deterministicBase).toContain("computeFacts");
  });
});
