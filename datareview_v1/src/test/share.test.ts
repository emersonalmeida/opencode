import { describe, it, expect, beforeEach } from "vitest";
import { shareChatSession, shareGeneration, importShareBundle, listShareCandidates } from "@/lib/share";
import { listSessions, saveSession, clearAllSessions, type ChatSession } from "@/lib/chatHistoryStore";
import { listGenerations, recordGeneration } from "@/lib/sessionStore";

function opts(): { url: string; name?: string } {
  return { url: "" } as { url: string; name?: string };
}

describe("share (sessões/gerações singulares)", () => {
  beforeEach(() => {
    clearAllSessions();
  });

  it("importa + cria sessão sem colisão de ids", () => {
    saveSession(null, [{ role: "user", content: "o que é isso?" }], [], "chat");
    const s = listSessions()[0];
    const bundle = JSON.stringify({ app: "app-intelligence", kind: "chat-session", version: 1, exportedAt: "x", payload: s });
    const res = importShareBundle(bundle);
    expect(res.ok).toBe(true);
    expect(listSessions().length).toBe(2);
    expect(listSessions()[0].id !== listSessions()[1].id).toBe(true);
  });

  it("importShareBundle rejeita JSON inválido", () => {
    expect(importShareBundle("not json").ok).toBe(false);
    expect(importShareBundle("not json").error).toMatch(/JSON/);
  });

  it("importShareBundle rejeita bundle errado", () => {
    expect(importShareBundle(JSON.stringify({ app: "other", kind: "chat-session", payload: {} })).ok).toBe(false);
  });

  it("generation import cria nova geração", () => {
    const before = listGenerations().length;
    const g = { type: "collect" as const, label: "t", appKeys: ["k"], markdown: "ok", summary: "s" };
    const bundle = JSON.stringify({ app: "app-intelligence", kind: "generation", version: 1, exportedAt: "x", payload: g });
    expect(importShareBundle(bundle).ok).toBe(true);
    expect(listGenerations().length).toBe(before + 1);
  });

  it("listShareCandidates ok sem dataset", () => {
    expect(listShareCandidates().sessions).toBeInstanceOf(Array);
  });

  it("rejeita sessão sem mensagens e geração sem conteúdo", () => {
    const s: ChatSession = { id: "a", title: "t", messages: [], selectedAppKeys: [], createdAt: 0, updatedAt: 0, origin: "chat" };
    expect(importShareBundle(JSON.stringify({ app: "app-intelligence", kind: "chat-session", payload: s })).ok).toBe(false);
    expect(
      importShareBundle(JSON.stringify({ app: "app-intelligence", kind: "generation", payload: { markdown: "", summary: "" } })).ok,
    )
      .toBe(false);
  });
});
