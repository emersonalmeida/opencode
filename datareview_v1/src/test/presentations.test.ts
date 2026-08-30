// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  newDeck, saveDeck, listDecks, deleteDeck, addSlide, updateSlide,
  removeSlide, duplicateSlide, moveSlide, buildDatasetDeck, markdownToSlides,
  deckToMarkdown, deckToHTML, getTheme, DECK_THEMES,
} from "@/lib/presentations";
import type { DatasetEntry } from "@/lib/datasetStore";
import type { ReviewEntry } from "@/lib/appStoreApi";

beforeEach(() => localStorage.clear());

function review(partial: Partial<ReviewEntry>): ReviewEntry {
  return {
    id: Math.random().toString(36).slice(2), store: "google", appId: "x",
    appName: "X", author: "U", rating: 5, title: "", text: "ótimo app rápido",
    date: "2026-01-01T00:00:00Z", ...partial,
  };
}

const ENTRIES: DatasetEntry[] = [
  {
    app: {
      id: "a1", store: "google", name: "AppA", icon: "", developer: "Dev",
      rating: 4.5, ratingCount: 1000, price: "0", genre: "Finanças",
      description: "", version: "1.0", releaseDate: "", currentVersionReleaseDate: "",
      screenshots: [], url: "",
    },
    reviews: [
      review({ rating: 5, text: "app muito bom e rápido" }),
      review({ rating: 4 }),
      review({ rating: 2, text: "trava demais", thumbsUp: 9 }),
    ],
    collectedAt: Date.now(),
  },
];

describe("presentations — store de decks", () => {
  it("save/list/delete com ordenação por updatedAt", () => {
    const a = newDeck("A");
    const b = newDeck("B");
    saveDeck(a);
    saveDeck({ ...b, updatedAt: b.updatedAt + 10 });
    const decks = listDecks();
    expect(decks).toHaveLength(2);
    expect(decks[0].title).toBe("B");
    deleteDeck(a.id);
    expect(listDecks()).toHaveLength(1);
  });

  it("cap de 30 decks", () => {
    for (let i = 0; i < 40; i++) saveDeck(newDeck(`D${i}`));
    expect(listDecks().length).toBeLessThanOrEqual(30);
  });

  it("novo deck começa com slide de capa", () => {
    const d = newDeck("T");
    expect(d.slides).toHaveLength(1);
    expect(d.slides[0].type).toBe("title");
    expect(d.slides[0].title).toBe("T");
  });
});

describe("presentations — operações de slide", () => {
  it("add/update/remove/duplicate/move", () => {
    let d = newDeck("X");
    d = addSlide(d, { type: "bullets", title: "B1" });
    d = addSlide(d, { type: "text", title: "T1" });
    expect(d.slides.map((s) => s.title)).toEqual(["X", "B1", "T1"]);

    d = updateSlide(d, d.slides[1].id, { title: "B1*" });
    expect(d.slides[1].title).toBe("B1*");

    const dup = duplicateSlide(d, d.slides[1].id);
    expect(dup.slides).toHaveLength(4);
    expect(dup.slides[2].title).toBe("B1*");
    expect(dup.slides[2].id).not.toBe(dup.slides[1].id);

    const moved = moveSlide(d, d.slides[1].id, 1);
    expect(moved.slides.map((s) => s.title)).toEqual(["X", "T1", "B1*"]);

    const removed = removeSlide(d, d.slides[0].id);
    expect(removed.slides.map((s) => s.title)).toEqual(["B1*", "T1"]);
  });

  it("moveSlide respeita bordas", () => {
    let d = newDeck("X");
    d = addSlide(d, { type: "text", title: "A" });
    expect(moveSlide(d, d.slides[0].id, -1).slides[0].title).toBe("X");
    expect(moveSlide(d, d.slides[1].id, 1).slides[1].title).toBe("A");
  });
});

describe("presentations — deck determinístico do dataset", () => {
  it("gera capa, KPIs, gráficos, citações, temas e fechamento", () => {
    const deck = buildDatasetDeck(ENTRIES, "Deck teste");
    const types = deck.slides.map((s) => s.type);
    expect(types[0]).toBe("title");
    expect(types).toContain("kpis");
    expect(types).toContain("chart");
    expect(types).toContain("quotes");
    expect(types).toContain("bullets");
    expect(types[types.length - 1]).toBe("section");
    // Subtítulo da capa menciona contagens reais
    expect(deck.slides[0].subtitle).toContain("1 app(s)");
    expect(deck.slides[0].subtitle).toContain("3 reviews");
  });

  it("KPIs refletem o dataset (nota média e % positivo)", () => {
    const deck = buildDatasetDeck(ENTRIES);
    const kpi = deck.slides.find((s) => s.type === "kpis")!;
    expect(kpi.body).toContain("nota:3.67");
    expect(kpi.body).toContain("positivo:67%");
  });
});

describe("presentations — IA markdown → slides", () => {
  it("converte blocos --- com título ## em slides", () => {
    const md = "## Abertura\n- ponto um\n- ponto dois\n\n---\n\n## Dados\nTexto livre aqui.";
    const slides = markdownToSlides(md);
    expect(slides).toHaveLength(2);
    expect(slides[0]).toMatchObject({ type: "bullets", title: "Abertura" });
    expect(slides[0].body).toContain("ponto um");
    expect(slides[1]).toMatchObject({ type: "text", title: "Dados" });
  });

  it("ignora blocos vazios e retorna [] para texto sem blocos", () => {
    expect(markdownToSlides("")).toEqual([]);
    expect(markdownToSlides("---\n---")).toEqual([]);
  });
});

describe("presentations — exportadores", () => {
  it("deckToMarkdown inclui título, slides e separadores", () => {
    const deck = buildDatasetDeck(ENTRIES, "MD");
    const md = deckToMarkdown(deck);
    expect(md).toContain("# MD");
    expect(md).toContain("## Números-chave");
    expect(md).toContain("---");
  });

  it("deckToHTML é autocontido com tema e navegação", () => {
    const deck = buildDatasetDeck(ENTRIES, "HTML");
    const html = deckToHTML(deck, ENTRIES);
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("keydown");
    expect(html).toContain(getTheme(deck.theme).accent);
    expect(html).toContain("Distribuição de notas");
    // Escapa HTML do conteúdo
    expect(html).not.toContain("<script id=");
  });

  it("deckToHTML escapa caracteres perigosos em títulos", () => {
    let d = newDeck("X");
    d = addSlide(d, { type: "text", title: "<img src=x onerror=alert(1)>", body: "ok" });
    const html = deckToHTML(d, []);
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
  });
});

describe("presentations — temas", () => {
  it("todos os temas têm campos obrigatórios e getTheme cai no primeiro", () => {
    for (const t of DECK_THEMES) {
      expect(t.bg).toBeTruthy();
      expect(t.accent).toBeTruthy();
      expect(t.fontScale).toBeGreaterThan(0);
    }
    expect(getTheme("inexistente" as never).id).toBe(DECK_THEMES[0].id);
  });
});
