import { describe, it, expect, beforeEach } from "vitest";
import {
  addFeedback, listFeedback, updateFeedbackStatus, voteFeedback, deleteFeedback,
  clearFeedback, filterFeedback, feedbackToMarkdown,
  type FeedbackItem,
} from "@/lib/feedback";

beforeEach(() => {
  localStorage.clear();
  clearFeedback();
});

const base = {
  kind: "bug" as const,
  title: "Erro no chat",
  description: "A resposta corta após a 4ª mensagem.",
  page: "/chat",
  aiMode: "local",
  attachments: [],
};

describe("feedback — sistema de feedback do usuário", () => {
  it("adiciona item com defaults (status novo, 0 votos, newest first)", () => {
    const item = addFeedback(base);
    expect(item.status).toBe("new");
    expect(item.votes).toBe(0);
    expect(item.id).toMatch(/^fb-/);
    const list = listFeedback();
    expect(list[0].id).toBe(item.id);
    expect(list[0].kind).toBe("bug");
  });

  it("persiste entre chamadas (localStorage pub/sub)", () => {
    addFeedback(base);
    const again = listFeedback();
    expect(again).toHaveLength(1);
  });

  it("transição de status por id", () => {
    const item = addFeedback(base);
    updateFeedbackStatus(item.id, "planned");
    expect(listFeedback().find((f) => f.id === item.id)?.status).toBe("planned");
  });

  it("voteFeedback incrementa votos", () => {
    const item = addFeedback(base);
    voteFeedback(item.id);
    voteFeedback(item.id);
    expect(listFeedback().find((f) => f.id === item.id)?.votes).toBe(2);
  });

  it("deleteFeedback + clearFeedback", () => {
    const a = addFeedback(base);
    const b = addFeedback({ ...base, title: "Outro" });
    // Ordem da lista é newest-first; b foi criado depois de a.
    deleteFeedback(a.id);
    expect(listFeedback().map((f) => f.id)).toContain(b.id);
    expect(listFeedback()).toHaveLength(1);
    clearFeedback();
    expect(listFeedback()).toEqual([]);
  });

  it("filtro por kind/status é determinístico", () => {
    const items: FeedbackItem[] = [
      { ...base, id: "1", status: "new", votes: 0, createdAt: 1, updatedAt: 1 },
      { ...base, id: "2", kind: "feature", status: "planned", votes: 0, createdAt: 2, updatedAt: 2 },
    ];
    expect(filterFeedback(items, "bug", "all")).toHaveLength(1);
    expect(filterFeedback(items, "all", "planned")).toHaveLength(1);
    expect(filterFeedback(items, "feature", "planned")).toHaveLength(1);
    expect(filterFeedback(items, "feature", "new")).toHaveLength(0);
  });

  it("feedbackToMarkdown lista com status, página, votos e descrição", () => {
    const item = addFeedback(base);
    voteFeedback(item.id);
    const md = feedbackToMarkdown(listFeedback());
    expect(md).toContain("# Feedback do usuário (1 item)");
    expect(md).toContain("[Novo] Bug: Erro no chat");
    expect(md).toContain("- Página: /chat");
    expect(md).toContain("- Votos: 1");
    expect(md).toContain(base.description);
  });

  it("item com anexo guarda nome/mime/dataUrl", () => {
    addFeedback({
      ...base,
      attachments: [{ name: "erro.png", mime: "image/png", dataUrl: "data:image/png;base64,AAAA" }],
    });
    const f = listFeedback()[0];
    expect(f.attachments[0].name).toBe("erro.png");
    expect(feedbackToMarkdown([f])).toContain("- Anexos: erro.png");
  });
});
