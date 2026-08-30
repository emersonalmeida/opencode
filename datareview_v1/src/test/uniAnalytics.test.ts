import { describe, it, expect } from "vitest";
import { uniWordFreq, uniSourceDist, uniKindDist, uniTopScored, uniSerializeForAI } from "@/lib/uni/uniAnalytics";
import type { UniItem } from "@/lib/uni/types";

function item(partial: Partial<UniItem>): UniItem {
  return {
    id: partial.id ?? `i${Math.random()}`,
    source: partial.source ?? "serp",
    kind: partial.kind ?? "web-result",
    title: partial.title ?? "Título",
    text: partial.text,
    url: partial.url,
    author: partial.author,
    date: partial.date,
    score: partial.score,
    meta: partial.meta,
  };
}

describe("uniWordFreq", () => {
  it("conta termos por documento, sem stopwords e números", () => {
    const items = [
      item({ title: "nubank é bom", text: "o nubank tem 123 problemas" }),
      item({ title: "nubank e inter", text: "comparação nubank" }),
    ];
    const freq = uniWordFreq(items);
    const nubank = freq.find((f) => f.text === "nubank");
    expect(nubank?.value).toBe(2); // 1x por documento, não por ocorrência
    expect(freq.some((f) => f.text === "123")).toBe(false);
    expect(freq.some((f) => f.text === "é" || f.text === "o")).toBe(false);
  });

  it("respeita o limite", () => {
    const items = Array.from({ length: 50 }, (_, i) => item({ title: `termo${i} alpha` }));
    expect(uniWordFreq(items, 10).length).toBeLessThanOrEqual(10);
  });
});

describe("uniSourceDist / uniKindDist", () => {
  it("agrupa por fonte", () => {
    const items = [item({ source: "serp" }), item({ source: "serp" }), item({ source: "reddit" })];
    expect(uniSourceDist(items)).toContainEqual({ label: "serp", value: 2 });
    expect(uniSourceDist(items)).toContainEqual({ label: "reddit", value: 1 });
  });

  it("agrupa por tipo ordenado desc", () => {
    const items = [
      item({ kind: "video" }), item({ kind: "video" }),
      item({ kind: "comment" }),
    ];
    const dist = uniKindDist(items);
    expect(dist[0]).toEqual({ label: "video", value: 2 });
    expect(dist[1]).toEqual({ label: "comment", value: 1 });
  });
});

describe("uniTopScored", () => {
  it("ordena por score e ignora sem score", () => {
    const items = [
      item({ title: "baixo", score: 5 }),
      item({ title: "alto", score: 100 }),
      item({ title: "zero", score: 0 }),
      item({ title: "sem" }),
    ];
    const top = uniTopScored(items);
    expect(top[0]).toEqual({ label: "alto", value: 100 });
    expect(top.some((t) => t.label === "zero" || t.label === "sem")).toBe(false);
  });
});

describe("uniSerializeForAI", () => {
  it("serializa com fonte/tipo e trunca no cap", () => {
    const items = [
      item({ title: "Post A", text: "texto longo ".repeat(100), score: 42, source: "reddit", kind: "post" }),
      item({ title: "Post B", text: "texto longo ".repeat(100), score: 1 }),
    ];
    const s = uniSerializeForAI(items, 600);
    expect(s).toContain("[reddit/post] Post A");
    expect(s).toContain("score: 42");
    expect(s.length).toBeLessThanOrEqual(700); // cap + linha corrente
  });

  it("prioriza itens com texto/score", () => {
    const items = [
      item({ title: "sem nada" }),
      item({ title: "rico", text: "conteúdo", score: 10 }),
    ];
    const s = uniSerializeForAI(items, 100);
    expect(s).toContain("rico");
  });
});
