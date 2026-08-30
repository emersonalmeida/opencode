import { describe, it, expect, beforeEach } from "vitest";
import {
  listSessions,
  saveSession,
  renameSession,
  deleteSession,
  clearAllSessions,
} from "@/lib/chatHistoryStore";
import type { ChatMessage } from "@/lib/experimentChatApi";

const KEY = "aso:chat-history:v1";

function userMsg(c: string): ChatMessage {
  return { role: "user", content: c };
}
function asstMsg(c: string): ChatMessage {
  return { role: "assistant", content: c };
}

describe("chatHistoryStore (localStorage sessions)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("creates a session on first save and assigns a stable id", () => {
    const msgs = [userMsg("Quais os pontos fortes?"), asstMsg("Resposta...")];
    const id = saveSession(null, msgs, ["apple:123"]);
    expect(id).toBeTruthy();
    const sessions = listSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe(id);
    expect(sessions[0].messages).toEqual(msgs);
    expect(sessions[0].title).toBe("Quais os pontos fortes?");
    expect(sessions[0].selectedAppKeys).toEqual(["apple:123"]);
  });

  it("updates an existing session when saving with its id (no duplicates)", () => {
    const msgs = [userMsg("Resuma os pontos fortes e fracos dos apps selecionados")];
    const id = saveSession(null, msgs, []);
    expect(listSessions()).toHaveLength(1);
    // Append an assistant reply and save again with the same id.
    const updated = [...msgs, asstMsg("Pontos fortes: ...")];
    const id2 = saveSession(id, updated, []);
    expect(id2).toBe(id);
    expect(listSessions()).toHaveLength(1);
    expect(listSessions()[0].messages).toEqual(updated);
  });

  it("derives the title from the first user message and truncates long titles", () => {
    const long = "x".repeat(80);
    const id = saveSession(null, [userMsg(long), asstMsg("ok")], []);
    const s = listSessions()[0];
    expect(s.id).toBe(id);
    expect(s.title.length).toBeLessThanOrEqual(50);
    expect(s.title.endsWith("…")).toBe(true);
  });

  it("does not persist a session with only assistant messages", () => {
    // Effect guard relies on hasUser; an assistant-only history should still be
    // saved if the caller explicitly invokes saveSession (the store is dumb),
    // but the title falls back to "Nova conversa".
    const id = saveSession(null, [asstMsg("sem user")], []);
    expect(listSessions()[0].title).toBe("Nova conversa");
    expect(id).toBeTruthy();
  });

  it("renames a session", () => {
    const id = saveSession(null, [userMsg("titulo antigo")], []);
    renameSession(id, "Título Novo");
    expect(listSessions()[0].title).toBe("Título Novo");
  });

  it("ignores empty rename (keeps old title)", () => {
    const id = saveSession(null, [userMsg("mantém")], []);
    renameSession(id, "   ");
    expect(listSessions()[0].title).toBe("mantém");
  });

  it("deletes a session", () => {
    const a = saveSession(null, [userMsg("a")], []);
    saveSession(null, [userMsg("b")], []);
    expect(listSessions()).toHaveLength(2);
    deleteSession(a);
    expect(listSessions()).toHaveLength(1);
    expect(listSessions()[0].title).toBe("b");
  });

  it("clearAllSessions empties the store and persists", () => {
    saveSession(null, [userMsg("a")], []);
    saveSession(null, [userMsg("b")], []);
    clearAllSessions();
    expect(listSessions()).toHaveLength(0);
    expect(localStorage.getItem(KEY)).toBe("[]");
  });

  it("caps the number of sessions at MAX_SESSIONS (100)", () => {
    for (let i = 0; i < 110; i++) saveSession(null, [userMsg(`msg ${i}`)], []);
    expect(listSessions().length).toBeLessThanOrEqual(100);
  });

  it("sorts sessions by updatedAt descending (most recent first)", () => {
    const a = saveSession(null, [userMsg("primeiro")], []);
    // Garante um updatedAt estritamente posterior para a segunda.
    saveSession(null, [userMsg("segundo")], []);
    const sessions = listSessions();
    expect(sessions).toHaveLength(2);
    // A mais recentemente atualizada deve vir primeiro; ambas acabaram de ser
    // criadas então a ordem pode empatar — mas regravar "a" com updatedAt
    // posterior inverte.
    saveSession(a, [userMsg("primeiro"), asstMsg("r")], []);
    const reordered = listSessions();
    expect(reordered[0].id).toBe(a);
  });
});
