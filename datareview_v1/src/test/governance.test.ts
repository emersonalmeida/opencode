/**
 * Guarda de governança (Onda 1.2): a regra de razão de crescimento existe,
 * está documentada e é mensurável. Se alguém remover o script ou a regra,
 * este teste falha.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { FEATURE_FLAGS } from "@/lib/featureFlags";

describe("governança — razão de crescimento (one-in-one-out)", () => {
  it("script de medição existe e é sintaticamente válido", () => {
    expect(existsSync("scripts/growth-ratio.mjs")).toBe(true);
    expect(() => execSync("node --check scripts/growth-ratio.mjs")).not.toThrow();
  });

  it("script roda e reporta a razão", () => {
    const out = execSync("node scripts/growth-ratio.mjs --last 10", { encoding: "utf8" });
    expect(out).toContain("Razão de crescimento");
    expect(out).toContain("alvo:");
  });

  it("regra one-in-one-out documentada no AGENTS.md", () => {
    const agents = readFileSync("AGENTS.md", "utf8");
    expect(agents).toContain("One-in-one-out");
    expect(agents).toContain("governance:growth");
  });

  it("npm script registrado", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    expect(pkg.scripts["governance:growth"]).toBe("node scripts/growth-ratio.mjs");
  });

  it("labs seguem flag-off por padrão (a única alavanca de poda automática)", () => {
    const labs = FEATURE_FLAGS.filter((f) => f.defaultOff).map((f) => f.key);
    expect(labs.length).toBeGreaterThanOrEqual(3);
    expect(labs).toContain("page.concept");
  });
});

describe("consolidação de chats — mapa (Onda 2.3)", () => {
  const doc = readFileSync("docs/historico/consolidacao-chats.md", "utf8");

  it("documento existe e declara o chat canônico", () => {
    expect(doc).toContain("UnifiedChatPanel");
    expect(doc).toContain("CANÔNICO");
  });

  it("todos os arquivos referenciados no mapa existem", () => {
    const refs = [...doc.matchAll(/`((?:pages|components)\/[^`]+?\.tsx)`/g)].map((m) => `src/${m[1]}`);
    expect(refs.length).toBeGreaterThanOrEqual(12);
    for (const ref of refs) expect(existsSync(ref), `faltou ${ref}`).toBe(true);
  });

  it("fase 2 não remove nada sem one-in-one-out", () => {
    expect(doc).toContain("one-in-one-out");
  });
});

describe("hubs consolidados — Onda 2.5", () => {
  const doc = readFileSync("docs/historico/consolidacao-hubs.md", "utf8");

  it("documento existe e declara a decisão", () => {
    expect(doc).toContain("/fluxo");
    expect(doc).toContain("defaultOff");
  });

  it("decisão executável: /01 e /nucleo são labs opt-in (defaultOff)", async () => {
    const { FEATURE_FLAGS } = await import("@/lib/featureFlags");
    for (const key of ["page.01", "page.nucleo"]) {
      expect(FEATURE_FLAGS.find((f) => f.key === key)?.defaultOff, key).toBe(true);
    }
    // os 4 hubs que servem o loop permanecem ON por padrão
    for (const key of ["page.fluxo", "page.jornada", "page.00", "page.os", "page.ia"]) {
      expect(FEATURE_FLAGS.find((f) => f.key === key)?.defaultOff ?? false, key).toBe(false);
    }
  });
});

describe("consolidação de chats — fase 2 (Onda 2.4)", () => {
  it("/conversa é lab opt-in; chats-modo (voz/arquivos) permanecem ON", async () => {
    const { FEATURE_FLAGS } = await import("@/lib/featureFlags");
    expect(FEATURE_FLAGS.find((f) => f.key === "page.conversa")?.defaultOff).toBe(true);
    for (const key of ["page.chat", "page.chat-voz", "page.chat-arquivos"]) {
      expect(FEATURE_FLAGS.find((f) => f.key === key)?.defaultOff ?? false, key).toBe(false);
    }
  });

  it("doc de consolidação registra a decisão executável", () => {
    const doc = readFileSync("docs/historico/consolidacao-chats.md", "utf8");
    expect(doc).toContain("Fase 2 (execução)");
    expect(doc).toContain("/conversa");
  });
});
