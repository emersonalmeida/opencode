import { describe, expect, it } from "vitest";
import {
  ALL_ONE_SECTIONS,
  ONE_GROUP_LABELS,
  ONE_GROUP_ORDER,
  getOneSection,
  oneSectionParams,
} from "@/lib/one/oneSources";
import { resolveDrill } from "@/lib/one/oneDrills";
import type { UniItem } from "@/lib/uni/types";

function item(id: string, meta: Record<string, unknown>): UniItem {
  return { id, source: "custom", kind: "web-result", title: "t", meta };
}

describe("one/oneSources", () => {
  it("ids únicos e grupos válidos", () => {
    const ids = ALL_ONE_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of ALL_ONE_SECTIONS) {
      expect(ONE_GROUP_ORDER).toContain(s.group);
      expect(ONE_GROUP_LABELS[s.group]).toBeTruthy();
      expect(s.title).toBeTruthy();
      expect(s.question).toBeTruthy();
      expect(s.description).toBeTruthy();
    }
  });

  it("cobre os 4 tipos de fonte + IA", () => {
    const kinds = new Set(ALL_ONE_SECTIONS.map((s) => s.kind));
    expect(kinds.has("uni")).toBe(true);
    expect(kinds.has("connector")).toBe(true);
    expect(kinds.has("trending")).toBe(true);
    expect(kinds.has("discover")).toBe(true);
    expect(kinds.has("ai")).toBe(true);
  });

  it("cada grupo tem ao menos uma seção", () => {
    for (const g of ONE_GROUP_ORDER) {
      expect(ALL_ONE_SECTIONS.some((s) => s.group === g)).toBe(true);
    }
  });

  it("fontes de momento (noQuery) não exigem termo", () => {
    const noQuery = ALL_ONE_SECTIONS.filter((s) => s.caps.noQuery).map((s) => s.id);
    expect(noQuery).toContain("trending");
    expect(noQuery).toContain("d-clima");
    expect(noQuery).toContain("d-brasil");
    // termo-obrigatórias NÃO são noQuery
    expect(getOneSection("youtube")!.caps.noQuery).toBeFalsy();
  });

  it("fields declaram opções quando select", () => {
    for (const s of ALL_ONE_SECTIONS) {
      for (const f of s.fields) {
        if (f.kind === "select") expect((f.options ?? []).length).toBeGreaterThan(0);
      }
    }
  });

  it("oneSectionParams devolve valores ou defaults", () => {
    const trending = getOneSection("trending")!;
    expect(oneSectionParams(trending, {})).toEqual({ geo: "br", hours: "24" });
    expect(oneSectionParams(trending, { geo: "us" })).toEqual({ geo: "us", hours: "24" });
  });

  it("getOneSection encontra por id", () => {
    expect(getOneSection("youtube")!.title).toBe("YouTube");
    expect(getOneSection("ia")!.kind).toBe("ai");
    expect(getOneSection("nao-existe")).toBeUndefined();
  });
});

describe("one/oneDrills", () => {
  it("youtube → comentários do vídeo", () => {
    const d = resolveDrill("youtube", item("yt:abc", { videoId: "abc123" }));
    expect(d).toEqual({ kind: "comments", target: "abc123", label: "Comentários do vídeo" });
  });

  it("reddit → comentários do post (sub/postId)", () => {
    const d = resolveDrill("reddit", item("reddit:xyz", { subreddit: "brasil" }));
    expect(d).toEqual({ kind: "comments", target: "brasil/xyz", label: "Comentários do post" });
  });

  it("hackernews → comentários da história", () => {
    const d = resolveDrill("hackernews", item("hn:99", { hnId: "99" }));
    expect(d).toEqual({ kind: "comments", target: "99", label: "Comentários da história" });
  });

  it("wikipedia → artigo completo", () => {
    const d = resolveDrill("wikipedia", item("wiki:7", { pageid: 7 }));
    expect(d).toEqual({ kind: "article", target: "7", label: "Artigo completo" });
  });

  it("stackexchange → respostas da pergunta", () => {
    const d = resolveDrill("stackexchange", item("se:42", { questionId: "42", site: "pt.stackoverflow" }));
    expect(d).toEqual({ kind: "answers", target: "pt.stackoverflow/42", label: "Respostas da pergunta" });
  });

  it("steam → reviews do jogo", () => {
    const d = resolveDrill("steam", item("steam:730", { appId: "730" }));
    expect(d).toEqual({ kind: "reviews", target: "730", label: "Reviews do jogo" });
  });

  it("sem meta ou seção sem drill → null", () => {
    expect(resolveDrill("youtube", item("yt:x", {}))).toBeNull();
    expect(resolveDrill("suggest", item("s:1", {}))).toBeNull();
    expect(resolveDrill("trending", item("t:1", {}))).toBeNull();
  });
});
