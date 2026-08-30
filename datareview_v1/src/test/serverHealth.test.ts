/**
 * Guarda do monitor de saúde do servidor: comparação de versão (commit
 * cliente × servidor) e parsing da sonda /health com guarda não-JSON.
 */
import { describe, it, expect, afterEach } from "vitest";
import {
  computeVersionMismatch,
  probeServerHealth,
  resetServerHealthForTests,
  getServerHealth,
} from "@/lib/serverHealth";

describe("computeVersionMismatch", () => {
  it("true quando os commits diferem (ambos presentes)", () => {
    expect(computeVersionMismatch("abc123", "def456")).toBe(true);
  });
  it("false quando os commits são iguais", () => {
    expect(computeVersionMismatch("abc123", "abc123")).toBe(false);
  });
  it("false quando o servidor não reporta commit (sem evidência)", () => {
    expect(computeVersionMismatch("abc123", null)).toBe(false);
    expect(computeVersionMismatch("abc123", undefined)).toBe(false);
  });
  it("false quando o cliente não tem commit injetado", () => {
    expect(computeVersionMismatch("", "def456")).toBe(false);
  });
});

describe("probeServerHealth", () => {
  afterEach(() => {
    resetServerHealthForTests();
  });

  it("marca online + versão/commit quando /health é JSON", async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ ok: true, version: "1.0.0", commit: "abc123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    const h = await probeServerHealth();
    expect(h.online).toBe(true);
    expect(h.serverVersion).toBe("1.0.0");
    expect(h.serverCommit).toBe("abc123");
    expect(getServerHealth().serverVersion).toBe("1.0.0");
  });

  it("marca offline quando /health devolve HTML (proxy sem servidor)", async () => {
    globalThis.fetch = async () =>
      new Response("<!doctype html><html></html>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    const h = await probeServerHealth();
    expect(h.online).toBe(false);
    expect(h.error).toBe("resposta não-JSON");
  });

  it("marca offline em erro de rede sem quebrar", async () => {
    globalThis.fetch = async () => {
      throw new Error("Failed to fetch");
    };
    const h = await probeServerHealth();
    expect(h.online).toBe(false);
    expect(h.error).toBe("Failed to fetch");
  });

  it("sem commit do cliente injetado, não acusa divergência (regra honesta)", async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ ok: true, commit: "commit-do-servidor" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    const h = await probeServerHealth();
    // Vitest não injeta __GIT_COMMIT__ → cliente sem commit → sem evidência
    // para alarmar. A divergência real é coberta por computeVersionMismatch.
    expect(h.online).toBe(true);
    expect(h.serverCommit).toBe("commit-do-servidor");
    expect(h.versionMismatch).toBe(false);
  });
});
